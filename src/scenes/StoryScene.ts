// src/scenes/StoryScene.ts
// Cinematic story intro — 3 slides shown when the player presses PLAY.
// Each slide: full-screen image + typewriter text overlay.
// Player can skip the entire sequence at any time.

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { AudioManager } from '../systems/AudioManager';
import { FullscreenManager } from '../systems/FullscreenManager';

const SLIDES = [
  {
    imageKey: 'story_1',
    title: 'The Experiment',
    lines: [
      'YEAR 2048',
      '',
      'Driven by a dream to bend reality itself,',
      'a brilliant scientist begins building a 4D virtual world,',
      'where time, space, and imagination collide.',
    ],
  },
  {
    imageKey: 'story_2',
    title: 'The Accident',
    lines: [
      'One experiment. One fatal glitch.',
      '',
      'The simulation spirals out of control,',
      'trapping its creator inside a world',
      'never meant to exist.',
      '',
      'Reality is now beyond his reach.',
    ],
  },
  {
    imageKey: 'story_3',
    title: 'The Journey',
    lines: [
      'He had prepared for everything. Almost.',
      '',
      'His failsafe — the only way home — lies shattered.',
      'With Merlin’s Staff in hand, he must journey',
      'across fractured ages, recover the scattered components,',
      'and rebuild his last chance at reality.',
    ],
  },
];

// ms per character for the typewriter effect
const CHAR_DELAY = 28;
// ms to hold after typewriter finishes before auto-advancing
const AUTO_ADVANCE_DELAY = 3200;

export class StoryScene extends Phaser.Scene {
  private slideIndex = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private autoAdvanceTimer: Phaser.Time.TimerEvent | null = null;
  private isAdvancing = false;

  constructor() {
    super('StoryScene');
  }

  create(): void {
    AudioManager.init();
    AudioManager.startStoryMusic();

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (AudioManager.getCurrentTrack() === 'story') {
        AudioManager.stopMusic();
      }
    });

    this.slideIndex = 0;
    this.isAdvancing = false;
    this.showSlide(0);
  }

  // ── Slide renderer ───────────────────────────────────────────────────────────

  private showSlide(index: number): void {
    this.isAdvancing = false;
    this.typewriterTimer?.remove();
    this.autoAdvanceTimer?.remove();
    this.typewriterTimer = null;
    this.autoAdvanceTimer = null;
    this.children.removeAll(true);

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const slide = SLIDES[index];

    // ── Full-screen background image
    const bg = this.add.image(W / 2, H / 2, slide.imageKey);
    bg.setScale(Math.max(W / bg.width, H / bg.height));

    // ── Gradient vignette so bottom text is always readable
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.78, 0.78);
    vignette.fillRect(0, 0, W, H);

    // ── Scanlines
    const scan = this.add.graphics().setAlpha(0.06);
    scan.lineStyle(1, 0x000000, 1);
    for (let y = 0; y < H; y += 3) scan.lineBetween(0, y, W, y);

    // ── Chapter pill (top-left)
    const pill = this.add.graphics();
    pill.fillStyle(0x0a101d, 0.75);
    pill.fillRoundedRect(20, 16, 62, 22, 5);
    pill.lineStyle(1.5, 0x00f0ff, 0.8);
    pill.strokeRoundedRect(20, 16, 62, 22, 5);
    this.add.text(51, 27, '// 0' + (index + 1), {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00f0ff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // ── Title (bottom-left, fades in)
    const titleY = H - 152;
    const titleObj = this.add.text(24, titleY, slide.title.toUpperCase(), {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#050a14',
      strokeThickness: 4
    }).setAlpha(0);
    this.tweens.add({ targets: titleObj, alpha: 1, duration: 500 });

    // Accent underline below title
    const accent = this.add.graphics().setAlpha(0);
    accent.lineStyle(2, 0x00f0ff, 0.9);
    accent.lineBetween(24, titleY + 23, 24 + slide.title.length * 11, titleY + 23);
    this.tweens.add({ targets: accent, alpha: 1, duration: 500, delay: 200 });

    // ── Typewriter body text
    const bodyText = this.add.text(24, titleY + 32, '', {
      fontFamily: '"Pixelify Sans", "Share Tech Mono", monospace',
      fontSize: '13px',
      color: '#e2f0fc',
      stroke: '#050a14',
      strokeThickness: 3,
      lineSpacing: 8,
      wordWrap: { width: W - 48 },
    });

    const fullBody = slide.lines.join('\n');
    let charIndex = 0;
    const typeChar = () => {
      if (charIndex < fullBody.length) {
        bodyText.setText(fullBody.substring(0, charIndex + 1));
        charIndex++;
        this.typewriterTimer = this.time.delayedCall(CHAR_DELAY, typeChar);
      } else {
        // Auto-advance after reading pause
        this.autoAdvanceTimer = this.time.delayedCall(AUTO_ADVANCE_DELAY, () => this.advanceSlide());
      }
    };
    this.typewriterTimer = this.time.delayedCall(400, typeChar);

    // ── Progress dots (bottom-centre)
    const dotsY = H - 16;
    const dotSpacing = 14;
    const dotsStartX = W / 2 - ((SLIDES.length - 1) * dotSpacing) / 2;
    SLIDES.forEach((_, i) => {
      const dot = this.add.graphics();
      if (i === index) {
        dot.fillStyle(0x00f0ff, 1);
        dot.fillCircle(dotsStartX + i * dotSpacing, dotsY, 3);
      } else {
        dot.fillStyle(0x4a6080, 0.7);
        dot.fillCircle(dotsStartX + i * dotSpacing, dotsY, 2.5);
      }
    });

    // ── NEXT / BEGIN button (bottom-right, pulsing)
    const isLast = index === SLIDES.length - 1;
    const nextBtn = this.add.text(W - 20, H - 20, isLast ? 'BEGIN  ►' : 'NEXT  ►', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#70e000',
      stroke: '#050a14',
      strokeThickness: 3
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: nextBtn, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
    nextBtn.on('pointerup', () => this.advanceSlide());
    nextBtn.on('pointerover', () => nextBtn.setColor('#ffffff'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#70e000'));

    // ── SKIP button (top-right)
    const skipBtn = this.add.text(W - 20, 20, 'SKIP  »', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#8b9bb4',
      stroke: '#050a14',
      strokeThickness: 2
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerup', () => this.skipAll());
    skipBtn.on('pointerover', () => skipBtn.setColor('#ffffff'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#8b9bb4'));

    // ── Keyboard shortcuts (re-registered each slide)
    this.input.keyboard?.removeAllKeys();
    this.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .once('down', () => this.advanceSlide());
    this.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
      .once('down', () => this.advanceSlide());
    this.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => {
        if (FullscreenManager.shouldBlockEsc()) return;
        this.skipAll();
      });

    // Camera fade-in from black
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Advance to next slide, or launch the game on the last one. */
  private advanceSlide(): void {
    if (this.isAdvancing) return;
    this.isAdvancing = true;
    this.typewriterTimer?.remove();
    this.autoAdvanceTimer?.remove();
    this.cameras.main.fadeOut(280, 0, 0, 0,
      (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) {
          const next = this.slideIndex + 1;
          if (next < SLIDES.length) {
            this.slideIndex = next;
            this.showSlide(next);
          } else {
            this.startGame();
          }
        }
      },
    );
  }

  /** Skip the entire story sequence and go straight to the game. */
  private skipAll(): void {
    if (this.isAdvancing) return;
    this.isAdvancing = true;
    this.typewriterTimer?.remove();
    this.autoAdvanceTimer?.remove();
    this.cameras.main.fadeOut(250, 0, 0, 0,
      (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) this.startGame();
      },
    );
  }

  private startGame(): void {
    if (AudioManager.getCurrentTrack() === 'story') {
      AudioManager.stopMusic();
    }
    this.scene.start(GAME_CONFIG.sceneKeys.Game);
  }
}
