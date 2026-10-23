import Phaser from 'phaser';
import { IStaffInteractable, StaffInteractionContext } from '../staff/IStaffInteractable';
import { AudioManager } from '../AudioManager';

/**
 * Supported time manipulation actions.
 */
export type TimeManipAction = 'FREEZE' | 'REWIND' | 'RESTORE' | 'TOGGLE';

/**
 * State record representing an object's discrete temporal snapshots.
 */
export interface TimeStateDefinition {
  name: string;
  isSolid: boolean;
  canDamage: boolean;
  description: string;
}

/**
 * The core State-Machine interface for any entity or mechanism
 * that responds to the Time Ability within a localized radius.
 * No universal timeline simulation is needed; each object deterministically
 * transitions between predefined semantic states.
 */
export interface ITimeStateObject extends IStaffInteractable {
  readonly id: string;
  readonly currentState: string;
  readonly defaultState: string;
  readonly isTimeFrozen: boolean;

  /**
   * Apply a temporal manipulation action to this object.
   * Returns true if the state successfully changed or frozen.
   */
  applyTimeAction(action: TimeManipAction, durationMs?: number): boolean;

  /**
   * Check whether this object can be affected by the given action.
   */
  canApplyTimeAction(action: TimeManipAction): boolean;

  /**
   * Fetch visual position and bounds for blue trail and chronos afterimage effects.
   */
  getBounds(): Phaser.Geom.Rectangle;

  /**
   * Per-frame update for temporal decays, stasis timers, and physics synchronization.
   */
  update(time: number, delta: number): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concrete Implementations for Ancient Forest (Level 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BrokenBridgeSection — Collapsed wooden rope bridge sections across deep ravines.
 * States: 'COLLAPSED' (slumped/broken, non-solid) <---> 'RESTORED' (taut, solid plank).
 * Decays back to 'COLLAPSED' after duration unless frozen or renewed.
 */
export class BrokenBridgeSection implements ITimeStateObject {
  public readonly id: string;
  public readonly x: number;
  public readonly y: number;
  public readonly interactionRadius = 140;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentState: 'COLLAPSED' | 'RESTORED' = 'COLLAPSED';
  public readonly defaultState = 'COLLAPSED';
  public isTimeFrozen = false;

  private freezeTimer = 0;
  private decayTimer = 0;
  private readonly DECAY_DURATION = 6500; // 6.5s to cross before collapse

  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly solidBody: Phaser.Physics.Arcade.Body;
  private readonly scene: Phaser.Scene;
  private readonly afterimages: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, startRestored = false) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;

    // Sprite representation (wooden planks with rope anchors)
    this.sprite = scene.add.sprite(x, y, 'proto_tile')
      .setDisplaySize(72, 16)
      .setDepth(10);

    // Physics body
    scene.physics.add.existing(this.sprite, false);
    this.solidBody = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.solidBody.setImmovable(true);
    this.solidBody.setAllowGravity(false);

    this.afterimages = scene.add.graphics().setDepth(9);

    if (startRestored) {
      this.setRestoredVisuals();
      this.currentState = 'RESTORED';
      this.solidBody.enable = true;
    } else {
      this.setCollapsedVisuals();
      this.currentState = 'COLLAPSED';
      this.solidBody.enable = false;
    }
  }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(ability: string, _ctx?: StaffInteractionContext): boolean {
    if (ability === 'TIME' || ability === 'STAFF_ACTION') {
      return this.applyTimeAction('TOGGLE');
    }
    return false;
  }

  public canApplyTimeAction(_action: TimeManipAction): boolean {
    return true;
  }

  public applyTimeAction(action: TimeManipAction, durationMs = 5000): boolean {
    if (action === 'FREEZE') {
      this.isTimeFrozen = true;
      this.freezeTimer = durationMs;
      AudioManager.playTimeFreeze();
      this.spawnChronoSparks(0x00f0ff);
      return true;
    }

    if (action === 'REWIND' || action === 'RESTORE' || action === 'TOGGLE') {
      if (this.currentState === 'COLLAPSED') {
        this.currentState = 'RESTORED';
        this.solidBody.enable = true;
        this.decayTimer = this.DECAY_DURATION;
        this.isTimeFrozen = false;
        AudioManager.playTimeRewind();
        AudioManager.playWoodCreak();
        this.spawnTemporalAfterimage();
        this.setRestoredVisuals();
        return true;
      } else {
        // If already restored, rewind refreshes timer & freezes it briefly
        this.decayTimer = this.DECAY_DURATION;
        this.isTimeFrozen = true;
        this.freezeTimer = 2500;
        AudioManager.playTimeFreeze();
        this.spawnChronoSparks(0xd4af37);
        return true;
      }
    }

    return false;
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 36, this.y - 8, 72, 16);
  }

  public update(_time: number, delta: number): void {
    if (this.isTimeFrozen) {
      this.freezeTimer -= delta;
      this.drawTemporalAura(true);
      if (this.freezeTimer <= 0) {
        this.isTimeFrozen = false;
      }
      return;
    }

    if (this.currentState === 'RESTORED') {
      this.decayTimer -= delta;
      this.drawTemporalAura(false);

      // Warning flicker when decaying
      if (this.decayTimer < 2000) {
        this.sprite.setAlpha(0.45 + 0.55 * Math.sin(this.decayTimer * 0.02));
      }

      if (this.decayTimer <= 0) {
        this.currentState = 'COLLAPSED';
        this.solidBody.enable = false;
        this.setCollapsedVisuals();
        AudioManager.playWoodCreak();
        this.afterimages.clear();
      }
    } else {
      this.afterimages.clear();
    }
  }

  private setRestoredVisuals(): void {
    this.sprite.setTint(0x8b5a2b); // rich oak wood
    this.sprite.setAngle(0);
    this.sprite.setAlpha(1);
    this.sprite.y = this.y;
    this.solidBody.reset(this.x, this.y);
  }

  private setCollapsedVisuals(): void {
    this.sprite.setTint(0x3e2723); // dark collapsed rotten wood
    this.sprite.setAngle(18); // tilted down into chasm
    this.sprite.setAlpha(0.38);
    this.sprite.y = this.y + 16;
    this.solidBody.reset(this.x, this.y + 16);
  }

  private spawnTemporalAfterimage(): void {
    // Blue trail & echo animation
    for (let i = 0; i < 3; i++) {
      const ghost = this.scene.add.sprite(this.x, this.y + 16 - i * 5, 'proto_tile')
        .setDisplaySize(72, 16)
        .setTint(0x00f0ff)
        .setAlpha(0.7 - i * 0.2)
        .setDepth(8);

      this.scene.tweens.add({
        targets: ghost,
        y: this.y,
        alpha: 0,
        duration: 400 + i * 150,
        ease: 'Cubic.easeOut',
        onComplete: () => ghost.destroy()
      });
    }
  }

  private spawnChronoSparks(tint: number): void {
    const emitter = this.scene.add.particles(this.x, this.y, 'proto_tile', {
      speed: { min: 40, max: 120 },
      scale: { start: 0.35, end: 0 },
      tint: [tint, 0x00f0ff, 0xffffff],
      lifespan: 500,
      quantity: 12
    });
    this.scene.time.delayedCall(550, () => emitter.destroy());
  }

  private drawTemporalAura(isFrozen: boolean): void {
    this.afterimages.clear();
    this.afterimages.lineStyle(1.5, isFrozen ? 0x00f0ff : 0xd4af37, 0.7);
    this.afterimages.strokeRoundedRect(this.x - 38, this.y - 10, 76, 20, 3);
  }
}

/**
 * TimeMovingPlatform — Platform that oscillates across chasms/canopies.
 * States: 'MOVING' <---> 'FROZEN'.
 * Freezing halts it dead in mid-air as a static stepping stone.
 */
export class TimeMovingPlatform implements ITimeStateObject {
  public readonly id: string;
  public get x(): number { return this.sprite ? this.sprite.x : this.startX; }
  public get y(): number { return this.sprite ? this.sprite.y : this.startY; }
  public readonly interactionRadius = 150;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentState: 'MOVING' | 'FROZEN' = 'MOVING';
  public readonly defaultState = 'MOVING';
  public isTimeFrozen = false;

  private freezeTimer = 0;
  private readonly startX: number;
  private readonly endX: number;
  private readonly startY: number;
  private readonly speed: number;
  private direction = 1;

  public readonly sprite: Phaser.GameObjects.Sprite;
  public readonly solidBody: Phaser.Physics.Arcade.Body;
  private readonly scene: Phaser.Scene;
  private readonly trailGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: string, startX: number, endX: number, y: number, speed = 65) {
    this.scene = scene;
    this.id = id;
    this.startX = startX;
    this.endX = endX;
    this.startY = y;
    this.speed = speed;

    this.sprite = scene.add.sprite(startX, y, 'proto_tile')
      .setDisplaySize(80, 16)
      .setTint(0x52b788) // Mossy stone slab
      .setDepth(10);

    scene.physics.add.existing(this.sprite, false);
    this.solidBody = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.solidBody.setImmovable(true);
    this.solidBody.setAllowGravity(false);
    this.solidBody.setVelocityX(speed);

    this.trailGfx = scene.add.graphics().setDepth(7);
  }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(ability: string): boolean {
    if (ability === 'TIME' || ability === 'STAFF_ACTION') {
      return this.applyTimeAction('TOGGLE');
    }
    return false;
  }

  public canApplyTimeAction(): boolean {
    return true;
  }

  public applyTimeAction(action: TimeManipAction, durationMs = 5000): boolean {
    if (action === 'FREEZE' || (action === 'TOGGLE' && this.currentState === 'MOVING')) {
      this.currentState = 'FROZEN';
      this.isTimeFrozen = true;
      this.freezeTimer = durationMs;
      this.solidBody.setVelocityX(0);
      AudioManager.playTimeFreeze();
      this.sprite.setTint(0x00f0ff);
      this.spawnAfterimageRing();
      return true;
    } else if (action === 'REWIND' || action === 'RESTORE' || (action === 'TOGGLE' && this.currentState === 'FROZEN')) {
      this.currentState = 'MOVING';
      this.isTimeFrozen = false;
      this.direction = (action === 'REWIND') ? -this.direction : this.direction;
      this.solidBody.setVelocityX(this.speed * this.direction);
      AudioManager.playTimeRewind();
      this.sprite.setTint(0x52b788);
      return true;
    }
    return false;
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 40, this.sprite.y - 8, 80, 16);
  }

  public update(_time: number, delta: number): void {
    if (this.isTimeFrozen) {
      this.freezeTimer -= delta;
      this.solidBody.setVelocityX(0);
      this.drawFrozenGhost();
      if (this.freezeTimer <= 0) {
        this.applyTimeAction('RESTORE');
      }
      return;
    }

    this.trailGfx.clear();

    // Patrol back and forth
    if (this.sprite.x >= this.endX && this.direction > 0) {
      this.direction = -1;
      this.solidBody.setVelocityX(-this.speed);
    } else if (this.sprite.x <= this.startX && this.direction < 0) {
      this.direction = 1;
      this.solidBody.setVelocityX(this.speed);
    }
  }

  private drawFrozenGhost(): void {
    this.trailGfx.clear();
    this.trailGfx.lineStyle(1.5, 0x00f0ff, 0.7);
    this.trailGfx.strokeRoundedRect(this.sprite.x - 42, this.sprite.y - 10, 84, 20, 4);

    // Stasis lock glyph
    this.trailGfx.fillStyle(0x00f0ff, 0.2);
    this.trailGfx.fillCircle(this.sprite.x, this.sprite.y, 6);
  }

  private spawnAfterimageRing(): void {
    const ring = this.scene.add.graphics().setDepth(8);
    ring.lineStyle(2, 0x00f0ff, 0.9);
    ring.strokeCircle(this.sprite.x, this.sprite.y, 20);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }
}

/**
 * FallingBranch — Heavy ancient branch/debris in the canopy.
 * States: 'HELD' (resting in canopy) ---> 'FALLING' (drops on player) ---> 'REWOUND' (returns up).
 */
export class FallingBranch implements ITimeStateObject {
  public readonly id: string;
  public get x(): number { return this.sprite ? this.sprite.x : this.originX; }
  public get y(): number { return this.sprite ? this.sprite.y : this.originY; }
  public readonly interactionRadius = 140;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentState: 'HELD' | 'FALLING' | 'GROUNDED' | 'FROZEN' = 'HELD';
  public readonly defaultState = 'HELD';
  public isTimeFrozen = false;

  private readonly originX: number;
  private readonly originY: number;
  private readonly targetY: number;
  public readonly sprite: Phaser.GameObjects.Sprite;
  public readonly solidBody: Phaser.Physics.Arcade.Body;
  private readonly scene: Phaser.Scene;
  private triggered = false;

  constructor(scene: Phaser.Scene, id: string, x: number, originY: number, targetY: number) {
    this.scene = scene;
    this.id = id;
    this.originX = x;
    this.originY = originY;
    this.targetY = targetY;

    this.sprite = scene.add.sprite(x, originY, 'proto_tile')
      .setDisplaySize(48, 20)
      .setTint(0x5d4037)
      .setDepth(11);

    scene.physics.add.existing(this.sprite, false);
    this.solidBody = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.solidBody.setImmovable(true);
    this.solidBody.setAllowGravity(false);
  }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(ability: string): boolean {
    if (ability === 'TIME' || ability === 'STAFF_ACTION') {
      return this.applyTimeAction('REWIND');
    }
    return false;
  }

  public canApplyTimeAction(): boolean {
    return true;
  }

  public checkTrigger(playerX: number): void {
    if (!this.triggered && this.currentState === 'HELD' && Math.abs(playerX - this.x) < 55) {
      this.triggered = true;
      this.currentState = 'FALLING';
      this.solidBody.setVelocityY(280);
      AudioManager.playWoodCreak();
    }
  }

  public applyTimeAction(action: TimeManipAction): boolean {
    if (action === 'FREEZE') {
      this.currentState = 'FROZEN';
      this.isTimeFrozen = true;
      this.solidBody.setVelocityY(0);
      AudioManager.playTimeFreeze();
      this.sprite.setTint(0x00f0ff);
      return true;
    } else if (action === 'REWIND' || action === 'RESTORE') {
      this.isTimeFrozen = false;
      this.currentState = 'HELD';
      this.solidBody.setVelocityY(0);
      this.sprite.setTint(0xd4af37);

      AudioManager.playTimeRewind();

      // Smooth temporal ascent tween
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.originY,
        duration: 700,
        ease: 'Cubic.easeInOut',
        onUpdate: () => {
          this.solidBody.reset(this.x, this.sprite.y);
        },
        onComplete: () => {
          this.sprite.setTint(0x5d4037);
          this.triggered = false;
        }
      });
      return true;
    }
    return false;
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 24, this.sprite.y - 10, 48, 20);
  }

  public update(_time: number, _delta: number): void {
    if (this.currentState === 'FALLING' && this.sprite.y >= this.targetY) {
      this.currentState = 'GROUNDED';
      this.solidBody.setVelocityY(0);
      this.sprite.y = this.targetY;
      this.solidBody.reset(this.x, this.targetY);
      AudioManager.playLand();
    }
  }
}

/**
 * ForestPatrolCreature — Ancient Forest Golem / Sentinel.
 * States: 'PATROLLING' <---> 'CHRONO_STASIS'.
 * Time Stasis locks it into an ethereal stasis bubble where it cannot move or deal contact damage.
 */
export class ForestPatrolCreature implements ITimeStateObject {
  public readonly id: string;
  public get x(): number { return this.sprite ? this.sprite.x : this.spawnX; }
  public get y(): number { return this.sprite ? this.sprite.y : this.spawnY; }
  public readonly interactionRadius = 140;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentState: 'PATROLLING' | 'CHRONO_STASIS' = 'PATROLLING';
  public readonly defaultState = 'PATROLLING';
  public isTimeFrozen = false;

  private stasisTimer = 0;
  private readonly spawnX: number;
  private readonly spawnY: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly speed = 50;
  private direction = 1;

  public readonly sprite: Phaser.GameObjects.Sprite;
  public readonly body: Phaser.Physics.Arcade.Body;
  private readonly stasisBubble: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, minX: number, maxX: number) {
    this.id = id;
    this.spawnX = x;
    this.spawnY = y;
    this.minX = minX;
    this.maxX = maxX;

    this.sprite = scene.add.sprite(x, y, 'proto_drone')
      .setDisplaySize(28, 28)
      .setTint(0x40916c) // Overgrown ancient moss
      .setDepth(12);

    scene.physics.add.existing(this.sprite, false);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setVelocityX(this.speed);

    this.stasisBubble = scene.add.graphics().setDepth(13);
  }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(ability: string): boolean {
    if (ability === 'TIME' || ability === 'STAFF_ACTION') {
      return this.applyTimeAction('FREEZE');
    }
    return false;
  }

  public canApplyTimeAction(): boolean {
    return true;
  }

  public applyTimeAction(action: TimeManipAction, durationMs = 6000): boolean {
    if (action === 'FREEZE' || action === 'TOGGLE') {
      this.currentState = 'CHRONO_STASIS';
      this.isTimeFrozen = true;
      this.stasisTimer = durationMs;
      this.body.setVelocityX(0);
      AudioManager.playTimeFreeze();
      this.sprite.setTint(0x00f0ff);
      return true;
    } else if (action === 'RESTORE') {
      this.currentState = 'PATROLLING';
      this.isTimeFrozen = false;
      this.body.setVelocityX(this.speed * this.direction);
      this.sprite.setTint(0x40916c);
      this.stasisBubble.clear();
      return true;
    }
    return false;
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 14, this.sprite.y - 14, 28, 28);
  }

  public update(time: number, delta: number): void {
    if (this.isTimeFrozen) {
      this.stasisTimer -= delta;
      this.drawStasisChronosphere(time);
      if (this.stasisTimer <= 0) {
        this.applyTimeAction('RESTORE');
      }
      return;
    }

    this.stasisBubble.clear();

    if (this.sprite.x >= this.maxX && this.direction > 0) {
      this.direction = -1;
      this.body.setVelocityX(-this.speed);
      this.sprite.setFlipX(true);
    } else if (this.sprite.x <= this.minX && this.direction < 0) {
      this.direction = 1;
      this.body.setVelocityX(this.speed);
      this.sprite.setFlipX(false);
    }
  }

  private drawStasisChronosphere(time: number): void {
    this.stasisBubble.clear();
    const pulse = 18 + Math.sin(time * 0.008) * 2;
    this.stasisBubble.fillStyle(0x00f0ff, 0.22);
    this.stasisBubble.fillCircle(this.sprite.x, this.sprite.y, pulse);
    this.stasisBubble.lineStyle(1.5, 0x48cae4, 0.85);
    this.stasisBubble.strokeCircle(this.sprite.x, this.sprite.y, pulse);
  }
}
