import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { Player } from '../entities/Player';
import { SentinelDrone } from '../entities/SentinelDrone';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';

/**
 * LEVEL 1 DATA SPECIFICATION — FROZEN AGE
 * ─────────────────────────────────────────
 * Configurable data arrays for tuning obstacles, puzzles, and item placements
 * without touching core scene logic.
 */
export const LEVEL1_DATA = {
  id: 'level1',
  name: 'Frozen Age',
  sector: 1,
  dimensions: {
    width: 2800,
    height: 360,
    floorY: 320
  },
  spawn: { x: 60, y: 260 },
  checkpoints: [
    { id: 'cp_spawn', x: 60, y: 260, label: 'SECTOR 1 ENTRANCE' },
    { id: 'cp_vault', x: 870, y: 228, label: 'CRYOGENIC VAULT' },
    { id: 'cp_cave_entrance', x: 1850, y: 200, label: 'ICE CAVE PERIMETER' }
  ],
  zone2: {
    lake: { startX: 1460, endX: 1800, waterY: 330, spikeY: 320 },
    slab1: { x: 1530, y: 290, width: 48, triggerRange: [1450, 1580] as [number, number] },
    slab2Trap: { x: 1610, y: 325, width: 48, triggerRange: [1570, 1660] as [number, number] },
    slab3: { x: 1720, y: 280, width: 48, triggerRange: [1650, 1780] as [number, number] },
    centerIsland: { startX: 1600, endX: 1640, y: 260 },
    decoyValve: { x: 1470, y: 330, width: 32, triggerRange: [1440, 1500] as [number, number] }
  },
  zone3: {
    entrancePlatform: { startX: 1820, endX: 2020, y: 250 },
    gantry: { startX: 1860, endX: 1892, y: 195 },
    checkpoint: { x: 1850, y: 218, respawnY: 200 },
    refillCrystal1: { x: 1880, y: 165 },
    suspendedWater: { x: 1950, y: 65, triggerRange: [1840, 2010] as [number, number] },
    pressurePlate: { x: 1950, y: 240 },
    iceBarrier1: { x: 2000, y: 185, width: 24, height: 130 },
    crumbling: [
      { startX: 2070, y: 230, count: 2 },
      { startX: 2160, y: 230, count: 2 }
    ],
    movingHazard: { x: 2130, startY: 155, endY: 260, duration: 1500 },
    fallingIcicles: [
      { id: 'icicle_1', x: 2100, y: 125, triggerDist: 35 },
      { id: 'icicle_2', x: 2190, y: 125, triggerDist: 35 }
    ],
    floorSpikes: { startX: 2040, endX: 2240, step: 22, y: 320 },
    exitPlatform: { startX: 2240, endX: 2340, y: 250 },
    iceBarrier2: { x: 2320, y: 185, width: 24, height: 130, triggerRange: [2270, 2345] as [number, number] }
  },
  zone4: {
    entrancePlatform: { startX: 2350, endX: 2420, y: 260 },
    refillCrystal2: { x: 2380, y: 228 },
    iceRunway: { startX: 2440, endX: 2560, y: 240, triggerRange: [2380, 2610] as [number, number] },
    spikes: { startX: 2570, endX: 2592, step: 11, y: 240 },
    approachPlatform: { startX: 2600, endX: 2650, y: 240 },
    bunkerWall: { startX: 2650, endX: 2700, ceilingY: 120 },
    doorwayFloor: { startX: 2650, endX: 2700, y: 240 },
    timedDoor: { x: 2660, y: 180, width: 24, height: 92, triggerRange: [2620, 2710] as [number, number], durationMs: 4500 },
    exitPlatform: { startX: 2700, endX: 2800, y: 260 },
    failsafe2: { shelfX: 2740, shelfY: 210, spriteX: 2740, spriteY: 185 },
    exitPortal: { x: 2775, y: 220 }
  },
  refillCrystals: [
    { x: 200, y: 288 },
    { x: 1060, y: 258 },
    { x: 1880, y: 165 },
    { x: 2380, y: 228 }
  ]
} as const;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private waterTiles!: Phaser.Physics.Arcade.StaticGroup;
  private icePlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private failsafeItems: Phaser.Physics.Arcade.Sprite[] = [];
  private exitPortal?: Phaser.GameObjects.Sprite;

  // Moving platforms (Phase 5) — static bodies refreshed each tween tick
  private movingPlatformSprites: Phaser.Physics.Arcade.Sprite[] = [];

  private hud!: HUD;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private isPaused = false;
  private matrixGlitch!: Phaser.GameObjects.Graphics;

  // Checkpoint & Progression
  private checkpointX: number = LEVEL1_DATA.spawn.x;
  private checkpointY: number = LEVEL1_DATA.spawn.y;
  private failsafeCollected = 0;
  private hasRecoveredComponent = false;
  private isWaterFrozen = false;

  // Ice friction state
  private isOnIce = false;

  // Sentinel Drones (Phase 3)
  private drones: SentinelDrone[] = [];
  private readonly STAFF_STUN_RANGE = 80;

  // Phase 4: Stats tracking
  private deathCount = 0;
  private levelStartTime = 0;
  private isRespawning = false;
  private isLeavingScene = false;

  // Zone 2 state: Frozen Lake
  private slab1IceTiles: Phaser.GameObjects.Sprite[] = [];
  private slab2IceTiles: Phaser.GameObjects.Sprite[] = [];
  private slab3IceTiles: Phaser.GameObjects.Sprite[] = [];
  private isSlab1Frozen = false;
  private isSlab2Frozen = false;
  private isSlab3Frozen = false;
  private isDecoyFrozen = false;
  private decoyIceTile?: Phaser.GameObjects.Sprite;

  // Zone 3 state: Ice Cave
  private isPressurePlatePressed = false;
  private pressurePlateSprite?: Phaser.Physics.Arcade.Sprite;
  private iceBarrier1Sprite?: Phaser.Physics.Arcade.Sprite;
  private iceBarrier1Collider?: Phaser.Physics.Arcade.Collider;
  private isBarrier1Destroyed = false;
  private iceBarrier2Sprite?: Phaser.Physics.Arcade.Sprite;
  private iceBarrier2Collider?: Phaser.Physics.Arcade.Collider;
  private isBarrier2Melted = false;
  private fallingIcicles: Array<{
    sprite: Phaser.Physics.Arcade.Sprite;
    collider?: Phaser.Physics.Arcade.Collider;
    overlapCollider?: Phaser.Physics.Arcade.Collider;
    triggerDist: number;
    state: 'idle' | 'warning' | 'falling' | 'destroyed';
  }> = [];
  private movingHazard?: Phaser.Physics.Arcade.Sprite;
  private hasDroppedIceBlock = false;
  private hasShownPlateHint = false;
  private droppedIceBlock?: Phaser.Physics.Arcade.Sprite;

  // Zone 4 state: Buried Facility Approach
  private timedDoorSprite?: Phaser.Physics.Arcade.Sprite;
  private timedDoorCollider?: Phaser.Physics.Arcade.Collider;
  private isTimedDoorOpen = false;
  private timedDoorTimer?: Phaser.Time.TimerEvent;
  private isRunwayFrozen = true;
  private runwayIceTiles: Phaser.GameObjects.Sprite[] = [];
  private runwayWaterTiles: Phaser.GameObjects.Sprite[] = [];

  // Level boundaries
  private readonly levelWidth = LEVEL1_DATA.dimensions.width;
  private readonly levelHeight = LEVEL1_DATA.dimensions.height;

  constructor() {
    super(GAME_CONFIG.sceneKeys.Game);
  }

  create(): void {
    // Reset all per-run state
    this.isRespawning = false;
    this.isLeavingScene = false;
    this.isPaused = false;
    this.checkpointX = LEVEL1_DATA.spawn.x;
    this.checkpointY = LEVEL1_DATA.spawn.y;
    this.failsafeCollected = 0;
    this.hasRecoveredComponent = false;
    this.isWaterFrozen = false;
    this.deathCount = 0;
    this.isPressurePlatePressed = false;
    this.isBarrier1Destroyed = false;
    this.isBarrier2Melted = false;
    this.hasDroppedIceBlock = false;
    this.hasShownPlateHint = false;
    this.droppedIceBlock = undefined;
    this.isTimedDoorOpen = false;
    this.isRunwayFrozen = true;
    this.runwayIceTiles = [];
    this.runwayWaterTiles = [];
    this.isSlab1Frozen = false;
    this.isSlab2Frozen = false;
    this.isSlab3Frozen = false;
    this.isDecoyFrozen = false;
    this.failsafeItems = [];
    this.movingPlatformSprites = [];
    this.fallingIcicles = [];
    this.slab1IceTiles = [];
    this.slab2IceTiles = [];
    this.slab3IceTiles = [];

    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    this.ensureZoneTextures();

    // Physics world is taller than the visible level so the player can
    // physically fall off platforms before the death trigger fires.
    this.physics.world.setBounds(0, 0, this.levelWidth, 800);

    this.createAtmosphericBackground();

    this.platforms = this.physics.add.staticGroup();
    this.waterTiles = this.physics.add.staticGroup();
    this.icePlatforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();

    

    // Build geometry — conduits/crystals/drones returned for post-player overlap registration
    const { conduits, crystals, drones } = this.buildLevelGeometry();
    this.drones = drones;

    // ── Player must be created BEFORE any physics.add.collider/overlap ──
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // Static platform colliders
    this.physics.add.collider(this.player, this.platforms, (_p, tile) => {
      // Crumbling platform trigger (safe to reference player here)
      const sp = tile as Phaser.Physics.Arcade.Sprite;
      if (sp.texture?.key !== 'tile_crumble') return;
      if (sp.getData('broken') || sp.getData('collapsing')) return;
      const pb = this.player.body as Phaser.Physics.Arcade.Body;
      if (!pb.blocked.down) return;

      sp.setData('collapsing', true);
      this.tweens.add({
        targets: sp,
        x: (sp.getData('origX') as number) + 2,
        yoyo: true, repeat: 7, duration: 40,
        onComplete: () => {
          sp.setData('broken', true);
          sp.setData('collapsing', false);
          sp.setAlpha(0);
          (sp.body as Phaser.Physics.Arcade.StaticBody).enable = false;
          this.add.particles(
            sp.getData('origX') as number,
            sp.getData('origY') as number,
            'proto_tile',
            { speed: { min: 20, max: 60 }, scale: { start: 0.2, end: 0 }, lifespan: 450, quantity: 8 }
          ).setDepth(10);
          this.time.delayedCall(3500, () => {
            sp.setData('broken', false);
            sp.setPosition(sp.getData('origX') as number, sp.getData('origY') as number);
            (sp.body as Phaser.Physics.Arcade.StaticBody).enable = true;
            (sp.body as Phaser.Physics.Arcade.StaticBody).reset(
              sp.getData('origX') as number, sp.getData('origY') as number
            );
            this.tweens.add({ targets: sp, alpha: 1, duration: 400, ease: 'Power2' });
          });
        }
      });
    });

    this.physics.add.collider(this.player, this.icePlatforms, () => {
      this.isOnIce = true;
    });

    // Failsafe overlaps (one per item in the array)
    this.failsafeItems.forEach(item => {
      this.physics.add.overlap(this.player, item, () => this.collectFailsafeComponent(item));
    });

    // Hazards
    this.physics.add.overlap(this.player, this.hazards, () => this.handleHazardCollision());
    this.physics.add.overlap(this.player, this.waterTiles, (_p, wTile) => {
      const isRunwayTile = this.runwayWaterTiles.includes(wTile as Phaser.Physics.Arcade.Sprite);
      if (isRunwayTile) {
        if (!this.isRunwayFrozen) this.handleHazardCollision('FREEZING WATER SUBMERSION');
      } else {
        if (!this.isWaterFrozen) this.handleHazardCollision('FREEZING WATER SUBMERSION');
      }
    });

    // Energy conduit overlaps
    conduits.forEach(conduit => {
      this.physics.add.overlap(this.player, conduit, () => {
        if (conduit.getData('used')) return;
        conduit.setData('used', true);
        const restored = this.player.maxStaffCharges - this.player.staffCharges;
        this.player.restoreStaffCharges(restored);
        this.hud.updateCharges(this.player.staffCharges);
        this.hud.showBanner('STAFF ENERGY FULLY RECHARGED!');
        AudioManager.playConduitRecharge();
        this.cameras.main.flash(120, 0, 200, 100);
        this.tweens.killTweensOf(conduit);
        conduit.setAlpha(0.25).setTint(0x444444);
        this.time.delayedCall(12000, () => {
          conduit.setData('used', false);
          conduit.clearTint().setAlpha(1);
          this.tweens.add({ targets: conduit, alpha: 0.6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
        });
      });
    });

    // Checkpoint crystal overlaps
    crystals.forEach(({ sprite: crystal, cx, cy }) => {
      this.physics.add.overlap(this.player, crystal, () => {
        if (crystal.getData('activated')) return;
        crystal.setData('activated', true);
        this.checkpointX = cx;
        this.checkpointY = cy - 30;
        crystal.setTexture('checkpoint_active');
        this.cameras.main.flash(200, 0, 240, 255);
        AudioManager.playCheckpoint();
        this.hud.showBanner('CHECKPOINT ACTIVATED');
        this.add.particles(cx, cy, 'proto_tile', {
          speed: { min: 30, max: 90 }, scale: { start: 0.3, end: 0 },
          tint: [0x00f0ff, 0xd85ef5], lifespan: 600, quantity: 16
        }).setDepth(20);
      });
    });

    // Drone overlaps — use integrity system instead of instant kill
    this.drones.forEach(drone => {
      this.physics.add.overlap(this.player, drone, () => {
        if (!drone.isLethal || this.isRespawning || this.isLeavingScene) return;
        const lethal = this.player.takeDamage();
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleHazardCollision('SENTINEL DRONE CONTACT');
        } else {
          AudioManager.playDeath(); // short hit sound
          this.cameras.main.shake(150, 0.01);
          this.cameras.main.flash(80, 180, 0, 0);
          this.hud.showBanner(`INTEGRITY BREACH! ${this.player.integrity} REMAINING`);
        }
      });
    });

    // ── Zone 3 & Zone 4 Dynamic Colliders / Overlaps ──
    if (this.iceBarrier1Sprite) {
      this.iceBarrier1Collider = this.physics.add.collider(this.player, this.iceBarrier1Sprite);
    }
    if (this.iceBarrier2Sprite) {
      this.iceBarrier2Collider = this.physics.add.collider(this.player, this.iceBarrier2Sprite);
    }
    if (this.timedDoorSprite) {
      this.timedDoorCollider = this.physics.add.collider(this.player, this.timedDoorSprite);
    }

    if (this.pressurePlateSprite) {
      this.physics.add.overlap(this.player, this.pressurePlateSprite, () => {
        if (!this.isPressurePlatePressed && !this.hasShownPlateHint) {
          this.hasShownPlateHint = true;
          this.hud.showBanner('PRESSURE LOCK: INSUFFICIENT WEIGHT (REQUIRES SOLID CRYO-BLOCK)');
          this.time.delayedCall(3000, () => { this.hasShownPlateHint = false; });
        }
      });
    }

    if (this.movingHazard) {
      this.physics.add.overlap(this.player, this.movingHazard, () => {
        if (this.isRespawning || this.isLeavingScene) return;
        const lethal = this.player.takeDamage();
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleHazardCollision('FROST HAZARD CONTACT');
        } else {
          AudioManager.playDeath();
          this.cameras.main.shake(150, 0.01);
          this.hud.showBanner(`INTEGRITY BREACH! ${this.player.integrity} REMAINING`);
        }
      });
    }

    this.fallingIcicles.forEach(item => {
      item.collider = this.physics.add.collider(item.sprite, this.platforms, () => {
        this.shatterFallingIcicle(item);
      });
      item.overlapCollider = this.physics.add.overlap(this.player, item.sprite, () => {
        if (this.isRespawning || this.isLeavingScene) return;
        const lethal = this.player.takeDamage();
        this.shatterFallingIcicle(item);
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleHazardCollision('FALLING ICICLE IMPACT');
        } else {
          AudioManager.playDeath();
          this.cameras.main.shake(150, 0.01);
          this.hud.showBanner(`INTEGRITY BREACH! ${this.player.integrity} REMAINING`);
        }
      });
    });

    // Camera
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(40, 20);

    // HUD
    this.hud = new HUD(this);
    this.hud.updateCharges(this.player.staffCharges);
    this.hud.updateIntegrity(this.player.integrity);

    // Audio init (needs user gesture — the Play button click counts)
    AudioManager.init();
    AudioManager.startMatrixMusic();

    // Player event → audio + game logic hooks
    this.player.on('staff_used', (chargesLeft: number) => {
      this.hud.updateCharges(chargesLeft);
      AudioManager.playStaffUse();
      this.checkWaterStateConversion();
      this.tryStunNearbyDrones();
    });
    this.player.on('staff_empty', () => {
      this.hud.showBanner('STAFF ENERGY DEPLETED — FIND AN ENERGY CONDUIT!');
    });
    this.player.on('player_respawn', () => {
      this.hud.updateCharges(this.player.staffCharges);
      this.hud.updateIntegrity(this.player.integrity);
    });
    this.player.on('player_damaged', (integrity: number) => {
      this.hud.updateIntegrity(integrity);
    });
    this.player.on('player_jump', () => AudioManager.playJump());
    this.player.on('player_land', () => AudioManager.playLand());

    // Pause key & HUD Home Button
    this.hud.onPauseClicked(() => this.togglePause());
    if (this.input.keyboard) {
      const esc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      esc.on('down', () => this.togglePause());
    }

    this.createScanlineOverlay();

    // Matrix Glitch Event
    this.matrixGlitch = this.add.graphics();
    this.matrixGlitch.setScrollFactor(0);
    this.matrixGlitch.setDepth(10000);

    const triggerMatrixGlitch = () => {
      if (this.isPaused) {
        this.time.delayedCall(1500, triggerMatrixGlitch);
        return;
      }

      const width = this.scale.width;
      const height = this.scale.height;

      this.matrixGlitch.clear();
      this.matrixGlitch.setAlpha(1);

      // Random horizontal green pixel strips
      const strips = Phaser.Math.Between(5, 12);

      for (let i = 0; i < strips; i++) {
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);

        const stripWidth = Phaser.Math.Between(20, width * 0.7);
        const stripHeight = Phaser.Math.Between(2, 8);

        // Different shades of Matrix green
        const green = Phaser.Utils.Array.GetRandom([
          0x00ff41,
          0x00cc33,
          0x39ff14,
          0x008f11
        ]);

        this.matrixGlitch.fillStyle(
          green,
          Phaser.Math.FloatBetween(0.3, 0.9)
        );

        this.matrixGlitch.fillRect(
          x + Phaser.Math.Between(-8, 8),
          y,
          stripWidth,
          stripHeight
        );
      }

      // Larger digital interference blocks
      for (let i = 0; i < 3; i++) {
        this.matrixGlitch.fillStyle(0x00ff41, 0.65);

        this.matrixGlitch.fillRect(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.Between(5, 25),
          Phaser.Math.Between(5, 18)
        );
      }

      // Quickly disappear
      this.tweens.add({
        targets: this.matrixGlitch,
        alpha: 0,
        duration: Phaser.Math.Between(70, 120),
        onComplete: () => {
          this.matrixGlitch.clear();
          this.matrixGlitch.setAlpha(1);
        }
      });

      // Random interval before next glitch
      this.time.delayedCall(
        Phaser.Math.Between(2500, 4000),
        triggerMatrixGlitch
      );
    };

    // Start effect
    this.time.delayedCall(2000, triggerMatrixGlitch);

    this.levelStartTime = Date.now();
    this.cameras.main.fadeIn(400, 7, 11, 20);
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    if (this.player.isDead && !this.isRespawning && !this.isLeavingScene) {
      this.handleHazardCollision('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning || this.isLeavingScene) return;

    this.player.update(time, delta);

    // Update sentinel drones
    this.drones.forEach(d => d.update(time, delta, this.player.x, this.player.y));

    // Update Zone 3 falling icicles
    this.fallingIcicles.forEach(item => {
      if (item.state === 'idle') {
        const dx = Math.abs(this.player.x - item.sprite.x);
        if (dx < item.triggerDist && this.player.y > item.sprite.y) {
          item.state = 'warning';
          item.sprite.setData('origX', item.sprite.x);
          this.tweens.add({
            targets: item.sprite,
            x: item.sprite.x + 2,
            yoyo: true,
            repeat: 5,
            duration: 40,
            onComplete: () => {
              if (item.state === 'warning' && item.sprite && item.sprite.active) {
                item.state = 'falling';
                const body = item.sprite.body as Phaser.Physics.Arcade.Body;
                if (body) {
                  body.setAllowGravity(true);
                  body.setVelocityY(260);
                }
              }
            }
          });
        }
      } else if (item.state === 'falling') {
        if (item.sprite.y > this.levelHeight + 20) {
          this.shatterFallingIcicle(item);
        }
      }
    });

    // Apply / reset ice friction
    if (this.isOnIce) {
      (this.player.body as Phaser.Physics.Arcade.Body).setDragX(80);
    } else {
      (this.player.body as Phaser.Physics.Arcade.Body).setDragX(1000);
    }
    this.isOnIce = false;

    // Pit / fall death
    if (this.player.y > this.levelHeight + 40 && !this.player.isDead && !this.isLeavingScene) {
      this.handleHazardCollision('ABYSSAL FALL');
    }

    // Level exit
    if (this.hasRecoveredComponent && this.exitPortal && !this.player.isDead && !this.isLeavingScene) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.exitPortal.x, this.exitPortal.y
      );
      if (dist < 32) this.handleLevelComplete();
    }
  }

  private createAtmosphericBackground(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── Deep cave void — near-black gradient ───────────────────────────
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(0x010306, 0x010306, 0x020912, 0x020912, 1);
    sky.fillRect(0, 0, W, H);

    // ── Far background cave walls (depth layer) ────────────────────────
    const farWalls = this.add.graphics().setScrollFactor(0.08);
    farWalls.fillStyle(0x030c16, 1);
    // Big cave wall shapes on left and right
    farWalls.fillTriangle(0, H, 0, 80, 120, H);
    farWalls.fillTriangle(this.levelWidth - 100, 60, this.levelWidth, 80, this.levelWidth, H);
    // Mid cave ceiling bulge
    for (let x = 0; x < this.levelWidth; x += 200) {
      farWalls.fillEllipse(x + 100, -20, 240, 100);
    }

    // ── Cave stalactites — mid parallax ───────────────────────────────
    const stalactites = this.add.graphics().setScrollFactor(0.3).setDepth(2);
    const stalData = [
      [50,  0, 18, 120], [130, 0, 12, 90],  [220, 0, 22, 140],
      [340, 0, 10, 70],  [430, 0, 20, 110], [520, 0, 14, 95],
      [610, 0, 26, 160], [720, 0, 11, 80],  [820, 0, 18, 125],
      [920, 0, 24, 145], [1030,0, 12, 88],  [1140,0, 22, 130],
      [1250,0, 16, 105], [1370,0, 20, 118], [1480,0, 14, 92],
      [1580,0, 24, 150], [1690,0, 18, 120], [1800,0, 22, 135],
      [1910,0, 16, 110], [2020,0, 24, 145], [2130,0, 20, 125],
      [2240,0, 14, 95],  [2350,0, 22, 130], [2460,0, 18, 115],
      [2570,0, 24, 140], [2680,0, 16, 100], [2760,0, 20, 125],
    ];
    stalData.forEach(([sx, sy, w, h]) => {
      // Main stalactite body (very dark blue-grey)
      stalactites.fillStyle(0x06141f, 1);
      stalactites.fillTriangle(sx - w/2, sy, sx + w/2, sy, sx, sy + h);
      // Edge highlight
      stalactites.fillStyle(0x0d2a3e, 0.5);
      stalactites.fillTriangle(sx - w/2, sy, sx - w/4, sy, sx, sy + h);
      // Cyan glowing drip tip
      stalactites.fillStyle(0x00a8d4, 0.7);
      stalactites.fillCircle(sx, sy + h - 4, 3);
      stalactites.fillStyle(0x48cae4, 0.4);
      stalactites.fillCircle(sx, sy + h - 4, 6);
    });

    // ── Near stalactites — closer parallax ─────────────────────────────
    const nearStal = this.add.graphics().setScrollFactor(0.6).setDepth(3);
    [[80, 0, 14, 70], [280, 0, 18, 95], [550, 0, 22, 120],
     [750, 0, 15, 78], [980, 0, 20, 108], [1200, 0, 16, 85],
     [1430, 0, 24, 130], [1650, 0, 18, 90], [1900, 0, 20, 110],
     [2150, 0, 22, 115], [2400, 0, 16, 85], [2650, 0, 24, 120]].forEach(([sx, sy, w, h]) => {
      nearStal.fillStyle(0x040e18, 1);
      nearStal.fillTriangle(sx - w/2, sy, sx + w/2, sy, sx, sy + h);
      nearStal.fillStyle(0x00c8ee, 0.5);
      nearStal.fillCircle(sx, sy + h - 3, 2.5);
      nearStal.fillStyle(0x00f0ff, 0.2);
      nearStal.fillCircle(sx, sy + h - 3, 5);
    });

    // ── Glowing cave floor / water ──────────────────────────────────────
    const waterGlow = this.add.graphics().setScrollFactor(1).setDepth(1);
    // Deep reflective water band at ground level
    waterGlow.fillGradientStyle(0x001830, 0x001830, 0x002a4a, 0x002a4a, 1);
    waterGlow.fillRect(0, this.levelHeight - 40, this.levelWidth, 40);
    // Water surface shimmer line
    waterGlow.fillStyle(0x00a8d4, 0.35);
    waterGlow.fillRect(0, this.levelHeight - 42, this.levelWidth, 4);
    // Bioluminescent glow patches in the water
    for (let x = 0; x < this.levelWidth; x += 120) {
      waterGlow.fillStyle(0x00f0ff, 0.06);
      waterGlow.fillEllipse(x + 60, this.levelHeight - 30, 100, 30);
    }

    // ── Rising bioluminescent mist particles ──────────────────────────
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 0, max: this.levelWidth },
      y: { min: this.levelHeight - 30, max: this.levelHeight },
      speedY: { min: -25, max: -8 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.12, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: [0x00f0ff, 0x48cae4, 0x0096c7],
      lifespan: 4000,
      frequency: 140
    }).setDepth(4);

    // ── Ambient floating ice dust ─────────────────────────────────────
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 0, max: this.levelWidth },
      y: { min: 20, max: this.levelHeight - 50 },
      speedY: { min: 5, max: 18 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.07, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: [0x90e0ef, 0xcaf0f8],
      lifespan: 5500,
      frequency: 220
    }).setDepth(4);
  }

  // ── Level Geometry ─────────────────────────────────────────────────────

  private buildLevelGeometry(): {
    conduits: Phaser.Physics.Arcade.Sprite[];
    crystals: Array<{ sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number }>;
    drones: SentinelDrone[];
  } {
    const conduits: Phaser.Physics.Arcade.Sprite[] = [];
    const crystals: Array<{ sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number }> = [];
    const drones: SentinelDrone[] = [];

    // Segment 1: Starting Ledge
    for (let x = 0; x <= 240; x += 32) {
      this.platforms.create(x, 320, 'tile_snow_top').refreshBody();
      this.platforms.create(x, 352, 'proto_tile').refreshBody();
    }
    for (let y = 0; y < 200; y += 32) {
      this.platforms.create(0, y, 'proto_tile').refreshBody();
    }

    // Energy Conduit #1 (before water puzzle)
    const conduit1 = this.spawnEnergyConduit(200, 288);
    conduits.push(conduit1);

    // Segment 2: Stepping platforms
    this.platforms.create(320, 270, 'tile_snow_top').refreshBody();
    this.platforms.create(352, 270, 'tile_snow_top').refreshBody();
    this.platforms.create(440, 220, 'tile_snow_top').refreshBody();
    this.platforms.create(472, 220, 'tile_snow_top').refreshBody();

    // Hint sign
    this.add.text(418, 180, '[E / J]: USE STAFF -> FREEZE WATER', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#070b14',
      padding: { x: 4, y: 2 }
    });

    // Segment 3: Water Chasm — deep dark water with floor spikes
    for (let x = 520; x <= 720; x += 32) {
      const water = this.waterTiles.create(x, 330, 'tile_water').refreshBody();
      (water as Phaser.GameObjects.Sprite).setAlpha(0.9);
      // Extra water depth tiles
      this.waterTiles.create(x, 354, 'tile_water').refreshBody();
    }
    // Glowing cyan floor spikes (matching reference — upward pointing from floor)
    for (let x = 528; x <= 710; x += 22) {
      const spike = this.hazards.create(x, 320, 'hazard_icicle') as Phaser.Physics.Arcade.Sprite;
      spike.refreshBody();
      // Shrink physics body to spike tip area
      (spike.body as Phaser.Physics.Arcade.StaticBody).setSize(6, 12);
      (spike.body as Phaser.Physics.Arcade.StaticBody).setOffset(8, 0);
    }
    // Danger label above chasm
    this.add.text(570, 276, '⚠ ABYSSAL WATER', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00b4d8',
      stroke: '#040711',
      strokeThickness: 2
    });

    // Segment 4: Mid-level Vault
    for (let x = 780; x <= 1080; x += 32) {
      this.platforms.create(x, 290, 'tile_snow_top').refreshBody();
      this.platforms.create(x, 322, 'proto_tile').refreshBody();
      this.platforms.create(x, 354, 'proto_tile').refreshBody();
    }

    // Crumbling ice shortcuts above the vault (tiles only — collider registered in create())
    this.spawnCrumblingSection(800,  230, 4);
    this.spawnCrumblingSection(1020, 240, 3);

    // Mid-level checkpoint crystal
    const crystal1 = this.spawnCheckpointCrystal(870, 258);
    crystals.push(crystal1);

    // Failsafe Component #01 pedestal (mid-vault)
    const ped1 = this.add.rectangle(970, 260, 24, 30, 0x1f3554);
    ped1.setStrokeStyle(1, 0x00f0ff);
    const fs1 = this.physics.add.sprite(970, 235, 'failsafe_component');
    fs1.setImmovable(true);
    (fs1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: fs1, y: 230, yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut' });
    this.add.text(936, 206, 'FAILSAFE 01', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.failsafeItems.push(fs1);

    // Energy Conduit #2 (before final climb)
    const conduit2 = this.spawnEnergyConduit(1060, 258);
    conduits.push(conduit2);

    // Segment 5: Ascending ledges + slippery ice bridge
    this.platforms.create(1150, 240, 'tile_snow_top').refreshBody();
    this.platforms.create(1182, 240, 'tile_snow_top').refreshBody();

    // Slippery ice bridge over gap
    for (let x = 1200; x <= 1260; x += 32) {
      this.icePlatforms.create(x, 210, 'tile_ice').refreshBody();
    }

    this.platforms.create(1280, 190, 'tile_snow_top').refreshBody();
    this.platforms.create(1312, 190, 'tile_snow_top').refreshBody();

    // Transition to Zone 2: Frozen Lake
    for (let x = 1360; x <= 1440; x += 32) {
      this.platforms.create(x, 250, 'tile_snow_top').refreshBody();
      this.platforms.create(x, 282, 'proto_tile').refreshBody();
    }

    // ── Zone 2: Frozen Lake ──
    this.buildZone2FrozenLake();

    // ── Zone 3: Ice Cave ──
    this.buildZone3IceCave(crystals, conduits);

    // ── Zone 4: Buried Facility Approach (with relocated Failsafe 02 & Exit Gate) ──
    this.buildZone4FacilityApproach(conduits);

    // ── Moving Platform (Phase 5) ────────────────────────────────────
    // Floats between x=500 and x=760, bridging the gap before the water chasm
    const movPlat = this.platforms.create(600, 260, 'tile_snow_top') as Phaser.Physics.Arcade.Sprite;
    movPlat.refreshBody();
    movPlat.setData('isMoving', true);
    this.movingPlatformSprites.push(movPlat);
    this.tweens.add({
      targets: movPlat,
      x: 760,
      ease: 'Sine.easeInOut',
      duration: 2200,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        (movPlat.body as Phaser.Physics.Arcade.StaticBody).reset(movPlat.x, movPlat.y);
      }
    });
    this.add.text(555, 234, '← MOVING PLATFORM →', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#48cae4',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Sentinel Drones (Phase 3) ──────────────────────────────────────
    // Drone 1: patrols above the vault platform
    drones.push(new SentinelDrone(this, 850, 250, 790, 1060));
    // Drone 2: patrols the ascending ledges section
    drones.push(new SentinelDrone(this, 1200, 170, 1150, 1310));

    // Danger sign near first drone
    this.add.text(785, 222, '! SENTINEL PATROL ZONE !', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff4444',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    });

    return { conduits, crystals, drones };
  }

  // ── Crumbling Platforms ────────────────────────────────────────────────
  // Only creates tiles with metadata; the crumble collider is registered
  // in create() AFTER the player exists (via the platforms collider callback).

  private spawnCrumblingSection(startX: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const x = startX + i * 32;
      const tile = this.platforms.create(x, y, 'tile_crumble') as Phaser.Physics.Arcade.Sprite;
      tile.refreshBody();
      tile.setData('collapsing', false);
      tile.setData('broken', false);
      tile.setData('origX', x);
      tile.setData('origY', y);
    }
    // ⚠️  No physics.add.collider here — player doesn't exist yet.
    //     Crumble logic is handled inside the platforms collider callback in create().
  }

  // ── Energy Conduit ─────────────────────────────────────────────────────
  // Returns the sprite; overlap is registered in create() after player exists.

  private spawnEnergyConduit(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const conduit = this.physics.add.sprite(x, y, 'energy_conduit');
    conduit.setImmovable(true);
    (conduit.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    conduit.setData('used', false);
    this.tweens.add({ targets: conduit, alpha: 0.6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    this.add.text(x - 22, y - 24, 'ENERGY CONDUIT', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#70e000',
      stroke: '#040711',
      strokeThickness: 2
    });
    return conduit;
  }

  // ── Checkpoint Crystal ─────────────────────────────────────────────────
  // Returns { sprite, cx, cy }; overlap is registered in create() after player.

  private spawnCheckpointCrystal(x: number, y: number): { sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number } {
    const crystal = this.physics.add.sprite(x, y, 'checkpoint_crystal');
    crystal.setImmovable(true);
    (crystal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    crystal.setData('activated', false);
    this.add.text(x - 24, y - 24, 'CHECKPOINT', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#d85ef5',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.tweens.add({ targets: crystal, y: y - 4, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    return { sprite: crystal, cx: x, cy: y };
  }

  // ── Water State Conversion ─────────────────────────────────────────────

  private checkWaterStateConversion(): void {
    // Zone 1: Main Water Chasm (existing logic preserved 100%)
    if (this.player.x >= 400 && this.player.x <= 750) {
      if (!this.isWaterFrozen) {
        this.isWaterFrozen = true;
        this.hud.showBanner('WATER STATE CONVERTED: ICE BRIDGE FORMED');
        for (let x = 520; x <= 720; x += 32) {
          const ice = this.icePlatforms.create(x, 320, 'tile_ice').refreshBody();
          (ice as Phaser.GameObjects.Sprite).setAlpha(0);
          this.tweens.add({ targets: ice, alpha: 1, duration: 300 });
        }
        this.cameras.main.flash(200, 0, 240, 255);
      } else {
        this.isWaterFrozen = false;
        this.hud.showBanner('WATER STATE CONVERTED: ICE MELTED');
        this.icePlatforms.clear(true, true);
        this.cameras.main.flash(150, 0, 119, 182);
      }
      return;
    }

    // Zone 2: Frozen Lake — Slab 1
    const z2 = LEVEL1_DATA.zone2;
    if (this.player.x >= z2.slab1.triggerRange[0] && this.player.x <= z2.slab1.triggerRange[1]) {
      this.isSlab1Frozen = !this.isSlab1Frozen;
      if (this.isSlab1Frozen) {
        this.hud.showBanner('LAKE SLAB A FROZEN');
        this.slab1IceTiles = [];
        for (let sx = z2.slab1.x - 16; sx <= z2.slab1.x + 16; sx += 32) {
          const ice = this.icePlatforms.create(sx, z2.slab1.y, 'tile_ice').refreshBody() as Phaser.GameObjects.Sprite;
          this.slab1IceTiles.push(ice);
        }
        this.cameras.main.flash(150, 0, 240, 255);
      } else {
        this.hud.showBanner('LAKE SLAB A MELTED');
        this.slab1IceTiles.forEach(tile => tile.destroy());
        this.slab1IceTiles = [];
      }
      return;
    }

    // Zone 2: Decoy Valve
    if (this.player.x >= z2.decoyValve.triggerRange[0] && this.player.x <= z2.decoyValve.triggerRange[1] && this.player.y > 270) {
      this.isDecoyFrozen = !this.isDecoyFrozen;
      if (this.isDecoyFrozen) {
        this.hud.showBanner('SUB-AQUIFER VALVE FROZEN (DEAD END)');
        this.decoyIceTile = this.icePlatforms.create(z2.decoyValve.x, z2.decoyValve.y - 16, 'tile_ice').refreshBody() as Phaser.GameObjects.Sprite;
        this.cameras.main.flash(150, 100, 150, 255);
      } else {
        this.hud.showBanner('SUB-AQUIFER VALVE THAWED');
        this.decoyIceTile?.destroy();
        this.decoyIceTile = undefined;
      }
      return;
    }

    // Zone 2: Slab 2 (Decoy / Trap Slab)
    if (this.player.x >= z2.slab2Trap.triggerRange[0] && this.player.x <= z2.slab2Trap.triggerRange[1] && this.player.y > 270) {
      this.isSlab2Frozen = !this.isSlab2Frozen;
      if (this.isSlab2Frozen) {
        this.hud.showBanner('LOWER SLAB B FROZEN (HAZARD ROUTE)');
        this.slab2IceTiles = [];
        for (let sx = z2.slab2Trap.x - 16; sx <= z2.slab2Trap.x + 16; sx += 32) {
          const ice = this.icePlatforms.create(sx, z2.slab2Trap.y, 'tile_ice').refreshBody() as Phaser.GameObjects.Sprite;
          this.slab2IceTiles.push(ice);
        }
        this.cameras.main.flash(150, 0, 240, 255);
      } else {
        this.hud.showBanner('LOWER SLAB B MELTED');
        this.slab2IceTiles.forEach(tile => tile.destroy());
        this.slab2IceTiles = [];
      }
      return;
    }

    // Zone 2: Slab 3
    if (this.player.x >= z2.slab3.triggerRange[0] && this.player.x <= z2.slab3.triggerRange[1]) {
      this.isSlab3Frozen = !this.isSlab3Frozen;
      if (this.isSlab3Frozen) {
        this.hud.showBanner('LAKE SLAB C FROZEN');
        this.slab3IceTiles = [];
        for (let sx = z2.slab3.x - 16; sx <= z2.slab3.x + 16; sx += 32) {
          const ice = this.icePlatforms.create(sx, z2.slab3.y, 'tile_ice').refreshBody() as Phaser.GameObjects.Sprite;
          this.slab3IceTiles.push(ice);
        }
        this.cameras.main.flash(150, 0, 240, 255);
      } else {
        this.hud.showBanner('LAKE SLAB C MELTED');
        this.slab3IceTiles.forEach(tile => tile.destroy());
        this.slab3IceTiles = [];
      }
      return;
    }

    // Zone 3: Suspended Water Geyser (Drop Ice Block onto Pressure Plate)
    const z3 = LEVEL1_DATA.zone3;
    if (this.player.x >= z3.suspendedWater.triggerRange[0] && this.player.x <= z3.suspendedWater.triggerRange[1]) {
      if (!this.hasDroppedIceBlock) {
        this.hasDroppedIceBlock = true;
        this.hud.showBanner('SUSPENDED AQUIFER FROZEN — HEAVY MASS DROPPING!');
        this.cameras.main.flash(200, 0, 240, 255);

        const block = this.physics.add.sprite(z3.suspendedWater.x, z3.suspendedWater.y + 16, 'ice_block_heavy');
        this.droppedIceBlock = block;
        block.setCollideWorldBounds(true);
        block.setBounce(0.02);
        (block.body as Phaser.Physics.Arcade.Body).setGravityY(700);
        (block.body as Phaser.Physics.Arcade.Body).setVelocityX(0);

        // Player can stand firmly on the ice block
        this.physics.add.collider(this.player, block, () => {
          this.isOnIce = true;
        });

        this.physics.add.collider(block, this.platforms);
        if (this.pressurePlateSprite) {
          this.physics.add.collider(block, this.pressurePlateSprite, () => this.triggerPressurePlate());
          this.physics.add.overlap(block, this.pressurePlateSprite, () => this.triggerPressurePlate());
        }
      }
      return;
    }

    // Zone 3: Melt Ice Barrier 2
    if (this.player.x >= z3.iceBarrier2.triggerRange[0] && this.player.x <= z3.iceBarrier2.triggerRange[1]) {
      this.meltBarrier2();
      return;
    }

    // Zone 4: Slippery Runway Unfreezing / Freezing (on or near the runway)
    const z4 = LEVEL1_DATA.zone4;
    if (
      this.player.x >= z4.iceRunway.triggerRange[0] &&
      this.player.x <= z4.iceRunway.triggerRange[1] &&
      this.player.y >= 100 &&
      this.player.y <= 320
    ) {
      this.isRunwayFrozen = !this.isRunwayFrozen;
      if (!this.isRunwayFrozen) {
        // Unfreeze: Ice melts into water
        this.hud.showBanner('RUNWAY ICE UNFROZEN — THAWED INTO FREEZING WATER!');
        AudioManager.playStaffUse();
        this.cameras.main.flash(150, 0, 119, 182);

        // Remove ice tiles with steam particles
        this.runwayIceTiles.forEach(tile => {
          this.add.particles(tile.x, tile.y, 'proto_tile', {
            speedY: { min: -35, max: -10 }, scale: { start: 0.25, end: 0 },
            tint: [0xade8f4, 0x00f0ff], lifespan: 400, quantity: 6
          }).setDepth(15);
          tile.destroy();
        });
        this.runwayIceTiles = [];

        // Create water tiles in place of the ice
        for (let x = z4.iceRunway.startX; x <= z4.iceRunway.endX; x += 32) {
          const water = this.waterTiles.create(x, z4.iceRunway.y + 6, 'tile_water').refreshBody() as Phaser.Physics.Arcade.Sprite;
          (water as Phaser.GameObjects.Sprite).setAlpha(0.85);
          this.runwayWaterTiles.push(water);
        }
      } else {
        // Re-freeze: Water turns back into ice platform
        this.hud.showBanner('RUNWAY WATER RE-FROZEN — ICE RUNWAY RESTORED!');
        AudioManager.playStaffUse();
        this.cameras.main.flash(150, 0, 240, 255);

        // Remove water tiles
        this.runwayWaterTiles.forEach(w => w.destroy());
        this.runwayWaterTiles = [];

        // Re-create ice tiles
        for (let x = z4.iceRunway.startX; x <= z4.iceRunway.endX; x += 32) {
          const ice = this.icePlatforms.create(x, z4.iceRunway.y, 'tile_ice').refreshBody() as Phaser.Physics.Arcade.Sprite;
          this.runwayIceTiles.push(ice);
        }
      }
      return;
    }

    // Zone 4: Timed Door
    if (this.player.x >= z4.timedDoor.triggerRange[0] && this.player.x <= z4.timedDoor.triggerRange[1]) {
      this.meltTimedDoor();
      return;
    }
  }

  // ── Zone 2: Frozen Lake Builder ────────────────────────────────────────

  private buildZone2FrozenLake(): void {
    const z2 = LEVEL1_DATA.zone2;
    // Water tiles for the lake channel
    for (let x = z2.lake.startX; x <= z2.lake.endX; x += 32) {
      const water = this.waterTiles.create(x, z2.lake.waterY, 'tile_water').refreshBody();
      (water as Phaser.GameObjects.Sprite).setAlpha(0.9);
      this.waterTiles.create(x, z2.lake.waterY + 24, 'tile_water').refreshBody();
    }

    // Glowing cyan floor spikes beneath the lake
    for (let x = 1480; x <= 1790; x += 22) {
      const spike = this.hazards.create(x, z2.lake.spikeY, 'hazard_icicle') as Phaser.Physics.Arcade.Sprite;
      spike.refreshBody();
      (spike.body as Phaser.Physics.Arcade.StaticBody).setSize(6, 12);
      (spike.body as Phaser.Physics.Arcade.StaticBody).setOffset(8, 0);
    }

    // Solid Center Island in the lake
    for (let x = z2.centerIsland.startX; x <= z2.centerIsland.endX; x += 32) {
      this.platforms.create(x, z2.centerIsland.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z2.centerIsland.y + 32, 'proto_tile').refreshBody();
    }

    // Decoy water alcove beneath entry bank
    const decoyPuddle = this.waterTiles.create(z2.decoyValve.x, z2.decoyValve.y, 'tile_water').refreshBody();
    (decoyPuddle as Phaser.GameObjects.Sprite).setAlpha(0.85);

    // Decorative labels & signposts
    this.add.text(1450, 192, 'ZONE 2: FROZEN LAKE\nSELECTIVE SLAB CONVERSION', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#070b14',
      padding: { x: 4, y: 2 }
    });
    this.add.text(z2.slab1.x - 16, z2.slab1.y - 18, 'SLAB A', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#48cae4',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.add.text(z2.slab2Trap.x - 24, z2.slab2Trap.y - 18, '⚠ LOW SLAB B', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff6b35',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.add.text(z2.slab3.x - 16, z2.slab3.y - 18, 'SLAB C', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#48cae4',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.add.text(z2.decoyValve.x - 28, z2.decoyValve.y - 20, 'DECOY RESERVOIR', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#bde0fe',
      stroke: '#040711',
      strokeThickness: 2
    });
  }

  // ── Zone 3: Ice Cave Builder ───────────────────────────────────────────

  private buildZone3IceCave(
    crystals: Array<{ sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number }>,
    conduits: Phaser.Physics.Arcade.Sprite[]
  ): void {
    const z3 = LEVEL1_DATA.zone3;

    // ── Zone 3 Solid Cavern Ceiling (Enclosing the Ice Cave) ──
    // Solid rock filling from y=0 down to y=120, EXCEPT at the vertical puzzle shaft (x=1910..1980)
    for (let x = 1840; x <= 2360; x += 32) {
      if (x >= 1910 && x <= 1980) {
        // Vertical shaft: roof is high up at y=24 so block has room to drop
        this.platforms.create(x, 24, 'proto_tile').refreshBody();
      } else {
        this.platforms.create(x, 24, 'proto_tile').refreshBody();
        this.platforms.create(x, 56, 'proto_tile').refreshBody();
        this.platforms.create(x, 88, 'proto_tile').refreshBody();
        this.platforms.create(x, 120, 'proto_tile').refreshBody();
      }
    }

    // ── Entrance Corridor & Puzzle Chamber Floor ──
    // Left entrance platform: ends at x = 1884 (right edge at x = 1900)
    for (let x = z3.entrancePlatform.startX; x <= 1884; x += 32) {
      this.platforms.create(x, z3.entrancePlatform.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z3.entrancePlatform.y + 32, 'proto_tile').refreshBody();
    }
    // Right threshold platform: starts at x = 2000 (left edge at x = 1984) up to Cryo-Barrier 1
    for (let x = 2000; x <= z3.entrancePlatform.endX; x += 32) {
      this.platforms.create(x, z3.entrancePlatform.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z3.entrancePlatform.y + 32, 'proto_tile').refreshBody();
    }

    // ── Upper Maintenance Gantry (Elevated Ledge before the Shaft) ──
    // Placed at x = 1860..1892 so it does not encroach into the shaft
    for (let x = z3.gantry.startX; x <= z3.gantry.endX; x += 32) {
      this.platforms.create(x, z3.gantry.y, 'tile_snow_top').refreshBody();
    }
    // Gantry support strut
    const gantryStrut = this.add.rectangle(1862, 222, 4, 54, 0x1a2638);
    gantryStrut.setStrokeStyle(1, 0x00f0ff, 0.4);

    // Mid-level checkpoint crystal #2 (before Zone 3)
    const cp2 = this.spawnCheckpointCrystal(z3.checkpoint.x, z3.checkpoint.y);
    crystals.push(cp2);

    // Extra Refill Crystal #1 (Conduit #3 on the upper gantry)
    const cond3 = this.spawnEnergyConduit(z3.refillCrystal1.x, z3.refillCrystal1.y);
    conduits.push(cond3);

    // ── Dedicated Hydraulic Pressure Shaft & Lock Mechanism ──
    // Guide rails framing the vertical shaft (framed wide at x=1904 and x=1984)
    const railLeft = this.add.rectangle(1904, 140, 4, 180, 0x1f3554);
    railLeft.setStrokeStyle(1, 0x48cae4, 0.5);
    const railRight = this.add.rectangle(1984, 140, 4, 180, 0x1f3554);
    railRight.setStrokeStyle(1, 0x48cae4, 0.5);

    // Recessed socket floor tile for pressure plate (recessed to y=260, surface at y=244)
    this.platforms.create(z3.pressurePlate.x, 260, 'proto_tile').refreshBody();

    // Mechanical Pressure Plate resting firmly on top of the socket floor
    this.pressurePlateSprite = this.physics.add.sprite(z3.pressurePlate.x, z3.pressurePlate.y, 'plate_mechanism');
    this.pressurePlateSprite.setImmovable(true);
    (this.pressurePlateSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.add.text(z3.pressurePlate.x - 38, z3.pressurePlate.y + 8, 'PRESSURE LOCK', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd166',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 1 }
    });

    // Glowing cyan conduit cable running along the floor from pressure plate to Barrier 1
    const cable = this.add.rectangle(1975, 242, 48, 2, 0x00f0ff);
    cable.setAlpha(0.65);
    this.tweens.add({ targets: cable, alpha: 0.9, yoyo: true, repeat: -1, duration: 600 });

    // Suspended Aquifer pipe overhead at the top of the shaft
    const pipe = this.add.rectangle(z3.suspendedWater.x, z3.suspendedWater.y - 14, 18, 26, 0x1a2638);
    pipe.setStrokeStyle(1.5, 0x00f0ff);
    this.add.particles(z3.suspendedWater.x, z3.suspendedWater.y, 'proto_tile', {
      speedY: { min: 25, max: 55 },
      scale: { start: 0.15, end: 0 },
      alpha: { start: 0.8, end: 0.1 },
      tint: [0x00f0ff, 0x48cae4],
      lifespan: 450,
      frequency: 250
    }).setDepth(5);
    this.add.text(z3.suspendedWater.x - 48, z3.suspendedWater.y - 34, 'SUSPENDED AQUIFER\n[E/J] FREEZE MASS', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    });

    // ── Cryo-Barrier 1 (Impenetrable floor-to-ceiling pillar, 24x130) ──
    this.iceBarrier1Sprite = this.physics.add.sprite(z3.iceBarrier1.x, z3.iceBarrier1.y, 'ice_barrier');
    this.iceBarrier1Sprite.setImmovable(true);
    (this.iceBarrier1Sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.add.text(z3.iceBarrier1.x - 30, z3.iceBarrier1.y - 75, 'CRYO-BARRIER 1\n[LOCKED]', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    });

    // ── Cavern Hazard Section (Spikes, Crumbling Platforms, Hazards) ──
    for (let x = z3.floorSpikes.startX; x <= z3.floorSpikes.endX; x += z3.floorSpikes.step) {
      const spike = this.hazards.create(x, z3.floorSpikes.y, 'hazard_icicle') as Phaser.Physics.Arcade.Sprite;
      spike.refreshBody();
      (spike.body as Phaser.Physics.Arcade.StaticBody).setSize(6, 12);
      (spike.body as Phaser.Physics.Arcade.StaticBody).setOffset(8, 0);
    }

    z3.crumbling.forEach(c => {
      this.spawnCrumblingSection(c.startX, c.y, c.count);
    });

    this.movingHazard = this.physics.add.sprite(z3.movingHazard.x, z3.movingHazard.startY, 'frost_hazard');
    this.movingHazard.setImmovable(true);
    (this.movingHazard.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({
      targets: this.movingHazard,
      y: z3.movingHazard.endY,
      ease: 'Sine.easeInOut',
      duration: z3.movingHazard.duration,
      yoyo: true,
      repeat: -1
    });

    // Falling Icicles anchored to the cavern ceiling
    z3.fallingIcicles.forEach(icicleData => {
      const sprite = this.physics.add.sprite(icicleData.x, icicleData.y, 'falling_icicle');
      sprite.setImmovable(true);
      (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.fallingIcicles.push({
        sprite,
        triggerDist: icicleData.triggerDist,
        state: 'idle'
      });
    });

    // ── Cavern Exit Platform & Frost Bulwark (Barrier 2) ──
    for (let x = z3.exitPlatform.startX; x <= z3.exitPlatform.endX; x += 32) {
      this.platforms.create(x, z3.exitPlatform.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z3.exitPlatform.y + 32, 'proto_tile').refreshBody();
    }

    // Ice Barrier 2 (Frost Bulwark — floor-to-ceiling pillar, 24x130)
    this.iceBarrier2Sprite = this.physics.add.sprite(z3.iceBarrier2.x, z3.iceBarrier2.y, 'ice_barrier');
    this.iceBarrier2Sprite.setImmovable(true);
    (this.iceBarrier2Sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.add.text(z3.iceBarrier2.x - 26, z3.iceBarrier2.y - 75, 'FROST BULWARK\n[E/J] MELT', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff6b35',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    });
  }

  // ── Zone 4: Buried Facility Approach Builder ───────────────────────────

  private buildZone4FacilityApproach(conduits: Phaser.Physics.Arcade.Sprite[]): void {
    const z4 = LEVEL1_DATA.zone4;

    // Entrance Platform
    for (let x = z4.entrancePlatform.startX; x <= z4.entrancePlatform.endX; x += 32) {
      this.platforms.create(x, z4.entrancePlatform.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z4.entrancePlatform.y + 32, 'proto_tile').refreshBody();
    }

    // Extra Refill Crystal #2 (Conduit #4)
    const cond4 = this.spawnEnergyConduit(z4.refillCrystal2.x, z4.refillCrystal2.y);
    conduits.push(cond4);

    // Slippery Ice Runway
    this.isRunwayFrozen = true;
    this.runwayIceTiles = [];
    this.runwayWaterTiles = [];
    for (let x = z4.iceRunway.startX; x <= z4.iceRunway.endX; x += 32) {
      const ice = this.icePlatforms.create(x, z4.iceRunway.y, 'tile_ice').refreshBody() as Phaser.Physics.Arcade.Sprite;
      this.runwayIceTiles.push(ice);
    }

    // Spikes at end of slippery run
    for (let x = z4.spikes.startX; x <= z4.spikes.endX; x += z4.spikes.step) {
      const spike = this.hazards.create(x, z4.spikes.y, 'hazard_icicle') as Phaser.Physics.Arcade.Sprite;
      spike.refreshBody();
      (spike.body as Phaser.Physics.Arcade.StaticBody).setSize(6, 12);
      (spike.body as Phaser.Physics.Arcade.StaticBody).setOffset(8, 0);
    }
    this.add.text(z4.iceRunway.startX + 10, z4.iceRunway.y - 20, 'SLIPPERY RUNWAY ⚠ JUMP BEFORE SPIKES', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff4444',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Wide Approach & Airlock Floor Platform (Level 240 floor, seamless running transition) ──
    for (let x = z4.approachPlatform.startX; x <= z4.doorwayFloor.endX; x += 32) {
      this.platforms.create(x, 240, 'tile_snow_top').refreshBody();
      this.platforms.create(x, 272, 'proto_tile').refreshBody();
    }

    // ── Buried Facility Bunker Wall (Completely blocks jumping over the door) ──
    // Solid reinforced bunker wall filling from y=0 down to y=120 across x=2650..2700
    for (let x = z4.bunkerWall.startX; x <= z4.bunkerWall.endX; x += 32) {
      this.platforms.create(x, 24, 'proto_tile').refreshBody();
      this.platforms.create(x, 56, 'proto_tile').refreshBody();
      this.platforms.create(x, 88, 'proto_tile').refreshBody();
      this.platforms.create(x, 120, 'proto_tile').refreshBody();
    }

    // Bunker sign above doorway
    this.add.text(z4.timedDoor.x - 44, 138, 'FACILITY AIRLOCK', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 1 }
    });

    // Timed Ice Door (Fills the opening from y=134 to y=226, 24x92)
    this.timedDoorSprite = this.physics.add.sprite(z4.timedDoor.x, z4.timedDoor.y, 'timed_ice_door');
    this.timedDoorSprite.setImmovable(true);
    (this.timedDoorSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.add.text(z4.timedDoor.x - 32, z4.timedDoor.y - 56, 'TIMED CRYO-LOCK\n[E/J] MELT (4.5s)', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd166',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    });

    // Final Exit Platform
    for (let x = z4.exitPlatform.startX; x <= z4.exitPlatform.endX; x += 32) {
      this.platforms.create(x, z4.exitPlatform.y, 'tile_snow_top').refreshBody();
      this.platforms.create(x, z4.exitPlatform.y + 32, 'proto_tile').refreshBody();
    }

    // Failsafe Component #02 (relocated to end of Zone 4)
    const shelf = this.add.rectangle(z4.failsafe2.shelfX, z4.failsafe2.shelfY, 48, 8, 0x1f3554);
    shelf.setStrokeStyle(1, 0xffd166);
    const fs2 = this.physics.add.sprite(z4.failsafe2.spriteX, z4.failsafe2.spriteY, 'failsafe_component');
    fs2.setImmovable(true);
    (fs2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: fs2, y: z4.failsafe2.spriteY - 5, yoyo: true, repeat: -1, duration: 1000, ease: 'Sine.easeInOut' });
    this.add.text(z4.failsafe2.spriteX - 33, z4.failsafe2.spriteY - 25, 'FAILSAFE 02', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#040711',
      strokeThickness: 2
    });
    // Small jump platform to reach shelf
    this.platforms.create(z4.failsafe2.shelfX, z4.failsafe2.shelfY + 8, 'tile_snow_top').refreshBody();
    this.failsafeItems.push(fs2);

    // Relocated Exit Portal
    const portalGfx = this.make.graphics({ x: 0, y: 0 });
    portalGfx.fillStyle(0x70e000, 0.9);
    portalGfx.fillCircle(16, 24, 16);
    portalGfx.lineStyle(2, 0xffffff, 1);
    portalGfx.strokeCircle(16, 24, 16);
    portalGfx.generateTexture('exit_portal', 32, 48);
    portalGfx.destroy();

    this.exitPortal = this.add.sprite(z4.exitPortal.x, z4.exitPortal.y, 'exit_portal');
    this.tweens.add({ targets: this.exitPortal, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 800 });
    this.add.text(z4.exitPortal.x - 50, z4.exitPortal.y - 45, 'EXIT GATE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#70e000',
      stroke: '#040711',
      strokeThickness: 2
    });
  }

  // ── Procedural Textures for Extended Zones ─────────────────────────────

  private ensureZoneTextures(): void {
    if (!this.textures.exists('plate_mechanism')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a2638, 1);
      gfx.fillRect(0, 4, 24, 4);
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(4, 2, 16, 2);
      gfx.fillStyle(0xffd166, 1);
      gfx.fillRect(8, 0, 8, 2);
      gfx.generateTexture('plate_mechanism', 24, 8);
      gfx.destroy();
    }

    if (!this.textures.exists('ice_block_heavy')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00b4d8, 0.85);
      gfx.fillRect(0, 0, 24, 24);
      gfx.fillStyle(0xade8f4, 0.6);
      gfx.fillRect(2, 2, 20, 20);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(4, 4, 8, 3);
      gfx.lineStyle(1.5, 0x00f0ff, 1);
      gfx.strokeRect(1, 1, 22, 22);
      gfx.generateTexture('ice_block_heavy', 24, 24);
      gfx.destroy();
    }

    if (!this.textures.exists('ice_barrier')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Impenetrable cryo-barrier spanning ceiling to floor (24x130)
      gfx.fillStyle(0x0077b6, 0.9);
      gfx.fillRect(0, 0, 24, 130);
      gfx.fillStyle(0x00b4d8, 0.7);
      gfx.fillRect(2, 2, 20, 126);
      gfx.fillStyle(0xcaf0f8, 0.85);
      gfx.fillRect(5, 6, 6, 118);
      // Crystalline frost fracture patterns
      gfx.lineStyle(1.5, 0xffffff, 0.8);
      gfx.lineBetween(4, 20, 20, 45);
      gfx.lineBetween(20, 45, 6, 70);
      gfx.lineBetween(6, 70, 18, 95);
      gfx.lineBetween(18, 95, 4, 115);
      // Top and bottom heavy steel/cryo anchor brackets
      gfx.fillStyle(0x1a2638, 1);
      gfx.fillRect(0, 0, 24, 8);
      gfx.fillRect(0, 122, 24, 8);
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(2, 6, 20, 2);
      gfx.fillRect(2, 122, 20, 2);
      gfx.lineStyle(2, 0x00f0ff, 0.95);
      gfx.strokeRect(0, 0, 24, 130);
      gfx.generateTexture('ice_barrier', 24, 130);
      gfx.destroy();
    }

    if (!this.textures.exists('frost_hazard')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00b4d8, 1);
      gfx.fillTriangle(11, 0, 18, 11, 4, 11);
      gfx.fillTriangle(11, 22, 18, 11, 4, 11);
      gfx.fillTriangle(0, 11, 11, 4, 11, 18);
      gfx.fillTriangle(22, 11, 11, 4, 11, 18);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(11, 11, 4);
      gfx.generateTexture('frost_hazard', 22, 22);
      gfx.destroy();
    }

    if (!this.textures.exists('falling_icicle')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00b4d8, 1);
      gfx.fillTriangle(0, 0, 14, 0, 7, 30);
      gfx.fillStyle(0xcaf0f8, 0.8);
      gfx.fillTriangle(3, 0, 11, 0, 7, 24);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(6, 2, 2, 8);
      gfx.generateTexture('falling_icicle', 14, 30);
      gfx.destroy();
    }

    if (this.textures.exists('timed_ice_door')) {
      this.textures.remove('timed_ice_door');
    }
    if (!this.textures.exists('timed_ice_door')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      // Reinforced bunker cryogenic blast door (24x92)
      gfx.fillStyle(0x03045e, 0.95);
      gfx.fillRect(0, 0, 24, 92);
      gfx.fillStyle(0x0096c7, 0.75);
      gfx.fillRect(2, 2, 20, 88);
      // Diagonal warning hazard stripes
      gfx.lineStyle(2, 0xffd166, 0.85);
      gfx.lineBetween(4, 16, 20, 32);
      gfx.lineBetween(4, 36, 20, 52);
      gfx.lineBetween(4, 56, 20, 72);
      gfx.lineBetween(4, 76, 20, 88);
      // Cryogenic lock core in center
      gfx.fillStyle(0x1f3554, 1);
      gfx.fillRect(4, 38, 16, 16);
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(7, 41, 10, 10);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(9, 43, 6, 6);
      // Steel outer frame
      gfx.lineStyle(2, 0x48cae4, 0.95);
      gfx.strokeRect(1, 1, 22, 90);
      gfx.generateTexture('timed_ice_door', 24, 92);
      gfx.destroy();
    }
  }

  // ── Puzzle Interaction Handlers ────────────────────────────────────────

  private triggerPressurePlate(): void {
    if (this.isPressurePlatePressed) return;
    this.isPressurePlatePressed = true;
    AudioManager.playCheckpoint();
    this.hud.showBanner('HYDRAULIC PRESSURE ENGAGED — CRYO-BARRIER BREACHED!');
    this.cameras.main.flash(150, 0, 240, 255);
    this.cameras.main.shake(150, 0.008);
    if (this.pressurePlateSprite) {
      this.pressurePlateSprite.y += 3;
      this.pressurePlateSprite.setTint(0x00f0ff);
    }

    // Lock the ice block firmly in place so the player can stand solidly on it
    if (this.droppedIceBlock && this.droppedIceBlock.active) {
      this.droppedIceBlock.setImmovable(true);
      const bBody = this.droppedIceBlock.body as Phaser.Physics.Arcade.Body;
      if (bBody) {
        bBody.setAllowGravity(false);
        bBody.setVelocity(0, 0);
      }
    }
    // Dissolve Barrier 1
    if (this.iceBarrier1Sprite && !this.isBarrier1Destroyed) {
      this.isBarrier1Destroyed = true;
      // Rule: Destroy colliders before destroying their sprites
      if (this.iceBarrier1Collider) {
        this.physics.world.removeCollider(this.iceBarrier1Collider);
        this.iceBarrier1Collider = undefined;
      }
      this.add.particles(this.iceBarrier1Sprite.x, this.iceBarrier1Sprite.y, 'proto_tile', {
        speed: { min: 40, max: 100 }, scale: { start: 0.35, end: 0 },
        tint: [0x00f0ff, 0x48cae4, 0xffffff], lifespan: 600, quantity: 24
      }).setDepth(15);
      this.iceBarrier1Sprite.destroy();
      this.iceBarrier1Sprite = undefined;
    }
  }

  private meltBarrier2(): void {
    if (this.isBarrier2Melted || !this.iceBarrier2Sprite) return;
    this.isBarrier2Melted = true;
    AudioManager.playStaffUse();
    this.hud.showBanner('FROST BULWARK MELTED — PASSAGE OPEN!');
    this.cameras.main.flash(150, 0, 119, 182);
    // Rule: Destroy colliders before destroying their sprites
    if (this.iceBarrier2Collider) {
      this.physics.world.removeCollider(this.iceBarrier2Collider);
      this.iceBarrier2Collider = undefined;
    }
    this.add.particles(this.iceBarrier2Sprite.x, this.iceBarrier2Sprite.y, 'proto_tile', {
      speedY: { min: 20, max: 70 }, scale: { start: 0.25, end: 0 },
      tint: [0x0096c7, 0x00f0ff], lifespan: 600, quantity: 18
    }).setDepth(15);
    this.iceBarrier2Sprite.destroy();
    this.iceBarrier2Sprite = undefined;
  }

  private meltTimedDoor(): void {
    if (this.isTimedDoorOpen || !this.timedDoorSprite) return;
    this.isTimedDoorOpen = true;
    AudioManager.playStaffUse();
    this.hud.showBanner('CRYO-LOCK MELTED! RUN! (4.5s)');
    this.cameras.main.flash(150, 0, 180, 220);
    if (this.timedDoorCollider) {
      this.timedDoorCollider.active = false;
    }
    // Disable body so player can pass through
    (this.timedDoorSprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.tweens.add({ targets: this.timedDoorSprite, alpha: 0.15, duration: 250 });

    if (this.timedDoorTimer) {
      this.timedDoorTimer.remove();
    }

    this.timedDoorTimer = this.time.delayedCall(LEVEL1_DATA.zone4.timedDoor.durationMs, () => {
      this.isTimedDoorOpen = false;
      if (this.timedDoorSprite) {
        if (this.timedDoorCollider) {
          this.timedDoorCollider.active = true;
        }
        (this.timedDoorSprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        this.tweens.add({ targets: this.timedDoorSprite, alpha: 1, duration: 300 });
        this.cameras.main.shake(120, 0.008);
        this.hud.showBanner('CRYO-LOCK RE-FROZEN!');
      }
    });
  }

  private shatterFallingIcicle(item: {
    sprite: Phaser.Physics.Arcade.Sprite;
    collider?: Phaser.Physics.Arcade.Collider;
    overlapCollider?: Phaser.Physics.Arcade.Collider;
    state: string;
  }): void {
    if (item.state === 'destroyed') return;
    item.state = 'destroyed';
    // Rule: Destroy colliders before destroying their sprites
    if (item.collider) {
      this.physics.world.removeCollider(item.collider);
      item.collider = undefined;
    }
    if (item.overlapCollider) {
      this.physics.world.removeCollider(item.overlapCollider);
      item.overlapCollider = undefined;
    }
    this.add.particles(item.sprite.x, item.sprite.y, 'proto_tile', {
      speed: { min: 20, max: 60 }, scale: { start: 0.2, end: 0 },
      tint: [0x00f0ff, 0x48cae4], lifespan: 400, quantity: 8
    }).setDepth(15);
    item.sprite.destroy();
  }

  // ── Failsafe Collection ────────────────────────────────────────────────
  // levelFailsafeTotal: how many failsafes exist in Sector 1
  private readonly levelFailsafeTotal = 2;

  private collectFailsafeComponent(item: Phaser.Physics.Arcade.Sprite): void {
    if (!item.active) return; // already collected
    item.setActive(false).setVisible(false);
    (item.body as Phaser.Physics.Arcade.Body).enable = false;

    this.failsafeCollected++;
    this.checkpointX = Math.round(item.x);
    this.checkpointY = Math.round(item.y) - 30;

    // Particle burst
    const emitter = this.add.particles(item.x, item.y, 'failsafe_component', {
      speed: { min: 40, max: 120 }, scale: { start: 0.4, end: 0 }, lifespan: 700, quantity: 14
    });
    this.time.delayedCall(800, () => emitter.destroy());

    this.hud.setFailsafeFound(this.failsafeCollected, 5);
    this.player.restoreStaffCharges(2);
    this.hud.updateCharges(this.player.staffCharges);
    AudioManager.playFailsafe();

    // Unlock exit once all level failsafes are collected
    if (this.failsafeCollected >= this.levelFailsafeTotal) {
      this.hasRecoveredComponent = true;
      this.hud.showBanner('ALL SECTOR FAILSAFES RECOVERED — EXIT UNLOCKED!');
      this.cameras.main.flash(300, 0, 240, 80);
      // Activate exit portal pulsing tint
      if (this.exitPortal) {
        this.tweens.add({ targets: this.exitPortal, tint: 0xffd166, duration: 400, yoyo: true, repeat: -1 });
      }
    }
  }

  // ── Hazard / Death ─────────────────────────────────────────────────────

  private handleHazardCollision(reason = 'COLLISION HAZARD'): void {
    if (this.isRespawning || this.isLeavingScene) return;
    this.isRespawning = true;
    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    this.hud.showBanner(`CRITICAL CORRUPTION: ${reason}`);
    AudioManager.playDeath();
    this.cameras.main.shake(300, 0.018);
    this.cameras.main.flash(100, 180, 0, 0);

    this.time.delayedCall(700, () => {
      this.physics.pause();

      const callbacks: GameOverCallbacks = {
        onRespawn: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.player.restoreIntegrity();
          this.player.respawnAt(this.checkpointX, this.checkpointY);
          this.player.restoreStaffCharges(this.player.maxStaffCharges);
          this.hud.updateIntegrity(this.player.integrity);
          this.hud.updateCharges(this.player.staffCharges);
          this.cameras.main.fadeIn(400, 0, 0, 0);
          this.isRespawning = false;
          this.isLeavingScene = false;
        },
        onRestart: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.isRespawning = false;
          this.isLeavingScene = false;
          this.restartLevelFromBeginning();
        },
        onMainMenu: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.isRespawning = false;
          this.isLeavingScene = false;
          this.physics.resume();
          this.cameras.main.fadeOut(300, 0, 0, 0, () => {
            this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
          });
        }
      };

      this.gameOverScreen = new GameOverScreen(this, callbacks, reason);
    });
  }

  // ── Level Complete ─────────────────────────────────────────────────────

  private handleLevelComplete(): void {
    if (this.isLeavingScene || this.physics.world.isPaused) return;
    this.isLeavingScene = true;
    this.physics.pause();
    this.hud.showBanner(`SECTOR 1 ESCAPED! ${this.failsafeCollected}/5 FAILSAFES RECOVERED.`);
    this.cameras.main.fade(600, 0, 240, 255, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('LevelComplete', {
          failsafeCollected: this.failsafeCollected,
          totalFailsafe: 5,
          deathCount: this.deathCount,
          timeMs: Date.now() - this.levelStartTime
        });
      }
    });
  }

  // ── Staff → Drone Stun ──────────────────────────────────────────────────

  private tryStunNearbyDrones(): void {
    this.drones.forEach(drone => {
      if (drone.droneState === 'stunned') return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, drone.x, drone.y);
      if (dist <= this.STAFF_STUN_RANGE) {
        drone.stun();
        drone.setTexture('drone_stunned');
        AudioManager.playDroneStun();
        this.hud.showBanner('DRONE STUNNED!');

        // Visual freeze burst
        this.add.particles(drone.x, drone.y, 'proto_tile', {
          speed: { min: 20, max: 60 }, scale: { start: 0.3, end: 0 },
          tint: [0x00f0ff, 0x48cae4], lifespan: 500, quantity: 10
        }).setDepth(20);

        // Auto-restore texture when drone recovers
        drone.once('drone_recovered', () => {
          drone.setTexture('drone_active');
        });
      }
    });
  }

  // ── CRT Overlay ────────────────────────────────────────────────────────

  private createScanlineOverlay(): void {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(100).setAlpha(0.07);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    gfx.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < h; y += 3) {
      gfx.lineBetween(0, y, w, y);
    }
  }

  // ── Restart Helper ──────────────────────────────────────────────────

  private restartLevelFromBeginning(): void {
    this.checkpointX = LEVEL1_DATA.spawn.x;
    this.checkpointY = LEVEL1_DATA.spawn.y;
    this.isPaused = false;
    this.physics.resume();
    this.scene.restart();
  }

  // ── Pause ──────────────────────────────────────────────────────────────

  private togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.resumeGame(),
      onCheckpoint: () => {
        this.resumeGame();
        this.player.restoreIntegrity();
        this.player.respawnAt(this.checkpointX, this.checkpointY);
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        this.hud.updateIntegrity(this.player.integrity);
        this.hud.updateCharges(this.player.staffCharges);
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.hud.showBanner('WARPED TO ACTIVE CHECKPOINT');
      },
      onRestart: () => {
        this.resumeGame();
        this.restartLevelFromBeginning();
      },
      onMainMenu: () => {
        this.isPaused = false;
        this.physics.resume();
        this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
      }
    });
  }

  private resumeGame(): void {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.isPaused = false;
    this.physics.resume();
  }
}
