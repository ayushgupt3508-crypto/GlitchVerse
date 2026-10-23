import Phaser from 'phaser';
import { StaffConfig, DEFAULT_STAFF_CONFIG } from '../../config/staffConfig';
import { AudioManager } from '../AudioManager';

export interface InsufficientChargeEvent {
  ability: string;
  needed: number;
  current: number;
}

export interface RefillSourceRecord {
  sourceId: string;
  amountRefilled: number;
  timestamp: number;
}

/**
 * ChargeManager — Manages energy charges for Vance's Quantum Staff.
 *
 * Responsibilities:
 *  • Tracks current and maximum charge capacities (fully configurable).
 *  • Enforces per-ability costs and handles charge deductions.
 *  • Manages charge refill sources (conduits, pickups, checkpoints).
 *  • Dispatches insufficient-charge feedback (events, audio, HUD signals).
 *  • Emits standardized events for UI/HUD hooks.
 *
 * No level-specific logic.
 */
export class ChargeManager extends Phaser.Events.EventEmitter {
  private maxCharges: number;
  private currentCharges: number;
  private costs: Map<string, number>;
  private readonly config: StaffConfig;
  private refillHistory: RefillSourceRecord[] = [];

  constructor(config: StaffConfig = DEFAULT_STAFF_CONFIG) {
    super();
    this.config = config;
    this.maxCharges = Math.max(1, config.maxCharges);
    this.currentCharges = Math.min(this.maxCharges, config.initialCharges ?? this.maxCharges);

    this.costs = new Map<string, number>();
    Object.entries(config.costs).forEach(([ability, cost]) => {
      this.costs.set(ability, cost);
    });
  }

  public getCharges(): number {
    return this.currentCharges;
  }

  public getMaxCharges(): number {
    return this.maxCharges;
  }

  public setMaxCharges(max: number, refillToMax = false): void {
    this.maxCharges = Math.max(1, max);
    if (refillToMax) {
      this.currentCharges = this.maxCharges;
    } else {
      this.currentCharges = Math.min(this.currentCharges, this.maxCharges);
    }
    this.emit('charge_changed', this.currentCharges, this.maxCharges);
  }

  public getCost(ability: string): number {
    return this.costs.get(ability) ?? 1;
  }

  public setCost(ability: string, cost: number): void {
    this.costs.set(ability, Math.max(0, cost));
  }

  /**
   * Check if there are sufficient charges for a given cost or ability name.
   */
  public hasCharge(costOrAbility: number | string): boolean {
    const cost = typeof costOrAbility === 'number' ? costOrAbility : this.getCost(costOrAbility);
    return this.currentCharges >= cost;
  }

  /**
   * Attempt to consume charges. Returns true on success, false if insufficient.
   */
  public consumeCharge(costOrAbility: number | string, context?: any): boolean {
    const abilityName = typeof costOrAbility === 'string' ? costOrAbility : undefined;
    const cost = typeof costOrAbility === 'number' ? costOrAbility : this.getCost(costOrAbility);

    if (this.currentCharges < cost) {
      this.triggerInsufficientFeedback(abilityName ?? 'ACTION', cost);
      return false;
    }

    this.currentCharges -= cost;
    this.emit('charge_consumed', cost, this.currentCharges, abilityName, context);
    this.emit('charge_changed', this.currentCharges, this.maxCharges);
    return true;
  }

  /**
   * Refill a specified amount of charges from an identified source.
   * Returns actual amount added.
   */
  public refill(amount: number, sourceId = 'generic'): number {
    if (amount <= 0) return 0;
    const prev = this.currentCharges;
    this.currentCharges = Math.min(this.maxCharges, this.currentCharges + amount);
    const added = this.currentCharges - prev;

    if (added > 0) {
      this.refillHistory.push({
        sourceId,
        amountRefilled: added,
        timestamp: Date.now()
      });
      this.emit('charge_refilled', added, this.currentCharges, sourceId);
      this.emit('charge_changed', this.currentCharges, this.maxCharges);
    }

    return added;
  }

  /**
   * Fully restore charges to max capacity.
   */
  public refillMax(sourceId = 'conduit_full'): number {
    return this.refill(this.maxCharges - this.currentCharges, sourceId);
  }

  /**
   * Directly set current charges (clamped between 0 and max).
   */
  public setCharges(charges: number): void {
    this.currentCharges = Phaser.Math.Clamp(charges, 0, this.maxCharges);
    this.emit('charge_changed', this.currentCharges, this.maxCharges);
  }

  /**
   * Trigger feedback when player tries to use an ability without sufficient energy.
   */
  public triggerInsufficientFeedback(ability: string, needed: number): void {
    const event: InsufficientChargeEvent = {
      ability,
      needed,
      current: this.currentCharges
    };

    if (this.config.insufficientChargeFeedback?.playAudio) {
      AudioManager.playInsufficientCharge();
    }

    this.emit('charge_insufficient', event);
  }

  public getRefillHistory(): readonly RefillSourceRecord[] {
    return this.refillHistory;
  }

  public destroy(): void {
    this.removeAllListeners();
    this.refillHistory = [];
  }
}
