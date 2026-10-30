import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { StaffController } from '../systems/staff/StaffController';
import { TimeAbility } from '../abilities/TimeAbility';
import { SaveSystem } from '../systems/SaveSystem';
import {
  ITimeStateObject,
  BrokenBridgeSection,
  TimeMovingPlatform,
  FallingBranch,
  ForestPatrolCreature
} from '../systems/time/ITimeStateObject';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { AudioManager } from '../systems/AudioManager';

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
    width: 3200,
    height: 480,
    floorY: 370
  },
  spawn: { x: 80, y: 320 },
  checkpoints: [
    { id: 'cp_canopy', x: 80, y: 320, label: 'FOREST PERIMETER' },
    // y was 280, which is INSIDE the Ravine West Anchor platform (top edge ~269).
    // Respawning embedded in a static body makes the player sink through it.
    { id: 'cp_ravine', x: 1320, y: 235, label: 'THE GREAT RAVINE' },
    { id: 'cp_station', x: 2600, y: 320, label: 'RESEARCH STATION' }
  ],
  puzzle: {
    bridgeA: { x: 1440, y: 280 },
    bridgeB: { x: 1560, y: 280 },
    bridgeC: { x: 1680, y: 280 },
    movingPlatform1: { startX: 680, endX: 880, y: 240 },
    movingPlatform2: { startX: 2300, endX: 2480, y: 260 },
    component4: { x: 2760, y: 280 },
    exitPortal: { x: 3100, y: 310 }
  }
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
  private patrolCreatures: ForestPatrolCreature[] = [];

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

  // Scene-owned state flags. These must NOT depend on Player.isDead, because
  // Player.takeDamage() may already flip isDead before handleDeath() runs.
  private isRespawning = false;
  private isLevelComplete = false;
  private isLeavingScene = false;
  private lastMissingComponentBanner = -Infinity;
  private component4Overlap?: Phaser.Physics.Arcade.Collider;

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
    this.physics.resume();
    this.isPaused = false;
    this.pauseMenu = null;
    this.gameOverScreen = null;
    this.levelStartTime = Date.now();
    this.timeObjects = [];
    this.bridgeSections = [];
    this.movingPlatforms = [];
    this.fallingBranches = [];
    this.patrolCreatures = [];
    this.thornBeds = [];
    this.swingingLogs = [];
    this.conduitCrystals = [];
    this.hasCollectedComponent4 = false;

    // Scene instances are reused by scene.restart()/scene.start(), so every
    // piece of per-run state must be reset here, not only at field declaration.
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

    // Set world bounds extended to 800 to enable natural fall-into-ravine death
    this.physics.world.setBounds(0, 0, LEVEL4_DATA.dimensions.width, 800);

    // 1. Build Ambient Ancient Forest Visuals (Trees, Waterfall, Vines, Gears)
    this.buildForestBackground();

    // 2. Build Terrain & Static Platforms
    this.buildTerrain();

    // 3. Spawn Player
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // 4. Initialize Staff Controller
    this.staffController = new StaffController(this, {
      initialAbilities: ['TIME'],
      defaultSelected: 'TIME',
      interactionRange: 160
    });
    this.player.setStaffController(this.staffController);

    // 5. Build Time-Affected Mechanisms & Puzzle Objects
    this.buildTimeMechanisms();

    // 6. Initialize Time Ability
    this.timeAbility = new TimeAbility(this, this.player, this.timeObjects);
    this.staffController.registerAbilityHandler('TIME', () => this.timeAbility.activate());

    // 7. Build Hazards (Thorns, Falling Branches, Swinging Logs, Golems)
    this.buildHazards();

    // 8. Build Collectibles, Rechargers & Exit Gateway
    this.buildCollectiblesAndExit();

    // 9. Setup Collisions & Overlaps
    this.setupColliders();

    // 10. Setup HUD (3 / 5 components collected so far, recovering 4th here)
    this.hud = new HUD(this, 'SECTOR 4 · ANCIENT FOREST', LEVEL4_DATA.palette.mutedGold);
    this.hud.setFailsafeFound(3, 5);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);
    this.staffController.connectHud(this.hud);

    this.player.on('player_damaged', (hp: number) => {
      this.hud.updateIntegrity(hp);
    });
    this.player.on('player_respawn', () => {
      this.hud.updateIntegrity(this.player.integrity);
      this.hud.updateCharges(this.player.staffCharges);
    });

    // 11. Camera Tracking & Atmospheric Vignette
    this.cameras.main.setBounds(0, 0, LEVEL4_DATA.dimensions.width, LEVEL4_DATA.dimensions.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(500, 10, 28, 20);

    // 12. Connect Home / Pause Button & Keyboard (ESC / P)
    this.hud.onPauseClicked(() => this.togglePause());

    // Informational intro banner
    this.hud.showBanner('SECTOR 4: ANCIENT FOREST — RESTORE THE COLLAPSED BRIDGES WITH [T/E]!');
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

    // Giant ancient redwood trees (monolithic tree trunks)
    const treeGfx = this.add.graphics().setDepth(1);
    const treeCoords = [140, 480, 840, 1260, 1920, 2350, 2780, 3050];
    treeCoords.forEach(tx => {
      // Massive trunk
      treeGfx.fillStyle(LEVEL4_DATA.palette.barkBrown, 0.9);
      treeGfx.fillRect(tx - 35, 0, 70, H);

      // Bark texture ridges & moss patches
      treeGfx.fillStyle(0x3e2723, 0.8);
      treeGfx.fillRect(tx - 25, 0, 12, H);
      treeGfx.fillRect(tx + 10, 0, 10, H);

      treeGfx.fillStyle(LEVEL4_DATA.palette.forestDark, 0.6);
      for (let y = 80; y < H; y += 70) {
        treeGfx.fillCircle(tx + (y % 20) - 10, y, 14);
      }
    });

    // Overgrown stone ruins & ancient brass clockwork gears in background
    const ruinsGfx = this.add.graphics().setDepth(2);
    ruinsGfx.fillStyle(0x283618, 0.7);
    ruinsGfx.fillRoundedRect(320, 180, 140, 190, 8);
    ruinsGfx.fillRoundedRect(1020, 150, 160, 220, 8);
    ruinsGfx.fillRoundedRect(2420, 140, 180, 230, 8);

    // Glowing cyan runes on the ancient stones
    ruinsGfx.lineStyle(2, LEVEL4_DATA.palette.cyanAccent, 0.65);
    ruinsGfx.strokeCircle(390, 220, 14);
    ruinsGfx.lineBetween(390, 200, 390, 240);
    ruinsGfx.strokeCircle(1100, 200, 18);
    ruinsGfx.lineBetween(1085, 200, 1115, 200);

    // Ancient clockwork gears in the tree trunks (temporal machinery)
    const gearGfx = this.add.graphics().setDepth(3);
    const gears = [
      { x: 520, y: 220, r: 38 },
      { x: 1980, y: 190, r: 45 },
      { x: 2380, y: 210, r: 32 }
    ];
    gears.forEach(g => {
      gearGfx.lineStyle(3, LEVEL4_DATA.palette.ancientGold, 0.75);
      gearGfx.strokeCircle(g.x, g.y, g.r);
      gearGfx.fillStyle(LEVEL4_DATA.palette.darkWood, 0.7);
      gearGfx.fillCircle(g.x, g.y, g.r);
      // Teeth
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

    // Floating Glowing Spores / Fireflies
    this.add.particles(0, 0, 'proto_tile', {
      x: { min: 50, max: W - 50 },
      y: { min: 80, max: H - 80 },
      speed: { min: 8, max: 25 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x52b788, 0x00f0ff, 0xd4af37],
      lifespan: 2500,
      quantity: 1,
      frequency: 180
    }).setDepth(5);

    // Hanging Vines
    const vineGfx = this.add.graphics().setDepth(4);
    vineGfx.lineStyle(2, LEVEL4_DATA.palette.forestMid, 0.8);
    for (let vx = 100; vx < W; vx += 120) {
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

    // The Great Ravine Chasm Drop: x: 1360 -> 1760 (No solid floor = bottomless waterfall gorge!)

    // Zone 2 & 3 Ground: x: 1760 -> 3200
    this.createStaticFloor(1760, 3200, floorY, 0x2d6a4f);

    // Ancient Stone Ruin Platforms & Stepped High Ledges (all jump rises 35-50px)
    const ruins = [
      // Zone 1 steps up to Moving Platform 1 (y: 240)
      { x: 260, y: 325, w: 80, h: 18 }, // Step 1 (Δ45 from 370)
      { x: 380, y: 280, w: 85, h: 18 }, // Step 2 (Δ45 from 325)
      { x: 520, y: 240, w: 90, h: 18 }, // Step 3 (Δ40 from 280) -> Leaps to Moving Plat 1
      // Landing ledge after Moving Plat 1
      { x: 1020, y: 270, w: 90, h: 18 }, // Landing platform with Conduit Crystal
      // Approach to the Great Ravine
      { x: 1180, y: 325, w: 80, h: 18 }, // Stepping ledge (Δ45 from 370)
      { x: 1320, y: 280, w: 90, h: 22 }, // Ravine West Anchor (Δ45 from 325, Checkpoint 2!)
      // Across the bridge (Bridge A: 1440, B: 1560, C: 1680)
      { x: 1800, y: 280, w: 90, h: 22 }, // Ravine East Anchor (Landing from Bridge C!)
      { x: 1930, y: 325, w: 80, h: 18 }, // East Exit Step (Smooth descent to ground 370)
      // Zone 3: Ascent to Ancient Machinery & Research Station
      { x: 2100, y: 325, w: 80, h: 18 },
      { x: 2220, y: 280, w: 80, h: 18 },
      { x: 2600, y: 280, w: 90, h: 18 }, // Observation Balcony after Moving Plat 2
      { x: 2760, y: 320, w: 140, h: 22 }  // Research Station Altar with Component 4
    ];

    ruins.forEach(r => {
      const tile = this.add.sprite(r.x, r.y, 'proto_tile')
        .setDisplaySize(r.w, r.h)
        .setTint(LEVEL4_DATA.palette.mossGreen)
        .setDepth(10);
      this.physics.add.existing(tile, true);
      this.ruinsGroup.add(tile);

      // Ancient stone border
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
    // Bridge Section A (Starts Collapsed)
    const bridgeA = new BrokenBridgeSection(this, 'bridge_section_a', pz.bridgeA.x, pz.bridgeA.y, false);
    this.bridgeSections.push(bridgeA);
    this.timeObjects.push(bridgeA);

    // Bridge Section B (Intermediate Taut Anchor)
    const bridgeB = new BrokenBridgeSection(this, 'bridge_section_b', pz.bridgeB.x, pz.bridgeB.y, true);
    this.bridgeSections.push(bridgeB);
    this.timeObjects.push(bridgeB);

    // Bridge Section C (Starts Collapsed)
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

    // 2. Patrolling Ancient Forest Golems (Can be locked in Chrono-Stasis)
    const golems = [
      { x: 680, y: 355, minX: 600, maxX: 790 },
      { x: 2100, y: 355, minX: 1980, maxX: 2220 },
      { x: 2600, y: 355, minX: 2500, maxX: 2700 }
    ];

    golems.forEach((g, idx) => {
      const golem = new ForestPatrolCreature(this, `golem_${idx}`, g.x, g.y, g.minX, g.maxX);
      this.patrolCreatures.push(golem);
      this.timeObjects.push(golem);
    });

    // 3. Briar Thorn Beds on the ground
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

    // 4. Swinging Spiked Log in the Great Ravine (Guards the middle bridge span)
    const log = this.add.sprite(1560, 190, 'proto_hazard')
      .setDisplaySize(38, 22)
      .setTint(0x5c4033)
      .setDepth(12);
    // Dynamic + immovable (not static): a static body does not follow the tween,
    // so the damage hitbox used to stay frozen at y=190 while the log swung.
    this.physics.add.existing(log, false);
    const logBody = log.body as Phaser.Physics.Arcade.Body;
    logBody.setAllowGravity(false);
    logBody.setImmovable(true);
    this.swingingLogs.push(log);

    // Swing pendulum tween
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

    // 1. Staff Energy Conduit Crystals (Restore staff charges)
    const crystalCoords = [
      { x: 1020, y: 235 },
      { x: 1800, y: 245 },
      { x: 2600, y: 245 }
    ];

    crystalCoords.forEach((c, idx) => {
      const crystal = this.add.sprite(c.x, c.y, 'proto_tile')
        .setDisplaySize(16, 16)
        .setTint(0x00f0ff)
        .setDepth(14);
      this.physics.add.existing(crystal, true);
      this.conduitCrystals.push(crystal);

      // Floating bob tween
      this.tweens.add({
        targets: crystal,
        y: c.y - 8,
        yoyo: true,
        repeat: -1,
        duration: 900 + idx * 100,
        ease: 'Sine.easeInOut'
      });
    });

    // 2. Component 04: The Ancient Chrono-Matrix Core (Goal Checkpoint)
    this.component4Sprite = this.physics.add.sprite(pz.component4.x, pz.component4.y, 'failsafe_component')
      .setScale(1.8)
      .setDepth(15);
    const c4Body = this.component4Sprite.body as Phaser.Physics.Arcade.Body;
    c4Body.setAllowGravity(false);
    c4Body.setImmovable(true);
    c4Body.setSize(32, 32);

    this.tweens.add({
      targets: this.component4Sprite,
      scale: 2.2,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Extraction Gateway Portal (Exit to Sector 5)
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

    // Player vs Patrolling Golems
    this.patrolCreatures.forEach(g => {
      this.physics.add.overlap(this.player, g.sprite, () => {
        if (g.currentState === 'PATROLLING') {
          this.handleDamage('ANCIENT GOLEM STRIKE');
        }
      });
    });

    // Player vs Thorns
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

    // Player vs Conduit Crystals
    this.conduitCrystals.forEach(crystal => {
      this.physics.add.overlap(this.player, crystal, () => {
        if (!crystal.active) return;
        crystal.setActive(false).setVisible(false);
        this.player.restoreStaffCharges(2);
        this.hud.updateCharges(this.player.staffCharges);
        AudioManager.playConduitRecharge();
        this.hud.showBanner('ENERGY CONDUIT ABSORBED: +2 STAFF CHARGES!');
      });
    });

    // Player vs Component 04 Collection (collider handle kept so it can be
    // removed before the sprite is destroyed)
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

  private collectComponent4(): void {
    if (!this.component4Sprite || !this.component4Sprite.active || this.hasCollectedComponent4) return;

    this.hasCollectedComponent4 = true;
    AudioManager.playComponent3Collect();

    // Radiant cyan & gold particle burst
    const emitter = this.add.particles(this.component4Sprite.x, this.component4Sprite.y, 'proto_tile', {
      speed: { min: 80, max: 220 },
      scale: { start: 0.6, end: 0 },
      tint: [0x00f0ff, 0xd4af37, 0x52b788, 0xffffff],
      lifespan: 800,
      quantity: 26
    });
    this.time.delayedCall(850, () => emitter.destroy());

    // Remove the overlap collider first so Arcade never processes a destroyed sprite
    this.component4Overlap?.destroy();
    this.component4Overlap = undefined;
    this.component4Sprite.destroy();
    this.component4Sprite = undefined;

    // Checkpoint
    this.checkpointX = LEVEL4_DATA.checkpoints[2].x;
    this.checkpointY = LEVEL4_DATA.checkpoints[2].y;

    // Refresh HUD
    this.hud.setFailsafeFound(4, 5);
    this.player.restoreStaffCharges(3);
    this.hud.updateCharges(this.player.staffCharges);

    this.cameras.main.flash(350, 0, 240, 255);
    this.hud.showBanner('COMPONENT 04 (CHRONO-MATRIX) SECURED! ESCAPE TO SECTOR 5 GATEWAY!');
  }

  private handleDamage(reason: string): void {
    // Gate on scene-owned flags only. Player.isDead can already be true here.
    if (this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    if (this.player.isDead) return;

    const lethal = this.player.takeDamage();
    this.hud.updateIntegrity(this.player.integrity);
    this.cameras.main.shake(180, 0.015);
    this.cameras.main.flash(100, 255, 60, 60);

    // `|| this.player.isDead` is the key line: if takeDamage() set isDead on the
    // lethal hit, the old code skipped handleDeath() and never scheduled a respawn.
    if (lethal || this.player.integrity <= 0 || this.player.isDead) {
      this.handleDeath(reason);
    } else {
      AudioManager.playDeath();
    }
  }

  private handleDeath(reason = 'CHRONO DE-SYNCHRONIZATION'): void {
    // Guard on OUR flag, never on player.isDead (see handleDamage).
    if (this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    this.isRespawning = true;

    // die() is called unconditionally; if Player.die() has its own isDead guard it simply no-ops.
    this.player.die();
    this.hud.updateIntegrity(0);
    this.deathCount++;
    AudioManager.playDeath();

    this.cameras.main.shake(250, 0.018);
    this.hud.showBanner(`CRITICAL ANOMALY: ${reason}`);

    // Show cinematic Game Over Screen using official artwork
    this.time.delayedCall(700, () => {
      if (this.isLevelComplete || this.isLeavingScene) return;
      this.physics.pause();

      const callbacks: GameOverCallbacks = {
        onRespawn: () => {
          this.gameOverScreen?.destroy();
          this.gameOverScreen = null;
          this.physics.resume();
          this.player.respawnAt(this.checkpointX, this.checkpointY);
          this.player.restoreStaffCharges(3);
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
    // The overlap fires every frame while the player stands in the portal, so
    // everything below must be one-shot.
    if (this.isLevelComplete || this.isLeavingScene || this.isRespawning) return;

    if (!this.hasCollectedComponent4) {
      // Throttled: previously this spawned a new banner every frame.
      const now = this.time.now;
      if (now - this.lastMissingComponentBanner > 2000) {
        this.lastMissingComponentBanner = now;
        this.hud.showBanner('CANNOT ESCAPE — COMPONENT 04 (CHRONO-MATRIX) MUST BE SECURED FIRST!');
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

    // Camera effect callbacks run EVERY frame of the fade. Listen for the
    // completion event instead so scene.start() runs exactly once.
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('LevelComplete', {
        failsafeCollected: 4,
        totalFailsafe: 5,
        deathCount: this.deathCount,
        timeMs: Date.now() - this.levelStartTime,
        sectorNumber: 4,
        alertCount: 0
      });
    });
    this.cameras.main.fadeOut(800, 10, 28, 20);
  }

  // ── Pause Management ──────────────────────────────────────────────────────

  public togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  public pauseGame(): void {
    // Blocked only by scene-owned flags. Blocking on player.isDead made a stuck
    // "dead" state unrecoverable because the pause/restart menu could never open.
    if (this.isPaused || this.isRespawning || this.isLevelComplete || this.isLeavingScene) return;
    this.isPaused = true;
    this.physics.pause();

    const callbacks: PauseMenuCallbacks = {
      onResume: () => this.resumeGame(),
      onRestart: () => {
        if (this.isLeavingScene) return;
        this.isLeavingScene = true;
        this.pauseMenu?.destroy();
        this.pauseMenu = null;
        this.isPaused = false;
        this.physics.resume();
        this.scene.restart();
      },
      onMainMenu: () => {
        if (this.isLeavingScene) return;
        this.isLeavingScene = true;
        this.pauseMenu?.destroy();
        this.pauseMenu = null;
        this.isPaused = false;
        this.physics.resume();
        // Camera effect callbacks run every frame, which skipped the fade and
        // called scene.start() repeatedly. Wait for the completion event instead.
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

    // Safety net: if the player is dead but no respawn is pending (for example
    // a path that set isDead without going through handleDeath), start one now
    // instead of returning forever with a frozen screen.
    if (this.player.isDead) {
      if (!this.isRespawning) this.handleDeath('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    this.player.update(time, delta);
    this.timeAbility.update(time, delta);
    this.staffController.update(delta, this.player.x, this.player.y);

    // Trigger falling branches when Vance runs beneath
    for (const b of this.fallingBranches) {
      b.checkTrigger(this.player.x);
    }

    // Void fall check (The Great Ravine)
    if (this.player.y > LEVEL4_DATA.dimensions.floorY + 45 && !this.player.isDead) {
      this.handleDeath('PLUNGED INTO THE WATERFALL GORGE');
    }

    // Proximity fallback for collecting Component 4
    if (this.component4Sprite && !this.hasCollectedComponent4 && !this.player.isDead) {
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

    // Checkpoint activation checks
    if (this.player.x >= LEVEL4_DATA.checkpoints[1].x && this.checkpointX < LEVEL4_DATA.checkpoints[1].x) {
      this.checkpointX = LEVEL4_DATA.checkpoints[1].x;
      this.checkpointY = LEVEL4_DATA.checkpoints[1].y;
      AudioManager.playCheckpoint();
      this.hud.showBanner('CHECKPOINT REACHED: THE GREAT RAVINE');
    }
  }
}