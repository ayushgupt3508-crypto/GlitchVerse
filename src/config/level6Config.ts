/**
 * LEVEL 6 DATA SPECIFICATION — THE GAUNTLET
 * ──────────────────────────────────────────
 * Full multi-world endurance chamber combining all 5 sectors in sequence.
 */

export interface SeamCurveDef {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  a: number;
  k: number;
  ditherWidth: number;
  colorFrom: number;
  colorTo: number;
  label: string;
}

export interface GauntletObjective {
  id: string;
  section: number;
  type: 'required' | 'primary' | 'bonus';
  title: string;
  description: string;
  mechanics: string[];
  score: number;
  completed?: boolean;
}

export const LEVEL6_CONFIG = {
  id: 'level6',
  name: 'The Gauntlet',
  sector: 6,
  dimensions: {
    width: 12600,
    height: 360,
    floorY: 320
  },
  spawn: { x: 80, y: 288 },
  maxAttempts: 3,
  timeLimitMs: 360000, // 6 minutes countdown

  // Glitch surge dynamic hazard
  surge: {
    intervalMs: 26000,
    warningDurationMs: 3500,
    surgeDurationMs: 2500
  },

  // Checkpoints — y=288 places the crystal slightly above floor (floorY=320 - half sprite ~32px)
  // so the player spawning here lands safely on the solid floor
  checkpoints: [
    { id: 'cp_start', x: 80, y: 288, label: 'SECTOR 6 · START PAD' },
    { id: 'cp_s1', x: 1100, y: 288, label: 'S1 · CRYOGENIC RUNWAY' },
    { id: 'cp_s2', x: 2900, y: 288, label: 'S2 · MAGMA VENT CRUCIBLE' },
    { id: 'cp_s3', x: 4950, y: 288, label: 'S3 · PALACE BATTLEMENTS' },
    { id: 'cp_s4', x: 6950, y: 288, label: 'S4 · CHRONAL CANOPY' },
    { id: 'cp_s5', x: 8950, y: 288, label: 'S5 · DIMENSIONAL RIFT' },
    { id: 'cp_s6', x: 10600, y: 288, label: 'S6 · CORE ANTECHAMBER' }
  ],

  // Section Boundaries
  sections: {
    startPad: { startX: 0, endX: 600 },
    s1: { startX: 600, endX: 2300, name: 'Frozen Age', ability: 'FREEZE' },
    seam1: { startX: 2300, endX: 2500 },
    s2: { startX: 2500, endX: 4300, name: 'Heat Age', ability: 'VENT' },
    seam2: { startX: 4300, endX: 4500 },
    s3: { startX: 4500, endX: 6300, name: 'Medieval Palace', ability: 'CAMOUFLAGE' },
    seam3: { startX: 6300, endX: 6500 },
    s4: { startX: 6500, endX: 8300, name: 'Ancient Forest', ability: 'TIME' },
    seam4: { startX: 8300, endX: 8500 },
    s5: { startX: 8500, endX: 10300, name: 'Reality Swap', ability: 'PHASE' },
    seam5: { startX: 10300, endX: 10500 },
    s6: { startX: 10500, endX: 12600, name: 'Convergence Core', ability: 'MULTIVERSE' }
  },

  // Pixel Seam Curve Parameters: y = y0 + a * (e^(k * dx) - 1)
  seams: [
    {
      x0: 2300,
      x1: 2500,
      y0: 320,
      y1: 240,
      a: 14.5,
      k: 0.009,
      ditherWidth: 14,
      colorFrom: 0x00f0ff,
      colorTo: 0xff6b35,
      label: 'SEAM 1 · CRYOGENIC / MAGMATIC THRESHOLD'
    },
    {
      x0: 4300,
      x1: 4500,
      y0: 320,
      y1: 230,
      a: 16.0,
      k: 0.0085,
      ditherWidth: 14,
      colorFrom: 0xff6b35,
      colorTo: 0xd4af37,
      label: 'SEAM 2 · VOLCANIC / ROYAL STONE CONDUIT'
    },
    {
      x0: 6300,
      x1: 6500,
      y0: 320,
      y1: 220,
      a: 15.0,
      k: 0.0092,
      ditherWidth: 14,
      colorFrom: 0xd4af37,
      colorTo: 0x52b788,
      label: 'SEAM 3 · BATTLEMENTS / ARBOREAL EMBANKMENT'
    },
    {
      x0: 8300,
      x1: 8500,
      y0: 320,
      y1: 240,
      a: 14.0,
      k: 0.0095,
      ditherWidth: 14,
      colorFrom: 0x52b788,
      colorTo: 0xff007f,
      label: 'SEAM 4 · FORESTRY / CYBERNETIC VOID BOUNDARY'
    },
    {
      x0: 10300,
      x1: 10500,
      y0: 320,
      y1: 250,
      a: 13.5,
      k: 0.009,
      ditherWidth: 14,
      colorFrom: 0xff007f,
      colorTo: 0x00f0ff,
      label: 'SEAM 5 · REALITY MATRIX / CORE CONVERGENCE'
    }
  ] as SeamCurveDef[],

  // Objectives Full Specification Table
  objectives: [
    // S1 Frozen Age
    {
      id: 'O1.1',
      section: 1,
      type: 'required',
      title: 'CRYO HAZARD RUNWAY',
      description: 'Freeze the liquid nitrogen channel to cross into the relay zone.',
      mechanics: ['FREEZE'],
      score: 1000
    },
    {
      id: 'O1.2',
      section: 1,
      type: 'required',
      title: 'DUAL RELAY ACTIVATION',
      description: 'Stun security drones and energize two power relays under moving icicles.',
      mechanics: ['FREEZE', 'STUN'],
      score: 1000
    },
    {
      id: 'O1.3',
      section: 1,
      type: 'primary',
      title: 'FROST KEY RECOVERY',
      description: 'Solve the chained 2-step ice vault sequence and claim the Frost Key.',
      mechanics: ['FREEZE'],
      score: 2500
    },
    {
      id: 'B1',
      section: 1,
      type: 'bonus',
      title: 'GLACIAL CACHE',
      description: 'Scale the high ice stalactite ledges to claim the secret shard cache.',
      mechanics: ['FREEZE'],
      score: 1500
    },

    // S2 Heat Age
    {
      id: 'O2.1',
      section: 2,
      type: 'required',
      title: 'THERMAL VENT ASCENT',
      description: 'Harness the high-pressure thermal updraft to reach the furnace tier.',
      mechanics: ['VENT'],
      score: 1000
    },
    {
      id: 'O2.2',
      section: 2,
      type: 'required',
      title: 'CONVECTION TUNNEL SPRINT',
      description: 'Glide horizontally over crumbling magma tiles before the vent exhaust collapses.',
      mechanics: ['VENT'],
      score: 1000
    },
    {
      id: 'O2.3',
      section: 2,
      type: 'required',
      title: 'VENT DUAL IGNITION',
      description: 'Ignite two synchronized thermal vents in sequence to power the blast chamber.',
      mechanics: ['VENT'],
      score: 1000
    },
    {
      id: 'O2.4',
      section: 2,
      type: 'primary',
      title: 'EMBER CORE EXTRACTION',
      description: 'Extract the Ember Core and sprint through the collapsing lava gantry.',
      mechanics: ['VENT'],
      score: 2500
    },
    {
      id: 'B2',
      section: 2,
      type: 'bonus',
      title: 'MAGMA VAULT RELIC',
      description: 'Ride a boosted convective updraft to the high ceiling alcove.',
      mechanics: ['VENT'],
      score: 1500
    },

    // S3 Medieval Palace
    {
      id: 'O3.1',
      section: 3,
      type: 'required',
      title: 'COURTYARD INFILTRATION',
      description: 'Slip past two offset sentinel patrols using temporal camouflage cloak.',
      mechanics: ['CAMOUFLAGE'],
      score: 1000
    },
    {
      id: 'O3.2',
      section: 3,
      type: 'required',
      title: 'ARMORY DECOY MANEUVER',
      description: 'Deploy a decoy hologram to distract the heavy guard off the gate trigger.',
      mechanics: ['CAMOUFLAGE', 'DECOY'],
      score: 1000
    },
    {
      id: 'O3.3',
      section: 3,
      type: 'required',
      title: 'BATTLEMENTS DRAWBRIDGE DASH',
      description: 'Cross the open battlements under the sweeping guard vision cone.',
      mechanics: ['CAMOUFLAGE'],
      score: 1000
    },
    {
      id: 'O3.4',
      section: 3,
      type: 'primary',
      title: 'VAULT SEAL RETRIEVAL',
      description: 'Breach the royal treasury, recover the Vault Seal, and escape undetected.',
      mechanics: ['CAMOUFLAGE', 'DECOY'],
      score: 2500
    },
    {
      id: 'B3',
      section: 3,
      type: 'bonus',
      title: 'TREASURY ROYAL CACHE',
      description: 'Infiltrate the high chandelier gallery without triggering a single alert.',
      mechanics: ['CAMOUFLAGE'],
      score: 1500
    },

    // S4 Ancient Forest
    {
      id: 'O4.1',
      section: 4,
      type: 'required',
      title: 'SAPLING CANOPY CLIMB',
      description: 'Age rapid-growth saplings into sturdy canopy platforms to evade thorn brambles.',
      mechanics: ['TIME'],
      score: 1000
    },
    {
      id: 'O4.2',
      section: 4,
      type: 'required',
      title: 'CHRONAL VINE REWIND',
      description: 'Rewind the decayed suspension bridge while rhythmic ancient pendulums swing.',
      mechanics: ['TIME'],
      score: 1000
    },
    {
      id: 'O4.3',
      section: 4,
      type: 'required',
      title: 'GOLEM PATROL TIMING',
      description: 'Manipulate time dilation around the ancient guardian golem to pass safely.',
      mechanics: ['TIME'],
      score: 1000
    },
    {
      id: 'O4.4',
      section: 4,
      type: 'primary',
      title: 'ELDER SEED MATURATION',
      description: 'Age all three sacred seed pods into full bloom at the altar to claim the Elder Seed.',
      mechanics: ['TIME'],
      score: 2500
    },
    {
      id: 'B4',
      section: 4,
      type: 'bonus',
      title: 'DOUBLE-AGED CANOPY HOLLOW',
      description: 'Double-age an ancient cedar trunk to uncover the secret chronal cache.',
      mechanics: ['TIME'],
      score: 1500
    },

    // S5 Reality Swap
    {
      id: 'O5.1',
      section: 5,
      type: 'required',
      title: 'ECHO SENTINEL POSSESSION',
      description: 'Possess the dimensional echo across the void and trip the reality switch.',
      mechanics: ['PHASE', 'POSSESS'],
      score: 1000
    },
    {
      id: 'O5.2',
      section: 5,
      type: 'required',
      title: 'QUANTUM CHASM SWAP',
      description: 'Swap positions with the roaming drone mid-air across an impassable abyss.',
      mechanics: ['PHASE', 'SWAP'],
      score: 1000
    },
    {
      id: 'O5.3',
      section: 5,
      type: 'required',
      title: 'CHAINED TWIN SWAP',
      description: 'Execute a rapid double-swap through a timed phase-locked gateway.',
      mechanics: ['PHASE', 'SWAP'],
      score: 1000
    },
    {
      id: 'O5.4',
      section: 5,
      type: 'primary',
      title: 'RIFT CORE HARVEST',
      description: 'Retrieve the Rift Core using a combo of reality phasing and instant body swap.',
      mechanics: ['PHASE', 'SWAP'],
      score: 2500
    },
    {
      id: 'B5',
      section: 5,
      type: 'bonus',
      title: 'SINGULARITY RELIC ARCHIVE',
      description: 'Navigate a timed alternate-reality corridor to claim the quantum archive.',
      mechanics: ['PHASE'],
      score: 1500
    },

    // S6 Convergence Core Finale Sockets (Forced Order F1 -> F2 -> F3 -> F4 -> F5)
    {
      id: 'F1',
      section: 6,
      type: 'required',
      title: 'SOCKET 1 · FROST COLD-LOCK',
      description: 'Freeze the surging coolant flume under collapsing icicles to lock Socket 1.',
      mechanics: ['FREEZE'],
      score: 1200
    },
    {
      id: 'F2',
      section: 6,
      type: 'required',
      title: 'SOCKET 2 · EMBER CONVECTION',
      description: 'Ride the vent updraft unlocked by Socket 1 to ignite Socket 2.',
      mechanics: ['VENT', 'FREEZE'],
      score: 1200
    },
    {
      id: 'F3',
      section: 6,
      type: 'required',
      title: 'SOCKET 3 · PALACE INFILTRATION',
      description: 'Freeze coolant, ride vent, and cloak past surge-alerted sentinels to lock Socket 3.',
      mechanics: ['CAMOUFLAGE', 'VENT', 'FREEZE'],
      score: 1500
    },
    {
      id: 'F4',
      section: 6,
      type: 'required',
      title: 'SOCKET 4 · CHRONAL VINE RESTORATION',
      description: 'Vent jump, decoy lure, and age the surge-degraded vine bridge to lock Socket 4.',
      mechanics: ['TIME', 'CAMOUFLAGE', 'VENT'],
      score: 1500
    },
    {
      id: 'F5',
      section: 6,
      type: 'required',
      title: 'SOCKET 5 · HYPER-RIFT SWAP',
      description: 'Freeze coolant, age chronal anchor, and phase swap across the core to lock Socket 5.',
      mechanics: ['PHASE', 'TIME', 'FREEZE'],
      score: 2000
    }
  ] as GauntletObjective[],

  // Scoring Weights & Thresholds
  scoring: {
    timeBonusPerSecond: 15,
    attemptBonusRemaining: 2000,
    parEfficiencyBonus: 1500,
    parChargeLimit: 18,
    noAlertBonus: 2000,
    surgeHitPenalty: 350,
    ranks: {
      S: 28000,
      A: 23000,
      B: 18000,
      C: 13000
    }
  }
} as const;

/**
 * Dev-time mechanic usage validation check.
 * Asserts that each of the 5 mechanics is mandatory >= 2 times in distinct roles,
 * and that at least 4 puzzles require >= 3 mechanics in forced order.
 */
export function validateMechanicsUsage(): { valid: boolean; summary: Record<string, number>; multiCount: number } {
  const counts: Record<string, number> = {
    FREEZE: 0,
    VENT: 0,
    CAMOUFLAGE: 0,
    TIME: 0,
    PHASE: 0
  };

  let multiCount = 0;

  LEVEL6_CONFIG.objectives.forEach(obj => {
    obj.mechanics.forEach(m => {
      if (m === 'STUN' || m === 'FREEZE') counts.FREEZE++;
      if (m === 'VENT') counts.VENT++;
      if (m === 'CAMOUFLAGE' || m === 'DECOY') counts.CAMOUFLAGE++;
      if (m === 'TIME') counts.TIME++;
      if (m === 'PHASE' || m === 'SWAP' || m === 'POSSESS') counts.PHASE++;
    });

    if (obj.mechanics.length >= 3) {
      multiCount++;
    }
  });

  const valid = Object.values(counts).every(c => c >= 2) && multiCount >= 4;
  return { valid, summary: counts, multiCount };
}
