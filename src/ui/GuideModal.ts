import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export class GuideModal extends Phaser.GameObjects.Container {
  private panelWidth = 480;
  private panelHeight = 290;
  private keyListener?: (event: KeyboardEvent) => void;
  private isClosing = false;
  private onCloseCallback?: () => void;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene, 0, 0);
    this.setScrollFactor(0);
    this.setDepth(3500);
    this.onCloseCallback = onClose;

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    AudioManager.playMenuHover();

    // 1. Gentle non-freezing translucent backdrop
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x02050b, 0.45)
      .setScrollFactor(0)
      .setInteractive();
    backdrop.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.closeModal();
    });
    this.add(backdrop);

    const px = (width - this.panelWidth) / 2;
    const py = (height - this.panelHeight) / 2;

    // 2. Main panel graphics & cyber frame
    const panel = scene.add.graphics();
    panel.setScrollFactor(0);

    // Panel background (semi-translucent sleek cyber card)
    panel.fillStyle(0x070c18, 0.96);
    panel.fillRect(px, py, this.panelWidth, this.panelHeight);

    // Outer cyan border
    panel.lineStyle(2, 0x00f0ff, 0.9);
    panel.strokeRect(px, py, this.panelWidth, this.panelHeight);

    // Stylized corner chamfers
    panel.lineStyle(2, 0x70e000, 1);
    const cw = 6;
    panel.strokeRect(px - 1, py - 1, cw, cw);
    panel.strokeRect(px + this.panelWidth - cw + 1, py - 1, cw, cw);
    panel.strokeRect(px - 1, py + this.panelHeight - cw + 1, cw, cw);
    panel.strokeRect(px + this.panelWidth - cw + 1, py + this.panelHeight - cw + 1, cw, cw);

    // Header bar
    panel.fillStyle(0x101c30, 1);
    panel.fillRect(px, py, this.panelWidth, 28);
    panel.lineStyle(1, 0x00f0ff, 0.5);
    panel.lineBetween(px, py + 28, px + this.panelWidth, py + 28);

    // Inner card divider lines
    panel.lineStyle(1, 0x1e3650, 0.8);
    panel.lineBetween(px + 230, py + 34, px + 230, py + 215);
    panel.lineBetween(px + 12, py + 218, px + this.panelWidth - 12, py + 218);

    this.add(panel);

    // 3. Dynamic Guide Data based on active level / sector
    const guideData = this.getGuideData(scene);

    const headerTitle = scene.add.text(px + 16, py + 14, guideData.headerTitle, {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '12px',
      color: '#00f0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.add(headerTitle);

    // Top-right close [X] button
    const closeBtn = scene.add.text(px + this.panelWidth - 16, py + 14, '✕', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '14px',
      color: '#8b9bb4',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0055'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#8b9bb4'));
    closeBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.closeModal();
    });
    this.add(closeBtn);

    // ── Column 1: Basic Movement & Controls ─────────────────────────────
    const col1X = px + 16;
    let y1 = py + 38;

    const col1Header = scene.add.text(col1X, y1, '◈ BASIC CONTROLS', {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '12px',
      color: '#70e000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0);
    this.add(col1Header);
    y1 += 18;

    const controlsList = [
      { key: '[A] [D] / [◀] [▶]', desc: 'Run left / right' },
      { key: '[W] / [SPACE] / [▲]', desc: 'Jump (hold for high vault)' },
      { key: '[J] or [E]', desc: 'Fire Staff Ability (1 charge)' },
      { key: '[ESC] or [P]', desc: 'Pause simulation & settings' },
      { key: '[H] or [?]', desc: 'Toggle this field guide' },
    ];

    controlsList.forEach((item) => {
      const keyText = scene.add.text(col1X, y1, item.key, {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#050a14',
        strokeThickness: 2
      }).setScrollFactor(0);

      const descText = scene.add.text(col1X + 4, y1 + 12, item.desc, {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '10px',
        color: '#9db4ce'
      }).setScrollFactor(0);

      this.add([keyText, descText]);
      y1 += 24;
    });

    // ── Column 2: Level-Specific Staff Abilities & Mechanics ────────────
    const col2X = px + 242;
    let y2 = py + 38;

    const col2Header = scene.add.text(col2X, y2, guideData.abilitiesHeader, {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '11px',
      color: '#00f0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0);
    this.add(col2Header);
    y2 += 18;

    guideData.abilitiesList.forEach((item) => {
      const titleText = scene.add.text(col2X, y2, item.title, {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '11px',
        color: item.color,
        fontStyle: 'bold',
        stroke: '#050a14',
        strokeThickness: 2
      }).setScrollFactor(0);

      const descText = scene.add.text(col2X + 4, y2 + 13, item.desc, {
        fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
        fontSize: '10px',
        color: '#9db4ce',
        wordWrap: { width: 215 },
        lineSpacing: 2
      }).setScrollFactor(0);

      this.add([titleText, descText]);
      y2 += 38;
    });

    // ── Bottom Section: Mission Directives & Objectives ─────────────────
    const botX = px + 16;
    const botY = py + 224;

    const botHeader = scene.add.text(botX, botY, '◈ CLEAR OBJECTIVES:', {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '10px',
      color: '#ffd166',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0);

    const directive1 = scene.add.text(botX + 130, botY, guideData.directive1, {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '10px',
      color: '#e0fbfc',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0);

    const directive2 = scene.add.text(botX + 130, botY + 13, guideData.directive2, {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '10px',
      color: '#e0fbfc',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0);

    this.add([botHeader, directive1, directive2]);

    // ── Footer: Resume / Back Button ────────────────────────────────────
    const resumeBtnY = py + this.panelHeight - 18;
    const resumeBtn = scene.add.text(width / 2, resumeBtnY, '< RESUME SIMULATION [ESC / H] >', {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '12px',
      color: '#70e000',
      fontStyle: 'bold',
      stroke: '#050a14',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    resumeBtn.on('pointerover', () => resumeBtn.setColor('#ffffff'));
    resumeBtn.on('pointerout', () => resumeBtn.setColor('#70e000'));
    resumeBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.closeModal();
    });
    this.add(resumeBtn);

    // Keyboard listener ONLY for ESC to dismiss guide (H is handled by HUD toggle to avoid race conditions)
    this.keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeModal();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    scene.add.existing(this);

    // Smooth subtle entry animation
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 140,
      ease: 'Power2'
    });
  }

  public closeModal(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = undefined;
    }

    AudioManager.playMenuSelect();

    if (this.scene) {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 100,
        ease: 'Power2',
        onComplete: () => {
          const cb = this.onCloseCallback;
          this.destroy();
          cb?.();
        }
      });
    } else {
      const cb = this.onCloseCallback;
      this.destroy();
      cb?.();
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = undefined;
    }
    super.destroy(fromScene);
  }

  private getGuideData(scene: Phaser.Scene): {
    headerTitle: string;
    abilitiesHeader: string;
    abilitiesList: Array<{ title: string; color: string; desc: string }>;
    directive1: string;
    directive2: string;
  } {
    const key = scene.scene?.key || scene.constructor.name || '';

    if (key === 'Sector2Scene') {
      return {
        headerTitle: '// FIELD GUIDE: SECTOR 2 · HEAT AGE //',
        abilitiesHeader: '◈ SECTOR 2 ABILITIES & HEAT TECH',
        abilitiesList: [
          {
            title: 'THERMAL VENTS [J / E]:',
            color: '#ff8800',
            desc: 'Ignite dormant vents within 150px. Updraft lifts vertically; Convection carries horizontally across lava.'
          },
          {
            title: 'HAZARD SUPPRESSION:',
            color: '#ffd166',
            desc: 'When no vent is near, staff suppresses Fire Jet nozzles and stuns patrolling Ember Drones.'
          },
          {
            title: 'RAFT CENTER BALANCE:',
            color: '#00ff88',
            desc: 'Stand in the center of moving rafts (between arrows) to lock carriage across lava without sliding off.'
          }
        ],
        directive1: '⚡ Heat Conduits: Stand close to recharge Staff energy.',
        directive2: '🔥 Failsafes 03 & 04: Collect both components to unlock Exit Gate.'
      };
    }

    if (key === 'Level3Scene') {
      return {
        headerTitle: '// FIELD GUIDE: SECTOR 3 · MEDIEVAL PALACE //',
        abilitiesHeader: '◈ SECTOR 3 ABILITIES & INFILTRATION',
        abilitiesList: [
          {
            title: 'TEMPORAL CLOAKING [C / Q / J]:',
            color: '#ffd166',
            desc: 'Activate camouflage to become invisible, slipping past elite palace guards and security lasers.'
          },
          {
            title: 'CHAMBER KEY & PORTCULLIS:',
            color: '#d4af37',
            desc: 'Infiltrate the inner vault to steal the royal iron key and raise locked palace portcullises.'
          },
          {
            title: 'ELEVATED CHANDELIERS:',
            color: '#00f0ff',
            desc: 'Leap across chandeliers and palace rafters to bypass heavily patrolled ground corridors.'
          }
        ],
        directive1: '⚡ Energy Conduits: Recharge staff charges before cloaking.',
        directive2: '👑 Failsafe 03: Infiltrate royal vault to recover Component 3.'
      };
    }

    if (key === 'Level4Scene') {
      return {
        headerTitle: '// FIELD GUIDE: SECTOR 4 · ANCIENT FOREST //',
        abilitiesHeader: '◈ SECTOR 4 ABILITIES & TIME CONTROL',
        abilitiesList: [
          {
            title: 'TIME MANIPULATION [T / E / J]:',
            color: '#00f0ff',
            desc: 'Freeze or rewind time on ancient mechanisms, swinging log hazards, and moving platforms.'
          },
          {
            title: 'COLLAPSED BRIDGES:',
            color: '#70e000',
            desc: 'Rewind time on collapsed stone bridge segments to restore solid crossings over chasms.'
          },
          {
            title: 'GOLEM STASIS:',
            color: '#ffd166',
            desc: 'Cast chronal stasis on ancient stone golems to freeze their strikes before impact.'
          }
        ],
        directive1: '⚡ Time Conduits: Recharge chronal staff energy.',
        directive2: '🌿 Failsafe 04: Rewind ruins to recover Component 4.'
      };
    }

    if (key === 'Level5Scene') {
      return {
        headerTitle: '// FIELD GUIDE: SECTOR 5 · FUTURISTIC CORE //',
        abilitiesHeader: '◈ SECTOR 5 ABILITIES & CORE OVERRIDE',
        abilitiesList: [
          {
            title: 'DIMENSIONAL PHASING [SHIFT / TAB / X]:',
            color: '#ff00aa',
            desc: 'Shift reality between Phase A and Phase B to solidify phasing platforms and bypass laser walls.'
          },
          {
            title: 'MULTI-ABILITY ARSENAL:',
            color: '#00f0ff',
            desc: 'Combine chronal stasis, cloaking, and phase shifts to neutralize core security grids.'
          },
          {
            title: 'FAILSAFE CORE ASSEMBLY:',
            color: '#ffd166',
            desc: 'Assemble all 5 recovered failsafe components into the central pedestal to seal the core.'
          }
        ],
        directive1: '⚡ Core Conduits: Supercharge multidimensional staff battery.',
        directive2: '🔮 Failsafe Array: Place Component 5 to complete the array.'
      };
    }

    // Default: Sector 1 (GameScene · Ice Age)
    return {
      headerTitle: '// FIELD GUIDE: SECTOR 1 · ICE AGE //',
      abilitiesHeader: '◈ SECTOR 1 ABILITIES & CRYOTECH',
      abilitiesList: [
        {
          title: 'FREEZE DRONES [J / E]:',
          color: '#ffd166',
          desc: 'Press J or E near sentient drones to freeze them in stasis for 5s to pass safely.'
        },
        {
          title: 'WATER & ICE RUNWAYS:',
          color: '#70e000',
          desc: 'Staff freezes water into solid slippery runways to cross gaps, or thaws ice back.'
        },
        {
          title: 'MOVING CRYO PLATFORMS:',
          color: '#00f0ff',
          desc: 'Jump onto moving snow platforms to cross abyssal gaps. Platforms smoothly carry you across.'
        }
      ],
      directive1: '⚡ Energy Conduits: Stand close to recharge Staff.',
      directive2: '💎 Failsafes 01 & 02: Collect both cryogenic components to unlock the Exit Portal.'
    };
  }
}
