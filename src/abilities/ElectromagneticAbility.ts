import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { CircuitGraph, PowerNode } from '../systems/CircuitGraph';
import { AudioManager } from '../systems/AudioManager';

/**
 * ElectromagneticAbility — Power Redirection Matrix for Vance in Sector 4 (Modern City).
 *
 * Mechanics:
 * ──────────
 *  • Vance harnesses high-frequency electromagnetic pulses via the Staff.
 *  • Detects nearby PowerNodes within 95px range.
 *  • Pressing [E], [C], or [Q] discharges an EMP arc to the target PowerNode,
 *    redirecting current between mutually exclusive circuits (e.g. Elevator vs. Security Door).
 *  • Visual feedback:
 *     - Electric arcs connecting player to the target node.
 *     - Cyan and yellow spark emitters.
 *     - HUD status badge indicating nearest node and targeted circuit.
 */
export class ElectromagneticAbility {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly circuitGraph: CircuitGraph;

  // Interaction range (px)
  public readonly EMP_RANGE = 95;

  // Visuals
  private readonly arcGfx: Phaser.GameObjects.Graphics;
  private targetNode: PowerNode | null = null;
  private targetReticle: Phaser.GameObjects.Graphics;

  // Keys
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyC?: Phaser.Input.Keyboard.Key;

  // HUD Widget
  private hudWidget?: Phaser.GameObjects.Container;
  private hudStatusText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, player: Player, circuitGraph: CircuitGraph) {
    this.scene = scene;
    this.player = player;
    this.circuitGraph = circuitGraph;

    this.arcGfx = scene.add.graphics().setDepth(18);
    this.targetReticle = scene.add.graphics().setDepth(17);

    if (scene.input.keyboard) {
      this.keyE = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyC = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    }

    // Connect to staff controller if already attached
    if (this.player.staffController) {
      this.bindStaffController(this.player.staffController);
    }

    this.createHudWidget();
  }

  public bindStaffController(controller: any): void {
    controller.on('ability_activated', (data: any) => {
      if (data.ability === 'EMP' && data.target) {
        AudioManager.playEmpZap();
        this.drawZapArc(this.player.x, this.player.y, data.target.x, data.target.y);
        this.scene.cameras.main.shake(100, 0.006);
      }
    });
  }

  public update(time: number, _delta: number): void {
    if (this.player.isDead) {
      this.arcGfx.clear();
      this.targetReticle.clear();
      return;
    }

    // 1. Find nearest PowerNode within EMP range
    this.targetNode = this.circuitGraph.getNearestNode(this.player.x, this.player.y, this.EMP_RANGE);

    // 2. Draw target reticle if in range
    this.drawTargetReticle(time);

    // 3. Handle activation input from alternative key [C] or fallback [E] if no staffController
    const justPressed =
      (this.keyC ? Phaser.Input.Keyboard.JustDown(this.keyC) : false) ||
      (!this.player.staffController && this.keyE ? Phaser.Input.Keyboard.JustDown(this.keyE) : false);

    if (justPressed) {
      this.triggerEmp();
    }

    // 4. Update HUD
    this.updateHud();
  }

  public triggerEmp(): boolean {
    if (!this.targetNode || this.player.isDead) return false;

    if (this.player.staffController) {
      return this.player.staffController.activate(this.player.x, this.player.y, this.targetNode);
    }

    // Fallback if no staffController attached
    if (this.player.staffCharges <= 0) {
      this.player.emit('staff_empty');
      return false;
    }

    this.player.staffCharges--;
    this.player.emit('staff_used', this.player.staffCharges);

    // Fire EMP zap arc
    AudioManager.playEmpZap();
    this.drawZapArc(this.player.x, this.player.y, this.targetNode.x, this.targetNode.y);

    // Toggle target PowerNode
    this.circuitGraph.toggleNode(this.targetNode.id);

    // Camera micro shake
    this.scene.cameras.main.shake(100, 0.006);

    return true;
  }

  private drawTargetReticle(time: number): void {
    this.targetReticle.clear();
    if (!this.targetNode) return;

    const nx = this.targetNode.x;
    const ny = this.targetNode.y;
    const pulse = Math.sin(time * 0.012) * 3;
    const r = 16 + pulse;

    this.targetReticle.lineStyle(2, 0x00f0ff, 0.85);
    this.targetReticle.strokeCircle(nx, ny, r);

    // Rotating reticle tick marks
    for (let i = 0; i < 4; i++) {
      const ang = (time * 0.003) + (i * Math.PI / 2);
      const x1 = nx + Math.cos(ang) * (r - 4);
      const y1 = ny + Math.sin(ang) * (r - 4);
      const x2 = nx + Math.cos(ang) * (r + 4);
      const y2 = ny + Math.sin(ang) * (r + 4);
      this.targetReticle.lineBetween(x1, y1, x2, y2);
    }
  }

  private drawZapArc(x1: number, y1: number, x2: number, y2: number): void {
    this.arcGfx.clear();

    // Jagged electric arc
    const segments = 6;
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    for (let i = 1; i < segments; i++) {
      const prog = i / segments;
      const jx = x1 + (x2 - x1) * prog + (Math.random() - 0.5) * 18;
      const jy = y1 + (y2 - y1) * prog + (Math.random() - 0.5) * 18;
      points.push({ x: jx, y: jy });
    }
    points.push({ x: x2, y: y2 });

    // Outer cyan glow
    this.arcGfx.lineStyle(4, 0x00f0ff, 0.9);
    this.arcGfx.beginPath();
    this.arcGfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.arcGfx.lineTo(points[i].x, points[i].y);
    }
    this.arcGfx.strokePath();

    // Inner white core
    this.arcGfx.lineStyle(1.5, 0xffffff, 1);
    this.arcGfx.beginPath();
    this.arcGfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.arcGfx.lineTo(points[i].x, points[i].y);
    }
    this.arcGfx.strokePath();

    // Fade out arc after 150ms
    this.scene.time.delayedCall(160, () => this.arcGfx.clear());
  }

  private createHudWidget(): void {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    const widgetX = W - 152;
    const widgetY = H - 38;

    this.hudWidget = this.scene.add.container(widgetX, widgetY).setScrollFactor(0).setDepth(52);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0c16, 0.9);
    bg.fillRoundedRect(0, 0, 142, 28, 8);
    bg.lineStyle(1.5, 0x00f0ff, 0.85);
    bg.strokeRoundedRect(0, 0, 142, 28, 8);
    this.hudWidget.add(bg);

    const hitZone = this.scene.add.zone(0, 0, 142, 28)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this.triggerEmp());
    this.hudWidget.add(hitZone);

    this.hudStatusText = this.scene.add.text(71, 14, '[E] EMP: SEARCHING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#8b9bb4',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.hudWidget.add(this.hudStatusText);
  }

  private updateHud(): void {
    if (!this.hudStatusText) return;

    if (this.targetNode) {
      this.hudStatusText.setText(`[E] EMP: REDIRECT POWER`);
      this.hudStatusText.setColor('#00f0ff');
    } else {
      this.hudStatusText.setText('[E] EMP: OUT OF RANGE');
      this.hudStatusText.setColor('#8b9bb4');
    }
  }

  public destroy(): void {
    this.arcGfx.destroy();
    this.targetReticle.destroy();
    this.hudWidget?.destroy();
  }
}
