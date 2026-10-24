import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { SentinelDrone } from '../entities/SentinelDrone';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';

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

  // Checkpoint & Progression
  private checkpointX = 60;
  private checkpointY = 260;
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

  // Level boundaries
  private readonly levelWidth = 1600;
  private readonly levelHeight = 360;

  constructor() {
    super(GAME_CONFIG.sceneKeys.Game);
  }

  create(): void {
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);

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
    this.physics.add.overlap(this.player, this.waterTiles, () => {
      if (!this.isWaterFrozen) this.handleHazardCollision('FREEZING WATER SUBMERSION');
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
        if (!drone.isLethal || this.isRespawning) return;
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
    this.levelStartTime = Date.now();
    this.cameras.main.fadeIn(400, 7, 11, 20);
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    if (this.player.isDead && !this.isRespawning) {
      this.handleHazardCollision('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    this.player.update(time, delta);

    // Update sentinel drones
    this.drones.forEach(d => d.update(time, delta, this.player.x, this.player.y));

    // Apply / reset ice friction
    if (this.isOnIce) {
      (this.player.body as Phaser.Physics.Arcade.Body).setDragX(80);
    } else {
      (this.player.body as Phaser.Physics.Arcade.Body).setDragX(1000);
    }
    this.isOnIce = false;

    // Pit / fall death
    if (this.player.y > this.levelHeight + 40 && !this.player.isDead) {
      this.handleHazardCollision('ABYSSAL FALL');
    }

    // Level exit
    if (this.hasRecoveredComponent && this.exitPortal && !this.player.isDead) {
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
      [1580,0, 24, 150],
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
     [1430, 0, 24, 130]].forEach(([sx, sy, w, h]) => {
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
    this.add.text(418, 182, '[E / J]: USE STAFF -> FREEZE WATER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#00f0ff',
      backgroundColor: '#070b14'
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
    this.add.text(570, 280, '⚠ ABYSSAL WATER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#00b4d8'
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
    this.add.text(936, 210, 'FAILSAFE 01', { fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#ffd166' });
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

    // Final exit platform
    for (let x = 1400; x <= 1600; x += 32) {
      this.platforms.create(x, 260, 'tile_snow_top').refreshBody();
      this.platforms.create(x, 292, 'proto_tile').refreshBody();
    }

    // Failsafe Component #02 — on elevated shelf above final platform
    const shelf = this.add.rectangle(1455, 210, 48, 8, 0x1f3554);
    shelf.setStrokeStyle(1, 0xffd166);
    const fs2 = this.physics.add.sprite(1455, 190, 'failsafe_component');
    fs2.setImmovable(true);
    (fs2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: fs2, y: 185, yoyo: true, repeat: -1, duration: 1000, ease: 'Sine.easeInOut' });
    this.add.text(1422, 165, 'FAILSAFE 02', { fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#ffd166' });
    // Small jump platform to reach it
    this.platforms.create(1455, 218, 'tile_snow_top').refreshBody();
    this.platforms.create(1423, 218, 'tile_snow_top').refreshBody();
    this.failsafeItems.push(fs2);

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
    this.add.text(555, 236, '← MOVING PLATFORM →', {
      fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#48cae4'
    });

    // Exit Portal
    const portalGfx = this.make.graphics({ x: 0, y: 0 });
    portalGfx.fillStyle(0x70e000, 0.9);
    portalGfx.fillCircle(16, 24, 16);
    portalGfx.lineStyle(2, 0xffffff, 1);
    portalGfx.strokeCircle(16, 24, 16);
    portalGfx.generateTexture('exit_portal', 32, 48);
    portalGfx.destroy();

    this.exitPortal = this.add.sprite(1520, 220, 'exit_portal');
    this.tweens.add({ targets: this.exitPortal, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 800 });
    this.add.text(1470, 175, 'EXIT GATE', { fontFamily: 'Courier New, monospace', fontSize: '9px', color: '#70e000' });

    // ── Sentinel Drones (Phase 3) ──────────────────────────────────────
    // Drone 1: patrols above the vault platform
    drones.push(new SentinelDrone(this, 850, 250, 790, 1060));
    // Drone 2: patrols the ascending ledges section
    drones.push(new SentinelDrone(this, 1200, 170, 1150, 1310));

    // Danger sign near first drone
    this.add.text(785, 225, '! SENTINEL PATROL ZONE !', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#ff2222',
      backgroundColor: '#070b14'
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
    this.add.text(x - 22, y - 24, 'ENERGY CONDUIT', { fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#70e000' });
    return conduit;
  }

  // ── Checkpoint Crystal ─────────────────────────────────────────────────
  // Returns { sprite, cx, cy }; overlap is registered in create() after player.

  private spawnCheckpointCrystal(x: number, y: number): { sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number } {
    const crystal = this.physics.add.sprite(x, y, 'checkpoint_crystal');
    crystal.setImmovable(true);
    (crystal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    crystal.setData('activated', false);
    this.add.text(x - 24, y - 24, 'CHECKPOINT', { fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#d85ef5' });
    this.tweens.add({ targets: crystal, y: y - 4, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    return { sprite: crystal, cx: x, cy: y };
  }

  // ── Water State Conversion ─────────────────────────────────────────────

  private checkWaterStateConversion(): void {
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
    }
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
    if (this.isRespawning) return;
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
        },
        onRestart: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.isRespawning = false;
          this.physics.resume();
          this.scene.restart();
        },
        onMainMenu: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.isRespawning = false;
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
    if (this.physics.world.isPaused) return;
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

  // ── Pause ──────────────────────────────────────────────────────────────

  private togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.resumeGame(),
      onRestart: () => { this.isPaused = false; this.physics.resume(); this.scene.restart(); },
      onMainMenu: () => { this.isPaused = false; this.physics.resume(); this.scene.start(GAME_CONFIG.sceneKeys.MainMenu); }
    });
  }

  private resumeGame(): void {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.isPaused = false;
    this.physics.resume();
  }
}
