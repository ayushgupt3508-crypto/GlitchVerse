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
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';
import { RealitySwapSystem, RiftNodeDef } from '../systems/RealitySwapSystem';
import { DeviceInfo } from '../utils/DeviceDetector';

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

const TOTAL_SECTIONS = 7;

export class TutorialScene extends Phaser.Scene {
  private source: TutorialEntrySource = 'settings';
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private waterPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private waterHazard!: Phaser.GameObjects.Rectangle;
  private portalSprite!: Phaser.GameObjects.Sprite;

  private mobileHandle: MobileSetupHandle | null = null;

  // Abilities & Staff
  private staffController!: StaffController;
  private phasingAbility!: PhasingAbility;
  private camouflageAbility!: CamouflageAbility;
  private timeAbility!: TimeAbility;

  // Environment elements
  private thermalVent?: ThermalVent;
  private palaceGuard?: Guard;
  private timePlatform?: TimeMovingPlatform;
  private realitySwap?: RealitySwapSystem;
  private sentinelCursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private sentinelKeys?: {
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };

  private ancientPlantGfx?: Phaser.GameObjects.Graphics;
  private fungusBouncePad?: Phaser.GameObjects.Ellipse;
  private readonly FUNGUS_X = 2660;

  private phaseAPlatform?: Phaser.Physics.Arcade.Sprite;
  private phaseBPlatform?: Phaser.Physics.Arcade.Sprite;

  // State flags
  private currentSectionIndex = 1;
  private hasUsedCamouflage = false;
  private hasUsedTimeFreeze = false;
  private hasGrownAncientPlant = false;
  private hasBouncedOnFungus = false;

  private sentinelTutorialComplete = false;
  private hasUsedTutorialPhase = false;
  private hasCompletedFinalSection = false;
  private wasPossessing = false;

  private isResetting = false;
  private hasRodeVent = false;
  private isWaterFrozen = false;
  private isLeaving = false;
  private isCompletingSection = false;
  private transitionStarted = false;

  // Ability debounce
  private lastAbilityUse: Record<string, number> = {};

  // UI Overlay
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
      category: 'SECTION 1 / 7 // LOCOMOTION & ICE CONVERSION',
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
      category: 'SECTION 2 / 7 // THERMAL CONVECTION',
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
      category: 'SECTION 3 / 7 // STEALTH PROTOCOL',
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
      category: 'SECTION 4 / 7 // CHRONO-STASIS',
      title: 'CHRONO-STASIS',
      objective: 'Press [T / R] near the moving chrono-platform to freeze it in place, then jump across and reach the far bank.',
      keycap: 'T / R: FREEZE',
      hint: 'Time freeze locks nearby time-linked objects. Freeze the platform when it lines up with the far bank.',
      accentColor: 0x39ff14,
      checkpointX: 1900,
      startX: 1840,
      endX: 2480
    },
    {
      sectionIndex: 5,
      environmentName: 'SECTOR 4: ANCIENT FOREST',
      category: 'SECTION 5 / 7 // ANCIENT GROWTH',
      title: 'BOUNCY FUNGUS',
      objective: 'Press [E / J] near the dormant fungus to grow it, bounce on its cap, and land on the raised platforms.',
      keycap: 'E / J: GROW',
      hint: 'The awakened fungus cap is springy. Land on it to launch Vance onto the elevated platforms.',
      accentColor: 0x39ff14,
      checkpointX: 2540,
      startX: 2480,
      endX: 3120
    },
    {
      sectionIndex: 6,
      environmentName: 'SECTOR 5: FUTURISTIC CORE',
      category: 'SECTION 6 / 7 // REALITY SHIFT',
      title: 'REALITY SHIFT',
      objective: 'Press [SHIFT / X] to phase between realities. Jump onto the solid platform, shift mid-air so the next one materializes, then reach the ledge.',
      keycap: 'SHIFT / X: PHASE',
      hint: 'Each platform only exists in one reality. Shift while jumping, because the platform under you vanishes when you shift.',
      accentColor: 0x00ffff,
      checkpointX: 3180,
      startX: 3120,
      endX: 3760
    },
    {
      sectionIndex: 7,
      environmentName: 'SECTOR 5: FUTURISTIC CORE',
      category: 'SECTION 7 / 7 // ECHO SENTINEL',
      title: 'ECHO SENTINEL POSSESSION',
      objective: 'At the Rift Node press [E / J] to possess the Echo Sentinel, cross the ghost platforms to its terminal, then press [E / J] again to swap places.',
      keycap: 'E / J: SENTINEL',
      hint: 'Vance stays in stasis while the Sentinel moves. Use A/D and SPACE before the possession timer expires.',
      accentColor: 0x00ffff,
      checkpointX: 3820,
      startX: 3760,
      endX: 4400
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
    this.hasGrownAncientPlant = false;
    this.hasBouncedOnFungus = false;

    this.sentinelTutorialComplete = false;
    this.hasUsedTutorialPhase = false;
    this.hasCompletedFinalSection = false;
    this.wasPossessing = false;

    this.isResetting = false;
    this.isCompletingSection = false;
    this.isLeaving = false;
    this.transitionStarted = false;

    this.lastAbilityUse = {};
  }

  create(): void {
    const H = this.scale.height;

    // Generate procedural textures
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);
    TextureGenerator.generateCityTextures(this);
    TextureGenerator.generateFuturisticTextures(this);

    // Continuous world geometry
    const worldWidth = 4400;
    const worldHeight = H;

    // Leave bottom edge open so falling resets the player.
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight, true, true, true, false);

    // Background
    this.add.rectangle(worldWidth / 2, H / 2, worldWidth, H, 0x040812);

    // Physics groups
    this.platforms = this.physics.add.staticGroup();
    this.waterPlatforms = this.physics.add.staticGroup();

    // Player
    this.player = new Player(this, 60, H - 70);

    // Staff controller
    this.staffController = new StaffController(this, {
      initialAbilities: ['STAFF_ACTION', 'TIME', 'CAMOUFLAGE', 'PHASE'],
      defaultSelected: 'STAFF_ACTION'
    });

    this.player.setStaffController(this.staffController);

    // Abilities
    this.phasingAbility = new PhasingAbility(this, this.player);
    this.camouflageAbility = new CamouflageAbility(this, this.player, { hudY: 310 });
    this.timeAbility = new TimeAbility(this, this.player, []);

    // Register camouflage handler
    this.staffController.registerAbilityHandler('CAMOUFLAGE', () => {
      this.useCamouflage();
      return true;
    });

    // Build world
    this.buildContinuousWorld(H);

    // Player collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.waterPlatforms);

    // Setup entities
    this.setupSectionEntities();

    // Camera
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(400);

    // Tutorial overlay
    this.buildOverlayPanel();

    // Keyboard
    this.setupInput();

    // Mobile controls
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,

      onAbilityPressed: () => {
        if (this.isLeaving || this.isResetting) return;

        switch (this.currentSectionIndex) {
          case 1:
          case 2:
            this.useStaffAction();
            break;
          case 3:
            this.useCamouflage();
            break;
          case 4:
            this.useTimeFreeze();
            break;
          case 5:
            this.growAncientPlant();
            break;
          case 6:
            this.usePhase();
            break;
          case 7:
            this.handleSentinelAbility();
            break;
        }
      },

      getAbilityState: () => {
        const states = {
          1: { label: 'FREEZE', tint: 0x00f0ff },
          2: { label: 'IGNITE', tint: 0xff6600 },
          3: { label: 'CLOAK', tint: 0xc77dff },
          4: { label: 'TIME', tint: 0x39ff14 },
          5: { label: 'GROW', tint: 0x39ff14 },
          6: { label: 'PHASE', tint: 0x00ffff },
          7: { label: 'ECHO', tint: 0x00ffff }
        };

        const state = states[this.currentSectionIndex as keyof typeof states];

        return {
          label: state.label,
          available: !this.player.isDead && !this.isLeaving && !this.isResetting,
          tint: state.tint,
          cooldownProgress: 0
        };
      }
    });

    // Jump and landing sounds
    this.player.on('player_jump', () => AudioManager.playJump());
    this.player.on('player_land', () => AudioManager.playLand());
  }

  // ───────────────────────────────────────────
  // INPUT
  // ───────────────────────────────────────────

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    const bind = (key: string, fn: () => void): void => {
      kb.on(`keydown-${key}`, (e: KeyboardEvent) => {
        if (e.repeat || this.isLeaving) return;
        fn();
      });
    };

    // E / J: contextual staff action
    const contextualAction = (): void => {
      if (this.currentSectionIndex === 7) {
        this.handleSentinelAbility();
      } else {
        this.useStaffAction();
      }
    };

    bind('E', contextualAction);
    bind('J', contextualAction);

    // Camouflage
    bind('C', () => this.useCamouflage());
    bind('Q', () => this.useCamouflage());

    // Time freeze
    bind('T', () => this.useTimeFreeze());
    bind('R', () => this.useTimeFreeze());

    // Reality phase
    bind('X', () => this.usePhase());
    bind('SHIFT', () => this.usePhase());

    // Skip tutorial
    kb.on('keydown-ESC', () => {
      this.finishTutorial();
    });
  }

  private triggerAbility(id: string, action: () => void): void {
    const now = this.time.now;
    const last = this.lastAbilityUse[id] ?? -Infinity;

    if (now - last < 250) return;

    this.lastAbilityUse[id] = now;
    action();
  }

  private ensureCharge(): void {
    if (this.player.staffCharges < 1) {
      this.player.restoreStaffCharges(this.player.maxStaffCharges);
    }
  }

  private useStaffAction(): void {
    this.triggerAbility('STAFF_ACTION', () => {
      // Section 1: freeze water
      if (
        this.currentSectionIndex === 1 &&
        !this.isWaterFrozen &&
        this.player.x > 380 &&
        this.player.x < 560
      ) {
        this.convertWaterToIce();
        return;
      }

      // Section 2: ignite thermal vent
      if (
        this.currentSectionIndex === 2 &&
        this.thermalVent &&
        Math.abs(this.player.x - 840) < 60
      ) {
        this.thermalVent.ignite();
        AudioManager.playKeyCollect();
        this.cameras.main.flash(140, 255, 100, 0);
      }

      // Section 5: grow fungus
      if (this.currentSectionIndex === 5) {
        this.growAncientPlant();
      }
    });
  }

  private useCamouflage(): void {
    this.triggerAbility('CAMOUFLAGE', () => {
      this.ensureCharge();

      const result = this.camouflageAbility.activate() as boolean | void;

      if (result !== false || this.camouflageAbility.cloaked) {
        this.hasUsedCamouflage = true;
      }
    });
  }

  // TimeAbility detects this hook and skips its own key listeners.
  public handleStaffPulse(): void {
    // Handled by setupInput().
  }

  private useTimeFreeze(): void {
    this.triggerAbility('TIME', () => {
      this.ensureCharge();

      const result = this.timeAbility.activate() as boolean | void;

      if (
        result !== false &&
        this.timePlatform &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.timePlatform.x,
          this.timePlatform.y
        ) <= this.timeAbility.RADIUS
      ) {
        this.hasUsedTimeFreeze = true;

        if (this.currentSectionIndex === 4) {
          this.statusText
            ?.setText('[ PLATFORM FROZEN · CROSS TO THE FAR BANK ]')
            .setColor('#39ff14');
        }
      }
    });
  }

  // ───────────────────────────────────────────
  // SECTION 5: ANCIENT FUNGUS
  // ───────────────────────────────────────────

  private growAncientPlant(): void {
    if (this.currentSectionIndex !== 5 || this.hasGrownAncientPlant) return;
    if (Math.abs(this.player.x - this.FUNGUS_X) > 95) return;

    this.hasGrownAncientPlant = true;

    AudioManager.playFailsafe();
    this.cameras.main.flash(180, 57, 255, 20);

    const floorY = this.scale.height - 24;
    const fx = this.FUNGUS_X;
    const gfx = this.ancientPlantGfx;

    if (gfx) {
      gfx.clear();

      // Fungus stem
      gfx.lineStyle(8, 0x315b2c, 1);
      gfx.lineBetween(fx, floorY - 5, fx, floorY - 28);

      // Large fungus cap
      gfx.fillStyle(0x4f8f3a, 1);
      gfx.fillEllipse(fx, floorY - 31, 76, 25);

      gfx.lineStyle(3, 0x9be564, 1);
      gfx.strokeEllipse(fx, floorY - 31, 76, 25);

      // Glowing spots
      gfx.fillStyle(0x39ff14, 0.95);
      gfx.fillCircle(fx - 20, floorY - 34, 3);
      gfx.fillCircle(fx, floorY - 39, 3);
      gfx.fillCircle(fx + 20, floorY - 34, 3);
    }

    // Enable fungus collision surface
    if (this.fungusBouncePad) {
      this.fungusBouncePad.setVisible(true).setAlpha(1);

      const body = this.fungusBouncePad.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = true;
      body.updateFromGameObject();
    }

    this.statusText
      ?.setText('[ FUNGUS AWAKENED · BOUNCE ON IT ]')
      .setColor('#39ff14');
  }

  private handleSentinelAbility(): void {
    if (this.currentSectionIndex !== 7 || !this.realitySwap || this.isLeaving) {
      return;
    }

    const handled = this.realitySwap.handleAbilityInput();

    if (!handled && !this.realitySwap.isPossessing) {
      AudioManager.playInsufficientCharge();
    }
  }

  private usePhase(): void {
    this.triggerAbility('PHASE', () => {
      const changed = this.phasingAbility.toggleReality();

      if (changed && this.currentSectionIndex === 6) {
        this.hasUsedTutorialPhase = true;
      }
    });
  }

  // ───────────────────────────────────────────
  // WORLD
  // ───────────────────────────────────────────

  private buildContinuousWorld(H: number): void {
    const floorY = H - 24;

    // Left world boundary
    for (let y = 0; y <= floorY; y += 32) {
      this.platforms.create(0, y, 'tile_facility').refreshBody();
    }

    // ═══ SECTION 1: FROZEN AGE (0–620) ═══
    for (let x = 0; x <= 220; x += 32) {
      this.platforms.create(x, floorY, 'tile_snow_top').refreshBody();
    }

    // Small jump gap and elevated ledge
    for (let x = 280; x <= 420; x += 32) {
      this.platforms.create(x, floorY - 24, 'tile_snow_top').refreshBody();
    }

    // Water chasm
    this.waterHazard = this.add.rectangle(500, floorY + 4, 160, 24, 0x0077b6, 0.9);

    // Landing bank
    for (let x = 580; x <= 640; x += 32) {
      this.platforms.create(x, floorY, 'tile_snow_top').refreshBody();
    }

    // ═══ SECTION 2: HEAT AGE (620–1220) ═══
    for (let x = 640; x <= 880; x += 32) {
      this.platforms.create(x, floorY, 'tile_obsidian').refreshBody();
    }

    // Elevated volcanic ledge
    for (let x = 960; x <= 1220; x += 32) {
      this.platforms.create(x, floorY - 80, 'tile_ember').refreshBody();
    }

    // Lava pit
    this.add.rectangle(920, floorY + 6, 80, 20, 0xd00000, 0.95);

    // Thermal vent
    this.thermalVent = new ThermalVent(this, 840, floorY - 24, 'updraft', 54, 130);

    // ═══ SECTION 3: MEDIEVAL PALACE (1220–1840) ═══
    for (let x = 1220; x <= 1840; x += 32) {
      this.platforms.create(x, floorY, 'tile_stone_top').refreshBody();
    }

    // Decorative palace pillars
    const arch1 = this.add.graphics();
    arch1.fillStyle(0x1a1226, 0.85);
    arch1.fillRect(1240, 40, 16, floorY - 40);
    arch1.fillRect(1820, 40, 16, floorY - 40);
    arch1.lineStyle(1.5, 0x9d4edd, 0.7);
    arch1.strokeRect(1240, 40, 16, floorY - 40);
    arch1.strokeRect(1820, 40, 16, floorY - 40);

    // Royal Guard
    this.palaceGuard = new Guard(this, 1580, floorY - 32, 1450, 1720, {
      patrolSpeed: 45,
      alertSpeed: 100
    });

    this.physics.add.collider(this.palaceGuard, this.platforms);

    // ═══ SECTION 4: CHRONO-STASIS (1840–2480) ═══
    for (let x = 1840; x <= 2040; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // Moving chrono-platform
    this.timePlatform = new TimeMovingPlatform(
      this,
      'tut_time_platform',
      2080,
      2240,
      floorY - 36,
      75
    );

    this.timeAbility.registerTimeObject(this.timePlatform);

    // Far bank
    for (let x = 2300; x <= 2480; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // ═══ SECTION 5: ANCIENT GROWTH (2480–3120) ═══
    const fx = this.FUNGUS_X;

    for (let x = 2492; x <= 2684; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // Dormant fungus
    this.ancientPlantGfx = this.add.graphics().setDepth(11);

    this.add
      .circle(fx, floorY - 12, 8, 0x8b5e34)
      .setStrokeStyle(2, 0x39ff14, 0.9)
      .setDepth(12);

    this.add.circle(fx, floorY - 16, 4, 0x39ff14, 0.8).setDepth(13);

    this.add
      .text(fx, floorY - 43, 'DORMANT FUNGUS', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '7px',
        color: '#9be564',
        stroke: '#07110a',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(13);

    // Hidden fungus collision surface
    this.fungusBouncePad = this.add
      .ellipse(fx, floorY - 31, 76, 25, 0x4f8f3a, 0.95)
      .setVisible(false)
      .setAlpha(0);

    this.physics.add.existing(this.fungusBouncePad, true);

    (this.fungusBouncePad.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    // Elevated forest platforms
    for (let x = 2790; x <= 2830; x += 32) {
      this.platforms.create(x, floorY - 112, 'tile_mossy').refreshBody();
    }

    for (let x = 2870; x <= 2910; x += 32) {
      this.platforms.create(x, floorY - 72, 'tile_mossy').refreshBody();
    }

    // Landing bank
    for (let x = 2950; x <= 3110; x += 32) {
      this.platforms.create(x, floorY, 'tile_mossy').refreshBody();
    }

    // ═══ SECTION 6: REALITY SHIFT (3120–3760) ═══
    for (let x = 3142; x <= 3334; x += 32) {
      this.platforms.create(x, floorY, 'tile_concrete_top').refreshBody();
    }

    // Phase A platform
    this.phaseAPlatform = this.physics.add.sprite(3390, floorY - 35, 'tile_phase_a');
    this.phaseAPlatform.setDisplaySize(72, 16);

    (this.phaseAPlatform.body as Phaser.Physics.Arcade.Body)
      .setImmovable(true)
      .setAllowGravity(false);

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

    // Phase B platform
    this.phaseBPlatform = this.physics.add.sprite(3510, floorY - 70, 'tile_phase_b');
    this.phaseBPlatform.setDisplaySize(72, 16);

    (this.phaseBPlatform.body as Phaser.Physics.Arcade.Body)
      .setImmovable(true)
      .setAllowGravity(false);

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

    // Exit ledge for the phase section
    for (let x = 3590; x <= 3750; x += 32) {
      this.platforms.create(x, floorY - 105, 'tile_concrete_top').refreshBody();
    }

    // ═══ SECTION 7: ECHO SENTINEL (3760–4400) ═══
    for (let x = 3772; x <= 3964; x += 32) {
      this.platforms.create(x, floorY, 'tile_concrete_top').refreshBody();
    }

    const tutorialRiftNodes: RiftNodeDef[] = [
      {
        id: 'TUTORIAL_ECHO_NODE',
        x: 3875,
        y: floorY - 20,
        label: '▲ ECHO RIFT',

        sentinelSpawnX: 3940,
        sentinelSpawnY: floorY - 42,

        objectiveX: 4190,
        objectiveY: floorY - 160,
        objectiveLabel: 'ECHO TERMINAL',

        // Spawn clearly ABOVE the summit surface (tile top = floorY - 111)
        // so the player drops onto it instead of starting inside the tile.
        swapDestinationX: 4260,
        swapDestinationY: floorY - 150,

        ghostPlatforms: [
          { x: 3990, y: floorY - 72, w: 64, h: 16 },
          { x: 4070, y: floorY - 112, w: 64, h: 16 },
          { x: 4150, y: floorY - 152, w: 64, h: 16 }
        ],

        hazards: [],

        onObjectiveCompleted: () => {
          this.sentinelTutorialComplete = true;

          if (this.currentSectionIndex === 7) {
            this.statusText
              ?.setText('[ ECHO TERMINAL REACHED · PRESS E/J TO SWAP ]')
              .setColor('#00f0ff');
          }
        }
      }
    ];

    this.realitySwap = new RealitySwapSystem(
      this,
      this.player,
      tutorialRiftNodes,
      this.platforms
    );

    this.sentinelCursors = this.input.keyboard?.createCursorKeys();

    const sentinelKeyMap = this.input.keyboard?.addKeys('A,D,W,SPACE') as
      | Record<string, Phaser.Input.Keyboard.Key>
      | undefined;

    if (sentinelKeyMap) {
      this.sentinelKeys = {
        a: sentinelKeyMap.A,
        d: sentinelKeyMap.D,
        w: sentinelKeyMap.W,
        space: sentinelKeyMap.SPACE
      };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.realitySwap?.destroy();
    });

    // Extraction summit
    // Two rows thick so the player can never tunnel through it
    for (let x = 4220; x <= 4380; x += 32) {
      this.platforms.create(x, floorY - 95, 'tile_concrete_top').refreshBody();
      this.platforms.create(x, floorY - 63, 'tile_concrete_top').refreshBody();
    }

    // Right world boundary
    for (let y = 0; y <= floorY; y += 32) {
      this.platforms.create(4400, y, 'tile_facility').refreshBody();
    }

    // Extraction portal
    this.portalSprite = this.add.sprite(4310, floorY - 135, 'exit_portal');
    this.portalSprite.setDisplaySize(38, 56).setTint(0x39ff14);

    this.physics.add.existing(this.portalSprite, true);

    this.physics.add.overlap(this.player, this.portalSprite, () => {
      if (
        this.currentSectionIndex === 7 &&
        this.sentinelTutorialComplete &&
        this.hasCompletedFinalSection &&
        !this.realitySwap?.isPossessing
      ) {
        this.completeTutorial();
      }
    });
  }

  // ───────────────────────────────────────────
  // SECTION ENTITY SETUP
  // ───────────────────────────────────────────

  private setupSectionEntities(): void {
    // Moving time platform
    if (this.timePlatform) {
      this.physics.add.collider(this.player, this.timePlatform.sprite);
    }

    // Fungus bounce interaction
    if (this.fungusBouncePad) {
      this.physics.add.collider(this.player, this.fungusBouncePad, () => {
        const body = this.player.body as Phaser.Physics.Arcade.Body | null;

        if (
          this.currentSectionIndex === 5 &&
          this.hasGrownAncientPlant &&
          body &&
          body.blocked.down &&
          body.velocity.y >= 0
        ) {
          body.setVelocityY(-520);

          this.hasBouncedOnFungus = true;

          AudioManager.playJump();
          this.cameras.main.shake(90, 0.002);

          this.statusText
            ?.setText('[ FUNGUS BOOST · REACH THE CANOPY ]')
            .setColor('#39ff14');
        }
      });
    }

    // Palace guard detection
    if (this.palaceGuard) {
      this.physics.add.overlap(this.player, this.palaceGuard, () => {
        if (!this.camouflageAbility.cloaked && !this.isResetting) {
          this.isResetting = true;

          AudioManager.playInsufficientCharge();

          this.respawnAtCurrentSection();
        }
      });
    }
  }

  // ───────────────────────────────────────────
  // UI OVERLAY
  // ───────────────────────────────────────────

  /**
   * Pin every child of the container to the screen.
   * This keeps buttons and hit zones aligned while the camera scrolls.
   */
  private pinToScreen(obj: Phaser.GameObjects.GameObject): void {
    const sf = obj as unknown as Phaser.GameObjects.Components.ScrollFactor;

    sf.setScrollFactor?.(0);

    if (obj instanceof Phaser.GameObjects.Container) {
      obj.list.forEach((child) => {
        this.pinToScreen(child);
      });
    }
  }

  /** Full-width instruction panel. */
  private buildOverlayPanel(): void {
    const W = this.scale.width;

    const panelW = W - 10;
    const panelH = 85;

    const panelX = W / 2;
    const panelY = 46;

    this.overlayPanel = this.add
      .container(panelX, panelY)
      .setScrollFactor(0)
      .setDepth(2000);

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

    // Section category
    this.sectionCategoryText = this.add
      .text(-panelW / 2 + 14, -panelH / 2 + 8, '', {
        fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
        fontSize: '11px',
        color: '#00f0ff',
        letterSpacing: 1
      })
      .setOrigin(0, 0);

    this.overlayPanel.add(this.sectionCategoryText);

    // Progress indicator
    this.progressIndicatorText = this.add
      .text(panelW / 2 - 14, -panelH / 2 + 8, `SECTION 01 / 0${TOTAL_SECTIONS}`, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#39ff14'
      })
      .setOrigin(1, 0);

    this.overlayPanel.add(this.progressIndicatorText);

    // Section title
    this.sectionTitleText = this.add
      .text(-panelW / 2 + 14, -panelH / 2 + 20, '', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#040711',
        strokeThickness: 2
      })
      .setOrigin(0, 0);

    this.overlayPanel.add(this.sectionTitleText);

    // Objective text
    this.objectiveText = this.add
      .text(-panelW / 2 + 14, -panelH / 2 + 35, '', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '11px',
        color: '#e2e8f0',
        wordWrap: { width: panelW - 170 }
      })
      .setOrigin(0, 0);

    this.overlayPanel.add(this.objectiveText);

    // Keycap badge
    this.keycapBox = this.add.container(panelW / 2 - 55, 4);

    const keycapGfx = this.add.graphics();

    keycapGfx.fillStyle(0x132238, 1);
    keycapGfx.fillRect(-45, -10, 90, 20);

    keycapGfx.lineStyle(1, 0x00f0ff, 0.9);
    keycapGfx.strokeRect(-45, -10, 90, 20);

    this.keycapBox.add(keycapGfx);

    this.keycapText = this.add
      .text(0, 0, '', {
        fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#00f0ff'
      })
      .setOrigin(0.5);

    this.keycapBox.add(this.keycapText);
    this.overlayPanel.add(this.keycapBox);

    // Hint text
    this.hintText = this.add
      .text(-panelW / 2 + 14, panelH / 2 - 12, '', {
        fontFamily: GAME_FONTS.mono,
        fontSize: '10px',
        color: '#8b9bb4'
      })
      .setOrigin(0, 0.5);

    this.overlayPanel.add(this.hintText);

    // Status text
    this.statusText = this.add
      .text(panelW / 2 - 14, panelH / 2 - 12, '[ IN PROGRESS ]', {
        fontFamily: GAME_FONTS.heading,
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffd166'
      })
      .setOrigin(1, 0.5);

    this.overlayPanel.add(this.statusText);

    // Skip tutorial button
    const skipBtn = this.add.container(panelW / 2 - 42, -panelH / 2 - 12);

    const sBg = this.add.graphics();

    sBg.fillStyle(0x0c1524, 0.9);
    sBg.fillRect(-38, -8, 76, 16);

    sBg.lineStyle(1, 0x3d5a80, 0.8);
    sBg.strokeRect(-38, -8, 76, 16);

    const sTxt = this.add
      .text(0, 0, 'SKIP TUTORIAL >>', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '7px',
        color: '#8b9bb4'
      })
      .setOrigin(0.5);

    const sHit = this.add.zone(0, 0, 76, 16).setInteractive({ useHandCursor: true });

    sHit.on('pointerover', () => sTxt.setColor('#00f0ff'));
    sHit.on('pointerout', () => sTxt.setColor('#8b9bb4'));
    sHit.on('pointerdown', () => this.finishTutorial());

    skipBtn.add([sBg, sTxt, sHit]);
    this.overlayPanel.add(skipBtn);

    // Pin all children to screen
    this.pinToScreen(this.overlayPanel);

    this.updateOverlayUI();
  }

  private updateOverlayUI(): void {
    const sec = this.sections[this.currentSectionIndex - 1];

    if (!sec) return;

    this.sectionCategoryText.setText(sec.category);

    this.sectionCategoryText.setColor(
      '#' + sec.accentColor.toString(16).padStart(6, '0')
    );

    this.progressIndicatorText.setText(
      `SECTION 0${this.currentSectionIndex} / 0${TOTAL_SECTIONS}`
    );

    this.sectionTitleText.setText(sec.title);
    const mobileObjectives: Record<number, string> = {
      1: 'Move left/right, jump across gaps, then freeze the water into an ice bridge.',
      2: 'Move near the dormant volcanic vent to ignite it, then ride the updraft.',
      3: 'Activate your optical cloak and deploy a decoy to bypass the royal sentry.',
      4: 'Freeze the oscillating chrono-platform in place and jump across the chasm.',
      5: 'Switch between Reality Phase A and B, climb the platforms, and enter the extraction portal.'
    };

    if (DeviceInfo.isMobile) {
      this.objectiveText.setText(
        mobileObjectives[this.currentSectionIndex] ?? sec.objective
      );

      this.keycapBox.setVisible(false);
    } else {
      this.objectiveText.setText(sec.objective);
      this.keycapText.setText(sec.keycap);
      this.keycapBox.setVisible(true);
    } this.hintText.setText(sec.hint);

    this.statusText.setText('[ IN PROGRESS ]').setColor('#ffd166');

    this.tweens.add({
      targets: this.overlayPanel,
      y: 49,
      duration: 120,
      yoyo: true,
      ease: 'Power1'
    });
  }

  // ───────────────────────────────────────────
  // SECTION COMPLETION
  // ───────────────────────────────────────────

  private completeSection(secIdx: number): void {
    if (this.currentSectionIndex !== secIdx || this.isCompletingSection) {
      return;
    }

    this.isCompletingSection = true;

    AudioManager.playKeyCollect();

    this.statusText.setText('[ SECTION COMPLETED ✓ ]').setColor('#39ff14');

    this.time.delayedCall(700, () => {
      if (this.currentSectionIndex < TOTAL_SECTIONS) {
        this.currentSectionIndex = secIdx + 1;
        this.updateOverlayUI();
      } else if (secIdx === TOTAL_SECTIONS) {
        this.hasCompletedFinalSection = true;
      }

      this.isCompletingSection = false;
    });
  }

  // ───────────────────────────────────────────
  // UPDATE LOOP
  // ───────────────────────────────────────────

  update(time: number, delta: number): void {
    if (this.isLeaving) return;

    this.mobileHandle?.update();

    this.player.update(time, delta);
    this.phasingAbility.update(time, delta);
    this.camouflageAbility.update(time, delta);
    this.timeAbility.update(time, delta);

    if (this.thermalVent) {
      this.thermalVent.update(delta, this.player);
    }

    if (this.palaceGuard && this.palaceGuard.active) {
      this.palaceGuard.update(
        time,
        delta,
        this.player.x,
        this.player.y,
        null,
        this.camouflageAbility.cloaked
      );
    }

    if (this.timePlatform) {
      this.timePlatform.update(time, delta);
    }

    if (this.realitySwap) {
      this.realitySwap.update(time, delta, this.sentinelCursors, this.sentinelKeys);

      // Detect the Sentinel swap (possession ends after terminal reached)
      const possessing = this.realitySwap.isPossessing;

      if (
        this.wasPossessing &&
        !possessing &&
        this.sentinelTutorialComplete &&
        this.currentSectionIndex === 7
      ) {
        this.settlePlayerAfterSwap();
        // Re-apply shortly after in case the swap system restores state on a timer
        this.time.delayedCall(120, () => this.settlePlayerAfterSwap());
        this.time.delayedCall(400, () => this.settlePlayerAfterSwap());
      }

      this.wasPossessing = possessing;
    }

    // Fell off the map
    if (!this.isResetting && this.player.y > this.scale.height + 20) {
      this.isResetting = true;
      this.respawnAtCurrentSection();
    }

    // Water hazard
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

    // SECTION 1: WATER CONVERSION
    if (this.currentSectionIndex === 1) {
      if (this.isWaterFrozen && this.player.x > 600) {
        this.completeSection(1);
      }
    }

    // SECTION 2: THERMAL VENT
    else if (this.currentSectionIndex === 2) {
      if (this.player.x > 960 && this.player.body?.blocked.down) {
        this.hasRodeVent = true;
      }

      if (this.hasRodeVent && this.player.x > 1200) {
        this.completeSection(2);
      }
    }

    // SECTION 3: STEALTH
    else if (this.currentSectionIndex === 3) {
      if (this.player.x > 1750 && this.hasUsedCamouflage) {
        this.completeSection(3);
      }
    }

    // SECTION 4: CHRONO-STASIS
    else if (this.currentSectionIndex === 4) {
      if (
        this.player.x > 2320 &&
        this.player.body?.blocked.down &&
        this.hasUsedTimeFreeze
      ) {
        this.completeSection(4);
      }
    }

    // SECTION 5: ANCIENT GROWTH
    else if (this.currentSectionIndex === 5) {
      if (
        this.player.x > 2970 &&
        this.player.body?.blocked.down &&
        this.hasGrownAncientPlant &&
        this.hasBouncedOnFungus
      ) {
        this.completeSection(5);
      }
    }

    // SECTION 6: REALITY SHIFT
    else if (this.currentSectionIndex === 6) {
      if (
        this.player.x > 3600 &&
        this.player.body?.blocked.down &&
        this.hasUsedTutorialPhase
      ) {
        this.completeSection(6);
      }
    }

    // SECTION 7: ECHO SENTINEL
    else if (this.currentSectionIndex === 7) {
      if (
        this.sentinelTutorialComplete &&
        !this.hasCompletedFinalSection &&
        !this.realitySwap?.isPossessing &&
        this.player.x >= 4200
      ) {
        this.completeSection(7);
      }
    }
  }

  // ───────────────────────────────────────────
  // SENTINEL SWAP SAFEGUARD
  // ───────────────────────────────────────────

  /**
   * After the Echo swap, make sure Vance's body is active, collidable,
   * affected by gravity, and standing on top of the summit platform.
   */
  private settlePlayerAfterSwap(): void {
    if (this.isLeaving) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    const floorY = this.scale.height - 24;
    const summitTopY = floorY - 111; // top surface of the summit tiles

    body.enable = true;
    body.checkCollision.none = false;
    body.checkCollision.up = true;
    body.checkCollision.down = true;
    body.checkCollision.left = true;
    body.checkCollision.right = true;
    body.setAllowGravity(true);
    body.setVelocity(0, 0);

    // Only snap if the player ended up outside or below the summit
    if (
      this.player.x < 4210 ||
      this.player.x > 4390 ||
      body.bottom > summitTopY + 4
    ) {
      this.player.setPosition(4260, summitTopY - 40);
      body.updateFromGameObject();
      this.player.y += (summitTopY - 1) - body.bottom;
      body.updateFromGameObject();
    }
  }

  // ───────────────────────────────────────────
  // WATER CONVERSION
  // ───────────────────────────────────────────

  private convertWaterToIce(): void {
    if (this.isWaterFrozen) return;

    this.isWaterFrozen = true;

    AudioManager.playTimeFreeze();

    this.cameras.main.flash(180, 0, 240, 255);

    // Create ice bridge
    for (let x = 430; x <= 570; x += 32) {
      const ice = this.waterPlatforms
        .create(x, this.scale.height - 24, 'tile_ice')
        .refreshBody();

      (ice as Phaser.GameObjects.Sprite).setAlpha(0);

      this.tweens.add({
        targets: ice,
        alpha: 1,
        duration: 250
      });
    }

    if (this.waterHazard) {
      this.waterHazard.setFillStyle(0xade8f4, 0.95);
    }
  }

  // ───────────────────────────────────────────
  // RESPAWN
  // ───────────────────────────────────────────

  private respawnAtCurrentSection(): void {
    const sec = this.sections[this.currentSectionIndex - 1];

    const safeX = sec ? sec.checkpointX : 60;

    this.player.respawnAt(safeX, this.scale.height - 70);

    (this.player.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0);

    this.cameras.main.flash(200, 255, 0, 80);

    this.isResetting = false;
  }

  // ───────────────────────────────────────────
  // COMPLETION MODAL
  // ───────────────────────────────────────────

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

    const title = this.add
      .text(0, -45, 'TRAINING SIMULATION COMPLETE', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#39ff14',
        stroke: '#040711',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    modal.add(title);

    const subtitle = this.add
      .text(
        0,
        -12,
        `All ${TOTAL_SECTIONS} Training Protocols Verified.\nVance's Quantum Staff is fully calibrated for live missions.`,
        {
          fontFamily: GAME_FONTS.primary,
          fontSize: '9px',
          color: '#e2e8f0',
          align: 'center',
          lineSpacing: 4
        }
      )
      .setOrigin(0.5);

    modal.add(subtitle);

    // Reusable modal button
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

      const drawBtn = (fill: number): void => {
        bgBtn.clear();
        bgBtn.fillStyle(fill, 1);
        bgBtn.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
        bgBtn.lineStyle(1.5, accentColor, 1);
        bgBtn.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
      };

      drawBtn(0x0c1524);

      const btnTxt = this.add
        .text(0, 0, label, {
          fontFamily: GAME_FONTS.primary,
          fontSize: '8px',
          fontStyle: 'bold',
          color,
          align: 'center'
        })
        .setOrigin(0.5);

      const hit = this.add.zone(0, 0, btnW, btnH).setInteractive({ useHandCursor: true });

      hit.on('pointerover', () => {
        drawBtn(0x1a2940);
        btnTxt.setColor('#ffffff');

        try {
          AudioManager.playMenuHover();
        } catch {
          // Sound must not block the UI.
        }
      });

      hit.on('pointerout', () => {
        drawBtn(0x0c1524);
        btnTxt.setColor(color);
      });

      hit.on('pointerdown', () => {
        try {
          AudioManager.playMenuSelect();
        } catch {
          // Ignore sound failure.
        }

        callback();
      });

      btn.add([bgBtn, btnTxt, hit]);
      modal.add(btn);
    };

    if (this.source === 'story') {
      createActionButton(-88, 48, 'MAIN MENU', () => this.goToMainMenu(), 0x00f0ff, 145);

      createActionButton(
        88,
        48,
        'PROCEED TO LEVEL 1 >>',
        () => this.proceedToLevelOne(),
        0x39ff14,
        175
      );
    } else {
      createActionButton(
        0,
        48,
        'RETURN TO SETTINGS',
        () => this.returnToSettings(),
        0x39ff14,
        190
      );
    }

    // Pin modal to screen
    this.pinToScreen(modal);

    // Keyboard fallback
    this.input.keyboard?.once('keydown-ENTER', () => this.finishTutorial());

    modal.setAlpha(0);

    this.tweens.add({
      targets: modal,
      alpha: 1,
      duration: 200
    });
  }

  // ───────────────────────────────────────────
  // SCENE TRANSITIONS
  // ───────────────────────────────────────────

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
    this.transitionToScene(GAME_CONFIG.sceneKeys.Game);
  }

  private returnToSettings(): void {
    this.transitionToScene(GAME_CONFIG.sceneKeys.MainMenu, {
      openSettings: true
    });
  }

  private finishTutorial(): void {
    if (this.source === 'story') {
      this.proceedToLevelOne();
    } else {
      this.returnToSettings();
    }
  }
}