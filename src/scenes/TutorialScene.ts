import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { Player } from '../entities/Player';
import { TextureGenerator } from '../utils/TextureGenerator';
import { StaffController } from '../systems/staff/StaffController';
import { PhasingAbility } from '../abilities/PhasingAbility';
import { CamouflageAbility } from '../abilities/CamouflageAbility';
import { TimeAbility } from '../abilities/TimeAbility';
import { ThermalVent } from '../entities/ThermalVent';
import { TimeMovingPlatform } from '../systems/time/ITimeStateObject';
import { Guard } from '../entities/Guard';
import { AudioManager } from '../systems/AudioManager';

export type TutorialEntrySource = 'settings' | 'story';

interface TutorialSectionDef {
  sectionIndex: number;
  environmentName: string;
  category: string;
  title: string;
  objective: string;
  keycap: string;
  hint: string;
  accentColor: number;
  checkpointX: number;
  startX: number;
  endX: number;
}

export class TutorialScene extends Phaser.Scene {
  private source: TutorialEntrySource = 'settings';
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private waterPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private waterHazard!: Phaser.GameObjects.Rectangle;
  private portalSprite!: Phaser.GameObjects.Sprite;

  // Abilities & Staff
  private staffController!: StaffController;
  private phasingAbility!: PhasingAbility;
  private camouflageAbility!: CamouflageAbility;
  private timeAbility!: TimeAbility;

  // Environment elements
  private thermalVent?: ThermalVent;
  private palaceGuard?: Guard;
  private timePlatform?: TimeMovingPlatform;
  private phaseAPlatform?: Phaser.Physics.Arcade.Sprite;
  private phaseBPlatform?: Phaser.Physics.Arcade.Sprite;

  // State flags
  private currentSectionIndex = 1; // 1 to 5
  private hasUsedCamouflage = false; // Track camouflage usage for progression
  private hasUsedTimeFreeze = false; // Track time‑freeze usage for progression
  private isResetting = false; // Prevent multiple rapid resets
  private hasRodeVent = false;
  private isWaterFrozen = false;
  private isLeaving = false;
  private isCompletingSection = false;
  private transitionStarted = false;

  // Debounce so the StaffController path and the direct key path
  // can never fire the same ability twice for one key press.
  private lastAbilityUse: Record<string, number> = {};

  // UI Instruction Overlay (Reuses the existing tutorial aesthetic)
  private overlayPanel!: Phaser.GameObjects.Container;
  private progressIndicatorText!: Phaser.GameObjects.Text;
  private sectionCategoryText!: Phaser.GameObjects.Text;
  private sectionTitleText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private keycapBox!: Phaser.GameObjects.Container;
  private keycapText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private readonly sections: TutorialSectionDef[] = [
    {
      sectionIndex: 1,
      environmentName: 'SECTOR 1: FROZEN AGE',
      category: 'SECTION 1 / 5 // LOCOMOTION & ICE CONVERSION',
      title: 'BASIC MOVEMENT & WATER CONVERSION',
      objective: 'Move left/right, jump across gaps, then press [E / J] to freeze water into an ice bridge.',
      keycap: 'A/D, SPACE, E/J',
      hint: 'Water is lethal to touch! Quantum staff freezing turns water into a solid ice bridge.',
      accentColor: 0x00f0ff,
      checkpointX: 60,
      startX: 0,
      endX: 620
    },
    {
      sectionIndex: 2,
      environmentName: 'SECTOR 2: HEAT AGE',
      category: 'SECTION 2 / 5 // THERMAL CONVECTION',
      title: 'THERMAL VENT PROPULSION',
      objective: 'Press [E / J] while near the dormant volcanic vent to ignite it, then ride the updraft.',
      keycap: 'E / J',
      hint: 'Active thermal vents generate a vertical updraft that launches Vance to higher ledges.',
      accentColor: 0xff6600,
      checkpointX: 680,
      startX: 620,
      endX: 1220
    },
    {
      sectionIndex: 3,
      environmentName: 'SECTOR 3: MEDIEVAL PALACE',
      category: 'SECTION 3 / 5 // STEALTH PROTOCOL',
      title: 'TEMPORAL ILLUSION / CAMOUFLAGE',
      objective: 'Press [C / Q] to activate your optical cloak & deploy a decoy to bypass the royal sentry.',
      keycap: 'C / Q',
      hint: 'Royal guards possess deadly vision cones. Cloaking reduces their detection by over 60%.',
      accentColor: 0xc77dff,
      checkpointX: 1280,
      startX: 1220,
      endX: 1840
    },
    {
      sectionIndex: 4,
      environmentName: 'SECTOR 4: ANCIENT FOREST',
      category: 'SECTION 4 / 5 // CHRONO-STASIS',
      title: 'TIME FREEZE & MOVING PLATFORMS',
      objective: 'Press [T, E, or R] to freeze the oscillating chrono-platform in place and jump across the chasm.',
      keycap: 'T / E / R',
      hint: 'Time manipulation locks moving ancient mechanisms in stasis for several seconds.',
      accentColor: 0x39ff14,
      checkpointX: 1900,
      startX: 1840,
      endX: 2480
    },
    {
      sectionIndex: 5,
      environmentName: 'SECTOR 5: FUTURISTIC CORE',
      category: 'SECTION 5 / 5 // REALITY ANOMALIES',
      title: 'DIMENSIONAL PHASING & EXTRACTION',
      objective: 'Press [SHIFT / X] to switch between Reality Phase A and B, climb the platforms, and enter the extraction portal.',
      keycap: 'SHIFT / X',
      hint: 'Phase A platforms solidify in cyan reality; Phase B platforms solidify in amber reality.',
      accentColor: 0x00ffff,
      checkpointX: 2540,
      startX: 2480,
      endX: 3100
    }
  ];

  constructor() {
    super('TutorialScene');
  }

  init(data: { source?: TutorialEntrySource }): void {
    this.source = data?.source || 'settings';
    this.currentSectionIndex = 1;
    this.hasRodeVent = false;
    this.isWaterFrozen = false;
    this.hasUsedCamouflage = false;
    this.hasUsedTimeFreeze = false;
    this.isResetting = false;
    this.isCompletingSection = false;
    this.isLeaving = false;
    this.transitionStarted = false;
    this.lastAbilityUse = {};
  }

  create(): void {
    const H = this.scale.height;

    // 1. Generate all procedural textures across all level archetypes
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);
    TextureGenerator.generateCityTextures(this);
    TextureGenerator.generateFuturisticTextures(this);

    // 2. Continuous World Geometry Setup (3100px wide continuous level)
    const worldWidth = 3100;
    const worldHeight = H;

    // FIX: leave the BOTTOM edge open (left, right, up, down).
    // Previously the world floor caught the player, so falling into a gap
    // left them standing on-screen and the "fell off the map" check never fired.
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight, true, true, true, false);

    // Dark cyberpunk background
    this.add.rectangle(
      worldWidth / 2,
      H / 2,
      worldWidth,
      H,
      0x040812
    );

    // Initialize physics groups first
    this.platforms = this.physics.add.staticGroup();
    this.waterPlatforms = this.physics.add.staticGroup();

    // 3. Initialize Player BEFORE building the world
    this.player = new Player(this, 60, H - 70);

    // 4. Initialize Staff Controller & Abilities BEFORE building entities
    this.staffController = new StaffController(this, {
      initialAbilities: ['STAFF_ACTION', 'TIME', 'CAMOUFLAGE', 'PHASE'],
      defaultSelected: 'STAFF_ACTION'
    });

    this.player.setStaffController(this.staffController);

    this.phasingAbility = new PhasingAbility(this, this.player);
    this.camouflageAbility = new CamouflageAbility(this, this.player, {
      hudY: 310
    });
    this.timeAbility = new TimeAbility(this, this.player, []);

    // Register ability handlers (StaffController path). They go through the same
    // debounced helpers as the direct key path below, so nothing fires twice.
    this.staffController.registerAbilityHandler('PHASE', () => {
      this.usePhase();
      return true;
    });

    this.staffController.registerAbilityHandler('CAMOUFLAGE', () => {
      this.useCamouflage();
      return true;
    });

    this.staffController.registerAbilityHandler('TIME', () => {
      this.useTimeFreeze();
      return true;
    });

    // 5. NOW build the world.
    // Player and abilities already exist, so colliders and registrations are safe.
    this.buildContinuousWorld(H);

    // Add player collisions with static platforms
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.waterPlatforms);

    // 6. Connect Entities & Interactables
    this.setupSectionEntities();

    // Camera follow with smooth horizontal deadzone
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(400);

    // 7. Contextual Instruction Overlay Panel
    this.buildOverlayPanel();

    // 8. Keyboard input (abilities + ESC skip)
    this.setupInput();

    // Audio SFX on jump & land
    this.player.on('player_jump', () => AudioManager.playJump());
    this.player.on('player_land', () => AudioManager.playLand());
  }

  // ───────────────────────────────────────────────────────────
  // INPUT
  // ───────────────────────────────────────────────────────────

  /**
   * Event-based key handling. Unlike polling Key.JustDown(), events are not
   * "consumed", so StaffController can't swallow a key press before we see it.
   */
  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    const bind = (key: string, fn: () => void): void => {
      kb.on(`keydown-${key}`, (e: KeyboardEvent) => {
        if (e.repeat || this.isLeaving) return;
        fn();
      });
    };

    // E / J: staff action (water freeze, vent ignite). E also freezes time in Section 4.
    bind('E', () => {
      this.useStaffAction();
      if (this.currentSectionIndex === 4) this.useTimeFreeze();
    });
    bind('J', () => this.useStaffAction());

    // Camouflage
    bind('C', () => this.useCamouflage());
    bind('Q', () => this.useCamouflage());

    // Time freeze
    bind('T', () => this.useTimeFreeze());
    bind('R', () => this.useTimeFreeze());

    // Phase shift
    bind('X', () => this.usePhase());
    bind('SHIFT', () => this.usePhase());

    // ESC skips the tutorial (works even when the modal is open)
    kb.on('keydown-ESC', () => {
      this.finishTutorial();
    });
  }

  /** Ignore repeat triggers of the same ability within 250ms. */
  private triggerAbility(id: string, action: () => void): void {
    const now = this.time.now;
    const last = this.lastAbilityUse[id] ?? -Infinity;
    if (now - last < 250) return;
    this.lastAbilityUse[id] = now;
    action();
  }

  /** The tutorial must never soft-lock because the player ran out of charges. */
  private ensureCharge(): void {
    if (this.player.staffCharges < 1) {
      this.player.restoreStaffCharges(this.player.maxStaffCharges);
    }
  }

  private useStaffAction(): void {
    this.triggerAbility('STAFF_ACTION', () => {
      // Section 1: freeze the water
      if (
        this.currentSectionIndex === 1 &&
        !this.isWaterFrozen &&
        this.player.x > 380 &&
        this.player.x < 560
      ) {
        this.convertWaterToIce();
        return;
      }

      // Section 2: ignite the vent
      if (
        this.currentSectionIndex === 2 &&
        this.thermalVent &&
        Math.abs(this.player.x - 840) < 60
      ) {
        this.thermalVent.ignite();
        AudioManager.playKeyCollect();
        this.cameras.main.flash(140, 255, 100, 0);
      }
    });
  }

  private useCamouflage(): void {
    this.triggerAbility('CAMOUFLAGE', () => {
      this.ensureCharge();
      const result = this.camouflageAbility.activate() as boolean | void;
      // Count it as used unless activate() explicitly refused (false),
      // or the cloak is already active. A void return must NOT block progression.
      if (result !== false || this.camouflageAbility.cloaked) {
        this.hasUsedCamouflage = true;
      }
    });
  }

  private useTimeFreeze(): void {
    this.triggerAbility('TIME', () => {
      this.ensureCharge();
      const result = this.timeAbility.activate() as boolean | void;
      if (result !== false) {
        this.hasUsedTimeFreeze = true;
      }
    });
  }

  private usePhase(): void {
    this.triggerAbility('PHASE', () => {
      this.phasingAbility.toggleReality();
    });
  }

  // ───────────────────────────────────────────────────────────
  // WORLD
  // ───────────────────────────────────────────────────────────

  private buildContinuousWorld(H: number): void {
    const floorY = H - 24;

    // Left world boundary wall
    for (let y = 0; y <= floorY; y += 32) {
      this.platforms.create(0, y, 'tile_facility').refreshBody();
    }

    // ─────────────────────────────────────────────
    // SECTION 1: FROZEN AGE (x = 0 .. 620)
    // ─────────────────────────────────────────────
    // Ground 1: Safe starting practice zone [0 .. 220]
    for (let x = 0; x <= 220; x += 32) {
      this.platforms.create(x, floorY, 'tile_snow_top').refreshBody();
    }
    // Small jump gap [220 .. 280], elevated ledge [280 .. 420] at floorY - 24
    for (let x = 280; x <= 420; x += 32) {
      this.platforms.create(x, floorY - 24, 'tile_snow_top').refreshBody();
    }
    // Water Chasm [420 .. 580]
    this.waterHazard = this.add.rectangle(500, floorY + 4, 160, 24, 0x0077b6, 0.9);
    // Landing bank [580 .. 640] leading into Section 2
    for (let x = 580; x <= 640; x += 32) {
      this.platforms.create(x, floorY, 'tile_snow_top').refreshBody();
    }

    // Energy Conduit in Section 1
    this.createConduit(320, floorY - 56);

    // ─────────────────────────────────────────────
    // SECTION 2: HEAT AGE (x = 620 .. 1220)
    // ─────────────────────────────────────────────
    // Lava terrain & molten rock aesthetic
    for (let x = 640; x <= 880; x += 32) {
      this.platforms.create(x, floorY, 'tile_obsidian').refreshBody();
    }

    // Elevated volcanic ledge [960 .. 1220] at floorY - 80 (must use thermal vent updraft to reach!)
    for (let x = 960; x <= 1220; x += 32) {
      this.platforms.create(x, floorY - 80, 'tile_ember').refreshBody();
    }
    // Lava pit beneath the cliff [880 .. 960]
    this.add.rectangle(920, floorY + 6, 80, 20, 0xd00000, 0.95);

    // Thermal Vent placed at x = 840, floorY - 24
    this.thermalVent = new ThermalVent(this, 840, floorY - 24, 'updraft', 54, 130);

    // ─────────────────────────────────────────────
    // SECTION 3: MEDIEVAL PALACE (x = 1220 .. 1840)
    // ─────────────────────────────────────────────
    // Grand stone corridor
    for (let x = 1220; x <= 1840; x += 32) {
      this.platforms.create(x, floorY, 'tile_stone_top').refreshBody();
    }
    // Decorative gothic palace archway pillars
    const arch1 = this.add.graphics();
    arch1.fillStyle(0x1a1226, 0.85);
    arch1.fillRect(1240, 40, 16, floorY - 40);
    arch1.fillRect(1820, 40, 16, floorY - 40);
    arch1.lineStyle(1.5, 0x9d4edd, 0.7);
    arch1.strokeRect(1240, 40, 16, floorY - 40);
    arch1.strokeRect(1820, 40, 16, floorY - 40);

    // Royal Guard patrolling the hallway [x = 1450 to 1700]
    this.palaceGuard = new Guard(this, 1580, floorY - 32, 1450, 1720, {
      patrolSpeed: 45,
      alertSpeed: 100
    });
    this.physics.add.collider(this.palaceGuard, this.platforms);

    // Energy Conduit before stealth challenge
    this.createConduit(1270, floorY - 32);

    // ─────────────────────────────────────────────
    // SECTION 4: ANCIENT FOREST (x = 1840 .. 2480)
    // ─────────────────────────────────────────────
    // Overgrown ruins floor [1840 .. 2040]
    for (let x = 1840; x <= 2040; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // Big Ancient Chasm [2040 .. 2300]
    // Moving Time Platform oscillating horizontally between x = 2080 and 2240 at floorY - 36
    this.timePlatform = new TimeMovingPlatform(this, 'tut_time_platform', 2080, 2240, floorY - 36, 75);
    this.timeAbility.registerTimeObject(this.timePlatform);

    // Landing bank [2300 .. 2480] at floorY
    for (let x = 2300; x <= 2480; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // Energy Conduit before ancient forest chasm
    this.createConduit(1880, floorY - 32);

    // ─────────────────────────────────────────────
    // SECTION 5: FUTURISTIC CORE (x = 2480 .. 3100)
    // ─────────────────────────────────────────────
    // Cyber concrete floor [2480 .. 2680]
    for (let x = 2480; x <= 2680; x += 32) {
      this.platforms.create(x, floorY, 'tile_concrete_top').refreshBody();
    }

    // Phase A Platform (Solid in Reality A, cyan) at [2740] elevated at floorY - 35
    this.phaseAPlatform = this.physics.add.sprite(2740, floorY - 35, 'tile_phase_a');
    this.phaseAPlatform.setDisplaySize(72, 16);
    (this.phaseAPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(true).setAllowGravity(false);
    this.physics.add.collider(this.player, this.phaseAPlatform);

    this.phasingAbility.registerPhaseable({
      id: 'tut_phase_a',
      sprite: this.phaseAPlatform,
      body: this.phaseAPlatform.body as Phaser.Physics.Arcade.Body,
      activeRealities: ['A'],
      onRealityChanged: (curr) => {
        const isSolid = curr === 'A';
        this.phaseAPlatform?.setAlpha(isSolid ? 1 : 0.25);
        if (this.phaseAPlatform?.body) {
          (this.phaseAPlatform.body as Phaser.Physics.Arcade.Body).enable = isSolid;
        }
      }
    });

    // Phase B Platform (Solid in Reality B, amber) at [2860] elevated at floorY - 70
    this.phaseBPlatform = this.physics.add.sprite(2860, floorY - 70, 'tile_phase_b');
    this.phaseBPlatform.setDisplaySize(72, 16);
    (this.phaseBPlatform.body as Phaser.Physics.Arcade.Body).setImmovable(true).setAllowGravity(false);
    this.phaseBPlatform.setAlpha(0.25);
    (this.phaseBPlatform.body as Phaser.Physics.Arcade.Body).enable = false;
    this.physics.add.collider(this.player, this.phaseBPlatform);

    this.phasingAbility.registerPhaseable({
      id: 'tut_phase_b',
      sprite: this.phaseBPlatform,
      body: this.phaseBPlatform.body as Phaser.Physics.Arcade.Body,
      activeRealities: ['B'],
      onRealityChanged: (curr) => {
        const isSolid = curr === 'B';
        this.phaseBPlatform?.setAlpha(isSolid ? 1 : 0.25);
        if (this.phaseBPlatform?.body) {
          (this.phaseBPlatform.body as Phaser.Physics.Arcade.Body).enable = isSolid;
        }
      }
    });

    // Extraction Summit [2940 .. 3100] at floorY - 95
    for (let x = 2940; x <= 3100; x += 32) {
      this.platforms.create(x, floorY - 95, 'tile_concrete_top').refreshBody();
    }

    // Right world boundary wall
    for (let y = 0; y <= floorY; y += 32) {
      this.platforms.create(3100, y, 'tile_facility').refreshBody();
    }

    // Final Extraction Portal at x = 3030, y = floorY - 135
    this.portalSprite = this.add.sprite(3030, floorY - 135, 'exit_portal');
    this.portalSprite.setDisplaySize(38, 56).setTint(0x39ff14);
    this.physics.add.existing(this.portalSprite, true);
    this.physics.add.overlap(this.player, this.portalSprite, () => {
      this.completeTutorial();
    });
  }

  private setupSectionEntities(): void {
    // Colliders between player and time platform
    if (this.timePlatform) {
      this.physics.add.collider(this.player, this.timePlatform.sprite);
    }

    // Palace guard stealth detection interaction
    if (this.palaceGuard) {
      this.physics.add.overlap(this.player, this.palaceGuard, () => {
        // If caught uncloaked, bounce player back safely to Section 3 checkpoint
        if (!this.camouflageAbility.cloaked && !this.isResetting) {
          this.isResetting = true;
          AudioManager.playInsufficientCharge();
          this.respawnAtCurrentSection();
        }
      });
    }
  }

  private createConduit(x: number, y: number): void {
    const conduit = this.add.sprite(x, y, 'energy_conduit');
    conduit.setDisplaySize(18, 32).setTint(0x00f0ff);
    this.physics.add.existing(conduit, true);
    this.physics.add.overlap(this.player, conduit, () => {
      if (this.player.staffCharges < this.player.maxStaffCharges) {
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        AudioManager.playKeyCollect();
        this.cameras.main.flash(120, 0, 240, 255);
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────

  /**
   * FIX: A Container's scroll factor is NOT inherited by its children, and Phaser
   * hit-tests interactive children using their OWN scroll factor. That made every
   * button's clickable area drift by the camera scroll (huge at the end of the level),
   * so clicks missed. Pin every descendant to the screen explicitly.
   */
  private pinToScreen(obj: Phaser.GameObjects.GameObject): void {
    const sf = obj as unknown as Phaser.GameObjects.Components.ScrollFactor;
    sf.setScrollFactor?.(0);
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.list.forEach((child) => this.pinToScreen(child));
    }
  }

  /**
   * Compact, non-intrusive instruction panel docked at the top center of the screen.
   * Reuses the existing GlitchVerse tutorial visual design.
   */
  private buildOverlayPanel(): void {
    const W = this.scale.width;
    const panelW = 460;
    const panelH = 76;
    const panelX = W / 2;
    const panelY = 46;

    this.overlayPanel = this.add.container(panelX, panelY).setScrollFactor(0).setDepth(2000);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a101d, 0.94);
    bg.fillRect(-panelW / 2, -panelH / 2, panelW, panelH);
    bg.lineStyle(1.5, 0x00f0ff, 0.85);
    bg.strokeRect(-panelW / 2, -panelH / 2, panelW, panelH);

    // Neon corner brackets
    bg.lineStyle(2, 0x39ff14, 0.95);
    const cw = 5;
    bg.strokeRect(-panelW / 2 - 1, -panelH / 2 - 1, cw, cw);
    bg.strokeRect(panelW / 2 - cw + 1, -panelH / 2 - 1, cw, cw);
    bg.strokeRect(-panelW / 2 - 1, panelH / 2 - cw + 1, cw, cw);
    bg.strokeRect(panelW / 2 - cw + 1, panelH / 2 - cw + 1, cw, cw);
    this.overlayPanel.add(bg);

    // Category / Step indicator
    this.sectionCategoryText = this.add.text(-panelW / 2 + 14, -panelH / 2 + 8, '', {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '8px',
      color: '#00f0ff',
      letterSpacing: 1
    }).setOrigin(0, 0);
    this.overlayPanel.add(this.sectionCategoryText);

    this.progressIndicatorText = this.add.text(panelW / 2 - 14, -panelH / 2 + 8, 'SECTION 01 / 05', {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#39ff14'
    }).setOrigin(1, 0);
    this.overlayPanel.add(this.progressIndicatorText);

    // Title & Objective
    this.sectionTitleText = this.add.text(-panelW / 2 + 14, -panelH / 2 + 20, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0, 0);
    this.overlayPanel.add(this.sectionTitleText);

    this.objectiveText = this.add.text(-panelW / 2 + 14, -panelH / 2 + 35, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      color: '#e2e8f0',
      wordWrap: { width: panelW - 130 }
    }).setOrigin(0, 0);
    this.overlayPanel.add(this.objectiveText);

    // Keycap Badge
    this.keycapBox = this.add.container(panelW / 2 - 55, 4);
    const keycapGfx = this.add.graphics();
    keycapGfx.fillStyle(0x132238, 1);
    keycapGfx.fillRect(-45, -10, 90, 20);
    keycapGfx.lineStyle(1, 0x00f0ff, 0.9);
    keycapGfx.strokeRect(-45, -10, 90, 20);
    this.keycapBox.add(keycapGfx);

    this.keycapText = this.add.text(0, 0, '', {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#00f0ff'
    }).setOrigin(0.5);
    this.keycapBox.add(this.keycapText);
    this.overlayPanel.add(this.keycapBox);

    // Hint text & status
    this.hintText = this.add.text(-panelW / 2 + 14, panelH / 2 - 12, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '8px',
      color: '#8b9bb4'
    }).setOrigin(0, 0.5);
    this.overlayPanel.add(this.hintText);

    this.statusText = this.add.text(panelW / 2 - 14, panelH / 2 - 12, '[ IN PROGRESS ]', {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#ffd166'
    }).setOrigin(1, 0.5);
    this.overlayPanel.add(this.statusText);

    // Skip Tutorial mini button (top-right exterior)
    const skipBtn = this.add.container(panelW / 2 - 40, -panelH / 2 - 12);
    const sBg = this.add.graphics();
    sBg.fillStyle(0x0c1524, 0.9);
    sBg.fillRect(-38, -8, 76, 16);
    sBg.lineStyle(1, 0x3d5a80, 0.8);
    sBg.strokeRect(-38, -8, 76, 16);
    const sTxt = this.add.text(0, 0, 'SKIP TUTORIAL >>', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '7px',
      color: '#8b9bb4'
    }).setOrigin(0.5);
    const sHit = this.add.zone(0, 0, 76, 16).setInteractive({ useHandCursor: true });
    sHit.on('pointerover', () => { sTxt.setColor('#00f0ff'); });
    sHit.on('pointerout', () => { sTxt.setColor('#8b9bb4'); });
    sHit.on('pointerdown', () => { this.finishTutorial(); });
    skipBtn.add([sBg, sTxt, sHit]);
    this.overlayPanel.add(skipBtn);

    // FIX: make children (incl. the Skip button hit zone) screen-fixed too
    this.pinToScreen(this.overlayPanel);

    this.updateOverlayUI();
  }

  private updateOverlayUI(): void {
    const sec = this.sections[this.currentSectionIndex - 1];
    if (!sec) return;

    this.sectionCategoryText.setText(sec.category);
    this.sectionCategoryText.setColor('#' + sec.accentColor.toString(16).padStart(6, '0'));
    this.progressIndicatorText.setText(`SECTION 0${this.currentSectionIndex} / 05`);
    this.sectionTitleText.setText(sec.title);
    this.objectiveText.setText(sec.objective);
    this.keycapText.setText(sec.keycap);
    this.hintText.setText(sec.hint);
    this.statusText.setText('[ IN PROGRESS ]').setColor('#ffd166');

    // Pulse animation on section transition
    this.tweens.add({
      targets: this.overlayPanel,
      y: 49,
      duration: 120,
      yoyo: true,
      ease: 'Power1'
    });
  }

  private completeSection(secIdx: number): void {
    if (
      this.currentSectionIndex !== secIdx ||
      this.isCompletingSection
    ) return;

    this.isCompletingSection = true;

    AudioManager.playKeyCollect();
    this.statusText.setText('[ SECTION COMPLETED ✓ ]').setColor('#39ff14');

    this.time.delayedCall(700, () => {
      if (this.currentSectionIndex < 5) {
        this.currentSectionIndex = secIdx + 1;
        this.updateOverlayUI();
      }
      this.isCompletingSection = false;
    });
  }

  // ───────────────────────────────────────────────────────────
  // UPDATE LOOP
  // ───────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    if (this.isLeaving) return;

    this.player.update(time, delta);
    this.phasingAbility.update(time, delta);
    this.camouflageAbility.update(time, delta);
    this.timeAbility.update(time, delta);

    if (this.thermalVent) {
      this.thermalVent.update(delta, this.player);
    }

    if (this.palaceGuard && this.palaceGuard.active) {
      this.palaceGuard.update(time, delta, this.player.x, this.player.y, null, this.camouflageAbility.cloaked);
    }

    if (this.timePlatform) {
      this.timePlatform.update(time, delta);
    }

    // Fell off the map (world bottom is now open) -> reset to the section checkpoint
    if (!this.isResetting && this.player.y > this.scale.height + 20) {
      this.isResetting = true;
      this.respawnAtCurrentSection();
    }

    // Water is lethal until it has been frozen
    if (
      !this.isResetting &&
      this.currentSectionIndex === 1 &&
      !this.isWaterFrozen &&
      this.player.x > 425 &&
      this.player.x < 575 &&
      this.player.y > this.scale.height - 44
    ) {
      this.isResetting = true;
      this.respawnAtCurrentSection();
    }

    // ─────────────────────────────────────────────
    // SECTION 1: Locomotion & Water State Conversion
    // (the E / J press itself is handled in setupInput -> useStaffAction)
    // ─────────────────────────────────────────────
    if (this.currentSectionIndex === 1) {
      // Once across the ice bridge past x = 600, section 1 completes
      if (this.isWaterFrozen && this.player.x > 600) {
        this.completeSection(1);
      }
    }

    // ─────────────────────────────────────────────
    // SECTION 2: Heat Age Thermal Vent
    // ─────────────────────────────────────────────
    else if (this.currentSectionIndex === 2) {
      // Detect riding vent onto the elevated ledge at x > 960
      if (this.player.x > 960 && this.player.body?.blocked.down) {
        this.hasRodeVent = true;
      }

      if (this.hasRodeVent && this.player.x > 1200) {
        this.completeSection(2);
      }
    }

    // ─────────────────────────────────────────────
    // SECTION 3: Medieval Palace Stealth Protocol
    // ─────────────────────────────────────────────
    else if (this.currentSectionIndex === 3) {
      // Require camouflage usage before completing the stealth section.
      if (this.player.x > 1750 && this.hasUsedCamouflage) {
        this.completeSection(3);
      }
    }

    // ─────────────────────────────────────────────
    // SECTION 4: Ancient Forest Chrono-Stasis
    // ─────────────────────────────────────────────
    else if (this.currentSectionIndex === 4) {
      // Require Time Freeze and a safe landing beyond the chasm.
      if (
        this.player.x > 2320 &&
        this.player.body?.blocked.down &&
        this.hasUsedTimeFreeze
      ) {
        this.completeSection(4);
      }
    }

    // ─────────────────────────────────────────────
    // SECTION 5: Futuristic Core Dimensional Phasing
    // ─────────────────────────────────────────────
    else if (this.currentSectionIndex === 5) {
      // Player climbs summit and approaches portal
    }
  }

  private convertWaterToIce(): void {
    if (this.isWaterFrozen) return;
    this.isWaterFrozen = true;

    AudioManager.playTimeFreeze();
    this.cameras.main.flash(180, 0, 240, 255);

    // Create ice platform bridge over water
    for (let x = 430; x <= 570; x += 32) {
      const ice = this.waterPlatforms.create(x, this.scale.height - 24, 'tile_ice').refreshBody();
      (ice as Phaser.GameObjects.Sprite).setAlpha(0);
      this.tweens.add({ targets: ice, alpha: 1, duration: 250 });
    }

    if (this.waterHazard) {
      this.waterHazard.setFillStyle(0xade8f4, 0.95);
    }
  }

  private respawnAtCurrentSection(): void {
    const sec = this.sections[this.currentSectionIndex - 1];
    const safeX = sec ? sec.checkpointX : 60;
    this.player.respawnAt(safeX, this.scale.height - 70);
    (this.player.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);
    this.cameras.main.flash(200, 255, 0, 80);
    // Reset guard to allow future resets
    this.isResetting = false;
  }

  // ───────────────────────────────────────────────────────────
  // COMPLETION MODAL & SCENE TRANSITIONS
  // ───────────────────────────────────────────────────────────

  /**
   * Final completion celebration modal when reaching the extraction portal.
   */
  private completeTutorial(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;

    AudioManager.playKeyCollect();

    const W = this.scale.width;
    const H = this.scale.height;

    const modal = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(2200);

    const backdrop = this.add.rectangle(0, 0, W, H, 0x040814, 0.88).setInteractive();
    modal.add(backdrop);

    const boxW = 380;
    const boxH = 180;
    const box = this.add.graphics();
    box.fillStyle(0x0a101d, 0.98);
    box.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    box.lineStyle(2, 0x39ff14, 0.95);
    box.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

    // Corner brackets
    box.lineStyle(2, 0x00f0ff, 1);
    const cw = 6;
    box.strokeRect(-boxW / 2 - 1, -boxH / 2 - 1, cw, cw);
    box.strokeRect(boxW / 2 - cw + 1, -boxH / 2 - 1, cw, cw);
    box.strokeRect(-boxW / 2 - 1, boxH / 2 - cw + 1, cw, cw);
    box.strokeRect(boxW / 2 - cw + 1, boxH / 2 - cw + 1, cw, cw);
    modal.add(box);

    const title = this.add.text(0, -45, 'TRAINING SIMULATION COMPLETE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#39ff14',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);
    modal.add(title);

    const subtitle = this.add.text(0, -12, 'All 5 Sector Anomaly Protocols Verified.\nVance\'s Quantum Staff is fully calibrated for live missions.', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      color: '#e2e8f0',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);
    modal.add(subtitle);

    // Create a reusable, interactive modal button.
    const createActionButton = (
      x: number,
      y: number,
      label: string,
      callback: () => void,
      accentColor: number,
      width = 165
    ): void => {
      const btnW = width;
      const btnH = 30;
      const color = '#' + accentColor.toString(16).padStart(6, '0');
      const btn = this.add.container(x, y);

      const bgBtn = this.add.graphics();
      bgBtn.fillStyle(0x0c1524, 1);
      bgBtn.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
      bgBtn.lineStyle(1.5, accentColor, 1);
      bgBtn.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);

      const btnTxt = this.add.text(0, 0, label, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '8px',
        fontStyle: 'bold',
        color,
        align: 'center'
      }).setOrigin(0.5);

      const hit = this.add.zone(0, 0, btnW, btnH)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerover', () => {
        bgBtn.clear();
        bgBtn.fillStyle(0x1a2940, 1);
        bgBtn.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
        bgBtn.lineStyle(1.5, accentColor, 1);
        bgBtn.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
        btnTxt.setColor('#ffffff');
        try { AudioManager.playMenuHover(); } catch { /* sound must never block the UI */ }
      });

      hit.on('pointerout', () => {
        bgBtn.clear();
        bgBtn.fillStyle(0x0c1524, 1);
        bgBtn.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
        bgBtn.lineStyle(1.5, accentColor, 1);
        bgBtn.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
        btnTxt.setColor(color);
      });

      hit.on('pointerdown', () => {
        // A missing/throwing sound method must not stop the navigation
        try { AudioManager.playMenuSelect(); } catch { /* ignore */ }
        callback();
      });

      btn.add([bgBtn, btnTxt, hit]);
      modal.add(btn);
    };

    if (this.source === 'story') {
      // Story entry: offer both destinations.
      createActionButton(
        -88, 48, 'MAIN MENU',
        () => this.goToMainMenu(),
        0x00f0ff, 145
      );

      createActionButton(
        88, 48, 'PROCEED TO LEVEL 1 >>',
        () => this.proceedToLevelOne(),
        0x39ff14, 175
      );
    } else {
      // Settings entry: return to the menu and reopen Settings.
      createActionButton(
        0, 48, 'RETURN TO SETTINGS',
        () => this.returnToSettings(),
        0x39ff14, 190
      );
    }

    // FIX: pin the whole modal (backdrop, buttons, hit zones) to the screen
    // so clicks line up no matter where the camera has scrolled.
    this.pinToScreen(modal);

    // Keyboard fallback: ENTER takes the primary action (ESC is already bound).
    this.input.keyboard?.once('keydown-ENTER', () => this.finishTutorial());

    modal.setAlpha(0);
    this.tweens.add({ targets: modal, alpha: 1, duration: 200 });
  }

  private transitionToScene(sceneKey: string, data?: object): void {
    if (this.transitionStarted) return;

    this.transitionStarted = true;
    this.isLeaving = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  private goToMainMenu(): void {
    this.transitionToScene(GAME_CONFIG.sceneKeys.MainMenu);
  }

  private proceedToLevelOne(): void {
    // The existing project routes gameplay through GAME_CONFIG.sceneKeys.Game.
    this.transitionToScene(GAME_CONFIG.sceneKeys.Game);
  }

  private returnToSettings(): void {
    this.transitionToScene(
      GAME_CONFIG.sceneKeys.MainMenu,
      { openSettings: true }
    );
  }

  private finishTutorial(): void {
    // ESC / Skip keeps the existing source-dependent destination.
    if (this.source === 'story') {
      this.proceedToLevelOne();
    } else {
      this.returnToSettings();
    }
  }
}