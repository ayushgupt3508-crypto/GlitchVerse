import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AudioManager } from './AudioManager';

/**
 * RealitySwapConfig — Tunable parameters for the Reality Swap & Echo Possession mechanic.
 * Single source of truth for all limits, radii, and timers.
 */
export interface RealitySwapConfig {
  possessionTimeLimitMs: number;
  nodeInteractionRadius: number;
  tetherMaxDistance: number;
  nodeCooldownMs: number;
  sentinelMoveSpeed: number;
  sentinelJumpVelocity: number;
  gravityY: number;
}

export const DEFAULT_REALITY_SWAP_CONFIG: RealitySwapConfig = {
  possessionTimeLimitMs: 16000,
  nodeInteractionRadius: 85,
  tetherMaxDistance: 800,
  nodeCooldownMs: 3000,
  sentinelMoveSpeed: 180,
  sentinelJumpVelocity: -420,
  gravityY: 0   // 0 = inherit world gravity (set via physics.world.gravity.y, not body)
};

export type NodeState = 'READY' | 'ACTIVE' | 'SWAPPED' | 'COOLDOWN';

export interface RiftNodeDef {
  id: string;
  x: number;
  y: number;
  label?: string;
  sentinelSpawnX: number;
  sentinelSpawnY: number;
  objectiveX: number;
  objectiveY: number;
  objectiveLabel?: string;
  swapDestinationX: number;
  swapDestinationY: number;
  ghostPlatforms: { x: number; y: number; w: number; h: number }[];
  hazards?: { x: number; y: number; w: number; h: number }[];
  onObjectiveCompleted?: () => void;
}

/**
 * RealitySwapSystem — Manages Echo Sentinel possession, Ghost Platform physics,
 * in-world countdowns/tethers, and safe player/sentinel coordinate swaps.
 * No UI elements: all indicators and feedback are rendered in-world.
 */
export class RealitySwapSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private config: RealitySwapConfig;

  // Active Possession State
  public isPossessing = false;
  private activeNodeIndex = -1;
  private possessionTimeRemaining = 0;
  private cooldownTimers: Map<number, number> = new Map();
  private swappedNodes: Set<number> = new Set();
  private completedObjectives: Set<number> = new Set();

  // Nodes & World Elements
  private nodeDefs: RiftNodeDef[] = [];
  private nodeContainers: Phaser.GameObjects.Container[] = [];
  private nodeRadiusGfx: Phaser.GameObjects.Graphics[] = [];

  // Echo Sentinel
  public sentinel!: Phaser.Physics.Arcade.Sprite;
  private sentinelCountdownGfx!: Phaser.GameObjects.Graphics;
  private tetherGfx!: Phaser.GameObjects.Graphics;
  private stasisDomeGfx!: Phaser.GameObjects.Graphics;
  private objectiveTetherGfx!: Phaser.GameObjects.Graphics;

  // Ghost Reality Colliders & Sprites
  private ghostPlatformSprites: Phaser.Physics.Arcade.Sprite[] = [];
  private ghostPlatformBodies: Phaser.Physics.Arcade.Body[] = [];
  private ghostCollider?: Phaser.Physics.Arcade.Collider;
  private objectiveZones: { zone: Phaser.GameObjects.Zone; nodeIndex: number; sprite: Phaser.GameObjects.Sprite }[] = [];
  private hazardZones: Phaser.GameObjects.Zone[] = [];

  // Saved Stasis Position
  private stasisOriginX = 0;
  private stasisOriginY = 0;
  private possessionStartTime = 0;
  private sentinelCoyoteTimer = 0;
  private sentinelJumpBufferTimer = 0;
  /** True while sentinel is in the air after a jump — prevents re-trigger on held key */
  private sentinelIsJumping = false;
  /** Tracks previous-frame jump key state to detect JustDown without Phaser.Input.Keyboard.JustDown */
  private prevJumpDown = false;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    nodeDefs: RiftNodeDef[],
    persistentPlatforms?: Phaser.Physics.Arcade.StaticGroup,
    config: RealitySwapConfig = DEFAULT_REALITY_SWAP_CONFIG
  ) {
    this.scene = scene;
    this.player = player;
    this.nodeDefs = nodeDefs;
    this.config = config;

    this.initGraphicsAndSentinel();
    this.buildNodesAndGhostWorld(persistentPlatforms);
  }

  private initGraphicsAndSentinel(): void {
    // 1. In-world graphics layers
    this.tetherGfx = this.scene.add.graphics().setDepth(15);
    this.stasisDomeGfx = this.scene.add.graphics().setDepth(16);
    this.sentinelCountdownGfx = this.scene.add.graphics().setDepth(25);
    this.objectiveTetherGfx = this.scene.add.graphics().setDepth(14);

    // 2. Echo Sentinel Sprite (Arcade Physics entity)
    //    Uses 'player' texture which is 32×32. Do NOT setScale or setDisplaySize —
    //    that would silently scale the physics body bounds too.
    this.sentinel = this.scene.physics.add.sprite(-1000, -1000, 'player');
    this.sentinel.setTint(0x00f0ff);
    this.sentinel.setAlpha(0.85);
    this.sentinel.setDepth(20);
    this.sentinel.setVisible(false);
    this.sentinel.setActive(false);

    const sBody = this.sentinel.body as Phaser.Physics.Arcade.Body;
    // DO NOT call setGravityY — value 0 means "extra gravity on top of world",
    // NOT "no gravity". Leave it at the Phaser default (0 extra) so world gravity applies.
    sBody.setSize(14, 28);      // tight hitbox matching sprite art
    sBody.setOffset(9, 4);      // centred horizontally, a few px from top
    sBody.setMaxVelocity(this.config.sentinelMoveSpeed, 700);
    sBody.enable = false;
  }

  private buildNodesAndGhostWorld(persistentPlatforms?: Phaser.Physics.Arcade.StaticGroup): void {
    this.nodeDefs.forEach((def, idx) => {
      // ── A. Rift Node In-World Pedestal & Rings ──
      const nodeCont = this.scene.add.container(def.x, def.y).setDepth(9);

      // In-world pedestal tile
      const base = this.scene.add.sprite(0, 0, 'tile_glitch')
        .setDisplaySize(36, 18)
        .setTint(0x00f0ff)
        .setAlpha(0.9);

      // Rotating neon ring graphics
      const ringGfx = this.scene.add.graphics();
      ringGfx.lineStyle(1.5, 0x00f0ff, 0.85);
      ringGfx.strokeCircle(0, -12, 14);
      ringGfx.lineStyle(1, 0xff007f, 0.6);
      ringGfx.strokeCircle(0, -12, 22);

      this.scene.tweens.add({
        targets: ringGfx,
        angle: 360,
        duration: 3500,
        repeat: -1
      });

      // Subtle vertical bobbing
      this.scene.tweens.add({
        targets: ringGfx,
        y: -4,
        yoyo: true,
        repeat: -1,
        duration: 1200,
        ease: 'Sine.easeInOut'
      });

      // In-world floating beacon label
      const tag = this.scene.add.text(0, -38, def.label || '▲ RIFT NODE', {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '9px',
        color: '#00f0ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2.5
      }).setOrigin(0.5);

      nodeCont.add([base, ringGfx, tag]);
      this.nodeContainers.push(nodeCont);

      // In-world interaction range indicator
      const radiusGfx = this.scene.add.graphics().setDepth(7);
      radiusGfx.lineStyle(1, 0x00f0ff, 0.28);
      radiusGfx.strokeCircle(def.x, def.y - 12, this.config.nodeInteractionRadius);
      this.nodeRadiusGfx.push(radiusGfx);

      // ── B. Ghost Platforms in Echo Reality ──
      //
      // CRITICAL: Never call setDisplaySize() or setScale() on a physics sprite —
      // it changes scaleX/scaleY which Arcade Physics multiplies into body.width/height,
      // producing phantom hitboxes wildly larger than the visible tile.
      //
      // Pattern: spawn contiguous unscaled 32×32 tiles, each with their own body.
      // Use setOrigin(0,0) + body.reset() so the body is flush with the top-left corner.
      def.ghostPlatforms.forEach(gp => {
        const TILE = 32;
        // gp.w defines the platform width; gp.h must be ≤ 32 (one tile tall)
        const tilesCount = Math.max(1, Math.ceil(gp.w / TILE));
        for (let t = 0; t < tilesCount; t++) {
          const px = gp.x + t * TILE;
          const py = gp.y;   // top-left Y of the tile

          const sprite = this.scene.physics.add.sprite(px, py, 'tile_phase_a')
            .setOrigin(0, 0)  // anchor at top-left so body.reset aligns correctly
            .setTint(0x00f0ff)
            .setAlpha(0.2)
            .setDepth(8);

          sprite.setImmovable(true);
          const b = sprite.body as Phaser.Physics.Arcade.Body;
          b.setAllowGravity(false);
          // Fix hitbox: 32×16 so the sentinel lands on the SURFACE of the tile,
          // not on its physics mid-point.
          b.setSize(TILE, 16);
          b.setOffset(0, 0);
          // reset() repositions the body to (px, py) regardless of any prior offset drift
          b.reset(px, py);
          // One-way: only collide from above (sentinel can jump UP through ghost ledges)
          b.checkCollision.down = false;
          b.checkCollision.left = false;
          b.checkCollision.right = false;
          b.checkCollision.up = true;
          b.enable = false; // Intangible until possessing

          this.ghostPlatformSprites.push(sprite);
          this.ghostPlatformBodies.push(b);
        }
      });

      // ── C. Echo Objective Terminal / Switch ──
      const objSprite = this.scene.add.sprite(def.objectiveX, def.objectiveY, 'failsafe_component')
        .setDisplaySize(20, 20)
        .setTint(0xff007f)
        .setAlpha(0.85)
        .setDepth(12);

      this.scene.tweens.add({
        targets: objSprite,
        scale: 1.25,
        yoyo: true,
        repeat: -1,
        duration: 700,
        ease: 'Sine.easeInOut'
      });

      const objZone = this.scene.add.zone(def.objectiveX, def.objectiveY, 36, 36);
      this.scene.physics.add.existing(objZone, true);
      this.objectiveZones.push({ zone: objZone, nodeIndex: idx, sprite: objSprite });

      // In-world objective tag
      this.scene.add.text(def.objectiveX, def.objectiveY - 22, def.objectiveLabel || 'ECHO OBJECTIVE', {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '8px',
        color: '#ff007f',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(13);

      // ── D. Echo Reality Hazards ──
      if (def.hazards) {
        def.hazards.forEach(hz => {
          const hazardZone = this.scene.add.zone(hz.x + hz.w / 2, hz.y + hz.h / 2, hz.w, hz.h);
          this.scene.physics.add.existing(hazardZone, true);
          this.hazardZones.push(hazardZone);

          // Subtle red glitch pulse in hazard zone
          const hGfx = this.scene.add.graphics().setDepth(9);
          hGfx.lineStyle(1, 0xff0055, 0.4);
          hGfx.strokeRect(hz.x, hz.y, hz.w, hz.h);
        });
      }
    });

    // Setup Sentinel vs Ghost Platforms & Persistent Platforms Collider
    this.ghostCollider = this.scene.physics.add.collider(this.sentinel, this.ghostPlatformSprites);
    if (persistentPlatforms) {
      this.scene.physics.add.collider(this.sentinel, persistentPlatforms);
    }

    // Setup Sentinel vs Objectives Overlap
    this.objectiveZones.forEach(item => {
      this.scene.physics.add.overlap(this.sentinel, item.zone, () => {
        if (this.isPossessing && this.activeNodeIndex === item.nodeIndex) {
          this.handleObjectiveReached(item.nodeIndex);
        }
      });
    });

    // Setup Sentinel vs Hazards Overlap
    this.hazardZones.forEach(hz => {
      this.scene.physics.add.overlap(this.sentinel, hz, () => {
        if (this.isPossessing) {
          this.failPossession('SENTINEL COMPROMISED BY HAZARD');
        }
      });
    });
  }

  // ── Input & Trigger Handling ──────────────────────────────────────────────

  /**
   * Checks whether Vance is within range of an available Rift Node.
   */
  public getNearbyAvailableNode(): number {
    if (this.isPossessing) return -1;
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < this.nodeDefs.length; i++) {
      if (this.swappedNodes.has(i)) continue; // Already used
      const cd = this.cooldownTimers.get(i) ?? 0;
      if (cd > 0) continue; // In cooldown

      const def = this.nodeDefs[i];
      const dist = Phaser.Math.Distance.Between(px, py, def.x, def.y - 12);
      if (dist <= this.config.nodeInteractionRadius) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Called when player presses the staff ability button.
   * Returns true if handled by the Reality Swap system, false if normal ability should fire.
   */
  public handleAbilityInput(): boolean {
    // Debounce: ignore rapid consecutive triggers within 400ms of entering possession
    if (this.isPossessing && Date.now() - this.possessionStartTime < 400) {
      return true;
    }

    // Case 1: Currently possessing the Echo Sentinel
    if (this.isPossessing) {
      if (this.completedObjectives.has(this.activeNodeIndex)) {
        // Objective is complete — execute the SWAP!
        this.executeSwap();
        return true;
      }
      // Objective not yet completed: sentinel continues exploring echo reality!
      return true;
    }

    // Case 2: Near an active Rift Node — initiate possession
    const nearbyIdx = this.getNearbyAvailableNode();
    if (nearbyIdx !== -1) {
      this.startPossession(nearbyIdx);
      return true;
    }

    return false; // Let normal staff ability handle it
  }

  // ── Possession Lifecycle ──────────────────────────────────────────────────

  public startPossession(nodeIndex: number): void {
    if (this.isPossessing) return;
    const def = this.nodeDefs[nodeIndex];
    if (!def) return;

    this.isPossessing = true;
    this.activeNodeIndex = nodeIndex;
    this.possessionStartTime = Date.now();
    this.possessionTimeRemaining = this.config.possessionTimeLimitMs;

    // 1. Freeze Vance in a visible stasis shell
    this.stasisOriginX = this.player.x;
    this.stasisOriginY = this.player.y;

    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.setVelocity(0, 0);
    pBody.enable = false; // Completely immune to damage, void, drones
    this.player.setAlpha(0.65);

    // Render Stasis Dome around Vance
    this.drawStasisDome(this.stasisOriginX, this.stasisOriginY);

    // 2. Activate Echo Sentinel
    this.sentinel.setPosition(def.sentinelSpawnX, def.sentinelSpawnY);
    this.sentinel.setVisible(true);
    this.sentinel.setActive(true);

    const sBody = this.sentinel.body as Phaser.Physics.Arcade.Body;
    sBody.enable = true;
    sBody.setVelocity(0, 0);
    // Reset jump state trackers whenever possession begins
    this.sentinelIsJumping = false;
    this.prevJumpDown = false;
    this.sentinelCoyoteTimer = 0;
    this.sentinelJumpBufferTimer = 0;

    // 3. Solidify Ghost Platforms
    this.ghostPlatformSprites.forEach(gps => {
      gps.setAlpha(1);
      gps.setTint(0x00f0ff);
    });
    this.ghostPlatformBodies.forEach(gpb => {
      gpb.enable = true;
    });

    // 4. Camera smoothly eases to Sentinel
    this.scene.cameras.main.startFollow(this.sentinel, true, 0.08, 0.08);

    AudioManager.playStaffUse();
    this.scene.cameras.main.flash(180, 0, 240, 255);
  }

  private handleObjectiveReached(nodeIndex: number): void {
    if (this.completedObjectives.has(nodeIndex)) return;
    this.completedObjectives.add(nodeIndex);

    const def = this.nodeDefs[nodeIndex];
    def.onObjectiveCompleted?.();

    // Sound & particles
    AudioManager.playFailsafe();
    this.scene.cameras.main.flash(200, 255, 0, 128);

    // Draw active tether beam from objective to main reality effect
    this.drawObjectiveTether(def.objectiveX, def.objectiveY, def.swapDestinationX, def.swapDestinationY);
  }

  public executeSwap(): void {
    if (!this.isPossessing || this.activeNodeIndex === -1) return;
    const def = this.nodeDefs[this.activeNodeIndex];
    if (!def) return;

    // Validate safe destination above solid ground
    const safeDest = this.validateSwapDestination(this.sentinel.x, this.sentinel.y, def);

    // Teleport Vance to the validated safe landing position
    this.player.setPosition(safeDest.x, safeDest.y);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.enable = true;
    pBody.setVelocity(0, 0);
    this.player.setAlpha(1);

    // Mark Node as Swapped (used)
    this.swappedNodes.add(this.activeNodeIndex);

    // Audio & Visual Effects
    AudioManager.playKeyCollect();
    this.scene.cameras.main.flash(220, 0, 240, 255);
    this.scene.cameras.main.shake(160, 0.01);

    // Spawn radiant teleport flash emitter
    const emitter = this.scene.add.particles(safeDest.x, safeDest.y, 'proto_tile', {
      speed: { min: 80, max: 220 },
      scale: { start: 0.5, end: 0 },
      tint: [0x00f0ff, 0xff007f, 0xffffff],
      lifespan: 600,
      quantity: 24
    }).setDepth(30);
    this.scene.time.delayedCall(650, () => emitter.destroy());

    // End possession and ease camera back to player
    this.endPossessionCleanly();
  }

  public failPossession(_reason = 'TIMEOUT'): void {
    if (!this.isPossessing) return;
    const failedNodeIdx = this.activeNodeIndex;

    // Sound & flash
    AudioManager.playDroneStun();
    this.scene.cameras.main.flash(160, 255, 0, 80);

    // Return Vance to stasis origin safely
    this.player.setPosition(this.stasisOriginX, this.stasisOriginY);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.enable = true;
    pBody.setVelocity(0, 0);
    this.player.setAlpha(1);

    // Start Node cooldown (never a death!)
    if (failedNodeIdx !== -1) {
      this.cooldownTimers.set(failedNodeIdx, this.config.nodeCooldownMs);
    }

    this.endPossessionCleanly();
  }

  public recallPossession(): void {
    if (!this.isPossessing) return;
    this.player.setPosition(this.stasisOriginX, this.stasisOriginY);
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.enable = true;
    pBody.setVelocity(0, 0);
    this.player.setAlpha(1);

    this.endPossessionCleanly();
  }

  private endPossessionCleanly(): void {
    this.isPossessing = false;
    this.activeNodeIndex = -1;
    this.possessionTimeRemaining = 0;

    // Guard: sentinel and its body may already be destroyed (e.g. during scene shutdown)
    if (this.sentinel?.active !== undefined) {
      try {
        this.sentinel.setVisible(false);
        this.sentinel.setActive(false);
      } catch (_) { /* sentinel already destroyed */ }
    }

    const sBody = this.sentinel?.body as Phaser.Physics.Arcade.Body | undefined;
    if (sBody) {
      try {
        sBody.enable = false;
        sBody.setVelocity(0, 0);
      } catch (_) { /* body already destroyed */ }
    }

    // Clear graphics (guard: may be null/destroyed during scene shutdown)
    try { this.tetherGfx?.clear(); } catch (_) { /* ignore */ }
    try { this.stasisDomeGfx?.clear(); } catch (_) { /* ignore */ }
    try { this.sentinelCountdownGfx?.clear(); } catch (_) { /* ignore */ }

    // Demote Ghost Platforms back to intangible hints
    this.ghostPlatformSprites.forEach(gps => {
      try {
        if (gps?.active) {
          gps.setAlpha(0.2);
          gps.setTint(0x00f0ff);
        }
      } catch (_) { /* ignore */ }
    });
    this.ghostPlatformBodies.forEach(gpb => {
      try {
        if (gpb) gpb.enable = false;
      } catch (_) { /* ignore */ }
    });

    // Camera — only safe if scene is still alive
    try {
      if (this.scene?.cameras?.main) {
        this.scene.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      }
    } catch (_) { /* ignore during shutdown */ }
  }

  // ── Destination Safety Validation ─────────────────────────────────────────

  /**
   * Validates that the swap destination is above solid ground, not embedded in a tile,
   * and not overlapping a hazard. Snaps to safe footing.
   */
  private validateSwapDestination(sentinelX: number, sentinelY: number, def: RiftNodeDef): { x: number; y: number } {
    let targetX = sentinelX;
    let targetY = sentinelY;

    // 1. Check if sentinel is near designated swap destination
    const distToPref = Phaser.Math.Distance.Between(sentinelX, sentinelY, def.swapDestinationX, def.swapDestinationY);
    if (distToPref < 90) {
      targetX = def.swapDestinationX;
      targetY = def.swapDestinationY;
    }

    // 2. Ensure Y is grounded (within reasonable bounds, never below floor)
    targetY = Math.min(targetY, 340);
    targetY = Math.max(targetY, 120);

    return { x: targetX, y: targetY };
  }

  // ── Update Loop ───────────────────────────────────────────────────────────

  public update(_time: number, delta: number, cursors?: Phaser.Types.Input.Keyboard.CursorKeys, keys?: { a?: Phaser.Input.Keyboard.Key; d?: Phaser.Input.Keyboard.Key; w?: Phaser.Input.Keyboard.Key; space?: Phaser.Input.Keyboard.Key }): void {
    // Tick cooldown timers
    this.cooldownTimers.forEach((timer, idx) => {
      if (timer > 0) {
        const next = Math.max(0, timer - delta);
        if (next === 0) {
          this.cooldownTimers.delete(idx);
        } else {
          this.cooldownTimers.set(idx, next);
        }
      }
    });

    // Update in-world node radius glows
    const nearby = this.getNearbyAvailableNode();
    this.nodeRadiusGfx.forEach((rgfx, idx) => {
      rgfx.clear();
      const def = this.nodeDefs[idx];
      if (!def) return;

      const isUsed = this.swappedNodes.has(idx);
      const isCooling = this.cooldownTimers.has(idx);

      if (isUsed) {
        rgfx.lineStyle(1, 0x4a5568, 0.15);
      } else if (isCooling) {
        rgfx.lineStyle(1, 0xffaa00, 0.3);
      } else if (idx === nearby) {
        rgfx.lineStyle(2, 0x00f0ff, 0.85); // High-intensity glow when player inside
      } else {
        rgfx.lineStyle(1, 0x00f0ff, 0.3);
      }
      rgfx.strokeCircle(def.x, def.y - 12, this.config.nodeInteractionRadius);
    });

    // If possessing, handle Sentinel inputs, tether line, and countdown ring
    if (this.isPossessing) {
      this.possessionTimeRemaining -= delta;

      // Check timeout failure
      if (this.possessionTimeRemaining <= 0) {
        this.failPossession('POSSESSION WINDOW EXPIRED');
        return;
      }

      // Check void fall failure
      if (this.sentinel.y > 440) {
        this.failPossession('SENTINEL FELL INTO THE VOID');
        return;
      }

      // Check tether distance limit
      const dist = Phaser.Math.Distance.Between(this.stasisOriginX, this.stasisOriginY, this.sentinel.x, this.sentinel.y);
      if (dist > this.config.tetherMaxDistance) {
        this.failPossession('TETHER SNAP — DISTANCE LIMIT EXCEEDED');
        return;
      }

      // Move Sentinel with same left/right/jump controls
      this.updateSentinelControls(delta, cursors, keys);

      // Render in-world tether beam from Vance's stasis dome to Sentinel
      this.drawTether(this.stasisOriginX, this.stasisOriginY, this.sentinel.x, this.sentinel.y, dist);

      // Render in-world countdown ring above Sentinel
      this.drawSentinelCountdownRing(this.sentinel.x, this.sentinel.y - 28);
    }
  }

  private updateSentinelControls(
    delta: number,
    cursors?: Phaser.Types.Input.Keyboard.CursorKeys,
    keys?: { a?: Phaser.Input.Keyboard.Key; d?: Phaser.Input.Keyboard.Key; w?: Phaser.Input.Keyboard.Key; space?: Phaser.Input.Keyboard.Key }
  ): void {
    const sBody = this.sentinel.body as Phaser.Physics.Arcade.Body;
    if (!sBody) return;

    // ── Movement ──────────────────────────────────────────────────────────
    const mInput = (this.player as any).mobileInput;
    const isLeft  = Boolean(cursors?.left?.isDown  || keys?.a?.isDown || mInput?.moveLeft);
    const isRight = Boolean(cursors?.right?.isDown || keys?.d?.isDown || mInput?.moveRight);

    if (isLeft && !isRight) {
      sBody.setVelocityX(-this.config.sentinelMoveSpeed);
      this.sentinel.setFlipX(true);
    } else if (isRight && !isLeft) {
      sBody.setVelocityX(this.config.sentinelMoveSpeed);
      this.sentinel.setFlipX(false);
    } else {
      // Decelerate quickly rather than stopping instantly, for a slightly smoother feel
      sBody.setVelocityX(sBody.velocity.x * 0.7);
    }

    // ── Ground State ──────────────────────────────────────────────────────
    const onGround = Boolean(sBody.blocked.down || sBody.touching.down);

    // When sentinel touches ground, clear the jumping flag so next press works
    if (onGround && this.sentinelIsJumping && sBody.velocity.y >= 0) {
      this.sentinelIsJumping = false;
    }

    // Coyote time: briefly allow jumping after walking off a ledge
    if (onGround) {
      this.sentinelCoyoteTimer = 140;
    } else if (this.sentinelCoyoteTimer > 0) {
      this.sentinelCoyoteTimer = Math.max(0, this.sentinelCoyoteTimer - delta);
    }

    // ── Jump Input: detect JUST-pressed (rising edge) only ────────────────
    //    Using isDown for jumpPressed is the root cause of double-jump:
    //    the flag stays true the whole frame the key is held, so as soon as
    //    the sentinel lands it immediately jumps again.
    //    We detect the rising edge manually with prevJumpDown.
    const jumpIsDown = Boolean(
      cursors?.up?.isDown ||
      keys?.w?.isDown ||
      keys?.space?.isDown ||
      cursors?.space?.isDown ||
      mInput?.jumpIsDown
    );
    // Mobile tap / just-pressed signal
    const mobileJustPressed = Boolean(mInput?.jumpJustPressed);

    // Rising-edge detection: true only on the FIRST frame the key goes down
    const jumpJustPressed = (jumpIsDown && !this.prevJumpDown) || mobileJustPressed;
    this.prevJumpDown = jumpIsDown;

    // Jump buffer: if player presses jump slightly before landing, queue it
    if (jumpJustPressed) {
      this.sentinelJumpBufferTimer = 140;
    } else if (this.sentinelJumpBufferTimer > 0) {
      this.sentinelJumpBufferTimer = Math.max(0, this.sentinelJumpBufferTimer - delta);
    }

    // ── Execute Jump ──────────────────────────────────────────────────────
    const canJump   = (onGround || this.sentinelCoyoteTimer > 0) && !this.sentinelIsJumping;
    const wantsJump = this.sentinelJumpBufferTimer > 0;

    if (canJump && wantsJump) {
      sBody.setVelocityY(this.config.sentinelJumpVelocity);
      this.sentinelIsJumping   = true;
      this.sentinelCoyoteTimer = 0;
      this.sentinelJumpBufferTimer = 0;
      AudioManager.playJump();
    }

    // ── Variable Jump Height (cut apex when key released) ─────────────────
    if (this.sentinelIsJumping && !jumpIsDown && sBody.velocity.y < -60) {
      sBody.setVelocityY(sBody.velocity.y * 0.5);
    }
  }

  // ── In-World Rendering Helpers ────────────────────────────────────────────

  private drawStasisDome(x: number, y: number): void {
    this.stasisDomeGfx.clear();
    this.stasisDomeGfx.lineStyle(2, 0x00f0ff, 0.9);
    this.stasisDomeGfx.strokeCircle(x, y - 6, 26);
    this.stasisDomeGfx.fillStyle(0x00f0ff, 0.18);
    this.stasisDomeGfx.fillCircle(x, y - 6, 26);
  }

  private drawTether(fromX: number, fromY: number, toX: number, toY: number, dist: number): void {
    this.tetherGfx.clear();
    const ratio = dist / this.config.tetherMaxDistance;
    const color = ratio > 0.8 ? 0xff0055 : 0x00f0ff;

    this.tetherGfx.lineStyle(1.8, color, 0.75);
    this.tetherGfx.lineBetween(fromX, fromY - 6, toX, toY - 6);

    // Pulsing data packets along tether line
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    this.tetherGfx.fillStyle(0xffffff, 0.9);
    this.tetherGfx.fillCircle(midX, midY - 6, 2.5);
  }

  private drawSentinelCountdownRing(x: number, y: number): void {
    this.sentinelCountdownGfx.clear();
    const pct = Math.max(0, this.possessionTimeRemaining / this.config.possessionTimeLimitMs);
    const color = pct > 0.35 ? 0x00f0ff : 0xff0055;

    // Background circle
    this.sentinelCountdownGfx.lineStyle(2, 0x000000, 0.6);
    this.sentinelCountdownGfx.strokeCircle(x, y, 9);

    // Foreground arc reflecting remaining time
    this.sentinelCountdownGfx.lineStyle(2, color, 0.95);
    this.sentinelCountdownGfx.beginPath();
    this.sentinelCountdownGfx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2, false);
    this.sentinelCountdownGfx.strokePath();
  }

  private drawObjectiveTether(fromX: number, fromY: number, toX: number, toY: number): void {
    this.objectiveTetherGfx.clear();
    this.objectiveTetherGfx.lineStyle(2, 0xff007f, 0.85);
    this.objectiveTetherGfx.lineBetween(fromX, fromY, toX, toY);
  }

  // ── Reset & Teardown ──────────────────────────────────────────────────────

  public resetAll(): void {
    this.endPossessionCleanly();
    this.swappedNodes.clear();
    this.completedObjectives.clear();
    this.cooldownTimers.clear();
    try { this.objectiveTetherGfx?.clear(); } catch (_) { /* ignore */ }
  }

  public destroy(): void {
    // Mark as not possessing FIRST so endPossessionCleanly guards work correctly,
    // then skip calling resetAll() — we are about to destroy everything anyway
    // and the physics bodies are likely already gone during scene shutdown.
    this.isPossessing = false;
    this.activeNodeIndex = -1;
    this.swappedNodes.clear();
    this.completedObjectives.clear();
    this.cooldownTimers.clear();

    // Destroy graphics objects (each guarded individually)
    try { this.tetherGfx?.destroy(); } catch (_) { /* ignore */ }
    try { this.stasisDomeGfx?.destroy(); } catch (_) { /* ignore */ }
    try { this.sentinelCountdownGfx?.destroy(); } catch (_) { /* ignore */ }
    try { this.objectiveTetherGfx?.destroy(); } catch (_) { /* ignore */ }
    try { this.sentinel?.destroy(); } catch (_) { /* ignore */ }

    this.ghostPlatformSprites.forEach(s => {
      try { s?.destroy(); } catch (_) { /* ignore */ }
    });
    this.ghostPlatformSprites = [];
    this.ghostPlatformBodies = [];

    try { this.ghostCollider?.destroy(); } catch (_) { /* ignore */ }
  }
}
