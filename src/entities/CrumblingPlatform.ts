import Phaser from 'phaser';

/**
 * CrumblingPlatform — A static-group-based breakable ice tile.
 * When the player lands on it, it shakes for `shakeDuration` ms then
 * collapses (becomes a ghost). After `resetDelay` ms it reforms.
 */
export class CrumblingPlatform {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  private isCollapsing = false;
  private isBroken = false;
  private readonly shakeDuration: number;
  private readonly resetDelay: number;
  private readonly scene: Phaser.Scene;
  private originalX: number;
  private originalY: number;

  constructor(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.StaticGroup,
    x: number,
    y: number,
    shakeDuration = 600,
    resetDelay = 3000
  ) {
    this.scene = scene;
    this.shakeDuration = shakeDuration;
    this.resetDelay = resetDelay;
    this.originalX = x;
    this.originalY = y;

    this.sprite = group.create(x, y, 'tile_crumble') as Phaser.Physics.Arcade.Sprite;
    this.sprite.refreshBody();
    this.sprite.setData('crumbling', this);
  }

  /** Call from the GameScene collider callback when player is on top. */
  public triggerCrumble(): void {
    if (this.isCollapsing || this.isBroken) return;
    this.isCollapsing = true;

    // Shake tween
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.originalX + 2,
      yoyo: true,
      repeat: Math.floor(this.shakeDuration / 80),
      duration: 40,
      onComplete: () => this.collapse()
    });
  }

  private collapse(): void {
    this.isBroken = true;
    this.isCollapsing = false;
    this.sprite.setAlpha(0);
    (this.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    // Dust particles
    this.scene.add.particles(this.sprite.x, this.sprite.y, 'proto_tile', {
      speed: { min: 20, max: 70 },
      scale: { start: 0.25, end: 0 },
      lifespan: 500,
      quantity: 10
    }).setDepth(10);

    // Reform after delay
    this.scene.time.delayedCall(this.resetDelay, () => this.reform());
  }

  private reform(): void {
    this.isBroken = false;
    this.sprite.setPosition(this.originalX, this.originalY);
    (this.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    (this.sprite.body as Phaser.Physics.Arcade.StaticBody).reset(this.originalX, this.originalY);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 400,
      ease: 'Power2'
    });
  }
}
