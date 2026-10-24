import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class SettingsModal extends Phaser.GameObjects.Container {
  private panelWidth = 360;
  private panelHeight = 230;
  private currentSettings = SaveSystem.getSettings();

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene, 0, 0);
    this.setScrollFactor(0);
    this.setDepth(2100);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Dark backdrop overlay
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x040711, 0.8)
      .setScrollFactor(0)
      .setInteractive(); // Blocks clicks to buttons behind

    this.add(backdrop);

    // Modal Frame
    const panel = scene.add.graphics();
    panel.setScrollFactor(0);
    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    // Outer cyber border & dark fill
    panel.fillStyle(0x0a101d, 0.95);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);
    panel.lineStyle(2, 0x00f0ff, 0.85);
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Accent header bar
    panel.fillStyle(0x132238, 1);
    panel.fillRect(px, py, this.panelWidth, 30);
    panel.lineStyle(1, 0x00f0ff, 0.4);
    panel.lineBetween(px, py + 30, px + this.panelWidth, py + 30);

    this.add(panel);

    // Header Title
    const headerText = scene.add.text(width / 2, py + 15, 'SYSTEM SETTINGS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#00f0ff'
    }).setOrigin(0.5).setScrollFactor(0);
    this.add(headerText);

    // Volume Sliders
    const startY = py + 55;
    const spacingY = 40;

    this.createSlider(scene, width / 2, startY, 'MASTER AUDIO', this.currentSettings.masterVolume, (val) => {
      this.currentSettings.masterVolume = val;
      SaveSystem.saveSettings({ masterVolume: val });
    });

    this.createSlider(scene, width / 2, startY + spacingY, 'MUSIC VOLUME', this.currentSettings.musicVolume, (val) => {
      this.currentSettings.musicVolume = val;
      SaveSystem.saveSettings({ musicVolume: val });
    });

    this.createSlider(scene, width / 2, startY + spacingY * 2, 'SFX VOLUME', this.currentSettings.sfxVolume, (val) => {
      this.currentSettings.sfxVolume = val;
      SaveSystem.saveSettings({ sfxVolume: val });
    });

    // Close / Back Button
    const backBtnY = py + this.panelHeight - 25;
    const backBtn = this.createButton(scene, width / 2, backBtnY, '< BACK', () => {
      this.destroy();
      onClose();
    });
    this.add(backBtn);

    this.setScrollFactor(0, 0, true);
    scene.add.existing(this);

    // Entrance animation
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 180,
      ease: 'Power2'
    });
  }

  private createSlider(
    scene: Phaser.Scene,
    centerX: number,
    y: number,
    label: string,
    initialVal: number,
    onChange: (val: number) => void
  ): void {
    const sliderWidth = 140;
    const sliderHeight = 8;
    const leftX = centerX - sliderWidth / 2 + 30;

    // Label
    const lbl = scene.add.text(leftX - 80, y, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#8b9bb4'
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.add(lbl);

    // Value percentage text
    const valText = scene.add.text(leftX + sliderWidth + 20, y, `${Math.round(initialVal * 100)}%`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#00f0ff'
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.add(valText);

    // Slider track
    const track = scene.add.graphics();
    track.setScrollFactor(0);
    const updateTrack = (pct: number) => {
      track.clear();
      // Background bar
      track.fillStyle(0x1a293d, 1);
      track.fillRect(leftX, y - sliderHeight / 2, sliderWidth, sliderHeight);
      track.lineStyle(1, 0x2b4263, 1);
      track.strokeRect(leftX, y - sliderHeight / 2, sliderWidth, sliderHeight);
      // Active fill
      track.fillStyle(0x00f0ff, 0.85);
      track.fillRect(leftX, y - sliderHeight / 2, sliderWidth * pct, sliderHeight);
    };
    updateTrack(initialVal);
    this.add(track);

    // Interactive handle
    const handle = scene.add.rectangle(leftX + sliderWidth * initialVal, y, 10, 16, 0xffffff)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.add(handle);

    // Slider Drag logic
    scene.input.setDraggable(handle);
    handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const clampedX = Phaser.Math.Clamp(dragX, leftX, leftX + sliderWidth);
      handle.x = clampedX;
      const pct = (clampedX - leftX) / sliderWidth;
      updateTrack(pct);
      valText.setText(`${Math.round(pct * 100)}%`);
      onChange(pct);
    });
  }

  private createButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const btn = scene.add.container(x, y);
    btn.setScrollFactor(0);
    const bg = scene.add.graphics();
    bg.setScrollFactor(0);
    const w = 90;
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
    }).setOrigin(0.5).setScrollFactor(0);

    const hit = scene.add.zone(0, 0, w, h)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(0x1f3554, 0x00f0ff);
      txt.setColor('#00f0ff');
    });
    hit.on('pointerout', () => {
      draw(0x142033, 0x00f0ff);
      txt.setColor('#e0fbfc');
    });
    hit.on('pointerdown', () => {
      btn.setScale(0.96);
    });
    hit.on('pointerup', () => {
      btn.setScale(1);
      onClick();
    });

    btn.add([bg, txt, hit]);
    btn.setScrollFactor(0, 0, true);
    return btn;
  }
}
