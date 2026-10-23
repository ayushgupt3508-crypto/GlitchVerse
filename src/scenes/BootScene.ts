import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(GAME_CONFIG.sceneKeys.Boot);
  }

  preload(): void {
    // Basic setup if any immediate splash assets are required
  }

  create(): void {
    // Handle tab switching / window blur safely
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      // Suspend audio or emit pause event when player leaves tab
    });

    this.scene.start(GAME_CONFIG.sceneKeys.Preload);
  }
}
