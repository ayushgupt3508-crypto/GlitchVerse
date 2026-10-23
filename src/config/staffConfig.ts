/**
 * Standard ability identifiers supported across sectors.
 * Can be extended with custom strings.
 */
export type StandardAbilityType = 'STUN' | 'CAMOUFLAGE' | 'EMP' | 'PHASE' | 'TIME';
export type AbilityIdentifier = StandardAbilityType | string;

export interface StaffConfig {
  /** Maximum number of energy charges the staff can store (configurable per sector/mode) */
  maxCharges: number;

  /** Initial number of charges when spawned/respawned (defaults to maxCharges) */
  initialCharges?: number;

  /** Energy cost required per ability activation */
  costs: Record<string, number>;

  /** Optional cooldown in milliseconds before ability can be re-triggered */
  cooldownsMs?: Record<string, number>;

  /** Feedback configuration for charge failure */
  insufficientChargeFeedback?: {
    bannerMessage: string;
    bannerDurationMs: number;
    playAudio: boolean;
    flashWarning: boolean;
  };
}

export const DEFAULT_STAFF_CONFIG: StaffConfig = {
  maxCharges: 3,
  initialCharges: 3,
  costs: {
    STUN: 1,
    CAMOUFLAGE: 2,
    EMP: 1,
    PHASE: 1,
    TIME: 1
  },
  cooldownsMs: {
    STUN: 300,
    CAMOUFLAGE: 2000,
    EMP: 300,
    PHASE: 400,
    TIME: 350
  },
  insufficientChargeFeedback: {
    bannerMessage: 'INSUFFICIENT STAFF CHARGE!',
    bannerDurationMs: 1600,
    playAudio: true,
    flashWarning: true
  }
};

export function createStaffConfig(overrides?: Partial<StaffConfig>): StaffConfig {
  return {
    ...DEFAULT_STAFF_CONFIG,
    ...overrides,
    costs: {
      ...DEFAULT_STAFF_CONFIG.costs,
      ...(overrides?.costs || {})
    },
    cooldownsMs: {
      ...DEFAULT_STAFF_CONFIG.cooldownsMs,
      ...(overrides?.cooldownsMs || {})
    },
    insufficientChargeFeedback: {
      ...DEFAULT_STAFF_CONFIG.insufficientChargeFeedback!,
      ...(overrides?.insufficientChargeFeedback || {})
    }
  };
}
