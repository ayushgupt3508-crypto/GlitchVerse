/**
 * Configuration and Layout Data for Bonus Level: THE CONVERGENCE
 * Single source of truth for chamber layout, surge hazards, scoring formula, and bay aesthetics.
 */

export interface ConvergenceBayConfig {
  id: number;
  name: string;
  subtitle: string;
  startX: number;
  endX: number;
  palette: {
    bg: number;
    ambient: number;
    accent: number;
    particles: number;
  };
  ability: 'FREEZE' | 'IGNITE' | 'CLOAK' | 'TIME' | 'PHASE';
  sealName: string;
  sealX: number;
  sealY: number;
  checkpointX: number;
  checkpointY: number;
  parAbilities: number;
}

export const CONVERGENCE_CONFIG = {
  chamber: {
    width: 3800,
    height: 480,
    floorY: 380,
    gravity: 800,
  },
  run: {
    totalTimeSeconds: 270, // 4 minutes 30 seconds
    maxAttempts: 3,
    maxIntegrity: 3,
    initialStaffCharges: 3,
    maxStaffCharges: 3,
    parTotalAbilities: 9
  },
  surge: {
    intervalMs: 22000,     // Wave period
    warningDurationMs: 3000,
    impactDurationMs: 1500,
    cameraShakeIntensity: 0.007,
    scorePenaltyPerHit: 150
  },
  scoring: {
    basePerSeal: 1000,         // 5 seals = 5000 max
    timeBonusPerSecond: 10,    // e.g. 150s remaining = 1500
    attemptBonusPerHeart: 500, // 3 attempts left = 1500
    collectibleValue: 250,     // 5 fragments = 1250
    parEfficiencyBonus: 1000,  // <= 9 ability charges used
    noAlertBonus: 500,         // Sentry in Bay 3 never triggered alarm
    rankThresholds: {
      S: 8000,
      A: 6500,
      B: 5000,
      C: 3500
    }
  },
  bays: [
    {
      id: 1,
      name: 'FROZEN AGE',
      subtitle: '// CRYO-HYDRO ENGINE //',
      startX: 0,
      endX: 740,
      palette: {
        bg: 0x051326,
        ambient: 0x0a2240,
        accent: 0x48cae4,
        particles: 0xa0e7e5
      },
      ability: 'FREEZE',
      sealName: 'CRYO SEAL',
      sealX: 660,
      sealY: 260,
      checkpointX: 100,
      checkpointY: 340,
      parAbilities: 1
    },
    {
      id: 2,
      name: 'HEAT AGE',
      subtitle: '// THERMAL CRUCIBLE //',
      startX: 740,
      endX: 1400,
      palette: {
        bg: 0x220901,
        ambient: 0x3d1308,
        accent: 0xff6b00,
        particles: 0xffaa00
      },
      ability: 'IGNITE',
      sealName: 'FLAME SEAL',
      sealX: 1320,
      sealY: 190,
      checkpointX: 780,
      checkpointY: 340,
      parAbilities: 1
    },
    {
      id: 3,
      name: 'MEDIEVAL PALACE',
      subtitle: '// ROYAL VAULT SECURITY //',
      startX: 1400,
      endX: 2060,
      palette: {
        bg: 0x14120c,
        ambient: 0x242016,
        accent: 0xd4af37,
        particles: 0xffd166
      },
      ability: 'CLOAK',
      sealName: 'ROYAL SEAL',
      sealX: 1980,
      sealY: 340,
      checkpointX: 1440,
      checkpointY: 340,
      parAbilities: 1
    },
    {
      id: 4,
      name: 'ANCIENT FOREST',
      subtitle: '// CHRONO-SAPLING VAULT //',
      startX: 2060,
      endX: 2720,
      palette: {
        bg: 0x061a0f,
        ambient: 0x0e2f1c,
        accent: 0x52b788,
        particles: 0x74c69d
      },
      ability: 'TIME',
      sealName: 'FOREST SEAL',
      sealX: 2640,
      sealY: 240,
      checkpointX: 2100,
      checkpointY: 340,
      parAbilities: 1
    },
    {
      id: 5,
      name: 'REALITY SWAP',
      subtitle: '// QUANTUM RIFT CORE //',
      startX: 2720,
      endX: 3380,
      palette: {
        bg: 0x1f032b,
        ambient: 0x360749,
        accent: 0xff007f,
        particles: 0x00f0ff
      },
      ability: 'PHASE',
      sealName: 'QUANTUM SEAL',
      sealX: 3300,
      sealY: 290,
      checkpointX: 2760,
      checkpointY: 340,
      parAbilities: 2
    }
  ] as ConvergenceBayConfig[],
  convergenceRoom: {
    startX: 3380,
    endX: 3800,
    palette: {
      bg: 0x0c061a,
      ambient: 0x1b0e36,
      accent: 0x70e000,
      particles: 0xffffff
    },
    coreSpawnX: 3420,
    coreSpawnY: 340,
    exitPortalX: 3720,
    exitPortalY: 190,
    parAbilities: 3
  }
};

/**
 * Data-driven layout table for all solid platforms, hazards, conduits, and checkpoints.
 * All jump distances have a 10-15% safety margin:
 * (Flat jump reach is 140px; maximum gap in layout is 100px.
 *  Max jump height is 76px; maximum vertical platform step is 52px).
 */
export interface PlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
  texture: string;
  isPhaseA?: boolean;
  isPhaseB?: boolean;
}

export interface HazardDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'icicle' | 'lava' | 'fire_jet' | 'tripwire' | 'bramble' | 'glitch_beam';
  lethal: boolean;
  texture?: string;
}

export interface CollectibleDef {
  id: string;
  x: number;
  y: number;
  bayId: number;
}
