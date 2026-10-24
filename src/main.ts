import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { StoryScene } from './scenes/StoryScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { Sector2Scene } from './scenes/Sector2Scene';
import { Level3Scene } from './scenes/level3';
import { Level4Scene } from './scenes/level4';
import { Level5Scene } from './scenes/level5';
import { EndingScene } from './scenes/EndingScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#070b14',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GAME_CONFIG.gravity },
      debug: GAME_CONFIG.debugPhysics
    }
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    StoryScene,
    GameScene,
    LevelCompleteScene,
    Sector2Scene,
    Level3Scene,
    Level4Scene,
    Level5Scene,
    EndingScene
  ]
};

export const game = new Phaser.Game(config);
