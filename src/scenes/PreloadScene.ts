import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';
import { TextureGenerator } from '../utils/TextureGenerator';

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(GAME_CONFIG.sceneKeys.Preload);
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Atmospheric background styling
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b14);

    // Title / System prompt
    this.add.text(width / 2, height / 2 - 50, 'GLITCHVERSE :: SIMULATION CORE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.loadingText = this.add.text(width / 2, height / 2 - 20, 'INITIALIZING PROTOCOLS...', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#8b9bb4',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.statusText = this.add.text(width / 2, height / 2 + 35, 'LOADING [ 0% ]', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Progress Bar Box
    const barWidth = 240;
    const barHeight = 12;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(1, 0x00f0ff, 0.8);
    this.progressBox.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
    this.progressBox.fillStyle(0x0e1726, 0.9);
    this.progressBox.fillRect(barX, barY, barWidth, barHeight);

    this.progressBar = this.add.graphics();

    // Loader Events
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x00f0ff, 1);
      this.progressBar.fillRect(barX, barY, barWidth * value, barHeight);
      this.statusText.setText(`LOADING [ ${Math.floor(value * 100)}% ]`);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      this.loadingText.setText(`SYNCING MEMORY: ${file.key}`);
    });

    this.load.on('complete', () => {
      this.loadingText.setText('SIMULATION STABILIZED');
      this.statusText.setText('PRESS ANY KEY TO CONTINUE');
    });

    // Load Main Menu reference background & UI icons
    this.load.image('main_menu_bg', 'assets/main_menu_bg.png');
    this.load.image('pause_icon', 'assets/bi_pause-circle-fill.original.png');
    this.load.image('profile_icon', 'assets/icon_profile.png');
    this.load.image('game_over_screen', 'assets/game_over_screen.png');
    this.load.image('dead_scientist', 'assets/dead_scientist.png');
    // Story intro video
    this.load.video(
      'story_intro_video',
      'assets/Story_Video.mp4',
      true
    );
    // Game ending (only shown after all 5 levels)
    this.load.image('game_ending', 'assets/game_ending.png');
    // HUD pixel heart icon
    this.load.image('heart_pixel', 'assets/heart_pixel.png');
    // Level 4 Forest Golem sprite
    this.load.image('forest_golem', 'assets/forest_golem.png');
    // Main Menu Title Logo
    this.load.image('graphverse_logo', 'assets/GraphVerse.png');
    this.load.image('GraphVerse', 'assets/GraphVerse.png');

    this.load.video(
      'main_menu_video',
      'assets/main_menu_video.mp4',
      true
    );

    // Create initial procedural textures for placeholder testing (prevents asset 404s in Phase 1)
    this.createPlaceholderTextures();
  }

  create(): void {
    // Generate circular cropped texture for the profile icon
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateCircularProfileTexture(this);

    // Quick delay or user tap to advance to MainMenu
    this.time.delayedCall(400, () => {
      this.scene.start(GAME_CONFIG.sceneKeys.MainMenu);
    });
  }

  private createPlaceholderTextures(): void {
    // 16x16 solid tile for terrain prototyping
    const tileGfx = this.make.graphics({ x: 0, y: 0 });
    tileGfx.fillStyle(0x283b56, 1);
    tileGfx.fillRect(0, 0, 16, 16);
    tileGfx.lineStyle(1, 0x3d5a80, 1);
    tileGfx.strokeRect(0, 0, 16, 16);
    tileGfx.generateTexture('proto_tile', 16, 16);
    tileGfx.destroy();

    // 16x32 Scientist silhouette placeholder
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0xe0fbfc, 1);
    playerGfx.fillRect(4, 0, 8, 8); // Head / visor
    playerGfx.fillStyle(0x293241, 1);
    playerGfx.fillRect(3, 8, 10, 16); // Lab coat
    playerGfx.fillStyle(0xee6c4d, 1);
    playerGfx.fillRect(2, 8, 2, 18); // Staff
    playerGfx.fillStyle(0x00f0ff, 1);
    playerGfx.fillCircle(3, 7, 2); // Staff glowing crystal
    playerGfx.fillStyle(0x1d2d44, 1);
    playerGfx.fillRect(4, 24, 4, 8); // Legs
    playerGfx.fillRect(9, 24, 4, 8);
    playerGfx.generateTexture('proto_scientist', 16, 32);
    playerGfx.destroy();
  }
}
