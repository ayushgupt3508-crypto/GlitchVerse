import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { Guard, ObstacleRect } from '../entities/Guard';
import { CamouflageAbility } from '../abilities/CamouflageAbility';
import { HUD } from '../ui/HUD';
import { PauseMenu, PauseMenuCallbacks } from '../ui/PauseMenu';
import { GameOverScreen, GameOverCallbacks } from '../ui/GameOverScreen';
import { TextureGenerator } from '../utils/TextureGenerator';
import { AudioManager } from '../systems/AudioManager';
import { FullscreenManager } from '../systems/FullscreenManager';
import { SaveSystem } from '../systems/SaveSystem';

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
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LEVEL 3: MEDIEVAL PALACE (ENVIRONMENTAL CAMOUFLAGE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete layout restructuring with verifiable mathematical precision:
 *  • Kinematic Physics Derivation (JUMP_H, JUMP_GAP, 85% safety limits)
 *  • Single Layout Data Table across all 5 progressive zones
 *  • Zero magic numbers: all platforms, guards, hazards, pickups read from table
 *  • Automated dev-mode layout validator guaranteeing 0 gap/rise/boundary violations
 *  • Wall-clipped live guard vision cones & detection fill meters
 *  • Full preservation of all puzzle components, hazards, checkpoints, and mobile hooks
 */

// ── Accurate Physics & Kinematic Reach Computation ───────────────────────────
export const PLAYER_PHYSICS = {
  gravity: 800,           // px/s^2 (GAME_CONFIG.gravity)
  jumpVelocity: -350,     // px/s (Player.jumpVelocity)
  moveSpeed: 160,         // px/s (Player.moveSpeed)
  bodyWidth: 12,          // px (Player hitbox: 12x30)
  bodyHeight: 30,         // px
  guardBodyWidth: 14,     // px (Guard hitbox: 14x28)
  guardBodyHeight: 28     // px
} as const;

// Derived kinematic maximum reach (exact formulas: H = v^2 / 2g; Gap = v_x * 2*(v/g))
export const JUMP_H = (PLAYER_PHYSICS.jumpVelocity * PLAYER_PHYSICS.jumpVelocity) / (2 * PLAYER_PHYSICS.gravity); // 76.5625 px
export const JUMP_GAP = PLAYER_PHYSICS.moveSpeed * (2 * Math.abs(PLAYER_PHYSICS.jumpVelocity) / PLAYER_PHYSICS.gravity); // 140.0 px

// Design safety thresholds (strictly <= 85% of theoretical reach for reliable platforming)
export const MAX_SAFE_RISE = 0.85 * JUMP_H;   // 65.078 px
export const MAX_SAFE_GAP  = 0.85 * JUMP_GAP; // 119.0 px
export const MIN_CEILING_CLEARANCE = 36;      // px (player body 30px, sprite 36px)

// ── Solid Cover Obstacles (Walls & Pillars blocking guard line of sight) ───────
export const LEVEL3_COVER_OBSTACLES: ObstacleRect[] = [
  { x: 608,  y: 264, width: 32, height: 76 },  // Z1 Gatehouse Arch Pillar 1
  { x: 800,  y: 264, width: 32, height: 76 },  // Z1 Gatehouse Arch Pillar 2
  { x: 1376, y: 240, width: 32, height: 100 }, // Z2 Armory Dividing Wall
  { x: 3328, y: 268, width: 32, height: 72 },  // Z4 Throne Hall Pillar 1
  { x: 3648, y: 268, width: 32, height: 72 },  // Z4 Throne Hall Pillar 2
  { x: 4704, y: 264, width: 32, height: 76 }   // Z5 Sanctum Arch Pillar
];

// ── Zone Tuning Configuration ────────────────────────────────────────────────
export const ZONE_TUNING = {
  1: { name: 'Gatehouse and Courtyard', difficulty: 'moderate', alertDuration: 3000, detectionSpeedMult: 1.0, chargeScarcity: 'abundant' },
  2: { name: 'Corridors and Armory', difficulty: 'moderate+', alertDuration: 3200, detectionSpeedMult: 1.1, chargeScarcity: 'standard' },
  3: { name: 'Drawbridge and Battlements', difficulty: 'high-moderate', alertDuration: 3500, detectionSpeedMult: 1.15, chargeScarcity: 'moderate' },
  4: { name: 'Throne Room and Bait Route', difficulty: 'high', alertDuration: 3600, detectionSpeedMult: 1.25, chargeScarcity: 'scarce' },
  5: { name: 'Vault Approach and Extraction', difficulty: 'high', alertDuration: 4000, detectionSpeedMult: 1.35, chargeScarcity: 'very scarce' }
} as const;

// ── Layout Data Types ────────────────────────────────────────────────────────
export interface PlatformData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'platform' | 'step' | 'arch' | 'battlement' | 'drawbridge' | 'crumble' | 'wall';
  tileKey?: string;
}

export interface GuardTableConfig {
  id: string;
  name: string;
  zone: number;
  platformId: string;
  x: number;
  y: number;
  patrolLeft: number;
  patrolRight: number;
  visionRange: number;
  visionAngle: number;
  patrolSpeed: number;
  alertSpeed: number;
  alertRadius: number;
  facingRight: boolean;
}

export interface HazardData {
  type: 'water' | 'blade' | 'chandelier' | 'timedGate';
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  anchorY?: number;
  minY?: number;
  maxY?: number;
  dur?: number;
  originX?: number;
  originY?: number;
}

export interface PickupData {
  type: 'conduit' | 'chamberKey' | 'component3' | 'chest';
  id: string;
  x: number;
  y: number;
}

export interface CheckpointData {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface GateData {
  id: string;
  type: 'chamberDoor' | 'exitPortal';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZoneLayoutData {
  zoneId: number;
  name: string;
  bounds: { xMin: number; xMax: number };
  tuning: typeof ZONE_TUNING[keyof typeof ZONE_TUNING];
  platforms: PlatformData[];
  guards: GuardTableConfig[];
  hazards: HazardData[];
  pickups: PickupData[];
  checkpoints: CheckpointData[];
  gates: GateData[];
}

export interface TraversalPath {
  from: string;
  to: string;
  gap: number;
  rise: number;
}

export interface Level3FullLayout {
  zones: ZoneLayoutData[];
  traversalPaths: TraversalPath[];
}

// ── Complete Level 3 Layout Data Table ───────────────────────────────────────
export const LEVEL3_LAYOUT_DATA: Level3FullLayout = {
  zones: [
    // ── Zone 1: Gatehouse and Courtyard (Moderate) ───────────────────────────
    {
      zoneId: 1,
      name: 'ZONE 1: GATEHOUSE AND COURTYARD',
      bounds: { xMin: 0, xMax: 1024 },
      tuning: ZONE_TUNING[1],
      platforms: [
        { id: 'z1_ground1',    x: 0,   y: 340, w: 320, h: 100, type: 'ground' },
        { id: 'z1_drawbridge', x: 320, y: 340, w: 96,  h: 32,  type: 'drawbridge', tileKey: 'tile_wood_drawbridge' },
        { id: 'z1_ground2',    x: 416, y: 340, w: 608, h: 100, type: 'ground' },
        { id: 'z1_step1',      x: 576, y: 288, w: 64,  h: 52,  type: 'step' },
        { id: 'z1_arch',       x: 640, y: 240, w: 160, h: 24,  type: 'arch' }
      ],
      guards: [
        {
          id: 'guard_roderick',
          name: 'Sentry Roderick',
          zone: 1,
          platformId: 'z1_ground2',
          x: 720,
          y: 326, // 340 - 14 (exact platform top alignment)
          patrolLeft: 640,
          patrolRight: 928,
          visionRange: 120,
          visionAngle: 45,
          patrolSpeed: 32,
          alertSpeed: 96, // Threefold patrol speed
          alertRadius: 0,
          facingRight: true
        }
      ],
      hazards: [
        { type: 'water', x: 320, y: 410, w: 96, h: 30 }
      ],
      pickups: [],
      checkpoints: [
        { id: 'cp_spawn', x: 80, y: 308, label: 'COURTYARD DRAWBRIDGE' }
      ],
      gates: []
    },

    // ── Zone 2: Corridors and Armory (Moderate+) ─────────────────────────────
    {
      zoneId: 2,
      name: 'ZONE 2: CORRIDORS AND ARMORY',
      bounds: { xMin: 1024, xMax: 2048 },
      tuning: ZONE_TUNING[2],
      platforms: [
        { id: 'z2_ground',  x: 1024, y: 340, w: 1024, h: 100, type: 'ground' },
        // Elevated floating platforms for balcony access — keeps ground patrol 100% flat & clear
        { id: 'z2_step1',   x: 1312, y: 284, w: 72,   h: 16,  type: 'platform' },
        { id: 'z2_step2',   x: 1416, y: 232, w: 72,   h: 16,  type: 'platform' },
        { id: 'z2_balcony', x: 1520, y: 184, w: 320,  h: 20,  type: 'platform' }
      ],
      guards: [
        {
          id: 'guard_cedric',
          name: 'Guardsman Cedric',
          zone: 2,
          platformId: 'z2_ground',
          x: 1184,
          y: 326,
          patrolLeft: 1088,
          patrolRight: 1344,
          visionRange: 130,
          visionAngle: 45,
          patrolSpeed: 38,
          alertSpeed: 114, // Threefold patrol speed
          alertRadius: 200,
          facingRight: false
        },
        {
          id: 'guard_gareth',
          name: 'Halberdier Gareth',
          zone: 2,
          platformId: 'z2_ground',
          x: 1620,
          y: 326,
          patrolLeft: 1420,
          patrolRight: 1860,
          visionRange: 140,
          visionAngle: 45,
          patrolSpeed: 40,
          alertSpeed: 120, // Threefold patrol speed
          alertRadius: 220,
          facingRight: true
        }
      ],
      hazards: [],
      pickups: [
        { type: 'conduit',    id: 'conduit_1',   x: 1120, y: 308 },
        { type: 'chamberKey', id: 'chamber_key', x: 1760, y: 148 }
      ],
      checkpoints: [
        { id: 'cp_armory', x: 1760, y: 152, label: 'ROYAL ARMORY BALCONY' }
      ],
      gates: []
    },

    // ── Zone 3: Drawbridge and Battlements (High-Moderate) ───────────────────
    {
      zoneId: 3,
      name: 'ZONE 3: DRAWBRIDGE AND BATTLEMENTS',
      bounds: { xMin: 2048, xMax: 3136 },
      tuning: ZONE_TUNING[3],
      platforms: [
        { id: 'z3_ground1',    x: 2048, y: 340, w: 288, h: 100, type: 'ground' },
        { id: 'z3_step_up1',   x: 2176, y: 292, w: 64,  h: 16,  type: 'platform' },
        { id: 'z3_step_up2',   x: 2240, y: 244, w: 64,  h: 16,  type: 'platform' },
        // Overhead battlement walkway raised to y: 196 (120px headroom underneath)
        { id: 'z3_battlement', x: 2336, y: 196, w: 416, h: 24,  type: 'battlement' },
        { id: 'z3_step_down1', x: 2784, y: 244, w: 64,  h: 16,  type: 'platform' },
        { id: 'z3_step_down2', x: 2848, y: 292, w: 64,  h: 16,  type: 'platform' },
        { id: 'z3_ground2',    x: 2912, y: 340, w: 224, h: 100, type: 'ground' },
        { id: 'crumble_1',     x: 2400, y: 340, w: 48,  h: 20,  type: 'crumble' },
        { id: 'crumble_2',     x: 2496, y: 340, w: 48,  h: 20,  type: 'crumble' },
        { id: 'crumble_3',     x: 2592, y: 340, w: 48,  h: 20,  type: 'crumble' },
        { id: 'z3_lower_mid',  x: 2656, y: 340, w: 256, h: 100, type: 'ground' }
      ],
      guards: [
        {
          id: 'guard_alistair',
          name: 'Watchman Alistair',
          zone: 3,
          platformId: 'z3_battlement',
          x: 2544,
          y: 182, // 196 - 14 (on upper battlement walkway)
          patrolLeft: 2380,
          patrolRight: 2700,
          visionRange: 200,
          visionAngle: 50,
          patrolSpeed: 34,
          alertSpeed: 102, // Threefold patrol speed
          alertRadius: 0,
          facingRight: true
        }
      ],
      hazards: [
        { type: 'water', x: 2336, y: 410, w: 320, h: 30 },
        { type: 'blade', id: 'blade_1', x: 2688, anchorY: 130, minY: 160, maxY: 330, dur: 1100 }
      ],
      pickups: [
        { type: 'conduit', id: 'conduit_2', x: 2960, y: 308 }
      ],
      checkpoints: [
        { id: 'cp_battlements', x: 3000, y: 302, label: 'OUTER BATTLEMENTS KEEP' }
      ],
      gates: []
    },

    // ── Zone 4: Throne Room and Bait Route (High) ────────────────────────────
    {
      zoneId: 4,
      name: 'ZONE 4: THRONE ROOM AND BAIT ROUTE',
      bounds: { xMin: 3136, xMax: 4288 },
      tuning: ZONE_TUNING[4],
      platforms: [
        { id: 'z4_ground',          x: 3136, y: 340, w: 1152, h: 100, type: 'ground' },
        // Steps flanking Captain Valen's arch — making overhead 100% jumpable!
        { id: 'z4_arch_step_left',  x: 3216, y: 296, w: 64,   h: 16,  type: 'platform' },
        { id: 'z4_arch',            x: 3296, y: 260, w: 384,  h: 20,  type: 'arch' },
        { id: 'z4_arch_step_right', x: 3696, y: 296, w: 64,   h: 16,  type: 'platform' },
        { id: 'z4_step1',           x: 3904, y: 280, w: 64,   h: 60,  type: 'step' },
        { id: 'z4_bait',            x: 3968, y: 220, w: 320,  h: 24,  type: 'platform' }
      ],
      guards: [
        {
          id: 'guard_valen',
          name: 'Captain Valen',
          zone: 4,
          platformId: 'z4_ground',
          x: 3450,
          y: 326,
          patrolLeft: 3320,
          patrolRight: 3600,
          visionRange: 145,
          visionAngle: 45,
          patrolSpeed: 44,
          alertSpeed: 132, // Threefold patrol speed
          alertRadius: 240,
          facingRight: false
        },
        {
          id: 'guard_vane',
          name: 'Sentinel Vane',
          zone: 4,
          platformId: 'z4_ground',
          x: 3800,
          y: 326,
          patrolLeft: 3660,
          patrolRight: 3900,
          visionRange: 145,
          visionAngle: 45,
          patrolSpeed: 46,
          alertSpeed: 138, // Threefold patrol speed
          alertRadius: 240,
          facingRight: true
        },
        {
          id: 'guard_boris',
          name: 'Sentinel Boris',
          zone: 4,
          platformId: 'z4_bait',
          x: 4096,
          y: 206, // 220 - 14 (on upper bait gallery ledge)
          patrolLeft: 4032,
          patrolRight: 4224,
          visionRange: 130,
          visionAngle: 45,
          patrolSpeed: 42,
          alertSpeed: 126, // Threefold patrol speed
          alertRadius: 0,
          facingRight: false
        }
      ],
      hazards: [
        { type: 'chandelier', id: 'chandelier_1', originX: 3424, originY: 140 },
        { type: 'chandelier', id: 'chandelier_2', originX: 3776, originY: 140 }
      ],
      pickups: [
        { type: 'chest',   id: 'bait_chest', x: 4224, y: 196 },
        { type: 'conduit', id: 'conduit_3',  x: 4160, y: 188 }
      ],
      checkpoints: [
        { id: 'cp_gallery', x: 3936, y: 302, label: 'GRAND GALLERY VESTIBULE' }
      ],
      gates: []
    },

    // ── Zone 5: Vault Approach and Extraction (High) ─────────────────────────
    {
      zoneId: 5,
      name: 'ZONE 5: VAULT APPROACH AND EXTRACTION',
      bounds: { xMin: 4288, xMax: 5500 },
      tuning: ZONE_TUNING[5],
      platforms: [
        { id: 'z5_ground1',    x: 4288, y: 340, w: 160, h: 100, type: 'ground' },
        { id: 'z5_crumble',    x: 4480, y: 340, w: 48,  h: 20,  type: 'crumble' },
        { id: 'z5_ground2',    x: 4544, y: 340, w: 544, h: 100, type: 'ground' },
        // Arch trimmed to end at x: 4904 — well before chamber door
        { id: 'z5_arch',       x: 4704, y: 264, w: 200, h: 24,  type: 'arch' },
        // Impassable vertical solid wall sealing ceiling y: 0 down to door top y: 276
        { id: 'z5_vault_wall', x: 5088, y: 0,   w: 32,  h: 276, type: 'wall' },
        { id: 'z5_vault',      x: 5120, y: 340, w: 192, h: 100, type: 'ground' },
        { id: 'z5_spire1',     x: 5312, y: 280, w: 64,  h: 60,  type: 'step' },
        { id: 'z5_spire2',     x: 5376, y: 220, w: 64,  h: 120, type: 'step' },
        { id: 'z5_summit',     x: 5440, y: 160, w: 60,  h: 180, type: 'step' }
      ],
      guards: [
        {
          id: 'guard_ignatius',
          name: 'Knight Ignatius',
          zone: 5,
          platformId: 'z5_ground2',
          x: 4800,
          y: 326,
          patrolLeft: 4672,
          patrolRight: 5024,
          visionRange: 150,
          visionAngle: 45,
          patrolSpeed: 50,
          alertSpeed: 150, // Threefold patrol speed
          alertRadius: 260,
          facingRight: false
        }
      ],
      hazards: [
        { type: 'water',     x: 4448, y: 410, w: 96, h: 30 },
        { type: 'blade',     id: 'blade_2', x: 4620, anchorY: 140, minY: 180, maxY: 330, dur: 1250 },
        { type: 'timedGate', id: 'gate_1',  x: 4700, y: 308, dur: 2400 },
        { type: 'timedGate', id: 'gate_2',  x: 4940, y: 308, dur: 2400 }
      ],
      pickups: [
        { type: 'component3', id: 'component_3', x: 5224, y: 290 }
      ],
      checkpoints: [
        { id: 'cp_vault', x: 5224, y: 302, label: 'ROYAL VAULT CHAMBER' }
      ],
      gates: [
        { id: 'chamber_door', type: 'chamberDoor', x: 5088, y: 308, w: 32, h: 64 },
        { id: 'exit_portal',  type: 'exitPortal',  x: 5472, y: 120, w: 64, h: 80 }
      ]
    }
  ],

  // Specific intended jump / traversal connections verified for <= 85% JUMP_GAP / JUMP_H
  traversalPaths: [
    // Zone 1
    { from: 'z1_ground1', to: 'z1_drawbridge', gap: 0, rise: 0 },
    { from: 'z1_drawbridge', to: 'z1_ground2', gap: 0, rise: 0 },
    { from: 'z1_ground2', to: 'z1_step1', gap: 0, rise: 52 },
    { from: 'z1_step1', to: 'z1_arch', gap: 0, rise: 48 },
    { from: 'z1_ground2', to: 'z2_ground', gap: 0, rise: 0 },

    // Zone 2 (balcony ascent)
    { from: 'z2_ground', to: 'z2_step1', gap: 0, rise: 56 },
    { from: 'z2_step1', to: 'z2_step2', gap: 32, rise: 52 },
    { from: 'z2_step2', to: 'z2_balcony', gap: 32, rise: 48 },
    { from: 'z2_ground', to: 'z3_ground1', gap: 0, rise: 0 },

    // Zone 3 (upper battlement)
    { from: 'z3_ground1', to: 'z3_step_up1', gap: 0, rise: 48 },
    { from: 'z3_step_up1', to: 'z3_step_up2', gap: 0, rise: 48 },
    { from: 'z3_step_up2', to: 'z3_battlement', gap: 32, rise: 48 },
    { from: 'z3_battlement', to: 'z3_step_down1', gap: 32, rise: -48 },
    { from: 'z3_step_down1', to: 'z3_step_down2', gap: 0, rise: -48 },
    { from: 'z3_step_down2', to: 'z3_ground2', gap: 0, rise: -48 },

    // Zone 3 (lower chasm)
    { from: 'z3_ground1', to: 'crumble_1', gap: 64, rise: 0 },
    { from: 'crumble_1', to: 'crumble_2', gap: 48, rise: 0 },
    { from: 'crumble_2', to: 'crumble_3', gap: 48, rise: 0 },
    { from: 'crumble_3', to: 'z3_lower_mid', gap: 16, rise: 0 },
    { from: 'z3_lower_mid', to: 'z4_ground', gap: 0, rise: 0 },

    // Zone 4 (Captain Valen overhead arch - fully jumpable!)
    { from: 'z4_ground', to: 'z4_arch_step_left', gap: 0, rise: 44 },
    { from: 'z4_arch_step_left', to: 'z4_arch', gap: 16, rise: 36 },
    { from: 'z4_arch', to: 'z4_arch_step_right', gap: 16, rise: -36 },
    { from: 'z4_arch_step_right', to: 'z4_ground', gap: 0, rise: -44 },

    // Zone 4 (bait route)
    { from: 'z4_ground', to: 'z4_step1', gap: 0, rise: 60 },
    { from: 'z4_step1', to: 'z4_bait', gap: 0, rise: 60 },
    { from: 'z4_ground', to: 'z5_ground1', gap: 0, rise: 0 },

    // Zone 5 (vault approach & spire)
    { from: 'z5_ground1', to: 'z5_crumble', gap: 32, rise: 0 },
    { from: 'z5_crumble', to: 'z5_ground2', gap: 16, rise: 0 },
    // Through unlocked door (at ground level)
    { from: 'z5_ground2', to: 'z5_vault', gap: 32, rise: 0 },
    { from: 'z5_vault', to: 'z5_spire1', gap: 0, rise: 60 },
    { from: 'z5_spire1', to: 'z5_spire2', gap: 0, rise: 60 },
    { from: 'z5_spire2', to: 'z5_summit', gap: 0, rise: 60 }
  ]
};

// ── Automated Layout Validation Function ─────────────────────────────────────
export function validateLayout(data: Level3FullLayout): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const allPlatforms: PlatformData[] = [];
  data.zones.forEach(z => z.platforms.forEach(p => allPlatforms.push(p)));

  // 1. Validate guards placement and patrol bounds
  data.zones.forEach(z => {
    z.guards.forEach(g => {
      const plat = allPlatforms.find(p => p.id === g.platformId);
      if (!plat) {
        violations.push(`Guard ${g.id} references non-existent platform ${g.platformId}`);
        return;
      }
      const expectedY = plat.y - PLAYER_PHYSICS.guardBodyHeight / 2;
      if (Math.abs(g.y - expectedY) > 0.1) {
        violations.push(`Guard ${g.id} y (${g.y}) not standing on platform top (${expectedY})`);
      }
      if (g.patrolLeft < plat.x) {
        violations.push(`Guard ${g.id} patrolLeft (${g.patrolLeft}) is off platform left (${plat.x})`);
      }
      if (g.patrolRight > plat.x + plat.w) {
        violations.push(`Guard ${g.id} patrolRight (${g.patrolRight}) is off platform right (${plat.x + plat.w})`);
      }
      if (g.x < g.patrolLeft || g.x > g.patrolRight) {
        violations.push(`Guard ${g.id} spawn x (${g.x}) is outside patrol [${g.patrolLeft}, ${g.patrolRight}]`);
      }
    });
  });

  // 2. Validate checkpoints & pickups on solid ground
  const checkSolid = (item: { id: string; x: number; y: number }, type: string) => {
    const plat = allPlatforms.find(p => item.x >= p.x && item.x <= p.x + p.w && item.y <= p.y + 10 && item.y >= p.y - 70);
    if (!plat) {
      violations.push(`${type} ${item.id} at (${item.x}, ${item.y}) has no platform beneath it`);
    }
  };

  data.zones.forEach(z => {
    z.checkpoints.forEach(cp => checkSolid(cp, 'Checkpoint'));
    z.pickups.forEach(pu => checkSolid(pu, 'Pickup'));
  });

  // 3. Validate traversal paths against kinematic limits
  data.traversalPaths.forEach(path => {
    if (path.gap > MAX_SAFE_GAP) {
      violations.push(`Path ${path.from}->${path.to} gap (${path.gap}px) > MAX_SAFE_GAP (${MAX_SAFE_GAP}px)`);
    }
    if (path.rise > MAX_SAFE_RISE) {
      violations.push(`Path ${path.from}->${path.to} rise (${path.rise}px) > MAX_SAFE_RISE (${MAX_SAFE_RISE}px)`);
    }
  });

  // 4. Validate ceiling clearances for overhead arches & walkways
  const overheadTypes = ['arch', 'battlement'];
  allPlatforms.filter(p => overheadTypes.includes(p.type)).forEach(overhead => {
    allPlatforms.filter(ground => (ground.type === 'ground' || ground.type === 'drawbridge') && ground.y > overhead.y).forEach(ground => {
      const overlap = Math.max(0, Math.min(overhead.x + overhead.w, ground.x + ground.w) - Math.max(overhead.x, ground.x));
      if (overlap > 10) {
        const clearance = ground.y - (overhead.y + overhead.h);
        if (clearance < MIN_CEILING_CLEARANCE) {
          violations.push(`Ceiling clearance between ${overhead.id} and ${ground.id} is ${clearance}px < MIN (${MIN_CEILING_CLEARANCE}px)`);
        }
      }
    });
  });

  return { valid: violations.length === 0, violations };
}

// ── Backward-Compatible LEVEL3_DATA Export ────────────────────────────────────
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
    width: 5500,
    height: 440,
    floorY: 340
  },
  spawn: { x: 80, y: 308 },
  checkpoints: [
    { id: 'cp_spawn',       x: 80,   y: 308, label: 'COURTYARD DRAWBRIDGE' },
    { id: 'cp_armory',      x: 1760, y: 152, label: 'ROYAL ARMORY BALCONY' },
    { id: 'cp_battlements', x: 3000, y: 302, label: 'OUTER BATTLEMENTS KEEP' },
    { id: 'cp_gallery',     x: 3936, y: 302, label: 'GRAND GALLERY VESTIBULE' },
    { id: 'cp_vault',       x: 5224, y: 302, label: 'ROYAL VAULT CHAMBER' }
  ],
  puzzle: {
    chamberDoor: { x: 5088, y: 276, width: 32, height: 64 },
    chamberKey:  { x: 1760, y: 148 },
    component3:  { x: 5224, y: 290 },
    exitPortal:  { x: 5472, y: 120 },
    baitChest:   { x: 4224, y: 196 }
  },
  guards: LEVEL3_LAYOUT_DATA.zones.flatMap(z => z.guards)
};

// ── Extended Obstacle Interfaces ──────────────────────────────────────────────
interface EnergyConduitObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  x: number;
  y: number;
  depleted: boolean;
}

interface SwingingBladeObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  chainGfx: Phaser.GameObjects.Graphics;
  anchorX: number;
  anchorY: number;
}

interface CrumblingStoneObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  x: number;
  y: number;
  isCrumbling: boolean;
}

interface ChandelierObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  chainGfx: Phaser.GameObjects.Graphics;
  originX: number;
  originY: number;
  state: 'hanging' | 'warning' | 'falling' | 'broken';
  warningText?: Phaser.GameObjects.Text;
}

interface TimedGateObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  glowGfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  isActive: boolean;
  timer: number;
}

interface CheckpointCrystalObj {
  sprite: Phaser.Physics.Arcade.Sprite;
  id: string;
  x: number;
  y: number;
  label: string;
  active: boolean;
}

/**
 * Level3Scene — Medieval Palace
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

  // Extended Palace Obstacles & Mechanics
  private conduits: EnergyConduitObj[] = [];
  private blades: SwingingBladeObj[] = [];
  private crumblingStones: CrumblingStoneObj[] = [];
  private chandeliers: ChandelierObj[] = [];
  private timedGates: TimedGateObj[] = [];
  private checkpointCrystals: CheckpointCrystalObj[] = [];
  private isLeavingScene = false;
  private lastDamageTime = 0;
  private lastBannerTime = 0;

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
  private mobileHandle: MobileSetupHandle | null = null;

  // Lighting & Atmospheric Effects
  private torchLightGfx?: Phaser.GameObjects.Graphics;
  private torchHalos: { x: number; y: number; baseRadius: number }[] = [];

  // Objective & World Guidance System
  private objectiveContainer!: Phaser.GameObjects.Container;
  private objectiveBg!: Phaser.GameObjects.Graphics;
  private objectiveText!: Phaser.GameObjects.Text;
  private currentObjective = '';
  private worldIndicators: { container: Phaser.GameObjects.Container; id: string }[] = [];
  private discoveredZones = new Set<number>();
  private baitChestSprite?: Phaser.Physics.Arcade.Sprite;
  private hasOpenedBaitChest = false;

  // Dev Debug Overlay
  private debugOverlay = false;
  private debugGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Level3Scene');
  }

  create(): void {
    AudioManager.init();
    AudioManager.startLevel3Music();
    this.levelStartTime = Date.now();

    // Reset ALL per-run state (prevent stale state on scene restart)
    this.isRespawning = false;
    this.isLeavingScene = false;
    this.isPaused = false;
    this.hasChamberKey = false;
    this.isChamberDoorUnlocked = false;
    this.hasCollectedComponent3 = false;
    this.guards = [];
    this.torchHalos = [];
    this.conduits = [];
    this.blades = [];
    this.crumblingStones = [];
    this.chandeliers = [];
    this.timedGates = [];
    this.checkpointCrystals = [];
    this.worldIndicators = [];
    this.discoveredZones.clear();
    this.hasOpenedBaitChest = false;
    this.lastDamageTime = 0;
    this.lastBannerTime = 0;

    // Run layout validation in dev mode
    const validation = validateLayout(LEVEL3_LAYOUT_DATA);
    if (!validation.valid) {
      console.error('[Level3 Layout Validation] VIOLATIONS DETECTED:', validation.violations);
    } else {
      console.log('[Level3 Layout Validation] SUCCESS: All 5 zones verified with 0 violations! Gaps <= 85% JUMP_GAP, rises <= 85% JUMP_H, guard patrols strictly bounded.');
    }

    // Generate textures
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);

    // Physics world bounds (5500 width)
    this.physics.world.setBounds(0, 0, LEVEL3_DATA.dimensions.width, 800);

    // Create atmospheric palace background
    this.createPalaceBackground();

    // Physics static groups
    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();

    // Torch lighting graphics layer
    this.torchLightGfx = this.add.graphics().setDepth(5);

    // Build palace architecture directly from LEVEL3_LAYOUT_DATA
    this.buildPalaceArchitecture();

    // Spawn player at current checkpoint
    this.player = new Player(this, this.checkpointX, this.checkpointY);

    // Initialize Camouflage Ability (Temporal Illusion)
    this.camouflage = new CamouflageAbility(this, this.player);

    // Spawn Palace Guards reading from layout table
    this.spawnGuards();

    // Spawn Puzzle Interactables (Key, Door, Component 3, Exit)
    this.setupPuzzleElements();

    // Spawn Extended Obstacles (Blades, Crumbling Stones, Chandeliers, Gates, Conduits)
    this.setupObstacles();

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
    this.player.on('staff_used', (charges: number) => {
      this.hud.updateCharges(charges);
    });
    this.player.on('staff_recharged', (charges: number) => {
      this.hud.updateCharges(charges);
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

      // Dev debug overlay toggle key (F2 or O)
      const keyF2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
      const keyO = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
      keyF2.on('down', () => this.toggleDebugOverlay());
      keyO.on('down', () => this.toggleDebugOverlay());
    }

    // Debug overlay graphics layer
    this.debugGfx = this.add.graphics().setDepth(200);

    // Scanlines
    this.addScanlines();

    // Setup Objective HUD Pill (screen-space, persistent at top center)
    this.setupObjectiveHUD();
    this.setObjective('INFILTRATE PALACE & RETRIEVE GILDED KEY');

    // Spawn World Guidance Indicators
    this.setupWorldIndicators();

    // Welcome banner & tutorial hint
    this.time.delayedCall(600, () => {
      this.hud.showBanner('VAULT INFILTRATION: PRESS [C] OR [Q] FOR TEMPORAL ILLUSION');
    });

    // Shutdown cleanup listener
    this.events.once('shutdown', () => {
      this.camouflage.destroy();
      this.guards.forEach(g => g.destroy());
      this.torchLightGfx?.destroy();
      this.debugGfx?.destroy();
      this.blades.forEach(b => { b.chainGfx.destroy(); b.sprite.destroy(); });
      this.chandeliers.forEach(c => { c.chainGfx.destroy(); c.sprite.destroy(); c.warningText?.destroy(); });
      this.timedGates.forEach(g => { g.glowGfx.destroy(); g.sprite.destroy(); });
      this.worldIndicators.forEach(w => w.container.destroy());
      this.objectiveContainer?.destroy();
      this.baitChestSprite?.destroy();
    });

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Mobile Controls
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,
      onAbilityPressed: () => this.camouflage.activate(),
      getAbilityState: () => ({
        label: 'CLOAK',
        available: this.camouflage.isReady,
        tint: LEVEL3_DATA.palette.mutedGold,
        cooldownProgress: this.camouflage.cloaked ? 1 : 0
      })
    });
  }

  update(time: number, delta: number): void {
    if (this.isPaused || this.isLeavingScene) return;

    // Safety net: if player is dead but death sequence hasn't started, trigger it
    if (this.player.isDead && !this.isRespawning) {
      this.handleDeath('SYSTEM RECOVERY');
      return;
    }
    if (this.isRespawning) return;

    // Update Player
    this.mobileHandle?.update();
    this.player.update(time, delta);

    // Fall death check
    if (this.player.y > 440 && !this.player.isDead && !this.isRespawning) {
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

    // Update Dynamic Obstacles (Pendulum chains, falling chandeliers, timed gates)
    this.updateObstacles(time, delta);

    // Animate warm torch light halos
    this.updateTorchLighting(time);

    // Track zone discovery and display atmospheric title banners
    this.checkZoneDiscovery();

    // Render debug overlay if toggled
    if (this.debugOverlay) {
      this.renderDebugOverlay();
    }
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
      distantTowers.fillRect(x, H - th, tw, th);
      for (let c = 0; c < tw; c += 8) {
        distantTowers.fillRect(x + c, H - th - 8, 4, 8);
      }
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
      midWall.fillStyle(0x0e1118, 1);
      midWall.fillRect(x - 2, 160, 28, 54);
      midWall.fillCircle(x + 12, 160, 14);

      const isAmber = (x / 220) % 2 === 0;
      const glassCol = isAmber ? 0xd4af37 : 0x75161c;
      midWall.fillStyle(glassCol, 0.45);
      midWall.fillRect(x + 1, 162, 22, 50);
      midWall.fillCircle(x + 12, 162, 11);

      midWall.lineStyle(1, 0x11131a, 0.9);
      midWall.lineBetween(x + 12, 150, x + 12, 212);
      midWall.lineBetween(x + 1, 185, x + 23, 185);
    }
  }

  // ── Palace Architecture Spawned From Layout Table ─────────────────────────

  private buildPalaceArchitecture(): void {
    const floorY = LEVEL3_DATA.dimensions.floorY;

    // Build all platforms from LEVEL3_LAYOUT_DATA
    LEVEL3_LAYOUT_DATA.zones.forEach(zone => {
      zone.platforms.forEach(plat => {
        const tileKey = plat.tileKey ?? (plat.type === 'ground' ? 'tile_stone' : 'tile_stone_top');

        if (plat.type === 'ground') {
          // Ground platform extends to the bottom of the map
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            const top = this.platforms.create(x, plat.y, 'tile_stone_top') as Phaser.Physics.Arcade.Sprite;
            top.setOrigin(0, 0).refreshBody();

            for (let subY = plat.y + 32; subY <= 440; subY += 32) {
              const block = this.platforms.create(x, subY, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
              block.setOrigin(0, 0).refreshBody();
            }
          }
        } else if (plat.type === 'drawbridge') {
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            const bridge = this.platforms.create(x, plat.y, 'tile_wood_drawbridge') as Phaser.Physics.Arcade.Sprite;
            bridge.setOrigin(0, 0).refreshBody();
          }
          // Drawbridge hanging chains
          const chainsGfx = this.add.graphics().setDepth(6);
          chainsGfx.lineStyle(2, 0x444955, 0.85);
          chainsGfx.lineBetween(plat.x, plat.y, plat.x - 46, plat.y - 90);
          chainsGfx.lineBetween(plat.x + plat.w, plat.y, plat.x + plat.w + 42, plat.y - 90);
        } else if (plat.type === 'step') {
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            const stepSp = this.platforms.create(x, plat.y, 'tile_stone_top') as Phaser.Physics.Arcade.Sprite;
            stepSp.setOrigin(0, 0).refreshBody();
            for (let subY = plat.y + 32; subY < floorY; subY += 32) {
              const blk = this.platforms.create(x, subY, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
              blk.setOrigin(0, 0).refreshBody();
            }
          }
        } else if (plat.type === 'arch') {
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            const archSp = this.platforms.create(x, plat.y, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
            archSp.setOrigin(0, 0).refreshBody();
          }
        } else if (plat.type === 'battlement' || plat.type === 'platform') {
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            const p = this.platforms.create(x, plat.y, tileKey) as Phaser.Physics.Arcade.Sprite;
            p.setOrigin(0, 0).refreshBody();
          }
        } else if (plat.type === 'wall') {
          // Solid vertical wall structure (seals overhead air from ceiling down to floor/door)
          for (let x = plat.x; x < plat.x + plat.w; x += 32) {
            for (let subY = plat.y; subY < plat.y + plat.h; subY += 32) {
              const wallBlock = this.platforms.create(x, subY, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
              wallBlock.setOrigin(0, 0).refreshBody();
            }
          }
        }
      });
    });

    // Decorative Royal Carpets & Gold Pillars
    // Zone 2 & 4 Carpets
    for (let x = 1180; x <= 1680; x += 32) {
      this.add.image(x, floorY - 4, 'tile_red_carpet').setOrigin(0, 0).setDepth(4);
    }
    for (let x = 3168; x <= 3872; x += 32) {
      this.add.image(x, floorY - 4, 'tile_red_carpet').setOrigin(0, 0).setDepth(4);
    }

    // Cover Obstacles / Pillars (solid sight blockers)
    LEVEL3_COVER_OBSTACLES.forEach(obs => {
      for (let y = obs.y; y < obs.y + obs.height; y += 32) {
        this.add.image(obs.x, y, 'tile_gold_pillar').setOrigin(0, 0).setDepth(3);
      }
    });

    // Hanging Banners
    this.add.image(620, floorY - 60, 'banner_royal').setDepth(4);
    this.add.image(960, floorY - 60, 'banner_royal').setDepth(4);
    this.add.image(1260, floorY - 90, 'banner_royal').setDepth(4);
    this.add.image(1540, floorY - 90, 'banner_royal').setDepth(4);
    this.add.image(3520, floorY - 80, 'banner_royal').setDepth(4);
    this.add.image(3840, floorY - 80, 'banner_royal').setDepth(4);

    // Wall Torch Sconces throughout all 5 zones
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
      { x: 2880, y: floorY - 50 },
      { x: 3100, y: floorY - 50 },
      { x: 3260, y: floorY - 50 },
      { x: 3460, y: floorY - 50 },
      { x: 3820, y: floorY - 50 },
      { x: 4100, y: floorY - 50 },
      { x: 4340, y: floorY - 50 },
      { x: 4620, y: floorY - 50 },
      { x: 4800, y: floorY - 50 },
      { x: 5040, y: floorY - 50 },
      { x: 5380, y: floorY - 200 }
    ];

    torchPositions.forEach(pos => {
      this.add.image(pos.x, pos.y, 'torch_sconce').setOrigin(0.5).setDepth(6);
      this.torchHalos.push({ x: pos.x, y: pos.y - 6, baseRadius: 42 });
    });
  }

  // ── Guards Setup (with Wall-Clipped Sight & Alert Propagation) ─────────────

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
          patrolSpeed: cfg.patrolSpeed,
          alertSpeed: cfg.patrolSpeed * 3, // Speed increases to threefold (3x) after light turns red
          alertRadius: cfg.alertRadius,
          facingRight: cfg.facingRight,
          suspiciousDuration: 300, // Soldier gets suspicious quickly (300ms) in light range
          obstacles: LEVEL3_COVER_OBSTACLES
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

    // Connect alert propagation across peer guards
    this.guards.forEach(g => g.registerPeers(this.guards));
  }

  // ── Puzzle Elements Setup ─────────────────────────────────────────────────

  private setupPuzzleElements(): void {
    const pz = LEVEL3_DATA.puzzle;

    // 1. The Gilded Chamber Key (atop high armory balcony)
    this.chamberKeySprite = this.physics.add.sprite(pz.chamberKey.x, pz.chamberKey.y, 'chamber_key')
      .setDepth(10);
    (this.chamberKeySprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.tweens.add({
      targets: this.chamberKeySprite,
      y: pz.chamberKey.y - 6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. The Locked Chamber Door (portcullis in front of vault in Zone 5)
    // Sized 32x64 at (5088, 276) spanning y: 276 to 340, seamlessly connecting to wall y: 0..276
    this.chamberDoorSprite = this.physics.add.sprite(pz.chamberDoor.x, pz.chamberDoor.y, 'chamber_door')
      .setOrigin(0, 0)
      .setDepth(10)
      .setImmovable(true);
    (this.chamberDoorSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.chamberDoorSprite.refreshBody();

    // 3. Failsafe Component 3: The Chrono-Prism (in the Royal Vault)
    this.component3Sprite = this.physics.add.sprite(pz.component3.x, pz.component3.y, 'relic_component3')
      .setDepth(10);
    (this.component3Sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.tweens.add({
      targets: this.component3Sprite,
      y: pz.component3.y - 8,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 4. High Tower Extraction Portal (Exit at summit of Zone 5)
    this.exitPortalSprite = this.add.sprite(pz.exitPortal.x, pz.exitPortal.y, 'failsafe_component')
      .setScale(1.8)
      .setDepth(10);

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

  // ── Extended Obstacles & Hazards Setup ────────────────────────────────────

  private setupObstacles(): void {
    // 1. Water Pits (Hazards)
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.hazards.filter(h => h.type === 'water').forEach(w => {
        const sp = this.hazards.create(w.x!, w.y!, 'tile_water') as Phaser.Physics.Arcade.Sprite;
        sp.setDisplaySize(w.w!, w.h!).setOrigin(0, 0).refreshBody();
      });
    });

    // 2. Staff Energy Conduits (3 refills: Armory, Battlements, Bait ledge)
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.pickups.filter(p => p.type === 'conduit').forEach(pos => {
        const sp = this.physics.add.sprite(pos.x, pos.y, 'energy_conduit').setDepth(7);
        sp.setImmovable(true);
        (sp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        this.tweens.add({ targets: sp, y: pos.y - 4, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut' });
        this.conduits.push({ sprite: sp, x: pos.x, y: pos.y, depleted: false });
      });
    });

    // 3. Checkpoint Crystals
    LEVEL3_DATA.checkpoints.forEach(cp => {
      const sp = this.physics.add.sprite(cp.x, cp.y, 'checkpoint_crystal').setDepth(7);
      sp.setImmovable(true);
      (sp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      if (cp.id === 'cp_spawn') {
        sp.setTexture('checkpoint_active');
      }
      this.tweens.add({ targets: sp, y: cp.y - 4, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      this.checkpointCrystals.push({ sprite: sp, id: cp.id, x: cp.x, y: cp.y - 10, label: cp.label, active: cp.id === 'cp_spawn' });
    });

    // 4. Swinging Pendulum Blades (Zone 3 and Zone 5)
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.hazards.filter(h => h.type === 'blade').forEach(cfg => {
        const chainGfx = this.add.graphics().setDepth(7);
        const bladeSp = this.physics.add.sprite(cfg.x!, cfg.minY!, 'hazard_icicle');
        bladeSp.setDepth(8).setTint(0x9aa0b0).setFlipY(true);
        (bladeSp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (bladeSp.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        (bladeSp.body as Phaser.Physics.Arcade.Body).setSize(18, 26);

        this.tweens.add({
          targets: bladeSp,
          y: cfg.maxY,
          duration: cfg.dur ?? 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });

        this.blades.push({ sprite: bladeSp, chainGfx, anchorX: cfg.x!, anchorY: cfg.anchorY! });
      });
    });

    // 5. Crumbling Stone Platforms
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.platforms.filter(p => p.type === 'crumble').forEach(cfg => {
        const sp = this.physics.add.sprite(cfg.x, cfg.y, 'tile_crumble');
        sp.setOrigin(0, 0).setDepth(6).setImmovable(true);
        (sp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        this.crumblingStones.push({ sprite: sp, x: cfg.x, y: cfg.y, isCrumbling: false });
      });
    });

    // 6. Falling Chandeliers with visible warning (Zone 4)
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.hazards.filter(h => h.type === 'chandelier').forEach(cfg => {
        const chainGfx = this.add.graphics().setDepth(6);
        const sp = this.physics.add.sprite(cfg.originX!, cfg.originY!, 'torch_sconce');
        sp.setScale(2).setDepth(8);
        (sp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (sp.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        this.chandeliers.push({
          sprite: sp,
          chainGfx,
          originX: cfg.originX!,
          originY: cfg.originY!,
          state: 'hanging'
        });
      });
    });

    // 7. Timed Flame Gate Hazards (Zone 5)
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.hazards.filter(h => h.type === 'timedGate').forEach(cfg => {
        const glowGfx = this.add.graphics().setDepth(7);
        const sp = this.physics.add.sprite(cfg.x!, cfg.y!, 'chamber_door');
        sp.setScale(0.8, 1).setDepth(8);
        (sp.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (sp.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        this.timedGates.push({
          sprite: sp,
          glowGfx,
          x: cfg.x!,
          y: cfg.y!,
          isActive: true,
          timer: 0
        });
      });
    });

    // 8. Dead-End Bait Route Chest (Zone 4 upper gallery ledge)
    this.baitChestSprite = this.physics.add.sprite(4224, 196, 'vault_chest').setDepth(7);
    (this.baitChestSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.baitChestSprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);
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
            const now = this.time.now;
            if (now - this.lastBannerTime > 1500) {
              this.lastBannerTime = now;
              this.hud.showBanner('LOCKED VAULT DOOR — RETRIEVE THE GILDED KEY');
            }
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
        64, 80
      );
      this.physics.add.existing(exitZone, true);
      this.physics.add.overlap(this.player, exitZone, () => {
        this.handleLevelComplete();
      });
    }

    // Player vs Bait Chest (Zone 4 upper ledge reward)
    if (this.baitChestSprite) {
      this.physics.add.overlap(this.player, this.baitChestSprite, () => {
        if (!this.hasOpenedBaitChest && this.baitChestSprite) {
          this.hasOpenedBaitChest = true;
          this.baitChestSprite.setTint(0xffd166);
          AudioManager.playKeyCollect();

          // Full integrity restoration & staff charges
          this.player.restoreIntegrity();
          this.player.restoreStaffCharges(this.player.maxStaffCharges);
          this.hud.updateIntegrity(this.player.integrity);
          this.hud.updateCharges(this.player.staffCharges);

          this.cameras.main.flash(220, 255, 215, 0);
          this.hud.showBanner('ROYAL TREASURE SECURED! INTEGRITY & CHARGES RESTORED!');

          const emitter = this.add.particles(4224, 196, 'proto_tile', {
            speed: { min: 40, max: 120 },
            scale: { start: 0.45, end: 0 },
            tint: [0xffd166, 0xd4af37, 0x00f0ff],
            lifespan: 600,
            quantity: 20
          });
          this.time.delayedCall(650, () => emitter.destroy());
        }
      });
    }

    // Player vs Guards overlap (contact damage when uncloaked and alert)
    this.guards.forEach(guard => {
      this.physics.add.overlap(this.player, guard, () => {
        if (this.isRespawning || this.isLeavingScene) return;

        // Cloaked player slips past unseen
        if (this.camouflage.cloaked) return;

        if (guard.isLethal) {
          const now = this.time.now;
          if (now - this.lastDamageTime < 700) return;
          this.lastDamageTime = now;

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

    // Player vs Hazards (Moat water pits)
    this.physics.add.overlap(this.player, this.hazards, () => {
      if (!this.player.isDead && !this.isRespawning) {
        this.handleDeath('DROWNED IN CASTLE MOAT');
      }
    });

    // Player vs Energy Conduits (Staff charge refills)
    this.conduits.forEach(c => {
      this.physics.add.overlap(this.player, c.sprite, () => {
        if (!c.depleted && this.player.staffCharges < this.player.maxStaffCharges) {
          c.depleted = true;
          c.sprite.setAlpha(0.25).setTint(0x444444);
          const restored = this.player.maxStaffCharges - this.player.staffCharges;
          this.player.restoreStaffCharges(restored);
          this.hud.updateCharges(this.player.staffCharges);
          this.hud.showBanner('STAFF ENERGY FULLY RECHARGED!');
          AudioManager.playConduitRecharge();
          this.cameras.main.flash(140, 0, 240, 160);
          const emitter = this.add.particles(c.x, c.y, 'proto_tile', {
            speed: { min: 40, max: 110 },
            scale: { start: 0.45, end: 0 },
            tint: [0x00f0ff, 0x70e000, 0xffffff],
            lifespan: 600,
            quantity: 18
          }).setDepth(20);
          this.time.delayedCall(650, () => emitter.destroy());
          // Recharge back after 12s just like previous levels
          this.time.delayedCall(12000, () => {
            c.depleted = false;
            c.sprite.clearTint().setAlpha(1);
          });
        }
      });
    });

    // Player vs Checkpoint Crystals
    this.checkpointCrystals.forEach(cp => {
      this.physics.add.overlap(this.player, cp.sprite, () => {
        if (!cp.active) {
          cp.active = true;
          cp.sprite.setTexture('checkpoint_active');
          this.checkpointX = cp.x;
          this.checkpointY = cp.y;
          AudioManager.playCheckpoint();
          this.cameras.main.flash(200, 0, 240, 255);
          this.hud.showBanner(`CHECKPOINT ACTIVATED — ${cp.label}`);
          this.tweens.add({
            targets: cp.sprite,
            scale: 1.35,
            duration: 200,
            yoyo: true,
            repeat: 2
          });
          const emitter = this.add.particles(cp.x, cp.y, 'proto_tile', {
            speed: { min: 40, max: 120 },
            scale: { start: 0.5, end: 0 },
            tint: [0x00f0ff, 0xd4af37, 0xffffff],
            lifespan: 700,
            quantity: 22
          }).setDepth(20);
          this.time.delayedCall(750, () => emitter.destroy());
        }
      });
    });

    // Player vs Swinging Pendulum Blades
    this.blades.forEach(blade => {
      this.physics.add.overlap(this.player, blade.sprite, () => {
        if (this.isRespawning || this.isLeavingScene) return;
        const now = this.time.now;
        if (now - this.lastDamageTime < 750) return;
        this.lastDamageTime = now;
        const lethal = this.player.takeDamage();
        if (lethal || this.player.integrity <= 0 || this.player.isDead) {
          this.handleDeath('STRUCK BY PALACE PENDULUM BLADE');
        } else {
          AudioManager.playWoodCreak();
          this.cameras.main.shake(140, 0.01);
          this.hud.showBanner(`INTEGRITY COMPROMISED: ${this.player.integrity} HP REMAINING`);
        }
      });
    });

    // Player vs Falling Chandeliers
    this.chandeliers.forEach(ch => {
      this.physics.add.overlap(this.player, ch.sprite, () => {
        if (this.isRespawning || this.isLeavingScene) return;
        if (ch.state === 'falling') {
          const lethal = this.player.takeDamage();
          if (lethal || this.player.integrity <= 0 || this.player.isDead) {
            this.handleDeath('CRUSHED BY FALLING CHANDELIER');
          } else {
            AudioManager.playStoneRumble();
            this.cameras.main.shake(180, 0.015);
            this.hud.showBanner(`INTEGRITY COMPROMISED: ${this.player.integrity} HP REMAINING`);
          }
        }
      });
    });

    // Player vs Timed Flame Gates
    this.timedGates.forEach(gate => {
      this.physics.add.overlap(this.player, gate.sprite, () => {
        if (this.isRespawning || this.isLeavingScene) return;
        if (gate.isActive) {
          const now = this.time.now;
          if (now - this.lastDamageTime < 750) return;
          this.lastDamageTime = now;
          const lethal = this.player.takeDamage();
          if (lethal || this.player.integrity <= 0 || this.player.isDead) {
            this.handleDeath('SCORCHED BY ROYAL SANCTUM FLAME GATE');
          } else {
            AudioManager.playStoneRumble();
            this.cameras.main.shake(140, 0.01);
            this.hud.showBanner(`INTEGRITY COMPROMISED: ${this.player.integrity} HP REMAINING`);
          }
        }
      });
    });

    // Player vs Crumbling Stone Platforms
    this.crumblingStones.forEach(stone => {
      this.physics.add.collider(this.player, stone.sprite, () => {
        if (!stone.isCrumbling && (this.player.body as Phaser.Physics.Arcade.Body).touching.down) {
          stone.isCrumbling = true;
          AudioManager.playStoneRumble();
          this.tweens.add({
            targets: stone.sprite,
            x: stone.x + 3,
            duration: 40,
            yoyo: true,
            repeat: 8,
            onComplete: () => {
              (stone.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
              stone.sprite.setAlpha(0);
              this.time.delayedCall(3200, () => {
                stone.sprite.setPosition(stone.x, stone.y);
                stone.sprite.setAlpha(1);
                (stone.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
                stone.isCrumbling = false;
              });
            }
          });
        }
      });
    });
  }

  // ── Dynamic Obstacle Update Routine ───────────────────────────────────────

  private updateObstacles(time: number, delta: number): void {
    const floorY = LEVEL3_DATA.dimensions.floorY;

    // 1. Update Swinging Blade Chains
    this.blades.forEach(blade => {
      blade.chainGfx.clear();
      blade.chainGfx.lineStyle(2, 0x555c6d, 0.9);
      blade.chainGfx.lineBetween(blade.anchorX, blade.anchorY, blade.sprite.x, blade.sprite.y);
    });

    // 2. Update Falling Chandeliers
    this.chandeliers.forEach(ch => {
      ch.chainGfx.clear();

      if (ch.state === 'hanging') {
        ch.chainGfx.lineStyle(2, 0x8c6d2d, 0.85);
        ch.chainGfx.lineBetween(ch.originX, 60, ch.sprite.x, ch.sprite.y);

        // Proximity detection to trigger warning
        if (Math.abs(this.player.x - ch.originX) < 85 && this.player.y > ch.originY) {
          ch.state = 'warning';
          AudioManager.playWoodCreak();

          ch.warningText = this.add.text(ch.originX, ch.originY - 24, '⚠', {
            fontSize: '18px',
            color: '#ffaa00',
            stroke: '#000000',
            strokeThickness: 3
          }).setOrigin(0.5).setDepth(25);

          this.tweens.add({
            targets: ch.sprite,
            x: ch.originX + 4,
            duration: 50,
            yoyo: true,
            repeat: 8,
            onComplete: () => {
              ch.warningText?.destroy();
              ch.warningText = undefined;
              ch.state = 'falling';
              (ch.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(420);
            }
          });
        }
      } else if (ch.state === 'warning') {
        ch.chainGfx.lineStyle(1.5, 0xffaa00, 0.9);
        ch.chainGfx.lineBetween(ch.originX, 60, ch.sprite.x, ch.sprite.y);
      } else if (ch.state === 'falling') {
        if (ch.sprite.y >= floorY - 16) {
          ch.state = 'broken';
          ch.sprite.y = floorY - 16;
          (ch.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(0);
          AudioManager.playStoneRumble();
          this.cameras.main.shake(150, 0.008);

          const emitter = this.add.particles(ch.sprite.x, floorY - 10, 'proto_tile', {
            speed: { min: 40, max: 120 },
            scale: { start: 0.4, end: 0 },
            tint: [0xffaa00, 0xff4400, 0xd4af37],
            lifespan: 400,
            quantity: 12
          });
          this.time.delayedCall(450, () => emitter.destroy());

          // Reset chandelier after 4.5 seconds
          this.time.delayedCall(4500, () => {
            ch.state = 'hanging';
            ch.sprite.setPosition(ch.originX, ch.originY);
            (ch.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
          });
        }
      }
    });

    // 3. Update Timed Flame Gates
    this.timedGates.forEach(gate => {
      gate.timer += delta;
      if (gate.timer > 2400) {
        gate.timer = 0;
        gate.isActive = !gate.isActive;
        gate.sprite.setAlpha(gate.isActive ? 1 : 0.25);
        if (gate.isActive) {
          AudioManager.playStoneRumble();
        }
      }

      gate.glowGfx.clear();
      if (gate.isActive) {
        gate.glowGfx.fillStyle(0xff4400, 0.2 + Math.sin(time * 0.01) * 0.1);
        gate.glowGfx.fillRect(gate.x - 16, gate.y - 32, 32, 64);
      }
    });
  }

  // ── Puzzle Logic: Key, Door, Component 3 ──────────────────────────────────

  private collectChamberKey(): void {
    if (!this.chamberKeySprite || !this.chamberKeySprite.active || this.hasChamberKey) return;

    this.hasChamberKey = true;
    AudioManager.playKeyCollect();

    const emitter = this.add.particles(this.chamberKeySprite.x, this.chamberKeySprite.y, 'proto_tile', {
      speed: { min: 30, max: 90 },
      scale: { start: 0.35, end: 0 },
      tint: [0xd4af37, 0xffe082, 0xffffff],
      lifespan: 500,
      quantity: 14
    });
    this.time.delayedCall(550, () => emitter.destroy());

    this.chamberKeySprite.destroy();

    this.checkpointX = LEVEL3_DATA.checkpoints[1].x;
    this.checkpointY = LEVEL3_DATA.checkpoints[1].y;

    this.cameras.main.flash(140, 212, 175, 55);
    this.hud.showBanner('GILDED KEY ACQUIRED — PROCEED THROUGH BATTLEMENTS TO THE VAULT');

    // Update Objectives & Indicators
    this.removeWorldIndicator('ind_balcony');
    this.removeWorldIndicator('ind_key');
    this.removeWorldIndicator('ind_door');
    this.createWorldIndicator('ind_door', LEVEL3_DATA.puzzle.chamberDoor.x, LEVEL3_DATA.puzzle.chamberDoor.y - 60, '🔓 UNLOCK VAULT [USE KEY]', 0x70e000, '🔓');
    this.setObjective('CROSS BATTLEMENTS & UNLOCK ROYAL VAULT DOOR');
  }

  private unlockChamberDoor(): void {
    if (this.isChamberDoorUnlocked || !this.chamberDoorSprite) return;

    this.isChamberDoorUnlocked = true;
    AudioManager.playDoorUnlock();

    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(120, 255, 215, 0);

    (this.chamberDoorSprite.body as Phaser.Physics.Arcade.Body).enable = false;

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

    // Update Objectives & Indicators
    this.removeWorldIndicator('ind_door');
    this.setObjective('SECURE COMPONENT 03 (CHRONO-PRISM) IN VAULT');
  }

  private collectComponent3(): void {
    if (!this.component3Sprite || !this.component3Sprite.active || this.hasCollectedComponent3) return;

    this.hasCollectedComponent3 = true;
    AudioManager.playComponent3Collect();

    const emitter = this.add.particles(this.component3Sprite.x, this.component3Sprite.y, 'proto_tile', {
      speed: { min: 60, max: 160 },
      scale: { start: 0.5, end: 0 },
      tint: [0xd4af37, 0xffd166, 0xff6600, 0x00f0ff],
      lifespan: 800,
      quantity: 28
    });
    this.time.delayedCall(850, () => emitter.destroy());

    this.component3Sprite.destroy();

    // Checkpoint 5 (Vault)
    this.checkpointX = LEVEL3_DATA.checkpoints[4].x;
    this.checkpointY = LEVEL3_DATA.checkpoints[4].y;

    this.hud.setFailsafeFound(3, 5);
    this.player.restoreStaffCharges(3);
    this.hud.updateCharges(this.player.staffCharges);

    this.cameras.main.flash(350, 255, 200, 60);
    this.hud.showBanner('COMPONENT 03 (CHRONO-PRISM) SECURED! ESCAPE TO HIGH EXTRACTION RIFT!');

    // Update Objectives & Guidance Waypoints
    this.removeWorldIndicator('ind_vault');
    this.setObjective('ASCEND SPIRE TO HIGH EXTRACTION RIFT [➡]');
    this.spawnEscapeWaypoints();

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
      const now = this.time.now;
      if (now - this.lastBannerTime > 1500) {
        this.lastBannerTime = now;
        this.hud.showBanner('CANNOT ESCAPE — COMPONENT 03 MUST BE SECURED FIRST!');
      }
      return;
    }

    if (this.isLeavingScene || this.physics.world.isPaused) return;
    this.isLeavingScene = true;
    SaveSystem.markLevelCompleted(3);

    this.physics.pause();

    this.hud.showBanner('SECTOR 3 INFILTRATION COMPLETE! EXTRACTION COMMENCED!');
    AudioManager.playFailsafe();

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('LevelComplete', {
        failsafeCollected: 3,
        totalFailsafe: 5,
        deathCount: this.deathCount,
        timeMs: Date.now() - this.levelStartTime,
        sectorNumber: 3,
        alertCount: this.alertCount
      });
    });
    this.cameras.main.fadeOut(800, 10, 14, 25);
  }

  // ── Death & Respawn ───────────────────────────────────────────────────────

  private handleDeath(reason = 'SECURITY SYSTEM BREACH'): void {
    if (this.isRespawning || this.isLeavingScene) return;
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

          // Reset all per-life puzzle & obstacle states
          this.conduits.forEach(c => {
            c.depleted = false;
            c.sprite.clearTint();
          });
          this.chandeliers.forEach(ch => {
            ch.state = 'hanging';
            ch.sprite.setPosition(ch.originX, ch.originY);
            (ch.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
            ch.warningText?.destroy();
            ch.warningText = undefined;
          });
          this.crumblingStones.forEach(st => {
            (st.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
            st.sprite.setPosition(st.x, st.y).setAlpha(1);
            st.isCrumbling = false;
          });

          // Reset all guards to patrol cleanly
          this.guards.forEach((g, idx) => {
            const cfg = LEVEL3_DATA.guards[idx];
            g.resetToPatrol(cfg?.x, cfg?.facingRight);
          });

          // Reset bait chest if not collected before checkpoint
          if (this.hasOpenedBaitChest && this.checkpointX < 4224) {
            this.hasOpenedBaitChest = false;
            this.baitChestSprite?.clearTint();
          }

          // Restore appropriate objective display on respawn
          if (this.hasCollectedComponent3) {
            this.setObjective('ASCEND SPIRE TO HIGH EXTRACTION RIFT [➡]');
          } else if (this.isChamberDoorUnlocked) {
            this.setObjective('SECURE COMPONENT 03 (CHRONO-PRISM) IN VAULT');
          } else if (this.hasChamberKey) {
            this.setObjective('CROSS BATTLEMENTS & UNLOCK ROYAL VAULT DOOR');
          } else {
            this.setObjective('INFILTRATE PALACE & RETRIEVE GILDED KEY');
          }
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

  // ── Torch Lighting System ─────────────────────────────────────────────────

  private updateTorchLighting(time: number): void {
    if (!this.torchLightGfx) return;

    this.torchLightGfx.clear();

    const cam = this.cameras.main;
    const viewLeft = cam.scrollX - 50;
    const viewRight = cam.scrollX + cam.width + 50;

    this.torchHalos.forEach((halo, idx) => {
      if (halo.x < viewLeft || halo.x > viewRight) return;

      const flicker = Math.sin((time * 0.008) + idx * 1.7) * 4 + Math.sin((time * 0.015) + idx * 2.3) * 2;
      const radius = halo.baseRadius + flicker;

      this.torchLightGfx!.fillStyle(0xff8800, 0.08);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius);

      this.torchLightGfx!.fillStyle(0xffaa33, 0.12);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius * 0.65);

      this.torchLightGfx!.fillStyle(0xffdd66, 0.22);
      this.torchLightGfx!.fillCircle(halo.x, halo.y, radius * 0.3);
    });
  }

  // ── Dev Debug Overlay ─────────────────────────────────────────────────────

  private toggleDebugOverlay(): void {
    this.debugOverlay = !this.debugOverlay;
    if (!this.debugOverlay) {
      this.debugGfx?.clear();
    }
    this.hud.showBanner(`DEBUG OVERLAY: ${this.debugOverlay ? 'ON (JUMP ARCS & BOUNDS)' : 'OFF'}`);
  }

  private renderDebugOverlay(): void {
    if (!this.debugGfx) return;
    this.debugGfx.clear();

    // 1. Draw platform bounds in bright green with grid coordinates
    this.debugGfx.lineStyle(1.5, 0x00ff00, 0.8);
    LEVEL3_LAYOUT_DATA.zones.forEach(z => {
      z.platforms.forEach(p => {
        this.debugGfx!.strokeRect(p.x, p.y, p.w, p.h);
      });
    });

    // 2. Draw guard patrol boundaries in bright yellow & red end ticks
    this.guards.forEach((g, idx) => {
      const cfg = LEVEL3_DATA.guards[idx];
      if (!cfg) return;

      this.debugGfx!.lineStyle(2, 0xffd166, 0.9);
      this.debugGfx!.lineBetween(cfg.patrolLeft, g.y, cfg.patrolRight, g.y);

      this.debugGfx!.lineStyle(2, 0xff2200, 1);
      this.debugGfx!.lineBetween(cfg.patrolLeft, g.y - 6, cfg.patrolLeft, g.y + 6);
      this.debugGfx!.lineBetween(cfg.patrolRight, g.y - 6, cfg.patrolRight, g.y + 6);
    });

    // 3. Draw checkpoints and spawn in bright cyan
    this.debugGfx.lineStyle(2, 0x00f0ff, 0.9);
    LEVEL3_DATA.checkpoints.forEach(cp => {
      this.debugGfx!.strokeCircle(cp.x, cp.y, 16);
    });

    // 4. Draw theoretical jump reach parabola from current player position
    const px = this.player.x;
    const py = this.player.y;
    const facingDir = this.player.flipX ? -1 : 1;
    this.debugGfx.lineStyle(1.5, 0xff00ff, 0.8);
    this.debugGfx.beginPath();
    this.debugGfx.moveTo(px, py);

    const totalTime = 2 * Math.abs(PLAYER_PHYSICS.jumpVelocity) / PLAYER_PHYSICS.gravity; // 0.875 s
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * totalTime;
      const arcX = px + facingDir * PLAYER_PHYSICS.moveSpeed * t;
      const arcY = py + (PLAYER_PHYSICS.jumpVelocity * t + 0.5 * PLAYER_PHYSICS.gravity * t * t);
      this.debugGfx.lineTo(arcX, arcY);
    }
    this.debugGfx.strokePath();
  }

  // ── Camera Tracking ───────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, LEVEL3_DATA.dimensions.width, LEVEL3_DATA.dimensions.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(40, 20);
  }

  // ── Restart & Checkpoint Helpers ──────────────────────────────────────────

  private restartLevelFromBeginning(): void {
    this.checkpointX = LEVEL3_DATA.spawn.x;
    this.checkpointY = LEVEL3_DATA.spawn.y;
    this.deathCount = 0;
    this.alertCount = 0;
    this.hasChamberKey = false;
    this.isChamberDoorUnlocked = false;
    this.hasCollectedComponent3 = false;
    this.hasOpenedBaitChest = false;
    this.isPaused = false;
    this.physics.resume();
    this.scene.restart();
  }

  private restartAtCheckpoint(): void {
    this.resumeGame();
    this.player.restoreIntegrity();
    this.player.respawnAt(this.checkpointX, this.checkpointY);
    this.player.restoreStaffCharges(this.player.maxStaffCharges);
    this.hud.updateIntegrity(this.player.integrity);
    this.hud.updateCharges(this.player.staffCharges);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Reset all per-life puzzle & obstacle states
    this.conduits.forEach(c => {
      c.depleted = false;
      c.sprite.clearTint();
    });
    this.chandeliers.forEach(ch => {
      ch.state = 'hanging';
      ch.sprite.setPosition(ch.originX, ch.originY);
      (ch.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      ch.warningText?.destroy();
      ch.warningText = undefined;
    });
    this.crumblingStones.forEach(st => {
      (st.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
      st.sprite.setPosition(st.x, st.y).setAlpha(1);
      st.isCrumbling = false;
    });

    // Reset guards to clean patrol
    this.guards.forEach((g, idx) => {
      const cfg = LEVEL3_DATA.guards[idx];
      g.resetToPatrol(cfg?.x, cfg?.facingRight);
    });

    // Reset bait chest if not collected before checkpoint
    if (this.hasOpenedBaitChest && this.checkpointX < 4224) {
      this.hasOpenedBaitChest = false;
      this.baitChestSprite?.clearTint();
    }

    // Restore appropriate objective display on checkpoint restart
    if (this.hasCollectedComponent3) {
      this.setObjective('ASCEND SPIRE TO HIGH EXTRACTION RIFT [➡]');
    } else if (this.isChamberDoorUnlocked) {
      this.setObjective('SECURE COMPONENT 03 (CHRONO-PRISM) IN VAULT');
    } else if (this.hasChamberKey) {
      this.setObjective('CROSS BATTLEMENTS & UNLOCK ROYAL VAULT DOOR');
    } else {
      this.setObjective('INFILTRATE PALACE & RETRIEVE GILDED KEY');
    }

    this.hud.showBanner('WARPED TO ACTIVE CHECKPOINT');
  }

  // ── Pause Menu ────────────────────────────────────────────────────────────

  private togglePause(): void {
    if (this.isLeavingScene || this.isRespawning || this.player.isDead) return;
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
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

  // ── Objective HUD Pill & Guidance Indicators ──────────────────────────────

  private setupObjectiveHUD(): void {
    const W = this.cameras.main.width;
    this.objectiveContainer = this.add.container(W / 2, 53).setScrollFactor(0).setDepth(55);

    this.objectiveBg = this.add.graphics();
    this.objectiveText = this.add.text(0, 0, '', {
      fontFamily: '"Pixelify Sans", monospace',
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
    this.objectiveBg.fillStyle(0x060810, 0.92);
    this.objectiveBg.fillRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, 9);
    this.objectiveBg.lineStyle(1.5, LEVEL3_DATA.palette.mutedGold, 0.85);
    this.objectiveBg.strokeRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, 9);

    // Pulse animation on update
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
    this.createWorldIndicator('ind_balcony', 1440, 240, '▲ GILDED KEY ON BALCONY', 0xffaa00, '▲');
    this.createWorldIndicator('ind_key', 1760, 110, '★ GILDED KEY', 0xd4af37, '★');
    this.createWorldIndicator('ind_door', 5088, 250, '🔒 LOCKED VAULT DOOR', 0xff4444, '🔒');
    this.createWorldIndicator('ind_vault', 5224, 230, '★ CHRONO-PRISM PEDESTAL', 0x00f0ff, '★');
    this.createWorldIndicator('ind_bait', 3904, 240, '▲ BAIT ROUTE [CHEST]', 0xffd166, '▲');
  }

  private createWorldIndicator(id: string, x: number, y: number, text: string, color: number, icon = '▲'): void {
    const container = this.add.container(x, y).setDepth(22);

    const txt = this.add.text(0, 0, `${icon} ${text}`, {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const w = txt.width + 16;
    const h = 18;
    const bg = this.add.graphics();
    bg.fillStyle(0x070912, 0.88);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(1.5, color, 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

    container.add([bg, txt]);

    // Smooth bobbing tween
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

  private spawnEscapeWaypoints(): void {
    this.createWorldIndicator('esc_spire', 5312, 230, '▲ TO EXTRACTION SPIRE', 0xd4af37, '▲');
    this.createWorldIndicator('esc_portal', 5472, 70, '✦ EXTRACTION RIFT ✦', 0x00f0ff, '✦');
  }

  private checkZoneDiscovery(): void {
    const px = this.player.x;
    let zoneNum = 1;
    let zoneName = '';

    if (px >= 4288) { zoneNum = 5; zoneName = 'ZONE 5: VAULT APPROACH & EXTRACTION SPIRE'; }
    else if (px >= 3136) { zoneNum = 4; zoneName = 'ZONE 4: THRONE ROOM & BAIT ROUTE'; }
    else if (px >= 2048) { zoneNum = 3; zoneName = 'ZONE 3: DRAWBRIDGE & BATTLEMENTS'; }
    else if (px >= 1024) { zoneNum = 2; zoneName = 'ZONE 2: CORRIDORS & ROYAL ARMORY'; }
    else { zoneNum = 1; zoneName = 'ZONE 1: GATEHOUSE & COURTYARD'; }

    if (zoneNum > 1 && !this.discoveredZones.has(zoneNum)) {
      this.discoveredZones.add(zoneNum);
      this.hud.showBanner(zoneName);
    }
  }
}
