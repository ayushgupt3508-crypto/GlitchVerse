import Phaser from 'phaser';
import { GAME_FONTS } from '../config';
import { AudioManager } from '../systems/AudioManager';

export type TutorialEntrySource = 'settings' | 'story';

export interface TutorialModalOptions {
  source: TutorialEntrySource;
  onClose: () => void;
  onStartGame?: () => void;
}

interface TutorialPage {
  title: string;
  category: string;
  accentColor: number;
  description: string;
  keyBindings: { key: string; label: string }[];
  details: { label: string; text: string }[];
  visualType: 'movement' | 'interaction' | 'abilities' | 'objective';
}

export class TutorialModal extends Phaser.GameObjects.Container {
  private panelWidth = 520;
  private panelHeight = 310;
  private currentPage = 0;
  private source: TutorialEntrySource;
  private onCloseCallback: () => void;
  private onStartGameCallback?: () => void;
  private isClosing = false;

  // UI References
  private pageIndicatorText!: Phaser.GameObjects.Text;
  private contentContainer!: Phaser.GameObjects.Container;
  private nextBtnText!: Phaser.GameObjects.Text;
  private nextBtnContainer!: Phaser.GameObjects.Container;
  private prevBtnContainer!: Phaser.GameObjects.Container;
  private escHandler?: () => void;

  private readonly pages: TutorialPage[] = [
    {
      title: 'MOVEMENT & NAVIGATION',
      category: 'PHASE 01 // BASIC CONTROLS',
      accentColor: 0x00f0ff,
      description: 'Master Vance\'s locomotion across collapsing quantum simulations. Precise jumps and momentum control are required to traverse treacherous terrain.',
      keyBindings: [
        { key: 'A / D', label: 'Move Left / Right' },
        { key: '← / →', label: 'Alternative Move' },
        { key: 'SPACE / W', label: 'Jump' },
        { key: '↑', label: 'Alternative Jump' }
      ],
      details: [
        { label: 'VARIABLE JUMP', text: 'Hold Jump for maximum height; release early to cut the jump apex short.' },
        { label: 'COYOTE TIME', text: 'You can still jump for a fraction of a second after stepping off a platform.' },
        { label: 'JUMP BUFFER', text: 'Pressing jump just before landing queues the jump smoothly upon touching ground.' }
      ],
      visualType: 'movement'
    },
    {
      title: 'COMBAT & INTERACTION',
      category: 'PHASE 02 // SURVIVAL & HAZARDS',
      accentColor: 0xff0055,
      description: 'The simulation is filled with active hazards and autonomous security drones. Direct frontal attacks are ineffective—survival depends on environmental interaction.',
      keyBindings: [
        { key: 'E / J', label: 'Activate Staff / Interact' },
        { key: 'ESC / P', label: 'Pause Simulation' }
      ],
      details: [
        { label: 'STAFF CHARGES', text: 'Your quantum staff uses energy charges shown on the HUD. Charges are limited!' },
        { label: 'ENERGY CONDUITS', text: 'Touch glowing energy conduits and crystals to fully recharge your staff.' },
        { label: 'HAZARDS & DRONES', text: 'Thorns, steam jets, collapsing floors, and laser drones kill on touch or deplete integrity.' },
        { label: 'STUNNING & TRAPS', text: 'Use staff pulses to freeze moving traps, stun drones, or trigger security switches.' }
      ],
      visualType: 'interaction'
    },
    {
      title: 'QUANTUM ABILITIES',
      category: 'PHASE 03 // REALITY MANIPULATION',
      accentColor: 0x39ff14,
      description: 'Throughout the simulation sectors, your staff harnesses reality-altering anomalous abilities. Use the designated activation keys:',
      keyBindings: [
        { key: 'E / J', label: 'Primary Staff Action' },
        { key: 'C / Q', label: 'Camouflage / Cloak' },
        { key: 'SHIFT / X', label: 'Reality Shift / Phase' },
        { key: 'T / R', label: 'Time Freeze / Pulse' },
        { key: 'TAB', label: 'Cycle Staff Ability' }
      ],
      details: [
        { label: 'TIME FREEZE [T / E]', text: 'Sector 4: Freezes moving platforms, halts ancient golems, or rewinds growth clocks.' },
        { label: 'REALITY SHIFT [SHIFT / X]', text: 'Sector 5: Instantly toggles between Phase A and Phase B to solidify ethereal platforms.' },
        { label: 'CAMOUFLAGE [C / Q]', text: 'Sector 3 & 5: Cloaks Vance from sentinel vision cones and deploys a holographic decoy.' },
        { label: 'WATER & WOOD MANIPULATION', text: 'Pulse near water to freeze into ice bridges [Sec 1]; interact with seed pods to grow trees [Sec 4].' }
      ],
      visualType: 'abilities'
    },
    {
      title: 'MISSION OBJECTIVE',
      category: 'PHASE 04 // SIMULATION RECOVERY',
      accentColor: 0xffd166,
      description: 'Stabilize the fractured timeline by recovering all critical components and liberating the corrupted sectors.',
      keyBindings: [
        { key: '⚡ 5 FAILSAFES', label: 'Total Failsafes per Sector' },
        { key: 'EXIT PORTAL', label: 'Unlocked after Sector Cleared' }
      ],
      details: [
        { label: 'RECOVER FAILSAFES', text: 'Search each sector thoroughly to collect all 5 scattered failsafe components.' },
        { label: 'OVERCOME ANOMALIES', text: 'Survive 5 distinct sectors: Frozen Age, Heat Age, Medieval Palace, Ancient Forest, and Futuristic Core.' },
        { label: 'SAVE PROGRESSION', text: 'Checkpoints record your progress. Complete all 5 sectors to unlock the final game ending!' }
      ],
      visualType: 'objective'
    }
  ];

  constructor(scene: Phaser.Scene, options: TutorialModalOptions) {
    super(scene, 0, 0);
    this.source = options.source;
    this.onCloseCallback = options.onClose;
    this.onStartGameCallback = options.onStartGame;

    this.setScrollFactor(0);
    this.setDepth(2500);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Dark backdrop overlay (blocks input underneath)
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x03060f, 0.88)
      .setScrollFactor(0)
      .setInteractive();
    this.add(backdrop);

    // Frame setup
    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    const panelGfx = scene.add.graphics();
    panelGfx.setScrollFactor(0);

    // Background fill & neon cyan outline
    panelGfx.fillStyle(0x0a101d, 0.98);
    panelGfx.fillRect(px, py, this.panelWidth, this.panelHeight);
    panelGfx.lineStyle(2, 0x00f0ff, 0.85);
    panelGfx.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Cyber corner brackets
    panelGfx.lineStyle(2, 0x39ff14, 0.9);
    const cw = 6;
    panelGfx.strokeRect(px - 1, py - 1, cw, cw);
    panelGfx.strokeRect(px + this.panelWidth - cw + 1, py - 1, cw, cw);
    panelGfx.strokeRect(px - 1, py + this.panelHeight - cw + 1, cw, cw);
    panelGfx.strokeRect(px + this.panelWidth - cw + 1, py + this.panelHeight - cw + 1, cw, cw);

    // Accent header bar
    panelGfx.fillStyle(0x132238, 1);
    panelGfx.fillRect(px, py, this.panelWidth, 28);
    panelGfx.lineStyle(1, 0x00f0ff, 0.4);
    panelGfx.lineBetween(px, py + 28, px + this.panelWidth, py + 28);
    this.add(panelGfx);

    // Header Title
    const headerTitle = scene.add.text(px + 14, py + 14, 'GLITCHVERSE // PROTOCOL DATABASE & TUTORIAL', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.add(headerTitle);

    // Page Indicator in header right
    this.pageIndicatorText = scene.add.text(px + this.panelWidth - 14, py + 14, '01 / 04', {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#39ff14',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(1, 0.5).setScrollFactor(0);
    this.add(this.pageIndicatorText);

    // Content container for animated page transitions
    this.contentContainer = scene.add.container(0, 0);
    this.contentContainer.setScrollFactor(0);
    this.add(this.contentContainer);

    // Navigation Footer Bar
    this.buildFooterControls(scene, px, py + this.panelHeight - 34);

    // Render initial page
    this.renderPage(this.currentPage, false);

    // Global keyboard listener for ESC
    if (scene.input.keyboard) {
      this.escHandler = () => {
        if (this.isClosing) return;
        if (this.source === 'story') {
          this.triggerStartGame();
        } else {
          this.triggerClose();
        }
      };
      scene.input.keyboard.on('keydown-ESC', this.escHandler);
    }

    this.setScrollFactor(0, 0, true);
    scene.add.existing(this);

    // Entrance Animation
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 180,
      ease: 'Power2'
    });
  }

  private buildFooterControls(scene: Phaser.Scene, px: number, footerY: number): void {
    const footerLine = scene.add.graphics();
    footerLine.setScrollFactor(0);
    footerLine.lineStyle(1, 0x1f3554, 0.8);
    footerLine.lineBetween(px + 10, footerY - 4, px + this.panelWidth - 10, footerY - 4);
    this.add(footerLine);

    // 1. SKIP TUTORIAL button (left)
    const skipLabel = this.source === 'story' ? 'SKIP TUTORIAL >>' : 'EXIT TUTORIAL';
    const skipBtn = this.createButton(scene, px + 64, footerY + 12, 108, 22, skipLabel, () => {
      if (this.source === 'story') {
        this.triggerStartGame();
      } else {
        this.triggerClose();
      }
    }, 0x141a24, 0x5a6e85);
    this.add(skipBtn);

    // 2. BACK button (center-right)
    this.prevBtnContainer = this.createButton(scene, px + this.panelWidth - 146, footerY + 12, 68, 22, '< BACK', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.renderPage(this.currentPage, true, -1);
      }
    });
    this.add(this.prevBtnContainer);

    // 3. NEXT / START GAME button (far right)
    this.nextBtnContainer = this.createButton(scene, px + this.panelWidth - 62, footerY + 12, 88, 22, 'NEXT >', () => {
      if (this.currentPage < this.pages.length - 1) {
        this.currentPage++;
        this.renderPage(this.currentPage, true, 1);
      } else {
        // Final page reached
        if (this.source === 'story') {
          this.triggerStartGame();
        } else {
          this.triggerClose();
        }
      }
    }, 0x0c281e, 0x39ff14);
    this.add(this.nextBtnContainer);

    this.nextBtnText = (this.nextBtnContainer.getByName('btn_label') as Phaser.GameObjects.Text);
  }

  private renderPage(pageIdx: number, animate = true, direction = 1): void {
    const page = this.pages[pageIdx];
    this.pageIndicatorText.setText(`0${pageIdx + 1} / 0${this.pages.length}`);

    // Update navigation buttons
    this.prevBtnContainer.setVisible(pageIdx > 0);
    if (pageIdx === this.pages.length - 1) {
      if (this.source === 'story') {
        this.nextBtnText.setText('START GAME >>');
      } else {
        this.nextBtnText.setText('CLOSE [X]');
      }
    } else {
      this.nextBtnText.setText('NEXT >');
    }

    const scene = this.scene;
    const px = (scene.cameras.main.width - this.panelWidth) / 2;
    const py = (scene.cameras.main.height - this.panelHeight) / 2;

    const doBuild = () => {
      this.contentContainer.removeAll(true);

      const contentY = py + 36;

      // Category Subtitle
      const catText = scene.add.text(px + 20, contentY + 2, page.category, {
        fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
        fontSize: '9px',
        color: '#' + page.accentColor.toString(16).padStart(6, '0'),
        letterSpacing: 1
      }).setScrollFactor(0);
      this.contentContainer.add(catText);

      // Page Main Title
      const titleText = scene.add.text(px + 20, contentY + 16, page.title, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#040711',
        strokeThickness: 2
      }).setScrollFactor(0);
      this.contentContainer.add(titleText);

      // Short Description
      const descText = scene.add.text(px + 20, contentY + 34, page.description, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '9px',
        color: '#94a3b8',
        wordWrap: { width: this.panelWidth - 40 },
        lineSpacing: 2
      }).setScrollFactor(0);
      this.contentContainer.add(descText);

      // Left Column: Keycaps (controls)
      const leftColX = px + 20;
      const leftColY = contentY + 68;

      const keysTitle = scene.add.text(leftColX, leftColY, 'INPUT BINDINGS:', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#00f0ff'
      }).setScrollFactor(0);
      this.contentContainer.add(keysTitle);

      page.keyBindings.forEach((kb, i) => {
        const itemY = leftColY + 16 + i * 22;
        const keycap = this.createKeycap(scene, leftColX, itemY, kb.key);
        this.contentContainer.add(keycap);

        const lbl = scene.add.text(leftColX + 72, itemY + 8, kb.label, {
          fontFamily: GAME_FONTS.primary,
          fontSize: '9px',
          color: '#e2e8f0'
        }).setOrigin(0, 0.5).setScrollFactor(0);
        this.contentContainer.add(lbl);
      });

      // Right Column: Tactical Notes / Ability Details
      const rightColX = px + 250;
      const rightColY = contentY + 68;

      const notesTitle = scene.add.text(rightColX, rightColY, 'TACTICAL PROTOCOLS:', {
        fontFamily: GAME_FONTS.primary,
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#39ff14'
      }).setScrollFactor(0);
      this.contentContainer.add(notesTitle);

      let detailY = rightColY + 16;
      page.details.forEach((det) => {
        const bullet = scene.add.text(rightColX, detailY, '▶', {
          fontFamily: GAME_FONTS.primary,
          fontSize: '7px',
          color: '#' + page.accentColor.toString(16).padStart(6, '0')
        }).setOrigin(0, 0).setScrollFactor(0);
        this.contentContainer.add(bullet);

        const tag = scene.add.text(rightColX + 10, detailY, det.label + ':', {
          fontFamily: GAME_FONTS.primary,
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#ffffff'
        }).setScrollFactor(0);
        this.contentContainer.add(tag);

        const text = scene.add.text(rightColX + 10, detailY + 12, det.text, {
          fontFamily: GAME_FONTS.primary,
          fontSize: '8px',
          color: '#94a3b8',
          wordWrap: { width: this.panelWidth - 270 },
          lineSpacing: 1
        }).setScrollFactor(0);
        this.contentContainer.add(text);

        detailY += text.height + 16;
      });
    };

    if (animate) {
      scene.tweens.add({
        targets: this.contentContainer,
        alpha: 0,
        x: -direction * 20,
        duration: 90,
        ease: 'Power1',
        onComplete: () => {
          doBuild();
          this.contentContainer.x = direction * 20;
          scene.tweens.add({
            targets: this.contentContainer,
            alpha: 1,
            x: 0,
            duration: 110,
            ease: 'Power1'
          });
        }
      });
    } else {
      doBuild();
    }
  }

  private createKeycap(scene: Phaser.Scene, x: number, y: number, keyText: string): Phaser.GameObjects.Container {
    const cont = scene.add.container(x, y);
    cont.setScrollFactor(0);

    const w = 64;
    const h = 18;

    const gfx = scene.add.graphics();
    gfx.setScrollFactor(0);

    // Keycap 3D bezel
    gfx.fillStyle(0x0e1726, 1);
    gfx.fillRect(0, 0, w, h);
    gfx.fillStyle(0x19273c, 1);
    gfx.fillRect(1, 1, w - 2, h - 3);

    // Border
    gfx.lineStyle(1, 0x00f0ff, 0.85);
    gfx.strokeRect(0, 0, w, h);

    const txt = scene.add.text(w / 2, h / 2 - 1, keyText, {
      fontFamily: GAME_FONTS.mono || GAME_FONTS.primary,
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#00f0ff'
    }).setOrigin(0.5).setScrollFactor(0);

    cont.add([gfx, txt]);
    return cont;
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
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#e0fbfc',
      stroke: '#040711',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    txt.setName('btn_label');

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
      AudioManager.playMenuSelect();
      onClick();
    });

    btn.add([bg, txt, hit]);
    btn.setScrollFactor(0, 0, true);
    return btn;
  }

  private triggerClose(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
        this.onCloseCallback();
      }
    });
  }

  private triggerStartGame(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
        if (this.onStartGameCallback) {
          this.onStartGameCallback();
        } else {
          this.onCloseCallback();
        }
      }
    });
  }

  public override destroy(fromScene?: boolean): void {
    if (this.escHandler && this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown-ESC', this.escHandler);
      this.escHandler = undefined;
    }
    super.destroy(fromScene);
  }
}