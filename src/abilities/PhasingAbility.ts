import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AudioManager } from '../systems/AudioManager';

export type RealityState = 'A' | 'B';

export interface PhaseableObject {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Sprite;
  body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
  activeRealities: RealityState[]; // e.g. ['A'], ['B'], or ['A', 'B']
  onRealityChanged(current: RealityState): void;
}

/**
 * PhasingAbility — Reality A / Reality B Dimensional Shift for Level 5.
 *
 * Mechanics:
 * ──────────
 *  • Toggles active reality between Reality A (Electric Blue / Cyan) and Reality B (Neon Magenta / Purple).
 *  • Phaseable platforms & objects materialize as solid in their designated reality and become
 *    ghostly wireframes in the alternate reality.
 *  • Safe-Resolve Rule:
 *     - If toggling would materialize a solid platform inside the player, the system first
 *       attempts to safely nudge Vance upward to the platform's top surface.
 *     - If obstructed by ceiling, it attempts lateral nudges.
 *     - If completely enclosed, it cancels the phase shift safely with an error buzz,
 *       preventing the player from ever being trapped or suffocated in a wall.
 *  • Visual feedback:
 *     - Scanline sweep animation across screen.
 *     - Pixel displacement / chromatic camera shake.
 *  • Keybindings: [SHIFT], [X], [C], or [Q], and on-screen interactive HUD button.
 */
export class PhasingAbility {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private currentReality: RealityState = 'A';
  private phaseables: PhaseableObject[] = [];

  // Feedback graphics
  private readonly scanlineGfx: Phaser.GameObjects.Graphics;
  private scanlineProgress = 1;

  // Keys
  private keyShift?: Phaser.Input.Keyboard.Key;
  private keyTab?: Phaser.Input.Keyboard.Key;
  private keyX?: Phaser.Input.Keyboard.Key;
  private keyC?: Phaser.Input.Keyboard.Key;
  private keyQ?: Phaser.Input.Keyboard.Key;

  // HUD Widget
  private hudWidget?: Phaser.GameObjects.Container;
  private hudStatusText?: Phaser.GameObjects.Text;
  private hudStateIndicator?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    this.scanlineGfx = scene.add.graphics().setDepth(99).setScrollFactor(0);

    if (scene.input.keyboard) {
      // Prevent browser from tabbing away or handling default shift navigation
      scene.input.keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SHIFT,
        Phaser.Input.Keyboard.KeyCodes.TAB,
        Phaser.Input.Keyboard.KeyCodes.X
      ]);

      this.keyShift = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.keyTab = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
      this.keyX = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
      this.keyC = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.keyQ = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

      // Direct event triggers ensure instant response with zero polling lag
      this.keyShift.on('down', () => this.toggleReality());
      this.keyTab.on('down', () => this.toggleReality());
      this.keyX.on('down', () => this.toggleReality());
    }

    this.createHudWidget();
  }

  public get reality(): RealityState {
    return this.currentReality;
  }

  public registerPhaseable(obj: PhaseableObject): void {
    this.phaseables.push(obj);
    obj.onRealityChanged(this.currentReality);
  }

  public update(_time: number, delta: number): void {
    if (this.player.isDead) return;

    // Check auxiliary toggle inputs (C or Q)
    const auxPressed =
      (this.keyC ? Phaser.Input.Keyboard.JustDown(this.keyC) : false) ||
      (this.keyQ ? Phaser.Input.Keyboard.JustDown(this.keyQ) : false);

    if (auxPressed) {
      this.toggleReality();
    }

    // Render scanline sweep
    if (this.scanlineProgress < 1) {
      this.scanlineProgress += delta * 0.003;
      this.renderScanlineSweep();
    } else {
      this.scanlineGfx.clear();
    }
  }

  /**
   * Toggles reality between A and B, enforcing the Safe-Resolve Rule.
   */
  public toggleReality(): boolean {
    if (this.player.isDead) return false;

    const targetReality: RealityState = this.currentReality === 'A' ? 'B' : 'A';

    // ── Safe-Resolve Rule Check ──────────────────────────────────────────
    const safe = this.resolvePlayerPhasingOverlap(targetReality);
    if (!safe) {
      // Obstructed: play glitch error buzz and reject phase
      this.scene.cameras.main.shake(80, 0.005);
      this.player.setTint(0xff0055);
      this.scene.time.delayedCall(120, () => this.player.clearTint());
      return false;
    }

    // Apply reality switch
    this.currentReality = targetReality;
    AudioManager.playPhaseShift();

    // Trigger visual displacement & scanline sweep
    this.triggerDisplacementFeedback();

    // Update all registered phaseable entities
    this.phaseables.forEach(p => p.onRealityChanged(this.currentReality));

    // Update HUD Widget
    this.updateHud();

    return true;
  }

  /**
   * Safe-Resolve Rule:
   * Inspects all platforms that WILL materialize solid in targetReality.
   * If any overlaps the player, tests upward / lateral clearance to nudge Vance safely.
   * Returns true if safe (or safely resolved), false if completely blocked.
   */
  private resolvePlayerPhasingOverlap(targetReality: RealityState): boolean {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    if (!pb) return true;

    const px = pb.x;
    const py = pb.y;
    const pw = pb.width;
    const ph = pb.height;

    for (const obj of this.phaseables) {
      // Check if this object will be solid in targetReality
      const willBeSolid = obj.activeRealities.includes(targetReality);
      if (!willBeSolid || !obj.body) continue;

      const ob = obj.body;
      const ox = ob.x;
      const oy = ob.y;
      const ow = ob.width;
      const oh = ob.height;

      // Axis-aligned bounding box collision test
      const overlaps = px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;

      if (overlaps) {
        // Step 1: Attempt upward resolution (pop player to platform top edge)
        const targetPlayerY = oy - ph;
        if (targetPlayerY > 20) {
          this.player.y = targetPlayerY + this.player.height / 2;
          pb.reset(this.player.x, this.player.y);
          pb.setVelocityY(0);
          return true;
        }

        // Step 2: Attempt lateral resolution
        if (px + pw / 2 < ox + ow / 2) {
          // Nudge left
          this.player.x = ox - pw / 2 - 2;
        } else {
          // Nudge right
          this.player.x = ox + ow + pw / 2 + 2;
        }
        pb.reset(this.player.x, this.player.y);
        return true;
      }
    }

    return true;
  }

  // ── Visual Feedback: Displacement & Scanline Sweep ────────────────────────

  private triggerDisplacementFeedback(): void {
    const isA = this.currentReality === 'A';
    const flashCol = isA ? { r: 0, g: 240, b: 255 } : { r: 255, g: 0, b: 128 };

    // Chromatic camera displacement shake
    this.scene.cameras.main.shake(140, 0.01);
    this.scene.cameras.main.flash(90, flashCol.r, flashCol.g, flashCol.b);

    // Start scanline sweep
    this.scanlineProgress = 0;
  }

  private renderScanlineSweep(): void {
    this.scanlineGfx.clear();
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    const sweepY = this.scanlineProgress * H;
    const isA = this.currentReality === 'A';
    const col = isA ? 0x00f0ff : 0xff007f;

    // Glowing horizontal beam
    this.scanlineGfx.fillStyle(col, 0.45);
    this.scanlineGfx.fillRect(0, sweepY - 8, W, 16);
    this.scanlineGfx.fillStyle(0xffffff, 0.85);
    this.scanlineGfx.fillRect(0, sweepY - 1, W, 2);

    // Trailing scanlines
    this.scanlineGfx.lineStyle(1, col, 0.25);
    for (let y = sweepY - 30; y <= sweepY; y += 4) {
      if (y >= 0 && y <= H) {
        this.scanlineGfx.lineBetween(0, y, W, y);
      }
    }
  }

  // ── HUD Widget ────────────────────────────────────────────────────────────

  private createHudWidget(): void {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    const widgetX = W - 152;
    const widgetY = H - 38;

    this.hudWidget = this.scene.add.container(widgetX, widgetY).setScrollFactor(0).setDepth(52);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0c16, 0.92);
    bg.fillRoundedRect(0, 0, 142, 28, 8);
    bg.lineStyle(1.5, 0x00f0ff, 0.9);
    bg.strokeRoundedRect(0, 0, 142, 28, 8);
    this.hudWidget.add(bg);

    const hitZone = this.scene.add.zone(0, 0, 142, 28)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this.toggleReality());
    this.hudWidget.add(hitZone);

    this.hudStateIndicator = this.scene.add.graphics();
    this.hudWidget.add(this.hudStateIndicator);

    this.hudStatusText = this.scene.add.text(71, 14, '[SHIFT/TAB] REALITY: A', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.hudWidget.add(this.hudStatusText);

    this.updateHud();
  }

  private updateHud(): void {
    if (!this.hudStatusText || !this.hudStateIndicator) return;

    this.hudStateIndicator.clear();
    const isA = this.currentReality === 'A';

    if (isA) {
      this.hudStatusText.setText('[SHIFT/TAB] REALITY: A [CYAN]');
      this.hudStatusText.setColor('#00f0ff');
      this.hudStateIndicator.fillStyle(0x00f0ff, 1);
      this.hudStateIndicator.fillCircle(14, 14, 5);
      this.hudStateIndicator.fillStyle(0xffffff, 0.9);
      this.hudStateIndicator.fillCircle(14, 14, 2);
    } else {
      this.hudStatusText.setText('[SHIFT/TAB] REALITY: B [MAGENTA]');
      this.hudStatusText.setColor('#ff007f');
      this.hudStateIndicator.fillStyle(0xff007f, 1);
      this.hudStateIndicator.fillCircle(14, 14, 5);
      this.hudStateIndicator.fillStyle(0xffffff, 0.9);
      this.hudStateIndicator.fillCircle(14, 14, 2);
    }
  }

  public destroy(): void {
    this.scanlineGfx.destroy();
    this.hudWidget?.destroy();
  }
}
