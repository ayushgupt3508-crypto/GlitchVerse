import Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { IStaffInteractable, StaffInteractionContext } from './staff/IStaffInteractable';

export type CircuitDeviceType = 'door' | 'elevator' | 'drone' | 'machinery' | 'electric_floor';

export interface CircuitDevice {
  id: string;
  type: CircuitDeviceType;
  circuitId: string;
  isPowered: boolean;
  onPowerChanged(powered: boolean): void;
}

export interface CircuitWire {
  id: string;
  circuitId: string;
  points: { x: number; y: number }[];
}

export class PowerNode implements IStaffInteractable {
  public readonly id: string;
  public readonly x: number;
  public readonly y: number;
  public readonly targetCircuits: string[];
  public activeBranchIndex: number;
  public sprite: Phaser.GameObjects.Sprite;
  public labelText: Phaser.GameObjects.Text;
  public circuitGraph?: CircuitGraph;

  // IStaffInteractable contract
  public readonly supportedAbilities = ['EMP'] as const;
  public readonly interactionRadius = 95;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    targetCircuits: string[],
    initialBranch = 0,
    circuitGraph?: CircuitGraph
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.targetCircuits = targetCircuits;
    this.activeBranchIndex = initialBranch;
    this.circuitGraph = circuitGraph;

    this.sprite = scene.add.sprite(x, y, 'power_node').setDepth(12);

    this.labelText = scene.add.text(x, y - 22, this.activeCircuitId.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#00f0ff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(20);
  }

  public get activeCircuitId(): string {
    return this.targetCircuits[this.activeBranchIndex] ?? '';
  }

  public toggle(): string {
    this.activeBranchIndex = (this.activeBranchIndex + 1) % this.targetCircuits.length;
    this.labelText.setText(this.activeCircuitId.toUpperCase());
    return this.activeCircuitId;
  }

  public canInteract(ability: string): boolean {
    return ability === 'EMP';
  }

  public onAbilityApplied(ability: string, _context?: StaffInteractionContext): boolean {
    if (ability === 'EMP') {
      if (this.circuitGraph) {
        return this.circuitGraph.toggleNode(this.id);
      }
      this.toggle();
      return true;
    }
    return false;
  }

  public destroy(): void {
    this.sprite.destroy();
    this.labelText.destroy();
  }
}

/**
 * CircuitGraph — Simple graph-based power distribution system for Level 4.
 *
 * Supports discrete circuit branches connected to PowerNodes and Devices.
 * Visualized with glowing neon circuit lines, electric arcs, and power pulses.
 */
export class CircuitGraph {
  private readonly scene: Phaser.Scene;
  private readonly nodes = new Map<string, PowerNode>();
  private readonly devices = new Map<string, CircuitDevice>();
  private readonly wires: CircuitWire[] = [];
  private readonly circuitStates = new Map<string, boolean>();

  // Graphics for wires and electric arcs
  private readonly wireGfx: Phaser.GameObjects.Graphics;
  private readonly arcGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.wireGfx = scene.add.graphics().setDepth(5);
    this.arcGfx = scene.add.graphics().setDepth(16);
  }

  public addNode(node: PowerNode): void {
    node.circuitGraph = this;
    this.nodes.set(node.id, node);
    // Initialize power states from node
    node.targetCircuits.forEach((cId, idx) => {
      this.circuitStates.set(cId, idx === node.activeBranchIndex);
    });
  }

  public registerDevice(device: CircuitDevice): void {
    this.devices.set(device.id, device);
    const powered = this.isCircuitPowered(device.circuitId);
    device.onPowerChanged(powered);
  }

  public addWire(wire: CircuitWire): void {
    this.wires.push(wire);
  }

  public isCircuitPowered(circuitId: string): boolean {
    return this.circuitStates.get(circuitId) ?? false;
  }

  public getNode(id: string): PowerNode | undefined {
    return this.nodes.get(id);
  }

  public getNearestNode(x: number, y: number, maxDist = 90): PowerNode | null {
    let nearest: PowerNode | null = null;
    let minDist = maxDist;

    this.nodes.forEach(node => {
      const d = Phaser.Math.Distance.Between(x, y, node.x, node.y);
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    });

    return nearest;
  }

  /**
   * Toggle a PowerNode's active output branch, redirecting power.
   */
  public toggleNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Previous active circuit shuts down
    const oldCircuit = node.activeCircuitId;
    this.circuitStates.set(oldCircuit, false);

    // Switch branch
    const newCircuit = node.toggle();
    this.circuitStates.set(newCircuit, true);

    // Audio SFX & FX
    AudioManager.playCircuitSwitch();
    this.spawnSwitchSparks(node.x, node.y);

    // Notify all connected devices
    this.devices.forEach(dev => {
      if (dev.circuitId === oldCircuit) {
        dev.onPowerChanged(false);
      } else if (dev.circuitId === newCircuit) {
        dev.onPowerChanged(true);
      }
    });

    // Synchronize all other PowerNodes that control these same circuits
    this.nodes.forEach(n => {
      if (n.id !== nodeId && n.targetCircuits.includes(newCircuit)) {
        n.activeBranchIndex = n.targetCircuits.indexOf(newCircuit);
        n.labelText.setText(newCircuit.toUpperCase());
      }
    });

    return true;
  }

  /**
   * Render glowing circuit lines and traveling electrical pulses.
   */
  public update(time: number): void {
    this.wireGfx.clear();
    this.arcGfx.clear();

    // 1. Render all circuit wires
    this.wires.forEach(wire => {
      if (wire.points.length < 2) return;

      const isPowered = this.isCircuitPowered(wire.circuitId);
      const wireCol = isPowered ? 0x00f0ff : 0x1e2430;
      const wireAlpha = isPowered ? 0.95 : 0.45;
      const lineWidth = isPowered ? 2.5 : 1.5;

      // Outer glow line if powered
      if (isPowered) {
        this.wireGfx.lineStyle(lineWidth + 3, 0x00a8ff, 0.35);
        this.wireGfx.beginPath();
        this.wireGfx.moveTo(wire.points[0].x, wire.points[0].y);
        for (let i = 1; i < wire.points.length; i++) {
          this.wireGfx.lineTo(wire.points[i].x, wire.points[i].y);
        }
        this.wireGfx.strokePath();
      }

      // Core wire
      this.wireGfx.lineStyle(lineWidth, wireCol, wireAlpha);
      this.wireGfx.beginPath();
      this.wireGfx.moveTo(wire.points[0].x, wire.points[0].y);
      for (let i = 1; i < wire.points.length; i++) {
        this.wireGfx.lineTo(wire.points[i].x, wire.points[i].y);
      }
      this.wireGfx.strokePath();

      // Traveling pulse packet along powered wires
      if (isPowered) {
        const totalSegments = wire.points.length - 1;
        const progress = ((time * 0.001) % 1);
        const segIdx = Math.min(totalSegments - 1, Math.floor(progress * totalSegments));
        const segProg = (progress * totalSegments) - segIdx;

        const p1 = wire.points[segIdx];
        const p2 = wire.points[segIdx + 1];
        const px = p1.x + (p2.x - p1.x) * segProg;
        const py = p1.y + (p2.y - p1.y) * segProg;

        this.wireGfx.fillStyle(0xffffff, 1);
        this.wireGfx.fillCircle(px, py, 2.5);
        this.wireGfx.fillStyle(0x00f0ff, 0.6);
        this.wireGfx.fillCircle(px, py, 5);
      }
    });

    // 2. Pulse arcs at active nodes
    this.nodes.forEach(node => {
      const activeCircuit = node.activeCircuitId;
      if (this.isCircuitPowered(activeCircuit)) {
        const pulse = Math.sin(time * 0.01) * 2;
        this.arcGfx.lineStyle(1.5, 0x00f0ff, 0.7);
        this.arcGfx.strokeCircle(node.x, node.y, 14 + pulse);
      }
    });
  }

  private spawnSwitchSparks(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y, 'proto_tile', {
      speed: { min: 40, max: 120 },
      scale: { start: 0.35, end: 0 },
      tint: [0x00f0ff, 0xffea00, 0xffffff],
      lifespan: 400,
      quantity: 14
    });
    this.scene.time.delayedCall(450, () => emitter.destroy());
  }

  public destroy(): void {
    this.nodes.forEach(n => n.destroy());
    this.wireGfx.destroy();
    this.arcGfx.destroy();
  }
}
