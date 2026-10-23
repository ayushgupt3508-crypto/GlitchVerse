import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { AudioManager } from '../systems/AudioManager';

interface EndingData {
  deathCount: number;
  timeMs: number;
}

/**
 * EndingScene — The grand finale of GlitchVerse.
 *
 * Displays:
 *  • Vance's extraction from the collapsing simulation core into the physical laboratory.
 *  • Full game stats across all 5 sectors (5/5 Failsafes recovered, total time, rank).
 *  • An eerie post-credits glitch transmission hinting that the simulation survived.
 */
export class EndingScene extends Phaser.Scene {
  private endingData!: EndingData;
  private typewriterLines: string[] = [
    'SYSTEM REPORT: SIMULATION RESTORATION COMPLETE.',
    'ALL 5 FAILSAFE COMPONENTS SECURED IN MATRIX ARRAY.',
    'ANOMALY PURGED... OR REPLICATED?',
    'ALERT: SIMULATION CORE INSTANCE #07 PERSISTS IN SHADOW MEMORY.',
    'OBSERVER PROTOCOL: ACTIVE.',
    '// THANK YOU FOR PLAYING GLITCHVERSE //'
  ];

  constructor() {
    super('EndingScene');
  }

  init(data: EndingData): void {
    this.endingData = data ?? { deathCount: 0, timeMs: 360000 };
  }

  create(): void {
    AudioManager.init();
    AudioManager.playVictory();

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Background — void transitioning into physical lab
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050710, 0x050710, 0x0c1322, 0x0c1322, 1);
    bg.fillRect(0, 0, W, H);

    // Subtle matrix cyber-grid fading out
    bg.lineStyle(1, 0x0d2038, 0.4);
    for (let x = 0; x < W; x += 20) bg.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 20) bg.lineBetween(0, y, W, y);

    // Glowing cyan header bar
    const headerBar = this.add.graphics();
    headerBar.fillStyle(0x00f0ff, 0.08);
    headerBar.fillRect(0, 0, W, 54);
    headerBar.lineStyle(1.5, 0x00f0ff, 0.7);
    headerBar.lineBetween(0, 54, W, 54);

    // Title: SIMULATION ESCAPED
    const title = this.add.text(W / 2, 26, 'GLITCHVERSE ESCAPED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#001a33',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 800, ease: 'Power2' });

    // Sub-title
    this.add.text(W / 2, 44, '// ALL 5 SECTORS LIBERATED //', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#ffd166'
    }).setOrigin(0.5);

    // ── Center Stats Panel ────────────────────────────────────────────────
    const panelX = W / 2 - 130;
    const panelY = 66;

    const panel = this.add.graphics();
    panel.fillStyle(0x0a101d, 0.9);
    panel.fillRoundedRect(panelX, panelY, 260, 140, 8);
    panel.lineStyle(1.5, 0x1d3350, 0.9);
    panel.strokeRoundedRect(panelX, panelY, 260, 140, 8);

    const stats: [string, string, string][] = [
      ['SECTORS RESTORED', '5 / 5 [100%]', '#00f0ff'],
      ['FAILSAFE MATRIX', '5 / 5 COMPLETED', '#ffd166'],
      ['CRITICAL FAILURES', `${this.endingData.deathCount}`, this.endingData.deathCount === 0 ? '#70e000' : '#ff6b35'],
      ['TOTAL MISSION TIME', this.formatTime(this.endingData.timeMs), '#00f0ff'],
      ['MASTERY RANK', this.calcMasteryRank(), '#ffd166']
    ];

    stats.forEach(([label, value, color], i) => {
      const y = panelY + 14 + i * 24;
      this.add.text(panelX + 14, y, label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#8b9bb4'
      });

      this.add.text(panelX + 246, y, value, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        fontStyle: 'bold',
        color
      }).setOrigin(1, 0);
    });

    // ── The Secret Glitch Twist Terminal ──────────────────────────────────
    const termY = 216;
    const termBox = this.add.graphics();
    termBox.fillStyle(0x04060c, 0.95);
    termBox.fillRoundedRect(panelX, termY, 260, 80, 6);
    termBox.lineStyle(1, 0xff007f, 0.6); // Warning magenta line
    termBox.strokeRoundedRect(panelX, termY, 260, 80, 6);

    const termText = this.add.text(panelX + 10, termY + 8, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#ff007f',
      lineSpacing: 3
    });

    this.startTypewriter(termText);

    // ── Buttons ───────────────────────────────────────────────────────────
    this.time.delayedCall(2400, () => {
      // Replay from Sector 1 button
      this.makeButton(W / 2 - 70, H - 24, 'REPLAY SECTOR 1 ▶', '#00f0ff', () => {
        AudioManager.playMenuSelect();
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start(GAME_CONFIG.sceneKeys.Game);
        });
      });

      // Main Menu button
      this.makeButton(W / 2 + 70, H - 24, 'MAIN MENU ➔', '#8b9bb4', () => {
        AudioManager.playMenuSelect();
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
        });
      });
    });

    // Scanlines
    this.addScanlines();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private startTypewriter(target: Phaser.GameObjects.Text): void {
    let currentLine = 0;
    let currentChar = 0;
    let buffer = '';

    const timer = this.time.addEvent({
      delay: 35,
      repeat: -1,
      callback: () => {
        if (currentLine >= this.typewriterLines.length) {
          timer.destroy();
          return;
        }

        const line = this.typewriterLines[currentLine];
        buffer += line[currentChar];
        target.setText(buffer + '█');
        currentChar++;

        if (currentChar >= line.length) {
          buffer += '\n';
          currentLine++;
          currentChar = 0;
        }
      }
    });
  }

  private makeButton(x: number, y: number, label: string, color: string, onClick: () => void): void {
    const btn = this.add.text(x, y, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      btn.setColor('#ffffff');
      AudioManager.playMenuHover();
    });
    btn.on('pointerout', () => btn.setColor(color));
    btn.on('pointerdown', onClick);

    this.tweens.add({ targets: btn, alpha: 0.6, yoyo: true, repeat: -1, duration: 800 });
  }

  private calcMasteryRank(): string {
    const deaths = this.endingData.deathCount;
    if (deaths === 0) return 'S+ · TRANSCENDENT';
    if (deaths <= 3) return 'S · ARCHITECT';
    if (deaths <= 8) return 'A · OPERATOR';
    if (deaths <= 15) return 'B · STABILIZER';
    return 'C · SURVIVOR';
  }

  private formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  private addScanlines(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const g = this.add.graphics().setScrollFactor(0).setAlpha(0.04).setDepth(100);
    g.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) g.lineBetween(0, y, W, y);
  }
}
