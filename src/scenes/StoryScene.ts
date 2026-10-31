import Phaser from 'phaser';
import { GAME_CONFIG, GAME_FONTS } from '../config';

import { AudioManager } from '../systems/AudioManager';

export class StoryScene extends Phaser.Scene {
  private introVideo!: Phaser.GameObjects.Video;
  private isLeaving = false;
  private isChoiceActive = false;
  private choiceContainer?: Phaser.GameObjects.Container;
  
  private skipHitArea?: Phaser.GameObjects.Zone;

  constructor() {
    super('StoryScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.isLeaving = false;
    this.isChoiceActive = false;

    // Dark background while the video initializes
    this.cameras.main.setBackgroundColor('#050510');

    // Create the intro video
    this.introVideo = this.add.video(
      width / 2,
      height / 2,
      'story_intro_video'
    );

    this.introVideo.setOrigin(0.5);
    this.introVideo.setDepth(0);
    this.introVideo.setScrollFactor(0);

    // Wait until Phaser knows the video's actual dimensions
    this.introVideo.on(
      Phaser.GameObjects.Events.VIDEO_CREATED,
      (_video: Phaser.GameObjects.Video, videoWidth: number, videoHeight: number) => {
        const scale = Math.max(
          width / videoWidth,
          height / videoHeight
        );
        this.introVideo.setScale(scale);
        this.introVideo.setPosition(width / 2, height / 2);
      }
    );

    // Play the video once
    this.introVideo.play(false);

    // When the video finishes, display the tutorial choice screen
    this.introVideo.once('complete', () => {
      this.showTutorialChoice();
    });

    // Skip button background
    const buttonWidth = 120;
    const buttonHeight = 34;
    const buttonX = width - 78;
    const buttonY = 28;

    const buttonBackground = this.add.rectangle(
      buttonX,
      buttonY,
      buttonWidth,
      buttonHeight,
      0x080c18,
      0.85
    );

    buttonBackground
      .setStrokeStyle(1, 0x00e5ff, 0.9)
      .setDepth(10);

    // Skip button text
    const skipText = this.add.text(
      buttonX,
      buttonY,
      'SKIP INTRO  >>',
      {
        fontFamily: GAME_FONTS.mono || 'Courier New, monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#00e5ff'
      }
    )
      .setOrigin(0.5)
      .setDepth(11);

    // Interactive skip button
    this.skipHitArea = this.add.zone(
      buttonX,
      buttonY,
      buttonWidth,
      buttonHeight
    )
      .setInteractive({ useHandCursor: true })
      .setDepth(12);

    this.skipHitArea.on('pointerover', () => {
      buttonBackground.setFillStyle(0x102638, 0.95);
      buttonBackground.setStrokeStyle(1, 0xffffff, 1);
      skipText.setColor('#ffffff');
      AudioManager.playMenuHover();
    });

    this.skipHitArea.on('pointerout', () => {
      buttonBackground.setFillStyle(0x080c18, 0.85);
      buttonBackground.setStrokeStyle(1, 0x00e5ff, 0.9);
      skipText.setColor('#00e5ff');
    });

    this.skipHitArea.on('pointerdown', () => {
      this.showTutorialChoice();
    });

    // Keyboard skip on ESC: skips video and presents the tutorial choice
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.isChoiceActive && !this.isLeaving) {
        this.showTutorialChoice();
      }
    });

    // Fade into the video
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Cleanup if the scene is stopped or changed externally
    this.events.once('shutdown', () => {
      if (this.introVideo) {
        this.introVideo.stop();
        this.introVideo.destroy();
      }

    });
  }

  /**
   * Displays the Tutorial Choice Screen when video ends or is skipped.
   */
  private showTutorialChoice(): void {
    if (this.isChoiceActive || this.isLeaving) return;
    this.isChoiceActive = true;

    // Stop and pause video cleanly
    if (this.introVideo) {
      try {
        this.introVideo.stop();
      } catch (e) {
        // ignore
      }
    }

    // Disable top skip button
    if (this.skipHitArea) {
      this.skipHitArea.disableInteractive();
    }

    const width = this.scale.width;
    const height = this.scale.height;

    this.choiceContainer = this.add.container(0, 0).setDepth(200);

    // Dark backdrop overlay
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x040814, 0.92)
      .setInteractive();
    this.choiceContainer.add(backdrop);

    // Dialog Box
    const boxW = 380;
    const boxH = 190;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    const boxGfx = this.add.graphics();
    boxGfx.fillStyle(0x0a1220, 0.98);
    boxGfx.fillRect(boxX, boxY, boxW, boxH);
    boxGfx.lineStyle(2, 0x00f0ff, 0.9);
    boxGfx.strokeRect(boxX, boxY, boxW, boxH);

    // Cyber corner brackets
    boxGfx.lineStyle(2, 0x39ff14, 1);
    const cw = 6;
    boxGfx.strokeRect(boxX - 1, boxY - 1, cw, cw);
    boxGfx.strokeRect(boxX + boxW - cw + 1, boxY - 1, cw, cw);
    boxGfx.strokeRect(boxX - 1, boxY + boxH - cw + 1, cw, cw);
    boxGfx.strokeRect(boxX + boxW - cw + 1, boxY + boxH - cw + 1, cw, cw);

    // Header bar
    boxGfx.fillStyle(0x132238, 1);
    boxGfx.fillRect(boxX, boxY, boxW, 28);
    boxGfx.lineStyle(1, 0x00f0ff, 0.4);
    boxGfx.lineBetween(boxX, boxY + 28, boxX + boxW, boxY + 28);
    this.choiceContainer.add(boxGfx);

    // Title
    const titleText = this.add.text(width / 2, boxY + 14, 'SIMULATION INITIALIZED', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.choiceContainer.add(titleText);

    // Prompt message
    const msgText = this.add.text(width / 2, boxY + 54, 'TIMELINE COMPROMISED // WOULD YOU LIKE TO VIEW\nTHE QUANTUM SUIT & ABILITY PROTOCOLS?', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);
    this.choiceContainer.add(msgText);

    const subText = this.add.text(width / 2, boxY + 95, 'Recommended for first-time operatives. Covers movement,\nstaff mechanics, reality shifts, and sector objectives.', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '8px',
      color: '#8b9bb4',
      align: 'center',
      lineSpacing: 2
    }).setOrigin(0.5);
    this.choiceContainer.add(subText);

    // Buttons
    const btnY = boxY + 144;

    // VIEW TUTORIAL Button
    const viewBtn = this.createChoiceButton(width / 2 - 82, btnY, 134, 28, 'VIEW TUTORIAL', () => {
      this.openTutorialFromStory();
    }, 0x0c281e, 0x39ff14);
    this.choiceContainer.add(viewBtn);

    // SKIP TUTORIAL Button
    const skipBtn = this.createChoiceButton(width / 2 + 82, btnY, 134, 28, 'SKIP TUTORIAL', () => {
      this.startGame();
    }, 0x142033, 0x00f0ff);
    this.choiceContainer.add(skipBtn);

    // Animate Choice dialog appearance
    this.choiceContainer.setAlpha(0);
    this.tweens.add({
      targets: this.choiceContainer,
      alpha: 1,
      duration: 180,
      ease: 'Power2'
    });
  }

  private createChoiceButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    customFill?: number,
    customStroke?: number
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();

    const normalFill = customFill ?? 0x142033;
    const normalStroke = customStroke ?? 0x00f0ff;

    const draw = (color: number, stroke: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRect(-w / 2, -h / 2, w, h);
      bg.lineStyle(1.5, stroke, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };
    draw(normalFill, normalStroke);

    const txt = this.add.text(0, 0, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#e0fbfc',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = this.add.zone(0, 0, w, h)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      draw(normalFill + 0x0a141e, normalStroke);
      txt.setColor('#ffffff');
      btn.setScale(1.02);
      AudioManager.playMenuHover();
    });

    hit.on('pointerout', () => {
      draw(normalFill, normalStroke);
      txt.setColor('#e0fbfc');
      btn.setScale(1.0);
    });

    hit.on('pointerdown', () => {
      btn.setScale(0.96);
    });

    hit.on('pointerup', () => {
      btn.setScale(1);
      AudioManager.playMenuSelect();
      onClick();
    });

    btn.add([bg, txt, hit]);
    return btn;
  }

  private openTutorialFromStory(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;

    if (this.introVideo) {
      try { this.introVideo.stop(); } catch (e) { /* ignore */ }
    }

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(GAME_CONFIG.sceneKeys.Tutorial, { source: 'story' });
    });
  }

  private startGame(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;

    // Stop the video
    if (this.introVideo) {
      try {
        this.introVideo.stop();
      } catch (e) {
        // ignore
      }
    }



    // Fade out before entering gameplay
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(GAME_CONFIG.sceneKeys.Game);
    });
  }
}