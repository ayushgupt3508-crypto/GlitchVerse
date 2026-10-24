import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsModal } from '../ui/SettingsModal';
import { CreditsModal } from '../ui/CreditsModal';
import { ExitModal } from '../ui/ExitModal';

export class MainMenuScene extends Phaser.Scene {
  private activeModal: Phaser.GameObjects.Container | null = null;
  private pointerIndicator!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super(GAME_CONFIG.sceneKeys.MainMenu);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Visual Foundation: Provided Reference Image
    if (this.textures.exists('main_menu_bg')) {
      const bg = this.add.image(width / 2, height / 2, 'main_menu_bg');
      // Scale to fit canvas while preserving aspect ratio
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale).setScrollFactor(0);
    } else {
      // Fallback dark gradient
      this.add.rectangle(width / 2, height / 2, width, height, 0x070b14);
    }

    // Subtle atmospheric scanlines overlay
    const scanlines = this.add.graphics();
    scanlines.lineStyle(1, 0x000000, 0.15);
    for (let y = 0; y < height; y += 4) {
      scanlines.lineBetween(0, y, width, y);
    }

    // 2. Title: "TITLE" (per Master Prompt specification)
    // Positioned in top-left matching reference image layout
    const titleX = 135;
    const titleY = 62;

    const titleShadow = this.add.text(titleX + 2, titleY + 2, 'GlitchVerse', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#9d4edd'
    }).setOrigin(0.5);

    const titleText = this.add.text(titleX, titleY, 'GlitchVerse', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Subtle glitch pulse on Title
    this.tweens.add({
      targets: [titleText, titleShadow],
      x: '+=1',
      duration: 80,
      yoyo: true,
      repeat: -1,
      repeatDelay: 3000
    });

    // Subtitle
    this.add.text(titleX, titleY + 24, '// GLITCHVERSE SIMULATION //', {
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
        this.cameras.main.fade(300, 7, 11, 20, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) this.scene.start('Sector2Scene');
        });
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
    this.cameras.main.fade(300, 7, 11, 20, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('StoryScene');
      }
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
    this.activeModal = new CreditsModal(this, () => {
      this.activeModal = null;
    });
  }

  private openExit(): void {
    if (this.activeModal) return;
    this.activeModal = new ExitModal(this, () => {
      this.activeModal = null;
    });
  }
}
