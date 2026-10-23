import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { AudioManager } from '../systems/AudioManager';

/**
 * Sector2TeaserScene — Shown after LevelCompleteScene.
 * Hints at the next sector (Heat Age) with atmospheric lore text and a locked-door visual.
 */
export class Sector2TeaserScene extends Phaser.Scene {
  constructor() {
    super('Sector2Teaser');
  }

  create(): void {
    AudioManager.init();
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Dark hot background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0304, 0x0a0304, 0x1a0a04, 0x1a0a04, 1);
    bg.fillRect(0, 0, W, H);

    // Glowing heat shimmer lines
    for (let i = 0; i < 6; i++) {
      const line = this.add.graphics();
      line.lineStyle(1, 0xff6b35, 0.15 + Math.random() * 0.1);
      const y = 100 + i * 30;
      line.lineBetween(0, y, W, y);
      this.tweens.add({
        targets: line,
        alpha: 0.3,
        yoyo: true,
        repeat: -1,
        duration: 800 + i * 200,
        ease: 'Sine.easeInOut'
      });
    }

    // ── Header ─────────────────────────────────────────────────────────
    const header = this.add.graphics();
    header.fillStyle(0xff6b35, 0.08);
    header.fillRect(0, 0, W, 50);
    header.lineStyle(1, 0xff6b35, 0.5);
    header.lineBetween(0, 50, W, 50);

    this.add.text(W / 2, 25, 'INCOMING TRANSMISSION', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#ff6b35'
    }).setOrigin(0.5);

    // ── Giant locked door visual ────────────────────────────────────────
    const doorX = W / 2;
    const doorY = H / 2 - 20;

    // Door frame
    const door = this.add.graphics();
    door.lineStyle(2, 0xff6b35, 0.7);
    door.strokeRect(doorX - 30, doorY - 50, 60, 80);
    // Door panels
    door.lineStyle(1, 0xff6b35, 0.3);
    door.strokeRect(doorX - 26, doorY - 46, 24, 34);
    door.strokeRect(doorX + 2, doorY - 46, 24, 34);
    door.strokeRect(doorX - 26, doorY - 8, 52, 30);
    // Lock
    door.fillStyle(0xff2222, 0.9);
    door.fillCircle(doorX, doorY + 14, 6);
    door.lineStyle(2, 0xff6b35, 1);
    door.strokeCircle(doorX, doorY + 14, 6);
    // Lock keyhole
    door.fillStyle(0x0a0304, 1);
    door.fillCircle(doorX, doorY + 13, 2);
    door.fillTriangle(doorX - 2, doorY + 14, doorX + 2, doorY + 14, doorX, doorY + 18);

    // Pulsing glow on lock
    this.tweens.add({
      targets: door,
      alpha: 0.5,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut'
    });

    // SECTOR label above door
    this.add.text(doorX, doorY - 62, 'SECTOR 2', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#ff6b35',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(doorX, doorY - 46, 'HEAT AGE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      color: '#8b4513'
    }).setOrigin(0.5);

    // LOCKED label on door
    this.add.text(doorX, doorY + 30, '[ LOCKED ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#ff2222'
    }).setOrigin(0.5);

    // ── Lore scroll text ────────────────────────────────────────────────
    const loreLines = [
      '> SECTOR 2 GATEWAY — HEAT AGE CONTAINMENT ZONE',
      '> STATUS: TEMPERATURE ANOMALY — 847°C AMBIENT',
      '> FAILSAFE COMPONENTS REQUIRED: 2 OF 5',
      '> CURRENT: 1 OF 5 — ACCESS DENIED',
      '',
      '> SYSTEM LOG [DR. VANCE]: "The thermal cascade',
      '  began 72 hours after the Glitch. The Heat Age',
      '  sector is consuming itself. Do not enter',
      '  without the full Failsafe array online."',
      '',
      '> MISSION UPDATE: Recover remaining Failsafe',
      '  components to unlock the Heat Age gateway.',
    ];

    const loreContainer = this.add.container(0, 0);
    loreLines.forEach((line, i) => {
      const t = this.add.text(W / 2, H - 185 + i * 13, line, {
        fontFamily: 'Courier New, monospace',
        fontSize: '7px',
        color: i === 0 || i === 1 || i === 2 || i === 3 ? '#ff6b35' : '#8b9bb4',
      }).setOrigin(0.5).setAlpha(0);
      loreContainer.add(t);

      this.time.delayedCall(300 + i * 80, () => {
        this.tweens.add({ targets: t, alpha: 1, duration: 200 });
      });
    });

    // ── Buttons ─────────────────────────────────────────────────────────
    this.time.delayedCall(1400, () => {
      // Enter Sector 2 button
      const enterBtn = this.add.text(W / 2, H - 36, '[ ENTER SECTOR 2: HEAT AGE ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#ff8c00'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.tweens.add({ targets: enterBtn, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
      enterBtn.on('pointerover', () => {
        enterBtn.setStyle({ color: '#ffdd00' });
        AudioManager.playMenuHover();
      });
      enterBtn.on('pointerout', () => enterBtn.setStyle({ color: '#ff8c00' }));
      enterBtn.on('pointerdown', () => {
        AudioManager.playMenuSelect();
        this.cameras.main.fadeOut(400, 20, 5, 0, () => {
          this.scene.start('Sector2Scene');
        });
      });

      const backBtn = this.add.text(W / 2, H - 14, 'RETURN TO MAIN MENU', {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#8b9bb4'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      backBtn.on('pointerover', () => {
        backBtn.setStyle({ color: '#ffffff' });
        AudioManager.playMenuHover();
      });
      backBtn.on('pointerout', () => backBtn.setStyle({ color: '#8b9bb4' }));
      backBtn.on('pointerdown', () => {
        AudioManager.playMenuSelect();
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
        });
      });
    });

    // CRT overlay
    const scanlines = this.add.graphics().setAlpha(0.07).setDepth(100);
    scanlines.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) scanlines.lineBetween(0, y, W, y);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }
}
