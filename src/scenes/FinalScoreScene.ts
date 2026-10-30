import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class FinalScoreScene extends Phaser.Scene {
  private score: number = 0;
  private hasAdvanced = false;

  constructor() {
    super('FinalScore');
  }

  init(data?: any): void {
    this.hasAdvanced = false;

    // Read the existing final score value; do not recompute it
    if (data && typeof data.score === 'number') {
      this.score = data.score;
    } else if (data && typeof data.finalScore === 'number') {
      this.score = data.finalScore;
    } else {
      const last = SaveSystem.getLastScore();
      this.score = last !== undefined ? last : (SaveSystem.getBestScore() ?? 0);
    }
  }

  create(): void {
    this.cameras.main.fadeIn(500);

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Dark cybernetic background
    this.add.rectangle(W / 2, H / 2, W, H, 0x050710);

    // Centered text: "Final Score: <score>"
    const bestScore = SaveSystem.getBestScore();
    const hasBest = bestScore !== undefined;

    const scoreY = hasBest ? H / 2 - 25 : H / 2 - 10;
    this.add.text(W / 2, scoreY, `Final Score: ${this.score}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#00f0ff'
    }).setOrigin(0.5);

    // If a best score exists in current storage, show "Best: <best>"
    if (hasBest) {
      this.add.text(W / 2, scoreY + 32, `Best: ${bestScore}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#ffd166'
      }).setOrigin(0.5);
    }

    // Pulsing hint text "Press any key / tap to continue" (alpha tween 0.4 <-> 1, 800 ms)
    const hint = this.add.text(W / 2, H - 45, 'Press any key / tap to continue', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#8b9bb4'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: { from: 1, to: 0.4 },
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: 'Sine.easeInOut'
    });

    let canAdvance = false;

    // Input ignored for the first 800 ms
    this.time.delayedCall(800, () => {
      canAdvance = true;
    });

    const advance = () => {
      if (this.hasAdvanced || !canAdvance) return;
      this.hasAdvanced = true;

      const cam = this.cameras.main;
      cam.fadeOut(500);
      cam.once('camerafadeoutcomplete', () => {
        this.scene.start('Credits');
      });
    };

    // Any key -> 'Credits'
    this.input.keyboard?.on('keydown', () => {
      advance();
    });

    // Any pointer -> 'Credits'
    this.input.on('pointerdown', () => {
      advance();
    });
  }
}

