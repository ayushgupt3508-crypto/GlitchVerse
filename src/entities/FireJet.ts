import Phaser from 'phaser';

/**
 * FireJet — A timed floor-mounted fire hazard for the Heat Age sector.
 * Cycles: 2.5s OFF (dim), 2s ON (lethal flames). Offset by cycleOffset ms so
 * multiple jets have varied timing.
 *
 * The caller registers the `hazardSprite` against the player for overlaps.
 */
export class FireJet {
  public readonly hazardSprite: Phaser.Physics.Arcade.Sprite;

  private isActive = false;
  private flameGraphics: Phaser.GameObjects.Graphics;
  private readonly flameX: number;
  private readonly flameY: number;
  private readonly flameH: number;

  constructor(
    scene: Phaser.Scene,
    hazardGroup: Phaser.Physics.Arcade.StaticGroup,
    x: number,
    floorY: number,
    flameHeight = 80,
    cycleOffset = 0
  ) {
    this.flameX = x;
    this.flameY = floorY;
    this.flameH = flameHeight;

    // Visual base indicator (always visible)
    const base = scene.add.graphics();
    base.fillStyle(0xff4400, 1);
    base.fillRect(x - 6, floorY - 8, 12, 8);
    base.fillStyle(0xff6600, 0.7);
    base.fillRect(x - 4, floorY - 12, 8, 5);
    base.lineStyle(1, 0xff8800, 1);
    base.strokeRect(x - 6, floorY - 8, 12, 8);

    // Flame visual (toggled)
    this.flameGraphics = scene.add.graphics();
    this.flameGraphics.setDepth(8);

    // Physics hazard sprite (invisible, used for overlap detection)
    this.hazardSprite = hazardGroup.create(x, floorY - flameHeight / 2, 'proto_tile') as Phaser.Physics.Arcade.Sprite;
    this.hazardSprite.setAlpha(0);
    const body = this.hazardSprite.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(10, flameHeight);
    this.hazardSprite.refreshBody();
    this.hazardSprite.setActive(false); // starts inactive

    // Stagger the start
    scene.time.delayedCall(cycleOffset, () => {
      // Start OFF cycle
      scene.time.addEvent({
        delay: 2500,
        loop: true,
        callback: () => this.activate(scene)
      });
      scene.time.addEvent({
        delay: 2000,
        startAt: 2500,
        loop: true,
        callback: () => this.deactivate()
      });
    });
  }

  private activate(scene: Phaser.Scene): void {
    this.isActive = true;
    this.hazardSprite.setActive(true);
    (this.hazardSprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.drawFlame(1.0);

    // Screen-shake hint via event
    scene.events.emit('firejet_activate', this.flameX, this.flameY);
  }

  private deactivate(): void {
    this.isActive = false;
    this.hazardSprite.setActive(false);
    (this.hazardSprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.drawFlame(0); // clear
    // Draw faint ember glow to hint "about to fire"
    this.flameGraphics.clear();
    this.flameGraphics.fillStyle(0xff4400, 0.2);
    this.flameGraphics.fillRect(this.flameX - 4, this.flameY - 20, 8, 12);
  }

  private drawFlame(intensity: number): void {
    this.flameGraphics.clear();
    if (intensity <= 0) return;

    const x = this.flameX;
    const y = this.flameY;
    const h = this.flameH;

    // Outer flame (wide, orange)
    this.flameGraphics.fillStyle(0xff4400, 0.6 * intensity);
    this.flameGraphics.fillTriangle(x - 10, y, x + 10, y, x, y - h);

    // Mid flame (narrower, bright orange)
    this.flameGraphics.fillStyle(0xff8800, 0.75 * intensity);
    this.flameGraphics.fillTriangle(x - 7, y, x + 7, y, x, y - h * 0.85);

    // Inner core (yellow-white)
    this.flameGraphics.fillStyle(0xffdd00, 0.85 * intensity);
    this.flameGraphics.fillTriangle(x - 4, y, x + 4, y, x, y - h * 0.6);

    // Hot white tip
    this.flameGraphics.fillStyle(0xffffff, 0.6 * intensity);
    this.flameGraphics.fillTriangle(x - 2, y - h * 0.5, x + 2, y - h * 0.5, x, y - h);
  }

  /** Call every frame from Scene.update() to animate the flame flicker */
  public update(time: number): void {
    if (!this.isActive) return;
    // Flicker: sine-based intensity variation
    const flicker = 0.85 + 0.15 * Math.sin(time * 0.018);
    this.drawFlame(flicker);
  }

  /** Stun this jet (called when player uses staff near it). */
  public stun(scene: Phaser.Scene, duration = 3500): void {
    if (!this.isActive) return;
    this.deactivate();
    this.flameGraphics.clear();
    this.flameGraphics.fillStyle(0x00d4ff, 0.35);
    this.flameGraphics.fillRect(this.flameX - 6, this.flameY - 20, 12, 20);
    scene.time.delayedCall(duration, () => {
      // Resume naturally — next cycle event will fire
    });
  }
}
