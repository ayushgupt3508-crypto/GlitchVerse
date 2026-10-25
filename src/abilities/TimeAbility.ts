import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AudioManager } from '../systems/AudioManager';
import { ITimeStateObject } from '../systems/time/ITimeStateObject';

/**
 * TimeAbility — Temporal Manipulation Conduit for Vance in Sector 4 (Ancient Forest).
 *
 * Mechanics:
 * ──────────
 *  • Radius Scan: Discharges a localized Chronosphere wave (radius ~160px).
 *  • Deterministic State Manipulation: Affected objects (Broken bridges, moving platforms,
 *    falling branches, patrolling creatures) freeze in stasis or rewind predefined states.
 *  • Visual Feedback:
 *     - Blue trail & ghost afterimages marking previous and target positions.
 *     - Expanding cyan chronosphere shockwave ring.
 *     - Shimmering temporal clock runes & spark particles.
 *  • Input: [T], [E], or [R] key, or StaffController activation.
 */
export class TimeAbility {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private timeObjects: ITimeStateObject[] = [];

  // Configuration
  public readonly RADIUS = 165;
  public readonly COOLDOWN_MS = 350;
  private cooldownTimer = 0;

  // Visuals
  private readonly waveGfx: Phaser.GameObjects.Graphics;
  private readonly radiusGfx: Phaser.GameObjects.Graphics;

  // Keys
  private keyT?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyR?: Phaser.Input.Keyboard.Key;

  // HUD Widget
  private hudWidget?: Phaser.GameObjects.Container;
  private hudText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, player: Player, timeObjects: ITimeStateObject[] = []) {
    this.scene = scene;
    this.player = player;
    this.timeObjects = timeObjects;

    this.waveGfx = scene.add.graphics().setDepth(20);
    this.radiusGfx = scene.add.graphics().setDepth(19);

    this.setupInput();
    this.createHudWidget();
  }

  public registerTimeObject(obj: ITimeStateObject): void {
    if (!this.timeObjects.includes(obj)) {
      this.timeObjects.push(obj);
    }
  }

  public unregisterTimeObject(obj: ITimeStateObject): void {
    const idx = this.timeObjects.indexOf(obj);
    if (idx !== -1) {
      this.timeObjects.splice(idx, 1);
    }
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;

    this.scene.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.T,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.R
    ]);

    this.keyT = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.keyE = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyR = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.keyT.on('down', () => this.activate());
    this.keyE.on('down', () => this.activate());
    this.keyR.on('down', () => this.activate());
  }

  private createHudWidget(): void {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    const x = W - 156;
    const y = H - 38;

    this.hudWidget = this.scene.add.container(x, y).setScrollFactor(0).setDepth(52);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a141e, 0.92);
    bg.fillRoundedRect(0, 0, 144, 26, 6);
    bg.lineStyle(1.5, 0x00f0ff, 0.85);
    bg.strokeRoundedRect(0, 0, 144, 26, 6);

    this.hudText = this.scene.add.text(72, 13, '[T/E] CHRONO CONDUIT', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.hudWidget.add([bg, this.hudText]);
  }

  /**
   * Main activation entry point.
   */
  public activate(): boolean {
    if (this.cooldownTimer > 0) return false;

    // Verify staff charges
    if (this.player.staffCharges < 1) {
      AudioManager.playInsufficientCharge();
      this.scene.cameras.main.shake(120, 0.006);
      this.flashHudWarning();
      return false;
    }

    this.cooldownTimer = this.COOLDOWN_MS;

    // Deduct charge
    if (this.player.staffController) {
      this.player.staffController.chargeManager.consumeCharge(1);
    } else {
      this.player.staffCharges = Math.max(0, this.player.staffCharges - 1);
      this.player.emit('staff_used', this.player.staffCharges);
    }

    const px = this.player.x;
    const py = this.player.y;

    // Scan for nearby time-affected objects
    let affectedCount = 0;
    for (const obj of this.timeObjects) {
      const dist = Phaser.Math.Distance.Between(px, py, obj.x, obj.y);
      if (dist <= this.RADIUS) {
        const success = obj.applyTimeAction('TOGGLE');
        if (success) {
          affectedCount++;
          this.spawnAfterimageStream(px, py, obj.x, obj.y);
        }
      }
    }

    // Audio & Visual Shockwave
    AudioManager.playTimeRewind();
    this.spawnChronosphereShockwave(px, py);
    this.scene.cameras.main.flash(100, 0, 240, 255);

    return true;
  }

  private spawnChronosphereShockwave(x: number, y: number): void {
    // Expanding cyan ring
    const ring = this.scene.add.graphics().setDepth(25);
    ring.lineStyle(3, 0x00f0ff, 1);
    ring.strokeCircle(x, y, 10);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: this.RADIUS / 10,
      scaleY: this.RADIUS / 10,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    // Clock gear particles
    const emitter = this.scene.add.particles(x, y, 'proto_tile', {
      speed: { min: 60, max: 220 },
      scale: { start: 0.5, end: 0 },
      tint: [0x00f0ff, 0x48cae4, 0xd4af37, 0xffffff],
      lifespan: 550,
      quantity: 20
    });
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  private spawnAfterimageStream(fromX: number, fromY: number, toX: number, toY: number): void {
    const beam = this.scene.add.graphics().setDepth(22);
    beam.lineStyle(2, 0x00f0ff, 0.85);
    beam.lineBetween(fromX, fromY, toX, toY);

    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => beam.destroy()
    });
  }

  private flashHudWarning(): void {
    if (!this.hudText) return;
    this.hudText.setColor('#ff3366');
    this.hudText.setText('[T/E] NO ENERGY CHARGE!');
    this.scene.time.delayedCall(1200, () => {
      this.hudText?.setColor('#00f0ff');
      this.hudText?.setText('[T/E] CHRONO CONDUIT');
    });
  }

  public update(time: number, delta: number): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= delta;
    }

    // Update all registered time-affected objects
    for (const obj of this.timeObjects) {
      obj.update(time, delta);
    }
  }

  public destroy(): void {
    this.waveGfx.destroy();
    this.radiusGfx.destroy();
    this.hudWidget?.destroy();
  }
}
