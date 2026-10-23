import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { SentinelDrone } from '../entities/SentinelDrone';
import { PhasingAbility, RealityState, PhaseableObject } from '../abilities/PhasingAbility';
import { CamouflageAbility } from '../abilities/CamouflageAbility';
import { StaffController } from '../systems/staff/StaffController';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';

/**
 * LEVEL 5 DATA SPECIFICATION — FUTURISTIC CORE & FINAL ESCAPE
 * ─────────────────────────────────────────────────────────────
 * Look: Floating structures, holographic ads, neon architecture, glitching platforms,
 *       data streams, fragments of the original lab.
 * Palette: Navy (0x061124), Black (0x030814), Cyan (0x00f0ff), Electric Blue (0x00a8ff),
 *          Purple (0x7209b7), Magenta (0xff007f).
 */
export const LEVEL5_DATA = {
  id: 'level5',
  name: 'Futuristic Core',
  sector: 5,
  palette: {
    navy: 0x061124,
    black: 0x030814,
    cyan: 0x00f0ff,
    electricBlue: 0x00a8ff,
    purple: 0x7209b7,
    magenta: 0xff007f,
    skyTop: 0x02040a,
    skyBottom: 0x080f1e
  },
  dimensions: {
    width: 3300,
    height: 440,
    floorY: 340
  },
  spawn: { x: 80, y: 300 },
  checkpoints: [
    { id: 'cp_origin',    x: 80,   y: 300, label: 'CYBER-PROJECTION SPHERE' },
    { id: 'cp_chain',     x: 1640, y: 220, label: 'LAB FRAGMENT OBSERVATORY' },
    { id: 'cp_pedestal',  x: 2360, y: 300, label: 'FAILSAFE MATRIX PEDESTAL' }
  ],
  puzzle: {
    component5:    { x: 2180, y: 290 },
    failsafePedestal: { x: 2360, y: 300 },
    escapeBulkhead: { x: 2780, y: 280 },
    exitPortal:    { x: 3150, y: 220 }
  }
} as const;

export class Level5Scene extends Phaser.Scene {
  // Entities
  private player!: Player;
  private staffController!: StaffController;
  private phasing!: PhasingAbility;
  private camouflage!: CamouflageAbility;
  private drones: SentinelDrone[] = [];

  // Physics Groups
  private persistentPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private phaseAPlatforms: { sprite: Phaser.Physics.Arcade.Sprite; body: Phaser.Physics.Arcade.Body }[] = [];
  private phaseBPlatforms: { sprite: Phaser.Physics.Arcade.Sprite; body: Phaser.Physics.Arcade.Body }[] = [];

  // Finale Sequence
  private component5Sprite?: Phaser.Physics.Arcade.Sprite;
  private failsafeArraySprite?: Phaser.GameObjects.Sprite;
  private escapeBulkheadSprite?: Phaser.Physics.Arcade.Sprite;
  private exitPortalSprite?: Phaser.GameObjects.Sprite;

  private hasCollectedComponent5 = false;
  private isFailsafeRepaired = false;
  private isChamberCollapsing = false;
  private collapseProgress = 0;
  private collapseWallGfx?: Phaser.GameObjects.Graphics;

  // Progression & Checkpoints
  private checkpointX: number = LEVEL5_DATA.spawn.x;
  private checkpointY: number = LEVEL5_DATA.spawn.y;
  private deathCount = 0;
  private levelStartTime = 0;

  // UI
  private hud!: HUD;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private isPaused = false;

  // Visuals
  private dataStreamGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Level5Scene');
  }

  create(): void {
    AudioManager.init();
    this.levelStartTime = Date.now();

    // Generate textures
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateCityTextures(this);
    TextureGenerator.generateFuturisticTextures(this);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, LEVEL5_DATA.dimensions.width, 800);

    // Create striking futuristic core background
    this.createFuturisticBackground();

    // Physics static groups
    this.persistentPlatforms = this.physics.add.staticGroup();
    this.dataStreamGfx = this.add.graphics().setDepth(3);
    this.collapseWallGfx = this.add.graphics().setDepth(40);

    // Spawn player at checkpoint
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // Initialize StaffController with PHASE and CAMOUFLAGE
    this.staffController = new StaffController(this, {
      initialAbilities: ['PHASE', 'CAMOUFLAGE'],
      defaultSelected: 'PHASE',
      interactionRange: 95
    });
    this.player.setStaffController(this.staffController);

    // Initialize Phasing Ability
    this.phasing = new PhasingAbility(this, this.player);
    this.staffController.registerAbilityHandler('PHASE', () => this.phasing.toggleReality());

    // Initialize Camouflage Ability (used during the collapsing chamber gauntlet)
    this.camouflage = new CamouflageAbility(this, this.player);
    this.staffController.registerAbilityHandler('CAMOUFLAGE', () => this.camouflage.activate());

    // Build Cybernetic Architecture & Phasing Platform Chain
    this.buildCoreArchitecture();

    // Setup Finale Elements (Component 5, Failsafe Pedestal, Bulkhead, Exit)
    this.setupFinaleElements();

    // Setup Colliders
    this.setupColliders();

    // Setup HUD (4 / 5 recovered from S1, S2, S3, S4)
    this.hud = new HUD(this, 'SECTOR 5 · FUTURISTIC CORE', LEVEL5_DATA.palette.magenta);
    this.hud.setFailsafeFound(4, 5);
    this.hud.updateIntegrity(this.player.integrity);
    this.staffController.connectHud(this.hud);

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
      this.hud.showBanner('DIMENSIONAL PHASING: PRESS [SHIFT], [TAB], OR [X] TO SHIFT REALITY A & B');
    });

    // Cleanup listener on shutdown
    this.events.once('shutdown', () => {
      this.staffController.destroy();
      this.phasing.destroy();
      this.camouflage.destroy();
      this.drones.forEach(d => d.destroy());
      this.dataStreamGfx?.destroy();
      this.collapseWallGfx?.destroy();
    });

    // Fade in
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(time: number, delta: number): void {
    if (this.isPaused || this.player.isDead) return;

    // Update Player
    this.player.update(time, delta);

    // Update Staff Controller
    this.staffController.update(delta, this.player.x, this.player.y);

    // Fall death check
    if (this.player.y > 440 && !this.player.isDead) {
      this.handleDeath('DISINTEGRATION IN THE VOID');
      return;
    }

    // Update Phasing Ability
    this.phasing.update(time, delta);

    // Update Camouflage Ability
    this.camouflage.update(time, delta);

    // Update Drones
    this.drones.forEach(drone => {
      drone.update(time, delta, this.player.x, this.player.y);
    });

    // Animate background data streams
    this.renderDataStreams(time);

    // Animate collapsing chamber disintegration wave if active
    if (this.isChamberCollapsing) {
      this.updateChamberCollapse(delta);
    }
  }

  // ── Futuristic Background & Striking Cyber Aesthetics ─────────────────────

  private createFuturisticBackground(): void {
    const W = LEVEL5_DATA.dimensions.width;
    const H = LEVEL5_DATA.dimensions.height;

    // 1. Deep cosmic cyber-void gradient
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(
      LEVEL5_DATA.palette.skyTop,
      LEVEL5_DATA.palette.skyTop,
      LEVEL5_DATA.palette.skyBottom,
      LEVEL5_DATA.palette.skyBottom,
      1
    );
    sky.fillRect(0, 0, this.cameras.main.width, H);

    // 2. Translucent hyper-dimensional perspective grid (Parallax factor 0.15)
    const grid = this.add.graphics().setScrollFactor(0.15);
    grid.lineStyle(1, 0x00f0ff, 0.25);
    for (let x = -100; x < W + 400; x += 60) {
      grid.lineBetween(x, 40, x + 40, H);
    }
    for (let y = 60; y < H; y += 30) {
      grid.lineBetween(0, y, W, y);
    }

    // 3. Floating Holographic Neon Monoliths (Parallax factor 0.3)
    const monoliths = this.add.graphics().setScrollFactor(0.3);
    for (let x = -50; x < W + 300; x += 180) {
      const mh = 160 + ((x * 29) % 120);
      const isMagenta = (x / 180) % 2 === 0;
      const glowCol = isMagenta ? LEVEL5_DATA.palette.magenta : LEVEL5_DATA.palette.electricBlue;

      // Monolith body
      monoliths.fillStyle(0x0a0c18, 0.9);
      monoliths.fillRect(x, H - mh - 40, 48, mh);
      monoliths.lineStyle(1.5, glowCol, 0.7);
      monoliths.strokeRect(x, H - mh - 40, 48, mh);

      // Neon vertical telemetry stripe
      monoliths.fillStyle(glowCol, 0.6);
      monoliths.fillRect(x + 22, H - mh - 30, 4, mh - 20);
    }

    // 4. Fragments of the Original Lab floating in void (broken consoles, tiles)
    for (let x = 320; x < W; x += 400) {
      const frag = this.add.container(x, 140 + ((x * 13) % 80)).setDepth(2).setScrollFactor(0.4);
      const fg = this.add.graphics();
      fg.fillStyle(0x192538, 0.85);
      fg.fillRect(-24, -12, 48, 24);
      fg.lineStyle(1, 0x48cae4, 0.8);
      fg.strokeRect(-24, -12, 48, 24);
      // Blinking terminal screen
      fg.fillStyle(0x00f0ff, 0.9);
      fg.fillRect(-18, -6, 14, 12);
      frag.add(fg);

      // Subtle float tween
      this.tweens.add({
        targets: frag,
        y: frag.y - 12,
        yoyo: true,
        repeat: -1,
        duration: 2000 + ((x * 7) % 1000),
        ease: 'Sine.easeInOut'
      });
    }
  }

  // ── Core Architecture & Alternating Phasing Platforms ─────────────────────

  private buildCoreArchitecture(): void {
    const floorY = LEVEL5_DATA.dimensions.floorY;

    const addPersistent = (startX: number, endX: number, y: number) => {
      for (let x = startX; x <= endX; x += 32) {
        const top = this.persistentPlatforms.create(x, y, 'tile_glitch') as Phaser.Physics.Arcade.Sprite;
        top.setOrigin(0, 0).refreshBody();
        for (let subY = y + 32; subY <= 440; subY += 32) {
          const block = this.persistentPlatforms.create(x, subY, 'tile_glitch') as Phaser.Physics.Arcade.Sprite;
          block.setOrigin(0, 0).refreshBody();
        }
      }
    };

    // Helper to spawn phaseable platform
    const addPhasePlatform = (x: number, y: number, widthTiles = 2, reality: RealityState = 'A') => {
      const isA = reality === 'A';
      const tex = isA ? 'tile_phase_a' : 'tile_phase_b';

      for (let t = 0; t < widthTiles; t++) {
        const px = x + t * 32;
        const sprite = this.physics.add.sprite(px, y, tex).setOrigin(0, 0).setDepth(8);
        sprite.setImmovable(true);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.reset(px, y);

        // Register with PhasingAbility
        const phaseable: PhaseableObject = {
          id: `phase_${reality}_${px}_${y}`,
          sprite,
          body,
          activeRealities: [reality],
          onRealityChanged: (currReality: RealityState) => {
            const isActive = currReality === reality;
            if (isActive) {
              sprite.setAlpha(1);
              sprite.setTint(0xffffff);
              body.enable = true;
            } else {
              // Intangible wireframe
              sprite.setAlpha(0.22);
              sprite.setTint(0x555566);
              body.enable = false;
            }
          }
        };

        this.phasing.registerPhaseable(phaseable);

        if (isA) {
          this.phaseAPlatforms.push({ sprite, body });
        } else {
          this.phaseBPlatforms.push({ sprite, body });
        }
      }
    };

    // ── Zone 1: Cyber-Projection Spawn (x: 0 to 480) ───────────────────────
    addPersistent(0, 480, floorY);

    // Initial Phasing Introduction: two test platforms (3 tiles = 96px wide)
    addPhasePlatform(540, floorY, 3, 'A');
    addPhasePlatform(680, floorY, 3, 'B');
    addPhasePlatform(820, floorY, 3, 'A');

    // ── Zone 2: THE MID-JUMP ALTERNATING CHAIN PUZZLE (x: 800 to 1640) ────
    // Void abyss below! No floor!
    // Player must switch mid-jump between alternating A and B platforms!
    addPhasePlatform(960,  floorY,       2, 'A');
    addPhasePlatform(1090, floorY - 35,  2, 'B');
    addPhasePlatform(1220, floorY - 70,  2, 'A');
    addPhasePlatform(1350, floorY - 105, 2, 'B');
    addPhasePlatform(1480, floorY - 65,  2, 'A');
    addPhasePlatform(1600, floorY - 30,  2, 'B');

    // ── Zone 3: Lab Fragment Observatory Checkpoint (x: 1640 to 1900) ──────
    addPersistent(1640, 1900, floorY);

    // ── Zone 4: The Altar of the Singularity (x: 1900 to 2400) ────────────
    addPersistent(1900, 2400, floorY);

    // Altar pedestal for Component 5
    for (let x = 2160; x <= 2220; x += 32) {
      const p = this.persistentPlatforms.create(x, floorY - 24, 'tile_glitch') as Phaser.Physics.Arcade.Sprite;
      p.setOrigin(0, 0).refreshBody();
    }

    // ── Zone 5: The Collapsing Escape Gauntlet (x: 2400 to 3200) ───────────
    addPersistent(2400, 2520, floorY);

    // Collapsing phasing bridges
    addPhasePlatform(2560, floorY - 30, 2, 'A');
    addPhasePlatform(2660, floorY - 60, 2, 'B');

    addPersistent(2720, 2860, floorY);
    addPersistent(2900, 3200, floorY);

    // Rogue Singularity Drone guarding the final corridor
    const drone = new SentinelDrone(this, 2980, floorY - 80, 2920, 3080);
    this.drones.push(drone);
  }

  // ── Finale Elements Setup ─────────────────────────────────────────────────

  private setupFinaleElements(): void {
    const pz = LEVEL5_DATA.puzzle;

    // 1. Component 5: The Singularity Core
    this.component5Sprite = this.physics.add.sprite(pz.component5.x, pz.component5.y, 'relic_component5')
      .setDepth(12);
    (this.component5Sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.tweens.add({
      targets: this.component5Sprite,
      y: pz.component5.y - 10,
      scale: 1.15,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. Master Failsafe Matrix Array (Assembled upon interaction)
    this.failsafeArraySprite = this.add.sprite(pz.failsafePedestal.x, pz.failsafePedestal.y - 20, 'failsafe_array')
      .setDepth(11)
      .setAlpha(0);

    // 3. Emergency Escape Bulkhead Door (opens when failsafe triggers collapse)
    this.escapeBulkheadSprite = this.physics.add.sprite(pz.escapeBulkhead.x, pz.escapeBulkhead.y, 'electronic_door')
      .setDepth(10)
      .setImmovable(true);
    (this.escapeBulkheadSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // 4. The Master Extraction Rift (Exit Gateway)
    this.exitPortalSprite = this.add.sprite(pz.exitPortal.x, pz.exitPortal.y, 'failsafe_component')
      .setScale(2.5)
      .setDepth(15);

    this.tweens.add({
      targets: this.exitPortalSprite,
      scale: 3.2,
      alpha: 0.85,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ── Physics Colliders ─────────────────────────────────────────────────────

  private setupColliders(): void {
    // Player vs Persistent Platforms
    this.physics.add.collider(this.player, this.persistentPlatforms);

    // Player vs Phase A Platforms
    this.phaseAPlatforms.forEach(p => {
      this.physics.add.collider(this.player, p.sprite);
    });

    // Player vs Phase B Platforms
    this.phaseBPlatforms.forEach(p => {
      this.physics.add.collider(this.player, p.sprite);
    });

    // Player vs Emergency Bulkhead Door
    if (this.escapeBulkheadSprite) {
      this.physics.add.collider(this.player, this.escapeBulkheadSprite);
    }

    // Player vs Component 5 Overlap
    if (this.component5Sprite) {
      this.physics.add.overlap(this.player, this.component5Sprite, () => {
        this.collectComponent5();
      });
    }

    // Player vs Failsafe Pedestal Overlap
    const pedestalZone = this.add.zone(
      LEVEL5_DATA.puzzle.failsafePedestal.x,
      LEVEL5_DATA.puzzle.failsafePedestal.y,
      48, 48
    );
    this.physics.add.existing(pedestalZone, true);
    this.physics.add.overlap(this.player, pedestalZone, () => {
      if (this.hasCollectedComponent5 && !this.isFailsafeRepaired) {
        this.repairFailsafeMatrix();
      }
    });

    // Player vs Drones
    this.drones.forEach(drone => {
      this.physics.add.overlap(this.player, drone, () => {
        if (drone.isLethal && !this.player.isDead) {
          const lethal = this.player.takeDamage();
          if (lethal) {
            this.handleDeath('VAPORIZED BY SINGULARITY DRONE');
          } else {
            AudioManager.playDeath();
            this.cameras.main.shake(150, 0.015);
            this.cameras.main.flash(90, 255, 0, 128);
            this.hud.showBanner(`INTEGRITY CRITICAL: ${this.player.integrity} HP REMAINING`);
          }
        }
      });
    });

    // Player vs Exit Gateway
    if (this.exitPortalSprite) {
      const exitZone = this.add.zone(
        LEVEL5_DATA.puzzle.exitPortal.x,
        LEVEL5_DATA.puzzle.exitPortal.y,
        56, 72
      );
      this.physics.add.existing(exitZone, true);
      this.physics.add.overlap(this.player, exitZone, () => {
        this.triggerFinalVictory();
      });
    }
  }

  // ── Finale Sequence Logic ─────────────────────────────────────────────────

  private collectComponent5(): void {
    if (!this.component5Sprite || !this.component5Sprite.active || this.hasCollectedComponent5) return;

    this.hasCollectedComponent5 = true;
    AudioManager.playComponent3Collect();

    // Radiant magenta & cyan particle burst
    const emitter = this.add.particles(this.component5Sprite.x, this.component5Sprite.y, 'proto_tile', {
      speed: { min: 70, max: 200 },
      scale: { start: 0.6, end: 0 },
      tint: [0xff007f, 0x00f0ff, 0x9d4edd, 0xffffff],
      lifespan: 900,
      quantity: 32
    });
    this.time.delayedCall(950, () => emitter.destroy());

    this.component5Sprite.destroy();

    // Checkpoint
    this.checkpointX = LEVEL5_DATA.checkpoints[1].x;
    this.checkpointY = LEVEL5_DATA.checkpoints[1].y;

    // Refresh HUD
    this.hud.setFailsafeFound(5, 5);
    this.player.restoreStaffCharges(3);
    this.hud.updateCharges(this.player.staffCharges);

    this.cameras.main.flash(400, 255, 0, 128);
    this.hud.showBanner('COMPONENT 05 (SINGULARITY CORE) SECURED! INSERT INTO PEDESTAL!');
  }

  private repairFailsafeMatrix(): void {
    this.isFailsafeRepaired = true;
    AudioManager.playAssembleFailsafe();

    this.cameras.main.shake(300, 0.018);
    this.cameras.main.flash(500, 255, 255, 255);

    // Materialize the 5-crystal assembled array
    if (this.failsafeArraySprite) {
      this.failsafeArraySprite.setAlpha(1);
      this.tweens.add({
        targets: this.failsafeArraySprite,
        angle: 360,
        repeat: -1,
        duration: 4000
      });
    }

    this.hud.showBanner('FAILSAFE MATRIX ASSEMBLED! SIMULATION DE-SYNCHRONIZING — ESCAPE!');

    // Open emergency escape bulkhead door
    if (this.escapeBulkheadSprite) {
      this.tweens.add({
        targets: this.escapeBulkheadSprite,
        y: this.escapeBulkheadSprite.y - 70,
        alpha: 0.25,
        duration: 800,
        ease: 'Power2',
        onComplete: () => {
          (this.escapeBulkheadSprite?.body as Phaser.Physics.Arcade.Body).enable = false;
        }
      });
    }

    // Start Collapsing Chamber Sequence after 1.5 seconds!
    this.time.delayedCall(1500, () => {
      this.startChamberCollapse();
    });
  }

  private startChamberCollapse(): void {
    this.isChamberCollapsing = true;
    this.collapseProgress = 2000; // Starts advancing from altar
    AudioManager.playAlarm();

    // Red alert flashing strobe
    this.time.addEvent({
      delay: 1400,
      repeat: 8,
      callback: () => {
        if (!this.player.isDead) {
          this.cameras.main.flash(180, 255, 0, 60);
          AudioManager.playAlarm();
        }
      }
    });

    this.hud.showBanner('WARNING: SECTOR 5 CORE COLLAPSING! EVACUATE TO EXTRACTION RIFT!');
  }

  private updateChamberCollapse(delta: number): void {
    if (!this.collapseWallGfx) return;

    // Disintegration wave advances toward exit
    this.collapseProgress += delta * 0.09;
    const waveX = this.collapseProgress;

    this.collapseWallGfx.clear();

    // Render advancing disintegration void wall
    const H = this.cameras.main.height;
    this.collapseWallGfx.fillStyle(0xff0055, 0.35);
    this.collapseWallGfx.fillRect(0, 0, waveX, H);
    this.collapseWallGfx.fillStyle(0x00f0ff, 0.7);
    this.collapseWallGfx.fillRect(waveX - 8, 0, 16, H);
    this.collapseWallGfx.fillStyle(0xffffff, 0.9);
    this.collapseWallGfx.fillRect(waveX - 2, 0, 4, H);

    // If collapse catches player:
    if (this.player.x < waveX && !this.player.isDead) {
      this.handleDeath('CONSUMED BY SIMULATION COLLAPSE WAVE');
    }
  }

  private triggerFinalVictory(): void {
    if (!this.isFailsafeRepaired) {
      this.hud.showBanner('CANNOT ESCAPE — FAILSAFE MATRIX MUST BE ASSEMBLED FIRST!');
      return;
    }

    if (this.physics.world.isPaused) return;
    this.physics.pause();

    this.hud.showBanner('SIMULATION ESCAPE SUCCESSFUL! CONSCIOUSNESS DE-REZZING...');
    AudioManager.playVictory();

    // Brilliant whiteout flash fading into EndingScene
    this.cameras.main.fade(1000, 255, 255, 255, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('EndingScene', {
          deathCount: this.deathCount,
          timeMs: Date.now() - this.levelStartTime
        });
      }
    });
  }

  // ── Death & Respawn ───────────────────────────────────────────────────────

  private handleDeath(reason = 'DIMENSIONAL PARADOX'): void {
    if (this.player.isDead) return;
    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    AudioManager.playDeath();

    this.cameras.main.shake(280, 0.02);
    this.cameras.main.flash(200, 255, 0, 128);
    this.hud.showBanner(`CRITICAL ANOMALY: ${reason}`);

    this.time.delayedCall(700, () => {
      this.physics.pause();

      const callbacks: GameOverCallbacks = {
        onRespawn: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.player.restoreIntegrity();
          this.player.respawnAt(this.checkpointX, this.checkpointY);
          this.player.restoreStaffCharges(3);
          this.hud.updateIntegrity(this.player.integrity);
          this.hud.updateCharges(this.player.staffCharges);
          this.isChamberCollapsing = false;
          this.collapseWallGfx?.clear();
          this.cameras.main.fadeIn(400, 0, 0, 0);
        },
        onRestart: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.scene.restart();
        },
        onMainMenu: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.cameras.main.fadeOut(300, 0, 0, 0, () => {
            this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
          });
        }
      };

      this.gameOverScreen = new GameOverScreen(this, callbacks, reason);
    });
  }

  // ── Background Data Streams ───────────────────────────────────────────────

  private renderDataStreams(time: number): void {
    if (!this.dataStreamGfx) return;

    this.dataStreamGfx.clear();
    const cam = this.cameras.main;
    const left = cam.scrollX - 50;
    const right = cam.scrollX + cam.width + 50;

    for (let x = left; x <= right; x += 120) {
      const streamY = (time * 0.12 + (x * 7)) % 440;
      this.dataStreamGfx.fillStyle(0x00f0ff, 0.45);
      this.dataStreamGfx.fillRect(x, streamY, 2, 24);
      this.dataStreamGfx.fillStyle(0xffffff, 0.85);
      this.dataStreamGfx.fillRect(x, streamY + 20, 2, 4);
    }
  }

  // ── Camera Tracking ───────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, LEVEL5_DATA.dimensions.width, LEVEL5_DATA.dimensions.height);
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
