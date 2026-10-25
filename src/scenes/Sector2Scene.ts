import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { Player } from '../entities/Player';
import { SentinelDrone } from '../entities/SentinelDrone';
import { FireJet } from '../entities/FireJet';
import { ThermalVent, ThermalVentType, THERMAL_VENT_CONFIG } from '../entities/ThermalVent';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';

/**
 * Sector2Scene — Heat Age (Bug-fixed version)
 *
 * Key architecture notes:
 *  - fireHazards: SEPARATE static group for FireJet bodies (NOT mixed into general hazards)
 *  - Moving rafts: single tile per raft, refreshBody() called in tween onUpdate
 *  - Lava floor: tiles span entire floor at consistent levelFloorY
 *  - Crumbling ember platforms: registered with collider + time-based crumble
 */
export class Sector2Scene extends Phaser.Scene {
  // Physics groups
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private lavaTiles!: Phaser.Physics.Arcade.StaticGroup;
  private fireHazards!: Phaser.Physics.Arcade.StaticGroup;  // ← separate from any other group
  private emberTiles: Phaser.Physics.Arcade.Sprite[] = [];  // crumbling

  // Entities
  private player!: Player;
  private drones: SentinelDrone[] = [];
  private fireJets: FireJet[] = [];
  private vents: ThermalVent[] = [];
  private raft1!: Phaser.Physics.Arcade.Sprite;
  private raft2!: Phaser.Physics.Arcade.Sprite;
  private raftIndicatorGfx?: Phaser.GameObjects.Graphics;
  private failsafeItems: Phaser.Physics.Arcade.Sprite[] = [];
  private exitPortal?: Phaser.GameObjects.Graphics;

  // UI / state
  private hud!: HUD;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private isPaused = false;
  private isLeavingScene = false;
  private checkpointX = 60;
  private checkpointY = 268;
  private failsafeCollected = 0;
  private hasRecoveredAll = false;
  private deathCount = 0;
  private levelStartTime = 0;
  private staffStunRange = 90;
  private isRespawning = false;

  // Level dimensions — floor at y=330 (lava surface)
  private readonly levelWidth  = 3760;
  private readonly levelHeight = 420;
  private readonly floorY      = 330; // lava surface y

  constructor() { super('Sector2Scene'); }

  create(): void {
    // Reset all per-run state so stale entities/menus do not survive scene.restart()
    this.fireJets = [];
    this.failsafeItems = [];
    this.emberTiles = [];
    this.vents = [];
    this.drones = [];
    this.exitPortal = undefined;
    this.failsafeCollected = 0;
    this.hasRecoveredAll = false;
    this.deathCount = 0;
    this.checkpointX = 60;
    this.checkpointY = 268;
    this.isPaused = false;
    this.isRespawning = false;
    this.isLeavingScene = false;
    this.pauseMenu = null;
    this.gameOverScreen = null;
    this.raftIndicatorGfx?.destroy();
    this.raftIndicatorGfx = this.add.graphics().setDepth(12);

    // Generate all textures first
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);

    // Physics world extended vertically to catch falling players
    this.physics.world.setBounds(0, 0, this.levelWidth, 800);

    // Create hell background
    this.createHellBackground();

    // Physics groups
    this.platforms    = this.physics.add.staticGroup();
    this.lavaTiles    = this.physics.add.staticGroup();
    this.fireHazards  = this.physics.add.staticGroup();

    // Player (spawns above entry platform)
    this.player = new Player(this, 60, 268);

    // Build level — returns collideable arrays
    const { conduits, crystals, drones } = this.buildLevel();
    this.drones = drones;

    // ── Colliders & Overlaps ───────────────────────────────────────────
    // Player stands on platforms
    this.physics.add.collider(this.player, this.platforms, (_player, tile) => {
      this.handleEmberContact(tile as Phaser.Physics.Arcade.Sprite);
    });

    // Lava = instant death
    this.physics.add.overlap(this.player, this.lavaTiles, () => {
      if (!this.isRespawning) this.handleDeath('LAVA SUBMERSION');
    });

    // Fire jets (SEPARATE group — integrity-aware)
    this.physics.add.overlap(this.player, this.fireHazards, (_p, body) => {
      const jetSprite = body as Phaser.Physics.Arcade.Sprite;
      if (!jetSprite.active || this.isRespawning) return;
      const lethal = this.player.takeDamage();
      if (lethal || this.player.integrity <= 0 || this.player.isDead) {
        this.handleDeath('FIRE JET INCINERATION');
      } else {
        AudioManager.playDeath();
        this.cameras.main.shake(150, 0.012);
        this.cameras.main.flash(80, 255, 80, 0);
        this.hud.showBanner(`INTEGRITY BREACH — ${this.player.integrity} HP REMAINING`);
      }
    });

    // Drone contact
    drones.forEach(drone => {
      this.physics.add.overlap(this.player, drone, () => {
        if (!drone.isLethal || this.isRespawning) return;
        const lethal = this.player.takeDamage();
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleDeath('EMBER DRONE CONTACT');
        } else {
          AudioManager.playDeath();
          this.cameras.main.shake(150, 0.012);
          this.cameras.main.flash(80, 220, 60, 0);
          this.hud.showBanner(`INTEGRITY BREACH — ${this.player.integrity} HP REMAINING`);
        }
      });
    });

    // Conduits
    conduits.forEach(c => {
      this.physics.add.overlap(this.player, c, () => {
        if (c.getData('used')) return;
        c.setData('used', true);
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        this.hud.updateCharges(this.player.staffCharges);
        this.hud.showBanner('STAFF ENERGY RECHARGED!');
        AudioManager.playConduitRecharge();
        this.cameras.main.flash(120, 255, 80, 0);
        c.setAlpha(0.25).setTint(0x444444);
        this.time.delayedCall(12000, () => {
          c.setData('used', false);
          c.clearTint().setAlpha(1);
        });
      });
    });

    // Checkpoint crystals
    crystals.forEach(({ sprite, cx, cy }) => {
      this.physics.add.overlap(this.player, sprite, () => {
        if (sprite.getData('activated')) return;
        sprite.setData('activated', true);
        this.checkpointX = cx; this.checkpointY = cy - 30;
        sprite.setTexture('checkpoint_active');
        this.cameras.main.flash(200, 255, 100, 0);
        AudioManager.playCheckpoint();
        this.hud.showBanner('CHECKPOINT ACTIVATED');
      });
    });

    // Failsafe pickups
    this.failsafeItems.forEach(item => {
      this.physics.add.overlap(this.player, item, () => this.collectFailsafe(item));
    });

    // Camera
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(40, 20);

    // HUD — orange/red accent for Heat Age
    this.hud = new HUD(this, 'SECTOR 2  ·  HEAT AGE', 0xff6b00);
    this.hud.updateCharges(this.player.staffCharges);
    this.hud.updateIntegrity(this.player.integrity);

    // Audio
    AudioManager.init();
    AudioManager.startMatrixMusic();

    // Player events
    this.player.on('staff_used', (chargesLeft: number) => {
      this.hud.updateCharges(chargesLeft);
      AudioManager.playStaffUse();
      // Handle thermal vent control (ignites nearest dormant vent, or falls back to stun)
      this.handleStaffUse();
    });
    this.player.on('staff_empty', () => {
      this.hud.showBanner('STAFF DEPLETED — FIND A HEAT CONDUIT!');
    });
    this.player.on('player_damaged', (integrity: number) => {
      this.hud.updateIntegrity(integrity);
    });
    this.player.on('player_respawn', () => {
      this.hud.updateCharges(this.player.staffCharges);
      this.hud.updateIntegrity(this.player.integrity);
    });
    this.player.on('player_jump', () => AudioManager.playJump());
    this.player.on('player_land', () => AudioManager.playLand());

    // Pause key & HUD Home Button
    this.hud.onPauseClicked(() => this.togglePause());
    if (this.input.keyboard) {
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.togglePause());
    }

    this.addScanlines();
    this.levelStartTime = Date.now();
    this.cameras.main.fadeIn(500, 20, 3, 0);
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    // Safety net: if player is dead but death sequence hasn't started, trigger it
    if (this.player.isDead && !this.isRespawning) {
      this.handleDeath('EMBER CORRUPTION');
      return;
    }
    if (this.isRespawning) return;

    this.updateRaftCarriage();
    this.renderRaftIndicators(time);
    this.player.update(time, delta);
    this.drones.forEach(d => d.update(time, delta, this.player.x, this.player.y));
    this.fireJets.forEach(j => j.update(time));
    this.vents.forEach(v => v.update(delta, this.player));

    // Pit-fall safety net (below lava floor)
    if (this.player.y > 480 && !this.player.isDead) {
      this.handleDeath('ABYSSAL FALL');
    }

    // Exit check
    if (this.hasRecoveredAll && this.exitPortal && !this.player.isDead) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, 3720, 232) < 40) {
        this.handleLevelComplete();
      }
    }
  }

  // ── Hell Background ────────────────────────────────────────────────────

  private createHellBackground(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── 1. Deep red gradient sky (fixed, scroll=0) ───────────────────
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(0x0c0103, 0x0c0103, 0x200408, 0x200408, 1);
    sky.fillRect(0, 0, W, H);

    // ── 2. Distant hellscape: low-horizon rolling hills (scroll=0.05) ─
    // Hills stay in the LOWER half of the screen so they never cone over gameplay
    const farBg = this.add.graphics().setScrollFactor(0.05);
    farBg.fillStyle(0x1a0406, 1);
    // Rolling hill silhouettes — height capped at y=200 so they stay below HUD
    for (let x = 0; x < this.levelWidth; x += 180) {
      farBg.fillEllipse(x + 90, H - 30, 240, 160);
      farBg.fillEllipse(x + 160, H - 10, 180, 100);
    }
    // Distant ruined temple/tower silhouettes (short, wide)
    for (let x = 80; x < this.levelWidth; x += 380) {
      // Tower body
      farBg.fillRect(x, H - 180, 30, 180);
      farBg.fillRect(x + 45, H - 140, 24, 140);
      // Roof crenellations
      farBg.fillRect(x - 4, H - 184, 38, 12);
      farBg.fillRect(x + 41, H - 144, 32, 10);
      // Arched windows (cutout effect via sky color)
      farBg.fillStyle(0x180305, 1);
      farBg.fillEllipse(x + 15, H - 120, 12, 20);
      farBg.fillEllipse(x + 57, H - 90, 10, 18);
      farBg.fillStyle(0x1a0406, 1);
    }

    // ── 3. Red atmospheric cloud bands (scroll=0.15, depth=1) ────────
    const clouds = this.add.graphics().setScrollFactor(0.15).setDepth(1);
    // Lower cloud band (near horizon)
    clouds.fillStyle(0x3a0507, 0.75);
    for (let x = 0; x < this.levelWidth; x += 220) {
      clouds.fillEllipse(x + 110, H - 60, 280, 90);
    }
    // Upper wispy clouds
    clouds.fillStyle(0x2a0405, 0.5);
    for (let x = 0; x < this.levelWidth; x += 300) {
      clouds.fillEllipse(x + 150, 50, 300, 55);
      clouds.fillEllipse(x + 260, 65, 220, 40);
    }
    // Highlight edges
    clouds.fillStyle(0x6b0e10, 0.3);
    for (let x = 0; x < this.levelWidth; x += 220) {
      clouds.fillEllipse(x + 110, H - 65, 260, 40);
    }

    // ── 4. Demon shadow entity (scroll=0.12, depth=2) ─────────────────
    // Demon position pinned to old x=1000 so extending world width does not move it
    const demonX = 1000;
    const demon = this.add.graphics().setScrollFactor(0.12).setDepth(2);
    demon.fillStyle(0x180204, 0.8);
    // Body ellipse centred on pinned x
    demon.fillEllipse(demonX, 170, 260, 340);
    demon.fillCircle(demonX, 60, 80);
    // Horns (only go upward, never downward into gameplay)
    demon.fillTriangle(
      demonX - 55, 60,
      demonX - 95, -30,
      demonX - 25, 50
    );
    demon.fillTriangle(
      demonX + 55, 60,
      demonX + 95, -30,
      demonX + 25, 50
    );
    // Wings — extend laterally, NOT downward past y=200
    demon.fillTriangle(
      demonX - 70, 140,
      demonX - 300, 100,
      demonX - 50, 220
    );
    demon.fillTriangle(
      demonX + 70, 140,
      demonX + 300, 100,
      demonX + 50, 220
    );
    // Pulsing glowing eyes
    demon.fillStyle(0xff4400, 0.85);
    demon.fillCircle(demonX - 26, 60, 11);
    demon.fillCircle(demonX + 26, 60, 11);
    demon.fillStyle(0xff8800, 1);
    demon.fillCircle(demonX - 26, 60, 5);
    demon.fillCircle(demonX + 26, 60, 5);
    demon.fillStyle(0xffffff, 0.7);
    demon.fillCircle(demonX - 24, 57, 1.5);
    demon.fillCircle(demonX + 28, 57, 1.5);
    // Eye pulse tween on the graphics object
    this.tweens.add({ targets: demon, alpha: 0.75, yoyo: true, repeat: -1, duration: 1800 });

    // ── 5. Glowing lava floor band (scroll=1, depth=2) ────────────────
    const lavaGlow = this.add.graphics().setScrollFactor(1).setDepth(2);
    lavaGlow.fillGradientStyle(0x5a0000, 0x5a0000, 0x8b1800, 0x8b1800, 1);
    lavaGlow.fillRect(0, this.floorY + 18, this.levelWidth, 100);
    lavaGlow.fillStyle(0xff4400, 0.55);
    lavaGlow.fillRect(0, this.floorY + 14, this.levelWidth, 6);
    lavaGlow.fillStyle(0xff8800, 0.35);
    lavaGlow.fillRect(0, this.floorY + 10, this.levelWidth, 5);
    // Glow pool ellipses below lava surface
    for (let x = 0; x < this.levelWidth; x += 110) {
      lavaGlow.fillStyle(0xff6600, 0.07);
      lavaGlow.fillEllipse(x + 55, this.floorY + 36, 140, 55);
    }

    // ── 6. Rising embers (depth=4) ────────────────────────────────────
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 0, max: this.levelWidth },
      y: { min: this.floorY + 8, max: this.floorY + 28 },
      speedY: { min: -55, max: -18 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.13, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xff4400, 0xff8800, 0xffcc00],
      lifespan: 2400,
      frequency: 55
    }).setDepth(4);

    // ── 7. Mid-air heat shimmer (depth=3) ─────────────────────────────
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 0, max: this.levelWidth },
      y: { min: 120, max: 280 },
      speedY: { min: -6, max: 4 },
      speedX: { min: -4, max: 4 },
      scale: { start: 0.16, end: 0 },
      alpha: { start: 0.07, end: 0 },
      tint: [0xff3300, 0x660800],
      lifespan: 5000,
      frequency: 400
    }).setDepth(3);
  }

  // ── Level Geometry ─────────────────────────────────────────────────────

  private buildLevel(): {
    conduits: Phaser.Physics.Arcade.Sprite[];
    crystals: Array<{ sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number }>;
    drones: SentinelDrone[];
  } {
    const conduits: Phaser.Physics.Arcade.Sprite[] = [];
    const crystals: Array<{ sprite: Phaser.Physics.Arcade.Sprite; cx: number; cy: number }> = [];
    const drones: SentinelDrone[] = [];

    // ── Segment 1: Entry Platform (x=0-280) ──────────────────────────
    for (let x = 0; x <= 288; x += 32) {
      this.platforms.create(x, 300, 'tile_metal').refreshBody();
    }
    // Left wall
    for (let y = 0; y < 220; y += 32) {
      this.platforms.create(0, y, 'tile_metal').refreshBody();
    }
    this.add.text(14, 256, 'HEAT AGE — SECTOR 2', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ff8800',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.add.text(14, 270, '[E/J] = STAFF  [ESC] = PAUSE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#a08866',
      stroke: '#040711',
      strokeThickness: 2
    });

    // Heat conduit #1
    conduits.push(this.spawnHeatConduit(230, 268));

    // Lava under entry (decorative — entry platform is solid)

    // ── Segment 2: Lava Chasm + Moving Raft (x=300-620) ──────────────
    // Lava tiles filling the chasm floor
    for (let x = 288; x <= 640; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }

    // Moving raft 1 — single wide sprite (64px)
    this.raft1 = this.platforms.create(380, 255, 'tile_metal') as Phaser.Physics.Arcade.Sprite;
    this.raft1.setDisplaySize(64, 32);
    (this.raft1.body as Phaser.Physics.Arcade.StaticBody).setSize(64, 32);
    this.raft1.refreshBody();
    this.raft1.setData('prevX', 380);

    this.tweens.add({
      targets: this.raft1,
      x: 530,
      ease: 'Sine.easeInOut',
      duration: 2200,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        (this.raft1.body as Phaser.Physics.Arcade.StaticBody).reset(this.raft1.x, this.raft1.y);
      }
    });

    // Jump-off platform before the fire jet section
    this.platforms.create(660, 270, 'tile_metal').refreshBody();
    this.platforms.create(692, 270, 'tile_metal').refreshBody();

    this.add.text(306, 218, '↔ LAVA RAFT  [STAND IN CENTER TO RIDE]', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff8800',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Segment 3: Fire Jet Gauntlet (x=700-1040) ────────────────────
    for (let x = 704; x <= 1056; x += 32) {
      this.platforms.create(x, 290, 'tile_metal').refreshBody();
    }

    // Fire jets at staggered offsets so they aren't all synced
    const jetPositions: [number, number, number, number][] = [
      [745,  290, 70,    0],
      [815,  290, 70,  650],
      [890,  290, 70, 1300],
      [965,  290, 70,  325],
    ];
    jetPositions.forEach(([jx, jy, h, off]) => {
      const jet = new FireJet(this, this.fireHazards, jx, jy, h, off);
      this.fireJets.push(jet);
    });

    this.add.text(708, 248, '⚠ FIRE JET MAZE  [E/J] STAFF = STUN', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff6600',
      backgroundColor: '#0a0402',
      padding: { x: 4, y: 2 }
    });

    // ── Segment 4: Mid Ember Vault (x=1060-1380) ─────────────────────
    for (let x = 1060; x <= 1408; x += 32) {
      this.platforms.create(x, 290, 'tile_metal').refreshBody();
    }
    // Lava under the gap between segments
    for (let x = 1000; x <= 1060; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }

    // Crumbling ember shortcuts (elevated)
    this.spawnEmberShelf(1100, 244, 4);
    this.spawnEmberShelf(1310, 250, 3);

    // Checkpoint crystal
    const crystal1 = this.spawnCheckpointCrystal(1170, 258);
    crystals.push(crystal1);

    // Heat conduit #2
    conduits.push(this.spawnHeatConduit(1370, 258));

    // Failsafe Component #03 (on elevated shelf)
    this.add.rectangle(1230, 265, 24, 30, 0x2a1008).setStrokeStyle(1, 0xff8800);
    const fs3 = this.physics.add.sprite(1230, 242, 'failsafe_component').setTint(0xff8800);
    fs3.setImmovable(true);
    (fs3.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: fs3, y: 237, yoyo: true, repeat: -1, duration: 1100 });
    this.add.text(1196, 216, 'FAILSAFE 03', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.failsafeItems.push(fs3);

    // Ember drone #1 patrolling the vault
    drones.push(this.spawnEmberDrone(1140, 258, 1070, 1380));

    // ── Segment 5: Ascending Lava Ledges (x=1420-1720) ───────────────
    // Lava fills the gap
    for (let x = 1408; x <= 1760; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }

    // Staircase ledges over lava
    this.platforms.create(1450, 270, 'tile_metal').refreshBody();
    this.platforms.create(1482, 270, 'tile_metal').refreshBody();
    this.platforms.create(1530, 244, 'tile_metal').refreshBody();
    this.platforms.create(1562, 244, 'tile_metal').refreshBody();
    this.platforms.create(1610, 218, 'tile_metal').refreshBody();
    this.platforms.create(1642, 218, 'tile_metal').refreshBody();

    // Moving raft 2 over the last lava gap
    this.raft2 = this.platforms.create(1700, 260, 'tile_metal') as Phaser.Physics.Arcade.Sprite;
    this.raft2.setDisplaySize(64, 32);
    (this.raft2.body as Phaser.Physics.Arcade.StaticBody).setSize(64, 32);
    this.raft2.refreshBody();
    this.raft2.setData('prevX', 1700);

    this.tweens.add({
      targets: this.raft2,
      x: 1800,
      ease: 'Sine.easeInOut',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        (this.raft2.body as Phaser.Physics.Arcade.StaticBody).reset(this.raft2.x, this.raft2.y);
      }
    });

    // Ember drone #2 patrolling the ledge area
    drones.push(this.spawnEmberDrone(1610, 186, 1450, 1660));

    // ── Extension Entry: Safe Practice Area & Tutorial Vent (x=1824-2080) ──
    for (let x = 1824; x <= 2080; x += 32) {
      this.platforms.create(x, 270, 'tile_metal').refreshBody();
    }
    // Lava under the chasm before entry platform (1760-1824)
    for (let x = 1760; x <= 1824; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }
    // Tutorial vent & safe practice ledge
    this.spawnThermalVent(1940, 270, 'updraft', 48, 140);
    this.platforms.create(1960, 200, 'tile_metal').refreshBody();
    this.platforms.create(1992, 200, 'tile_metal').refreshBody();
    this.platforms.create(2024, 200, 'tile_metal').refreshBody();
    this.add.text(1860, 235, '[E/J] IGNITE THERMAL VENT  ·  RIDE THE UPDRAFT', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffaa00',
      backgroundColor: '#0a0402cc',
      padding: { x: 4, y: 2 }
    });

    // ── Z1: Vent Foyer (x=2080-2420) ─────────────────────────────────
    // Approach floor
    for (let x = 2112; x <= 2240; x += 32) {
      this.platforms.create(x, 290, 'tile_metal').refreshBody();
    }
    // Conduit before cliff
    conduits.push(this.spawnHeatConduit(2120, 258));

    // Updraft vent to scale the ~130px cliff
    this.spawnThermalVent(2200, 290, 'updraft', 48, 160);

    // 130px cliff: base y=290, top ledge y=160
    for (let y = 192; y <= 290; y += 32) {
      this.platforms.create(2240, y, 'tile_metal').refreshBody();
    }
    // Cliff top ledge
    for (let x = 2240; x <= 2400; x += 32) {
      this.platforms.create(x, 160, 'tile_metal').refreshBody();
    }
    // Checkpoint & conduit on top ledge
    crystals.push(this.spawnCheckpointCrystal(2280, 128));
    conduits.push(this.spawnHeatConduit(2360, 128));

    this.add.text(2244, 108, 'Z1 · VENT FOYER', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff8800',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Z2: Convection Relay (x=2400-2920) ───────────────────────────
    // Starting launch ledge
    this.platforms.create(2410, 190, 'tile_metal').refreshBody();
    this.platforms.create(2442, 190, 'tile_metal').refreshBody();

    // Lava under gap 1 (x=2432 to 2640)
    for (let x = 2432; x <= 2640; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }
    // Tunnel Vent 1
    this.spawnThermalVent(2440, 180, 'convection', 190, 60);

    // Solid Island between the two tunnels
    for (let x = 2630; x <= 2700; x += 32) {
      this.platforms.create(x, 190, 'tile_metal').refreshBody();
    }

    // Lava under gap 2 (x=2688 to 2896)
    for (let x = 2688; x <= 2896; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }
    // Tunnel Vent 2 (can be ignited while gliding in Tunnel 1)
    this.spawnThermalVent(2700, 180, 'convection', 190, 60);

    // Landing platform
    for (let x = 2890; x <= 2960; x += 32) {
      this.platforms.create(x, 190, 'tile_metal').refreshBody();
    }

    this.add.text(2540, 130, 'Z2 · CONVECTION RELAY', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ff8800',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Z3: Furnace Gauntlet (x=2920-3340) ───────────────────────────
    // Conduit before gauntlet
    conduits.push(this.spawnHeatConduit(2940, 158));

    // Descent steps
    this.platforms.create(2980, 224, 'tile_metal').refreshBody();
    this.platforms.create(3012, 256, 'tile_metal').refreshBody();

    // Floor under jets
    for (let x = 3040; x <= 3340; x += 32) {
      this.platforms.create(x, 290, 'tile_metal').refreshBody();
    }

    // Updraft vent to catwalk (Route A: 1 charge)
    this.spawnThermalVent(3060, 290, 'updraft', 48, 150);

    // Overhead catwalk
    for (let x = 3090; x <= 3290; x += 32) {
      this.platforms.create(x, 180, 'tile_metal').refreshBody();
    }

    // 3 Fire Jets on the floor (Route B: 2+ charges, suppression)
    const gauntletJets: [number, number, number, number][] = [
      [3130, 290, 70, 0],
      [3200, 290, 70, 650],
      [3270, 290, 70, 1300]
    ];
    gauntletJets.forEach(([jx, jy, h, off]) => {
      const jet = new FireJet(this, this.fireHazards, jx, jy, h, off);
      this.fireJets.push(jet);
    });

    this.add.text(3080, 150, 'Z3 · CATWALK ROUTE ↑', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffaa00',
      stroke: '#040711',
      strokeThickness: 2
    });

    // ── Z4: Finale (x=3340-3760) ─────────────────────────────────────
    // Entrance platform leading to updraft vent
    for (let x = 3340; x <= 3456; x += 32) {
      this.platforms.create(x, 290, 'tile_metal').refreshBody();
    }

    // Checkpoint & conduit
    crystals.push(this.spawnCheckpointCrystal(3360, 258));
    conduits.push(this.spawnHeatConduit(3400, 258));

    // Updraft vent: open to the sky at x=3440 (lifts player ~150px to land on the shelf)
    this.spawnThermalVent(3440, 290, 'updraft', 48, 160);

    // Supporting cliff wall under shelf
    for (let y = 192; y <= 290; y += 32) {
      this.platforms.create(3480, y, 'tile_metal').refreshBody();
    }

    // Failsafe 04 elevated shelf (y=170, adjacent to the updraft column)
    for (let x = 3480; x <= 3544; x += 32) {
      this.platforms.create(x, 170, 'tile_metal').refreshBody();
    }
    const fs4 = this.physics.add.sprite(3512, 145, 'failsafe_component').setTint(0xff4400);
    fs4.setImmovable(true);
    (fs4.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: fs4, y: 139, yoyo: true, repeat: -1, duration: 950 });
    this.add.text(3478, 118, 'FAILSAFE 04', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.failsafeItems.push(fs4);

    // Lava gap before exit
    for (let x = 3544; x <= 3632; x += 32) {
      (this.lavaTiles.create(x, this.floorY + 4, 'tile_lava') as Phaser.Physics.Arcade.Sprite).refreshBody();
    }

    // Exit platform
    for (let x = 3632; x <= 3760; x += 32) {
      this.platforms.create(x, 270, 'tile_metal').refreshBody();
    }

    // Ember drone guarding exit
    drones.push(this.spawnEmberDrone(3670, 230, 3632, 3720));

    // Exit portal at 3720, 232
    this.spawnExitPortal(3720, 232);

    // Sealed right wall at 3760
    for (let y = 0; y < 270; y += 32) {
      this.platforms.create(3760, y, 'tile_metal').refreshBody();
    }

    return { conduits, crystals, drones };
  }

  // ── Moving Raft Carriage ───────────────────────────────────────────────

  private updateRaftCarriage(): void {
    const rafts = [this.raft1, this.raft2];
    const kb = this.input.keyboard;
    const isPressingMove = kb ? (
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).isDown ||
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).isDown ||
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).isDown ||
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).isDown
    ) : false;

    for (const raft of rafts) {
      if (!raft || !raft.body) continue;
      const prevX = (raft.getData('prevX') as number) ?? raft.x;
      const dx = raft.x - prevX;
      raft.setData('prevX', raft.x);

      if (Math.abs(dx) < 0.001) continue;

      if (this.player && !this.player.isDead && this.player.body) {
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const raftHalfW = (raft.displayWidth || 64) / 2;
        const raftTop = raft.y - ((raft.displayHeight || 32) / 2);

        // Player is grounded and resting on top of the moving raft
        const isStandingOnRaft =
          (pBody.blocked.down || pBody.touching.down) &&
          Math.abs(pBody.bottom - raftTop) <= 6 &&
          pBody.right > (raft.x - raftHalfW) &&
          pBody.left < (raft.x + raftHalfW);

        if (isStandingOnRaft) {
          // Decreased middle blue sweet spot width: 20px (+/-10px from center)
          const SAFE_CENTER_RADIUS = 10;
          const distFromCenter = Math.abs(this.player.x - raft.x);

          if (distFromCenter <= SAFE_CENTER_RADIUS) {
            // Firm center lock: when not inputting manual movement, player is locked stationary in center
            if (!isPressingMove) {
              this.player.x = raft.x;
              pBody.x = raft.x - pBody.halfWidth;
            } else {
              // Player is actively steering: carry raft delta along with walking input
              this.player.x += dx;
              pBody.x += dx;
            }
          } else {
            // Stepped on arrow keys: high outgoing velocity pushes player off toward edges fast
            const nudgeDir = this.player.x > raft.x ? 1 : -1;
            const OUTGOING_VELOCITY = 3.2; // Fast outward ejection
            this.player.x += nudgeDir * OUTGOING_VELOCITY;
            pBody.x += nudgeDir * OUTGOING_VELOCITY;
          }
        }
      }
    }
  }

  private renderRaftIndicators(time: number): void {
    if (!this.raftIndicatorGfx) return;
    this.raftIndicatorGfx.clear();

    const rafts = [this.raft1, this.raft2];
    for (const raft of rafts) {
      if (!raft || !raft.active) continue;

      const rx = raft.x;
      const ry = raft.y;
      const topY = ry - 16;
      const pBody = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
      const onRaft =
        pBody &&
        !this.player.isDead &&
        (pBody.blocked.down || pBody.touching.down) &&
        Math.abs(pBody.bottom - topY) <= 6 &&
        pBody.right > (rx - 32) &&
        pBody.left < (rx + 32);

      const distFromCenter = onRaft ? Math.abs(this.player.x - rx) : 999;
      // Middle blue zone: 20px wide (+/-10px from center)
      const isCentered = onRaft && distFromCenter <= 10;

      // 1. Middle blue glowing section [rx - 10, rx + 10]
      const blueColor = 0x00f0ff;
      this.raftIndicatorGfx.fillStyle(blueColor, isCentered ? 0.6 : 0.3);
      this.raftIndicatorGfx.fillRect(rx - 10, topY + 2, 20, 6);

      this.raftIndicatorGfx.lineStyle(1.5, blueColor, isCentered ? 1.0 : 0.75);
      this.raftIndicatorGfx.strokeRect(rx - 10, topY + 2, 20, 6);

      // Center alignment notch
      this.raftIndicatorGfx.lineStyle(1, 0xffffff, isCentered ? 1.0 : 0.7);
      this.raftIndicatorGfx.lineBetween(rx, topY, rx, topY + 4);

      // 2. High-speed animated side arrows streaming outward toward either side
      const flowPhase = (time * 0.08) % 8; // Rapid outward flow

      // Left side arrows: streaming toward LEFT
      const leftArrowColor = (onRaft && !isCentered && this.player.x < rx) ? 0xff1100 : 0xff5500;
      this.raftIndicatorGfx.lineStyle(1.5, leftArrowColor, 0.95);
      for (let i = 0; i < 2; i++) {
        const ax = rx - 14 - (i * 8 + flowPhase);
        if (ax >= rx - 30 && ax <= rx - 12) {
          this.raftIndicatorGfx.lineBetween(ax + 3, topY + 1, ax, topY + 5);
          this.raftIndicatorGfx.lineBetween(ax, topY + 5, ax + 3, topY + 9);
        }
      }

      // Right side arrows: streaming toward RIGHT
      const rightArrowColor = (onRaft && !isCentered && this.player.x > rx) ? 0xff1100 : 0xff5500;
      this.raftIndicatorGfx.lineStyle(1.5, rightArrowColor, 0.95);
      for (let i = 0; i < 2; i++) {
        const ax = rx + 14 + (i * 8 + flowPhase);
        if (ax <= rx + 30 && ax >= rx + 12) {
          this.raftIndicatorGfx.lineBetween(ax - 3, topY + 1, ax, topY + 5);
          this.raftIndicatorGfx.lineBetween(ax, topY + 5, ax - 3, topY + 9);
        }
      }
    }
  }

  // ── Spawner helpers ────────────────────────────────────────────────────

  private spawnThermalVent(
    x: number,
    y: number,
    type: ThermalVentType,
    zoneWidth: number,
    zoneHeight: number
  ): ThermalVent {
    const vent = new ThermalVent(this, x, y, type, zoneWidth, zoneHeight);
    this.vents.push(vent);
    return vent;
  }

  private spawnHeatConduit(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const c = this.physics.add.sprite(x, y, 'heat_conduit');
    c.setImmovable(true);
    (c.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: c, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
    return c;
  }

  private spawnCheckpointCrystal(cx: number, cy: number) {
    const sprite = this.physics.add.sprite(cx, cy, 'checkpoint_crystal');
    sprite.setImmovable(true);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: sprite, y: cy - 4, yoyo: true, repeat: -1, duration: 900 });
    return { sprite, cx, cy };
  }

  private spawnEmberShelf(startX: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const tile = this.platforms.create(startX + i * 32, y, 'tile_ember') as Phaser.Physics.Arcade.Sprite;
      tile.refreshBody();
      tile.setData('ember', true);
      tile.setData('crumbling', false);
      this.emberTiles.push(tile);
    }
  }

  private spawnEmberDrone(x: number, y: number, left: number, right: number): SentinelDrone {
    const drone = new SentinelDrone(this, x, y, left, right);
    drone.setTexture('ember_drone');
    return drone;
  }

  private spawnExitPortal(x: number, y: number): void {
    this.exitPortal = this.add.graphics();
    this.exitPortal.fillStyle(0xff6600, 0.85);
    this.exitPortal.fillCircle(x, y, 18);
    this.exitPortal.lineStyle(3, 0xffdd00, 1);
    this.exitPortal.strokeCircle(x, y, 18);
    this.exitPortal.fillStyle(0xffffff, 0.4);
    this.exitPortal.fillCircle(x - 5, y - 6, 6);

    // Store x/y for exit check
    (this.exitPortal as any).x = x;
    (this.exitPortal as any).y = y;

    this.tweens.add({
      targets: this.exitPortal, alpha: 0.5,
      yoyo: true, repeat: -1, duration: 700
    });
    this.add.text(x - 24, y - 36, 'EXIT GATE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ff8800',
      stroke: '#040711',
      strokeThickness: 2
    });
  }

  // ── Ember crumble collider callback ───────────────────────────────────

  private handleEmberContact(tile: Phaser.Physics.Arcade.Sprite): void {
    if (!tile.getData('ember') || tile.getData('crumbling')) return;
    tile.setData('crumbling', true);
    // Flash warning
    this.tweens.add({ targets: tile, alpha: 0.3, duration: 80, yoyo: true, repeat: 3 });
    // Actually break after 600ms
    this.time.delayedCall(600, () => {
      if (tile.active) {
        tile.setActive(false).setVisible(false);
        (tile.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      }
    });
  }

  // ── Thermal Vent Control (Heat Age Environment Ability) ───────────────
  //
  // Staff [E/J] ignites the nearest dormant vent within ~150px.
  // If no vent is in range, falls back to jet/drone stun.
  // Running or cooling vents cannot be re-ignited, so the press falls through to stun.

  private handleStaffUse(): void {
    let nearestVent: ThermalVent | null = null;
    let minDist: number = THERMAL_VENT_CONFIG.ignitionRange;

    for (const vent of this.vents) {
      if (vent.isDormant) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, vent.x, vent.y);
        if (dist <= minDist) {
          minDist = dist;
          nearestVent = vent;
        }
      }
    }

    if (nearestVent) {
      nearestVent.ignite();
      AudioManager.playStoneRumble();
      this.cameras.main.flash(120, 255, 120, 0);
      this.hud.showBanner(`THERMAL VENT IGNITED (${nearestVent.type.toUpperCase()})`);
    } else {
      // Fallback to jet and drone suppression
      this.tryStunNearbyJets();
      this.tryStunNearbyDrones();
    }
  }


  private tryStunNearbyJets(): void {
    let stunned = false;
    this.fireJets.forEach(jet => {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, jet.hazardSprite.x, jet.hazardSprite.y
      );
      if (d < this.staffStunRange) {
        jet.stun(this, 3500);
        stunned = true;
      }
    });
    if (stunned) {
      this.cameras.main.flash(100, 0, 180, 255);
      this.hud.showBanner('FIRE JET SUPPRESSED!');
    }
  }

  private tryStunNearbyDrones(): void {
    this.drones.forEach(drone => {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, drone.x, drone.y
      );
      if (d < this.staffStunRange) {
        drone.stun();
        AudioManager.playDroneStun();
      }
    });
  }

  // ── Pause ──────────────────────────────────────────────────────────────

  private togglePause(): void {
    // Ignore pause while dead, respawning, or leaving the scene
    if (this.player.isDead || this.isRespawning || this.isLeavingScene) return;
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    const cb: PauseMenuCallbacks = {
      onResume:   () => this.resumeGame(),
      onRestart:  () => { this.isPaused = false; this.physics.resume(); this.scene.restart(); },
      onMainMenu: () => { this.isPaused = false; this.physics.resume(); this.scene.start(GAME_CONFIG.sceneKeys.MainMenu); }
    };
    this.pauseMenu = new PauseMenu(this, cb);
  }

  private resumeGame(): void {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.isPaused = false;
    this.physics.resume();
  }

  // ── Death / Respawn ────────────────────────────────────────────────────

  private handleDeath(reason = 'THERMAL HAZARD'): void {
    if (this.isRespawning) return;
    this.isRespawning = true;

    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    AudioManager.playDeath();
    this.cameras.main.shake(280, 0.018);
    this.cameras.main.flash(200, 180, 40, 0);
    this.hud.showBanner(`CRITICAL FAILURE: ${reason}`);

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

          // Restore crumbled ember tiles
          this.emberTiles.forEach(tile => {
            this.tweens.killTweensOf(tile);
            tile.setActive(true).setVisible(true).setAlpha(1);
            tile.setData('crumbling', false);
            if (tile.body) {
              (tile.body as Phaser.Physics.Arcade.StaticBody).enable = true;
            }
          });

          // Reset all vents to dormant
          this.vents.forEach(v => v.reset());

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
          this.isLeavingScene = true;
          this.physics.resume();
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
          });
        }
      };

      this.gameOverScreen = new GameOverScreen(this, callbacks, reason);
    });
  }

  // ── Failsafe collection ────────────────────────────────────────────────

  private collectFailsafe(item: Phaser.Physics.Arcade.Sprite): void {
    if (!item.active) return;
    item.setActive(false).setVisible(false);
    (item.body as Phaser.Physics.Arcade.Body).enable = false;

    this.failsafeCollected++;
    this.checkpointX = Math.round(item.x);
    this.checkpointY = Math.round(item.y) - 30;

    const emitter = this.add.particles(item.x, item.y, 'proto_tile', {
      speed: { min: 50, max: 140 }, scale: { start: 0.45, end: 0 },
      tint: [0xff8800, 0xffdd00, 0xff4400], lifespan: 750, quantity: 18
    });
    this.time.delayedCall(900, () => emitter.destroy());

    // Display as 3, 4 (sector 1 gave 1, 2 → we start at 3)
    const globalIdx = this.failsafeCollected + 2;
    this.hud.setFailsafeFound(globalIdx, 5);
    this.player.restoreStaffCharges(2);
    this.hud.updateCharges(this.player.staffCharges);
    AudioManager.playFailsafe();

    if (this.failsafeCollected >= 2) {
      this.hasRecoveredAll = true;
      this.hud.showBanner('ALL HEAT AGE FAILSAFES RECOVERED — EXIT UNLOCKED!');
      this.cameras.main.flash(350, 255, 100, 0);
    }
  }

  // ── Level Complete ─────────────────────────────────────────────────────

  private handleLevelComplete(): void {
    if (this.isLeavingScene || this.physics.world.isPaused) return;
    this.isLeavingScene = true;
    this.physics.pause();
    this.hud.showBanner('SECTOR 2 CONQUERED! FAILSAFE ARRAY NEAR COMPLETE!');
    this.cameras.main.fadeOut(700, 180, 40, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('LevelComplete', {
        failsafeCollected: this.failsafeCollected + 2,
        totalFailsafe: 5,
        deathCount: this.deathCount,
        timeMs: Date.now() - this.levelStartTime,
        sectorNumber: 2
      });
    });
  }

  // ── Scanlines ──────────────────────────────────────────────────────────

  private addScanlines(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const g = this.add.graphics().setScrollFactor(0).setAlpha(0.05).setDepth(100);
    g.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) g.lineBetween(0, y, W, y);
  }
}
