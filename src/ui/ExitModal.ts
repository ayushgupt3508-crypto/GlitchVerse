import Phaser from 'phaser';

export class ExitModal extends Phaser.GameObjects.Container {
  private panelWidth = 320;
  private panelHeight = 160;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x040711, 0.8)
      .setInteractive();
    this.add(backdrop);

    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x0a101d, 0.95);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);
    panel.lineStyle(2, 0x00f0ff, 0.85);
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    panel.fillStyle(0x132238, 1);
    panel.fillRect(px, py, this.panelWidth, 28);
    panel.lineStyle(1, 0x00f0ff, 0.4);
    panel.lineBetween(px, py + 28, px + this.panelWidth, py + 28);
    this.add(panel);

    const header = scene.add.text(width / 2, py + 14, 'EXIT SIMULATION', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#00f0ff'
    }).setOrigin(0.5);
    this.add(header);

    const msg = scene.add.text(width / 2, py + 70, 'You can close this browser tab\nto leave GlitchVerse safely.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#e0fbfc',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);
    this.add(msg);

    const okBtn = this.createButton(scene, width / 2, py + this.panelHeight - 25, 'RETURN TO MENU', () => {
      this.destroy();
      onClose();
    });
    this.add(okBtn);

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
    const w = 130;
    const h = 24;

    const draw = (color: number, stroke: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRect(-w / 2, -h / 2, w, h);
      bg.lineStyle(1, stroke, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };
    draw(0x142033, 0x00f0ff);

    const txt = scene.add.text(0, 0, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#e0fbfc'
    }).setOrigin(0.5);

    const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(0x1f3554, 0x00f0ff);
      txt.setColor('#00f0ff');
    });
    hit.on('pointerout', () => {
      draw(0x142033, 0x00f0ff);
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
