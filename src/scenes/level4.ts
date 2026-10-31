import { TextureGenerator } from '../utils/TextureGenerator';
import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { Player } from '../entities/Player';
import { StaffController } from '../systems/staff/StaffController';
import { TimeAbility } from '../abilities/TimeAbility';
import { SaveSystem } from '../systems/SaveSystem';
import {
  ITimeStateObject,
  BrokenBridgeSection,
  TimeMovingPlatform,
  FallingBranch
} from '../systems/time/ITimeStateObject';
import {
  GrowthClockObject,
  SeedPodItem,
  ActiveForestGolem
} from '../systems/time/GrowthClock';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { AudioManager } from '../systems/AudioManager';
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';

/**
 * LEVEL 4 DATA SPECIFICATION — ANCIENT FOREST
 * ──────────────────────────────────────────
 * Look: Giant trees, overgrown ruins, wooden bridges, vines, waterfalls, ancient machinery.
 * Palette: Forest Green (0x2d6a4f), Ancient Brown (0x5c4033), Muted Gold (0xd4af37), Cyan (0x00f0ff).
 */
export const LEVEL4_DATA = {
  id: 'level4',
  name: 'Ancient Forest',
  sector: 4,
  palette: {
    forestDark: 0x1b4332,
    forestMid: 0x2d6a4f,
    forestLight: 0x40916c,
    mossGreen: 0x52b788,
    barkBrown: 0x5c4033,
    darkWood: 0x3e2723,
    mutedGold: 0xd4af37,
    ancientGold: 0xb7950b,
    cyanAccent: 0x00f0ff,
    skyTop: 0x0a1c18,
    skyBottom: 0x143329
  },
  dimensions: {
    width: 5400,
    height: 480,
    floorY: 370
  },
  spawn: { x: 80, y: 320 },
  checkpoints: [
    { id: 'cp_canopy',      x: 80,   y: 320, label: 'FOREST PERIMETER' },
    { id: 'cp_ravine',      x: 1320, y: 235, label: 'THE GREAT RAVINE' },
    { id: 'cp_station',     x: 2600, y: 320, label: 'RESEARCH STATION' },
    { id: 'cp_overlook',    x: 3550, y: 320, label: 'CANOPY OVERLOOK' },
    { id: 'cp_elder_grove', x: 4800, y: 320, label: 'ELDER GROVE THRESHOLD' }
  ],
  puzzle: {
    bridgeA: { x: 1440, y: 280 },
    bridgeB: { x: 1560, y: 280 },
    bridgeC: { x: 1680, y: 280 },
    movingPlatform1: { startX: 680, endX: 880, y: 240 },
    movingPlatform2: { startX: 2300, endX: 2480, y: 260 },
    component4: { x: 5180, y: 270 },
    exitPortal: { x: 5320, y: 310 }
  }
} as const;

export const LEVEL4_DIFFICULTY_CONFIG = {
  parCharges: 14,
  golemPatrolSpeed: 75,
  golemAlertSpeed: 135,
  golemDetectionRadius: 140,
  fallingBranchTriggerDistance: 60,
  collapsingLogDurationMs: 1200,
  sporeVentCloudDurationMs: 2500,
  elderAltarGrowthWindowMs: 25000,
  maxJumpSafetyMargin: 0.15
} as const;

export class Level4Scene extends Phaser.Scene {
  // Entities & Controllers
  private player!: Player;
  private staffController!: StaffController;
  private timeAbility!: TimeAbility;
  private timeObjects: ITimeStateObject[] = [];

  // Puzzle & Interactive References
  private bridgeSections: BrokenBridgeSection[] = [];
  private movingPlatforms: TimeMovingPlatform[] = [];
  private fallingBranches: FallingBranch[] = [];
  private activeGolems: ActiveForestGolem[] = [];

  // Growth Clock & Extended Collectibles
  private growthObjects: GrowthClockObject[] = [];
  private seedPodItems: SeedPodItem[] = [];
  private seedPodsCollected = 0;
  private elderAltarSlots: GrowthClockObject[] = [];
  private isAltarGrowing = false;
  private altarTimer = 0;
  private isElderTreeAwakened = false;
  private alertCount = 0;
  private alertedGolemIds = new Set<string>();
  private staffPulseCooldown = 0;

  // Static Geometry & Hazards
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup;
  private ruinsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private thornBeds: Phaser.GameObjects.Sprite[] = [];
  private swingingLogs: Phaser.GameObjects.Sprite[] = [];

  // Collectibles & Exit
  private component4Sprite?: Phaser.Physics.Arcade.Sprite;
  private exitPortalSprite?: Phaser.GameObjects.Sprite;
  private conduitCrystals: Phaser.GameObjects.Sprite[] = [];

  // UI & Systems
  private hud!: HUD;
  private isPaused = false;
  private pauseMenu: PauseMenu | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private levelStartTime = 0;
  private deathCount = 0;
  private hasCollectedComponent4 = false;

  // Objective HUD Pill & World Indicators
  private objectiveContainer!: Phaser.GameObjects.Container;
  private objectiveBg!: Phaser.GameObjects.Graphics;
  private objectiveText!: Phaser.GameObjects.Text;
  private currentObjective = '';
  private worldIndicators: Array<{ id: string; container: Phaser.GameObjects.Container }> = [];
  private discoveredZones = new Set<number>();
  private staffRangeGfx!: Phaser.GameObjects.Graphics;

  // Scene-owned state flags
  private isRespawning = false;
  private isLevelComplete = false;
  private isLeavingScene = false;
  private lastMissingComponentBanner = -Infinity;
  private component4Overlap?: Phaser.Physics.Arcade.Collider;
  private mobileHandle: MobileSetupHandle | null = null;

  // Active Checkpoint
  private checkpointX: number = LEVEL4_DATA.spawn.x;
  private checkpointY: number = LEVEL4_DATA.spawn.y;

  // Visual Effects
  private waterfallGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Level4Scene');
  }

  create(): void {
    AudioManager.init();
    AudioManager.startLevel4Music();
    this.physics.resume();
    this.isPaused = false;
    this.pauseMenu = null;
    this.gameOverScreen = null;
    this.levelStartTime = Date.now();
    this.timeObjects = [];
    this.bridgeSections = [];
    this.movingPlatforms = [];
    this.fallingBranches = [];
    this.activeGolems = [];
    this.growthObjects = [];
    this.seedPodItems = [];
    this.seedPodsCollected = 0;
    this.elderAltarSlots = [];
    this.isAltarGrowing = false;
    this.altarTimer = 0;
    this.isElderTreeAwakened = false;
    this.alertCount = 0;
    this.alertedGolemIds = new Set();
    this.thornBeds = [];
    this.swingingLogs = [];
    this.conduitCrystals = [];
    this.worldIndicators = [];
    this.discoveredZones = new Set();
    this.hasCollectedComponent4 = false;

    this.isRespawning = false;
    this.isLevelComplete = false;
    this.isLeavingScene = false;
    this.lastMissingComponentBanner = -Infinity;
    this.component4Overlap = undefined;
    this.component4Sprite = undefined;
    this.exitPortalSprite = undefined;
    this.deathCount = 0;
    this.checkpointX = LEVEL4_DATA.spawn.x;
    this.checkpointY = LEVEL4_DATA.spawn.y;

    this.events.once('shutdown', () => {
      this.worldIndicators.forEach(w => w.container.destroy());
      this.worldIndicators = [];
      this.growthObjects.forEach(g => g.destroy());
      this.growthObjects = [];
      this.staffRangeGfx?.destroy();
    });

    this.physics.world.setBounds(0, 0, LEVEL4_DATA.dimensions.width, 800);

    // 1. Build Ambient Ancient Forest Visuals (Trees, Waterfall, Vines, Gears)
    this.buildForestBackground();

    // 2. Build Terrain & Static Platforms
    TextureGenerator.generatePlayerTextures(this);
    this.buildTerrain();

    // 3. Spawn Player
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // 4. Initialize Staff Controller
    this.staffController = new StaffController(this, {
      initialAbilities: ['TIME'],
      defaultSelected: 'TIME',
      interactionRange: 165
    });
    this.player.setStaffController(this.staffController);

    // 5. Build Time-Affected Mechanisms & Growth Clock Objects
    this.buildTimeMechanisms();

    // 6. Initialize Time Ability
    this.timeAbility = new TimeAbility(this, this.player, this.timeObjects);
    this.staffController.registerAbilityHandler('TIME', () => this.handleStaffPulse());

    // 7. Build Hazards (Thorns, Falling Branches, Swinging Logs, Active Golems)
    this.buildHazards();

    // 8. Build Collectibles, Seed Pods, Rechargers & Exit Gateway
    this.buildCollectiblesAndExit();

    // 9. Setup Collisions & Overlaps
    this.setupColliders();

    // 10. Setup HUD & Objective Pill
    this.hud = new HUD(this, 'SECTOR 4 · ANCIENT FOREST', LEVEL4_DATA.palette.mutedGold);
    this.hud.setFailsafeFound(3, 5);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);
    this.staffController.connectHud(this.hud);

    this.setupObjectiveHUD();
    this.setObjective('RESTORE THE COLLAPSED RAVINE BRIDGES [T/E]');
    this.setupWorldIndicators();

    this.staffRangeGfx = this.add.graphics().setDepth(20);

    this.player.on('player_damaged', (hp: number) => {
      this.hud.updateIntegrity(hp);
    });
    this.player.on('player_respawn', () => {
      this.hud.updateIntegrity(this.player.integrity);
      this.hud.updateCharges(this.player.staffCharges);
    });

    // 11. Camera Tracking
    this.cameras.main.setBounds(0, 0, LEVEL4_DATA.dimensions.width, LEVEL4_DATA.dimensions.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(500, 10, 28, 20);

    // 12. Connect Pause & Keyboard
    this.hud.onPauseClicked(() => this.togglePause());
    if (this.input.keyboard) {
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T).on('down', () => this.handleStaffPulse());
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E).on('down', () => this.handleStaffPulse());
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.handleStaffPulse());
    }

    this.time.delayedCall(1200, () => {
      this.hud.showBanner('SECTOR 4: ANCIENT FOREST — USE [T/E] TO PULSE SAPLINGS & RESTORE BRIDGES');
    });

    // ── Mobile Controls (additive — no-op on desktop) ─────────────────────
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,
      onAbilityPressed: () => {
        this.handleStaffPulse();
      },
      getAbilityState: () => {
        return {
          label: 'TIME',
          available: this.player.staffCharges > 0 && !this.player.isDead,
          tint: LEVEL4_DATA.palette.mutedGold,
          cooldownProgress: 0
        };
      }
    });
  }

  // ── Background Architecture & Ancient Forest Aesthetics ───────────────────

  private buildForestBackground(): void {
    const W = LEVEL4_DATA.dimensions.width;
    const H = LEVEL4_DATA.dimensions.height;

    // Forest sky canopy gradient
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(
      LEVEL4_DATA.palette.skyTop,
      LEVEL4_DATA.palette.skyTop,
      LEVEL4_DATA.palette.skyBottom,
      LEVEL4_DATA.palette.skyBottom,
      1
    );
    sky.fillRect(0, 0, W, H);

    // Giant ancient redwood trees (monolithic tree trunks) spanning 5400px
    const treeGfx = this.add.graphics().setDepth(1);
    const treeCoords = [140, 480, 840, 1260, 1920, 2350, 2780, 3150, 3500, 3880, 4260, 4650, 5040, 5320];
    treeCoords.forEach(tx => {
      // Colossal trunk for Elder Tree at 5040
      const isElder = (tx === 5040);
      const trunkW = isElder ? 140 : 70;
      treeGfx.fillStyle(isElder ? 0x24140e : LEVEL4_DATA.palette.barkBrown, 0.92);
      treeGfx.fillRect(tx - trunkW / 2, 0, trunkW, H);

      treeGfx.fillStyle(0x3e2723, 0.8);
      treeGfx.fillRect(tx - 25, 0, 12, H);
      treeGfx.fillRect(tx + 10, 0, 10, H);

      treeGfx.fillStyle(isElder ? 0x52b788 : LEVEL4_DATA.palette.forestDark, 0.6);
      for (let y = 80; y < H; y += 70) {
        treeGfx.fillCircle(tx + (y % 20) - 10, y, isElder ? 22 : 14);
      }
    });

    // Overgrown stone ruins & ancient brass clockwork gears in background
    const ruinsGfx = this.add.graphics().setDepth(2);
    ruinsGfx.fillStyle(0x283618, 0.7);
    ruinsGfx.fillRoundedRect(320, 180, 140, 190, 8);
    ruinsGfx.fillRoundedRect(1020, 150, 160, 220, 8);
    ruinsGfx.fillRoundedRect(2420, 140, 180, 230, 8);
    ruinsGfx.fillRoundedRect(3680, 160, 160, 210, 8);
    ruinsGfx.fillRoundedRect(4400, 180, 150, 190, 8);
    ruinsGfx.fillRoundedRect(4950, 130, 220, 240, 10);

    // Glowing cyan runes on the ancient stones
    ruinsGfx.lineStyle(2, LEVEL4_DATA.palette.cyanAccent, 0.65);
    ruinsGfx.strokeCircle(390, 220, 14);
    ruinsGfx.lineBetween(390, 200, 390, 240);
    ruinsGfx.strokeCircle(1100, 200, 18);
    ruinsGfx.lineBetween(1085, 200, 1115, 200);
    ruinsGfx.strokeCircle(5040, 200, 24);
    ruinsGfx.lineBetween(5040, 175, 5040, 225);

    // Ancient clockwork gears in the tree trunks (temporal machinery)
    const gearGfx = this.add.graphics().setDepth(3);
    const gears = [
      { x: 520,  y: 220, r: 38 },
      { x: 1980, y: 190, r: 45 },
      { x: 2380, y: 210, r: 32 },
      { x: 3720, y: 200, r: 40 },
      { x: 4780, y: 210, r: 36 }
    ];
    gears.forEach(g => {
      gearGfx.lineStyle(3, LEVEL4_DATA.palette.ancientGold, 0.75);
      gearGfx.strokeCircle(g.x, g.y, g.r);
      gearGfx.fillStyle(LEVEL4_DATA.palette.darkWood, 0.7);
      gearGfx.fillCircle(g.x, g.y, g.r);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const tx = g.x + Math.cos(a) * (g.r + 5);
        const ty = g.y + Math.sin(a) * (g.r + 5);
        gearGfx.fillStyle(LEVEL4_DATA.palette.mutedGold, 0.8);
        gearGfx.fillCircle(tx, ty, 4);
      }
    });

    // Cascading Waterfall in the Great Ravine (x: 1550 - 1650)
    this.waterfallGfx = this.add.graphics().setDepth(2);
    this.renderWaterfall();

    // Floating Glowing Spores / Fireflies across entire width
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 50, max: W - 50 },
      y: { min: 80, max: H - 80 },
      speed: { min: 8, max: 25 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x52b788, 0x00f0ff, 0xd4af37],
      lifespan: 2500,
      quantity: 1,
      frequency: 140
    }).setDepth(5);

    // Hanging Vines
    const vineGfx = this.add.graphics().setDepth(4);
    vineGfx.lineStyle(2, LEVEL4_DATA.palette.forestMid, 0.8);
    for (let vx = 100; vx < W; vx += 110) {
      vineGfx.lineBetween(vx, 0, vx + 6, 75);
      vineGfx.lineBetween(vx + 6, 75, vx - 4, 130);
    }
  }

  private renderWaterfall(): void {
    if (!this.waterfallGfx) return;
    this.waterfallGfx.clear();

    const wx = 1560;
    const wy = 120;
    const wh = 360;

    // Waterfall curtain gradient
    this.waterfallGfx.fillStyle(0x0077b6, 0.55);
    this.waterfallGfx.fillRect(wx - 45, wy, 90, wh);

    this.waterfallGfx.fillStyle(0x48cae4, 0.7);
    this.waterfallGfx.fillRect(wx - 28, wy, 56, wh);

    this.waterfallGfx.fillStyle(0xffffff, 0.85);
    for (let i = 0; i < 4; i++) {
      this.waterfallGfx.fillRect(wx - 20 + i * 12, wy, 3, wh);
    }
  }

  // ── Terrain & Static Platforms ────────────────────────────────────────────

  private buildTerrain(): void {
    this.groundGroup = this.physics.add.staticGroup();
    this.ruinsGroup = this.physics.add.staticGroup();

    const floorY = LEVEL4_DATA.dimensions.floorY;

    // Zone 1 Ground: x: 0 -> 1360
    this.createStaticFloor(0, 1360, floorY, 0x2d6a4f);

    // The Great Ravine Chasm Drop: x: 1360 -> 1760 (bottomless waterfall gorge!)

    // Zone 2, 3 & 4 Ground: x: 1760 -> 3400
    this.createStaticFloor(1760, 3400, floorY, 0x2d6a4f);

    // Canopy Root Chasm Drop: x: 3400 -> 3550

    // Zone 5 Ground: x: 3550 -> 4300
    this.createStaticFloor(3550, 4300, floorY, 0x24382c);

    // Toxic Spore Marsh Gorge: x: 4300 -> 4700

    // Zone 7 Elder Grove Sacred Ground: x: 4700 -> 5400
    this.createStaticFloor(4700, 5400, floorY, 0x1b4332);

    // Sealed Eastern Wall at 5400
    for (let y = 0; y < floorY + 50; y += 32) {
      const wTile = this.add.sprite(5400, y, 'proto_tile').setDisplaySize(32, 32).setTint(0x1b4332);
      this.physics.add.existing(wTile, true);
      this.ruinsGroup.add(wTile);
    }

    // Ancient Stone Ruin Platforms & Stepped High Ledges (all jump rises 35-50px)
    const ruins = [
      // Zone 1 steps up to Moving Platform 1 (y: 240)
      { x: 260,  y: 325, w: 80,  h: 18 },
      { x: 380,  y: 280, w: 85,  h: 18 },
      { x: 520,  y: 240, w: 90,  h: 18 },
      { x: 1020, y: 270, w: 90,  h: 18 },
      { x: 1180, y: 325, w: 80,  h: 18 },
      { x: 1320, y: 280, w: 90,  h: 22 }, // Ravine West Anchor
      { x: 1800, y: 280, w: 90,  h: 22 }, // Ravine East Anchor
      { x: 1930, y: 325, w: 80,  h: 18 },
      // Zone 3: Ascent to Ancient Machinery & Research Station
      { x: 2100, y: 325, w: 80,  h: 18 },
      { x: 2220, y: 280, w: 80,  h: 18 },
      { x: 2600, y: 280, w: 90,  h: 18 }, // Observation Balcony
      { x: 2760, y: 320, w: 140, h: 22 },
      // Zone 4: Canopy Climb & Root Bridges
      { x: 2880, y: 325, w: 80,  h: 18 },
      { x: 3040, y: 240, w: 75,  h: 18 },
      { x: 3260, y: 220, w: 80,  h: 18 },
      { x: 3380, y: 160, w: 90,  h: 20 }, // High Canopy Branch with Seed Pod 1!
      { x: 3480, y: 260, w: 75,  h: 18 },
      { x: 3550, y: 320, w: 90,  h: 20 }, // Canopy Overlook Checkpoint 4
      // Zone 5: Rotting Ruins & Crypt
      { x: 3710, y: 310, w: 60,  h: 18 },
      { x: 3820, y: 310, w: 60,  h: 18 },
      { x: 4040, y: 320, w: 80,  h: 18 },
      { x: 4120, y: 270, w: 80,  h: 18 },
      { x: 4180, y: 230, w: 90,  h: 20 }, // Crypt Altar with Seed Pod 2!
      // Zone 6: Spore Marsh
      { x: 4280, y: 330, w: 75,  h: 18 },
      { x: 4440, y: 310, w: 75,  h: 18 }, // Floating Marsh Log
      { x: 4660, y: 240, w: 90,  h: 20 }, // Marsh Dais with Seed Pod 3!
      // Zone 7: Elder Grove Finale
      { x: 4800, y: 320, w: 90,  h: 20 }, // Threshold Dais Checkpoint 5
      { x: 5040, y: 350, w: 220, h: 22 }, // Grove Altar Stone Base
      { x: 5180, y: 290, w: 80,  h: 22 }, // Ancient Vault Pedestal
      { x: 5320, y: 325, w: 100, h: 22 }  // Extraction Platform
    ];

    ruins.forEach(r => {
      const tile = this.add.sprite(r.x, r.y, 'proto_tile')
        .setDisplaySize(r.w, r.h)
        .setTint(LEVEL4_DATA.palette.mossGreen)
        .setDepth(10);
      this.physics.add.existing(tile, true);
      this.ruinsGroup.add(tile);

      const border = this.add.graphics().setDepth(11);
      border.lineStyle(1.5, LEVEL4_DATA.palette.mutedGold, 0.7);
      border.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 3);
    });
  }

  private createStaticFloor(startX: number, endX: number, y: number, tint: number): void {
    const width = endX - startX;
    const centerX = startX + width / 2;

    const floor = this.add.sprite(centerX, y + 25, 'proto_tile')
      .setDisplaySize(width, 50)
      .setTint(tint)
      .setDepth(10);

    this.physics.add.existing(floor, true);
    this.groundGroup.add(floor);

    // Decorative grass & moss fringe
    const mossGfx = this.add.graphics().setDepth(11);
    mossGfx.fillStyle(LEVEL4_DATA.palette.forestLight, 1);
    for (let x = startX; x < endX; x += 16) {
      mossGfx.fillRect(x, y, 14, 4);
    }
  }

  // ── Time-Affected Mechanisms & Puzzle Objects ─────────────────────────────

  private buildTimeMechanisms(): void {
    const pz = LEVEL4_DATA.puzzle;

    // 1. The Partly Collapsed Suspension Bridge (The Great Ravine Puzzle)
    const bridgeA = new BrokenBridgeSection(this, 'bridge_section_a', pz.bridgeA.x, pz.bridgeA.y, false);
    this.bridgeSections.push(bridgeA);
    this.timeObjects.push(bridgeA);

    const bridgeB = new BrokenBridgeSection(this, 'bridge_section_b', pz.bridgeB.x, pz.bridgeB.y, true);
    this.bridgeSections.push(bridgeB);
    this.timeObjects.push(bridgeB);

    const bridgeC = new BrokenBridgeSection(this, 'bridge_section_c', pz.bridgeC.x, pz.bridgeC.y, false);
    this.bridgeSections.push(bridgeC);
    this.timeObjects.push(bridgeC);

    // 2. Oscillating Canopy Platform in Zone 1 (Can be frozen in stasis)
    const mov1 = new TimeMovingPlatform(
      this,
      'mov_plat_1',
      pz.movingPlatform1.startX,
      pz.movingPlatform1.endX,
      pz.movingPlatform1.y,
      60
    );
    this.movingPlatforms.push(mov1);
    this.timeObjects.push(mov1);

    // 3. Oscillating Platform in Zone 3 (Ancient Machinery Shaft)
    const mov2 = new TimeMovingPlatform(
      this,
      'mov_plat_2',
      pz.movingPlatform2.startX,
      pz.movingPlatform2.endX,
      pz.movingPlatform2.y,
      75
    );
    this.movingPlatforms.push(mov2);
    this.timeObjects.push(mov2);

    // ── Growth Clock Objects ──
    // Zone 1: Sapling 1 (Seed -> Sapling -> Grown Tree) & Briar 1
    const sapling1 = new GrowthClockObject(this, 'sapling_1', 'SAPLING', 480, 350, this.player, 0);
    const briar1 = new GrowthClockObject(this, 'briar_1', 'BRIAR_THORN', 800, 360, this.player, 0);
    this.growthObjects.push(sapling1, briar1);

    // Zone 4: Canopy Climb (Fungus bounce -> Vine bridge -> Sapling tree)
    const fungus1 = new GrowthClockObject(this, 'fungus_1', 'FUNGUS', 2950, 350, this.player, 0);
    const vine1 = new GrowthClockObject(this, 'vine_1', 'VINE', 3120, 220, this.player, 0);
    const sapling2 = new GrowthClockObject(this, 'sapling_2', 'SAPLING', 3340, 200, this.player, 0);
    this.growthObjects.push(fungus1, vine1, sapling2);

    // Zone 5: Rotting Ruins (Collapsing log bridge & Briar gate)
    const log1 = new GrowthClockObject(this, 'log_bridge_1', 'LOG_BRIDGE', 3765, 310, this.player, 1);
    const briar2 = new GrowthClockObject(this, 'briar_2', 'BRIAR_THORN', 3950, 360, this.player, 0);
    this.growthObjects.push(log1, briar2);

    // Zone 6: Toxic Spore Marsh (Spore vent & Super Trampoline fungus)
    const spore1 = new GrowthClockObject(this, 'spore_vent_1', 'SPORE_VENT', 4380, 360, this.player, 2);
    const fungus2 = new GrowthClockObject(this, 'fungus_2', 'FUNGUS', 4520, 350, this.player, 0);
    this.growthObjects.push(spore1, fungus2);

    // Zone 7: Elder Grove Sacred Altar (3 Planting Slots)
    const slot1 = new GrowthClockObject(this, 'altar_slot_1', 'ALTAR_SLOT', 4960, 335, this.player, 0);
    const slot2 = new GrowthClockObject(this, 'altar_slot_2', 'ALTAR_SLOT', 5040, 335, this.player, 0);
    const slot3 = new GrowthClockObject(this, 'altar_slot_3', 'ALTAR_SLOT', 5120, 335, this.player, 0);
    this.elderAltarSlots.push(slot1, slot2, slot3);
    this.growthObjects.push(slot1, slot2, slot3);

    // Growth Clock objects are managed directly by handleStaffPulse targeting
    this.growthObjects.forEach(obj => {
      if (obj.type !== 'ALTAR_SLOT') {
        this.timeObjects.push(obj);
      }
    });
  }

  // ── Hazards (Falling Branches, Golems, Thorns, Logs) ──────────────────────

  private buildHazards(): void {
    // 1. Falling Branches (Crush hazards that can be rewound or frozen)
    const branchCoords = [
      { x: 420, origY: 90, targetY: 265 },
      { x: 960, origY: 80, targetY: 350 },
      { x: 2280, origY: 80, targetY: 350 }
    ];

    branchCoords.forEach((b, idx) => {
      const branch = new FallingBranch(this, `branch_${idx}`, b.x, b.origY, b.targetY);
      this.fallingBranches.push(branch);
      this.timeObjects.push(branch);
    });

    // 2. Active Forest Golems (Wider detection, faster turnaround, alert propagation)
    const golemConfigs = [
      { id: 'golem_0', x: 680,  y: 355, minX: 580,  maxX: 790,  pSpeed: 70, aSpeed: 130 },
      { id: 'golem_1', x: 2100, y: 355, minX: 1980, maxX: 2220, pSpeed: 75, aSpeed: 135 },
      { id: 'golem_2', x: 2600, y: 355, minX: 2490, maxX: 2700, pSpeed: 80, aSpeed: 140 },
      { id: 'golem_3', x: 3860, y: 355, minX: 3770, maxX: 3960, pSpeed: 85, aSpeed: 145 },
      { id: 'golem_4', x: 4500, y: 355, minX: 4420, maxX: 4620, pSpeed: 80, aSpeed: 140 }
    ];

    golemConfigs.forEach(cfg => {
      const golem = new ActiveForestGolem(
        this,
        cfg.id,
        cfg.x,
        cfg.y,
        cfg.minX,
        cfg.maxX,
        this.player,
        (id: string) => {
          if (!this.alertedGolemIds.has(id)) {
            this.alertedGolemIds.add(id);
            this.alertCount++;
            this.cameras.main.shake(120, 0.008);
            this.hud.showBanner(`GUARDIAN ALERTED! ALERT LEVEL: ${this.alertCount}`);
          }
        },
        cfg.pSpeed,
        cfg.aSpeed
      );
      this.activeGolems.push(golem);
      this.timeObjects.push(golem);
    });

    // 3. Static Briar Thorn Beds
    const thornCoords = [
      { x: 800, y: LEVEL4_DATA.dimensions.floorY },
      { x: 2250, y: LEVEL4_DATA.dimensions.floorY },
      { x: 2420, y: LEVEL4_DATA.dimensions.floorY }
    ];

    thornCoords.forEach(t => {
      const thorn = this.add.sprite(t.x, t.y + 6, 'proto_hazard')
        .setDisplaySize(54, 18)
        .setTint(0x8b0000)
        .setDepth(11);
      this.physics.add.existing(thorn, true);
      this.thornBeds.push(thorn);
    });

    // 4. Swinging Spiked Log in the Great Ravine
    const log = this.add.sprite(1560, 190, 'proto_hazard')
      .setDisplaySize(38, 22)
      .setTint(0x5c4033)
      .setDepth(12);

    this.physics.add.existing(log, false);
    const logBody = log.body as Phaser.Physics.Arcade.Body;
    logBody.setAllowGravity(false);
    logBody.setImmovable(true);
    this.swingingLogs.push(log);

    this.tweens.add({
      targets: log,
      y: 250,
      yoyo: true,
      repeat: -1,
      duration: 1100,
      ease: 'Sine.easeInOut'
    });
  }

  // ── Collectibles, Conduit Crystals & Exit Gateway ─────────────────────────

  private buildCollectiblesAndExit(): void {
    const pz = LEVEL4_DATA.puzzle;

    // 1. Staff Energy Conduit Crystals (8 Fountains across Sector 4)
    const crystalCoords = [
      { x: 1020, y: 235 },
      { x: 1800, y: 245 },
      { x: 2600, y: 245 },
      { x: 3500, y: 290 },
      { x: 4220, y: 290 },
      { x: 4720, y: 290 },
      { x: 4880, y: 290 },
      { x: 5080, y: 310 } // Elder Grove Sacred Altar Fountain
    ];

    crystalCoords.forEach((c, idx) => {
      const crystal = this.add.sprite(c.x, c.y, 'proto_tile')
        .setDisplaySize(16, 16)
        .setTint(0x00f0ff)
        .setDepth(14);
      this.physics.add.existing(crystal, true);
      this.conduitCrystals.push(crystal);

      this.tweens.add({
        targets: crystal,
        y: c.y - 8,
        yoyo: true,
        repeat: -1,
        duration: 900 + idx * 70,
        ease: 'Sine.easeInOut'
      });
    });

    // 2. Ancient Seed Pods (3 needed to reawaken the Elder Tree)
    const pod1 = new SeedPodItem(this, 'seed_pod_1', 3380, 130);
    const pod2 = new SeedPodItem(this, 'seed_pod_2', 4180, 200);
    const pod3 = new SeedPodItem(this, 'seed_pod_3', 4660, 210);
    this.seedPodItems.push(pod1, pod2, pod3);

    // 3. Component 04: The Ancient Chrono-Matrix Core (Inside Elder Grove Vault)
    // Initially hidden and inactive — only manifests once the Elder Grove Altar plants are fully bloomed
    this.component4Sprite = this.physics.add.sprite(pz.component4.x, pz.component4.y, 'failsafe_component')
      .setScale(1.8)
      .setDepth(15)
      .setVisible(false)
      .setActive(false);
    const c4Body = this.component4Sprite.body as Phaser.Physics.Arcade.Body;
    c4Body.setAllowGravity(false);
    c4Body.setImmovable(true);
    c4Body.setSize(32, 32);
    c4Body.enable = false;

    // 4. Extraction Gateway Portal (Exit to Sector 5)
    this.exitPortalSprite = this.add.sprite(pz.exitPortal.x, pz.exitPortal.y, 'failsafe_component')
      .setScale(2.4)
      .setTint(0x00f0ff)
      .setDepth(15);

    this.tweens.add({
      targets: this.exitPortalSprite,
      angle: 360,
      repeat: -1,
      duration: 4500
    });
  }

  // ── Physics Colliders & Overlaps ──────────────────────────────────────────

  private setupColliders(): void {
    // Player vs Ground & Ruins
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.ruinsGroup);

    // Player vs Bridge Sections — only solid when RESTORED
    this.bridgeSections.forEach(b => {
      this.physics.add.collider(this.player, b.sprite, undefined, () => b.currentState === 'RESTORED');
    });

    // Player vs Moving Platforms
    this.movingPlatforms.forEach(p => {
      this.physics.add.collider(this.player, p.sprite);
    });

    // Player vs Falling Branches
    this.fallingBranches.forEach(b => {
      this.physics.add.collider(this.player, b.sprite, () => {
        if (b.currentState === 'FALLING') {
          this.handleDamage('CRUSHED BY FALLING BRANCH');
        }
      });
    });

    // Player vs Active Golems
    this.activeGolems.forEach(g => {
      this.physics.add.overlap(this.player, g.sprite, () => {
        if (g.currentState !== 'CHRONO_STASIS') {
          this.handleDamage('ANCIENT GOLEM STRIKE');
        }
      });
    });

    // Player vs Static Thorns
    this.thornBeds.forEach(t => {
      this.physics.add.overlap(this.player, t, () => {
        this.handleDamage('BRIAR THORN DAMAGE');
      });
    });

    // Player vs Swinging Log
    this.swingingLogs.forEach(l => {
      this.physics.add.overlap(this.player, l, () => {
        this.handleDamage('SPIKED LOG IMPACT');
      });
    });

    // Player vs Growth Clock Objects (Solid collider + Bounce + Crumble trigger)
    this.growthObjects.forEach(obj => {
      this.physics.add.collider(this.player, obj.sprite, () => {
        const stage = obj.currentStageDef;
        // Check bouncy mushroom jump boost
        if (stage.isBouncy && stage.bounceVelocity) {
          const pBody = this.player.body as Phaser.Physics.Arcade.Body;
          if (pBody && pBody.blocked.down) {
            pBody.setVelocityY(stage.bounceVelocity);
            AudioManager.playJump();
            const emitter = this.add.particles(obj.baseX, obj.y, 'proto_tile', {
              speed: { min: 30, max: 90 }, scale: { start: 0.35, end: 0 },
              tint: [0x52b788, 0xd4af37, 0xffffff], lifespan: 400, quantity: 10
            }).setDepth(20);
            this.time.delayedCall(450, () => emitter.destroy());
          }
        }
        // Check collapsing log trigger
        if (obj.type === 'LOG_BRIDGE') {
          obj.triggerLogCollapse();
        }
      }, () => obj.currentStageDef.isSolid);

      // Hazard overlap (Lethal Briars & Toxic Spores)
      this.physics.add.overlap(this.player, obj.sprite, () => {
        if (obj.currentStageDef.isHazard) {
          this.handleDamage(obj.type === 'SPORE_VENT' ? 'TOXIC SPORE INHALATION' : 'BRIAR THORN DAMAGE');
        }
      });
    });

    // Player vs Seed Pods
    this.seedPodItems.forEach(pod => {
      this.physics.add.overlap(this.player, pod.sprite, () => {
        if (!pod.collected) {
          pod.collect();
          this.seedPodsCollected++;
          AudioManager.playKeyCollect();
          this.cameras.main.flash(180, 82, 183, 136);
          this.hud.showBanner(`ANCIENT SEED POD RECOVERED! (${this.seedPodsCollected}/3)`);

          if (pod.id === 'seed_pod_1') this.removeWorldIndicator('ind_seed1');
          if (pod.id === 'seed_pod_2') this.removeWorldIndicator('ind_seed2');
          if (pod.id === 'seed_pod_3') this.removeWorldIndicator('ind_seed3');

          if (this.seedPodsCollected === 1) {
            this.setObjective('CROSS DECAYING BRIDGES & SECURE SEED POD 02');
          } else if (this.seedPodsCollected === 2) {
            this.setObjective('EXHAUST SPORE VENTS & SECURE SEED POD 03');
          } else if (this.seedPodsCollected >= 3) {
            this.setObjective('ALL 3 SEEDS COLLECTED! PROCEED TO ELDER GROVE ALTAR [➡]');
          }
        }
      });
    });

    // Player vs Conduit Crystals (Energy Refill)
    this.conduitCrystals.forEach(crystal => {
      this.physics.add.overlap(this.player, crystal, () => {
        if (!crystal.active) return;
        crystal.setActive(false).setVisible(false);
        if (crystal.body) {
          (crystal.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        }

        // Full energy restoration to max charges
        if (this.staffController) {
          this.staffController.chargeManager.setCharges(this.player.maxStaffCharges);
        }
        this.player.restoreStaffCharges(this.player.maxStaffCharges);
        this.player.staffCharges = this.player.maxStaffCharges;
        this.hud.updateCharges(this.player.staffCharges, this.player.maxStaffCharges);
        this.hud.showBanner('STAFF ENERGY FULLY RECHARGED!');
        AudioManager.playConduitRecharge();
        this.cameras.main.flash(140, 0, 240, 160);

        const emitter = this.add.particles(crystal.x, crystal.y, 'proto_tile', {
          speed: { min: 40, max: 110 }, scale: { start: 0.45, end: 0 },
          tint: [0x00f0ff, 0x52b788, 0xffffff], lifespan: 600, quantity: 18
        }).setDepth(20);
        this.time.delayedCall(650, () => emitter.destroy());

        crystal.setAlpha(0.25).setTint(0x444444);
        this.time.delayedCall(8000, () => {
          crystal.setActive(true).setVisible(true).clearTint().setAlpha(1);
          if (crystal.body) {
            (crystal.body as Phaser.Physics.Arcade.StaticBody).enable = true;
          }
        });
      });
    });

    // Player vs Component 04 Collection
    if (this.component4Sprite) {
      this.component4Overlap = this.physics.add.overlap(this.player, this.component4Sprite, () => {
        this.collectComponent4();
      });
    }

    // Player vs Exit Gateway
    if (this.exitPortalSprite) {
      const exitZone = this.add.zone(
        LEVEL4_DATA.puzzle.exitPortal.x,
        LEVEL4_DATA.puzzle.exitPortal.y,
        50, 70
      );
      this.physics.add.existing(exitZone, true);
      this.physics.add.overlap(this.player, exitZone, () => {
        this.handleLevelComplete();
      });
    }
  }

  // ── Gameplay Interactions ─────────────────────────────────────────────────

  private handleStaffPulse(): boolean {
    if (this.isRespawning || this.isLevelComplete || this.isLeavingScene) return false;

    // Cooldown debounce to prevent multiple triggers per keystroke
    if (this.staffPulseCooldown > 0) return false;

    const currentCharges = this.staffController
      ? this.staffController.chargeManager.getCharges()
      : this.player.staffCharges;

    if (currentCharges < 1) {
      AudioManager.playInsufficientCharge();
      this.cameras.main.shake(120, 0.006);
      this.hud.showBanner('STAFF ENERGY DEPLETED — FIND A TIME CRYSTAL!');
      return false;
    }

    const px = this.player.x;
    const py = this.player.y;

    // 1. Scan for nearest Growth Clock object in range
    // Prioritize unbloomed altar slots (stage < 3) when at the altar
    let nearestAging: GrowthClockObject | null = null;
    let minD = 165;
    for (const obj of this.growthObjects) {
      const d = Phaser.Math.Distance.Between(px, py, obj.baseX, obj.y);
      if (d <= obj.interactionRadius && d < minD) {
        if (obj.type === 'ALTAR_SLOT' && obj.currentStageIndex >= 3) {
          continue; // Prioritize slots that still need blooming
        }
        minD = d;
        nearestAging = obj;
      }
    }

    // Fallback if all nearby altar slots are already bloomed
    if (!nearestAging) {
      minD = 165;
      for (const obj of this.growthObjects) {
        const d = Phaser.Math.Distance.Between(px, py, obj.baseX, obj.y);
        if (d <= obj.interactionRadius && d < minD) {
          minD = d;
          nearestAging = obj;
        }
      }
    }

    if (nearestAging) {
      if (nearestAging.type === 'ALTAR_SLOT') {
        if (this.isElderTreeAwakened) {
          return false;
        }
        if (this.seedPodsCollected < 3) {
          this.hud.showBanner('COLLECT ALL 3 SEEDS BEFORE PLANTING AT THE ALTAR!');
          return false;
        }
        // Auto-plant seeds if not yet planted and player pulses altar slot with 3 seeds
        if (!this.isAltarGrowing) {
          this.isAltarGrowing = true;
          this.altarTimer = LEVEL4_DIFFICULTY_CONFIG.elderAltarGrowthWindowMs;
          this.elderAltarSlots.forEach(s => s.resetToStage(1));
          AudioManager.playKeyCollect();
          this.cameras.main.flash(200, 82, 183, 136);
          this.hud.showBanner('3 SEEDS PLANTED! PULSE ALL 3 SLOTS TO FULL BLOOM (25s)!');
          this.setObjective('PULSE ALL 3 ALTAR SLOTS TO FULL BLOOM! [25s]');
        }
        if (nearestAging.currentStageIndex >= 3) {
          this.hud.showBanner('THIS ALTAR SEED IS ALREADY IN FULL BLOOM!');
          return false;
        }
      }

      this.staffPulseCooldown = 250;

      // Deduct charge cleanly via ChargeManager
      if (this.staffController) {
        this.staffController.chargeManager.consumeCharge(1);
      } else {
        this.player.staffCharges = Math.max(0, this.player.staffCharges - 1);
      }
      this.player.staffCharges = this.staffController
        ? this.staffController.chargeManager.getCharges()
        : this.player.staffCharges;
      this.hud.updateCharges(this.player.staffCharges, this.player.maxStaffCharges);
      this.player.emit('staff_used', this.player.staffCharges);

      // Pulse ONLY the single targeted seed
      nearestAging.pulseGrowth();
      this.spawnStaffShockwave(px, py, nearestAging.baseX, nearestAging.y);
      return true;
    }

    // 2. Fallback to standard time ability objects (broken bridges, moving platforms, golems)
    this.staffPulseCooldown = 250;
    const activated = this.timeAbility.activate();
    this.player.staffCharges = this.staffController
      ? this.staffController.chargeManager.getCharges()
      : this.player.staffCharges;
    this.hud.updateCharges(this.player.staffCharges, this.player.maxStaffCharges);
    return activated;
  }

  private spawnStaffShockwave(fromX: number, fromY: number, toX: number, toY: number): void {
    const ring = this.add.graphics().setDepth(25);
    ring.lineStyle(3, 0x00f0ff, 1);
    ring.strokeCircle(fromX, fromY, 12);

    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 14,
      scaleY: 14,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    const beam = this.add.graphics().setDepth(24);
    beam.lineStyle(2.5, 0x52b788, 0.9);
    beam.lineBetween(fromX, fromY, toX, toY);

    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 280,
      onComplete: () => beam.destroy()
    });

    this.cameras.main.flash(90, 82, 183, 136);
  }

  private collectComponent4(): void {
    if (!this.component4Sprite || !this.component4Sprite.active || this.hasCollectedComponent4) return;

    this.hasCollectedComponent4 = true;
    AudioManager.playComponent3Collect();
    AudioManager.playFailsafe();

    const emitter = this.add.particles(this.component4Sprite.x, this.component4Sprite.y, 'proto_tile', {
      speed: { min: 80, max: 220 },
      scale: { start: 0.6, end: 0 },
      tint: [0x00f0ff, 0xd4af37, 0x52b788, 0xffffff],
      lifespan: 800,
      quantity: 26
    });
    this.time.delayedCall(850, () => emitter.destroy());

    this.component4Overlap?.destroy();
    this.component4Overlap = undefined;
    this.component4Sprite.destroy();
    this.component4Sprite = undefined;

    this.removeWorldIndicator('ind_core');
    this.setObjective('CHRONO-MATRIX SECURED! ESCAPE TO SECTOR 5 GATEWAY [➡]');

    // Refresh HUD
    this.hud.setFailsafeFound(4, 5);
    this.player.restoreStaffCharges(this.player.maxStaffCharges);
    this.hud.updateCharges(this.player.staffCharges);

    this.cameras.main.flash(350, 0, 240, 255);
    this.hud.showBanner('COMPONENT 04 (CHRONO-MATRIX) SECURED! ESCAPE TO SECTOR 5 GATEWAY!');
  }

  private handleDamage(reason: string): void {
    if (this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    if (this.player.isDead) return;

    const lethal = this.player.takeDamage();
    this.hud.updateIntegrity(this.player.integrity);
    this.cameras.main.shake(180, 0.015);
    this.cameras.main.flash(100, 255, 60, 60);

    if (lethal || this.player.integrity <= 0 || this.player.isDead) {
      this.handleDeath(reason);
    } else {
      AudioManager.playDeath();
    }
  }

  private handleDeath(reason = 'CHRONO DE-SYNCHRONIZATION'): void {
    if (this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    this.isRespawning = true;

    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    AudioManager.playDeath();

    this.cameras.main.shake(250, 0.018);
    this.hud.showBanner(`CRITICAL ANOMALY: ${reason}`);

    this.time.delayedCall(700, () => {
      if (this.isLevelComplete || this.isLeavingScene) return;
      this.physics.pause();

      const callbacks: GameOverCallbacks = {
        onRespawn: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.player.restoreIntegrity();
          this.player.respawnAt(this.checkpointX, this.checkpointY);
          if (this.staffController) {
            this.staffController.chargeManager.setCharges(this.player.maxStaffCharges);
          }
          this.player.restoreStaffCharges(this.player.maxStaffCharges);
          this.hud.updateIntegrity(this.player.integrity);
          this.hud.updateCharges(this.player.staffCharges);
          this.cameras.main.fadeIn(400, 0, 0, 0);
          this.isRespawning = false;

          // Reset mid-puzzle obstacles on respawn
          this.growthObjects.forEach(g => {
            if (g.type === 'LOG_BRIDGE' && g.currentStageIndex >= 2) {
              g.resetToStage(1);
            }
          });
          if (this.isAltarGrowing && !this.isElderTreeAwakened) {
            this.altarTimer = LEVEL4_DIFFICULTY_CONFIG.elderAltarGrowthWindowMs;
            this.elderAltarSlots.forEach(s => s.resetToStage(1));
          }
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
          this.isLeavingScene = true;
          this.physics.resume();
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
          });
          this.cameras.main.fadeOut(300, 0, 0, 0);
        }
      };

      this.gameOverScreen = new GameOverScreen(this, callbacks, reason);
    });
  }

  private handleLevelComplete(): void {
    if (this.isLevelComplete || this.isLeavingScene || this.isRespawning) return;

    if (!this.hasCollectedComponent4) {
      const now = this.time.now;
      if (now - this.lastMissingComponentBanner > 2000) {
        this.lastMissingComponentBanner = now;
        if (!this.isElderTreeAwakened) {
          this.hud.showBanner('GATEWAY LOCKED: BLOOM ALL 3 ALTAR PLANTS TO REVEAL FAILSAFE 04!');
        } else {
          this.hud.showBanner('CANNOT ESCAPE — COMPONENT 04 (CHRONO-MATRIX) MUST BE SECURED FIRST!');
        }
      }
      return;
    }

    this.isLevelComplete = true;
    this.isLeavingScene = true;

    // Save Level 4 completion
    SaveSystem.markLevelCompleted(4);

    this.physics.pause();

    this.hud.showBanner('SECTOR 4 RESTORATION COMPLETE! ADVANCING TO FUTURISTIC CORE!');
    AudioManager.playFailsafe();

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('LevelComplete', {
        failsafeCollected: 4,
        totalFailsafe: 5,
        deathCount: this.deathCount,
        timeMs: Date.now() - this.levelStartTime,
        sectorNumber: 4,
        alertCount: this.alertCount
      });
    });
    this.cameras.main.fadeOut(800, 10, 28, 20);
  }

  // ── Restart & Checkpoint Helpers ──────────────────────────────────────────

  private restartLevelFromBeginning(): void {
    this.checkpointX = LEVEL4_DATA.spawn.x;
    this.checkpointY = LEVEL4_DATA.spawn.y;
    this.deathCount = 0;
    this.alertCount = 0;
    this.alertedGolemIds.clear();
    this.seedPodsCollected = 0;
    this.isAltarGrowing = false;
    this.altarTimer = 0;
    this.isElderTreeAwakened = false;
    this.hasCollectedComponent4 = false;
    this.isPaused = false;
    this.isLeavingScene = false;
    this.physics.resume();
    this.scene.restart();
  }

  private restartAtCheckpoint(): void {
    this.resumeGame();
    this.player.restoreIntegrity();
    this.player.respawnAt(this.checkpointX, this.checkpointY);
    if (this.staffController) {
      this.staffController.chargeManager.setCharges(this.player.maxStaffCharges);
    }
    this.player.restoreStaffCharges(this.player.maxStaffCharges);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Reset mid-puzzle obstacles on checkpoint warp
    this.growthObjects.forEach(g => {
      if (g.type === 'LOG_BRIDGE' && g.currentStageIndex >= 2) {
        g.resetToStage(1);
      }
    });
    if (this.isAltarGrowing && !this.isElderTreeAwakened) {
      this.altarTimer = LEVEL4_DIFFICULTY_CONFIG.elderAltarGrowthWindowMs;
      this.elderAltarSlots.forEach(s => s.resetToStage(1));
    }

    AudioManager.playCheckpoint();
    this.hud.showBanner('WARPED TO ACTIVE CHECKPOINT');
  }

  private revealFailsafeComponent(): void {
    if (!this.component4Sprite || this.hasCollectedComponent4) return;

    this.component4Sprite.setVisible(true).setActive(true);
    if (this.component4Sprite.body) {
      (this.component4Sprite.body as Phaser.Physics.Arcade.Body).enable = true;
    }

    this.component4Sprite.setScale(0);
    this.tweens.add({
      targets: this.component4Sprite,
      scale: 2.2,
      duration: 800,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.component4Sprite?.active) return;
        this.tweens.add({
          targets: this.component4Sprite,
          scale: 2.6,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Radiant particle explosion at the failsafe pedestal
    const emitter = this.add.particles(this.component4Sprite.x, this.component4Sprite.y, 'proto_tile', {
      speed: { min: 60, max: 200 },
      scale: { start: 0.6, end: 0 },
      tint: [0x52b788, 0x00f0ff, 0xd4af37, 0xffffff],
      lifespan: 1200,
      quantity: 36
    }).setDepth(25);
    this.time.delayedCall(1300, () => emitter.destroy());

    this.removeWorldIndicator('ind_altar');
    this.createWorldIndicator('ind_core', 5180, 210, 'CHRONO-MATRIX CORE [FAILSAFE 04]', 0x00f0ff, '★');
  }

  // ── Pause Management ──────────────────────────────────────────────────────

  public togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  public pauseGame(): void {
    if (this.isPaused || this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    this.isPaused = true;
    this.physics.pause();

    const callbacks: PauseMenuCallbacks = {
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
    this.pauseMenu = new PauseMenu(this, callbacks);
  }

  public resumeGame(): void {
    if (!this.isPaused) return;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.isPaused = false;
    this.physics.resume();
  }

  // ── Update Loop ───────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    if (this.isPaused || this.isLevelComplete || this.isLeavingScene) return;

    if (this.player.isDead) {
      if (!this.isRespawning) this.handleDeath('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    if (this.staffPulseCooldown > 0) {
      this.staffPulseCooldown = Math.max(0, this.staffPulseCooldown - delta);
    }

    this.mobileHandle?.update();
    this.player.update(time, delta);
    this.timeAbility.update(time, delta);
    this.staffController.update(delta, this.player.x, this.player.y);

    // Update active golems
    this.activeGolems.forEach(g => g.update(time, delta));

    // Update Growth Clock objects
    this.growthObjects.forEach(g => g.update(time, delta));

    // Update staff range & reticle targeting
    this.updateStaffTargeting();

    // Trigger falling branches when Vance runs beneath
    for (const b of this.fallingBranches) {
      b.checkTrigger(this.player.x);
    }

    // Elder Tree Altar planting and growth countdown
    this.updateElderAltar(delta);

    // Void fall check (The Great Ravine, Canopy gap, Spore marsh)
    if (this.player.y > LEVEL4_DATA.dimensions.floorY + 50 && !this.player.isDead) {
      this.handleDeath('PLUNGED INTO THE WATERFALL GORGE');
    }

    // Proximity fallback for collecting Component 4 (only once Elder Tree is awakened and failsafe has appeared)
    if (this.component4Sprite && this.component4Sprite.active && this.isElderTreeAwakened && !this.hasCollectedComponent4 && !this.player.isDead) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.component4Sprite.x,
        this.component4Sprite.y
      );
      if (dist < 50) {
        this.collectComponent4();
      }
    }

    // Checkpoint activation checks across all 5 checkpoints
    const cps = LEVEL4_DATA.checkpoints;
    for (const cp of cps) {
      if (this.player.x >= cp.x && this.checkpointX < cp.x) {
        this.checkpointX = cp.x;
        this.checkpointY = cp.y;
        AudioManager.playCheckpoint();
        this.cameras.main.flash(200, 0, 240, 255);
        this.hud.showBanner(`CHECKPOINT REACHED — ${cp.label}`);
      }
    }

    // Check zone discovery
    this.checkZoneDiscovery();
  }

  private updateStaffTargeting(): void {
    this.staffRangeGfx.clear();
    const px = this.player.x;
    const py = this.player.y;

    let nearestAging: GrowthClockObject | null = null;
    let minD = 165;

    // Scan for nearest Growth Clock object in range, prioritizing unbloomed altar slots
    for (const obj of this.growthObjects) {
      const d = Phaser.Math.Distance.Between(px, py, obj.baseX, obj.y);
      if (d <= obj.interactionRadius && d < minD) {
        if (obj.type === 'ALTAR_SLOT' && obj.currentStageIndex >= 3) {
          continue; // Prioritize slots that still need blooming
        }
        minD = d;
        nearestAging = obj;
      }
    }

    // Fallback if all nearby altar slots are bloomed
    if (!nearestAging) {
      minD = 165;
      for (const obj of this.growthObjects) {
        const d = Phaser.Math.Distance.Between(px, py, obj.baseX, obj.y);
        if (d <= obj.interactionRadius && d < minD) {
          minD = d;
          nearestAging = obj;
        }
      }
    }

    // Strictly ensure only one single object is targeted/highlighted at any time
    for (const obj of this.growthObjects) {
      obj.setTargeted(obj === nearestAging);
    }

    // Draw subtle staff range indicator ring
    if (nearestAging) {
      this.staffRangeGfx.lineStyle(1, 0x00f0ff, 0.4);
      this.staffRangeGfx.strokeCircle(px, py, 165);
    }
  }

  private updateElderAltar(delta: number): void {
    const px = this.player.x;

    // Trigger planting when arriving at altar with 3 seeds (approaching x >= 4850)
    if (!this.isAltarGrowing && !this.isElderTreeAwakened && px >= 4850 && this.seedPodsCollected >= 3) {
      this.isAltarGrowing = true;
      this.altarTimer = LEVEL4_DIFFICULTY_CONFIG.elderAltarGrowthWindowMs;
      this.elderAltarSlots.forEach(s => s.resetToStage(1)); // Planted seed
      AudioManager.playKeyCollect();
      this.cameras.main.flash(200, 82, 183, 136);
      this.hud.showBanner('3 SEEDS PLANTED! PULSE ALL 3 SLOTS TO FULL BLOOM (25s)!');
      this.setObjective('PULSE ALL 3 ALTAR SLOTS TO FULL BLOOM! [25s]');
    }

    if (this.isAltarGrowing && !this.isElderTreeAwakened) {
      this.altarTimer -= delta;
      const secs = Math.max(0, Math.ceil(this.altarTimer / 1000));
      this.setObjective(`PULSE 3 ALTAR SLOTS TO FULL BLOOM! [${secs}s]`);

      // Check if all 3 slots are at stage 3 (FULL_BLOOM)
      const allBlooming = this.elderAltarSlots.every(s => s.currentStageIndex === 3);

      if (allBlooming) {
        this.isAltarGrowing = false;
        this.isElderTreeAwakened = true;
        AudioManager.playFailsafe();
        this.cameras.main.flash(400, 0, 240, 255);
        this.cameras.main.shake(250, 0.015);
        this.hud.showBanner('THE ELDER TREE HAS REAWAKENED! CHRONO-MATRIX VAULT UNLOCKED!');
        this.setObjective('ELDER TREE REAWAKENED! SECURE CHRONO-MATRIX CORE [★]');
        // Reveal the failsafe component now that elder grove altar plants are fully bloomed
        this.revealFailsafeComponent();
      } else if (this.altarTimer <= 0) {
        // Growth window expired — reset slots to stage 1 without killing player
        this.altarTimer = LEVEL4_DIFFICULTY_CONFIG.elderAltarGrowthWindowMs;
        this.elderAltarSlots.forEach(s => s.resetToStage(1));
        this.hud.showBanner('GROWTH WINDOW EXPIRED! RE-PULSE THE 3 ALTAR SLOTS!');
      }
    }
  }

  // ── Objective HUD Pill & Guidance Indicators ──────────────────────────────

  private setupObjectiveHUD(): void {
    const W = this.cameras.main.width;
    this.objectiveContainer = this.add.container(W / 2, 53).setScrollFactor(0).setDepth(55);

    this.objectiveBg = this.add.graphics();
    this.objectiveText = this.add.text(0, 0, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.objectiveContainer.add([this.objectiveBg, this.objectiveText]);
  }

  public setObjective(text: string): void {
    this.currentObjective = text;
    this.objectiveText.setText(`🎯 ${text}`);

    const textWidth = this.objectiveText.width + 24;
    const pillWidth = Math.max(textWidth, 240);
    const pillHeight = 18;

    this.objectiveBg.clear();
    this.objectiveBg.fillStyle(0x060d0b, 0.92);
    this.objectiveBg.fillRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, 9);
    this.objectiveBg.lineStyle(1.5, LEVEL4_DATA.palette.mossGreen, 0.85);
    this.objectiveBg.strokeRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, 9);

    this.tweens.killTweensOf(this.objectiveContainer);
    this.objectiveContainer.setScale(1.1);
    this.tweens.add({
      targets: this.objectiveContainer,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });
  }

  public get objective(): string {
    return this.currentObjective;
  }

  private setupWorldIndicators(): void {
    // Zone 1
    this.createWorldIndicator('ind_hint_time', 100, 260, '[T/E] CHRONO CONDUIT & GROWTH PULSE', 0x00f0ff, '⏳');
    this.createWorldIndicator('ind_sapling1', 480, 310, 'AGE SAPLING TO STEP', 0x52b788, '🌱');
    this.createWorldIndicator('ind_briar1', 800, 330, 'WITHER BRIAR THORNS', 0x40916c, '🍂');

    // Zone 2
    this.createWorldIndicator('ind_ravine', 1360, 220, 'RESTORE BROKEN BRIDGES [T/E]', 0xd4af37, '▲');
    this.createWorldIndicator('ind_pendulum', 1560, 150, 'TIME DASH PAST SPIKED LOG', 0xff4444, '⚠');

    // Zone 3
    this.createWorldIndicator('ind_machinery', 2300, 210, 'FREEZE MOVING PLATFORM', 0x00f0ff, '⏳');

    // Zone 4
    this.createWorldIndicator('ind_canopy', 2950, 300, 'AGE FUNGUS TO BOUNCE PAD', 0x52b788, '🍄');
    this.createWorldIndicator('ind_vine1', 3120, 170, 'AGE VINE TO WOVEN BRIDGE', 0x52b788, '🌿');
    this.createWorldIndicator('ind_seed1', 3380, 100, 'SEED POD 01 [CANOPY]', 0xffd166, '🌰');

    // Zone 5
    this.createWorldIndicator('ind_decay', 3750, 260, 'SPRINT! DECAYING BRIDGE COLLAPSES', 0xffaa00, '⚠');
    this.createWorldIndicator('ind_briar2', 3950, 320, 'WITHER BRIARS TO ENTER CRYPT', 0x40916c, '🍂');
    this.createWorldIndicator('ind_seed2', 4180, 180, 'SEED POD 02 [CRYPT]', 0xffd166, '🌰');

    // Zone 6
    this.createWorldIndicator('ind_spores', 4380, 310, 'AGE SPORE VENT TO HUSK', 0x9b5de5, '💨');
    this.createWorldIndicator('ind_fungus2', 4520, 310, 'AGE TO TRAMPOLINE TO CROSS', 0x52b788, '🍄');
    this.createWorldIndicator('ind_seed3', 4660, 190, 'SEED POD 03 [MARSH]', 0xffd166, '🌰');

    // Zone 7
    this.createWorldIndicator('ind_altar', 5040, 280, 'ELDER GROVE ALTAR [PLANT 3 SEEDS]', 0xd4af37, '🌳');
    this.createWorldIndicator('ind_exit', 5320, 260, 'SECTOR 5 EXTRACTION GATE', 0x00f0ff, '🎯');
  }

  private createWorldIndicator(id: string, x: number, y: number, text: string, color: number, icon = '▲'): void {
    const container = this.add.container(x, y).setDepth(22);

    const txt = this.add.text(0, 0, `${icon} ${text}`, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const w = txt.width + 16;
    const h = 18;
    const bg = this.add.graphics();
    bg.fillStyle(0x060d0b, 0.88);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(1.5, color, 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

    container.add([bg, txt]);

    this.tweens.add({
      targets: container,
      y: y - 8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.worldIndicators.push({ id, container });
  }

  private removeWorldIndicator(id: string): void {
    const idx = this.worldIndicators.findIndex(w => w.id === id);
    if (idx !== -1) {
      const item = this.worldIndicators[idx];
      this.worldIndicators.splice(idx, 1);
      this.tweens.add({
        targets: item.container,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        onComplete: () => item.container.destroy()
      });
    }
  }

  private checkZoneDiscovery(): void {
    const px = this.player.x;
    let zoneNum = 1;
    let zoneName = '';

    if (px >= 4750) { zoneNum = 7; zoneName = 'ZONE 7: THE ELDER GROVE FINALE'; }
    else if (px >= 4250) { zoneNum = 6; zoneName = 'ZONE 6: TOXIC SPORE MARSH'; }
    else if (px >= 3600) { zoneNum = 5; zoneName = 'ZONE 5: ROTTING RUINS & DECAY CHASE'; }
    else if (px >= 2800) { zoneNum = 4; zoneName = 'ZONE 4: CANOPY CLIMB & ROOT BRIDGES'; }
    else if (px >= 1860) { zoneNum = 3; zoneName = 'ZONE 3: ANCIENT MACHINERY SHAFT'; }
    else if (px >= 1360) { zoneNum = 2; zoneName = 'ZONE 2: THE GREAT RAVINE & GORGE'; }
    else { zoneNum = 1; zoneName = 'ZONE 1: FOREST PERIMETER & CANOPY'; }

    if (zoneNum > 1 && !this.discoveredZones.has(zoneNum)) {
      this.discoveredZones.add(zoneNum);
      this.hud.showBanner(zoneName);

      if (zoneNum === 2) {
        this.setObjective('RESTORE THE COLLAPSED RAVINE BRIDGES [T/E]');
      } else if (zoneNum === 3) {
        this.setObjective('NAVIGATE ANCIENT MACHINERY & STASIS PLATFORMS');
      } else if (zoneNum === 4 && this.seedPodsCollected < 1) {
        this.setObjective('ASCEND TO CANOPY OVERLOOK & SECURE SEED POD 01');
      } else if (zoneNum === 5 && this.seedPodsCollected < 2) {
        this.setObjective('CROSS DECAYING BRIDGES & SECURE SEED POD 02');
      } else if (zoneNum === 6 && this.seedPodsCollected < 3) {
        this.setObjective('EXHAUST SPORE VENTS & SECURE SEED POD 03');
      } else if (zoneNum === 7 && !this.isElderTreeAwakened) {
        this.setObjective('PLANT 3 SEEDS AT ELDER GROVE ALTAR & REAWAKEN TREE');
      }
    }
  }
}