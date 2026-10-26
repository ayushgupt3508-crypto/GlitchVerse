import Phaser from 'phaser';
import { IHudChargeDisplay } from '../systems/staff/StaffController';
import { AudioManager } from '../systems/AudioManager';
import { TextureGenerator } from '../utils/TextureGenerator';
import { GuideModal } from './GuideModal';

import { GAME_FONTS } from '../config';
export { GAME_FONTS };

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
  private integrityHearts: Phaser.GameObjects.Image[] = [];
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

    // ── Staff charges: Just below heart bar section ───────────────────
    this.buildChargeBar(scene, accentColor);

    // ── Center banner ─────────────────────────────────────────────────
    this.bannerText = scene.add.text(W / 2, 80, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#' + accentColor.toString(16).padStart(6, '0'),
      backgroundColor: '#080410ee',
      stroke: '#000000',
      strokeThickness: 3,
      padding: { x: 12, y: 6 }
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
      fontSize: '9px',
      fontStyle: 'bold',
      color: hex,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));

    // Ensure heart_pixel texture is loaded if HUD is mounted directly
    if (!scene.textures.exists('heart_pixel')) {
      scene.load.image('heart_pixel', 'assets/heart_pixel.png');
      scene.load.once('complete', () => {
        this.integrityHearts.forEach(h => {
          if (h.active) {
            h.setTexture('heart_pixel');
            h.setDisplaySize(20, 20);
          }
        });
      });
      scene.load.start();
    }

    // Hearts row using heart_pixel image
    for (let i = 0; i < 3; i++) {
      const tex = scene.textures.exists('heart_pixel') ? 'heart_pixel' : 'proto_tile';
      const heart = scene.add.image(88 + i * 26, 30, tex)
        .setDisplaySize(20, 20)
        .setOrigin(0.5);
      this.setHeartVisual(heart, true);
      this.integrityHearts.push(heart);
      this.add(heart);
    }

    // "HP" label
    this.add(scene.add.text(88, 48, 'HP', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: hex,
      stroke: '#000000',
      strokeThickness: 2
    }));
  }

  /**
   * Sets the visual appearance of a heart_pixel sprite:
   * When filled, displays the bright red pixel heart.
   * When depleted, displays a dark translucent silhouette.
   */
  private setHeartVisual(heart: Phaser.GameObjects.Image, filled: boolean): void {
    if (filled) {
      heart.clearTint();
      heart.setAlpha(1);
    } else {
      // Depleted empty heart state
      heart.setTint(0x331015);
      heart.setAlpha(0.28);
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
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5));
  }

  // ── Top-Right: Counter + Home ─────────────────────────────────────────────

  private pausePlate?: Phaser.GameObjects.Arc;
  private pauseBtn?: Phaser.GameObjects.Image;
  private pauseZone?: Phaser.GameObjects.Zone;
  private guidePlate?: Phaser.GameObjects.Arc;
  private guideText?: Phaser.GameObjects.Text;
  private guideZone?: Phaser.GameObjects.Zone;
  private activeGuideModal: GuideModal | null = null;

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
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.add(this.componentCountText);

    // ── Direct Scene Guide Button ('?' Icon beside failsafe bar) ─────────────
    const guideX = W - 166;
    const guideY = 26;

    this.guidePlate = scene.add.circle(guideX, guideY, 13, 0x0a0612, 0.95)
      .setStrokeStyle(1.5, accentColor, 0.85)
      .setScrollFactor(0)
      .setDepth(240);

    this.guideText = scene.add.text(guideX, guideY, '?', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(241);

    this.guideZone = scene.add.zone(guideX, guideY, 30, 30)
      .setScrollFactor(0)
      .setDepth(245)
      .setInteractive({ useHandCursor: true });

    this.guideZone.on('pointerover', () => {
      this.guidePlate?.setStrokeStyle(2, 0xffffff, 1);
      this.guidePlate?.setFillStyle(0x192a45, 0.98);
      this.guideText?.setColor('#ffffff');
      if (this.guideText) {
        scene.tweens.killTweensOf(this.guideText);
        scene.tweens.add({
          targets: this.guideText,
          scale: 1.15,
          duration: 90
        });
      }
      AudioManager.playMenuHover();
    });

    this.guideZone.on('pointerout', () => {
      this.guidePlate?.setStrokeStyle(1.5, accentColor, 0.85);
      this.guidePlate?.setFillStyle(0x0a0612, 0.95);
      this.guideText?.setColor('#00f0ff');
      if (this.guideText) {
        scene.tweens.killTweensOf(this.guideText);
        scene.tweens.add({
          targets: this.guideText,
          scale: 1.0,
          duration: 90
        });
      }
    });

    this.guideZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      AudioManager.playMenuSelect();
      this.toggleGuide(scene);
    });

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

    // Keyboard shortcuts for pausing (ESC, P) and guide (H)
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
      const hKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
      hKey.on('down', () => {
        this.toggleGuide(scene);
      });
    }

    scene.events.once('shutdown', () => {
      this.pausePlate?.destroy();
      this.pauseBtn?.destroy();
      this.pauseZone?.destroy();
      this.guidePlate?.destroy();
      this.guideText?.destroy();
      this.guideZone?.destroy();
      this.activeGuideModal?.destroy();
    });
  }

  public toggleGuide(scene: Phaser.Scene): void {
    if (this.activeGuideModal) {
      const modal = this.activeGuideModal;
      this.activeGuideModal = null;
      modal.closeModal();
    } else {
      this.activeGuideModal = new GuideModal(scene, () => {
        this.activeGuideModal = null;
      });
    }
  }

  // ── Staff Charges (Just below heart bar section) ─────────────────────────

  private buildChargeBar(scene: Phaser.Scene, accentColor: number): void {
    const hex = '#' + accentColor.toString(16).padStart(6, '0');
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0612, 0.92);
    bg.fillRoundedRect(6, 72, 158, 24, 8);
    bg.lineStyle(1.5, accentColor, 0.65);
    bg.strokeRoundedRect(6, 72, 158, 24, 8);
    this.add(bg);

    this.add(scene.add.text(18, 84, 'STAFF', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '9px',
      fontStyle: 'bold',
      color: hex,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5));

    for (let i = 0; i < 3; i++) {
      const crystal = scene.add.rectangle(76 + i * 22, 84, 14, 14, accentColor);
      crystal.setStrokeStyle(1, 0xffffff, 0.6);
      this.chargeCrystals.push(crystal);
      this.add(crystal);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public updateIntegrity(current: number): void {
    this.integrityHearts.forEach((heart, idx) => {
      this.setHeartVisual(heart, idx < current);
    });
  }

  public updateCharges(current: number, max?: number): void {
    const crystalY = 84;
    // Reconfigure crystals array if max differs
    if (max !== undefined && max !== this.chargeCrystals.length && max > 0) {
      this.chargeCrystals.forEach(c => c.destroy());
      this.chargeCrystals = [];
      const crystalSpacing = Math.min(22, 70 / Math.max(1, max));
      for (let i = 0; i < max; i++) {
        const crystal = this.scene.add.rectangle(76 + i * crystalSpacing, crystalY, 14, 14, this.accent);
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
    this.guidePlate?.destroy();
    this.guideText?.destroy();
    this.guideZone?.destroy();
    this.activeGuideModal?.destroy();
    super.destroy(fromScene);
  }
}
