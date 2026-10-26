import Phaser from 'phaser';
import { SettingsModal } from './SettingsModal';
import { AudioManager } from '../systems/AudioManager';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onCheckpoint?: () => void;
}

export class PauseMenu extends Phaser.GameObjects.Container {
  private panelWidth = 240;
  private panelHeight = 220;
  private subModal: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    super(scene, 0, 0);
    this.setScrollFactor(0);
    this.setDepth(2000);
    AudioManager.setMusicDucked(true);

    const hasCheckpoint = !!callbacks.onCheckpoint;
    if (hasCheckpoint) {
      this.panelHeight = 256;
    }

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Dark backdrop overlay that blocks world inputs
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x040711, 0.78)
      .setScrollFactor(0)
      .setInteractive();
    this.add(backdrop);

    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    const panel = scene.add.graphics();
    panel.setScrollFactor(0);
    panel.fillStyle(0x0a101d, 0.95);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);
    panel.lineStyle(2, 0x00f0ff, 0.85);
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Header bar
    panel.fillStyle(0x132238, 1);
    panel.fillRect(px, py, this.panelWidth, 30);
    panel.lineStyle(1, 0x00f0ff, 0.4);
    panel.lineBetween(px, py + 30, px + this.panelWidth, py + 30);
    this.add(panel);

    const header = scene.add.text(width / 2, py + 15, 'SIMULATION PAUSED', {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '14px',
      color: '#00f0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    this.add(header);

    const buttons: Array<{ label: string; action: () => void }> = [
      { label: 'RESUME', action: () => callbacks.onResume() },
    ];
    if (hasCheckpoint) {
      buttons.push({ label: 'START AT CHECKPOINT', action: () => callbacks.onCheckpoint!() });
    }
    buttons.push(
      { label: 'RESTART LEVEL', action: () => callbacks.onRestart() },
      {
        label: 'SETTINGS',
        action: () => {
          if (this.subModal) return;
          this.subModal = new SettingsModal(scene, () => {
            this.subModal = null;
          });
        }
      },
      { label: 'MAIN MENU', action: () => callbacks.onMainMenu() }
    );

    const startY = hasCheckpoint ? py + 52 : py + 60;
    const spacingY = hasCheckpoint ? 35 : 36;
    const w = 175;
    const h = 28;

    buttons.forEach((btn, idx) => {
      const by = startY + idx * spacingY;
      const bx = width / 2;

      const bg = scene.add.graphics();
      bg.setScrollFactor(0);
      const draw = (color: number, stroke: number) => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRect(bx - w / 2, by - h / 2, w, h);
        bg.lineStyle(1, stroke, 1);
        bg.strokeRect(bx - w / 2, by - h / 2, w, h);
      };
      draw(0x142033, 0x243b59);

      const txt = scene.add.text(bx, by, btn.label, {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '13px',
        color: '#e0fbfc',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setScrollFactor(0);

      const hit = scene.add.zone(bx, by, w, h)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerover', () => {
        draw(0x192a45, 0x00f0ff);
        txt.setColor('#00f0ff');
        AudioManager.playMenuHover();
      });

      hit.on('pointerout', () => {
        draw(0x142033, 0x243b59);
        txt.setColor('#e0fbfc');
      });

      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        AudioManager.playMenuSelect();
        btn.action();
      });

      this.add([bg, txt, hit]);
    });

    this.setScrollFactor(0, 0, true);
    scene.add.existing(this);
  }

  override destroy(fromScene?: boolean): void {
    AudioManager.setMusicDucked(false);
    if (this.subModal) {
      this.subModal.destroy(fromScene);
      this.subModal = null;
    }
    super.destroy(fromScene);
  }
}
