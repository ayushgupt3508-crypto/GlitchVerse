import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { Guard } from '../entities/Guard';
import { CamouflageAbility } from '../abilities/CamouflageAbility';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';

/**
 * LEVEL 3 DATA SPECIFICATION — MEDIEVAL PALACE
 * ─────────────────────────────────────────────
 * Theme: Chrono-Infiltration
 * Palette: Stone Gray, Muted Gold, Dark Red, Warm Light
 */
export const LEVEL3_DATA = {
  id: 'level3',
  name: 'Medieval Palace',
  sector: 3,
  palette: {
    stoneGray: 0x323640,
    stoneTop: 0x363b46,
    mutedGold: 0xd4af37,
    darkRed: 0x75161c,
    warmLight: 0xffaa33,
    nightSkyTop: 0x070912,
    nightSkyBottom: 0x161a28
  },
  dimensions: {
    width: 3200,
    height: 440,
    floorY: 340
  },
  spawn: { x: 80, y: 300 },
  checkpoints: [
    { id: 'cp_spawn',   x: 80,   y: 300, label: 'COURTYARD DRAWBRIDGE' },
    { id: 'cp_armory',  x: 1400, y: 190, label: 'ROYAL ARMORY BALCONY' },
    { id: 'cp_vault',   x: 2540, y: 300, label: 'ROYAL VAULT CHAMBER' }
  ],
  puzzle: {
    chamberDoor: { x: 2180, y: 276, width: 32, height: 64 },
    chamberKey:  { x: 1720, y: 150 },
    component3:  { x: 2540, y: 290 },
    exitPortal:  { x: 3120, y: 210 }
  },
  guards: [
    {
      name: 'Sentry Roderick',
      x: 740,
      y: 322,
      patrolLeft: 620,
      patrolRight: 980,
      visionRange: 130,
      visionAngle: 45,
      facingRight: true
    },
    {
      name: 'Halberdier Gareth',
      x: 1320,
      y: 322,
      patrolLeft: 1200,
      patrolRight: 1560,
      visionRange: 135,
      visionAngle: 45,
      facingRight: false
    },
    {
      name: 'Captain Valen', // Core puzzle guard in front of locked chamber door
      x: 2020,
      y: 322,
      patrolLeft: 1880,
      patrolRight: 2150,
      visionRange: 145,
      visionAngle: 45,
      facingRight: false
    },
    {
      name: 'Sentinel Boris',
      x: 2940,
      y: 226,
      patrolLeft: 2840,
      patrolRight: 3040,
      visionRange: 125,
      visionAngle: 45,
      facingRight: true
    }
  ]
} as const;

/**
 * Level3Scene (level3.ts) — Medieval Palace
 *
 * Infiltration of the royal palace vault:
 *  • Evade palace sentinels using the CamouflageAbility (Optical Cloak & Decoy Hologram).
 *  • Unlock the chamber door guarded by Captain Valen by luring him with a decoy illusion.
 *  • Breached vault: recover Failsafe Component 3 (The Chrono-Prism).
 *  • Escape through the High Tower Extraction Rift.
 */
export class Level3Scene extends Phaser.Scene {
  // Entities
  private player!: Player;
  private camouflage!: CamouflageAbility;
  private guards: Guard[] = [];

  // Physics Groups
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;

  // Puzzle Items & Objects
  private chamberDoorSprite?: Phaser.Physics.Arcade.Sprite;
  private chamberKeySprite?: Phaser.Physics.Arcade.Sprite;
  private component3Sprite?: Phaser.Physics.Arcade.Sprite;
  private exitPortalSprite?: Phaser.GameObjects.Sprite;
  private hasChamberKey = false;
  private isChamberDoorUnlocked = false;
  private hasCollectedComponent3 = false;

  // Progression & Checkpoints
  private checkpointX: number = LEVEL3_DATA.spawn.x;
  private checkpointY: number = LEVEL3_DATA.spawn.y;
  private deathCount = 0;
  private alertCount = 0;
  private levelStartTime = 0;

  // UI
  private hud!: HUD;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private isPaused = false;
  private isRespawning = false;

  // Lighting & Atmospheric Effects
  private torchLightGfx?: Phaser.GameObjects.Graphics;
  private torchHalos: { x: number; y: number; baseRadius: number }[] = [];

  constructor() {
    super('Level3Scene');
  }

  create(): void {
    AudioManager.init();
    AudioManager.startMatrixMusic();
    this.levelStartTime = Date.now();

    // Generate textures
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, LEVEL3_DATA.dimensions.width, 800);

    // Create atmospheric palace background
    this.createPalaceBackground();

    // Physics static groups
    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();

    // Torch lighting graphics layer
    this.torchLightGfx = this.add.graphics().setDepth(5);

    // Build palace architecture
    this.buildPalaceArchitecture();

    // Spawn player at checkpoint
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // Initialize Camouflage Ability
    this.camouflage = new CamouflageAbility(this, this.player);

    // Spawn Palace Guards
    this.spawnGuards();

    // Spawn Puzzle Interactables (Key, Door, Component 3, Exit)
    this.setupPuzzleElements();

    // Setup Colliders & Overlaps
    this.setupColliders();

    // Setup HUD
    this.hud = new HUD(this, 'SECTOR 3 · MEDIEVAL PALACE', LEVEL3_DATA.palette.mutedGold);
    this.hud.setFailsafeFound(2, 5); // Sector 1 + 2 gave 2 components
    this.hud.updateCharges(this.player.staffCharges);
    this.hud.updateIntegrity(this.player.integrity);

    this.player.on('player_damaged', (hp: number) => {
      this.hud.updateIntegrity(hp);
    });
    this.player.on('player_respawn', () => {
      this.hud.updateIntegrity(this.player.integrity);
      this.hud.updateCharges(this.player.staffCharges);
    });

    // Setup Camera Tracking
    this.setupCamera();

    // Pause Key listener (ESC / P) & HUD Home Button
    this.hud.onPauseClicked(() => this.togglePause());
    if (this.input.keyboard) {
      const esc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      const keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      esc.on('down', () => this.togglePause());
      keyP.on('down', () => this.togglePause());
    }

    // Scanlines
    this.addScanlines();

    // Welcome banner & tutorial hint
    this.time.delayedCall(600, () => {
      this.hud.showBanner('VAULT INFILTRATION: PRESS [C] OR [Q] FOR TEMPORAL ILLUSION');
    });

    // Shutdown cleanup listener
    this.events.once('shutdown', () => {
      this.camouflage.destroy();
      this.guards.forEach(g => g.destroy());
      this.torchLightGfx?.destroy();
    });

    this.isRespawning = false;
    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    // Safety net: if player is dead but death sequence hasn't started, trigger it
    if (this.player.isDead && !this.isRespawning) {
      this.handleDeath('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    // Update Player
    this.player.update(time, delta);

    // Fall death check
    if (this.player.y > 440 && !this.player.isDead) {
      this.handleDeath('PITFALL INTO MOAT ABYSS');
      return;
    }

    // Update Camouflage Ability
    this.camouflage.update(time, delta);

    // Update Guards with stealth information
    const isPlayerCloaked = this.camouflage.cloaked;
    const decoyPos = this.camouflage.decoy;

    this.guards.forEach(guard => {
      guard.update(time, delta, this.player.x, this.player.y, decoyPos, isPlayerCloaked);
    });

    // Animate warm torch light halos
    this.updateTorchLighting(time);
  }

  // ── Palace Background & Aesthetics ────────────────────────────────────────

  private createPalaceBackground(): void {
    const W = LEVEL3_DATA.dimensions.width;
    const H = LEVEL3_DATA.dimensions.height;

    // 1. Dusk/night sky gradient
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(
      LEVEL3_DATA.palette.nightSkyTop,
      LEVEL3_DATA.palette.nightSkyTop,
      LEVEL3_DATA.palette.nightSkyBottom,
      LEVEL3_DATA.palette.nightSkyBottom,
      1
    );
    sky.fillRect(0, 0, this.cameras.main.width, H);

    // 2. Star field
    const stars = this.add.graphics().setScrollFactor(0.05);
    stars.fillStyle(0xffffff, 0.7);
    for (let x = 0; x < W; x += 45) {
      const sy = 20 + ((x * 37) % 180);
      const size = (x % 3 === 0) ? 1.5 : 1;
      stars.fillRect(x, sy, size, size);
    }

    // 3. Distant Castle Silhouette & Towers (Parallax factor 0.15)
    const distantTowers = this.add.graphics().setScrollFactor(0.15);
    distantTowers.fillStyle(0x131620, 1);
    for (let x = -100; x < W + 400; x += 180) {
      const th = 160 + ((x * 17) % 90);
      const tw = 40 + ((x * 23) % 30);
      // Tower shaft
      distantTowers.fillRect(x, H - th, tw, th);
      // Tower crenellations
      for (let c = 0; c < tw; c += 8) {
        distantTowers.fillRect(x + c, H - th - 8, 4, 8);
      }
      // Tower spire conical roof on some
      if (x % 360 === 0) {
        distantTowers.fillTriangle(x - 4, H - th, x + tw + 4, H - th, x + tw / 2, H - th - 36);
      }
    }

    // 4. Midground Castle Masonry Wall (Parallax factor 0.35)
    const midWall = this.add.graphics().setScrollFactor(0.35);
    midWall.fillStyle(0x1a1e28, 0.95);
    midWall.fillRect(0, 120, W, H - 120);

    // Gothic arched windows with warm stained amber/crimson light
    for (let x = 120; x < W; x += 220) {
      // Arch frame
      midWall.fillStyle(0x0e1118, 1);
      midWall.fillRect(x - 2, 160, 28, 54);
      midWall.fillCircle(x + 12, 160, 14);

      // Warm stained glass light (amber & ruby)
      const isAmber = (x / 220) % 2 === 0;
      const glassCol = isAmber ? 0xd4af37 : 0x75161c;
      midWall.fillStyle(glassCol, 0.45);
      midWall.fillRect(x + 1, 162, 22, 50);
      midWall.fillCircle(x + 12, 162, 11);

      // Window stone tracery
      midWall.lineStyle(1, 0x11131a, 0.9);
      midWall.lineBetween(x + 12, 150, x + 12, 212);
      midWall.lineBetween(x + 1, 185, x + 23, 185);
    }
  }

  // ── Palace Architecture & Platforms ───────────────────────────────────────

  private buildPalaceArchitecture(): void {
    const floorY = LEVEL3_DATA.dimensions.floorY;

    // Helper to tile platforms
    const addGround = (startX: number, endX: number, y: number, tileKey = 'tile_stone') => {
      for (let x = startX; x <= endX; x += 32) {
        // Top cap tile
        const top = this.platforms.create(x, y, 'tile_stone_top') as Phaser.Physics.Arcade.Sprite;
        top.setOrigin(0, 0).refreshBody();

        // Sub-blocks beneath
        for (let subY = y + 32; subY <= 440; subY += 32) {
          const block = this.platforms.create(x, subY, tileKey) as Phaser.Physics.Arcade.Sprite;
          block.setOrigin(0, 0).refreshBody();
        }
      }
    };

    const addPlatform = (startX: number, endX: number, y: number, tileKey = 'tile_stone_top') => {
      for (let x = startX; x <= endX; x += 32) {
        const plat = this.platforms.create(x, y, tileKey) as Phaser.Physics.Arcade.Sprite;
        plat.setOrigin(0, 0).refreshBody();
      }
    };

    // ── Zone 1: Courtyard & Drawbridge (0 to 520) ─────────────────────────
    addGround(0, 224, floorY);

    // Moat pit: from x: 256 to 384
    // Wooden Drawbridge over moat
    for (let x = 256; x <= 416; x += 32) {
      const bridge = this.platforms.create(x, floorY, 'tile_wood_drawbridge') as Phaser.Physics.Arcade.Sprite;
      bridge.setOrigin(0, 0).refreshBody();
    }
    // Drawbridge iron chains
    const chainsGfx = this.add.graphics().setDepth(6);
    chainsGfx.lineStyle(2, 0x444955, 0.85);
    chainsGfx.lineBetween(256, floorY, 210, floorY - 90);
    chainsGfx.lineBetween(448, floorY, 490, floorY - 90);

    // Moat water hazard at bottom of pit
    for (let x = 256; x <= 416; x += 32) {
      const water = this.hazards.create(x, 410, 'tile_water') as Phaser.Physics.Arcade.Sprite;
      water.setOrigin(0, 0).refreshBody();
    }

    addGround(448, 560, floorY);

    // ── Zone 2: West Guard Corridor (560 to 1140) ─────────────────────────
    addGround(560, 1140, floorY);

    // Upper observation rafters & chandeliers
    addPlatform(680, 840, floorY - 70);
    addPlatform(900, 1060, floorY - 90);

    // Royal banners in corridor
    this.add.image(620, floorY - 60, 'banner_royal').setDepth(4);
    this.add.image(960, floorY - 60, 'banner_royal').setDepth(4);

    // ── Zone 3: The Royal Armory (1140 to 1740) ───────────────────────────
    addGround(1140, 1740, floorY);

    // Armory red carpet along floor
    for (let x = 1180; x <= 1680; x += 32) {
      this.add.image(x, floorY - 4, 'tile_red_carpet').setOrigin(0, 0).setDepth(4);
    }

    // Armory two-tier platforms & stairs
    addPlatform(1220, 1380, floorY - 65);
    addPlatform(1440, 1620, floorY - 110);

    // High Throne Balcony (where the Chamber Key rests!)
    addPlatform(1680, 1780, floorY - 150);

    // Royal banners
    this.add.image(1260, floorY - 90, 'banner_royal').setDepth(4);
    this.add.image(1540, floorY - 90, 'banner_royal').setDepth(4);

    // ── Zone 4: The Throne Room & Locked Chamber Corridor (1740 to 2400) ──
    addGround(1740, 2400, floorY);

    // Gilded pillars flanking corridor
    for (let x = 1760; x <= 2360; x += 120) {
      this.add.image(x, floorY - 32, 'tile_gold_pillar').setOrigin(0, 0).setDepth(3);
    }

    // Velvet red carpet runner
    for (let x = 1760; x <= 2360; x += 32) {
      this.add.image(x, floorY - 4, 'tile_red_carpet').setOrigin(0, 0).setDepth(4);
    }

    // Low ceiling stone archway enforcing the tight corridor encounter
    for (let x = 1860; x <= 2220; x += 32) {
      const arch = this.platforms.create(x, floorY - 90, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
      arch.setOrigin(0, 0).refreshBody();
    }

    // ── Zone 5: The Royal Vault (2400 to 2800) ────────────────────────────
    addGround(2400, 2800, floorY);

    // Vault gilded columns & decorative chests
    this.add.image(2460, floorY - 32, 'tile_gold_pillar').setOrigin(0, 0).setDepth(3);
    this.add.image(2620, floorY - 32, 'tile_gold_pillar').setOrigin(0, 0).setDepth(3);
    this.add.image(2470, floorY - 24, 'vault_chest').setOrigin(0, 0).setDepth(4);
    this.add.image(2610, floorY - 24, 'vault_chest').setOrigin(0, 0).setDepth(4);

    // Vault pedestal for Component 3
    addPlatform(2520, 2560, floorY - 24);

    // ── Zone 6: High Tower Ramparts & Exit (2800 to 3200) ─────────────────
    // Ascending spiral ramparts
    addGround(2800, 2920, floorY);
    addPlatform(2860, 2980, floorY - 50);
    addPlatform(2940, 3060, floorY - 95);
    addPlatform(3040, 3180, floorY - 140);

    // Tower battlements background wall
    for (let x = 3020; x <= 3200; x += 32) {
      for (let y = floorY - 240; y <= floorY - 140; y += 32) {
        this.add.image(x, y, 'tile_castle_brick').setOrigin(0, 0).setDepth(2);
      }
    }

    // Wall Torch Sconces throughout level
    const torchPositions = [
      { x: 120,  y: floorY - 50 },
      { x: 480,  y: floorY - 50 },
      { x: 740,  y: floorY - 50 },
      { x: 1040, y: floorY - 50 },
      { x: 1360, y: floorY - 80 },
      { x: 1640, y: floorY - 80 },
      { x: 1940, y: floorY - 50 },
      { x: 2120, y: floorY - 50 },
      { x: 2480, y: floorY - 50 },
      { x: 2600, y: floorY - 50 },
      { x: 2900, y: floorY - 70 },
      { x: 3100, y: floorY - 160 }
    ];

    torchPositions.forEach(pos => {
      this.add.image(pos.x, pos.y, 'torch_sconce').setOrigin(0.5).setDepth(6);
      this.torchHalos.push({ x: pos.x, y: pos.y - 6, baseRadius: 42 });
    });
  }

  // ── Guards Setup ──────────────────────────────────────────────────────────

  private spawnGuards(): void {
    LEVEL3_DATA.guards.forEach(cfg => {
      const guard = new Guard(
        this,
        cfg.x,
        cfg.y,
        cfg.patrolLeft,
        cfg.patrolRight,
        {
          name: cfg.name,
          visionRange: cfg.visionRange,
          visionAngle: cfg.visionAngle,
          facingRight: cfg.facingRight
        }
      );

      // Track alert count for stealth ranking
      guard.on('guard_alert', (name: string) => {
        this.alertCount++;
        this.cameras.main.shake(120, 0.008);
        this.hud.showBanner(`ALERT! ${name.toUpperCase()} SPOTTED MOVEMENT!`);
      });

      this.guards.push(guard);
    });
  }

  // ── Puzzle Elements Setup ─────────────────────────────────────────────────

  private setupPuzzleElements(): void {
    const pz = LEVEL3_DATA.puzzle;

    // 1. The Gilded Chamber Key (atop high throne balcony)
    this.chamberKeySprite = this.physics.add.sprite(pz.chamberKey.x, pz.chamberKey.y, 'chamber_key')
      .setDepth(10);
    (this.chamberKeySprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // Floating bob tween
    this.tweens.add({
      targets: this.chamberKeySprite,
      y: pz.chamberKey.y - 6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. The Locked Chamber Door (portcullis in front of vault)
    this.chamberDoorSprite = this.physics.add.sprite(pz.chamberDoor.x, pz.chamberDoor.y, 'chamber_door')
      .setDepth(10)
      .setImmovable(true);
    (this.chamberDoorSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // 3. Failsafe Component 3: The Chrono-Prism (in the Royal Vault)
    this.component3Sprite = this.physics.add.sprite(pz.component3.x, pz.component3.y, 'relic_component3')
      .setDepth(10);
    (this.component3Sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // Pulsing rotation & float tween
    this.tweens.add({
      targets: this.component3Sprite,
      y: pz.component3.y - 8,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 4. High Tower Extraction Portal (Exit)
    this.exitPortalSprite = this.add.sprite(pz.exitPortal.x, pz.exitPortal.y, 'failsafe_component')
      .setScale(1.8)
      .setDepth(10);

    // Glowing dimensional rift pulse
    this.tweens.add({
      targets: this.exitPortalSprite,
      scale: 2.2,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ── Physics Colliders & Interactions ──────────────────────────────────────

  private setupColliders(): void {
    // Player vs Platforms
    this.physics.add.collider(this.player, this.platforms);

    // Guards vs Platforms
    this.guards.forEach(guard => {
      this.physics.add.collider(guard, this.platforms);
    });

    // Player vs Locked Chamber Door (solid until unlocked)
    if (this.chamberDoorSprite) {
      this.physics.add.collider(this.player, this.chamberDoorSprite, () => {
        if (!this.isChamberDoorUnlocked) {
          if (this.hasChamberKey) {
            this.unlockChamberDoor();
          } else {
            this.hud.showBanner('LOCKED VAULT DOOR — RETRIEVE THE GILDED KEY');
          }
        }
      });
    }

    // Player vs Chamber Key overlap
    if (this.chamberKeySprite) {
      this.physics.add.overlap(this.player, this.chamberKeySprite, () => {
        this.collectChamberKey();
      });
    }

    // Player vs Component 3 overlap
    if (this.component3Sprite) {
      this.physics.add.overlap(this.player, this.component3Sprite, () => {
        this.collectComponent3();
      });
    }

    // Player vs Exit Portal overlap
    if (this.exitPortalSprite) {
      const exitZone = this.add.zone(
        LEVEL3_DATA.puzzle.exitPortal.x,
        LEVEL3_DATA.puzzle.exitPortal.y,
        48, 64
      );
      this.physics.add.existing(exitZone, true);
      this.physics.add.overlap(this.player, exitZone, () => {
        this.handleLevelComplete();
      });
    }

    // Player vs Guards overlap (lethal in alert state or when uncloaked)
    this.guards.forEach(guard => {
      this.physics.add.overlap(this.player, guard, () => {
        if (this.isRespawning) return;

        // If player is cloaked, they slip past smoothly
        if (this.camouflage.cloaked) return;

        // Contact with alert guard deals damage
        if (guard.isLethal) {
          const lethal = this.player.takeDamage();
          if (lethal || this.player.integrity <= 0 || this.player.isDead) {
            this.handleDeath(`APPREHENDED BY ${guard.guardName.toUpperCase()}`);
          } else {
            AudioManager.playDeath();
            this.cameras.main.shake(160, 0.012);
            this.cameras.main.flash(90, 200, 40, 20);
            this.hud.showBanner(`INTEGRITY COMPROMISED: ${this.player.integrity} HP REMAINING`);
          }
        }
      });
    });

    // Player vs Hazards (moat water)
    this.physics.add.overlap(this.player, this.hazards, () => {
      if (!this.player.isDead) {
        this.handleDeath('DROWNED IN CASTLE MOAT');
      }
    });
  }

  // ── Puzzle Logic: Key, Door, Component 3 ──────────────────────────────────

  private collectChamberKey(): void {
    if (!this.chamberKeySprite || !this.chamberKeySprite.active || this.hasChamberKey) return;

    this.hasChamberKey = true;
    AudioManager.playKeyCollect();

    // Particle burst
    const emitter = this.add.particles(this.chamberKeySprite.x, this.chamberKeySprite.y, 'proto_tile', {
      speed: { min: 30, max: 90 },
      scale: { start: 0.35, end: 0 },
      tint: [0xd4af37, 0xffe082, 0xffffff],
      lifespan: 500,
      quantity: 14
    });
    this.time.delayedCall(550, () => emitter.destroy());

    this.chamberKeySprite.destroy();

    // Update Checkpoint to armory
    this.checkpointX = LEVEL3_DATA.checkpoints[1].x;
    this.checkpointY = LEVEL3_DATA.checkpoints[1].y;

    this.cameras.main.flash(140, 212, 175, 55);
    this.hud.showBanner('GILDED KEY ACQUIRED — USE ILLUSION TO BYPASS CAPTAIN VALEN');
  }

  private unlockChamberDoor(): void {
    if (this.isChamberDoorUnlocked || !this.chamberDoorSprite) return;

    this.isChamberDoorUnlocked = true;
    AudioManager.playDoorUnlock();

    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(120, 255, 215, 0);

    // Disable physics collision
    (this.chamberDoorSprite.body as Phaser.Physics.Arcade.Body).enable = false;

    // Slide door upward into the ceiling
    this.tweens.add({
      targets: this.chamberDoorSprite,
      y: this.chamberDoorSprite.y - 70,
      alpha: 0.3,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.chamberDoorSprite?.destroy();
      }
    });

    this.hud.showBanner('VAULT CHAMBER UNLOCKED — INFILTRATE AND SECURE COMPONENT 3');
  }

  private collectComponent3(): void {
    if (!this.component3Sprite || !this.component3Sprite.active || this.hasCollectedComponent3) return;

    this.hasCollectedComponent3 = true;
    AudioManager.playComponent3Collect();

    // Golden explosion particles
    const emitter = this.add.particles(this.component3Sprite.x, this.component3Sprite.y, 'proto_tile', {
      speed: { min: 60, max: 160 },
      scale: { start: 0.5, end: 0 },
      tint: [0xd4af37, 0xffd166, 0xff6600, 0x00f0ff],
      lifespan: 800,
      quantity: 28
    });
    this.time.delayedCall(850, () => emitter.destroy());

    this.component3Sprite.destroy();

    // Checkpoint 3 (Vault)
    this.checkpointX = LEVEL3_DATA.checkpoints[2].x;
    this.checkpointY = LEVEL3_DATA.checkpoints[2].y;

    // Refresh HUD
    this.hud.setFailsafeFound(3, 5);
    this.player.restoreStaffCharges(3);
    this.hud.updateCharges(this.player.staffCharges);

    this.cameras.main.flash(350, 255, 200, 60);
    this.hud.showBanner('COMPONENT 03 (CHRONO-PRISM) SECURED! ESCAPE TO HIGH TOWER!');

    // High Tower exit portal beacon
    if (this.exitPortalSprite) {
      this.tweens.add({
        targets: this.exitPortalSprite,
        scale: 2.8,
        duration: 400,
        yoyo: true,
        repeat: 3
      });
    }
  }

  // ── Level Completion & Exit ───────────────────────────────────────────────

  private handleLevelComplete(): void {
    if (!this.hasCollectedComponent3) {
      this.hud.showBanner('CANNOT ESCAPE — COMPONENT 03 MUST BE SECURED FIRST!');
      return;
    }

    if (this.physics.world.isPaused) return;
    this.physics.pause();

    this.hud.showBanner('SECTOR 3 INFILTRATION COMPLETE! EXTRACTION COMMENCED!');
    AudioManager.playFailsafe();

    this.cameras.main.fade(800, 10, 14, 25, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('LevelComplete', {
          failsafeCollected: 3,
          totalFailsafe: 5,
          deathCount: this.deathCount,
          timeMs: Date.now() - this.levelStartTime,
          sectorNumber: 3,
          alertCount: this.alertCount
        });
      }
    });
  }

  // ── Death & Respawn ───────────────────────────────────────────────────────

  private handleDeath(reason = 'SECURITY SYSTEM BREACH'): void {
    if (this.isRespawning) return;
    this.isRespawning = true;

    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    AudioManager.playDeath();

    this.cameras.main.shake(260, 0.016);
    this.cameras.main.flash(200, 160, 20, 20);
    this.hud.showBanner(`CRITICAL INFILTRATION FAILURE: ${reason}`);

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

  // ── Torch Lighting System ─────────────────────────────────────────────────

  private updateTorchLighting(time: number): void {
    if (!this.torchLightGfx) return;

    this.torchLightGfx.clear();

    const cam = this.cameras.main;
    const viewLeft = cam.scrollX - 50;
    const viewRight = cam.scrollX + cam.width + 50;

    this.torchHalos.forEach((halo, idx) => {
      // Cull offscreen torches
      if (halo.x < viewLeft || halo.x > viewRight) return;

      // Organic flame flicker
      const flicker = Math.sin((time * 0.008) + idx * 1.7) * 4 + Math.sin((time * 0.015) + idx * 2.3) * 2;
      const radius = halo.baseRadius + flicker;

      // Outer warm glow
      this.torchLightGfx!.fillStyle(0xff8800, 0.08);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius);

      // Mid warm light
      this.torchLightGfx!.fillStyle(0xffaa33, 0.12);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius * 0.65);

      // Core flame gleam
      this.torchLightGfx!.fillStyle(0xffdd66, 0.22);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius * 0.3);
    });
  }

  // ── Camera Tracking ───────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, LEVEL3_DATA.dimensions.width, LEVEL3_DATA.dimensions.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(40, 20);
  }

  // ── Pause Menu ────────────────────────────────────────────────────────────

  private togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    const cb: PauseMenuCallbacks = {
      onResume: () => this.resumeGame(),
      onRestart: () => {
        this.isPaused = false;
        this.physics.resume();
        this.scene.restart();
      },
      onMainMenu: () => {
        this.isPaused = false;
        this.physics.resume();
        this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
      }
    };
    this.pauseMenu = new PauseMenu(this, cb);
  }

  private resumeGame(): void {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.isPaused = false;
    this.physics.resume();
  }

  // ── Scanlines Overlay ─────────────────────────────────────────────────────

  private addScanlines(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const g = this.add.graphics().setScrollFactor(0).setAlpha(0.04).setDepth(100);
    g.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) {
      g.lineBetween(0, y, W, y);
    }
  }
}


