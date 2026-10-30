import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class GameEndingScene extends Phaser.Scene {
  private endData: any = {};
  private hasAdvanced = false;

  constructor() {
    super('GameEnding');
  }

  init(data?: any): void {
    this.endData = data ?? {};
    this.hasAdvanced = false;
  }

  create(): void {

    if (!SaveSystem.isAllLevelsCompleted()) {
      this.scene.start('MainMenu');
      return;
    }

    this.cameras.main.fadeIn(500);

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Black background
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000);

    // Show ONLY the game_ending image scaled to fit with Math.min(W/img.width, H/img.height)
    if (this.textures.exists('game_ending')) {
      const img = this.add.image(W / 2, H / 2, 'game_ending');
      const scale = Math.min(W / img.width, H / img.height);
      img.setScale(scale).setOrigin(0.5);
    }

    let canAdvance = false;

    // Ignore input for the first 1000 ms
    this.time.delayedCall(1000, () => {
      canAdvance = true;
    });

    const advance = () => {
      if (this.hasAdvanced || !canAdvance) return;
      this.hasAdvanced = true;

      const cam = this.cameras.main;
      cam.fadeOut(500);
      cam.once('camerafadeoutcomplete', () => {
        this.scene.start('FinalScore', this.endData);
      });
    };

    // Advance automatically after 10 s
    this.time.delayedCall(10000, () => {
      if (!this.hasAdvanced) {
        canAdvance = true;
        advance();
      }
    });

    // Advance on any key press
    this.input.keyboard?.on('keydown', () => {
      advance();
    });

    // Advance on any pointer press
    this.input.on('pointerdown', () => {
      advance();
    });
  }
}

