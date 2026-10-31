import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import { GAME_FONTS } from '../config';
import { TextureGenerator } from '../utils/TextureGenerator';
import { CharacterColorManager } from '../utils/CharacterColor';
import { Player } from '../entities/Player';
import { GAME_CONFIG } from '../config';

export class SettingsModal extends Phaser.GameObjects.Container {
  private panelWidth = 440;
  private panelHeight = 340;
  private currentSettings = SaveSystem.getSettings();

  // Color customization state
  private selectedColor: string | null = null;
  private previewSprite!: Phaser.GameObjects.Sprite;
  private hexLabel!: Phaser.GameObjects.Text;
  private statusMessageText!: Phaser.GameObjects.Text;
  private statusTimer?: Phaser.Time.TimerEvent;
  private swatchBorders: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private colorInputElement: HTMLInputElement | null = null;
  

  private readonly PREDEFINED_PALETTE = [
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Light Grey', hex: '#C0C0C0' },
    { name: 'Grey', hex: '#808080' },
    { name: 'Black', hex: '#000000' },
    { name: 'Red', hex: '#FF0000' },
    { name: 'Dark Red', hex: '#800000' },
    { name: 'Orange', hex: '#FF8000' },
    { name: 'Yellow', hex: '#FFFF00' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Green', hex: '#008000' },
    { name: 'Lime', hex: '#00FF00' },
    { name: 'Neon Green', hex: '#39FF14' },
    { name: 'Cyan', hex: '#00FFFF' },
    { name: 'Dark Cyan', hex: '#008080' },
    { name: 'Blue', hex: '#0000FF' },
    { name: 'Navy', hex: '#000080' },
    { name: 'Purple', hex: '#800080' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Pink', hex: '#FF69B4' },
    { name: 'Brown', hex: '#8B4513' }
  ];

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene, 0, 0);
    this.setScrollFactor(0);
    this.setDepth(2100);

    // Ensure player textures exist for preview
    TextureGenerator.generatePlayerTextures(scene);

    // Load initial character color
    this.selectedColor = CharacterColorManager.getCharacterColor();

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
    panel.fillStyle(0x0a101d, 0.96);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);
    panel.lineStyle(2, 0x00f0ff, 0.85);
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Corner decorative brackets
    panel.lineStyle(2, 0x70e000, 0.9);
    const cw = 6;
    panel.strokeRect(px - 1, py - 1, cw, cw);
    panel.strokeRect(px + this.panelWidth - cw + 1, py - 1, cw, cw);
    panel.strokeRect(px - 1, py + this.panelHeight - cw + 1, cw, cw);
    panel.strokeRect(px + this.panelWidth - cw + 1, py + this.panelHeight - cw + 1, cw, cw);

    // Accent header bar
    panel.fillStyle(0x132238, 1);
    panel.fillRect(px, py, this.panelWidth, 26);
    panel.lineStyle(1, 0x00f0ff, 0.4);
    panel.lineBetween(px, py + 26, px + this.panelWidth, py + 26);

    this.add(panel);

    // Header Title
    const headerText = scene.add.text(width / 2, py + 13, 'SYSTEM SETTINGS', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    this.add(headerText);

    // ─────────────────────────────────────────────
    // SECTION 1: Audio Volume Controls
    // ─────────────────────────────────────────────
    const audioStartY = py + 42;
    const audioSpacingY = 25;

    this.createSlider(scene, width / 2, audioStartY, 'MASTER AUDIO', this.currentSettings.masterVolume, (val) => {
      this.currentSettings.masterVolume = val;
      SaveSystem.saveSettings({ masterVolume: val });
      AudioManager.applyVolume();
    });

    this.createSlider(scene, width / 2, audioStartY + audioSpacingY, 'MUSIC VOLUME', this.currentSettings.musicVolume, (val) => {
      this.currentSettings.musicVolume = val;
      SaveSystem.saveSettings({ musicVolume: val });
      AudioManager.applyVolume();
    });

    this.createSlider(scene, width / 2, audioStartY + audioSpacingY * 2, 'SFX VOLUME', this.currentSettings.sfxVolume, (val) => {
      this.currentSettings.sfxVolume = val;
      SaveSystem.saveSettings({ sfxVolume: val });
      AudioManager.applyVolume();
    });

    // ─────────────────────────────────────────────
    // Visually Distinct Divider
    // ─────────────────────────────────────────────
    const dividerY = audioStartY + audioSpacingY * 2 + 20;
    const divider = scene.add.graphics();
    divider.setScrollFactor(0);
    divider.lineStyle(1, 0x00f0ff, 0.35);
    divider.lineBetween(px + 20, dividerY, px + this.panelWidth - 20, dividerY);
    // Subtle glow line in center
    divider.lineStyle(1, 0x39ff14, 0.65);
    divider.lineBetween(width / 2 - 60, dividerY, width / 2 + 60, dividerY);
    this.add(divider);

    // ─────────────────────────────────────────────
    // SECTION 2: Character Customization
    // ─────────────────────────────────────────────
    const customStartY = dividerY + 12;

    // Section Title
    const sectionTitle = scene.add.text(width / 2, customStartY, 'CHARACTER CUSTOMIZATION', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#39ff14',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    this.add(sectionTitle);

    this.buildCustomizationSection(scene, px, customStartY + 14);

    // ─────────────────────────────────────────────
    // Confirmation / Status Message
    // ─────────────────────────────────────────────
    this.statusMessageText = scene.add.text(width / 2, py + this.panelHeight - 35, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#39ff14',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setAlpha(0);
    this.add(this.statusMessageText);

    // ─────────────────────────────────────────────
    // Bottom Buttons: VIEW TUTORIAL & BACK
    // ─────────────────────────────────────────────
    const footerBtnY = py + this.panelHeight - 16;

    // View Tutorial Button -> Launches the Playable 5-Environment Tutorial
    const tutorialBtn = this.createButton(scene, width / 2 - 64, footerBtnY, 114, 20, 'VIEW TUTORIAL', () => {
      this.cleanupColorInput();
      this.destroy();
      onClose();
      scene.scene.start(GAME_CONFIG.sceneKeys.Tutorial, { source: 'settings' });
    }, 0x142033, 0x00f0ff);
    this.add(tutorialBtn);

    // Close / Back Button
    const backBtn = this.createButton(scene, width / 2 + 54, footerBtnY, 78, 20, '< BACK', () => {
      this.cleanupColorInput();

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

  private buildCustomizationSection(scene: Phaser.Scene, panelLeft: number, startY: number): void {
    // Left side: Character Preview Box
    const previewBoxX = panelLeft + 54;
    const previewBoxY = startY + 42;
    const boxW = 68;
    const boxH = 76;

    const previewBg = scene.add.graphics();
    previewBg.setScrollFactor(0);
    previewBg.fillStyle(0x070c16, 0.95);
    previewBg.fillRect(previewBoxX - boxW / 2, previewBoxY - boxH / 2, boxW, boxH);
    previewBg.lineStyle(1.5, 0x00f0ff, 0.7);
    previewBg.strokeRect(previewBoxX - boxW / 2, previewBoxY - boxH / 2, boxW, boxH);
    // Grid lines inside preview
    previewBg.lineStyle(1, 0x142033, 0.6);
    previewBg.lineBetween(previewBoxX - boxW / 2, previewBoxY, previewBoxX + boxW / 2, previewBoxY);
    previewBg.lineBetween(previewBoxX, previewBoxY - boxH / 2, previewBoxX, previewBoxY + boxH / 2);
    this.add(previewBg);

    // Pedestal floor line
    const pedestal = scene.add.graphics();
    pedestal.setScrollFactor(0);
    pedestal.fillStyle(0x132238, 0.9);
    pedestal.fillRect(previewBoxX - 22, previewBoxY + 18, 44, 4);
    pedestal.lineStyle(1, 0x39ff14, 0.6);
    pedestal.strokeRect(previewBoxX - 22, previewBoxY + 18, 44, 4);
    this.add(pedestal);

    // Live Scientist Sprite Preview (Uses actual scientist_idle frame, preserves 20x36 original proportions)
    this.previewSprite = scene.add.sprite(previewBoxX, previewBoxY - 2, 'scientist_idle');
    this.previewSprite.setScrollFactor(0);
    this.previewSprite.setScale(1.4); // slightly scaled for clear preview while strictly preserving original aspect ratio
    this.add(this.previewSprite);

    // Current Color Label below preview box
    this.hexLabel = scene.add.text(previewBoxX, previewBoxY + boxH / 2 + 9, this.getFormattedColorLabel(), {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    this.add(this.hexLabel);

    // Apply preview tint
    this.updatePreviewVisual();

    // ─────────────────────────────────────────────
    // Right side: MS Paint Palette (10 cols x 2 rows)
    // ─────────────────────────────────────────────
    const paletteStartX = panelLeft + 104;
    const paletteStartY = startY + 10;
    const swatchSize = 16;
    const swatchGap = 4;
    const cols = 10;

    this.PREDEFINED_PALETTE.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const sx = paletteStartX + col * (swatchSize + swatchGap) + swatchSize / 2;
      const sy = paletteStartY + row * (swatchSize + swatchGap) + swatchSize / 2;

      const swatchCont = this.createColorSwatch(scene, sx, sy, swatchSize, item.hex, item.name);
      this.add(swatchCont);
    });

    // ─────────────────────────────────────────────
    // Controls row: Custom Color, Apply, Reset
    // ─────────────────────────────────────────────
    const btnRowY = startY + 58;

    // Custom Color Button
    const customBtn = this.createButton(scene, paletteStartX + 52, btnRowY, 94, 20, 'CUSTOM COLOR', () => {
      this.openNativeColorPicker();
    });
    this.add(customBtn);

    // Apply Button
    const applyBtn = this.createButton(scene, paletteStartX + 144, btnRowY, 68, 20, 'APPLY', () => {
      this.applyColor();
    }, 0x0c281e, 0x39ff14);
    this.add(applyBtn);

    // Reset to Default Button
    const resetBtn = this.createButton(scene, paletteStartX + 230, btnRowY, 82, 20, 'RESET DEFAULT', () => {
      this.resetToDefault();
    }, 0x24141d, 0xff5577);
    this.add(resetBtn);

    // Helper hint text
    const hint = scene.add.text(paletteStartX + 2, startY + 76, '* Select a swatch or pick a custom colour, then click APPLY.', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '8px',
      color: '#8b9bb4'
    }).setScrollFactor(0);
    this.add(hint);

    // Highlight initial selected swatch if any
    this.refreshSwatchBorders();
  }

  private createColorSwatch(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    hex: string,
    _name: string
  ): Phaser.GameObjects.Container {
    const cont = scene.add.container(x, y);
    cont.setScrollFactor(0);

    const fillNum = parseInt(hex.replace('#', ''), 16);

    // Fill rect
    const fill = scene.add.rectangle(0, 0, size, size, fillNum);
    fill.setScrollFactor(0);

    // Border graphics
    const border = scene.add.graphics();
    border.setScrollFactor(0);
    this.swatchBorders.set(hex.toUpperCase(), border);

    // Hit zone
    const hit = scene.add.zone(0, 0, size + 2, size + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      this.selectColor(hex);
      AudioManager.playMenuSelect();
    });

    hit.on('pointerover', () => {
      if (this.selectedColor !== hex.toUpperCase()) {
        border.clear();
        border.lineStyle(1.5, 0xffffff, 0.9);
        border.strokeRect(-size / 2 - 1, -size / 2 - 1, size + 2, size + 2);
      }
    });

    hit.on('pointerout', () => {
      if (this.selectedColor !== hex.toUpperCase()) {
        border.clear();
        border.lineStyle(1, 0x1f3554, 0.8);
        border.strokeRect(-size / 2, -size / 2, size, size);
      }
    });

    cont.add([fill, border, hit]);
    return cont;
  }

  private selectColor(hex: string): void {
    this.selectedColor = hex.toUpperCase();
    this.updatePreviewVisual();
    this.refreshSwatchBorders();
  }

  private updatePreviewVisual(): void {
    if (!this.previewSprite) return;

    if (this.selectedColor) {
      const num = CharacterColorManager.hexToNumber(this.selectedColor);
      if (num !== null) {
        this.previewSprite.setTint(num);
      } else {
        this.previewSprite.clearTint();
      }
    } else {
      this.previewSprite.clearTint();
    }

    if (this.hexLabel) {
      this.hexLabel.setText(this.getFormattedColorLabel());
      this.hexLabel.setColor(this.selectedColor ? this.selectedColor : '#00f0ff');
    }
  }

  private refreshSwatchBorders(): void {
    const size = 16;
    this.swatchBorders.forEach((borderGfx, hexKey) => {
      borderGfx.clear();
      if (this.selectedColor === hexKey) {
        // Highlighting border for selected swatch
        borderGfx.lineStyle(2, 0x39ff14, 1);
        borderGfx.strokeRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
        borderGfx.lineStyle(1, 0xffffff, 0.9);
        borderGfx.strokeRect(-size / 2 - 1, -size / 2 - 1, size + 2, size + 2);
      } else {
        borderGfx.lineStyle(1, 0x1f3554, 0.8);
        borderGfx.strokeRect(-size / 2, -size / 2, size, size);
      }
    });
  }

  private getFormattedColorLabel(): string {
    if (!this.selectedColor) {
      return 'COLOR: DEFAULT';
    }
    return `COLOR: ${this.selectedColor}`;
  }

  private openNativeColorPicker(): void {
    this.cleanupColorInput();

    // Create an invisible HTML5 <input type="color"> attached to document body
    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.selectedColor ? CharacterColorManager.normalizeHex(this.selectedColor) : '#00FFFF';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    // Prevent keyboard events from triggering gameplay controls while active
    const stopPropagation = (e: KeyboardEvent) => e.stopPropagation();
    input.addEventListener('keydown', stopPropagation);
    input.addEventListener('keyup', stopPropagation);
    input.addEventListener('keypress', stopPropagation);

    input.addEventListener('input', () => {
      this.selectColor(input.value);
    });

    input.addEventListener('change', () => {
      this.selectColor(input.value);
      this.cleanupColorInput();
    });

    document.body.appendChild(input);
    this.colorInputElement = input;

    // Trigger browser picker dialog
    try {
      input.click();
    } catch (e) {
      console.warn('Failed to open native color chooser:', e);
    }
  }

  private cleanupColorInput(): void {
    if (this.colorInputElement) {
      try {
        if (this.colorInputElement.parentNode) {
          this.colorInputElement.parentNode.removeChild(this.colorInputElement);
        }
      } catch (e) {
        // ignore
      }
      this.colorInputElement = null;
    }
  }

  private applyColor(): void {
    CharacterColorManager.setCharacterColor(this.selectedColor);

    // Apply immediately to any active Player in current scene
    const activePlayer = (this.scene as any).player;
    if (activePlayer instanceof Player) {
      activePlayer.applyCustomColor();
    }

    AudioManager.playMenuSelect();
    this.showStatusMessage('CHARACTER COLOUR SAVED');
  }

  private resetToDefault(): void {
    this.selectedColor = null;
    CharacterColorManager.setCharacterColor(null);
    this.updatePreviewVisual();
    this.refreshSwatchBorders();

    const activePlayer = (this.scene as any).player;
    if (activePlayer instanceof Player) {
      activePlayer.applyCustomColor();
    }

    AudioManager.playMenuSelect();
    this.showStatusMessage('RESET TO DEFAULT');
  }

  private showStatusMessage(text: string): void {
    if (!this.statusMessageText) return;

    if (this.statusTimer) {
      this.statusTimer.remove();
      this.statusTimer = undefined;
    }

    this.statusMessageText.setText(text);
    this.statusMessageText.setAlpha(1);

    this.scene.tweens.killTweensOf(this.statusMessageText);
    this.scene.tweens.add({
      targets: this.statusMessageText,
      scaleX: 1.1,
      scaleY: 1.1,
      yoyo: true,
      duration: 90,
      ease: 'Power1'
    });

    this.statusTimer = this.scene.time.delayedCall(2200, () => {
      this.scene.tweens.add({
        targets: this.statusMessageText,
        alpha: 0,
        duration: 250
      });
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
    const sliderHeight = 6;
    const leftX = centerX - sliderWidth / 2 + 30;

    // Label
    const lbl = scene.add.text(leftX - 90, y, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#a0aec0',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.add(lbl);

    // Value percentage text
    const valText = scene.add.text(leftX + sliderWidth + 14, y, `${Math.round(initialVal * 100)}%`, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
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
    const handle = scene.add.rectangle(leftX + sliderWidth * initialVal, y, 8, 14, 0xffffff)
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

  private createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    customFill?: number,
    customStroke?: number
  ): Phaser.GameObjects.Container {
    const btn = scene.add.container(x, y);
    btn.setScrollFactor(0);
    const bg = scene.add.graphics();
    bg.setScrollFactor(0);

    const normalFill = customFill ?? 0x142033;
    const normalStroke = customStroke ?? 0x00f0ff;

    const draw = (color: number, stroke: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRect(-w / 2, -h / 2, w, h);
      bg.lineStyle(1, stroke, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };
    draw(normalFill, normalStroke);

    const txt = scene.add.text(0, 0, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#e0fbfc',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);

    const hit = scene.add.zone(0, 0, w, h)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      draw(normalFill + 0x0a141e, normalStroke);
      txt.setColor('#00f0ff');
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
      onClick();
    });

    btn.add([bg, txt, hit]);
    btn.setScrollFactor(0, 0, true);
    return btn;
  }

  public override destroy(fromScene?: boolean): void {
    this.cleanupColorInput();
    if (this.statusTimer) {
      this.statusTimer.remove();
      this.statusTimer = undefined;
    }
    super.destroy(fromScene);
  }
}