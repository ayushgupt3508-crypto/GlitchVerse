/**
 * Context passed to interactables upon staff application.
 */
export interface StaffInteractionContext {
  sourceX: number;
  sourceY: number;
  ability: string;
  energyCost: number;
  payload?: any;
}

/**
 * Interface for any entity, object, or mechanism in the world
 * that reacts to the Staff's energy discharges and abilities.
 * Zero level-specific coupling.
 */
export interface IStaffInteractable {
  /** Optional identifier for debugging or graph mapping */
  readonly id?: string;

  /** World coordinate X */
  readonly x: number;

  /** World coordinate Y */
  readonly y: number;

  /** Custom interaction radius in pixels (falls back to StaffController default) */
  readonly interactionRadius?: number;

  /** List of abilities this object can receive/respond to */
  readonly supportedAbilities: readonly string[];

  /** Optional check whether interaction is currently permitted */
  canInteract?(ability: string, context?: StaffInteractionContext): boolean;

  /**
   * Invoked when the staff applies an ability to this interactable.
   * Returns true if successfully triggered/handled, false otherwise.
   */
  onAbilityApplied(ability: string, context?: StaffInteractionContext): boolean;
}
