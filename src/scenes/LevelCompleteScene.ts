import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { AudioManager } from '../systems/AudioManager';

interface LevelCompleteData {
  failsafeCollected: number;
  totalFailsafe: number;
  deathCount: number;
  timeMs: number;
  sectorNumber?: number;
  alertCount?: number;
}

/**
 * LevelCompleteScene — Shown after clearing a sector.
 * Displays animated stats, rank badge, and transitions to the next sector.
 */
export class LevelCompleteScene extends Phaser.Scene {
  private levelData!: LevelCompleteData;

  constructor() {
    super('LevelComplete');
  }

  init(data: LevelCompleteData): void {
    this.levelData = data ?? { failsafeCollected: 1, totalFailsafe: 5, deathCount: 0, timeMs: 60000, sectorNumber: 1 };
  }

  create(): void {
    AudioManager.init();
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const sector = this.levelData.sectorNumber ?? 1;

    // Background — dark void with pixel grid
    const bg = this.add.graphics();
    bg.fillStyle(0x040810, 1);
    bg.fillRect(0, 0, W, H);
    // Subtle grid
    bg.lineStyle(1, 0x0d1f35, 0.4);
    for (let x = 0; x < W; x += 20) bg.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 20) bg.lineBetween(0, y, W, y);

    // Header color based on sector
    const headerColor = sector === 3 ? 0xd4af37 : sector === 2 ? 0xff6b35 : 0x00f0ff;
    const sectorTitle = sector === 3 ? 'SECTOR 3: INFILTRATED' : sector === 2 ? 'SECTOR 2: ESCAPED' : 'SECTOR 1: ESCAPED';
    const sectorSubtitle = sector === 3 ? '// MEDIEVAL PALACE VAULT BREACHED //' : sector === 2 ? '// HEAT AGE SECTOR CLEARED //' : '// FROZEN AGE SECTOR CLEARED //';

    // Glowing header bar
    const headerBar = this.add.graphics();
    headerBar.fillStyle(headerColor, 0.08);
    headerBar.fillRect(0, 0, W, 60);
    headerBar.lineStyle(1, headerColor, 0.6);
    headerBar.lineBetween(0, 60, W, 60);

    // SECTOR ESCAPED title (fades in)
    const title = this.add.text(W / 2, 30, sectorTitle, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#' + headerColor.toString(16).padStart(6, '0'),
      stroke: '#001a33',
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 600, ease: 'Power2' });

    // Sub-label
    this.add.text(W / 2, 52, sectorSubtitle, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: sector === 3 ? '#ffd166' : sector === 2 ? '#ff9e00' : '#48cae4',
      stroke: '#001a33',
      strokeThickness: 2
    }).setOrigin(0.5).setAlpha(0.85);

    // â”€â”€ Stats panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const panelX = W / 2 - 120;
    const panelY = 90;

    const panel = this.add.graphics();
    panel.fillStyle(0x0d1f35, 0.8);
    panel.fillRect(panelX - 10, panelY - 10, 260, 160);
    panel.lineStyle(1, 0x192e47, 1);
    panel.strokeRect(panelX - 10, panelY - 10, 260, 160);

    const stats: [string, string, string][] = [
      ['FAILSAFE RECOVERED', `${this.levelData.failsafeCollected} / ${this.levelData.totalFailsafe}`, '#ffd166'],
      ['CRITICAL FAILURES', `${this.levelData.deathCount}`, this.levelData.deathCount === 0 ? '#70e000' : '#ff6b35'],
      ['SECTOR TIME', this.formatTime(this.levelData.timeMs), '#00f0ff'],
      ['RANK', this.calcRank(), this.rankColor()],
    ];

    stats.forEach(([label, value, color], i) => {
      const y = panelY + i * 36;
      this.add.text(panelX, y, label, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#8b9bb4',
        stroke: '#040711',
        strokeThickness: 2
      }).setAlpha(0);

      const valText = this.add.text(panelX + 230, y, value, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '13px',
        fontStyle: 'bold',
        color,
        stroke: '#040711',
        strokeThickness: 2
      }).setOrigin(1, 0).setAlpha(0);

      this.time.delayedCall(400 + i * 200, () => {
        this.tweens.add({ targets: [this.children.list[this.children.list.indexOf(valText) - 1], valText], alpha: 1, duration: 300 });
        if (i < 3) AudioManager.playCheckpoint();
      });
    });

    // Rank badge
    const rank = this.calcRank();
    const badgeY = panelY + 170;
    const badge = this.add.text(W / 2, badgeY, `[ ${rank} ]`, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '28px',
      fontStyle: 'bold',
      color: this.rankColor(),
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setScale(0.3);

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: badge, alpha: 1, scale: 1,
        duration: 500, ease: 'Back.easeOut'
      });
      AudioManager.playFailsafe();
    });

    // â”€â”€ CRT scanlines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const scanlines = this.add.graphics().setAlpha(0.06).setDepth(100);
    scanlines.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) scanlines.lineBetween(0, y, W, y);

    // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.time.delayedCall(1800, () => this.showButtons(W, H));

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private showButtons(W: number, H: number): void {
    const sector = this.levelData.sectorNumber ?? 1;

    let nextLabel = 'CONTINUE TO SECTOR 2 ▶';
    let nextTarget = 'Sector2Scene';
    let nextColor = '#70e000';

    if (sector === 2) {
      nextLabel = 'CONTINUE TO SECTOR 3: MEDIEVAL PALACE ▶';
      nextTarget = 'Level3Scene';
      nextColor = '#ffd166';
    } else if (sector === 3) {
      nextLabel = 'CONTINUE TO SECTOR 4: ANCIENT FOREST ▶';
      nextTarget = 'Level4Scene';
      nextColor = '#52b788';
    } else if (sector === 4) {
      nextLabel = 'CONTINUE TO SECTOR 5: FUTURISTIC CORE ▶';
      nextTarget = 'Level5Scene';
      nextColor = '#ff007f';
    } else if (sector === 5) {
      nextLabel = 'PROCEED TO EXTRACTION EPILOGUE ▶';
      nextTarget = 'EndingScene';
      nextColor = '#00f0ff';
    }

    // Continue / Replay button
    this.makeButton(W / 2, H - 70, nextLabel, nextColor, () => {
      AudioManager.playMenuSelect();
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.scene.start(nextTarget);
      });
    });

    // Main Menu button
    this.makeButton(W / 2, H - 40, 'RETURN TO MAIN MENU', '#8b9bb4', () => {
      AudioManager.playMenuSelect();
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
      });
    });
  }

  private makeButton(x: number, y: number, label: string, color: string, onClick: () => void): void {
    const btn = this.add.text(x, y, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '13px',
      fontStyle: 'bold',
      color,
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      btn.setStyle({ color: '#ffffff' });
      AudioManager.playMenuHover();
    });
    btn.on('pointerout', () => btn.setStyle({ color }));
    btn.on('pointerdown', onClick);

    this.tweens.add({ targets: btn, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
  }

  private formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  private calcRank(): string {
    const { deathCount, failsafeCollected, totalFailsafe } = this.levelData;
    if (deathCount === 0 && failsafeCollected >= totalFailsafe) return 'S - PERFECT';
    if (deathCount <= 2 && failsafeCollected >= 1) return 'A - EXCELLENT';
    if (deathCount <= 5) return 'B - GOOD';
    if (deathCount <= 10) return 'C - AVERAGE';
    return 'D - CORRUPTED';
  }

  private rankColor(): string {
    const r = this.calcRank()[0];
    return r === 'S' ? '#ffd166' : r === 'A' ? '#70e000' : r === 'B' ? '#00f0ff' : r === 'C' ? '#8b9bb4' : '#ff6b35';
  }
}
