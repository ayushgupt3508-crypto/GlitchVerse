import Phaser from 'phaser';
import { ChargeManager } from './ChargeManager';
import { IStaffInteractable, StaffInteractionContext } from './IStaffInteractable';
import { StaffConfig, DEFAULT_STAFF_CONFIG } from '../../config/staffConfig';
import { AudioManager } from '../AudioManager';

/**
 * Interface for HUD implementations receiving charge & warning updates.
 */
export interface IHudChargeDisplay {
  updateCharges(current: number, max?: number): void;
  showBanner?(message: string): void;
  flashChargeWarning?(): void;
}

export type AbilityExecutionHandler = (
  ability: string,
  target: IStaffInteractable | null,
  context: StaffInteractionContext
) => boolean;

export interface StaffControllerOptions {
  config?: StaffConfig;
  chargeManager?: ChargeManager;
  initialAbilities?: string[];
  defaultSelected?: string;
  interactionRange?: number;
}

/**
 * StaffController — Universal input & ability execution system for Vance's Quantum Staff.
 *
 * Responsibilities:
 *  • Handles player input: activation key ([E], [J]), ability cycling ([TAB], [Q]).
 *  • Tracks equipped/selected ability from a list of unlocked abilities.
 *  • Manages in-scene interactable registry (`IStaffInteractable`).
 *  • Discovers nearest valid targets within interaction range.
 *  • Coordinates with `ChargeManager` for cost deduction and insufficient-charge feedback.
 *  • Bridges cleanly to `HUD` charge indicators via a decoupled hook.
 *  • Completely modular: ZERO level-specific logic.
 */
export class StaffController extends Phaser.Events.EventEmitter {
  public readonly scene: Phaser.Scene;
  public readonly chargeManager: ChargeManager;
  private readonly config: StaffConfig;

  // Ability state
  private availableAbilities: string[] = [];
  private selectedAbilityIndex = 0;
  private cooldownTimers: Map<string, number> = new Map();

  // Targets
  private interactables: Set<IStaffInteractable> = new Set();
  public interactionRange: number;

  // Ability execution delegates (for self-cast abilities like Camouflage or Phasing)
  private abilityHandlers: Map<string, AbilityExecutionHandler> = new Map();

  // Input Keys
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyJ?: Phaser.Input.Keyboard.Key;
  private keyTab?: Phaser.Input.Keyboard.Key;
  private keyQ?: Phaser.Input.Keyboard.Key;

  // Active HUD connection
  private connectedHud?: IHudChargeDisplay;

  constructor(scene: Phaser.Scene, options?: StaffControllerOptions) {
    super();
    this.scene = scene;
    this.config = options?.config ?? DEFAULT_STAFF_CONFIG;
    this.chargeManager = options?.chargeManager ?? new ChargeManager(this.config);
    this.interactionRange = options?.interactionRange ?? 95;

    // Initialize abilities
    if (options?.initialAbilities && options.initialAbilities.length > 0) {
      this.availableAbilities = [...options.initialAbilities];
    } else {
      this.availableAbilities = ['STUN'];
    }

    if (options?.defaultSelected) {
      this.selectAbility(options.defaultSelected);
    }

    this.setupInput();
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;

    this.keyE = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyJ = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyTab = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyQ = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // Prevent TAB default browser behavior (switching focus outside canvas)
    this.scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
  }

  // ── Ability Selection & Cycling ──────────────────────────────────────────

  public getSelectedAbility(): string {
    return this.availableAbilities[this.selectedAbilityIndex] ?? 'NONE';
  }

  public getAvailableAbilities(): readonly string[] {
    return this.availableAbilities;
  }

  public addAbility(ability: string, selectIfFirst = true): void {
    if (!this.availableAbilities.includes(ability)) {
      this.availableAbilities.push(ability);
      if (selectIfFirst && this.availableAbilities.length === 1) {
        this.selectAbility(ability);
      }
    }
  }

  public removeAbility(ability: string): void {
    const idx = this.availableAbilities.indexOf(ability);
    if (idx !== -1) {
      this.availableAbilities.splice(idx, 1);
      if (this.selectedAbilityIndex >= this.availableAbilities.length) {
        this.selectedAbilityIndex = Math.max(0, this.availableAbilities.length - 1);
      }
      this.emit('ability_selected', this.getSelectedAbility());
    }
  }

  public selectAbility(ability: string): boolean {
    const idx = this.availableAbilities.indexOf(ability);
    if (idx !== -1) {
      const prev = this.getSelectedAbility();
      this.selectedAbilityIndex = idx;
      this.emit('ability_selected', ability, prev);
      return true;
    }
    return false;
  }

  public cycleAbility(direction: 1 | -1 = 1): string {
    if (this.availableAbilities.length <= 1) {
      return this.getSelectedAbility();
    }
    const prev = this.getSelectedAbility();
    const len = this.availableAbilities.length;
    this.selectedAbilityIndex = (this.selectedAbilityIndex + direction + len) % len;
    const current = this.getSelectedAbility();
    AudioManager.playMenuHover();
    this.emit('ability_selected', current, prev);
    return current;
  }

  // ── Interactable Registry ────────────────────────────────────────────────

  public registerInteractable(target: IStaffInteractable): void {
    this.interactables.add(target);
  }

  public unregisterInteractable(target: IStaffInteractable): void {
    this.interactables.delete(target);
  }

  public clearInteractables(): void {
    this.interactables.clear();
  }

  public findNearestInteractable(
    x: number,
    y: number,
    ability?: string,
    maxRange?: number
  ): IStaffInteractable | null {
    const targetAbility = ability ?? this.getSelectedAbility();
    const limit = maxRange ?? this.interactionRange;

    let nearest: IStaffInteractable | null = null;
    let minDist = limit;

    this.interactables.forEach(target => {
      // Check if target supports this ability
      if (!target.supportedAbilities.includes(targetAbility)) return;

      const effectiveRadius = target.interactionRadius ?? limit;
      const dist = Phaser.Math.Distance.Between(x, y, target.x, target.y);

      if (dist <= effectiveRadius && dist < minDist) {
        if (!target.canInteract || target.canInteract(targetAbility)) {
          minDist = dist;
          nearest = target;
        }
      }
    });

    return nearest;
  }

  // ── Ability Handlers (Self-Cast / Delegation) ─────────────────────────────

  public registerAbilityHandler(ability: string, handler: AbilityExecutionHandler): void {
    this.abilityHandlers.set(ability, handler);
  }

  public removeAbilityHandler(ability: string): void {
    this.abilityHandlers.delete(ability);
  }

  // ── Ability Activation ───────────────────────────────────────────────────

  /**
   * Check if the selected ability can be executed from the given position.
   */
  public canActivate(
    sourceX: number,
    sourceY: number,
    target?: IStaffInteractable | null
  ): { canActivate: boolean; reason?: string; target?: IStaffInteractable | null } {
    const ability = this.getSelectedAbility();

    // Check cooldown
    const cd = this.cooldownTimers.get(ability) ?? 0;
    if (cd > 0) {
      return { canActivate: false, reason: 'COOLDOWN' };
    }

    // Check charge
    const cost = this.chargeManager.getCost(ability);
    if (!this.chargeManager.hasCharge(cost)) {
      return { canActivate: false, reason: 'INSUFFICIENT_CHARGE' };
    }

    // If an explicit target was provided, verify it
    if (target) {
      if (!target.supportedAbilities.includes(ability)) {
        return { canActivate: false, reason: 'TARGET_INCOMPATIBLE' };
      }
      return { canActivate: true, target };
    }

    // Check for nearby interactable target
    const nearest = this.findNearestInteractable(sourceX, sourceY, ability);
    if (nearest) {
      return { canActivate: true, target: nearest };
    }

    // If no interactable target, check if a self-cast ability handler is registered
    if (this.abilityHandlers.has(ability)) {
      return { canActivate: true, target: null };
    }

    return { canActivate: false, reason: 'NO_TARGET_IN_RANGE' };
  }

  /**
   * Execute the staff ability.
   * Returns true if charge was consumed and action executed.
   */
  public activate(
    sourceX: number,
    sourceY: number,
    customTarget?: IStaffInteractable | null
  ): boolean {
    const ability = this.getSelectedAbility();
    const cost = this.chargeManager.getCost(ability);

    // Verify cooldown
    const cd = this.cooldownTimers.get(ability) ?? 0;
    if (cd > 0) {
      return false;
    }

    // Check if charges are sufficient
    if (!this.chargeManager.hasCharge(cost)) {
      this.chargeManager.triggerInsufficientFeedback(ability, cost);
      this.emit('activation_failed', 'INSUFFICIENT_CHARGE', ability);
      return false;
    }

    // Resolve target or self-ability handler
    const target = customTarget ?? this.findNearestInteractable(sourceX, sourceY, ability);
    const handler = this.abilityHandlers.get(ability);

    const context: StaffInteractionContext = {
      sourceX,
      sourceY,
      ability,
      energyCost: cost
    };

    let executed = false;

    // Case A: Target interactable handles ability
    if (target && target.supportedAbilities.includes(ability)) {
      executed = target.onAbilityApplied(ability, context);
    }
    // Case B: Registered custom ability handler (self-cast / area)
    else if (handler) {
      executed = handler(ability, target, context);
    }

    if (executed) {
      // Consume charge
      this.chargeManager.consumeCharge(cost, { ability, targetId: target?.id });

      // Apply cooldown
      const cdTime = this.config.cooldownsMs?.[ability] ?? 300;
      this.cooldownTimers.set(ability, cdTime);

      // Play SFX
      AudioManager.playStaffUse();

      this.emit('ability_activated', {
        ability,
        cost,
        target,
        remainingCharges: this.chargeManager.getCharges()
      });
      return true;
    } else {
      this.emit('activation_failed', 'EXECUTION_REJECTED', ability);
      return false;
    }
  }

  // ── Input & Cooldown Loop ────────────────────────────────────────────────

  public update(delta: number, sourceX: number, sourceY: number): void {
    // Tick cooldown timers
    this.cooldownTimers.forEach((timer, key) => {
      if (timer > 0) {
        this.cooldownTimers.set(key, Math.max(0, timer - delta));
      }
    });

    // Check ability cycle inputs
    const cycleNext = this.keyTab ? Phaser.Input.Keyboard.JustDown(this.keyTab) : false;
    const cyclePrev = this.keyQ ? Phaser.Input.Keyboard.JustDown(this.keyQ) : false;

    if (cycleNext) {
      this.cycleAbility(1);
    } else if (cyclePrev && this.availableAbilities.length > 1) {
      this.cycleAbility(-1);
    }

    // Check ability activation input
    const activatePressed =
      (this.keyE ? Phaser.Input.Keyboard.JustDown(this.keyE) : false) ||
      (this.keyJ ? Phaser.Input.Keyboard.JustDown(this.keyJ) : false);

    if (activatePressed) {
      this.activate(sourceX, sourceY);
    }
  }

  // ── HUD Hook ─────────────────────────────────────────────────────────────

  /**
   * Connect an external HUD display to receive automatic charge updates
   * and warning notifications.
   */
  public connectHud(hud: IHudChargeDisplay): void {
    this.connectedHud = hud;

    // Initial sync
    hud.updateCharges(this.chargeManager.getCharges(), this.chargeManager.getMaxCharges());

    // Listen to charge updates
    this.chargeManager.on('charge_changed', (curr: number, max: number) => {
      hud.updateCharges(curr, max);
    });

    // Listen to insufficient-charge warnings
    this.chargeManager.on('charge_insufficient', (evt: { ability: string; needed: number }) => {
      if (hud.flashChargeWarning) {
        hud.flashChargeWarning();
      }
      if (hud.showBanner) {
        const msg = this.config.insufficientChargeFeedback?.bannerMessage ??
          `INSUFFICIENT CHARGE FOR ${evt.ability}! (NEED ${evt.needed})`;
        hud.showBanner(msg);
      }
    });
  }

  public getConnectedHud(): IHudChargeDisplay | undefined {
    return this.connectedHud;
  }

  public destroy(): void {
    this.removeAllListeners();
    this.chargeManager.destroy();
    this.interactables.clear();
    this.abilityHandlers.clear();
  }
}
