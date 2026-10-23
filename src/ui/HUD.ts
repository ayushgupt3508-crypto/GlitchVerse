import Phaser from 'phaser';
import { IHudChargeDisplay } from '../systems/staff/StaffController';
import { AudioManager } from '../systems/AudioManager';
import { TextureGenerator } from '../utils/TextureGenerator';

const GAME_FONTS = {
  primary: 'Pixel Operator',
  heading: 'Press Start 2P'
};

/**
 * HUD — Redesigned to match reference image:
 *  • Dark full-width top bar
 *  • Top-left: portrait circle + dark pill container with ♥♥♥ hearts
 *  • Top-center: dark pill badge with side chevrons + sector title
 *  • Top-right: dark oval failsafe counter + gold circular home button
 *  • Bottom-left: staff charge crystals panel
 *  • Center: animated notification banner
 */
export class HUD extends Phaser.GameObjects.Container implements IHudChargeDisplay {
  private bannerText!: Phaser.GameObjects.Text;
  private componentCountText!: Phaser.GameObjects.Text;
  private chargeCrystals: Phaser.GameObjects.Rectangle[] = [];
  private integrityHearts: Phaser.GameObjects.Graphics[] = [];
  private readonly accent: number;

  constructor(
    scene: Phaser.Scene,
    title = 'SECTOR 1  ·  FROZEN AGE',
    accentColor = 0x48cae4
  ) {
    super(scene, 0, 0);
    this.setScrollFactor(0);
    this.setDepth(50);
    this.accent = accentColor;

    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // ── Full-width translucent top bar ─────────────────────────────────
    const topBar = scene.add.graphics();
    topBar.fillStyle(0x000000, 0.5);
    topBar.fillRect(0, 0, W, 72);
    // Subtle glow line at bottom of bar
    topBar.fillStyle(accentColor, 0.18);
    topBar.fillRect(0, 70, W, 2);
    this.add(topBar);

    // ── Top-Left: Portrait + Hearts ──────────────────────────────────
    this.buildPortraitArea(scene, accentColor);

    // ── Top-Center: Level badge with chevrons ─────────────────────────
    this.buildLevelBadge(scene, W, title, accentColor);

    // ── Top-Right: Failsafe counter + Home button ─────────────────────
    this.buildTopRight(scene, W, accentColor);

    // ── Bottom-Left: Staff charges ────────────────────────────────────
    this.buildChargeBar(scene, H, accentColor);

    // ── Center banner ─────────────────────────────────────────────────
    this.bannerText = scene.add.text(W / 2, 80, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      color: '#' + accentColor.toString(16).padStart(6, '0'),
      backgroundColor: '#080410cc',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setAlpha(0).setDepth(55);
    this.add(this.bannerText);

    scene.add.existing(this);
  }

  // ── Portrait + Heart Bar ──────────────────────────────────────────────

  private buildPortraitArea(scene: Phaser.Scene, accentColor: number): void {
    const hex = '#' + accentColor.toString(16).padStart(6, '0');

    // Dark pill container behind portrait+hearts
    const container = scene.add.graphics();
    container.fillStyle(0x0a0612, 0.92);
    container.fillRoundedRect(6, 6, 158, 62, 12);
    container.lineStyle(2, accentColor, 0.55);
    container.strokeRoundedRect(6, 6, 158, 62, 12);
    this.add(container);

    // Portrait frame & backdrop
    const portraitFrame = scene.add.graphics();
    portraitFrame.fillStyle(0x0a101d, 1);
    portraitFrame.fillCircle(36, 37, 24);
    portraitFrame.lineStyle(2.5, accentColor, 1);
    portraitFrame.strokeCircle(36, 37, 26);
    portraitFrame.lineStyle(1, 0xffffff, 0.4);
    portraitFrame.strokeCircle(36, 37, 24);
    this.add(portraitFrame);

    // Profile icon image from assets/icon profile.png
    TextureGenerator.generateCircularProfileTexture(scene);
    const textureKey = scene.textures.exists('profile_icon_circle')
      ? 'profile_icon_circle'
      : (scene.textures.exists('profile_icon') ? 'profile_icon' : 'proto_tile');

    const portraitImg = scene.add.image(36, 37, textureKey)
      .setDisplaySize(48, 48);

    if (!scene.textures.exists('profile_icon')) {
      scene.load.image('profile_icon', 'assets/icon_profile.png');
      scene.load.once('complete', () => {
        TextureGenerator.generateCircularProfileTexture(scene);
        const finalKey = scene.textures.exists('profile_icon_circle') ? 'profile_icon_circle' : 'profile_icon';
        portraitImg.setTexture(finalKey);
        portraitImg.setDisplaySize(48, 48);
      });
      scene.load.start();
    }
    this.add(portraitImg);

    // Name label
    this.add(scene.add.text(36, 66, 'VANCE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '6px',
      color: hex
    }).setOrigin(0.5));

    // Hearts row
    for (let i = 0; i < 3; i++) {
      const g = scene.add.graphics();
      this.drawHeart(g, 88 + i * 26, 30, true, accentColor);
      this.integrityHearts.push(g);
      this.add(g);
    }

    // "HP" label
    this.add(scene.add.text(88, 48, 'HP', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '7px',
      color: hex
    }));
  }

  /**
   * Draw a heart shape using two circles (bumps) + downward triangle (point).
   */
  private drawHeart(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    filled: boolean,
    accentColor: number
  ): void {
    g.clear();
    const fillCol = filled ? accentColor : 0x1a0a10;
    const alpha   = filled ? 1 : 0.35;

    g.fillStyle(fillCol, alpha);
    // Left lobe
    g.fillCircle(x - 5, y - 2, 7);
    // Right lobe
    g.fillCircle(x + 5, y - 2, 7);
    // Bottom point
    g.fillTriangle(x - 11, y + 4, x + 11, y + 4, x, y + 14);

    if (filled) {
      // Specular highlight on active heart
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(x - 5, y - 5, 3);
    } else {
      // Distinct empty heart outline for depleted state
      g.lineStyle(1.5, 0x5a1828, 0.85);
      g.strokeCircle(x - 5, y - 2, 7);
      g.strokeCircle(x + 5, y - 2, 7);
      g.strokeTriangle(x - 11, y + 4, x + 11, y + 4, x, y + 14);
    }
  }

  // ── Level Badge ──────────────────────────────────────────────────────────

  private buildLevelBadge(
    scene: Phaser.Scene,
    W: number,
    title: string,
    accentColor: number
  ): void {
    const cx  = W / 2;
    const hex = '#' + accentColor.toString(16).padStart(6, '0');

    const bg = scene.add.graphics();
    // Main dark pill
    bg.fillStyle(0x0a0612, 0.92);
    bg.fillRoundedRect(cx - 90, 8, 180, 36, 18);
    bg.lineStyle(2, accentColor, 0.85);
    bg.strokeRoundedRect(cx - 90, 8, 180, 36, 18);
    // Shiny highlight strip
    bg.fillStyle(accentColor, 0.22);
    bg.fillRoundedRect(cx - 80, 9, 160, 10, 5);

    // Left chevron ►
    bg.fillStyle(accentColor, 1);
    bg.fillTriangle(cx - 98, 26, cx - 84, 19, cx - 84, 33);
    bg.fillTriangle(cx - 104, 26, cx - 90, 19, cx - 90, 33);

    // Right chevron ◄
    bg.fillTriangle(cx + 98, 26, cx + 84, 19, cx + 84, 33);
    bg.fillTriangle(cx + 104, 26, cx + 90, 19, cx + 90, 33);
    this.add(bg);

    this.add(scene.add.text(cx, 26, title, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      color: hex,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5));
  }

  // ── Top-Right: Counter + Home ─────────────────────────────────────────────

  private pausePlate?: Phaser.GameObjects.Arc;
  private pauseBtn?: Phaser.GameObjects.Image;
  private pauseZone?: Phaser.GameObjects.Zone;

  private buildTopRight(scene: Phaser.Scene, W: number, accentColor: number): void {
    // Dark oval failsafe counter (like reference score bubble)
    const oval = scene.add.graphics();
    oval.fillStyle(0x0a0612, 0.92);
    oval.fillRoundedRect(W - 144, 10, 88, 32, 16);
    oval.lineStyle(2, accentColor, 0.65);
    oval.strokeRoundedRect(W - 144, 10, 88, 32, 16);
    this.add(oval);

    this.add(scene.add.text(W - 134, 26, '⚡', {
      fontSize: '13px', color: '#ffd166'
    }).setOrigin(0, 0.5));

    this.componentCountText = scene.add.text(W - 114, 26, '0 / 5', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.add(this.componentCountText);

    // ── Direct Scene Pause Button (bi_pause-circle-fill) ─────────────────────
    // Kept outside the Container so camera scrolling does not cause matrix drift
    this.pausePlate = scene.add.circle(W - 28, 26, 18, 0x0a0612, 0.95)
      .setStrokeStyle(1.5, accentColor, 0.85)
      .setScrollFactor(0)
      .setDepth(240);

    const pauseIconKey = scene.textures.exists('pause_icon') ? 'pause_icon' : 'proto_tile';
    this.pauseBtn = scene.add.image(W - 28, 26, pauseIconKey)
      .setDisplaySize(32, 32)
      .setTint(0xffd166) // Radiant failsafe gold matching score counter
      .setScrollFactor(0)
      .setDepth(241);

    if (!scene.textures.exists('pause_icon')) {
      scene.load.image('pause_icon', 'assets/bi_pause-circle-fill.png');
      scene.load.once('complete', () => {
        this.pauseBtn?.setTexture('pause_icon');
        this.pauseBtn?.setDisplaySize(32, 32);
        this.pauseBtn?.setTint(0xffd166);
      });
      scene.load.start();
    }

    // Direct scene hit zone — 42x42 square hit box
    this.pauseZone = scene.add.zone(W - 28, 26, 42, 42)
      .setScrollFactor(0)
      .setDepth(245)
      .setInteractive({ useHandCursor: true });

    this.pauseZone.on('pointerover', () => {
      this.pausePlate?.setStrokeStyle(2, 0xffffff, 1);
      this.pausePlate?.setFillStyle(0x1a2638, 0.98);
      if (this.pauseBtn) {
        scene.tweens.killTweensOf(this.pauseBtn);
        scene.tweens.add({
          targets: this.pauseBtn,
          displayWidth: 36,
          displayHeight: 36,
          duration: 90
        });
      }
      AudioManager.playMenuHover();
    });

    this.pauseZone.on('pointerout', () => {
      this.pausePlate?.setStrokeStyle(1.5, accentColor, 0.85);
      this.pausePlate?.setFillStyle(0x0a0612, 0.95);
      if (this.pauseBtn) {
        scene.tweens.killTweensOf(this.pauseBtn);
        scene.tweens.add({
          targets: this.pauseBtn,
          displayWidth: 32,
          displayHeight: 32,
          duration: 90
        });
      }
    });

    this.pauseZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.pauseBtn?.setDisplaySize(28, 28);
      AudioManager.playMenuSelect();
      this.emit('pause_requested');
    });

    this.pauseZone.on('pointerup', () => {
      this.pauseBtn?.setDisplaySize(36, 36);
    });

    // Keyboard shortcuts for pausing: ESC and P
    if (scene.input.keyboard) {
      const escKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      escKey.on('down', () => {
        AudioManager.playMenuSelect();
        this.emit('pause_requested');
      });
      const pKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      pKey.on('down', () => {
        AudioManager.playMenuSelect();
        this.emit('pause_requested');
      });
    }

    scene.events.once('shutdown', () => {
      this.pausePlate?.destroy();
      this.pauseBtn?.destroy();
      this.pauseZone?.destroy();
    });
  }

  // ── Staff Charges ─────────────────────────────────────────────────────────

  private buildChargeBar(scene: Phaser.Scene, H: number, accentColor: number): void {
    const hex = '#' + accentColor.toString(16).padStart(6, '0');
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0612, 0.9);
    bg.fillRoundedRect(10, H - 40, 136, 32, 9);
    bg.lineStyle(1, accentColor, 0.65);
    bg.strokeRoundedRect(10, H - 40, 136, 32, 9);
    this.add(bg);

    this.add(scene.add.text(20, H - 24, 'STAFF', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '8px',
      color: hex
    }).setOrigin(0, 0.5));

    for (let i = 0; i < 3; i++) {
      const crystal = scene.add.rectangle(76 + i * 22, H - 24, 15, 15, accentColor);
      crystal.setStrokeStyle(1, 0xffffff, 0.6);
      this.chargeCrystals.push(crystal);
      this.add(crystal);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public updateIntegrity(current: number): void {
    this.integrityHearts.forEach((g, idx) => {
      const hx = 88 + idx * 26;
      this.drawHeart(g, hx, 30, idx < current, this.accent);
    });
  }

  public updateCharges(current: number, max?: number): void {
    const H = this.scene.cameras.main.height;
    // Reconfigure crystals array if max differs
    if (max !== undefined && max !== this.chargeCrystals.length && max > 0) {
      this.chargeCrystals.forEach(c => c.destroy());
      this.chargeCrystals = [];
      const crystalSpacing = Math.min(22, 70 / Math.max(1, max));
      for (let i = 0; i < max; i++) {
        const crystal = this.scene.add.rectangle(76 + i * crystalSpacing, H - 24, 15, 15, this.accent);
        crystal.setStrokeStyle(1, 0xffffff, 0.6);
        this.chargeCrystals.push(crystal);
        this.add(crystal);
      }
    }

    this.chargeCrystals.forEach((c, idx) => {
      if (idx < current) {
        c.setFillStyle(this.accent, 1);
        c.setStrokeStyle(1, 0xffffff, 0.7);
      } else {
        c.setFillStyle(0x0a0410, 1);
        c.setStrokeStyle(1, 0x222222, 0.4);
      }
    });
  }

  public flashChargeWarning(): void {
    this.chargeCrystals.forEach(c => {
      this.scene.tweens.killTweensOf(c);
      c.setFillStyle(0xff0055, 1);
      c.setStrokeStyle(1.5, 0xff5588, 1);
      this.scene.tweens.add({
        targets: c,
        scaleX: 1.25,
        scaleY: 1.25,
        yoyo: true,
        repeat: 2,
        duration: 80,
        onComplete: () => {
          c.setScale(1);
        }
      });
    });
  }

  public setFailsafeFound(collected: number, total = 5): void {
    this.componentCountText.setText(`${collected} / ${total}`);
    this.showBanner(`FAILSAFE COMPONENT ${String(collected).padStart(2, '0')} RECOVERED!`);
  }

  public showBanner(message: string): void {
    this.bannerText.setText(message).setAlpha(1);
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.add({
      targets: this.bannerText,
      alpha: 0,
      delay: 2600,
      duration: 600,
      ease: 'Power2'
    });
  }

  public onPauseClicked(callback: () => void): void {
    this.on('pause_requested', callback);
  }

  public override destroy(fromScene?: boolean): void {
    this.pausePlate?.destroy();
    this.pauseBtn?.destroy();
    this.pauseZone?.destroy();
    super.destroy(fromScene);
  }
}
