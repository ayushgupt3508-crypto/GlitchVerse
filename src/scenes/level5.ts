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
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';
import { RealitySwapSystem, RiftNodeDef } from '../systems/RealitySwapSystem';
import { FullscreenManager } from '../systems/FullscreenManager';
import { SaveSystem } from '../systems/SaveSystem';


/**
 * LEVEL 5 DATA SPECIFICATION — FUTURISTIC CORE & FINAL ESCAPE (EXTENDED)
 * ─────────────────────────────────────────────────────────────
 * Look: Floating structures, holographic ads, neon architecture, glitching platforms,
 *       data streams, echo reality rifts, fragments of the original lab.
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
    width: 5400,
    height: 440,
    floorY: 340
  },
  spawn: { x: 80, y: 300 },
  checkpoints: [
    { id: 'cp_origin',           x: 80,   y: 300, label: 'CYBER-PROJECTION SPHERE' },
    { id: 'cp_chain',            x: 1640, y: 220, label: 'LAB FRAGMENT OBSERVATORY' },
    { id: 'cp_rift_junction',    x: 3200, y: 300, label: 'RIFT JUNCTION' },
    { id: 'cp_altar_threshold',  x: 4640, y: 300, label: 'ALTAR THRESHOLD' },
    { id: 'cp_pedestal',         x: 4940, y: 300, label: 'FAILSAFE MATRIX PEDESTAL' }
  ],
  puzzle: {
    component5:       { x: 4800, y: 290 },
    failsafePedestal: { x: 4940, y: 300 },
    escapeBulkhead:   { x: 5120, y: 280 },
    exitPortal:       { x: 5350, y: 220 }
  }
} as const;

export class Level5Scene extends Phaser.Scene {
  // Entities
  private player!: Player;
  private staffController!: StaffController;
  private phasing!: PhasingAbility;
  private camouflage!: CamouflageAbility;
  public realitySwap!: RealitySwapSystem;
  private drones: SentinelDrone[] = [];

  // Physics Groups
  private persistentPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private phaseAPlatforms: { sprite: Phaser.Physics.Arcade.Sprite; body: Phaser.Physics.Arcade.Body }[] = [];
  private phaseBPlatforms: { sprite: Phaser.Physics.Arcade.Sprite; body: Phaser.Physics.Arcade.Body }[] = [];

  // Reality Swap & In-World Extended Elements
  private puzzleBarriers: { sprite: Phaser.Physics.Arcade.Sprite; active: boolean }[] = [];
  private lightBridge?: Phaser.Physics.Arcade.Sprite;
  private conduitCrystals: Phaser.Physics.Arcade.Sprite[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyW?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyJ?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private hintZone4Shown = false;
  private hintZone6Shown = false;
  private hintZone7Shown = false;

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
  private isRespawning = false;
  private isLeavingScene = false;

  // Visuals
  private dataStreamGfx?: Phaser.GameObjects.Graphics;
  private mobileHandle: MobileSetupHandle | null = null;

  // Level-5-only mobile SHIFT button (reality toggle, no energy cost)
  private mobileShiftBtn?: Phaser.GameObjects.Container;
  private mobileShiftBtnBg?: Phaser.GameObjects.Arc;
  private mobileShiftBtnLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('Level5Scene');
  }

  create(): void {
    AudioManager.init();
    AudioManager.startLevel5Music();
    this.levelStartTime = Date.now();

    // Reset progression flags if spawning at origin
    if (this.checkpointX === LEVEL5_DATA.spawn.x) {
      this.hasCollectedComponent5 = false;
      this.isFailsafeRepaired = false;
      this.isChamberCollapsing = false;
      this.collapseProgress = 0;
    }

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

    // Initialize Camouflage Ability (positioned at hudY: 76, directly beneath Phasing shift bar)
    this.camouflage = new CamouflageAbility(this, this.player, { hudY: 76 });

    // Setup Keyboard cursors & keys for Sentinel and Player
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyW     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyE     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyJ     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Build Cybernetic Architecture & Phasing Platform Chain
    this.buildCoreArchitecture();

    // Define the 5 Reality Swap Rift Nodes across the extended zones
    const nodeDefs: RiftNodeDef[] = [
      // Node 1: Zone 4 Vault Ingress
      {
        id: 'node_01_vault',
        x: 2020,
        y: LEVEL5_DATA.dimensions.floorY,
        label: 'NODE 01 · VAULT INGRESS',
        sentinelSpawnX: 2060,
        sentinelSpawnY: 300,
        objectiveX: 2380,
        objectiveY: 200,
        objectiveLabel: 'VAULT OVERRIDE',
        swapDestinationX: 2380,
        swapDestinationY: LEVEL5_DATA.dimensions.floorY,
        ghostPlatforms: [
          { x: 2040, y: 340, w: 90, h: 20 },
          { x: 2110, y: 285, w: 85, h: 18 },
          { x: 2210, y: 235, w: 85, h: 18 },
          { x: 2310, y: 210, w: 85, h: 18 }
        ],
        onObjectiveCompleted: () => {
          this.deactivateBarrier(0);
        }
      },
      // Node 2: Zone 5 Phased Void Chasm
      {
        id: 'node_02_bridge',
        x: 2640,
        y: LEVEL5_DATA.dimensions.floorY,
        label: 'NODE 02 · DESYNC BRIDGE',
        sentinelSpawnX: 2680,
        sentinelSpawnY: 300,
        objectiveX: 3100,
        objectiveY: 180,
        objectiveLabel: 'LIGHT BRIDGE GENERATOR',
        swapDestinationX: 3180,
        swapDestinationY: LEVEL5_DATA.dimensions.floorY,
        ghostPlatforms: [
          { x: 2740, y: 280, w: 96, h: 18 },
          { x: 2870, y: 240, w: 96, h: 18 },
          { x: 3000, y: 205, w: 96, h: 18 }
        ],
        hazards: [
          { x: 2720, y: 390, w: 420, h: 40 }
        ],
        onObjectiveCompleted: () => {
          this.activateLightBridge();
        }
      },
      // Node 3: Zone 6 Drone Infiltration Corridor
      {
        id: 'node_03_infiltrate',
        x: 3360,
        y: LEVEL5_DATA.dimensions.floorY,
        label: 'NODE 03 · CLOAK OVERRIDE',
        sentinelSpawnX: 3380,
        sentinelSpawnY: 300,
        objectiveX: 3800,
        objectiveY: 160,
        objectiveLabel: 'LASER GRID DECOUPLER',
        swapDestinationX: 3880,
        swapDestinationY: LEVEL5_DATA.dimensions.floorY,
        ghostPlatforms: [
          { x: 3380, y: 280, w: 85, h: 18 },
          { x: 3490, y: 230, w: 85, h: 18 },
          { x: 3610, y: 190, w: 85, h: 18 },
          { x: 3720, y: 185, w: 85, h: 18 }
        ],
        onObjectiveCompleted: () => {
          this.deactivateBarrier(1);
        }
      },
      // Node 4A: Zone 7 Dual Relay First Stage
      {
        id: 'node_04a_relay1',
        x: 4050,
        y: LEVEL5_DATA.dimensions.floorY,
        label: 'NODE 04A · FIRST RELAY',
        sentinelSpawnX: 4080,
        sentinelSpawnY: 300,
        objectiveX: 4280,
        objectiveY: 200,
        objectiveLabel: 'RELAY SYNAPSE 1',
        swapDestinationX: 4330,
        swapDestinationY: LEVEL5_DATA.dimensions.floorY,
        ghostPlatforms: [
          { x: 4130, y: 275, w: 85, h: 18 },
          { x: 4220, y: 235, w: 85, h: 18 }
        ],
        hazards: [
          { x: 4100, y: 390, w: 200, h: 40 }
        ],
        onObjectiveCompleted: () => {
          // Relay 1 activated
        }
      },
      // Node 4B: Zone 7 Dual Relay Final Stage
      {
        id: 'node_04b_relay2',
        x: 4380,
        y: LEVEL5_DATA.dimensions.floorY,
        label: 'NODE 04B · FINAL SYNAPSE',
        sentinelSpawnX: 4400,
        sentinelSpawnY: 300,
        objectiveX: 4600,
        objectiveY: 180,
        objectiveLabel: 'SINGULARITY GATE OVERRIDE',
        swapDestinationX: 4660,
        swapDestinationY: LEVEL5_DATA.dimensions.floorY,
        ghostPlatforms: [
          { x: 4460, y: 265, w: 85, h: 18 },
          { x: 4540, y: 225, w: 85, h: 18 }
        ],
        hazards: [
          { x: 4420, y: 390, w: 200, h: 40 }
        ],
        onObjectiveCompleted: () => {
          this.deactivateBarrier(2);
        }
      }
    ];

    // Initialize RealitySwapSystem with ghost platforms and persistent platforms colliders
    this.realitySwap = new RealitySwapSystem(this, this.player, nodeDefs, this.persistentPlatforms);

    // Register Staff Ability Handlers — must return `true` so StaffController.activate()
    // knows the ability executed and calls chargeManager.consumeCharge(). Returning void/
    // undefined (falsy) causes the charge-consumption block to be skipped silently.
    this.staffController.registerAbilityHandler('PHASE', () => { this.phasing.toggleReality(); return true; });
    this.staffController.registerAbilityHandler('CAMOUFLAGE', () => { this.camouflage.activate(); return true; });

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
      esc.on('down', () => {
        if (FullscreenManager.shouldBlockEsc()) return;
        this.togglePause();
      });
      keyP.on('down', () => this.togglePause());
    }

    // Scanlines
    this.addScanlines();

    // Welcome banner & tutorial hint
    this.time.delayedCall(600, () => {
      this.hud.showBanner('DIMENSIONAL PHASING: PRESS [SHIFT], [TAB], OR [X] TO SHIFT REALITY A & B');
    });

    // Reset hints
    this.hintZone4Shown = false;
    this.hintZone6Shown = false;
    this.hintZone7Shown = false;

    // Cleanup listener on shutdown
    this.events.once('shutdown', () => {
      this.realitySwap.destroy();
      this.staffController.destroy();
      this.phasing.destroy();
      this.camouflage.destroy();
      this.drones.forEach(d => d.destroy());
      this.dataStreamGfx?.destroy();
      this.collapseWallGfx?.destroy();
      this.mobileShiftBtn?.destroy();
    });

    this.isRespawning = false;

    // Fade in
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // ── Mobile Controls (additive — no-op on desktop) ─────────────────────
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,
      onAbilityPressed: () => {
        if (this.realitySwap.handleAbilityInput()) {
          return;
        }
        this.staffController.activate(this.player.x, this.player.y);
      },
      getAbilityState: () => {
        if (this.realitySwap.isPossessing) {
          return {
            label: 'SWAP',
            available: true,
            tint: 0xff007f,
            cooldownProgress: 0
          };
        }
        const nearby = this.realitySwap.getNearbyAvailableNode();
        if (nearby !== -1) {
          return {
            label: 'POSSESS',
            available: true,
            tint: 0x00f0ff,
            cooldownProgress: 0
          };
        }
        return {
          label: this.phasing.reality === 'A' ? 'PHASE A' : 'PHASE B',
          available: true,
          tint: this.phasing.reality === 'A' ? LEVEL5_DATA.palette.cyan : LEVEL5_DATA.palette.magenta,
          cooldownProgress: 0
        };
      }
    });

    // Level-5-only SHIFT button (mobile only — desktop uses Shift/Tab)
    if (this.mobileHandle) {
      this.buildMobileShiftButton();
    }
  }

  /**
   * Creates a Level-5-exclusive mobile button that toggles PHASE A/B reality
   * without consuming any staff energy — exactly what Shift/Tab does on desktop.
   * Positioned above the jump+ability cluster so it's easy to reach.
   */
  private buildMobileShiftButton(): void {
    const R     = 26;          // slightly smaller than main buttons (30)
    const alpha = 0.62;
    const depth = 205;         // above MobileControls (depth 200)
    const cam   = this.cameras.main;
    const W     = cam.width;
    const H     = cam.height;
    const margin = 16;

    // Mirror the MobileControls positioning formula
    const jumpX    = W - margin - 30;
    const jumpY    = H - margin - 30;
    const abilityX = jumpX - 30 * 2 - 16;
    // Centre of the two buttons horizontally, one row above them
    const btnX = Math.round((abilityX + jumpX) / 2);
    const btnY = jumpY - 30 * 2 - 18;

    const container = this.add.container(btnX, btnY)
      .setScrollFactor(0)
      .setDepth(depth);

    // Background fill — cyan for Reality A, magenta for B
    const initColor = this.phasing.reality === 'A'
      ? LEVEL5_DATA.palette.cyan
      : LEVEL5_DATA.palette.magenta;

    const bg = this.add.circle(0, 0, R, initColor, alpha);
    container.add(bg);

    // Border ring
    const ring = this.add.graphics();
    ring.lineStyle(2, 0xffffff, 0.7);
    ring.strokeCircle(0, 0, R);
    container.add(ring);

    // Icon: swap arrows ⇄
    const icon = this.add.text(0, -4, '⇄', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    container.add(icon);

    // Label below icon
    const lbl = this.add.text(0, R + 7, 'SHIFT', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    container.add(lbl);

    // Generous hit zone
    const zone = this.add.zone(0, 0, R * 2.8, R * 2.8)
      .setInteractive()
      .setScrollFactor(0);
    container.add(zone);

    // Press handler — toggle reality, zero energy consumed
    zone.on('pointerdown', () => {
      if (this.isPaused || this.isRespawning || this.realitySwap.isPossessing) return;
      this.phasing.toggleReality();
      // Tactile press feedback
      container.setScale(0.88);
      this.time.delayedCall(100, () => container.setScale(1));
    });

    // Reposition on resize
    this.scale.on('resize', () => {
      const nW  = this.cameras.main.width;
      const nH  = this.cameras.main.height;
      const nJX = nW - margin - 30;
      const nJY = nH - margin - 30;
      const nAX = nJX - 30 * 2 - 16;
      container.setPosition(
        Math.round((nAX + nJX) / 2),
        nJY - 30 * 2 - 18
      );
    });

    this.mobileShiftBtn      = container;
    this.mobileShiftBtnBg    = bg;
    this.mobileShiftBtnLabel = lbl;
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    // Safety net: if player is dead but death sequence hasn't started, trigger it
    if (this.player.isDead && !this.isRespawning) {
      this.handleDeath('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    // Handle Ability Input / Reality Swap
    const activateJustPressed =
      (this.keyE ? Phaser.Input.Keyboard.JustDown(this.keyE) : false) ||
      (this.keyJ ? Phaser.Input.Keyboard.JustDown(this.keyJ) : false);

    if (activateJustPressed) {
      if (this.realitySwap.handleAbilityInput()) {
        // Handled by Reality Swap (start possession or execute swap)
        // Zero staff energy consumed!
      } else if (!this.realitySwap.isPossessing) {
        this.staffController.activate(this.player.x, this.player.y);
      }
    }

    // Update Reality Swap System
    this.realitySwap.update(time, delta, this.cursors, { a: this.keyA, d: this.keyD, w: this.keyW, space: this.keySpace });

    // Update Player & Controls
    // IMPORTANT: mobileHandle.update() must run every frame (including during possession)
    // because updateSentinelControls() reads player.mobileInput for sentinel movement/jump.
    // Skipping it during possession means the sentinel gets zero mobile input → can't move on mobile.
    this.mobileHandle?.update();

    if (this.realitySwap.isPossessing) {
      // Vance is frozen in stasis: zero velocity and disable body movement.
      // mobileInput flags are still updated above so the SENTINEL can use them.
      const pBody = this.player.body as Phaser.Physics.Arcade.Body;
      pBody.setVelocity(0, 0);
    } else {
      this.player.update(time, delta);
    }

    // Update Staff Controller (only when not possessing)
    if (!this.realitySwap.isPossessing) {
      this.staffController.update(delta, this.player.x, this.player.y);
    }

    // Fall death check (only applies if player is not in stasis)
    if (this.player.y > 440 && !this.player.isDead && !this.realitySwap.isPossessing) {
      this.handleDeath('DISINTEGRATION IN THE VOID');
      return;
    }

    // Update Phasing Ability
    this.phasing.update(time, delta);

    // Sync SHIFT button to current state (mobile only)
    if (this.mobileShiftBtnBg && this.mobileShiftBtnLabel && this.mobileShiftBtn) {
      if (this.realitySwap.isPossessing) {
        // Dim: can't shift reality while controlling the sentinel
        this.mobileShiftBtnBg.setFillStyle(0x333333, 0.3);
        this.mobileShiftBtnLabel.setColor('#555555');
        this.mobileShiftBtn.setAlpha(0.45);
      } else {
        const isA    = this.phasing.reality === 'A';
        const color  = isA ? LEVEL5_DATA.palette.cyan : LEVEL5_DATA.palette.magenta;
        const hexStr = '#' + color.toString(16).padStart(6, '0');
        this.mobileShiftBtnBg.setFillStyle(color, 0.62);
        this.mobileShiftBtnLabel.setColor(hexStr);
        this.mobileShiftBtn.setAlpha(1);
      }
    }

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

    // In-World Guiding Hints at Important Puzzle Stages
    if (this.player.x > 1920 && !this.hintZone4Shown) {
      this.hintZone4Shown = true;
      this.hud.showBanner('RIFT NODE DETECTED · PRESS ABILITY KEY TO POSSESS ECHO SENTINEL');
    }
    if (this.player.x > 3300 && !this.hintZone6Shown) {
      this.hintZone6Shown = true;
      this.hud.showBanner('ECHO PROJECTION IS UNSEEN BY PATROL DRONES · INFILTRATE HIGH ECHO ROUTE');
    }
    if (this.player.x > 4000 && !this.hintZone7Shown) {
      this.hintZone7Shown = true;
      this.hud.showBanner('DUAL DESYNC RELAYS · CHAIN REALITY SWAPS ACROSS THE SINGULARITY CHASM');
    }

    // Checkpoint activation checks across all checkpoints (sound + flash only)
    const cps = LEVEL5_DATA.checkpoints;
    for (const cp of cps) {
      if (this.player.x >= cp.x && this.checkpointX < cp.x) {
        this.checkpointX = cp.x;
        this.checkpointY = cp.y;
        AudioManager.playCheckpoint();
        this.cameras.main.flash(200, 0, 240, 255);
      }
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

    // ── Zone 4: Echo Ingress & The Sealed Vault (x: 1900 to 2550) ────────────
    addPersistent(1900, 2160, floorY);

    // Vault Barrier 0 blocking direct progress across the gap
    const barrier0 = this.physics.add.sprite(2160, floorY - 70, 'electronic_door')
      .setDisplaySize(24, 140)
      .setTint(0xff007f)
      .setImmovable(true)
      .setDepth(10);
    (barrier0.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.puzzleBarriers.push({ sprite: barrier0, active: true });

    addPersistent(2340, 2550, floorY);

    // ── Zone 5: Phased Void Chasm & Desync Bridge (x: 2550 to 3250) ─────────
    addPersistent(2550, 2680, floorY);

    // Holographic Light Bridge (solidified when Node 2 objective is achieved)
    this.lightBridge = this.physics.add.sprite(2930, floorY - 6, 'tile_glitch')
      .setDisplaySize(460, 16)
      .setTint(0x00f0ff)
      .setAlpha(0)
      .setImmovable(true)
      .setDepth(8);
    (this.lightBridge.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.lightBridge.body as Phaser.Physics.Arcade.Body).enable = false;

    // Landing ledge on the far side of the chasm
    addPersistent(3160, 3300, floorY);

    // Conduit Crystal 1 (charge refill at Rift Junction)
    const crystal1 = this.physics.add.sprite(3220, floorY - 28, 'conduit_crystal')
      .setDepth(11);
    (crystal1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.conduitCrystals.push(crystal1);

    // ── Zone 6: Cloaked Drone Infiltration Corridor (x: 3250 to 3950) ───────
    addPersistent(3300, 3950, floorY);

    // Laser Grid Barrier 1 at corridor terminus
    const barrier1 = this.physics.add.sprite(3820, floorY - 70, 'electronic_door')
      .setDisplaySize(24, 140)
      .setTint(0xff007f)
      .setImmovable(true)
      .setDepth(10);
    (barrier1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.puzzleBarriers.push({ sprite: barrier1, active: true });

    // Guard Drone patrolling lower infiltration lane
    const drone1 = new SentinelDrone(this, 3580, floorY - 60, 3450, 3720);
    this.drones.push(drone1);

    // ── Zone 7: Dual Relay Desync Chasm (x: 3950 to 4700) ───────────────────
    addPersistent(3950, 4100, floorY);

    // Mid-Chasm Floating Island (landing platform for first swap)
    addPersistent(4300, 4420, floorY);

    // Singularity Forcefield Barrier 2 guarding the Altar entry
    const barrier2 = this.physics.add.sprite(4620, floorY - 70, 'electronic_door')
      .setDisplaySize(24, 140)
      .setTint(0xff007f)
      .setImmovable(true)
      .setDepth(10);
    (barrier2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.puzzleBarriers.push({ sprite: barrier2, active: true });

    addPersistent(4620, 4700, floorY);

    // Conduit Crystal 2 (charge refill before Altar)
    const crystal2 = this.physics.add.sprite(4680, floorY - 28, 'conduit_crystal')
      .setDepth(11);
    (crystal2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.conduitCrystals.push(crystal2);

    // ── Zone 8: The Altar of the Singularity (x: 4700 to 5050) ─────────────
    addPersistent(4700, 5050, floorY);

    // Altar pedestal for Component 5
    for (let x = 4780; x <= 4840; x += 32) {
      const p = this.persistentPlatforms.create(x, floorY - 24, 'tile_glitch') as Phaser.Physics.Arcade.Sprite;
      p.setOrigin(0, 0).refreshBody();
    }

    // ── Zone 9: The Collapsing Escape Gauntlet (x: 5050 to 5400) ────────────
    addPersistent(5050, 5120, floorY);

    // Collapsing phasing bridges
    addPhasePlatform(5160, floorY - 30, 2, 'A');
    addPhasePlatform(5240, floorY - 60, 2, 'B');

    addPersistent(5290, 5400, floorY);

    // Rogue Singularity Drone guarding the final extraction corridor
    const drone2 = new SentinelDrone(this, 5260, floorY - 80, 5200, 5320);
    this.drones.push(drone2);
  }

  // ── Reality Swap Puzzle Activators ────────────────────────────────────────

  private deactivateBarrier(index: number): void {
    const b = this.puzzleBarriers[index];
    if (!b || !b.active) return;
    b.active = false;
    AudioManager.playFailsafe();
    this.tweens.add({
      targets: b.sprite,
      alpha: 0,
      scaleY: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        (b.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    });
  }

  private activateLightBridge(): void {
    if (!this.lightBridge) return;
    this.lightBridge.setVisible(true).setActive(true);
    (this.lightBridge.body as Phaser.Physics.Arcade.Body).enable = true;
    this.tweens.add({
      targets: this.lightBridge,
      alpha: { from: 0, to: 0.85 },
      duration: 600,
      repeat: 0
    });
    AudioManager.playAssembleFailsafe();
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

    // Player vs Light Bridge
    if (this.lightBridge) {
      this.physics.add.collider(this.player, this.lightBridge);
    }

    // Player vs Puzzle Barriers
    this.puzzleBarriers.forEach(b => {
      this.physics.add.collider(this.player, b.sprite);
    });

    // Player vs Conduit Crystals (Staff Charge Refill)
    this.conduitCrystals.forEach(crystal => {
      this.physics.add.overlap(this.player, crystal, () => {
        if (!crystal.active) return;
        crystal.setActive(false).setVisible(false);
        (crystal.body as Phaser.Physics.Arcade.Body).enable = false;
        AudioManager.playKeyCollect();
        this.staffController.chargeManager.refillMax('conduit_crystal');
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        this.hud.updateCharges(this.player.staffCharges);
        const emitter = this.add.particles(crystal.x, crystal.y, 'proto_tile', {
          speed: { min: 40, max: 120 },
          scale: { start: 0.4, end: 0 },
          tint: [0x00f0ff, 0xffffff],
          lifespan: 500,
          quantity: 12
        });
        this.time.delayedCall(550, () => emitter.destroy());
      });
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

    // Player vs Drones (Vance in stasis is safe from detection/damage)
    this.drones.forEach(drone => {
      this.physics.add.overlap(this.player, drone, () => {
        if (drone.isLethal && !this.isRespawning && !this.realitySwap.isPossessing) {
          const lethal = this.player.takeDamage();
          if (lethal || this.player.integrity <= 0 || this.player.isDead) {
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

    // Checkpoint at Pedestal
    this.checkpointX = LEVEL5_DATA.checkpoints[4].x;
    this.checkpointY = LEVEL5_DATA.checkpoints[4].y;

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
    this.collapseProgress = 4600; // Starts advancing from the Altar threshold
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
    if (this.isLeavingScene) return;   // prevent double-trigger
    this.isLeavingScene = true;

    this.physics.pause();

    this.hud.showBanner('SIMULATION ESCAPE SUCCESSFUL! CONSCIOUSNESS DE-REZZING...');
    AudioManager.playVictory();

    const timeMs = Date.now() - this.levelStartTime;
    const score = Math.max(1000, 10000 - this.deathCount * 500 - Math.floor(timeMs / 1000) * 10);
    SaveSystem.markLevelCompleted(5, score);

    const cam = this.cameras.main;
    cam.fadeOut(500);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('GameEnding', {
        deathCount: this.deathCount,
        timeMs,
        score
      });
    });
    return;
    // Brilliant whiteout flash fading into EndingScene
    this.cameras.main.fade(1000, 255, 255, 255, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('EndingScene', {
          deathCount: this.deathCount,
          timeMs: Date.now() - this.levelStartTime
        });
      }
  });
    this.cameras.main.fadeOut(1000, 255, 255, 255);
  }

  // ── Death & Respawn ───────────────────────────────────────────────────────

  private handleDeath(reason = 'DIMENSIONAL PARADOX'): void {
    if (this.isRespawning) return;
    this.isRespawning = true;

    // Reset Reality Swap and release Echo possession
    this.realitySwap.resetAll();

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
          this.realitySwap.resetAll();
          this.player.restoreIntegrity();
          this.player.respawnAt(this.checkpointX, this.checkpointY);
          if (this.staffController) {
            this.staffController.chargeManager.setCharges(this.player.maxStaffCharges);
          }
          this.player.restoreStaffCharges(this.player.maxStaffCharges);
          this.hud.updateIntegrity(this.player.integrity);
          this.hud.updateCharges(this.player.staffCharges);
          this.isChamberCollapsing = false;
          this.collapseWallGfx?.clear();
          this.cameras.main.fadeIn(400, 0, 0, 0);
          this.isRespawning = false;
        },
        onRestart: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.isRespawning = false;
          this.restartLevelFromBeginning();
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

  // ── Pause Menu & Restart Helpers ──────────────────────────────────────────

  private togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    if (this.isPaused || this.isRespawning || this.isLeavingScene) return;
    this.isPaused = true;
    this.physics.pause();
    const cb: PauseMenuCallbacks = {
      onResume: () => this.resumeGame(),
      onCheckpoint: () => this.restartAtCheckpoint(),
      onRestart: () => {
        this.resumeGame();
        this.restartLevelFromBeginning();
      },
      onMainMenu: () => {
        if (this.isLeavingScene) return;
        this.isLeavingScene = true;
        this.pauseMenu?.destroy();
        this.pauseMenu = null;
        this.isPaused = false;
        this.physics.resume();
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
        });
        this.cameras.main.fadeOut(300, 0, 0, 0);
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

  private restartLevelFromBeginning(): void {
    this.realitySwap.resetAll();
    this.checkpointX = LEVEL5_DATA.spawn.x;
    this.checkpointY = LEVEL5_DATA.spawn.y;
    this.deathCount = 0;
    this.hasCollectedComponent5 = false;
    this.isFailsafeRepaired = false;
    this.isChamberCollapsing = false;
    this.collapseProgress = 0;
    this.isPaused = false;
    this.isRespawning = false;
    this.isLeavingScene = false;
    this.physics.resume();
    this.scene.restart();
  }

  private restartAtCheckpoint(): void {
    this.resumeGame();
    this.realitySwap.resetAll();
    this.player.restoreIntegrity();
    this.player.respawnAt(this.checkpointX, this.checkpointY);
    if (this.staffController) {
      this.staffController.chargeManager.setCharges(this.player.maxStaffCharges);
    }
    this.player.restoreStaffCharges(this.player.maxStaffCharges);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);

    // Reset collapse state if active
    if (this.isChamberCollapsing) {
      this.collapseWallGfx?.clear();
      this.collapseProgress = Math.max(0, this.checkpointX - 500);
    }

    this.cameras.main.fadeIn(400, 0, 0, 0);
    AudioManager.playCheckpoint();
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
