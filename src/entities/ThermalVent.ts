import Phaser from 'phaser';
import { Player } from './Player';

export type ThermalVentType = 'updraft' | 'convection';
export type ThermalVentState = 'dormant' | 'active' | 'cooldown';

/**
 * All tuning values for Thermal Vents live in this single config object.
 */
export const THERMAL_VENT_CONFIG = {
  ignitionRange: 150,           // px: staff ignition search radius
  activeDuration: 6000,         // ms (~6s active eruption)
  cooldownDuration: 3500,       // ms (~3.5s cooldown before re-arming)
  flickerWarningMs: 1500,       // ms: flicker warning duration before shutdown
  updraftLiftVelocity: -260,    // px/s: upward lift speed inside updraft column
  convectionFloatVelocityY: -20,// px/s: counter-gravity buoyancy inside convection tunnel
  convectionPushVelocityX: 160  // px/s: horizontal carry velocity across lava
} as const;

export class ThermalVent {
  public readonly scene: Phaser.Scene;
  public readonly x: number;
  public readonly y: number;
  public readonly type: ThermalVentType;
  public readonly zoneBounds: Phaser.Geom.Rectangle;

  private state: ThermalVentState = 'dormant';
  private stateTimer = 0; // delta-driven ms timer

  private baseGraphics: Phaser.GameObjects.Graphics;
  private zoneGraphics: Phaser.GameObjects.Graphics;
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: ThermalVentType,
    zoneWidth: number,
    zoneHeight: number
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;

    if (type === 'updraft') {
      this.zoneBounds = new Phaser.Geom.Rectangle(
        x - zoneWidth / 2,
        y - zoneHeight,
        zoneWidth,
        zoneHeight
      );
    } else {
      this.zoneBounds = new Phaser.Geom.Rectangle(
        x,
        y - zoneHeight / 2,
        zoneWidth,
        zoneHeight
      );
    }

    this.baseGraphics = scene.add.graphics().setDepth(5);
    this.zoneGraphics = scene.add.graphics().setDepth(4);

    this.drawBase();
    this.drawDormantVisuals();
  }

  public get isDormant(): boolean {
    return this.state === 'dormant';
  }

  public get currentState(): ThermalVentState {
    return this.state;
  }

  /**
   * Ignites this dormant vent into active eruption.
   * Returns false if the vent is running or cooling.
   */
  public ignite(): boolean {
    if (this.state !== 'dormant') return false;

    this.state = 'active';
    this.stateTimer = THERMAL_VENT_CONFIG.activeDuration;

    this.drawBase();
    this.drawActiveVisuals();
    return true;
  }

  /**
   * Advances delta-driven timers and applies flow forces to player if inside effect zone.
   * Does not advance when scene is paused (since scene.update delta stops).
   */
  public update(delta: number, player: Player): void {
    if (this.state === 'active') {
      this.stateTimer -= delta;

      // Apply forces if player overlaps effect zone
      if (!player.isDead && player.body) {
        const playerBounds = player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, this.zoneBounds)) {
          if (this.type === 'updraft') {
            player.setVelocityY(THERMAL_VENT_CONFIG.updraftLiftVelocity);
          } else {
            player.setVelocityX(THERMAL_VENT_CONFIG.convectionPushVelocityX);
            player.setVelocityY(THERMAL_VENT_CONFIG.convectionFloatVelocityY);
          }
        }
      }

      // Flicker warning before shutdown
      if (this.stateTimer <= THERMAL_VENT_CONFIG.flickerWarningMs) {
        const blink = Math.floor(this.stateTimer / 100) % 2 === 0;
        this.zoneGraphics.setAlpha(blink ? 0.25 : 0.95);
        if (this.emitter) {
          this.emitter.setAlpha(blink ? 0.3 : 1.0);
        }
      }

      if (this.stateTimer <= 0) {
        this.enterCooldown();
      }
    } else if (this.state === 'cooldown') {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.reset();
      }
    }
  }

  /**
   * Resets this vent back to dormant state (e.g. on respawn or scene restart).
   */
  public reset(): void {
    this.state = 'dormant';
    this.stateTimer = 0;
    this.cleanupParticles();
    this.drawBase();
    this.drawDormantVisuals();
  }

  public destroy(): void {
    this.cleanupParticles();
    this.baseGraphics.destroy();
    this.zoneGraphics.destroy();
  }

  private enterCooldown(): void {
    this.state = 'cooldown';
    this.stateTimer = THERMAL_VENT_CONFIG.cooldownDuration;
    this.cleanupParticles();
    this.drawBase();
    this.drawCooldownVisuals();
  }

  private cleanupParticles(): void {
    if (this.emitter) {
      this.emitter.destroy();
      this.emitter = undefined;
    }
  }

  private drawBase(): void {
    this.baseGraphics.clear();
    const bx = this.x;
    const by = this.y;

    if (this.type === 'updraft') {
      // Floor nozzle grate
      this.baseGraphics.fillStyle(0x1a1a24, 1);
      this.baseGraphics.fillRect(bx - 14, by - 6, 28, 6);
      this.baseGraphics.lineStyle(1, 0x333344, 1);
      this.baseGraphics.strokeRect(bx - 14, by - 6, 28, 6);

      // Slits
      const glowColor = this.state === 'active' ? 0xffdd00 : (this.state === 'cooldown' ? 0x553322 : 0xff6600);
      this.baseGraphics.fillStyle(glowColor, 1);
      this.baseGraphics.fillRect(bx - 10, by - 4, 4, 3);
      this.baseGraphics.fillRect(bx - 2, by - 4, 4, 3);
      this.baseGraphics.fillRect(bx + 6, by - 4, 4, 3);
    } else {
      // Wall / edge nozzle
      this.baseGraphics.fillStyle(0x1a1a24, 1);
      this.baseGraphics.fillRect(bx - 6, by - 12, 6, 24);
      this.baseGraphics.lineStyle(1, 0x333344, 1);
      this.baseGraphics.strokeRect(bx - 6, by - 12, 6, 24);

      // Slits
      const glowColor = this.state === 'active' ? 0xffdd00 : (this.state === 'cooldown' ? 0x553322 : 0xff6600);
      this.baseGraphics.fillStyle(glowColor, 1);
      this.baseGraphics.fillRect(bx - 4, by - 8, 3, 4);
      this.baseGraphics.fillRect(bx - 4, by - 2, 3, 4);
      this.baseGraphics.fillRect(bx - 4, by + 4, 3, 4);
    }
  }

  private drawDormantVisuals(): void {
    this.zoneGraphics.clear();
    this.zoneGraphics.setAlpha(1);

    const zb = this.zoneBounds;

    // Outline dormant effect zone with subtle amber dash/stroke
    this.zoneGraphics.lineStyle(1.5, 0xff8800, 0.4);
    this.zoneGraphics.strokeRect(zb.x, zb.y, zb.width, zb.height);

    // Corner markers
    const markerLen = 6;
    this.zoneGraphics.lineStyle(2, 0xffaa00, 0.7);
    // Top-left
    this.zoneGraphics.lineBetween(zb.x, zb.y, zb.x + markerLen, zb.y);
    this.zoneGraphics.lineBetween(zb.x, zb.y, zb.x, zb.y + markerLen);
    // Top-right
    this.zoneGraphics.lineBetween(zb.x + zb.width, zb.y, zb.x + zb.width - markerLen, zb.y);
    this.zoneGraphics.lineBetween(zb.x + zb.width, zb.y, zb.x + zb.width, zb.y + markerLen);
    // Bottom-left
    this.zoneGraphics.lineBetween(zb.x, zb.y + zb.height, zb.x + markerLen, zb.y + zb.height);
    this.zoneGraphics.lineBetween(zb.x, zb.y + zb.height, zb.x, zb.y + zb.height - markerLen);
    // Bottom-right
    this.zoneGraphics.lineBetween(zb.x + zb.width, zb.y + zb.height, zb.x + zb.width - markerLen, zb.y + zb.height);
    this.zoneGraphics.lineBetween(zb.x + zb.width, zb.y + zb.height, zb.x + zb.width, zb.y + zb.height - markerLen);

    // Flow arrows (pointing in effect direction)
    this.zoneGraphics.lineStyle(2, 0xffaa00, 0.55);
    if (this.type === 'updraft') {
      const cx = this.x;
      const count = Math.max(2, Math.floor(zb.height / 45));
      const step = zb.height / (count + 1);
      for (let i = 1; i <= count; i++) {
        const cy = zb.y + step * i;
        this.zoneGraphics.lineBetween(cx - 7, cy + 4, cx, cy - 4);
        this.zoneGraphics.lineBetween(cx, cy - 4, cx + 7, cy + 4);
      }
    } else {
      const cy = this.y;
      const count = Math.max(2, Math.floor(zb.width / 55));
      const step = zb.width / (count + 1);
      for (let i = 1; i <= count; i++) {
        const cx = zb.x + step * i;
        this.zoneGraphics.lineBetween(cx - 4, cy - 7, cx + 4, cy);
        this.zoneGraphics.lineBetween(cx + 4, cy, cx - 4, cy + 7);
      }
    }
  }

  private drawActiveVisuals(): void {
    this.zoneGraphics.clear();
    this.zoneGraphics.setAlpha(1);

    const zb = this.zoneBounds;

    // Glowing active boundary
    this.zoneGraphics.fillStyle(0xff6600, 0.12);
    this.zoneGraphics.fillRect(zb.x, zb.y, zb.width, zb.height);

    this.zoneGraphics.lineStyle(2, 0xffaa00, 0.85);
    this.zoneGraphics.strokeRect(zb.x, zb.y, zb.width, zb.height);

    // Active directional arrows in bright yellow/gold
    this.zoneGraphics.lineStyle(2.5, 0xffdd00, 0.9);
    if (this.type === 'updraft') {
      const cx = this.x;
      const count = Math.max(2, Math.floor(zb.height / 40));
      const step = zb.height / (count + 1);
      for (let i = 1; i <= count; i++) {
        const cy = zb.y + step * i;
        this.zoneGraphics.lineBetween(cx - 8, cy + 5, cx, cy - 5);
        this.zoneGraphics.lineBetween(cx, cy - 5, cx + 8, cy + 5);
      }

      // Updraft particle column using existing 'proto_tile'
      this.emitter = this.scene.add.particles(this.x, this.y - 4, 'proto_tile', {
        x: { min: -zb.width * 0.35, max: zb.width * 0.35 },
        y: { min: -2, max: 2 },
        speedY: { min: -240, max: -140 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.22, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xff4400, 0xff8800, 0xffdd00, 0xffffff],
        lifespan: Math.round((zb.height / 190) * 1000),
        frequency: 30
      }).setDepth(6);
    } else {
      const cy = this.y;
      const count = Math.max(2, Math.floor(zb.width / 50));
      const step = zb.width / (count + 1);
      for (let i = 1; i <= count; i++) {
        const cx = zb.x + step * i;
        this.zoneGraphics.lineBetween(cx - 5, cy - 8, cx + 5, cy);
        this.zoneGraphics.lineBetween(cx + 5, cy, cx - 5, cy + 8);
      }

      // Convection particle stream using existing 'proto_tile'
      this.emitter = this.scene.add.particles(this.x + 4, this.y, 'proto_tile', {
        x: { min: 0, max: 4 },
        y: { min: -zb.height * 0.35, max: zb.height * 0.35 },
        speedX: { min: 140, max: 240 },
        speedY: { min: -10, max: 10 },
        scale: { start: 0.22, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xff4400, 0xff8800, 0xffdd00, 0xffffff],
        lifespan: Math.round((zb.width / 190) * 1000),
        frequency: 30
      }).setDepth(6);
    }
  }

  private drawCooldownVisuals(): void {
    this.zoneGraphics.clear();
    this.zoneGraphics.setAlpha(0.35);

    const zb = this.zoneBounds;
    // Dim inactive border during cooldown
    this.zoneGraphics.lineStyle(1, 0x444455, 0.4);
    this.zoneGraphics.strokeRect(zb.x, zb.y, zb.width, zb.height);
  }
}
