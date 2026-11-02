import Phaser from 'phaser';
import { SeamCurveDef } from '../../config/level6Config';
import { AudioManager } from '../../systems/AudioManager';

/**
 * 4x4 Bayer Matrix for pixel-art ordered dithering
 */
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

export interface SeamCrossingCallback {
  (seamIndex: number, seamDef: SeamCurveDef): void;
}

/**
 * SeamTransition
 * ──────────────
 * Renders the slanted exponential pixel curve boundary between two worlds,
 * complete with Bayer ordered dither bands and integer-stepped walkable ledges.
 * Manages one-shot pixel dissolve wavefront effects when player crosses.
 */
export class SeamTransition {
  private scene: Phaser.Scene;
  public readonly def: SeamCurveDef;
  public readonly index: number;

  private graphics: Phaser.GameObjects.Graphics;
  private seamLedges: Phaser.GameObjects.Sprite[] = [];
  public gateSprite?: Phaser.GameObjects.Sprite;
  public isGateOpen = false;
  public hasCrossed = false;

  constructor(scene: Phaser.Scene, index: number, def: SeamCurveDef, staticGroup: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene;
    this.index = index;
    this.def = def;
    this.graphics = scene.add.graphics().setDepth(15);

    this.renderPixelSeam();
    this.buildWalkableStairs(staticGroup);
    this.buildSeamGate(staticGroup);
  }

  /**
   * Evaluates the exponential curve at delta x from seam start:
   * y = y0 - a * (e^(k * dx) - 1)
   */
  public evaluateCurve(x: number): number {
    const dx = Math.max(0, Math.min(this.def.x1 - this.def.x0, x - this.def.x0));
    const offset = this.def.a * (Math.exp(this.def.k * dx) - 1);
    const y = Math.round(this.def.y0 - offset);
    return Math.max(this.def.y1, Math.min(this.def.y0, y));
  }

  /**
   * Renders the integer-aligned stair-stepped seam curve and Bayer dither band
   */
  private renderPixelSeam(): void {
    const { x0, x1, colorFrom, colorTo, ditherWidth } = this.def;
    this.graphics.clear();

    const stepWidth = 8;
    const bandWidth = Math.round(ditherWidth);

    for (let x = x0; x < x1; x += stepWidth) {
      const curY = this.evaluateCurve(x);
      const nextY = this.evaluateCurve(x + stepWidth);
      const stepY = Math.min(curY, nextY);

      // Draw primary boundary stepped edge
      this.graphics.fillStyle(colorFrom, 0.85);
      this.graphics.fillRect(x, stepY, stepWidth, 360 - stepY);

      // Draw Bayer dither transition fringe
      for (let bx = 0; bx < stepWidth; bx += 2) {
        for (let by = 0; by < bandWidth; by += 2) {
          const px = x + bx;
          const py = stepY - bandWidth + by;
          if (py < 0 || py > 360) continue;

          const matrixX = Math.floor(px / 2) % 4;
          const matrixY = Math.floor(py / 2) % 4;
          const threshold = BAYER_4X4[matrixY][matrixX] / 16;
          const ratio = (by / bandWidth) * ((x - x0) / (x1 - x0));

          if (ratio > threshold) {
            this.graphics.fillStyle(colorTo, 0.9);
            this.graphics.fillRect(px, py, 2, 2);
          } else {
            this.graphics.fillStyle(colorFrom, 0.65);
            this.graphics.fillRect(px, py, 2, 2);
          }
        }
      }

      // Digital anomaly glitch pixels along the seam seam
      if (Math.sin(x * 0.25) > 0.6) {
        const glitchY = stepY - 12 - (x % 16);
        this.graphics.fillStyle(0xffffff, 0.85);
        this.graphics.fillRect(x, glitchY, 4, 3);
      }
    }

    // Seam title label
    this.scene.add.text((x0 + x1) / 2, this.def.y1 - 32, this.def.label, {
      fontFamily: '"Share Tech Mono", monospace',
      fontSize: '8px',
      color: '#' + colorTo.toString(16).padStart(6, '0'),
      backgroundColor: '#040810',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(16);
  }

  /**
   * Builds solid, integer-stepped ledge platforms following the climbable slope
   */
  private buildWalkableStairs(staticGroup: Phaser.Physics.Arcade.StaticGroup): void {
    const { x0, x1 } = this.def;
    const stepInterval = 32;

    for (let x = x0; x < x1; x += stepInterval) {
      const y = this.evaluateCurve(x);
      const ledge = this.scene.add.sprite(x + stepInterval / 2, y + 16, 'proto_tile')
        .setDisplaySize(stepInterval, 16)
        .setTint(this.def.colorFrom)
        .setDepth(12);

      this.scene.physics.add.existing(ledge, true);
      staticGroup.add(ledge);
      this.seamLedges.push(ledge);
    }
  }

  /**
   * Builds the lock barrier gate at the seam apex that opens only when the primary key is earned
   */
  private buildSeamGate(staticGroup: Phaser.Physics.Arcade.StaticGroup): void {
    const gateX = this.def.x1 - 20;
    const gateY = this.def.y1;

    const gate = this.scene.add.sprite(gateX, gateY - 24, 'electronic_door')
      .setDepth(18);
    this.gateSprite = gate;
    this.scene.physics.add.existing(gate, true);
    staticGroup.add(gate);

    // Indicator light beacon on top of the gate
    const beacon = this.scene.add.circle(gateX, gateY - 58, 4, 0xff0055, 1).setDepth(19);
    this.scene.tweens.add({
      targets: beacon,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 400
    });

    (this.gateSprite as any).beacon = beacon;
    (this.gateSprite as any).staticGroup = staticGroup;
  }

  /**
   * Opens the seam gate when the primary key has been obtained
   */
  public openGate(): void {
    if (this.isGateOpen || !this.gateSprite) return;
    this.isGateOpen = true;

    AudioManager.playDoorUnlock();

    const beacon = (this.gateSprite as any).beacon as Phaser.GameObjects.Arc;
    if (beacon && typeof beacon.setFillStyle === 'function') {
      beacon.setFillStyle(0x70e000);
    }

    const staticGroup = (this.gateSprite as any).staticGroup as Phaser.Physics.Arcade.StaticGroup;
    if (this.gateSprite.body) {
      (this.gateSprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    if (staticGroup) {
      staticGroup.remove(this.gateSprite);
    }

    this.scene.tweens.add({
      targets: this.gateSprite,
      scaleY: 0,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.gateSprite?.destroy();
      }
    });
  }

  /**
   * Triggers the one-shot pixel dissolve wavefront crossing effect
   */
  public triggerCrossingEffect(): void {
    if (this.hasCrossed) return;
    this.hasCrossed = true;

    AudioManager.playCheckpoint();
    this.scene.cameras.main.shake(220, 0.007);

    // Particle wavefront sweep along the curve
    const sweepParticles = this.scene.add.particles(this.def.x1, this.def.y1, 'proto_tile', {
      speed: { min: 40, max: 140 },
      scale: { start: 0.5, end: 0 },
      tint: [this.def.colorFrom, this.def.colorTo, 0xffffff],
      lifespan: 650,
      quantity: 24
    }).setDepth(25);

    this.scene.time.delayedCall(700, () => {
      sweepParticles.destroy();
    });
  }

  public destroy(): void {
    this.graphics.destroy();
    this.seamLedges.forEach(l => l.destroy());
    this.seamLedges = [];
    if (this.gateSprite) {
      if ((this.gateSprite as any).beacon) {
        ((this.gateSprite as any).beacon as Phaser.GameObjects.Arc).destroy();
      }
      this.gateSprite.destroy();
    }
  }
}
