import Phaser from 'phaser';
import { GAME_FONTS } from '../config';

export class CreditsModal extends Phaser.GameObjects.Container {
  private panelWidth = 380;
  private panelHeight = 240;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Dark backdrop overlay
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x040711, 0.8)
      .setInteractive();
    this.add(backdrop);

    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    // Frame
    const panel = scene.add.graphics();
    panel.fillStyle(0x0a101d, 0.95);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);
    panel.lineStyle(2, 0x9d4edd, 0.85); // Purple neon glitch border
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Accent header bar
    panel.fillStyle(0x19142e, 1);
    panel.fillRect(px, py, this.panelWidth, 30);
    panel.lineStyle(1, 0x9d4edd, 0.4);
    panel.lineBetween(px, py + 30, px + this.panelWidth, py + 30);
    this.add(panel);

    // Title
    const header = scene.add.text(width / 2, py + 15, 'CREDITS // ARCHIVES', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#c77dff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.add(header);

    // Masked viewport for scrolling text
    const maskShape = scene.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(px + 10, py + 35, this.panelWidth - 20, this.panelHeight - 75);
    const mask = maskShape.createGeometryMask();

    const creditsLines = [
      'PROJECT GLITCHVERSE',
      'A 2D Reality-Manipulation Platformer',
      '------------------------------------',
      'GAME DEVS:',
      'Ayush Gupta - Programmer',
      'Neel Patel -  Game Designer',
      'Prachi Khamkar - UI/UX Designer',

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
      
      'END OF TRANSMISSION'
    ];

    const creditsContent = scene.add.text(width / 2, py + 190, creditsLines.join('\n'), {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#e0aaff',
      align: 'center',
      lineSpacing: 5,
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5, 0);

    creditsContent.setMask(mask);
    this.add(creditsContent);

    // Rolling animation
    const scrollDuration = 18000;
    const endY = py - creditsContent.height + 40;
    const tween = scene.tweens.add({
      targets: creditsContent,
      y: endY,
      duration: scrollDuration,
      repeat: -1,
      ease: 'Linear'
    });

    // Close Button
    const backBtn = this.createButton(scene, width / 2, py + this.panelHeight - 22, '< BACK', () => {
      tween.stop();
      maskShape.destroy();
      this.destroy();
      onClose();
    });
    this.add(backBtn);

    scene.add.existing(this);
    this.setDepth(100);

    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 180,
      ease: 'Power2'
    });
  }

  private createButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const btn = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const w = 90;
    const h = 24;

    const draw = (color: number, stroke: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRect(-w / 2, -h / 2, w, h);
      bg.lineStyle(1, stroke, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };
    draw(0x1a1226, 0x9d4edd);

    const txt = scene.add.text(0, 0, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#e0fbfc',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5);

    const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(0x2a1a40, 0xc77dff);
      txt.setColor('#c77dff');
    });
    hit.on('pointerout', () => {
      draw(0x1a1226, 0x9d4edd);
      txt.setColor('#e0fbfc');
    });
    hit.on('pointerdown', () => btn.setScale(0.96));
    hit.on('pointerup', () => {
      btn.setScale(1);
      onClick();
    });

    btn.add([bg, txt, hit]);
    return btn;
  }
}
