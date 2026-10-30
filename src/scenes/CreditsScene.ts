import Phaser from 'phaser';
import { hasCompletedAllLevels } from '../utils/progress';

export class CreditsScene extends Phaser.Scene {
  private hasAdvanced = false;

  constructor() {
    super('Credits');
  }

  create(): void {
    // Credits gate guard
    if (!hasCompletedAllLevels()) {
      this.scene.start('MainMenu');
      return;
    }

    this.cameras.main.fadeIn(500);
    this.hasAdvanced = false;

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Dark void background
    this.add.rectangle(W / 2, H / 2, W, H, 0x040711);

    // Subtle matrix cyber-grid lines
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x0d2038, 0.25);
    for (let x = 0; x < W; x += 20) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 20) grid.lineBetween(0, y, W, y);

    const creditsLines = [
      'PROJECT GLITCHVERSE',
      'A 2D Reality-Manipulation Platformer',
      '====================================',
      '',
      'GAME DEVS:',
      'Ayush Gupta - Programmer',
      'Neel Patel - Game Designer',
      'Prachi Khamkar - UI/UX Designer',
      '',
      'SIMULATION CREATOR:',
      'The Faceless Scientist',
      '',
      'DESIGN & ARCHITECTURE:',
      'Senior HTML5 & Phaser 3 Systems',
      '',
      'CORE ENGINE & TECH:',
      'Phaser 3.88 + TypeScript + Vite',
      'Phaser Arcade Physics',
      '',
      'SIMULATION REALMS:',
      'Sector 1: Frozen Age',
      'Sector 2: Heat Age',
      'Sector 3: Medieval Palace',
      'Sector 4: Ancient Forest',
      'Sector 5: Futuristic Core',
      '',
      '// ALL 5 SECTORS LIBERATED //',
      '',
      'THANK YOU FOR PLAYING GLITCHVERSE!',
      '',
      'END OF TRANSMISSION'
    ];

    const creditsText = this.add.text(W / 2, H + 20, creditsLines.join('\n'), {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#e0aaff',
      align: 'center',
      lineSpacing: 5
    }).setOrigin(0.5, 0);

    // Skip hint
    this.add.text(W / 2 + 225, H - 14, '[ESC / CLICK TO RETURN TO MENU]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#8b9bb4'
    }).setOrigin(0.5);

    const targetY = -creditsText.height - 20;
    const scrollDuration = 18000;

    const advance = () => {
      if (this.hasAdvanced) return;
      this.hasAdvanced = true;

      const cam = this.cameras.main;
      cam.fadeOut(500);
      cam.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenu');
      });
    };

    const tween = this.tweens.add({
      targets: creditsText,
      y: targetY,
      duration: scrollDuration,
      ease: 'Linear',
      onComplete: () => {
        advance();
      }
    });

    // Skip on Esc
    this.input.keyboard?.on('keydown-ESC', () => {
      tween.stop();
      advance();
    });

    // Skip on click / tap
    this.input.on('pointerdown', () => {
      tween.stop();
      advance();
    });
  }
}

