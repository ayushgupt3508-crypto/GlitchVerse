import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { LEVEL6_CONFIG, validateMechanicsUsage } from '../config/level6Config';
import { Player } from '../entities/Player';
import { SentinelDrone } from '../entities/SentinelDrone';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';
import { SaveSystem } from '../systems/SaveSystem';
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';
import { SeamTransition } from './level6/SeamTransition';
import { GauntletWorldBuilder } from './level6/GauntletWorldBuilder';
import { GauntletPuzzleManager } from './level6/GauntletPuzzleManager';

/**
 * Level6Scene — "The Gauntlet"
 * ────────────────────────────
 * Full bonus gauntlet level taking the player through all five worlds in order,
 * culminating in the Convergence Core finale chamber.
 */
export class Level6Scene extends Phaser.Scene {
  // Core Entities
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private drones: SentinelDrone[] = []; // S3 sentinel drones

  // Builders & Systems
  private worldBuilder!: GauntletWorldBuilder;
  private puzzleManager!: GauntletPuzzleManager;
  private seams: SeamTransition[] = [];

  // UI Components (shared)
  private hud!: HUD;
  private timerText!: Phaser.GameObjects.Text;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private mobileHandle: MobileSetupHandle | null = null;

  // Run State & Stats
  private attemptsRemaining = LEVEL6_CONFIG.maxAttempts;
  private timeRemainingMs: number = LEVEL6_CONFIG.timeLimitMs;
  private elapsedTimeMs = 0;
  private deathCount = 0;
  private checkpointX: number = LEVEL6_CONFIG.spawn.x;
  private checkpointY: number = LEVEL6_CONFIG.spawn.y;
  private currentCheckpointId = 'cp_start';

  // State Gates
  private isPaused = false;
  private isRespawning = false;
  private isLeavingScene = false;
  private isLevelComplete = false;

  // Active section tracking (1-6)
  private currentSection = 1;

  // S3 Camouflage state
  private isCloaked = false;
  private cloakTimer = 0;

  // S4 chronal barriers opened count (for objective tracking)
  private chronalBarriersOpened = 0;

  // S5 phase walls passed count (for objective tracking)
  private phaseWallsPassed = 0;

  // In-world portal & socket references
  private exitPortalSprite?: Phaser.Physics.Arcade.Sprite;
  private socketInteractiveSprites: Phaser.Physics.Arcade.Sprite[] = [];
  private keyPickupSprites: Phaser.Physics.Arcade.Sprite[] = [];

  constructor() {
    super('Level6Scene');
  }

  create(): void {
    // Dev-time validation check
    const validation = validateMechanicsUsage();
    if (!validation.valid) {
      console.warn('Level 6 mechanic requirements not met!', validation);
    }

    // Initialize Audio
    AudioManager.init();

    // Reset ALL per-run state
    this.attemptsRemaining = LEVEL6_CONFIG.maxAttempts;
    this.timeRemainingMs = LEVEL6_CONFIG.timeLimitMs;
    this.elapsedTimeMs = 0;
    this.deathCount = 0;
    this.checkpointX = LEVEL6_CONFIG.spawn.x;
    this.checkpointY = LEVEL6_CONFIG.spawn.y;
    this.currentCheckpointId = 'cp_start';
    this.isPaused = false;
    this.isRespawning = false;
    this.isLeavingScene = false;
    this.isLevelComplete = false;
    this.currentSection = 1;
    this.isCloaked = false;
    this.cloakTimer = 0;
    this.chronalBarriersOpened = 0;
    this.phaseWallsPassed = 0;
    this.drones = [];
    this.socketInteractiveSprites = [];
    this.keyPickupSprites = [];

    // Ensure all world textures exist
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);
    TextureGenerator.generateCityTextures(this);
    TextureGenerator.generateFuturisticTextures(this);
    TextureGenerator.generateGauntletRelicTextures(this);

    // Physics static groups
    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();

    // Setup world builder and generate all 6 world environments
    this.worldBuilder = new GauntletWorldBuilder(this, this.platforms, this.hazards);
    this.worldBuilder.buildAll();

    // Spawn S3 Sentinel Drones from world builder spawn points
    // These are wired after player creation (overlap setup needs both)
    this.worldBuilder.sentinelSpawnPoints.forEach(sp => {
      const drone = new SentinelDrone(this, sp.x, sp.y, sp.patrolLeft, sp.patrolRight);
      drone.setDepth(14);
      this.drones.push(drone);
    });

    // Spawn Player at spawn checkpoint
    this.player = new Player(this, this.checkpointX, this.checkpointY);
    this.player.setDepth(15);

    // Initialize Shared HUD
    this.hud = new HUD(this, 'SECTOR 6 · THE GAUNTLET', 0x00f0ff);
    this.hud.setFailsafeFound(0, 5);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);
    this.hud.onPauseClicked(() => this.togglePause());

    // On-screen Timer & Attempt HUD Indicator (fixed to camera)
    this.timerText = this.add.text(this.cameras.main.width / 2, 64, 'TIME 06:00 · ATTEMPTS 3/3', {
      fontFamily: '"Share Tech Mono", monospace',
      fontSize: '10px',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(60);

    // Initialize Puzzle & Objective Manager
    this.puzzleManager = new GauntletPuzzleManager(this, this.hud);
    this.puzzleManager.onStateChange = (type, data) => this.handlePuzzleStateChange(type, data);

    // Build Seam Transitions with exponential pixel curves and Bayer dither bands
    this.buildSeams();

    // Spawn Interactive Elements: Checkpoints, Keys, Sockets, Refills, and Portal
    this.spawnInteractiveElements();

    // Setup Colliders & Overlaps
    this.setupPhysicsColliders();

    // Setup Camera Tracking
    this.setupCamera();

    // Setup Keyboard Listeners
    this.setupInput();

    // Setup Mobile Controls (additive)
    this.setupMobile();

    // Scanlines Overlay for retro CRT immersion
    this.addScanlines();

    // Welcome banner
    this.time.delayedCall(400, () => {
      this.hud.showBanner('SECTOR 6 ONLINE · ALL 5 SECTORS SYNCHRONIZED · 3 ATTEMPTS REMAINING');
    });

    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Clean up on scene shutdown
    this.events.once('shutdown', () => {
      this.seams.forEach(s => s.destroy());
      this.seams = [];
      this.drones.forEach(d => d.destroy());
      this.drones = [];
      this.mobileHandle = null;
    });

    // Show section labels as player advances (timed from start)
    this.time.delayedCall(2000, () => {
      this.hud.showBanner('S1: FROZEN AGE — [E/J] FREEZE LIQUID NITROGEN TO ADVANCE');
    });
  }

  // ── Physics Colliders ───────────────────────────────────────────────────────
  private setupPhysicsColliders(): void {
    // Player vs Platforms (chronal barriers + phase walls also in staticGroup)
    this.physics.add.collider(this.player, this.platforms);

    // Player vs Hazards (water, lava, spikes, void chasms)
    this.physics.add.overlap(this.player, this.hazards, (_p, _h) => {
      this.handleHazardCollision('CRITICAL HAZARD STRIKE');
    });

    // S3 Sentinel Drones — damage player on contact unless cloaked
    this.drones.forEach(drone => {
      this.physics.add.overlap(this.player, drone, () => {
        if (!drone.isLethal || this.isRespawning || this.isLeavingScene) return;
        if (this.isCloaked) return; // safe while cloaked
        const lethal = this.player.takeDamage();
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleHazardCollision('ROYAL SENTINEL CONTACT — USE [E/J] CAMOUFLAGE');
        } else {
          AudioManager.playDeath();
          this.cameras.main.shake(150, 0.01);
          this.cameras.main.flash(80, 200, 0, 0);
          this.hud.showBanner(`SENTINEL BREACH! [E/J] CAMOUFLAGE TO PASS! INTEGRITY: ${this.player.integrity}`);
        }
      });
    });

    // Player Events
    this.player.on('player_damaged', (hp: number) => {
      this.hud.updateIntegrity(hp);
    });
    this.player.on('player_respawn', () => {
      this.hud.updateIntegrity(this.player.integrity);
      this.hud.updateCharges(this.player.staffCharges);
      // Always uncloak on respawn so player re-appears visibly
      this.isCloaked = false;
      this.cloakTimer = 0;
      this.player.setAlpha(1);
    });
    this.player.on('staff_used', (chargesLeft: number) => {
      this.hud.updateCharges(chargesLeft);
      this.puzzleManager.recordChargeUse();
      this.handleAbilityTrigger();
    });
    this.player.on('staff_empty', () => {
      this.hud.showBanner('STAFF ENERGY DEPLETED — FIND AN ENERGY CONDUIT!');
    });
  }


  // ── Seams & Transitions ─────────────────────────────────────────────────────
  private buildSeams(): void {
    this.seams = [];
    LEVEL6_CONFIG.seams.forEach((def, index) => {
      const seam = new SeamTransition(this, index, def, this.platforms);
      this.seams.push(seam);
    });
  }

  // ── Interactive World Spawns ────────────────────────────────────────────────
  private spawnInteractiveElements(): void {
    // 1. Checkpoint crystals
    LEVEL6_CONFIG.checkpoints.forEach(cp => {
      const crystal = this.physics.add.sprite(cp.x, cp.y, 'checkpoint_crystal')
        .setDepth(12);
      (crystal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

      this.physics.add.overlap(this.player, crystal, () => {
        if (this.currentCheckpointId !== cp.id) {
          this.currentCheckpointId = cp.id;
          this.checkpointX = cp.x;
          this.checkpointY = cp.y;
          crystal.setTexture('checkpoint_active');
          AudioManager.playCheckpoint();
          this.hud.showBanner(`CHECKPOINT REGISTERED: ${cp.label}`);
        }
      });
    });

    // 2. Refill Conduit Crystals — 2 per section, placed at floor level (y=290) before each ability use point
    const refillPositions = [
      // S1 — before channel 1 (x=880) and between channels 1 & 2
      { x: 820, y: 290 },   { x: 1290, y: 290 },
      // S2 — before lava 1 (x=2820) and between lava 1 & 2
      { x: 2740, y: 290 },  { x: 3160, y: 290 },
      // S3 — at entry and mid-section (both on castle floor)
      { x: 4640, y: 290 },  { x: 5150, y: 290 },
      // S4 — before barrier 1 and between barriers 2 & 3
      { x: 6830, y: 290 },  { x: 7450, y: 290 },
      // S5 — before phase wall 1 and between walls 2 & 3
      { x: 8710, y: 290 },  { x: 9660, y: 290 },
      // S6 — at entry
      { x: 10660, y: 290 }
    ];

    refillPositions.forEach(pos => {
      const crystal = this.physics.add.sprite(pos.x, pos.y, 'energy_conduit').setDepth(12);
      (crystal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({
        targets: crystal, y: pos.y - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.physics.add.overlap(this.player, crystal, () => {
        if (!crystal.active) return;
        crystal.setActive(false).setVisible(false);
        (crystal.body as Phaser.Physics.Arcade.Body).enable = false;
        AudioManager.playKeyCollect();
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        this.hud.updateCharges(this.player.staffCharges);
        this.hud.showBanner('ENERGY CONDUIT: STAFF FULLY RECHARGED!');
      });
    });

    // 3. Primary Sector Relic Collectibles — positioned above the ornate section altars
    const keyDefs = [
      { id: 'O1.3', keyNum: 1, x: 2080, y: 194, texture: 'relic_s1_frost',  color: 0x00f0ff, name: 'FROST RELIC' }, // S1 altar
      { id: 'O2.4', keyNum: 2, x: 4090, y: 194, texture: 'relic_s2_ember',  color: 0xff6b35, name: 'EMBER RELIC' }, // S2 altar
      { id: 'O3.4', keyNum: 3, x: 6150, y: 194, texture: 'relic_s3_royal',  color: 0xd4af37, name: 'ROYAL SIGIL' }, // S3 altar
      { id: 'O4.4', keyNum: 4, x: 8150, y: 194, texture: 'relic_s4_forest', color: 0x52b788, name: 'CHRONO SEED' }, // S4 altar
      { id: 'O5.4', keyNum: 5, x: 10170, y: 194, texture: 'relic_s5_rift',   color: 0xff007f, name: 'VOID SHARD' }  // S5 altar
    ];

    keyDefs.forEach(kd => {
      const keySprite = this.physics.add.sprite(kd.x, kd.y, kd.texture)
        .setDepth(14);
      (keySprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({
        targets: keySprite, y: kd.y - 12, scale: 1.25, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.tweens.add({
        targets: keySprite, angle: 360, duration: 3500, repeat: -1, ease: 'Linear'
      });

      this.physics.add.overlap(this.player, keySprite, () => {
        if (!keySprite.active) return;
        keySprite.setActive(false).setVisible(false);
        (keySprite.body as Phaser.Physics.Arcade.Body).enable = false;

        this.puzzleManager.completeObjective(kd.id);
        this.puzzleManager.collectKey(kd.keyNum);

        const emitter = this.add.particles(kd.x, kd.y, 'proto_tile', {
          speed: { min: 50, max: 140 }, scale: { start: 0.6, end: 0 },
          tint: [kd.color, 0xffffff], lifespan: 700, quantity: 24
        });
        this.time.delayedCall(750, () => emitter.destroy());
      });
      this.keyPickupSprites.push(keySprite);
    });

    // 4. Bonus Objective Caches — placed on accessible platforms or floor
    const bonusDefs = [
      { id: 'B1', x: 1900, y: 242, color: 0x00f0ff }, // S1 bonus ledge (y=265 platform)
      { id: 'B2', x: 3990, y: 232, color: 0xff6b35 }, // S2 altar approach (y=255 platform)
      { id: 'B3', x: 5700, y: 278, color: 0xd4af37 }, // S3 on drawbridge (y=295)
      { id: 'B4', x: 7600, y: 270, color: 0x52b788 }, // S4 on vine bridge (y=292)
      { id: 'B5', x: 9660, y: 290, color: 0xff007f }  // S5 on floor between void chasms
    ];

    bonusDefs.forEach(bd => {
      const cache = this.physics.add.sprite(bd.x, bd.y, 'failsafe_component')
        .setTint(bd.color).setDepth(13);
      (cache.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({
        targets: cache, y: bd.y - 8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.physics.add.overlap(this.player, cache, () => {
        if (!cache.active) return;
        cache.setActive(false).setVisible(false);
        (cache.body as Phaser.Physics.Arcade.Body).enable = false;
        AudioManager.playKeyCollect();
        this.puzzleManager.completeObjective(bd.id);
        this.hud.showBanner(`BONUS CACHE SECURED: ${bd.id}`);
      });
    });

    // 5. S6 Altar Interactive Triggers — aligned with altar pedestals (altar top at y=224)
    const socketXS = [10900, 11230, 11550, 11870, 12190];
    socketXS.forEach((sx, idx) => {
      const socketNum = idx + 1;
      const socketPad = this.physics.add.sprite(sx, 220, 'tile_holo_data')
        .setDisplaySize(96, 70).setDepth(12).setAlpha(0.01);
      (socketPad.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.physics.add.overlap(this.player, socketPad, () => {
        this.puzzleManager.attemptFillSocket(socketNum);
      });
      this.socketInteractiveSprites.push(socketPad);
    });

    // 6. Exit Portal — positioned after all sockets (x=12450)
    this.exitPortalSprite = this.physics.add.sprite(12450, 288, 'failsafe_component')
      .setScale(2.5).setDepth(15);
    (this.exitPortalSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({
      targets: this.exitPortalSprite, scale: 3.2, alpha: 0.8,
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this.physics.add.overlap(this.player, this.exitPortalSprite, () => {
      if (this.puzzleManager.socketsFilled.size === 5 && !this.isLeavingScene) {
        this.triggerVictory();
      } else if (!this.isLeavingScene && this.puzzleManager.socketsFilled.size < 5) {
        this.hud.showBanner(`PORTAL SEALED — ${5 - this.puzzleManager.socketsFilled.size} SOCKETS STILL EMPTY`);
      }
    });
  }

  // ── Input & Controls ────────────────────────────────────────────────────────
  private setupInput(): void {
    if (!this.input.keyboard) return;

    const keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    keyP.on('down', () => this.togglePause());

    const keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    keyEsc.on('down', () => this.togglePause());
  }

  private setupMobile(): void {
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,
      onAbilityPressed: () => {
        if (this.player.isDead || this.player.staffCharges <= 0) return;
        this.player.useStaff();
      },
      getAbilityState: () => {
        const sec = this.currentSection;
        let label = 'FREEZE';
        let tint = 0x00f0ff;

        if (sec === 2) {
          label = 'VENT';
          tint = 0xff6b35;
        } else if (sec === 3) {
          label = 'CLOAK';
          tint = 0xd4af37;
        } else if (sec === 4) {
          label = 'TIME';
          tint = 0x52b788;
        } else if (sec === 5) {
          label = 'PHASE';
          tint = 0xff007f;
        } else if (sec === 6) {
          label = 'MULTIVERSE';
          tint = 0x00f0ff;
        }

        return {
          label,
          available: this.player.staffCharges > 0 && !this.player.isDead,
          tint,
          cooldownProgress: 0
        };
      }
    });
  }

  // ── Ability Trigger Execution ───────────────────────────────────────────────
  private handleAbilityTrigger(): void {
    AudioManager.playStaffUse();
    const px = this.player.x;

    // ── S1: FREEZE — Convert liquid nitrogen channels into solid ice bridges ──
    if (px >= 600 && px <= 2300) {
      const frozenCount = this.worldBuilder.freezeWater();
      AudioManager.playDroneStun();
      if (frozenCount > 0) {
        this.cameras.main.flash(220, 0, 240, 255);
        this.hud.showBanner('❅ CRYOGENIC BURST: NITROGEN FROZEN — ICE BRIDGE FORMED! CROSS NOW!');
        // Sub-objectives by channel proximity
        if (px >= 800  && px <= 1160) this.puzzleManager.completeObjective('O1.1');
        if (px >= 1200 && px <= 1750) this.puzzleManager.completeObjective('O1.2');
      } else {
        this.hud.showBanner('❅ CRYOGENIC BURST: NITROGEN CHANNELS ALREADY FROZEN');
      }
    }
    // ── S2: VENT — Thermal updraft launches player up to vent-only bridges ──
    else if (px >= 2400 && px <= 4400) {
      this.player.setVelocityY(-480); // gives 144px rise — enough to reach y=200 bridge
      AudioManager.playJump();
      this.cameras.main.flash(160, 255, 90, 0);
      this.hud.showBanner('▲ THERMAL UPDRAFT: STEER TOWARD THE EMBER BRIDGE!');
      // Sub-objectives by position near each lava pit
      if (px >= 2780 && px <= 3070) this.puzzleManager.completeObjective('O2.1');
      if (px >= 3150 && px <= 3440) this.puzzleManager.completeObjective('O2.2');
      if (px >= 3480 && px <= 3730) this.puzzleManager.completeObjective('O2.3');
    }
    // ── S3: CAMOUFLAGE — Cloak player, drones receive fake coords and lose track ──
    else if (px >= 4500 && px <= 6400) {
      // Set cloak state — update loop will feed drones fake coords
      this.isCloaked = true;
      this.cloakTimer = 3500; // 3.5 seconds

      this.player.setAlpha(0.25);
      this.cameras.main.flash(160, 180, 200, 60);
      this.hud.showBanner('• TEMPORAL CAMOUFLAGE: 3.5s ACTIVE — GUARDS BLINDED, MOVE QUICKLY!');

      // Sub-objectives by proximity to each drone zone
      if (px >= 4700 && px <= 5050) this.puzzleManager.completeObjective('O3.1');
      if (px >= 5100 && px <= 5450) this.puzzleManager.completeObjective('O3.2');
      if (px >= 5500 && px <= 6100) this.puzzleManager.completeObjective('O3.3');
    }
    // ── S4: CHRONAL PULSE — Dissolve the nearest Chronal Barrier ──
    else if (px >= 6500 && px <= 8400) {
      const barrierIdx = this.worldBuilder.openNearestChronalBarrier(px, 280);
      if (barrierIdx >= 0) {
        this.chronalBarriersOpened++;
        AudioManager.playKeyCollect();
        this.cameras.main.flash(160, 70, 220, 70);
        this.hud.showBanner(`⧗ CHRONAL PULSE: BARRIER ${barrierIdx + 1}/3 DISSOLVED! PATH CLEAR!`);
        // Sub-objectives
        if (barrierIdx === 0) this.puzzleManager.completeObjective('O4.1');
        else if (barrierIdx === 1) this.puzzleManager.completeObjective('O4.2');
        else if (barrierIdx === 2) this.puzzleManager.completeObjective('O4.3');
      } else {
        // No barrier in range — smaller effect as feedback
        AudioManager.playKeyCollect();
        this.cameras.main.flash(100, 70, 180, 70);
        this.hud.showBanner('⧗ CHRONAL PULSE: APPROACH A LOCK BARRIER AND USE [E/J]');
      }
    }
    // ── S5: PHASE SHIFT — Teleport through nearest Phase Wall ──
    else if (px >= 8400 && px <= 10400) {
      const facingRight = !this.player.flipX;
      const newX = this.worldBuilder.teleportThroughPhaseWall(px, facingRight);
      if (newX >= 0) {
        // Successfully phased through a wall
        this.phaseWallsPassed++;
        this.player.x = newX;
        AudioManager.playDroneStun();
        this.cameras.main.flash(180, 255, 0, 140);
        this.hud.showBanner(`∅ PHASE SHIFT: WALL ${this.phaseWallsPassed}/3 PHASED THROUGH!`);
        // Sub-objectives
        if (this.phaseWallsPassed === 1) this.puzzleManager.completeObjective('O5.1');
        else if (this.phaseWallsPassed === 2) this.puzzleManager.completeObjective('O5.2');
        else if (this.phaseWallsPassed === 3) this.puzzleManager.completeObjective('O5.3');
      } else {
        // No wall ahead — give small teleport with feedback
        const dist = 72;
        this.player.x = Phaser.Math.Clamp(
          px + (facingRight ? dist : -dist), 8400, 10400
        );
        AudioManager.playDroneStun();
        this.cameras.main.flash(120, 200, 0, 100);
        this.hud.showBanner('∅ PHASE SHIFT: APPROACH A PHASE WALL AND USE [E/J] TO TELEPORT THROUGH');
      }
    }
    // ── S6: CONVERGENCE — Freeze the frost flume blocking Socket 1 ──
    else if (px >= 10400) {
      const frozenCount = this.worldBuilder.freezeWater(3);
      AudioManager.playAssembleFailsafe();
      this.cameras.main.flash(220, 0, 240, 255);
      if (frozenCount > 0) {
        this.hud.showBanner('★ CONVERGENCE RESONANCE: FROST FLUME SEALED — ADVANCE TO SOCKET 1!');
      } else {
        this.hud.showBanner('★ CONVERGENCE RESONANCE: USE ALL 5 KEYS TO FILL THE SOCKETS!');
      }
    }
  }

  // ── Puzzle State Handler ────────────────────────────────────────────────────
  private handlePuzzleStateChange(type: string, data: any): void {
    if (type === 'key') {
      const keyIndex = data as number;
      // Open corresponding seam gate
      if (this.seams[keyIndex - 1]) {
        this.seams[keyIndex - 1].openGate();
      }
    } else if (type === 'socket') {
      const socketNum = data as number;
      this.activateS6AltarVisuals(socketNum);
    } else if (type === 'surge' && data === 'impact') {
      // If player is moving in the open during surge impact, deal minor non-lethal glitch hit
      if (!this.player.isDead && !this.isRespawning) {
        this.player.takeDamage();
        this.puzzleManager.recordSurgeHit();
        this.hud.showBanner('WARNING: GLITCH SURGE DISRUPTED SYSTEMS (-1 INTEGRITY)');
      }
    }
  }

  /**
   * Activates radiant visual effects when a relic is placed on an S6 Convergence Altar.
   */
  private activateS6AltarVisuals(socketNum: number): void {
    const socketXS = [10900, 11230, 11550, 11870, 12190];
    const altarDefs = [
      { texture: 'relic_s1_frost',  color: 0x00f0ff, name: 'FROST RELIC' },
      { texture: 'relic_s2_ember',  color: 0xff6b35, name: 'EMBER RELIC' },
      { texture: 'relic_s3_royal',  color: 0xd4af37, name: 'ROYAL SIGIL' },
      { texture: 'relic_s4_forest', color: 0x52b788, name: 'CHRONO SEED' },
      { texture: 'relic_s5_rift',   color: 0xff007f, name: 'VOID SHARD' }
    ];
    const def = altarDefs[socketNum - 1];
    const sx = socketXS[socketNum - 1];
    if (!def || !sx) return;

    // Floating, illuminated relic placed into the altar
    const placedRelic = this.add.sprite(sx, 190, def.texture).setDepth(16);
    this.tweens.add({
      targets: placedRelic, y: 180, scale: 1.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: placedRelic, angle: 360, duration: 3000, repeat: -1, ease: 'Linear'
    });

    // Intense vertical beam shining up from the activated altar
    const beam = this.add.graphics().setDepth(15);
    beam.fillStyle(def.color, 0.35);
    beam.fillRect(sx - 8, 0, 16, 224);
    beam.fillStyle(0xffffff, 0.6);
    beam.fillRect(sx - 3, 0, 6, 224);

    // Continuous rising particles from activated altar
    this.add.particles(sx, 220, 'proto_tile', {
      speedY: { min: -120, max: -40 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.5, end: 0 },
      tint: [def.color, 0xffffff],
      lifespan: 1000,
      quantity: 2,
      frequency: 100
    }).setDepth(16);

    // Celebration status text
    this.add.text(sx, 140, `★ ACTIVATED\n${def.name}`, {
      fontFamily: '"Share Tech Mono", monospace',
      fontSize: '8px', fontStyle: 'bold',
      color: '#' + def.color.toString(16).padStart(6, '0'),
      backgroundColor: '#070b14',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(17);

    // Shockwave burst
    this.cameras.main.flash(180, 255, 255, 255);
  }

  // ── Main Update Loop ────────────────────────────────────────────────────────
  override update(time: number, delta: number): void {
    if (this.isPaused || this.isLeavingScene) return;

    this.timeRemainingMs -= delta;
    this.elapsedTimeMs += delta;

    if (this.timeRemainingMs <= 0) {
      this.timeRemainingMs = 0;
      this.handleGameOver('CHRONAL TIMEOUT: SIMULATION COLLAPSED');
      return;
    }

    this.player.update(time, delta);
    const remainingSec = Math.max(0, Math.floor(this.timeRemainingMs / 1000));
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    this.timerText.setText(`TIME ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} · ATTEMPTS ${this.attemptsRemaining}/3`);

    // S3 Cloak Timer
    if (this.isCloaked) {
      this.cloakTimer -= delta;
      if (this.cloakTimer <= 0) {
        this.isCloaked = false;
        this.cloakTimer = 0;
        if (!this.player.isDead) this.player.setAlpha(1);
        if (this.currentSection === 3) {
          this.hud.showBanner('CAMOUFLAGE EXPIRED — [E/J] TO RECLOAK');
        }
      }
    }

    // S3 Sentinel Drone Update — fake coords when cloaked so drones patrol away
    const droneTargetX = this.isCloaked ? -99999 : this.player.x;
    const droneTargetY = this.isCloaked ? -99999 : this.player.y;
    this.drones.forEach(d => d.update(time, delta, droneTargetX, droneTargetY));

    this.puzzleManager.updateSurge(delta, this.player);

    const px = this.player.x;
    if (px < 2400)       this.currentSection = 1;
    else if (px < 4500)  this.currentSection = 2;
    else if (px < 6500)  this.currentSection = 3;
    else if (px < 8500)  this.currentSection = 4;
    else if (px < 10500) this.currentSection = 5;
    else                 this.currentSection = 6;

    // Strict Barrier & Wall Enforcements:
    // S4 Chronal Pillars: player cannot pass through without using Chronal Pulse
    for (const barrier of this.worldBuilder.chronalBarriers) {
      if (!barrier.isOpen) {
        if (this.player.x > barrier.x - 24 && this.player.x < barrier.x + 48) {
          this.player.x = barrier.x - 24;
          this.player.setVelocityX(0);
        }
      }
    }

    // S5 Phase Walls: player cannot pass through without using Phase Shift
    for (const pw of this.worldBuilder.phaseWalls) {
      if (!pw.isPassed) {
        if (this.player.x > pw.x - 24 && this.player.x < pw.x + pw.width + 24) {
          this.player.x = pw.x - 24;
          this.player.setVelocityX(0);
        }
      }
    }

    this.seams.forEach(seam => {
      if (px >= seam.def.x1 && !seam.hasCrossed) {
        seam.triggerCrossingEffect();
      }
    });

    if (this.player.y > LEVEL6_CONFIG.dimensions.floorY + 50 && !this.isRespawning) {
      this.handleHazardCollision('FALLEN INTO VOID ABYSS');
    }

    this.mobileHandle?.update();
  }


  // ── Hazard & Death Handling ─────────────────────────────────────────────────
  private handleHazardCollision(reason: string): void {
    if (this.isRespawning || this.isLeavingScene) return;

    const lethal = this.player.takeDamage();
    if (lethal || this.player.integrity <= 0 || this.player.isDead) {
      this.deathCount++;
      this.attemptsRemaining--;

      AudioManager.playDeath();
      this.cameras.main.shake(250, 0.015);

      if (this.attemptsRemaining <= 0) {
        this.handleGameOver(reason);
      } else {
        this.respawnAtCheckpoint();
      }
    }
  }

  private respawnAtCheckpoint(): void {
    this.isRespawning = true;
    this.hud.showBanner(`CRITICAL SYSTEM RESET: ${this.attemptsRemaining} ATTEMPTS REMAINING`);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.player.respawnAt(this.checkpointX, this.checkpointY);
      this.cameras.main.fadeIn(350, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.isRespawning = false;
      });
    });
  }

  private handleGameOver(reason: string): void {
    if (this.isLeavingScene) return;
    this.isLeavingScene = true;

    this.physics.pause();
    this.gameOverScreen = new GameOverScreen(this, {
      onRespawn: () => {
        this.isLeavingScene = false;
        this.gameOverScreen?.destroy();
        this.gameOverScreen = null;
        this.physics.resume();
        this.respawnAtCheckpoint();
      },
      onRestart: () => {
        this.isLeavingScene = false;
        this.scene.restart();
      },
      onMainMenu: () => {
        this.isLeavingScene = false;
        this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
      }
    }, reason);
    this.add.existing(this.gameOverScreen);
  }

  // ── Victory Sequence ────────────────────────────────────────────────────────
  private triggerVictory(): void {
    if (this.isLeavingScene || this.isLevelComplete) return;
    this.isLeavingScene = true;
    this.isLevelComplete = true;

    this.physics.pause();
    AudioManager.playVictory();
    this.hud.showBanner('GAUNTLET CLEARED: EXTRACTION MATRIX SYNCHRONIZED!');

    // Calculate Final Score Breakdown
    const scoreResult = this.puzzleManager.calculateFinalScore(
      this.timeRemainingMs,
      this.attemptsRemaining
    );

    // Save Score & Mark Complete in SaveSystem
    SaveSystem.saveLevel6Score(scoreResult.totalScore);
    SaveSystem.markLevelCompleted(6, scoreResult.totalScore);

    // Fade to LevelCompleteScene with standard payload shape
    const cam = this.cameras.main;
    cam.fadeOut(600, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelComplete', {
        failsafeCollected: 5,
        totalFailsafe: 5,
        deathCount: this.deathCount,
        timeMs: this.elapsedTimeMs,
        sectorNumber: 6,
        alertCount: this.puzzleManager.alertCount
      });
    });
  }

  // ── Pause Menu ──────────────────────────────────────────────────────────────
  private togglePause(): void {
    if (this.isLeavingScene || this.player.isDead) return;

    if (!this.isPaused) {
      this.isPaused = true;
      this.physics.pause();
      this.pauseMenu = new PauseMenu(this, {
        onResume: () => {
          this.isPaused = false;
          this.physics.resume();
          this.pauseMenu?.destroy();
          this.pauseMenu = null;
        },
        onRestart: () => {
          this.isPaused = false;
          this.scene.restart();
        },
        onMainMenu: () => {
          this.isPaused = false;
          this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
        }
      });
    } else if (this.pauseMenu) {
      this.pauseMenu.destroy();
      this.pauseMenu = null;
      this.isPaused = false;
      this.physics.resume();
    }
  }

  // ── Camera Setup ────────────────────────────────────────────────────────────
  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.setBounds(0, 0, LEVEL6_CONFIG.dimensions.width, LEVEL6_CONFIG.dimensions.height);
    this.physics.world.setBounds(0, 0, LEVEL6_CONFIG.dimensions.width, LEVEL6_CONFIG.dimensions.height + 100);
  }

  // ── Visual Overlay ──────────────────────────────────────────────────────────
  private addScanlines(): void {
    const scanlines = this.add.graphics().setAlpha(0.06).setDepth(100).setScrollFactor(0);
    scanlines.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < 360; y += 3) {
      scanlines.lineBetween(0, y, 640, y);
    }
  }
}
