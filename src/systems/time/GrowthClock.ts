import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { AudioManager } from '../AudioManager';
import { ITimeStateObject, TimeManipAction } from './ITimeStateObject';
import { IStaffInteractable, StaffInteractionContext } from '../staff/IStaffInteractable';
import { GAME_FONTS } from '../../config';

export type GrowthObjectType =
  | 'SAPLING'
  | 'VINE'
  | 'FUNGUS'
  | 'LOG_BRIDGE'
  | 'BRIAR_THORN'
  | 'SPORE_VENT'
  | 'ALTAR_SLOT';

export interface GrowthStageDef {
  name: string;
  label: string;
  icon: string;
  isSolid: boolean;
  isHazard: boolean;
  isBouncy: boolean;
  bounceVelocity?: number;
  width: number;
  height: number;
  yOffset: number;
  tint: number;
  alpha: number;
}

export const GROWTH_CONFIG: Record<GrowthObjectType, GrowthStageDef[]> = {
  SAPLING: [
    { name: 'SEED', label: 'SEED', icon: '🌰', isSolid: false, isHazard: false, isBouncy: false, width: 20, height: 8, yOffset: 6, tint: 0x5c4033, alpha: 0.7 },
    { name: 'SAPLING', label: 'SAPLING STEP', icon: '🌱', isSolid: true, isHazard: false, isBouncy: false, width: 46, height: 14, yOffset: 0, tint: 0x52b788, alpha: 1 },
    { name: 'GROWN_TREE', label: 'ANCIENT CANOPY', icon: '🌳', isSolid: true, isHazard: false, isBouncy: false, width: 78, height: 22, yOffset: -22, tint: 0x2d6a4f, alpha: 1 },
    { name: 'DECAYED_STUMP', label: 'ROTTED STUMP', icon: '🍂', isSolid: true, isHazard: false, isBouncy: false, width: 34, height: 12, yOffset: 4, tint: 0x3e2723, alpha: 0.55 }
  ],
  VINE: [
    { name: 'BUD', label: 'VINE BUD', icon: '🌱', isSolid: false, isHazard: false, isBouncy: false, width: 16, height: 16, yOffset: 0, tint: 0x40916c, alpha: 0.6 },
    { name: 'HANGING_VINE', label: 'HANGING ROPE', icon: '🌿', isSolid: false, isHazard: false, isBouncy: false, width: 20, height: 80, yOffset: 32, tint: 0x52b788, alpha: 0.95 },
    { name: 'CANOPY_BRIDGE', label: 'WOVEN BRIDGE', icon: '🪵', isSolid: true, isHazard: false, isBouncy: false, width: 92, height: 16, yOffset: 0, tint: 0x2d6a4f, alpha: 1 },
    { name: 'WILTED_FIBRE', label: 'WILTED GAP', icon: '🍂', isSolid: false, isHazard: false, isBouncy: false, width: 16, height: 16, yOffset: 0, tint: 0x3e2723, alpha: 0.3 }
  ],
  FUNGUS: [
    { name: 'SPORE', label: 'FUNGAL BUD', icon: '🍄', isSolid: false, isHazard: false, isBouncy: false, width: 22, height: 8, yOffset: 5, tint: 0x74c69d, alpha: 0.6 },
    { name: 'BOUNCE_CAP', label: 'BOUNCE MUSHROOM', icon: '🍄', isSolid: true, isHazard: false, isBouncy: true, bounceVelocity: -430, width: 48, height: 18, yOffset: 0, tint: 0x52b788, alpha: 1 },
    { name: 'TRAMPOLINE', label: 'SUPER TRAMPOLINE', icon: '✨', isSolid: true, isHazard: false, isBouncy: true, bounceVelocity: -570, width: 68, height: 22, yOffset: -4, tint: 0xd4af37, alpha: 1 },
    { name: 'DECAYED_SLIME', label: 'SLIME MAT', icon: '🍂', isSolid: true, isHazard: false, isBouncy: false, width: 28, height: 8, yOffset: 5, tint: 0x1b4332, alpha: 0.5 }
  ],
  LOG_BRIDGE: [
    { name: 'STURDY_LOG', label: 'STURDY LOG', icon: '🪵', isSolid: true, isHazard: false, isBouncy: false, width: 84, height: 18, yOffset: 0, tint: 0x5c4033, alpha: 1 },
    { name: 'WEATHERED', label: 'WEATHERED PLANK', icon: '🪵', isSolid: true, isHazard: false, isBouncy: false, width: 84, height: 16, yOffset: 0, tint: 0x8b5a2b, alpha: 0.9 },
    { name: 'CRUMBLING', label: 'COLLAPSING (1.2s)', icon: '⚠', isSolid: true, isHazard: false, isBouncy: false, width: 80, height: 14, yOffset: 2, tint: 0xb7950b, alpha: 0.8 },
    { name: 'ROTTED_GAP', label: 'ROTTED GAP', icon: '💨', isSolid: false, isHazard: false, isBouncy: false, width: 40, height: 12, yOffset: 12, tint: 0x2b1d0c, alpha: 0.25 }
  ],
  BRIAR_THORN: [
    { name: 'LETHAL_THORNS', label: 'LETHAL BRIAR', icon: '🩸', isSolid: false, isHazard: true, isBouncy: false, width: 56, height: 20, yOffset: 0, tint: 0x8b0000, alpha: 1 },
    { name: 'WILTED_THORNS', label: 'WILTED THORNS', icon: '⚠', isSolid: false, isHazard: true, isBouncy: false, width: 38, height: 14, yOffset: 3, tint: 0xcc5500, alpha: 0.85 },
    { name: 'WITHERED_ASH', label: 'WITHERED ASH (SAFE)', icon: '🍂', isSolid: false, isHazard: false, isBouncy: false, width: 30, height: 8, yOffset: 6, tint: 0x4a4e69, alpha: 0.6 },
    { name: 'DORMANT_SOIL', label: 'DORMANT SOIL', icon: '🌱', isSolid: false, isHazard: false, isBouncy: false, width: 24, height: 6, yOffset: 7, tint: 0x3d312a, alpha: 0.4 }
  ],
  SPORE_VENT: [
    { name: 'DORMANT_BULB', label: 'DORMANT BULB', icon: '🌱', isSolid: false, isHazard: false, isBouncy: false, width: 26, height: 20, yOffset: 0, tint: 0x2d6a4f, alpha: 0.8 },
    { name: 'SWELLING_PUFF', label: 'SWELLING MIST', icon: '⚠', isSolid: false, isHazard: false, isBouncy: false, width: 34, height: 26, yOffset: -3, tint: 0x52b788, alpha: 0.9 },
    { name: 'TOXIC_CLOUD', label: 'TOXIC SPORE CLOUD', icon: '☠', isSolid: false, isHazard: true, isBouncy: false, width: 58, height: 48, yOffset: -12, tint: 0x9b5de5, alpha: 0.9 },
    { name: 'EXHAUSTED_HUSK', label: 'EXHAUSTED HUSK (SAFE)', icon: '💨', isSolid: false, isHazard: false, isBouncy: false, width: 24, height: 14, yOffset: 4, tint: 0x4a5568, alpha: 0.45 }
  ],
  ALTAR_SLOT: [
    { name: 'EMPTY_SLOT', label: 'ALTAR SLOT (NEED SEED)', icon: '🕳', isSolid: true, isHazard: false, isBouncy: false, width: 44, height: 16, yOffset: 0, tint: 0x3e2723, alpha: 0.7 },
    { name: 'PLANTED_SEED', label: 'PLANTED SEED', icon: '🌰', isSolid: true, isHazard: false, isBouncy: false, width: 44, height: 16, yOffset: 0, tint: 0x8b5a2b, alpha: 0.9 },
    { name: 'RUNIC_SAPLING', label: 'RUNIC SAPLING', icon: '🌱', isSolid: true, isHazard: false, isBouncy: false, width: 52, height: 22, yOffset: -3, tint: 0x52b788, alpha: 1 },
    { name: 'FULL_BLOOM', label: 'ELDER BLOOM ★', icon: '🌸', isSolid: true, isHazard: false, isBouncy: false, width: 60, height: 28, yOffset: -6, tint: 0x00f0ff, alpha: 1 }
  ]
};

/**
 * GrowthClockObject — An entity whose physical form, collision, and hazard
 * properties deterministically transform across 4 growth stages when pulsed by Vance's staff.
 */
export class GrowthClockObject implements ITimeStateObject, IStaffInteractable {
  public readonly id: string;
  public readonly type: GrowthObjectType;
  public readonly baseX: number;
  public readonly baseY: number;
  public readonly interactionRadius = 165;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentStageIndex = 0;
  public isTimeFrozen = false;
  public isTargeted = false;

  public readonly sprite: Phaser.GameObjects.Sprite;
  public readonly solidBody: Phaser.Physics.Arcade.Body;
  private readonly scene: Phaser.Scene;
  private readonly playerRef: Player;

  // Floating UI Badge & Target Reticle
  private badgeContainer: Phaser.GameObjects.Container;
  private badgeText: Phaser.GameObjects.Text;
  private badgeBg: Phaser.GameObjects.Graphics;
  private targetReticle: Phaser.GameObjects.Graphics;

  // Crumbling log bridge timer
  private crumbleTimer = 0;
  private isCrumbling = false;

  constructor(
    scene: Phaser.Scene,
    id: string,
    type: GrowthObjectType,
    x: number,
    y: number,
    player: Player,
    initialStage = 0
  ) {
    this.scene = scene;
    this.id = id;
    this.type = type;
    this.baseX = x;
    this.baseY = y;
    this.playerRef = player;
    this.currentStageIndex = initialStage;

    const stages = GROWTH_CONFIG[type];
    const initial = stages[initialStage] || stages[0];

    // Main sprite representation
    this.sprite = scene.add.sprite(x, y + initial.yOffset, 'proto_tile')
      .setDisplaySize(initial.width, initial.height)
      .setTint(initial.tint)
      .setAlpha(initial.alpha)
      .setDepth(11);

    scene.physics.add.existing(this.sprite, false);
    this.solidBody = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.solidBody.setImmovable(true);
    this.solidBody.setAllowGravity(false);
    this.solidBody.setSize(initial.width, initial.height);
    this.solidBody.enable = initial.isSolid;

    // In-world stage indicator badge
    this.badgeContainer = scene.add.container(x, y - 24).setDepth(23);
    this.badgeBg = scene.add.graphics();
    this.badgeText = scene.add.text(0, 0, `${initial.icon} ${initial.label}`, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.badgeContainer.add([this.badgeBg, this.badgeText]);
    this.updateBadgeVisuals(initial);

    // Subtle bobbing for badge
    scene.tweens.add({
      targets: this.badgeContainer,
      y: y - 28,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Targeting reticle ring (hidden until Vance is nearest)
    this.targetReticle = scene.add.graphics().setDepth(20);
  }

  public get x(): number { return this.sprite.x; }
  public get y(): number { return this.sprite.y; }

  public get currentState(): string {
    return GROWTH_CONFIG[this.type][this.currentStageIndex]?.name ?? 'DEFAULT';
  }

  public get defaultState(): string {
    return GROWTH_CONFIG[this.type][0].name;
  }

  public get currentStageDef(): GrowthStageDef {
    return GROWTH_CONFIG[this.type][this.currentStageIndex];
  }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(_ability: string, _ctx?: StaffInteractionContext): boolean {
    return this.pulseGrowth();
  }

  public canApplyTimeAction(_action: TimeManipAction): boolean {
    return true;
  }

  public applyTimeAction(action: TimeManipAction): boolean {
    if (this.type === 'ALTAR_SLOT') {
      // Altar seeds must only be individually pulsed when highlighted/targeted by Vance
      return false;
    }
    if (action === 'TOGGLE' || action === 'RESTORE' || action === 'REWIND') {
      return this.pulseGrowth();
    }
    return false;
  }

  /**
   * Pulses the object forward to the next growth stage.
   * Plays wood creaking / temporal chime audio and spawns emerald particle burst.
   */
  public pulseGrowth(): boolean {
    const stages = GROWTH_CONFIG[this.type];
    if (this.type === 'ALTAR_SLOT' && this.currentStageIndex >= stages.length - 1) {
      // Altar seed is already in FULL_BLOOM — stay bloomed!
      return false;
    }
    this.currentStageIndex = (this.currentStageIndex + 1) % stages.length;
    const stage = stages[this.currentStageIndex];

    AudioManager.playTimeRewind();
    AudioManager.playWoodCreak();

    // Visual scale pop
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1.25);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.easeOut'
    });

    // Update sprite transform & physics body
    this.sprite.y = this.baseY + stage.yOffset;
    this.sprite.setDisplaySize(stage.width, stage.height);
    this.sprite.setTint(stage.tint);
    this.sprite.setAlpha(stage.alpha);

    this.solidBody.setSize(stage.width, stage.height);
    this.solidBody.reset(this.baseX, this.sprite.y);
    this.solidBody.enable = stage.isSolid;

    // Anti-embedding guarantee: If Vance overlaps the growing solid platform,
    // push Vance cleanly up onto the top surface so he never gets stuck!
    if (stage.isSolid && this.playerRef) {
      this.preventPlayerClipping(stage);
    }

    // Reset crumbling state if cycled
    this.isCrumbling = false;
    this.crumbleTimer = 0;

    // Emerald chrono spore burst
    const emitter = this.scene.add.particles(this.baseX, this.sprite.y, 'proto_tile', {
      speed: { min: 35, max: 110 },
      scale: { start: 0.35, end: 0 },
      tint: [0x52b788, 0x00f0ff, 0xd4af37, 0xffffff],
      lifespan: 500,
      quantity: 14
    }).setDepth(22);
    this.scene.time.delayedCall(550, () => emitter.destroy());

    // Update floating badge
    this.updateBadgeVisuals(stage);

    return true;
  }

  private preventPlayerClipping(stage: GrowthStageDef): void {
    const pBounds = this.playerRef.getBounds();
    const halfW = stage.width / 2;
    const halfH = stage.height / 2;
    const platLeft = this.baseX - halfW;
    const platRight = this.baseX + halfW;
    const platTop = this.sprite.y - halfH;
    const platBottom = this.sprite.y + halfH;

    // Check 2D bounding overlap
    if (
      pBounds.right > platLeft &&
      pBounds.left < platRight &&
      pBounds.bottom > platTop &&
      pBounds.top < platBottom
    ) {
      // Gently lift Vance to the safe top edge of the newly grown platform
      this.playerRef.y = platTop - this.playerRef.displayHeight / 2 - 2;
      const pBody = this.playerRef.body as Phaser.Physics.Arcade.Body;
      if (pBody && pBody.velocity.y > 0) {
        pBody.setVelocityY(0);
      }
    }
  }

  private updateBadgeVisuals(stage: GrowthStageDef): void {
    this.badgeText.setText(`${stage.icon} ${stage.label}`);
    const w = this.badgeText.width + 12;
    const h = 15;

    this.badgeBg.clear();
    this.badgeBg.fillStyle(0x060d0b, 0.9);
    this.badgeBg.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
    this.badgeBg.lineStyle(1.2, stage.tint, 0.85);
    this.badgeBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
  }

  public getBounds(): Phaser.Geom.Rectangle {
    const stage = this.currentStageDef;
    return new Phaser.Geom.Rectangle(
      this.baseX - stage.width / 2,
      this.sprite.y - stage.height / 2,
      stage.width,
      stage.height
    );
  }

  /**
   * Called when player stands on a collapsing log bridge.
   */
  public triggerLogCollapse(): void {
    if (this.type === 'LOG_BRIDGE' && this.currentStageIndex === 2 && !this.isCrumbling) {
      this.isCrumbling = true;
      this.crumbleTimer = 1200; // 1.2s before collapse
      AudioManager.playWoodCreak();
    }
  }

  public update(_time: number, delta: number): void {
    // Handle crumbling log countdown
    if (this.isCrumbling && this.crumbleTimer > 0) {
      this.crumbleTimer -= delta;
      // Jitter visual
      this.sprite.x = this.baseX + (Math.random() * 4 - 2);
      if (this.crumbleTimer <= 0) {
        this.sprite.x = this.baseX;
        this.pulseGrowth(); // Drops to ROTTED_GAP (stage 3)
      }
    }
  }

  public setTargeted(isTargeted: boolean): void {
    this.isTargeted = isTargeted;
    this.targetReticle.clear();
    if (isTargeted) {
      const r = Math.max(this.currentStageDef.width, this.currentStageDef.height) / 2 + 8;
      this.targetReticle.lineStyle(2, 0x00f0ff, 0.85);
      this.targetReticle.strokeCircle(this.baseX, this.sprite.y, r);
      this.targetReticle.fillStyle(0x00f0ff, 0.15);
      this.targetReticle.fillCircle(this.baseX, this.sprite.y, r);
    }
  }

  public resetToStage(stageIndex: number): void {
    const stages = GROWTH_CONFIG[this.type];
    this.currentStageIndex = Math.max(0, Math.min(stageIndex, stages.length - 1));
    const stage = stages[this.currentStageIndex];

    this.sprite.y = this.baseY + stage.yOffset;
    this.sprite.setDisplaySize(stage.width, stage.height);
    this.sprite.setTint(stage.tint);
    this.sprite.setAlpha(stage.alpha);

    this.solidBody.setSize(stage.width, stage.height);
    this.solidBody.reset(this.baseX, this.sprite.y);
    this.solidBody.enable = stage.isSolid;

    this.isCrumbling = false;
    this.crumbleTimer = 0;
    this.updateBadgeVisuals(stage);
  }

  public destroy(): void {
    this.targetReticle.destroy();
    this.badgeContainer.destroy();
    this.sprite.destroy();
  }
}

/**
 * SeedPodItem — Collectible ancient seed pods needed to reawaken the Elder Tree.
 */
export class SeedPodItem {
  public readonly id: string;
  public readonly x: number;
  public readonly y: number;
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  public collected = false;
  private auraGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;

    this.sprite = scene.physics.add.sprite(x, y, 'failsafe_component')
      .setDisplaySize(24, 24)
      .setTint(0x52b788)
      .setDepth(15);

    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(false);
    b.setImmovable(true);

    this.auraGfx = scene.add.graphics().setDepth(14);
    this.drawAura();

    scene.tweens.add({
      targets: this.sprite,
      y: y - 8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.drawAura()
    });
  }

  private drawAura(): void {
    if (this.collected) return;
    this.auraGfx.clear();
    this.auraGfx.lineStyle(1.5, 0x00f0ff, 0.7);
    this.auraGfx.strokeCircle(this.sprite.x, this.sprite.y, 16);
    this.auraGfx.fillStyle(0x52b788, 0.2);
    this.auraGfx.fillCircle(this.sprite.x, this.sprite.y, 16);
  }

  public collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.auraGfx.destroy();
    this.sprite.destroy();
  }
}

/**
 * ActiveForestGolem — High-activity patrolling ancient guardian.
 * Features wider detection, faster turnaround, alert state propagation with
 * alertCount incremented ONCE per detection, and Chrono-Stasis vulnerability.
 */
export class ActiveForestGolem implements ITimeStateObject, IStaffInteractable {
  public readonly id: string;
  public readonly spawnX: number;
  public readonly spawnY: number;
  public readonly minX: number;
  public readonly maxX: number;
  public readonly interactionRadius = 150;
  public readonly supportedAbilities = ['TIME', 'STAFF_ACTION'] as const;

  public currentState: 'PATROLLING' | 'ALERT' | 'CHRONO_STASIS' = 'PATROLLING';
  public readonly defaultState = 'PATROLLING';
  public isTimeFrozen = false;
  public isAlert = false;

  private stasisTimer = 0;
  private readonly patrolSpeed: number;
  private readonly alertSpeed: number;
  private direction = 1;
  private alertCooldown = 0;

  public readonly sprite: Phaser.GameObjects.Sprite;
  public readonly body: Phaser.Physics.Arcade.Body;
  private readonly stasisBubble: Phaser.GameObjects.Graphics;
  private readonly alertIcon: Phaser.GameObjects.Text;
  private readonly playerRef: Player;
  private readonly onAlertTrigger?: (id: string) => void;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    minX: number,
    maxX: number,
    player: Player,
    onAlertTrigger?: (id: string) => void,
    patrolSpeed = 75,
    alertSpeed = 135
  ) {
    this.id = id;
    this.spawnX = x;
    this.spawnY = y;
    this.minX = minX;
    this.maxX = maxX;
    this.playerRef = player;
    this.onAlertTrigger = onAlertTrigger;
    this.patrolSpeed = patrolSpeed;
    this.alertSpeed = alertSpeed;

    this.sprite = scene.add.sprite(x, y, 'proto_drone')
      .setDisplaySize(30, 30)
      .setTint(0x40916c)
      .setDepth(12);

    scene.physics.add.existing(this.sprite, false);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setVelocityX(this.patrolSpeed);

    this.stasisBubble = scene.add.graphics().setDepth(13);

    this.alertIcon = scene.add.text(x, y - 22, '!', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ff3333',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(20);
  }

  public get x(): number { return this.sprite.x; }
  public get y(): number { return this.sprite.y; }

  public canInteract(ability: string): boolean {
    return ability === 'TIME' || ability === 'STAFF_ACTION';
  }

  public onAbilityApplied(_ability: string): boolean {
    return this.applyTimeAction('FREEZE');
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
      this.alertIcon.setAlpha(0);
      return true;
    } else if (action === 'RESTORE') {
      this.currentState = 'PATROLLING';
      this.isTimeFrozen = false;
      this.isAlert = false;
      this.body.setVelocityX(this.patrolSpeed * this.direction);
      this.sprite.setTint(0x40916c);
      this.stasisBubble.clear();
      this.alertIcon.setAlpha(0);
      return true;
    }
    return false;
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.sprite.x - 15, this.sprite.y - 15, 30, 30);
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
    this.alertIcon.setPosition(this.sprite.x, this.sprite.y - 20);

    if (this.alertCooldown > 0) {
      this.alertCooldown -= delta;
    }

    // Vision detection: scan forward 140px within 50px vertical delta
    const dx = this.playerRef.x - this.sprite.x;
    const dy = Math.abs(this.playerRef.y - this.sprite.y);
    const inFacingCone = (this.direction > 0 && dx > 0 && dx < 140) || (this.direction < 0 && dx < 0 && dx > -140);

    if (inFacingCone && dy < 55) {
      if (!this.isAlert) {
        this.isAlert = true;
        this.currentState = 'ALERT';
        this.sprite.setTint(0xff3333);
        this.alertIcon.setAlpha(1);
        AudioManager.playKeyCollect();
        if (this.alertCooldown <= 0) {
          this.alertCooldown = 4000;
          this.onAlertTrigger?.(this.id);
        }
      }
    } else if (this.isAlert && Math.abs(dx) > 230) {
      this.isAlert = false;
      this.currentState = 'PATROLLING';
      this.sprite.setTint(0x40916c);
      this.alertIcon.setAlpha(0);
    }

    const currentSpeed = this.isAlert ? this.alertSpeed : this.patrolSpeed;

    if (this.sprite.x >= this.maxX && this.direction > 0) {
      this.direction = -1;
      this.body.setVelocityX(-currentSpeed);
      this.sprite.setFlipX(true);
    } else if (this.sprite.x <= this.minX && this.direction < 0) {
      this.direction = 1;
      this.body.setVelocityX(currentSpeed);
      this.sprite.setFlipX(false);
    } else {
      this.body.setVelocityX(this.direction * currentSpeed);
    }
  }

  private drawStasisChronosphere(time: number): void {
    this.stasisBubble.clear();
    const pulse = 20 + Math.sin(time * 0.008) * 2;
    this.stasisBubble.fillStyle(0x00f0ff, 0.22);
    this.stasisBubble.fillCircle(this.sprite.x, this.sprite.y, pulse);
    this.stasisBubble.lineStyle(1.5, 0x48cae4, 0.85);
    this.stasisBubble.strokeCircle(this.sprite.x, this.sprite.y, pulse);
  }

  public destroy(): void {
    this.stasisBubble.destroy();
    this.alertIcon.destroy();
    this.sprite.destroy();
  }
}

