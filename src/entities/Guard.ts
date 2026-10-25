import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export type GuardState = 'patrol' | 'alert' | 'search' | 'return';

/**
 * Guard — Medieval palace sentinel with visible vision cone.
 *
 * State Machine
 * ─────────────
 *  PATROL → walks patrolLeft ↔ patrolRight; cone checks for targets every frame
 *  ALERT  → detected player/decoy; chases at alertSpeed; resets timer on re-sight
 *  SEARCH → lost sight; moves to lastKnownX, holds briefly
 *  RETURN → walks back toward patrol midpoint, then resumes PATROL
 *
 * Vision Cone
 * ───────────
 *  • 90° arc (±45°) centred on guard facing direction
 *  • Yellow (18 % opacity) while patrolling
 *  • Orange (38 % opacity) while alerted
 *  • Drawn each frame so players can see the detection zone clearly
 *  • Guard emits 'guard_alert' event when it first spots something
 *
 * Contact
 * ───────
 *  Guard is lethal (isLethal=true) only while in ALERT state.
 *  Use scene overlap detection against the guard's physics body.
 */
export class Guard extends Phaser.Physics.Arcade.Sprite {
  public guardState: GuardState = 'patrol';
  public readonly guardName: string;

  // Vision parameters
  private readonly VISION_RANGE: number;
  private readonly VISION_HALF_DEG: number;

  // Speeds
  private readonly PATROL_SPEED = 36;
  private readonly ALERT_SPEED  = 78;

  // Patrol bounds
  private readonly patrolLeft: number;
  private readonly patrolRight: number;
  private facingRight: boolean;

  // State timers (ms)
  private alertTimer  = 0;
  private searchTimer = 0;
  private readonly ALERT_DURATION  = 3500;
  private readonly SEARCH_DURATION = 2000;
  private lastKnownX = 0;

  // Visuals
  private readonly visionCone: Phaser.GameObjects.Graphics;
  private readonly eyeGfx:     Phaser.GameObjects.Graphics;
  private alertIcon?: Phaser.GameObjects.Text;
  private nameLabel?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolLeft: number,
    patrolRight: number,
    opts: {
      name?: string;
      visionRange?: number;
      visionAngle?: number;
      facingRight?: boolean;
    } = {}
  ) {
    super(scene, x, y, 'guard_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.patrolLeft       = patrolLeft;
    this.patrolRight      = patrolRight;
    this.guardName        = opts.name        ?? 'GUARD';
    this.VISION_RANGE     = opts.visionRange ?? 130;
    this.VISION_HALF_DEG  = opts.visionAngle  ?? 45;
    this.facingRight      = opts.facingRight  ?? true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    this.setSize(14, 28);
    this.setOffset(2, 4);
    this.setDepth(9);

    // Vision cone rendered BELOW guard and entities
    this.visionCone = scene.add.graphics().setDepth(6);
    this.eyeGfx     = scene.add.graphics().setDepth(20);

    // Guard name label above sprite
    this.nameLabel = scene.add.text(x, y - 36, this.guardName, {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#cccc88',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** True while in ALERT — scene checks this before dealing contact damage. */
  public get isLethal(): boolean {
    return this.guardState === 'alert';
  }

  /**
   * Main update — call from scene.update() every frame.
   *
   * @param delta        ms since last frame
   * @param playerX      player world X
   * @param playerY      player world Y
   * @param decoyPos     optional decoy position (checked BEFORE player)
   * @param playerCloaked if true, player is invisible and cannot be detected
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

    // Determine what (if anything) this guard can see
    const seeDecoy  = decoyPos !== null && this.canSeePosition(decoyPos.x, decoyPos.y);
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    const touchPlayer  = !playerCloaked && distToPlayer < 24;
    const seePlayer    = !playerCloaked && (this.canSeePosition(playerX, playerY) || touchPlayer);

    // ── State machine ────────────────────────────────────────────────
    switch (this.guardState) {

      // ─ PATROL ───────────────────────────────────────────────────────
      case 'patrol':
        if (seeDecoy)        this.enterAlert(decoyPos!.x);
        else if (seePlayer)  this.enterAlert(playerX);
        else                 this.doPatrol(body);
        break;

      // ─ ALERT ────────────────────────────────────────────────────────
      case 'alert':
        // Refresh timer while target remains visible
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

      // ─ SEARCH ───────────────────────────────────────────────────────
      case 'search':
        this.searchTimer -= delta;
        this.walkToward(body, this.lastKnownX, this.PATROL_SPEED);

        if (Math.abs(this.x - this.lastKnownX) < 10 || this.searchTimer <= 0) {
          this.enterReturn();
        }
        break;

      // ─ RETURN ───────────────────────────────────────────────────────
      case 'return':
        this.alertIcon?.setVisible(false);
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

    // ── Visuals ──────────────────────────────────────────────────────
    this.drawVisionCone();
    this.drawEyeGlow();
    this.nameLabel?.setPosition(this.x, this.y - 36);
    this.alertIcon?.setPosition(this.x, this.y - 28);
  }

  // ── State transitions ──────────────────────────────────────────────────

  private enterAlert(targetX: number): void {
    const wasAlert = this.guardState === 'alert';
    this.guardState  = 'alert';
    this.alertTimer  = this.ALERT_DURATION;
    this.lastKnownX  = targetX;
    this.setTint(0xff6644);

    if (!wasAlert) {
      AudioManager.playGuardAlert();
      this.emit('guard_alert', this.guardName);
      if (this.scene.textures.exists('guard_alert')) {
        this.setTexture('guard_alert');
      }
    }
    this.spawnAlertIcon('!!', '#ff4400');
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

  private doPatrol(body: Phaser.Physics.Arcade.Body): void {
    if (this.scene.anims.exists('guard_walk') && this.anims.currentAnim?.key !== 'guard_walk') {
      this.anims.play('guard_walk', true);
    }
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
    this.alertIcon?.setText('!!').setVisible(true);
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

  // ── Vision cone ────────────────────────────────────────────────────────

  /** True if world position (px, py) is within this guard's vision cone. */
  public canSeePosition(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    if (dx * dx + dy * dy > this.VISION_RANGE * this.VISION_RANGE) return false;

    const angleToTarget = Math.atan2(dy, dx);
    const facingAngle   = this.facingRight ? 0 : Math.PI;

    let diff = angleToTarget - facingAngle;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    return Math.abs(diff) < Phaser.Math.DegToRad(this.VISION_HALF_DEG);
  }

  private drawVisionCone(): void {
    this.visionCone.clear();

    let fillColor: number, fillAlpha: number, lineColor: number;
    switch (this.guardState) {
      case 'alert':
        fillColor = 0xff4400; fillAlpha = 0.38; lineColor = 0xff6600; break;
      case 'search':
        fillColor = 0xffaa00; fillAlpha = 0.28; lineColor = 0xffcc00; break;
      default:
        fillColor = 0xffee44; fillAlpha = 0.14; lineColor = 0xffee88; break;
    }

    this.visionCone.fillStyle(fillColor, fillAlpha);
    this.visionCone.lineStyle(1, lineColor, 0.55);

    const facing  = this.facingRight ? 0 : Math.PI;
    const halfRad = Phaser.Math.DegToRad(this.VISION_HALF_DEG);

    this.visionCone.beginPath();
    this.visionCone.moveTo(this.x, this.y);
    this.visionCone.arc(this.x, this.y, this.VISION_RANGE, facing - halfRad, facing + halfRad, false);
    this.visionCone.closePath();
    this.visionCone.fillPath();
    this.visionCone.strokePath();
  }

  private drawEyeGlow(): void {
    this.eyeGfx.clear();
    const col = this.guardState === 'patrol' ? 0xffee44 :
                this.guardState === 'alert'  ? 0xff4400 : 0xffaa00;
    const ox = this.facingRight ? 5 : -5;
    this.eyeGfx.fillStyle(col, 0.9);
    this.eyeGfx.fillCircle(this.x + ox, this.y - 8, 3);
  }

  private spawnAlertIcon(text = '!!', color = '#ff8800'): void {
    if (!this.alertIcon) {
      this.alertIcon = this.scene.add.text(this.x, this.y - 28, text, {
        fontFamily: '"Pixelify Sans", monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(25);
    } else {
      this.alertIcon.setText(text).setColor(color).setVisible(true);
    }
  }

  public preDestroy(): void {
    this.visionCone.destroy();
    this.eyeGfx.destroy();
    this.alertIcon?.destroy();
    this.nameLabel?.destroy();
  }

  public override destroy(fromScene?: boolean): void {
    this.preDestroy();
    super.destroy(fromScene);
  }
}
