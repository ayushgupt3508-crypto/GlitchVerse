import Phaser from 'phaser';
import { GAME_FONTS } from '../../config';
import { AudioManager } from '../../systems/AudioManager';

export interface HUDState {
  zoneName: string;
  zoneSubtitle: string;
  abilityName: string;
  abilityHint: string;
  abilityColor: number;
  sealsCompleted: boolean[];
  staffCharges: number;
  maxStaffCharges: number;
  attempts: number;
  timeRemainingSeconds: number;
  score: number;
  surgeState: 'idle' | 'warning' | 'impact';
  surgeSeconds: number;
}

export class ConvergenceHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private zoneText: Phaser.GameObjects.Text;
  private abilityBadgeText: Phaser.GameObjects.Text;
  private abilityBadgeBg: Phaser.GameObjects.Graphics;
  private sealTexts: Phaser.GameObjects.Text[] = [];
  private chargesText: Phaser.GameObjects.Text;
  private attemptsText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private surgeText: Phaser.GameObjects.Text;
  private surgeBg: Phaser.GameObjects.Graphics;

  // Floating world prompt
  private promptContainer: Phaser.GameObjects.Container;
  private promptBg: Phaser.GameObjects.Graphics;
  private promptText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const W = scene.cameras.main.width;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(200);

    // Top Dark Glass HUD Bar
    const hudBar = scene.add.graphics();
    hudBar.fillStyle(0x040812, 0.9);
    hudBar.fillRect(0, 0, W, 44);
    hudBar.lineStyle(1.5, 0x00f0ff, 0.6);
    hudBar.lineBetween(0, 44, W, 44);
    this.container.add(hudBar);

    // 1. Zone Title & Subtitle (Left)
    this.zoneText = scene.add.text(12, 7, 'ZONE 1: CRYO ENGINE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#040711',
      strokeThickness: 2
    });
    this.container.add(this.zoneText);

    // Ability helper button badge
    this.abilityBadgeBg = scene.add.graphics();
    this.abilityBadgeText = scene.add.text(12, 23, '[E] FREEZE GEYSER', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#ffffff'
    });
    this.container.add([this.abilityBadgeBg, this.abilityBadgeText]);

    // 2. Elemental Seals Trackers (Center-Left)
    const sealConfigs = [
      { icon: '❄', name: 'CRYO', color: '#48cae4' },
      { icon: '🔥', name: 'HEAT', color: '#ff6b00' },
      { icon: '🛡', name: 'ROYAL', color: '#ffd166' },
      { icon: '🌿', name: 'TIME', color: '#52b788' },
      { icon: '⚛', name: 'PHASE', color: '#ff007f' }
    ];

    const sealStartX = 175;
    sealConfigs.forEach((cfg, idx) => {
      const txt = scene.add.text(sealStartX + idx * 46, 12, `${cfg.icon} ${cfg.name}`, {
        fontFamily: GAME_FONTS.mono,
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#445566'
      });
      this.sealTexts.push(txt);
      this.container.add(txt);
    });

    // 3. Glitch Surge Indicator (Center-Right)
    this.surgeBg = scene.add.graphics();
    this.surgeText = scene.add.text(420, 12, 'SURGE: 22s', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#a0e7e5'
    });
    this.container.add([this.surgeBg, this.surgeText]);

    // 4. Staff Charges, Hearts, Timer & Score (Right)
    this.chargesText = scene.add.text(W - 200, 12, 'STAFF: ⚡⚡⚡', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      color: '#00f0ff'
    });

    this.attemptsText = scene.add.text(W - 120, 12, '❤❤❤', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '10px',
      color: '#ff3366'
    });

    this.timerText = scene.add.text(W - 65, 12, '04:30', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.scoreText = scene.add.text(W - 12, 28, 'SCORE: 0', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '9px',
      color: '#ffd166'
    }).setOrigin(1, 0.5);

    this.container.add([this.chargesText, this.attemptsText, this.timerText, this.scoreText]);

    // ── Floating Interactive Prompt ──────────────────────────────────────
    this.promptContainer = scene.add.container(0, 0).setDepth(180).setVisible(false);
    this.promptBg = scene.add.graphics();
    this.promptText = scene.add.text(0, 0, '', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.promptContainer.add([this.promptBg, this.promptText]);
  }

  public update(state: HUDState): void {
    // 1. Zone & Ability
    this.zoneText.setText(state.zoneName);

    this.abilityBadgeBg.clear();
    const badgeW = Math.max(120, state.abilityHint.length * 6.5 + 16);
    this.abilityBadgeBg.fillStyle(state.abilityColor, 0.25);
    this.abilityBadgeBg.fillRoundedRect(10, 22, badgeW, 16, 4);
    this.abilityBadgeBg.lineStyle(1, state.abilityColor, 0.9);
    this.abilityBadgeBg.strokeRoundedRect(10, 22, badgeW, 16, 4);

    this.abilityBadgeText.setText(state.abilityHint);
    this.abilityBadgeText.setColor(`#${state.abilityColor.toString(16).padStart(6, '0')}`);

    // 2. Seals
    const sealConfigs = [
      { icon: '❄', name: 'CRYO', color: '#48cae4' },
      { icon: '🔥', name: 'HEAT', color: '#ff6b00' },
      { icon: '🛡', name: 'ROYAL', color: '#ffd166' },
      { icon: '🌿', name: 'TIME', color: '#52b788' },
      { icon: '⚛', name: 'PHASE', color: '#ff007f' }
    ];
    state.sealsCompleted.forEach((done, idx) => {
      const txt = this.sealTexts[idx];
      if (txt) {
        if (done) {
          txt.setColor(sealConfigs[idx].color);
          txt.setText(`[${sealConfigs[idx].icon} ${sealConfigs[idx].name}]`);
        } else {
          txt.setColor('#3a4b5c');
          txt.setText(`${sealConfigs[idx].icon} ${sealConfigs[idx].name}`);
        }
      }
    });

    // 3. Surge
    this.surgeBg.clear();
    if (state.surgeState === 'warning') {
      this.surgeBg.fillStyle(0xff0044, 0.4);
      this.surgeBg.fillRoundedRect(415, 8, 90, 22, 4);
      this.surgeBg.lineStyle(1.5, 0xff0044, 1);
      this.surgeBg.strokeRoundedRect(415, 8, 90, 22, 4);
      this.surgeText.setText(`⚠️ SURGE 0${state.surgeSeconds}s`);
      this.surgeText.setColor('#ff3366');
    } else if (state.surgeState === 'impact') {
      this.surgeBg.fillStyle(0xff0044, 0.85);
      this.surgeBg.fillRoundedRect(415, 8, 90, 22, 4);
      this.surgeText.setText('⚡ SURGE! ⚡');
      this.surgeText.setColor('#ffffff');
    } else {
      this.surgeText.setText(`SURGE: ${state.surgeSeconds}s`);
      this.surgeText.setColor('#a0e7e5');
    }

    // 4. Staff & Stats
    const chargesFilled = '⚡'.repeat(Math.max(0, state.staffCharges));
    const chargesEmpty = '○'.repeat(Math.max(0, state.maxStaffCharges - state.staffCharges));
    this.chargesText.setText(`STAFF: ${chargesFilled}${chargesEmpty}`);
    this.chargesText.setColor(state.staffCharges > 0 ? '#00f0ff' : '#ff3366');

    this.attemptsText.setText('❤'.repeat(Math.max(0, state.attempts)));

    const mins = Math.floor(state.timeRemainingSeconds / 60);
    const secs = state.timeRemainingSeconds % 60;
    this.timerText.setText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    this.timerText.setColor(state.timeRemainingSeconds < 30 ? '#ff3366' : '#ffffff');

    this.scoreText.setText(`SCORE: ${state.score}`);
  }

  public showFloatingPrompt(x: number, y: number, text: string, color = 0x00f0ff): void {
    this.promptContainer.setPosition(x, y).setVisible(true);
    this.promptText.setText(text);

    const pw = text.length * 7 + 20;
    this.promptBg.clear();
    this.promptBg.fillStyle(0x060c18, 0.85);
    this.promptBg.fillRoundedRect(-pw / 2, -12, pw, 24, 4);
    this.promptBg.lineStyle(1.5, color, 0.9);
    this.promptBg.strokeRoundedRect(-pw / 2, -12, pw, 24, 4);
  }

  public hideFloatingPrompt(): void {
    this.promptContainer.setVisible(false);
  }

  public showWorldBanner(message: string, x: number, y: number, color = 0x00f0ff): void {
    const banner = this.scene.add.text(x, y, message, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '12px',
      fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#040711',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(210);

    this.scene.tweens.add({
      targets: banner,
      y: y - 30,
      alpha: 0,
      duration: 1600,
      ease: 'Cubic.easeOut',
      onComplete: () => banner.destroy()
    });
  }

  public showVictoryModal(
    score: number,
    timeRemaining: number,
    attemptsLeft: number,
    rank: string,
    onRestart: () => void,
    onMenu: () => void
  ): Phaser.GameObjects.Container {
    AudioManager.playVictory();
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    const modal = this.scene.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(300);

    // Dim background overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x040812, 0.88);
    overlay.fillRect(-W / 2, -H / 2, W, H);

    // Modal Card
    const cardW = 340;
    const cardH = 240;
    const card = this.scene.add.graphics();
    card.fillStyle(0x0a1424, 0.95);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
    card.lineStyle(2, 0x70e000, 1);
    card.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);

    // Header
    const title = this.scene.add.text(0, -cardH / 2 + 24, '★ THE CONVERGENCE CONQUERED ★', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#70e000'
    }).setOrigin(0.5);

    const sub = this.scene.add.text(0, -cardH / 2 + 42, '// ALL TIMELINES HARMONIZED //', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '9px',
      color: '#00f0ff'
    }).setOrigin(0.5);

    // Rank Badge
    const rankColor = rank === 'S' ? '#ffd166' : rank === 'A' ? '#70e000' : '#00f0ff';
    const rankText = this.scene.add.text(0, -25, `RANK: ${rank}`, {
      fontFamily: GAME_FONTS.heading,
      fontSize: '28px',
      fontStyle: 'bold',
      color: rankColor
    }).setOrigin(0.5);

    // Stats
    const statsText = this.scene.add.text(0, 20,
      `FINAL SCORE: ${score}\n` +
      `TIME LEFT: ${timeRemaining}s  |  ATTEMPTS: ${attemptsLeft}/3\n` +
      `ALL 5 ELEMENTAL SEALS SECURED`, {
      fontFamily: GAME_FONTS.mono,
      fontSize: '10px',
      color: '#e0fbfc',
      align: 'center',
      lineSpacing: 5
    }).setOrigin(0.5);

    // Buttons
    const restartBtn = this.createButton(-75, cardH / 2 - 32, 'PLAY AGAIN', 0x00f0ff, onRestart);
    const menuBtn = this.createButton(75, cardH / 2 - 32, 'MAIN MENU', 0x70e000, onMenu);

    modal.add([overlay, card, title, sub, rankText, statsText, restartBtn, menuBtn]);
    return modal;
  }

  public showGameOverModal(
    onRestart: () => void,
    onMenu: () => void
  ): Phaser.GameObjects.Container {
    AudioManager.playDeath();
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    const modal = this.scene.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(300);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x0a0408, 0.92);
    overlay.fillRect(-W / 2, -H / 2, W, H);

    const cardW = 300;
    const cardH = 180;
    const card = this.scene.add.graphics();
    card.fillStyle(0x1a060c, 0.95);
    card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
    card.lineStyle(2, 0xff0044, 1);
    card.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);

    const title = this.scene.add.text(0, -cardH / 2 + 28, 'TIMELINE COLLAPSE', {
      fontFamily: GAME_FONTS.primary,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ff0044'
    }).setOrigin(0.5);

    const sub = this.scene.add.text(0, -cardH / 2 + 52, '// INTEGRITY DEPLETED //', {
      fontFamily: GAME_FONTS.mono,
      fontSize: '10px',
      color: '#ff8899'
    }).setOrigin(0.5);

    const restartBtn = this.createButton(-65, cardH / 2 - 30, 'RETRY', 0xff0044, onRestart);
    const menuBtn = this.createButton(65, cardH / 2 - 30, 'MAIN MENU', 0x8899aa, onMenu);

    modal.add([overlay, card, title, sub, restartBtn, menuBtn]);
    return modal;
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(x, y);
    const bw = 110;
    const bh = 28;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x060c18, 0.9);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
    bg.lineStyle(1.5, color, 0.8);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);

    const txt = this.scene.add.text(0, 0, label, {
      fontFamily: GAME_FONTS.primary,
      fontSize: '11px',
      fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`
    }).setOrigin(0.5);

    const zone = this.scene.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color, 0.3);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
      bg.lineStyle(1.5, color, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x060c18, 0.9);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
      bg.lineStyle(1.5, color, 0.8);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
    });
    zone.on('pointerdown', () => onClick());

    btn.add([bg, txt, zone]);
    return btn;
  }
}
