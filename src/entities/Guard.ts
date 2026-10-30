import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'search' | 'return';

/**
 * Guard — Medieval palace sentinel with visible vision cone.
 *
 * State Machine (v2 — additive on original)
 * ─────────────────────────────────────────
 *  PATROL     → walks patrolLeft ↔ patrolRight; cone checks for targets
 *               occasionally pauses and looks back (patrol pause/lookback)
 *  SUSPICIOUS → spotted something uncertain; stops, shows "?" — checks for a
 *               brief window; if still visible → ALERT, else → PATROL
 *  ALERT      → detected player/decoy; chases at alertSpeed; alerts nearby guards
 *  SEARCH     → lost sight; moves to lastKnownX, holds briefly
 *  RETURN     → walks back toward patrol midpoint, then resumes PATROL
 *
 * Vision Cone (always visible, colour-coded by state):
 *  patrol/suspicious → yellow/amber  alert → orange/red  search → warm orange
 *
 * Camouflage effect: reduces effective vision range by cloakRangeMultiplier (default 0.4).
 *
 * All per-guard timings/speeds come from the opts object (new optional fields, backwards-compatible).
 */

export interface ObstacleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Optional config overrides — all fields are optional; defaults equal the original behaviour. */
export interface GuardOpts {
  name?: string;
  visionRange?: number;
  visionAngle?: number;
  facingRight?: boolean;
  /** Walk speed during patrol (default 36) */
  patrolSpeed?: number;
  /** Chase speed during alert (default 78) */
  alertSpeed?: number;
  /** ms to stay in ALERT before switching to SEARCH (default 3500) */
  alertDuration?: number;
  /** ms to stay in SEARCH before RETURN (default 2000) */
  searchDuration?: number;
  /** ms that SUSPICIOUS state lasts (default 1200) */
  suspiciousDuration?: number;
  /** World-X radius within which this guard alerts others on sight (default 0 = disabled) */
  alertRadius?: number;
  /** Optional solid obstacles/walls that block line of sight and clip vision cones */
  obstacles?: ObstacleRect[];
}

export class Guard extends Phaser.Physics.Arcade.Sprite {
  public guardState: GuardState = 'patrol';
  public readonly guardName: string;

  // Vision parameters
  private readonly VISION_RANGE: number;
  private readonly VISION_HALF_DEG: number;
  /** When player is cloaked the effective range is multiplied by this. */
  private readonly CLOAK_RANGE_MULT = 0.4;
  private obstacles: ObstacleRect[] = [];

  // Detection meter (0.0 to 1.0)
  public detectionLevel = 0;

  // Speeds (now configurable)
  private readonly PATROL_SPEED: number;
  private readonly ALERT_SPEED: number;

  // Patrol bounds
  private readonly patrolLeft: number;
  private readonly patrolRight: number;
  private facingRight: boolean;

  // State timers (ms)
  private alertTimer       = 0;
  private searchTimer      = 0;
  private lastKnownX       = 0;

  // Per-guard durations (configurable)
  private readonly ALERT_DURATION:      number;
  private readonly SEARCH_DURATION:     number;
  private readonly SUSPICIOUS_DURATION: number;

  // Patrol pause / look-back
  private patrolPauseTimer  = 0;
  private patrolPauseCooldown = 0;
  private readonly PATROL_PAUSE_DURATION  = 600;   // ms guard stops and turns briefly
  private readonly PATROL_PAUSE_INTERVAL  = 4000;  // ms between pauses
  private patrolLookDir = 0;   // +1 or -1 while looking back

  // Alert propagation radius (0 = disabled)
  private readonly ALERT_RADIUS: number;
  /** Registered peer guards for alert propagation. */
  private peers: Guard[] = [];

  // Stuck detection
  private prevX = 0;
  private stuckTimer = 0;
  private readonly STUCK_THRESHOLD = 600; // ms without moving → flip

  // Visuals
  private readonly visionCone:   Phaser.GameObjects.Graphics;
  private readonly eyeGfx:       Phaser.GameObjects.Graphics;
  private readonly detectionGfx: Phaser.GameObjects.Graphics;
  private alertIcon?: Phaser.GameObjects.Text;
  private nameLabel?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolLeft: number,
    patrolRight: number,
    opts: GuardOpts = {}
  ) {
    super(scene, x, y, 'guard_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.patrolLeft           = patrolLeft;
    this.patrolRight          = patrolRight;
    this.guardName            = opts.name              ?? 'GUARD';
    this.VISION_RANGE         = opts.visionRange       ?? 130;
    this.VISION_HALF_DEG      = opts.visionAngle       ?? 45;
    this.facingRight          = opts.facingRight       ?? true;
    this.PATROL_SPEED         = opts.patrolSpeed       ?? 36;
    // Speed increases to threefold (3x) after light turns red
    this.ALERT_SPEED          = opts.alertSpeed ? Math.max(opts.alertSpeed, this.PATROL_SPEED * 4) : (this.PATROL_SPEED * 4);
    this.ALERT_DURATION       = opts.alertDuration     ?? 3500;
    this.SEARCH_DURATION      = opts.searchDuration    ?? 1500;
    this.SUSPICIOUS_DURATION  = opts.suspiciousDuration ?? 200; // Soldier gets suspicious quickly (300ms) in light range
    this.ALERT_RADIUS         = opts.alertRadius       ?? 0;
    this.obstacles            = opts.obstacles         ?? [];

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    this.setSize(14, 28);
    this.setOffset(2, 4);
    this.setDepth(9);

    this.visionCone   = scene.add.graphics().setDepth(6);
    this.eyeGfx       = scene.add.graphics().setDepth(20);
    this.detectionGfx = scene.add.graphics().setDepth(23);

    this.nameLabel = scene.add.text(x, y - 36, this.guardName, {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#cccc88',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);

    this.prevX = x;
    // Stagger patrol-pause timer so guards don't all pause simultaneously
    this.patrolPauseCooldown = Math.random() * this.PATROL_PAUSE_INTERVAL;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Set or update solid obstacles that block this guard's line of sight */
  public setObstacles(obs: ObstacleRect[]): void {
    this.obstacles = obs;
  }

  /** True while in ALERT — scene checks this before dealing contact damage. */
  public get isLethal(): boolean {
    return this.guardState === 'alert';
  }

  /**
   * Register peer guards that this guard will alert when it spots a target.
   * Call once after all guards are spawned.
   */
  public registerPeers(guards: Guard[]): void {
    this.peers = guards.filter(g => g !== this);
  }

  /**
   * Reset guard to patrol state, clearing all detection meters and alerts.
   * Called during respawns and run resets.
   */
  public resetToPatrol(initialX?: number, initialFacingRight?: boolean): void {
    this.guardState = 'patrol';
    this.detectionLevel = 0;
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.patrolPauseTimer = 0;
    this.patrolLookDir = 0;
    this.clearTint();
    this.alertIcon?.setVisible(false);
    this.detectionGfx.clear();

    if (initialX !== undefined) {
      this.setPosition(initialX, this.y);
      this.prevX = initialX;
    }
    if (initialFacingRight !== undefined) {
      this.facingRight = initialFacingRight;
      this.setFlipX(!this.facingRight);
    }
    if (this.body) {
      const b = this.body as Phaser.Physics.Arcade.Body;
      b.setVelocityX((this.facingRight ? 1 : -1) * this.PATROL_SPEED);
    }
    if (this.scene.anims.exists('guard_idle')) {
      this.anims.play('guard_idle', true);
    }
  }

  /**
   * Main update — call from scene.update() every frame.
   *
   * @param delta         ms since last frame
   * @param playerX       player world X
   * @param playerY       player world Y
   * @param decoyPos      optional decoy position (checked BEFORE player)
   * @param playerCloaked if true, player's effective detection range is reduced
   */
  public update(
    _time: number,
    delta: number,
    playerX: number,
    playerY: number,
    decoyPos: { x: number; y: number } | null = null,
    playerCloaked = false
  ): void {
    if (!this.body || !this.active) return;

    const body = this.body as Phaser.Physics.Arcade.Body;

    // When cloaked, shrink vision range for player detection
    const effectiveRange = playerCloaked
      ? this.VISION_RANGE * this.CLOAK_RANGE_MULT
      : this.VISION_RANGE;

    const seeDecoy  = decoyPos !== null && this.canSeePosition(decoyPos.x, decoyPos.y);
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    const touchPlayer  = !playerCloaked && distToPlayer < 24;
    const seePlayer    = !playerCloaked &&
      (this.canSeePositionRange(playerX, playerY, effectiveRange) || touchPlayer);

    // ── State machine ─────────────────────────────────────────────────────
    switch (this.guardState) {

      case 'patrol':
        if (seeDecoy) {
          this.enterAlert(decoyPos!.x);
          break;
        }
        if (seePlayer) {
          this.enterSuspicious(playerX);
          this.detectionLevel = Math.min(1.0, this.detectionLevel + delta / this.SUSPICIOUS_DURATION);
          if (this.detectionLevel >= 1.0) {
            this.enterAlert(playerX);
          }
          break;
        } else if (this.detectionLevel > 0) {
          this.detectionLevel = Math.max(0, this.detectionLevel - delta / (this.SUSPICIOUS_DURATION * 1.5));
        }
        this.doPatrol(body, delta);
        break;

      case 'suspicious':
        // Guard stands still and peers in the direction it saw movement
        body.setVelocityX(0);

        if (seeDecoy) {
          this.enterAlert(decoyPos!.x);
          break;
        }

        if (seePlayer) {
          this.detectionLevel = Math.min(1.0, this.detectionLevel + delta / this.SUSPICIOUS_DURATION);
          this.lastKnownX = playerX;
          this.facingRight = playerX > this.x;
          this.setFlipX(!this.facingRight);
          if (this.detectionLevel >= 1.0) {
            this.enterAlert(playerX);
            break;
          }
        } else {
          this.detectionLevel = Math.max(0, this.detectionLevel - delta / (this.SUSPICIOUS_DURATION * 1.5));
          if (this.detectionLevel <= 0) {
            // Player slipped away into cover/cloak — resume patrol
            this.clearTint();
            this.guardState = 'patrol';
            this.alertIcon?.setVisible(false);
          }
        }
        break;

      case 'alert':
        this.detectionLevel = 1.0;
        if (seeDecoy) {
          this.lastKnownX = decoyPos!.x;
          this.alertTimer = this.ALERT_DURATION;
        } else if (seePlayer) {
          this.lastKnownX = playerX;
          this.alertTimer = this.ALERT_DURATION;
        }

        this.alertTimer -= delta;
        this.chaseTarget(body);

        if (this.alertTimer <= 0) this.enterSearch();
        break;

      case 'search':
        if (seeDecoy) {
          this.enterAlert(decoyPos!.x);
          break;
        }
        if (seePlayer) {
          this.enterSuspicious(playerX);
          this.detectionLevel = Math.min(1.0, this.detectionLevel + delta / this.SUSPICIOUS_DURATION);
          if (this.detectionLevel >= 1.0) {
            this.enterAlert(playerX);
          }
          break;
        }
        this.searchTimer -= delta;
        this.detectionLevel = Math.max(0, this.detectionLevel - delta / this.SEARCH_DURATION);
        this.walkToward(body, this.lastKnownX, this.PATROL_SPEED);

        if (Math.abs(this.x - this.lastKnownX) < 10 || this.searchTimer <= 0) {
          this.enterReturn();
        }
        break;

      case 'return': {
        if (seeDecoy) {
          this.enterAlert(decoyPos!.x);
          break;
        }
        if (seePlayer) {
          this.enterSuspicious(playerX);
          this.detectionLevel = Math.min(1.0, this.detectionLevel + delta / this.SUSPICIOUS_DURATION);
          if (this.detectionLevel >= 1.0) {
            this.enterAlert(playerX);
          }
          break;
        }
        this.alertIcon?.setVisible(false);
        this.detectionLevel = Math.max(0, this.detectionLevel - delta / 1000);
        const mid = (this.patrolLeft + this.patrolRight) / 2;
        this.walkToward(body, mid, this.PATROL_SPEED);

        if (Math.abs(this.x - mid) < 10) {
          body.setVelocityX(0);
          this.clearTint();
          this.guardState = 'patrol';
          if (this.scene.anims.exists('guard_idle')) {
            this.anims.play('guard_idle', true);
          }
        }
        break;
      }
    }

    // ── Stuck detection ───────────────────────────────────────────────────
    if (this.guardState === 'patrol' || this.guardState === 'search' || this.guardState === 'return') {
      if (Math.abs(this.x - this.prevX) < 1) {
        this.stuckTimer += delta;
        if (this.stuckTimer > this.STUCK_THRESHOLD) {
          // Flip direction to escape ledge/wall
          this.facingRight = !this.facingRight;
          this.setFlipX(!this.facingRight);
          body.setVelocityX((this.facingRight ? 1 : -1) * this.PATROL_SPEED);
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    }
    this.prevX = this.x;

    // ── Visuals ───────────────────────────────────────────────────────────
    this.drawVisionCone();
    this.drawEyeGlow();
    this.drawDetectionMeter();
    this.nameLabel?.setPosition(this.x, this.y - 36);
    this.alertIcon?.setPosition(this.x, this.y - 28);
  }

  // ── State transitions ──────────────────────────────────────────────────

  private enterSuspicious(targetX: number): void {
    this.guardState      = 'suspicious';
    this.lastKnownX      = targetX;
    this.setTint(0xffee44);
    // Face toward detected direction
    this.facingRight = targetX > this.x;
    this.setFlipX(!this.facingRight);
    this.spawnAlertIcon('?', '#ffee44');
  }

  private enterAlert(targetX: number): void {
    const wasAlert = this.guardState === 'alert';
    this.guardState  = 'alert';
    this.detectionLevel = 1.0;
    this.alertTimer  = this.ALERT_DURATION;
    this.lastKnownX  = targetX;
    this.setTint(0xff4422);

    if (!wasAlert) {
      AudioManager.playGuardAlert();
      this.emit('guard_alert', this.guardName);
      if (this.scene.textures.exists('guard_alert')) {
        this.setTexture('guard_alert');
      }
      // Alert propagation
      if (this.ALERT_RADIUS > 0) {
        this.peers.forEach(peer => {
          if (
            peer.active &&
            peer.guardState === 'patrol' &&
            Phaser.Math.Distance.Between(this.x, this.y, peer.x, peer.y) <= this.ALERT_RADIUS
          ) {
            peer.receiveAlertFrom(targetX);
          }
        });
      }
    }
    this.spawnAlertIcon('!', '#ff2200');
    if (this.body) {
      this.chaseTarget(this.body as Phaser.Physics.Arcade.Body);
    }
  }

  /** Called by a nearby guard to propagate an alert to this guard. */
  public receiveAlertFrom(targetX: number): void {
    if (this.guardState !== 'patrol' && this.guardState !== 'suspicious') return;
    this.enterAlert(targetX);
  }

  private enterSearch(): void {
    this.guardState  = 'search';
    this.searchTimer = this.SEARCH_DURATION;
    this.setTint(0xffaa44);
    if (this.scene.anims.exists('guard_idle')) {
      this.anims.play('guard_idle', true);
    }
    this.spawnAlertIcon('?', '#ffaa00');
  }

  private enterReturn(): void {
    this.guardState = 'return';
    this.clearTint();
    this.alertIcon?.setVisible(false);
    if (this.scene.anims.exists('guard_walk')) {
      this.anims.play('guard_walk', true);
    }
  }

  // ── Movement helpers ───────────────────────────────────────────────────

  private doPatrol(body: Phaser.Physics.Arcade.Body, delta: number): void {
    if (this.scene.anims.exists('guard_walk') && this.anims.currentAnim?.key !== 'guard_walk') {
      this.anims.play('guard_walk', true);
    }

    // Patrol pause / look-back
    this.patrolPauseCooldown -= delta;
    if (this.patrolPauseTimer > 0) {
      // Guard is paused: stop, play idle, look back
      this.patrolPauseTimer -= delta;
      body.setVelocityX(0);
      if (this.scene.anims.exists('guard_idle') && this.anims.currentAnim?.key !== 'guard_idle') {
        this.anims.play('guard_idle', true);
      }
      // Mid-pause flip to look back then restore
      if (this.patrolPauseTimer < this.PATROL_PAUSE_DURATION / 2 && this.patrolLookDir !== 0) {
        this.setFlipX(this.patrolLookDir < 0);
        this.patrolLookDir = 0; // only flip once
      }
      return;
    }

    if (this.patrolPauseCooldown <= 0) {
      // Start a pause
      this.patrolPauseTimer   = this.PATROL_PAUSE_DURATION;
      this.patrolPauseCooldown = this.PATROL_PAUSE_INTERVAL + (Math.random() - 0.5) * 1000;
      this.patrolLookDir       = this.facingRight ? -1 : 1; // look opposite to current dir
      return;
    }

    // Normal patrol walk
    if (this.facingRight) {
      body.setVelocityX(this.PATROL_SPEED);
      if (this.x >= this.patrolRight) { this.facingRight = false; this.setFlipX(true); }
    } else {
      body.setVelocityX(-this.PATROL_SPEED);
      if (this.x <= this.patrolLeft)  { this.facingRight = true;  this.setFlipX(false); }
    }
    this.alertIcon?.setVisible(false);
  }

  private chaseTarget(body: Phaser.Physics.Arcade.Body): void {
    const dir = this.lastKnownX > this.x ? 1 : -1;
    body.setVelocityX(this.ALERT_SPEED * dir);
    this.facingRight = dir > 0;
    this.setFlipX(!this.facingRight);
    this.alertIcon?.setText('!').setColor('#ff2200').setVisible(true);
  }

  private walkToward(body: Phaser.Physics.Arcade.Body, targetX: number, speed: number): void {
    const dir = targetX > this.x ? 1 : -1;
    body.setVelocityX(speed * dir);
    this.facingRight = dir > 0;
    this.setFlipX(!this.facingRight);
    if (this.scene.anims.exists('guard_walk') && this.anims.currentAnim?.key !== 'guard_walk') {
      this.anims.play('guard_walk', true);
    }
  }

  // ── Vision cone & Raycasting ───────────────────────────────────────────

  /** True if world position (px, py) is within this guard's full vision cone. */
  public canSeePosition(px: number, py: number): boolean {
    return this.canSeePositionRange(px, py, this.VISION_RANGE);
  }

  private canSeePositionRange(px: number, py: number, range: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    if (dx * dx + dy * dy > range * range) return false;

    const angleToTarget = Math.atan2(dy, dx);
    const facingAngle   = this.facingRight ? 0 : Math.PI;

    let diff = angleToTarget - facingAngle;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    if (Math.abs(diff) >= Phaser.Math.DegToRad(this.VISION_HALF_DEG)) return false;

    // Check line-of-sight obstruction against solid obstacles
    if (this.obstacles.length > 0) {
      for (const obs of this.obstacles) {
        if (this.segmentIntersectsBox(this.x, this.y, px, py, obs.x, obs.y, obs.width, obs.height)) {
          return false; // Solid wall blocks sight
        }
      }
    }

    return true;
  }

  /**
   * Fast slab test for ray-segment [x1,y1]->[x2,y2] vs AABB [rx, ry, rw, rh].
   * Returns distance fraction t in [0, 1] if intersecting, or null.
   */
  private segmentIntersectsBox(
    x1: number, y1: number, x2: number, y2: number,
    rx: number, ry: number, rw: number, rh: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tmin = 0;
    let tmax = 1;

    // X slab
    if (Math.abs(dx) < 1e-6) {
      if (x1 < rx || x1 > rx + rw) return false;
    } else {
      const ood = 1 / dx;
      let t1 = (rx - x1) * ood;
      let t2 = (rx + rw - x1) * ood;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    // Y slab
    if (Math.abs(dy) < 1e-6) {
      if (y1 < ry || y1 > ry + rh) return false;
    } else {
      const ood = 1 / dy;
      let t1 = (ry - y1) * ood;
      let t2 = (ry + rh - y1) * ood;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    return tmin >= 0 && tmin <= 1;
  }

  private getRayDistanceFraction(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number): number | null {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tmin = 0;
    let tmax = 1;

    if (Math.abs(dx) < 1e-6) {
      if (x1 < rx || x1 > rx + rw) return null;
    } else {
      const ood = 1 / dx;
      let t1 = (rx - x1) * ood;
      let t2 = (rx + rw - x1) * ood;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    if (Math.abs(dy) < 1e-6) {
      if (y1 < ry || y1 > ry + rh) return null;
    } else {
      const ood = 1 / dy;
      let t1 = (ry - y1) * ood;
      let t2 = (ry + rh - y1) * ood;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    return tmin >= 0 && tmin <= 1 ? tmin : null;
  }

  private drawVisionCone(): void {
    this.visionCone.clear();

    let fillColor: number, fillAlpha: number, lineColor: number;
    switch (this.guardState) {
      case 'alert':
        fillColor = 0xff3300; fillAlpha = 0.38; lineColor = 0xff5500; break;
      case 'suspicious':
        fillColor = 0xffee00; fillAlpha = 0.28; lineColor = 0xffee66; break;
      case 'search':
        fillColor = 0xffaa00; fillAlpha = 0.28; lineColor = 0xffcc00; break;
      default:
        fillColor = 0xffee44; fillAlpha = 0.14; lineColor = 0xffee88; break;
    }

    this.visionCone.fillStyle(fillColor, fillAlpha);
    this.visionCone.lineStyle(1, lineColor, 0.55);

    const facing  = this.facingRight ? 0 : Math.PI;
    const halfRad = Phaser.Math.DegToRad(this.VISION_HALF_DEG);

    // If obstacles are configured, perform raycast polygon rendering clipped to walls and floor
    if (this.obstacles.length > 0) {
      const numRays = 16;
      const step = (halfRad * 2) / numRays;
      const startAngle = facing - halfRad;

      this.visionCone.beginPath();
      this.visionCone.moveTo(this.x, this.y);

      for (let i = 0; i <= numRays; i++) {
        const ang = startAngle + i * step;
        const targetX = this.x + Math.cos(ang) * this.VISION_RANGE;
        const targetY = this.y + Math.sin(ang) * this.VISION_RANGE;

        let closestT = 1.0;

        // Clip ray against solid walls
        for (const obs of this.obstacles) {
          const t = this.getRayDistanceFraction(this.x, this.y, targetX, targetY, obs.x, obs.y, obs.width, obs.height);
          if (t !== null && t < closestT) {
            closestT = t;
          }
        }

        // Clip ray if it pierces the ground floor directly beneath the guard (prevent ground floor clip)
        if (targetY > this.y + 14 && Math.sin(ang) > 0) {
          const floorDistY = (this.y + 14) - this.y;
          const floorT = floorDistY / (Math.sin(ang) * this.VISION_RANGE);
          if (floorT >= 0 && floorT < closestT) {
            closestT = floorT;
          }
        }

        const hitX = this.x + Math.cos(ang) * (this.VISION_RANGE * closestT);
        const hitY = this.y + Math.sin(ang) * (this.VISION_RANGE * closestT);
        this.visionCone.lineTo(hitX, hitY);
      }

      this.visionCone.closePath();
      this.visionCone.fillPath();
      this.visionCone.strokePath();
    } else {
      // Standard smooth arc when no obstacles are configured
      this.visionCone.beginPath();
      this.visionCone.moveTo(this.x, this.y);
      this.visionCone.arc(this.x, this.y, this.VISION_RANGE, facing - halfRad, facing + halfRad, false);
      this.visionCone.closePath();
      this.visionCone.fillPath();
      this.visionCone.strokePath();
    }
  }

  private drawEyeGlow(): void {
    this.eyeGfx.clear();
    const col = this.guardState === 'patrol'     ? 0xffee44 :
                this.guardState === 'suspicious' ? 0xffee00 :
                this.guardState === 'alert'      ? 0xff2200 : 0xffaa00;
    const ox = this.facingRight ? 5 : -5;
    this.eyeGfx.fillStyle(col, 0.9);
    this.eyeGfx.fillCircle(this.x + ox, this.y - 8, 3);
  }

  private drawDetectionMeter(): void {
    this.detectionGfx.clear();
    if (this.detectionLevel <= 0 || this.guardState === 'alert') return;

    const w = 24;
    const h = 3;
    const bx = this.x - w / 2;
    const by = this.y - 23;

    // Dark background pill
    this.detectionGfx.fillStyle(0x060810, 0.88);
    this.detectionGfx.fillRoundedRect(bx, by, w, h, 1);
    this.detectionGfx.lineStyle(1, 0x000000, 0.9);
    this.detectionGfx.strokeRoundedRect(bx, by, w, h, 1);

    // Color gradient from yellow to orange/red
    const col = this.detectionLevel < 0.6 ? 0xffee00 : 0xff3300;
    this.detectionGfx.fillStyle(col, 1);
    this.detectionGfx.fillRoundedRect(bx, by, w * Math.min(1.0, this.detectionLevel), h, 1);
  }

  private spawnAlertIcon(text = '!', color = '#ff8800'): void {
    if (!this.alertIcon) {
      this.alertIcon = this.scene.add.text(this.x, this.y - 28, text, {
        fontFamily: '"Pixelify Sans", monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(25);
    } else {
      this.alertIcon.setText(text).setColor(color).setVisible(true);
    }
  }

  public preDestroy(): void {
    this.visionCone.destroy();
    this.eyeGfx.destroy();
    this.detectionGfx.destroy();
    this.alertIcon?.destroy();
    this.nameLabel?.destroy();
  }

  public override destroy(fromScene?: boolean): void {
    this.preDestroy();
    super.destroy(fromScene);
  }
}

