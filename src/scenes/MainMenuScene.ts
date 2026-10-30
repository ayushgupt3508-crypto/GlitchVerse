import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsModal } from '../ui/SettingsModal';
import { ExitModal } from '../ui/ExitModal';
import { SaveSystem } from '../systems/SaveSystem';

export class MainMenuScene extends Phaser.Scene {
  private activeModal: Phaser.GameObjects.Container | null = null;
  private pointerIndicator!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];
  private matrixGlitch!: Phaser.GameObjects.Graphics;

  constructor() {
    super(GAME_CONFIG.sceneKeys.MainMenu);
  }

  create(): void {
    this.cameras.main.fadeIn(500);
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Animated Video Background
    if (this.cache.video.exists('main_menu_video')) {
      const bgVideo = this.add.video(width / 2, height / 2, 'main_menu_video');

      bgVideo.setMute(true);
      bgVideo.setLoop(true);
      bgVideo.setScrollFactor(0);
      bgVideo.setDepth(-10);

      // Fires once the video texture exists and bgVideo.width/height == real video size
      bgVideo.on(Phaser.GameObjects.Events.VIDEO_CREATED, (_v: Phaser.GameObjects.Video, vw: number, vh: number) => {
        const scale = Math.min(width / vw, height / vh) * 0.95; // "contain"
        // const scale = Math.max(width / vw, height / vh);     // "cover" (fills screen, crops edges)
        bgVideo.setScale(scale);
        bgVideo.setPosition(width / 2, height / 2);
      });

      bgVideo.play();
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x070b14).setDepth(-10);
    }
    // 2. Title: GraphVerse Logo Image
    const titleX = 135;
    const titleY = 60;

    const logoKey = this.textures.exists('graphverse_logo')
      ? 'graphverse_logo'
      : (this.textures.exists('GraphVerse') ? 'GraphVerse' : 'proto_tile');

    const titleLogo = this.add.image(titleX, titleY, logoKey)
      .setDisplaySize(220, 72)
      .setOrigin(0.5);

    if (!this.textures.exists('graphverse_logo') && !this.textures.exists('GraphVerse')) {
      this.load.image('graphverse_logo', 'assets/GraphVerse.png');
      this.load.once('complete', () => {
        titleLogo.setTexture('graphverse_logo');
        titleLogo.setDisplaySize(186, 62);
      });
      this.load.start();
    }

    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: titleLogo,
          x: titleLogo.x + Phaser.Math.Between(-7, 7),
          y: titleLogo.y + Phaser.Math.Between(-2, 2),
          duration: 40,
          yoyo: true,
          ease: 'Stepped'
        });
      }
    });

    // Subtitle
    this.add.text(titleX, titleY + 34, '// GLITCHVERSE SIMULATION //', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#70e000'
    }).setOrigin(0.5);

    // 3. Selection Pointer (Neon green triangle indicator from reference image)
    this.pointerIndicator = this.add.text(0, 0, '▶', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#70e000'
    }).setOrigin(1, 0.5).setVisible(false);

    // 4. Four Menu Buttons matching reference image
    const buttonConfigs = [
      { label: 'PLAY', icon: '▶', action: () => this.handlePlay() },
      { label: 'SETTINGS', icon: '⚙', action: () => this.openSettings() },
      { label: 'CREDITS', icon: '≡', action: () => this.openCredits() },
      { label: 'EXIT', icon: '➔', action: () => this.openExit() }
    ];

    const startX = 120;
    const startY = 125;
    const spacingY = 36;

    this.buttons = [];
    buttonConfigs.forEach((cfg, idx) => {
      const btn = this.createMenuButton(
        startX,
        startY + idx * spacingY,
        cfg.label,
        cfg.icon,
        idx === 0, // First button selected by default
        cfg.action
      );
      this.buttons.push(btn);
    });

    // Default pointer position to the first button (PLAY)
    this.setPointerToButton(this.buttons[0]);

    // Keyboard shortcuts for level testing: [1] S1, [2] S2, [3] S3, [4] S4 (Ancient Forest), [5] S5 (Futuristic Core)
    if (this.input.keyboard) {
      const key5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
      key5.on('down', () => this.startLevel5());
      const key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
      key4.on('down', () => this.startLevel4());
      const key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
      key3.on('down', () => this.startLevel3());
      const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      key2.on('down', () => {
        this.scene.start('Sector2Scene');
      });
      const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      key1.on('down', () => this.handlePlay());
    }

    // Version label
    this.add.text(width - 12, height - 8, 'GlitchVerse v0.1.0', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#8b9bb4'
    }).setOrigin(1, 1);

    // Matrix Glitch Event
    this.matrixGlitch = this.add.graphics();
    this.matrixGlitch.setScrollFactor(0);
    this.matrixGlitch.setDepth(50);

    const triggerMatrixGlitch = () => {
      if (this.activeModal) {
        this.time.delayedCall(1500, triggerMatrixGlitch);
        return;
      }

      const w = this.scale.width;
      const h = this.scale.height;

      this.matrixGlitch.clear();
      this.matrixGlitch.setAlpha(1);

      // Random horizontal green pixel strips
      const strips = Phaser.Math.Between(5, 12);

      for (let i = 0; i < strips; i++) {
        const x = Phaser.Math.Between(0, w);
        const y = Phaser.Math.Between(0, h);

        const stripWidth = Phaser.Math.Between(20, w * 0.7);
        const stripHeight = Phaser.Math.Between(2, 8);

        // Different shades of Matrix green
        const green = Phaser.Utils.Array.GetRandom([
          0x00ff41,
          0x00cc33,
          0x39ff14,
          0x008f11
        ]);

        this.matrixGlitch.fillStyle(
          green,
          Phaser.Math.FloatBetween(0.3, 0.9)
        );

        this.matrixGlitch.fillRect(
          x + Phaser.Math.Between(-8, 8),
          y,
          stripWidth,
          stripHeight
        );
      }

      // Larger digital interference blocks
      for (let i = 0; i < 3; i++) {
        this.matrixGlitch.fillStyle(0x00ff41, 0.65);

        this.matrixGlitch.fillRect(
          Phaser.Math.Between(0, w),
          Phaser.Math.Between(0, h),
          Phaser.Math.Between(5, 25),
          Phaser.Math.Between(5, 18)
        );
      }

      // Quickly disappear
      this.tweens.add({
        targets: this.matrixGlitch,
        alpha: 0,
        duration: Phaser.Math.Between(70, 120),
        onComplete: () => {
          this.matrixGlitch.clear();
          this.matrixGlitch.setAlpha(1);
        }
      });

      // Random interval before next glitch
      this.time.delayedCall(
        Phaser.Math.Between(2500, 4000),
        triggerMatrixGlitch
      );
    };

    // Start effect
    this.time.delayedCall(1500, triggerMatrixGlitch);
  }

  private startLevel3(): void {
    if (this.activeModal) return;
    this.cameras.main.fade(300, 10, 14, 25, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('Level3Scene');
      }
    });
  }

  private startLevel4(): void {
    if (this.activeModal) return;
    this.cameras.main.fade(300, 10, 28, 20, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('Level4Scene');
      }
    });
  }

  private startLevel5(): void {
    if (this.activeModal) return;
    this.cameras.main.fade(300, 4, 8, 16, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('Level5Scene');
      }
    });
  }

  private createMenuButton(
    x: number,
    y: number,
    label: string,
    icon: string,
    isDefaultActive: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const btnWidth = 140;
    const btnHeight = 28;

    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawBtn = (fillColor: number, strokeColor: number, fillAlpha: number, isHighlighted: boolean) => {
      bg.clear();
      // Outer button frame with bracketed/chamfered styling
      bg.fillStyle(fillColor, fillAlpha);
      bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      bg.lineStyle(1.5, strokeColor, 0.95);
      bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);

      // Stylized corner brackets
      if (isHighlighted) {
        bg.lineStyle(2, 0x70e000, 1);
        const cw = 4;
        bg.strokeRect(-btnWidth / 2 - 1, -btnHeight / 2 - 1, cw, cw);
        bg.strokeRect(btnWidth / 2 - cw + 1, -btnHeight / 2 - 1, cw, cw);
        bg.strokeRect(-btnWidth / 2 - 1, btnHeight / 2 - cw + 1, cw, cw);
        bg.strokeRect(btnWidth / 2 - cw + 1, btnHeight / 2 - cw + 1, cw, cw);
      }
    };

    const initialFill = isDefaultActive ? 0x0c251d : 0x0b1320;
    const initialStroke = isDefaultActive ? 0x70e000 : 0x243b59;
    drawBtn(initialFill, initialStroke, 0.88, isDefaultActive);

    // Icon
    const iconText = this.add.text(-btnWidth / 2 + 16, 0, icon, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: isDefaultActive ? '#70e000' : '#8b9bb4'
    }).setOrigin(0.5);

    // Label
    const labelText = this.add.text(-btnWidth / 2 + 34, 0, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: isDefaultActive ? '#70e000' : '#e0fbfc'
    }).setOrigin(0, 0.5);

    const hitArea = this.add.zone(0, 0, btnWidth, btnHeight).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      if (this.activeModal) return;
      drawBtn(0x0c251d, 0x70e000, 0.95, true);
      iconText.setColor('#70e000');
      labelText.setColor('#70e000');
      container.setScale(1.02);
      this.setPointerToButton(container);
    });

    hitArea.on('pointerout', () => {
      if (this.activeModal) return;
      drawBtn(0x0b1320, 0x243b59, 0.88, false);
      iconText.setColor('#8b9bb4');
      labelText.setColor('#e0fbfc');
      container.setScale(1.0);
    });

    hitArea.on('pointerdown', () => {
      if (this.activeModal) return;
      drawBtn(0x1a4535, 0xffffff, 1, true);
      container.setScale(0.97);
    });

    hitArea.on('pointerup', () => {
      if (this.activeModal) return;
      drawBtn(0x0c251d, 0x70e000, 0.95, true);
      container.setScale(1.02);
      onClick();
    });

    container.add([bg, iconText, labelText, hitArea]);
    return container;
  }

  private setPointerToButton(btn: Phaser.GameObjects.Container): void {
    this.pointerIndicator.setVisible(true);
    this.pointerIndicator.setPosition(btn.x - 76, btn.y);
  }

  private handlePlay(): void {
    if (this.activeModal) return;
    const cam = this.cameras.main;
    cam.fadeOut(500);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('StoryScene');
    });
  }

  private openSettings(): void {
    if (this.activeModal) return;
    this.activeModal = new SettingsModal(this, () => {
      this.activeModal = null;
    });
  }

  private openCredits(): void {
    if (this.activeModal) return;
    const cam = this.cameras.main;
    cam.fadeOut(500);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('Credits');
    });
  }

  private openExit(): void {
    if (this.activeModal) return;
    this.activeModal = new ExitModal(this, () => {
      this.activeModal = null;
    });
  }
}
