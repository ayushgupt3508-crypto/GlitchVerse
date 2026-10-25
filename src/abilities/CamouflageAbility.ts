import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AudioManager } from '../systems/AudioManager';

/**
 * CamouflageAbility — Temporal Illusion Matrix for Vance in Sector 3 (Medieval Palace).
 *
 * Mechanics:
 * ──────────
 *  • Temporary illusion: lasts 4.5 seconds (NOT permanent invisibility).
 *  • Dual effect tailored for guard puzzles:
 *     1. Optical Concealment: Vance gains translucent outline & refractive shimmer.
 *        Guards cannot detect or alert to Vance while cloaked.
 *     2. Holographic Decoy: Deploys an illusory phantom at Vance's position.
 *        Patrolling guards detect the decoy's vision signature, turn, and investigate it.
 *  • Cooldown: 6.0 seconds after cloak expires.
 *  • Visual feedback:
 *     - Translucent-outline: neon cyan/gold glowing silhouette contour following player.
 *     - Refraction feedback: expanding refractive ripples, wave pulses, and glint particles.
 *     - Decoy hologram: shimmering scanline phantom clone with pulse ring.
 *  • Input: [C] or [Q] key, or screen click / ability button.
 */
export class CamouflageAbility {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;

  // Timers (ms)
  public readonly DURATION = 4500;
  public readonly COOLDOWN = 6000;
  private activeTimer = 0;
  private cooldownTimer = 0;
  private isCloaked = false;

  // Decoy entity & target
  private decoySprite: Phaser.GameObjects.Sprite | null = null;
  private decoyRingsGfx: Phaser.GameObjects.Graphics | null = null;
  public decoyPos: { x: number; y: number } | null = null;
  private decoyTimer = 0;
  private readonly DECOY_DURATION = 4000;

  // Visual effects
  private readonly outlineGfx: Phaser.GameObjects.Graphics;
  private readonly refractionGfx: Phaser.GameObjects.Graphics;
  private refractionEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Keys
  private keyC?: Phaser.Input.Keyboard.Key;
  private keyQ?: Phaser.Input.Keyboard.Key;

  // UI HUD widget
  private hudWidget?: Phaser.GameObjects.Container;
  private hudStatusText?: Phaser.GameObjects.Text;
  private hudBarFill?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    // Graphics layers (rendered at depth 8 - above background, below foreground)
    this.refractionGfx = scene.add.graphics().setDepth(8);
    this.outlineGfx = scene.add.graphics().setDepth(15);

    // Setup keyboard inputs [C] and [Q]
    if (scene.input.keyboard) {
      this.keyC = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.keyQ = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    }

    // Create on-screen HUD badge for ability status
    this.createHudWidget();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** True if the optical camouflage illusion is currently active. */
  public get cloaked(): boolean {
    return this.isCloaked;
  }

  /** Position of the active decoy phantom, or null if none active. */
  public get decoy(): { x: number; y: number } | null {
    return this.decoyPos;
  }

  /** True if the ability is ready to be triggered. */
  public get isReady(): boolean {
    return !this.isCloaked && this.cooldownTimer <= 0 && !this.player.isDead;
  }

  /**
   * Activate the Temporal Illusion (Cloak + Decoy).
   * Returns true if successfully activated.
   */
  public activate(): boolean {
    if (!this.isReady) return false;

    this.isCloaked = true;
    this.activeTimer = this.DURATION;
    this.cooldownTimer = this.COOLDOWN;

    // 1. Audio feedback
    AudioManager.playCamouflageActivate();
    AudioManager.playDecoyDeploy();

    // 2. Camera micro-pulse
    this.scene.cameras.main.flash(120, 0, 240, 255);

    // 3. Player appearance: translucent + refraction tint
    this.player.setAlpha(0.32);
    this.player.setTint(0x80ffff);

    // 4. Spawn Holographic Decoy at player position
    this.spawnDecoy(this.player.x, this.player.y);

    // 5. Spawn Refraction Glint Emitter
    this.startRefractionParticles();

    return true;
  }

  /**
   * Call from scene.update() every frame.
   */
  public update(time: number, delta: number): void {
    // Input polling
    const justPressed =
      (this.keyC ? Phaser.Input.Keyboard.JustDown(this.keyC) : false) ||
      (this.keyQ ? Phaser.Input.Keyboard.JustDown(this.keyQ) : false);

    if (justPressed) {
      this.activate();
    }

    // ── Active Cloak Loop ─────────────────────────────────────────────────
    if (this.isCloaked) {
      this.activeTimer -= delta;

      // Draw translucent outline & refraction ripples around player
      this.drawTranslucentOutline(time);
      this.drawRefractionWaves(time);

      if (this.activeTimer <= 0) {
        this.deactivate();
      }
    } else {
      this.outlineGfx.clear();
      this.refractionGfx.clear();

      // Cooldown timer
      if (this.cooldownTimer > 0) {
        this.cooldownTimer -= delta;
        if (this.cooldownTimer <= 0) {
          this.cooldownTimer = 0;
          AudioManager.playConduitRecharge(); // subtle ready chime
          this.flashReadyFeedback();
        }
      }
    }

    // ── Decoy Loop ────────────────────────────────────────────────────────
    if (this.decoySprite && this.decoySprite.active) {
      this.decoyTimer -= delta;
      this.updateDecoyVisuals(time);

      if (this.decoyTimer <= 0) {
        this.destroyDecoy();
      }
    }

    // ── HUD Feedback Update ───────────────────────────────────────────────
    this.updateHudWidget();
  }

  // ── State Transitions ───────────────────────────────────────────────────

  private deactivate(): void {
    this.isCloaked = false;
    this.activeTimer = 0;

    // Reset player appearance if alive
    if (!this.player.isDead) {
      this.player.setAlpha(1);
      this.player.clearTint();
    }

    // Audio & particle cleanup
    AudioManager.playCamouflageDeactivate();
    this.stopRefractionParticles();

    this.outlineGfx.clear();
    this.refractionGfx.clear();
  }

  // ── Decoy Hologram ──────────────────────────────────────────────────────

  private spawnDecoy(x: number, y: number): void {
    this.destroyDecoy();

    this.decoyPos = { x, y };
    this.decoyTimer = this.DECOY_DURATION;

    // Decoy sprite
    this.decoySprite = this.scene.add.sprite(x, y, 'decoy_hologram')
      .setDepth(9)
      .setAlpha(0.85);

    // Holographic jitter tween
    this.scene.tweens.add({
      targets: this.decoySprite,
      alpha: { from: 0.85, to: 0.4 },
      yoyo: true,
      repeat: -1,
      duration: 120
    });

    // Ring graphics for ground sensory pulse
    this.decoyRingsGfx = this.scene.add.graphics().setDepth(7);

    // Initial deployment burst particles
    const emitter = this.scene.add.particles(x, y, 'proto_tile', {
      speed: { min: 40, max: 110 },
      scale: { start: 0.35, end: 0 },
      tint: [0x00f0ff, 0xffd166, 0x48cae4],
      lifespan: 500,
      quantity: 16
    });
    this.scene.time.delayedCall(550, () => emitter.destroy());
  }

  private updateDecoyVisuals(time: number): void {
    if (!this.decoyRingsGfx || !this.decoyPos) return;

    this.decoyRingsGfx.clear();

    // Pulse expanding concentric cyan rings around decoy ground base
    const pulsePhase = (time % 1200) / 1200;
    const r1 = pulsePhase * 40;
    const alpha1 = Math.max(0, 1 - pulsePhase);

    this.decoyRingsGfx.lineStyle(1.5, 0x00f0ff, alpha1 * 0.7);
    this.decoyRingsGfx.strokeCircle(this.decoyPos.x, this.decoyPos.y + 14, r1);

    const pulsePhase2 = ((time + 600) % 1200) / 1200;
    const r2 = pulsePhase2 * 40;
    const alpha2 = Math.max(0, 1 - pulsePhase2);

    this.decoyRingsGfx.lineStyle(1.5, 0xffd166, alpha2 * 0.6);
    this.decoyRingsGfx.strokeCircle(this.decoyPos.x, this.decoyPos.y + 14, r2);
  }

  private destroyDecoy(): void {
    if (this.decoySprite) {
      // Dissolution burst
      if (this.decoyPos) {
        const emitter = this.scene.add.particles(this.decoyPos.x, this.decoyPos.y, 'proto_tile', {
          speed: { min: 20, max: 70 },
          scale: { start: 0.25, end: 0 },
          tint: [0x00f0ff, 0x8899aa],
          lifespan: 400,
          quantity: 10
        });
        this.scene.time.delayedCall(450, () => emitter.destroy());
      }
      this.decoySprite.destroy();
      this.decoySprite = null;
    }
    if (this.decoyRingsGfx) {
      this.decoyRingsGfx.destroy();
      this.decoyRingsGfx = null;
    }
    this.decoyPos = null;
  }

  // ── Visual Feedback: Translucent Outline & Refraction ───────────────────

  /**
   * Draws translucent outline feedback contour following the player sprite.
   */
  private drawTranslucentOutline(time: number): void {
    this.outlineGfx.clear();

    const px = this.player.x;
    const py = this.player.y;
    const w = 18;
    const h = 34;

    // Dynamic outline pulse
    const shimmer = 0.55 + 0.35 * Math.sin(time * 0.012);
    const outlineCol = 0x00f0ff;

    // 1. Translucent glowing inner silhouette
    this.outlineGfx.fillStyle(outlineCol, 0.12 * shimmer);
    this.outlineGfx.fillRoundedRect(px - w / 2, py - h / 2, w, h, 6);

    // 2. High-contrast translucent perimeter line
    this.outlineGfx.lineStyle(2, outlineCol, shimmer);
    this.outlineGfx.strokeRoundedRect(px - w / 2, py - h / 2, w, h, 6);

    // 3. Golden corner tick brackets (technological camouflage focal markers)
    this.outlineGfx.lineStyle(1.5, 0xffd166, 0.9);
    const cw = 4;
    // top-left
    this.outlineGfx.lineBetween(px - w / 2 - 2, py - h / 2, px - w / 2 + cw, py - h / 2);
    this.outlineGfx.lineBetween(px - w / 2, py - h / 2 - 2, px - w / 2, py - h / 2 + cw);
    // top-right
    this.outlineGfx.lineBetween(px + w / 2 - cw, py - h / 2, px + w / 2 + 2, py - h / 2);
    this.outlineGfx.lineBetween(px + w / 2, py - h / 2 - 2, px + w / 2, py - h / 2 + cw);
    // bottom-left
    this.outlineGfx.lineBetween(px - w / 2 - 2, py + h / 2, px - w / 2 + cw, py + h / 2);
    this.outlineGfx.lineBetween(px - w / 2, py + h / 2 - cw, px - w / 2, py + h / 2 + 2);
    // bottom-right
    this.outlineGfx.lineBetween(px + w / 2 - cw, py + h / 2, px + w / 2 + 2, py + h / 2);
    this.outlineGfx.lineBetween(px + w / 2, py + h / 2 - cw, px + w / 2, py + h / 2 + 2);
  }

  /**
   * Draws dynamic refraction waves and optical ripples around Vance.
   */
  private drawRefractionWaves(time: number): void {
    this.refractionGfx.clear();

    const px = this.player.x;
    const py = this.player.y;

    // 1. Expanding refractive concentric shockwave rings
    const wave1 = (time % 800) / 800;
    const r1 = 8 + wave1 * 26;
    const alpha1 = (1 - wave1) * 0.6;
    this.refractionGfx.lineStyle(1.5, 0x00f0ff, alpha1);
    this.refractionGfx.strokeEllipse(px, py, r1 * 0.8, r1 * 1.2);

    const wave2 = ((time + 400) % 800) / 800;
    const r2 = 8 + wave2 * 26;
    const alpha2 = (1 - wave2) * 0.5;
    this.refractionGfx.lineStyle(1.5, 0x88ffff, alpha2);
    this.refractionGfx.strokeEllipse(px, py, r2 * 0.8, r2 * 1.2);

    // 2. Optical refraction horizontal scanline slices
    this.refractionGfx.lineStyle(1, 0xd4af37, 0.4);
    for (let i = -14; i <= 14; i += 6) {
      const offsetX = Math.sin((time * 0.01) + i) * 3;
      this.refractionGfx.lineBetween(px - 10 + offsetX, py + i, px + 10 + offsetX, py + i);
    }
  }

  private startRefractionParticles(): void {
    if (this.refractionEmitter) return;

    this.refractionEmitter = this.scene.add.particles(this.player.x, this.player.y, 'proto_tile', {
      speed: { min: 10, max: 35 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0x00f0ff, 0x88ffff, 0xffd166],
      lifespan: 350,
      frequency: 60,
      follow: this.player
    }).setDepth(14);
  }

  private stopRefractionParticles(): void {
    if (this.refractionEmitter) {
      this.refractionEmitter.destroy();
      this.refractionEmitter = undefined;
    }
  }

  private flashReadyFeedback(): void {
    const flash = this.scene.add.circle(this.player.x, this.player.y, 20, 0x00f0ff, 0.6).setDepth(20);
    this.scene.tweens.add({
      targets: flash,
      scale: 2.2,
      alpha: 0,
      duration: 350,
      onComplete: () => flash.destroy()
    });
  }

  // ── HUD Ability Widget ──────────────────────────────────────────────────

  private createHudWidget(): void {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    // Positioned at bottom-right corner
    const widgetX = W - 148;
    const widgetY = H - 38;

    this.hudWidget = this.scene.add.container(widgetX, widgetY).setScrollFactor(0).setDepth(52);

    // Dark pill container
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0c14, 0.9);
    bg.fillRoundedRect(0, 0, 138, 28, 8);
    bg.lineStyle(1.5, 0xd4af37, 0.85);
    bg.strokeRoundedRect(0, 0, 138, 28, 8);
    this.hudWidget.add(bg);

    // Interactive button click trigger
    const hitZone = this.scene.add.zone(0, 0, 138, 28)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this.activate());
    this.hudWidget.add(hitZone);

    // Gauge bar background
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x1a1e28, 0.95);
    barBg.fillRoundedRect(6, 17, 126, 6, 3);
    this.hudWidget.add(barBg);

    // Gauge bar fill
    this.hudBarFill = this.scene.add.graphics();
    this.hudWidget.add(this.hudBarFill);

    // Status text
    this.hudStatusText = this.scene.add.text(69, 9, '[C] ILLUSION: READY', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.hudWidget.add(this.hudStatusText);
  }

  private updateHudWidget(): void {
    if (!this.hudStatusText || !this.hudBarFill) return;

    this.hudBarFill.clear();

    if (this.isCloaked) {
      const remainingSec = (this.activeTimer / 1000).toFixed(1);
      this.hudStatusText.setText(`[C] ILLUSION: ACTIVE [${remainingSec}s]`);
      this.hudStatusText.setColor('#00f0ff');

      // Cyan draining bar
      const pct = Math.max(0, this.activeTimer / this.DURATION);
      this.hudBarFill.fillStyle(0x00f0ff, 1);
      this.hudBarFill.fillRoundedRect(6, 17, 126 * pct, 6, 3);
    } else if (this.cooldownTimer > 0) {
      const remainingSec = (this.cooldownTimer / 1000).toFixed(1);
      this.hudStatusText.setText(`[C] RECHARGING [${remainingSec}s]`);
      this.hudStatusText.setColor('#ffaa44');

      // Orange filling bar
      const pct = 1 - (this.cooldownTimer / this.COOLDOWN);
      this.hudBarFill.fillStyle(0xffaa44, 0.9);
      this.hudBarFill.fillRoundedRect(6, 17, 126 * pct, 6, 3);
    } else {
      this.hudStatusText.setText('[C] ILLUSION: READY');
      this.hudStatusText.setColor('#ffd166');

      // Full gold bar with subtle shimmer
      this.hudBarFill.fillStyle(0xd4af37, 1);
      this.hudBarFill.fillRoundedRect(6, 17, 126, 6, 3);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  public destroy(): void {
    this.destroyDecoy();
    this.stopRefractionParticles();
    this.outlineGfx.destroy();
    this.refractionGfx.destroy();
    this.hudWidget?.destroy();
  }
}
