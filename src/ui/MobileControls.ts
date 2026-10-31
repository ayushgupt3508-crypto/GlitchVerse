import Phaser from 'phaser';

/**
 * Ability state descriptor — scenes provide this each frame (or on state change)
 * so the ability button can update its visual.
 */
export interface MobileAbilityState {
  /** Human-readable label shown under the ability button (e.g. 'FREEZE', 'CLOAK'). */
  label: string;
  /** True when the ability can be activated right now. */
  available: boolean;
  /** Tint color when available (e.g. 0x00f0ff for staff, 0xd4af37 for camouflage). */
  tint: number;
  /** Optional: cooldown progress 0..1 (0 = ready, 1 = fully on cooldown). */
  cooldownProgress?: number;
}

/**
 * Callback signature scenes must implement to receive mobile ability presses.
 * This is invoked immediately on press (pointerdown), not on hold.
 */
export type MobileAbilityCallback = () => void;

/**
 * MobileControls — High-performance multi-touch overlay for mobile gameplay.
 *
 * Key features:
 *  • True Multi-Touch: Supports simultaneous moving + jumping + ability activation
 *    by tracking each button's unique pointer ID.
 *  • Zero Input Delay: Directly hooks into pointerdown without click/tap debounce,
 *    providing instantaneous response.
 *  • Generous Touch Forgiveness: Keeps directional buttons pressed even during slight
 *    thumb rolling, and allows seamless sliding between Left and Right.
 *  • Tactile Press Feedback: Instant 16ms scale/alpha response for tactile feel.
 *  • Orientation/Resize Adaptive: Repositions automatically when viewport dimensions change.
 */
export class MobileControls {
  // Public flags — Player polls these each frame alongside keyboard
  public moveLeftPressed = false;
  public moveRightPressed = false;
  public jumpPressed = false;
  public jumpJustPressed = false;
  public abilityJustPressed = false;

  private readonly scene: Phaser.Scene;
  private readonly onAbilityPressed: MobileAbilityCallback;

  // Active pointer IDs tracking which finger controls which button
  private leftPointerId: number | null = null;
  private rightPointerId: number | null = null;
  private jumpPointerId: number | null = null;
  private abilityPointerId: number | null = null;

  // Button containers & visuals
  private leftBtn!: Phaser.GameObjects.Container;
  private leftBtnBg!: Phaser.GameObjects.Arc;
  private rightBtn!: Phaser.GameObjects.Container;
  private rightBtnBg!: Phaser.GameObjects.Arc;
  private jumpBtn!: Phaser.GameObjects.Container;
  private jumpBtnBg!: Phaser.GameObjects.Arc;
  private abilityBtn!: Phaser.GameObjects.Container;
  private abilityBtnBg!: Phaser.GameObjects.Arc;

  // Ability icon elements for live updates
  private abilityIconGfx!: Phaser.GameObjects.Graphics;
  private abilityLabelText!: Phaser.GameObjects.Text;
  private abilityCooldownArc!: Phaser.GameObjects.Graphics;

  // Event listener references for clean teardown
  private resizeHandler?: () => void;
  private pointerUpHandler?: (p: Phaser.Input.Pointer) => void;
  private pointerMoveHandler?: (p: Phaser.Input.Pointer) => void;
  private gameOutHandler?: () => void;

  // Visual constants
  private static readonly DEPTH = 200;
  private static readonly BTN_RADIUS = 30;
  private static readonly BTN_ALPHA = 0.60;
  private static readonly BTN_ALPHA_PRESSED = 0.88;

  constructor(
    scene: Phaser.Scene,
    options: {
      onAbilityPressed: MobileAbilityCallback;
    }
  ) {
    this.scene = scene;
    this.onAbilityPressed = options.onAbilityPressed;

    // Ensure Phaser has multiple touch pointers allocated for true multi-touch
    if (scene.input.manager) {
      while (scene.input.manager.pointers.length < 5) {
        scene.input.addPointer(1);
      }
    }

    this.createButtons();
    this.setupGlobalPointerListeners();
    this.positionButtons();

    // Listen for resize / orientation changes
    this.resizeHandler = () => this.positionButtons();
    scene.scale.on('resize', this.resizeHandler);

    // Auto-cleanup on scene shutdown
    scene.events.once('shutdown', () => this.destroy());
  }

  // ── Button Creation ─────────────────────────────────────────────────────

  private createButtons(): void {
    const R = MobileControls.BTN_RADIUS;
    const A = MobileControls.BTN_ALPHA;
    const D = MobileControls.DEPTH;

    // ── LEFT MOVE ─────────────────────────────────────────────────────
    const leftRes = this.createCircleButton(0, 0, R, 0x00f0ff, A, D, '◀', (pointer) => {
      this.leftPointerId = pointer.id;
      this.moveLeftPressed = true;
      this.leftBtn.setScale(0.92);
      this.leftBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
    });
    this.leftBtn = leftRes.container;
    this.leftBtnBg = leftRes.bg;

    // ── RIGHT MOVE ────────────────────────────────────────────────────
    const rightRes = this.createCircleButton(0, 0, R, 0x00f0ff, A, D, '▶', (pointer) => {
      this.rightPointerId = pointer.id;
      this.moveRightPressed = true;
      this.rightBtn.setScale(0.92);
      this.rightBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
    });
    this.rightBtn = rightRes.container;
    this.rightBtnBg = rightRes.bg;

    // ── JUMP ──────────────────────────────────────────────────────────
    const jumpRes = this.createCircleButton(0, 0, R, 0x39ff14, A, D, '▲', (pointer) => {
      this.jumpPointerId = pointer.id;
      this.jumpPressed = true;
      this.jumpJustPressed = true;
      this.jumpBtn.setScale(0.92);
      this.jumpBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
    });
    this.jumpBtn = jumpRes.container;
    this.jumpBtnBg = jumpRes.bg;

    // ── ABILITY ───────────────────────────────────────────────────────
    this.abilityBtn = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(D);

    // Background circle
    this.abilityBtnBg = this.scene.add.circle(0, 0, R, 0xd85ef5, A);
    this.abilityBtn.add(this.abilityBtnBg);

    // Border ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(2.5, 0xd85ef5, 0.9);
    ring.strokeCircle(0, 0, R);
    this.abilityBtn.add(ring);

    // Cooldown arc overlay
    this.abilityCooldownArc = this.scene.add.graphics();
    this.abilityBtn.add(this.abilityCooldownArc);

    // Icon graphics (drawn procedurally)
    this.abilityIconGfx = this.scene.add.graphics();
    this.drawAbilityIcon(0xffffff);
    this.abilityBtn.add(this.abilityIconGfx);

    // Label text under the button
    this.abilityLabelText = this.scene.add.text(0, R + 8, 'ABILITY', {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#d85ef5',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.abilityBtn.add(this.abilityLabelText);

    // Hit zone (forgiving hit area)
    const abilityZone = this.scene.add.zone(0, 0, R * 2.8, R * 2.8)
      .setInteractive()
      .setScrollFactor(0);
    this.abilityBtn.add(abilityZone);

    abilityZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.abilityPointerId = pointer.id;
      this.abilityJustPressed = true;
      this.abilityBtn.setScale(0.92);
      this.abilityBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
      // Instant execution with zero delay
      this.onAbilityPressed();
    });
  }

  /**
   * Creates a standard circular touch button with tactile feedback.
   */
  private createCircleButton(
    x: number, y: number,
    radius: number, color: number, alpha: number, depth: number,
    label: string,
    onDown: (pointer: Phaser.Input.Pointer) => void
  ): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Arc } {
    const container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(depth);

    // Background fill
    const bg = this.scene.add.circle(0, 0, radius, color, alpha);
    container.add(bg);

    // Border ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(2, color, 0.85);
    ring.strokeCircle(0, 0, radius);
    container.add(ring);

    // Icon label
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: '"Pixelify Sans", monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    container.add(text);

    // Hit zone (forgiving hit area)
    const zone = this.scene.add.zone(0, 0, radius * 2.8, radius * 2.8)
      .setInteractive()
      .setScrollFactor(0);
    container.add(zone);

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      onDown(pointer);
    });

    return { container, bg };
  }

  // ── Global Multi-Touch Management ───────────────────────────────────────

  private setupGlobalPointerListeners(): void {
    // Release button when its specific pointer lifts up anywhere on screen
    this.pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
      this.handlePointerRelease(pointer.id);
    };

    this.scene.input.on('pointerup', this.pointerUpHandler);
    this.scene.input.on('pointercancel', this.pointerUpHandler);

    // Smooth thumb sliding between Left and Right
    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.leftPointerId || pointer.id === this.rightPointerId) {
        const leftDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.leftBtn.x, this.leftBtn.y);
        const rightDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.rightBtn.x, this.rightBtn.y);
        const R = MobileControls.BTN_RADIUS;

        if (leftDist < R * 1.6) {
          if (this.rightPointerId === pointer.id) {
            this.rightPointerId = null;
            this.moveRightPressed = false;
            this.rightBtn.setScale(1);
            this.rightBtnBg.setAlpha(MobileControls.BTN_ALPHA);
          }
          this.leftPointerId = pointer.id;
          this.moveLeftPressed = true;
          this.leftBtn.setScale(0.92);
          this.leftBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
        } else if (rightDist < R * 1.6) {
          if (this.leftPointerId === pointer.id) {
            this.leftPointerId = null;
            this.moveLeftPressed = false;
            this.leftBtn.setScale(1);
            this.leftBtnBg.setAlpha(MobileControls.BTN_ALPHA);
          }
          this.rightPointerId = pointer.id;
          this.moveRightPressed = true;
          this.rightBtn.setScale(0.92);
          this.rightBtnBg.setAlpha(MobileControls.BTN_ALPHA_PRESSED);
        } else if (leftDist > R * 3.5 && rightDist > R * 3.5) {
          // Thumb moved far away from movement buttons
          this.handlePointerRelease(pointer.id);
        }
      }
    };

    this.scene.input.on('pointermove', this.pointerMoveHandler);

    // Release all if browser window loses focus
    this.gameOutHandler = () => this.releaseAllButtons();
    this.scene.input.on('gameout', this.gameOutHandler);
  }

  private handlePointerRelease(pointerId: number): void {
    if (this.leftPointerId === pointerId) {
      this.leftPointerId = null;
      this.moveLeftPressed = false;
      this.leftBtn.setScale(1);
      this.leftBtnBg.setAlpha(MobileControls.BTN_ALPHA);
    }
    if (this.rightPointerId === pointerId) {
      this.rightPointerId = null;
      this.moveRightPressed = false;
      this.rightBtn.setScale(1);
      this.rightBtnBg.setAlpha(MobileControls.BTN_ALPHA);
    }
    if (this.jumpPointerId === pointerId) {
      this.jumpPointerId = null;
      this.jumpPressed = false;
      this.jumpBtn.setScale(1);
      this.jumpBtnBg.setAlpha(MobileControls.BTN_ALPHA);
    }
    if (this.abilityPointerId === pointerId) {
      this.abilityPointerId = null;
      this.abilityBtn.setScale(1);
      this.abilityBtnBg.setAlpha(MobileControls.BTN_ALPHA);
    }
  }

  private releaseAllButtons(): void {
    this.leftPointerId = null;
    this.rightPointerId = null;
    this.jumpPointerId = null;
    this.abilityPointerId = null;

    this.moveLeftPressed = false;
    this.moveRightPressed = false;
    this.jumpPressed = false;

    this.leftBtn?.setScale(1);
    this.leftBtnBg?.setAlpha(MobileControls.BTN_ALPHA);
    this.rightBtn?.setScale(1);
    this.rightBtnBg?.setAlpha(MobileControls.BTN_ALPHA);
    this.jumpBtn?.setScale(1);
    this.jumpBtnBg?.setAlpha(MobileControls.BTN_ALPHA);
    this.abilityBtn?.setScale(1);
    this.abilityBtnBg?.setAlpha(MobileControls.BTN_ALPHA);
  }

  private drawAbilityIcon(tint: number): void {
    this.abilityIconGfx.clear();
    this.abilityIconGfx.lineStyle(3, tint, 1);
    this.abilityIconGfx.beginPath();
    this.abilityIconGfx.moveTo(-4, -12);
    this.abilityIconGfx.lineTo(2, -2);
    this.abilityIconGfx.lineTo(-2, 2);
    this.abilityIconGfx.lineTo(4, 12);
    this.abilityIconGfx.strokePath();
  }

  // ── Layout / Positioning ────────────────────────────────────────────────

  private positionButtons(): void {
    const cam = this.scene.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const R = MobileControls.BTN_RADIUS;
    const margin = 16;

    // Bottom-left: movement arrows, side by side with comfortable spacing
    const leftX = margin + R;
    const leftY = H - margin - R;
    this.leftBtn.setPosition(leftX, leftY);
    this.rightBtn.setPosition(leftX + R * 2 + 14, leftY);

    // Bottom-right: jump and ability
    // Jump button is at the outer right edge (primary right thumb position)
    const jumpX = W - margin - R;
    const jumpY = H - margin - R;
    this.jumpBtn.setPosition(jumpX, jumpY);

    // Ability button is comfortably spaced to the left of jump
    this.abilityBtn.setPosition(jumpX - R * 2 - 16, jumpY);
  }

  // ── Ability State Updates ───────────────────────────────────────────────

  /**
   * Called each frame by the scene to update the ability button's visual.
   */
  public updateAbilityState(state: MobileAbilityState): void {
    this.abilityLabelText.setText(state.label);

    if (state.available) {
      this.abilityBtnBg.setFillStyle(state.tint, MobileControls.BTN_ALPHA);
      this.abilityLabelText.setColor('#' + state.tint.toString(16).padStart(6, '0'));
      this.drawAbilityIcon(0xffffff);
    } else {
      this.abilityBtnBg.setFillStyle(0x333333, 0.35);
      this.abilityLabelText.setColor('#555555');
      this.drawAbilityIcon(0x555555);
    }

    // Cooldown arc overlay
    this.abilityCooldownArc.clear();
    const cd = state.cooldownProgress ?? 0;
    if (cd > 0 && cd < 1) {
      const R = MobileControls.BTN_RADIUS;
      this.abilityCooldownArc.fillStyle(0x000000, 0.5);
      this.abilityCooldownArc.slice(
        0, 0, R,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * cd),
        true
      );
      this.abilityCooldownArc.fillPath();
    }
  }

  // ── Per-Frame Flag Reset ────────────────────────────────────────────────

  /**
   * Called each frame to clear one-shot pulse flags.
   */
  public resetFrameFlags(): void {
    this.jumpJustPressed = false;
    this.abilityJustPressed = false;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  public destroy(): void {
    if (this.pointerUpHandler) {
      this.scene.input.off('pointerup', this.pointerUpHandler);
      this.scene.input.off('pointercancel', this.pointerUpHandler);
    }
    if (this.pointerMoveHandler) {
      this.scene.input.off('pointermove', this.pointerMoveHandler);
    }
    if (this.gameOutHandler) {
      this.scene.input.off('gameout', this.gameOutHandler);
    }
    if (this.resizeHandler) {
      this.scene.scale.off('resize', this.resizeHandler);
    }

    this.leftBtn?.destroy();
    this.rightBtn?.destroy();
    this.jumpBtn?.destroy();
    this.abilityBtn?.destroy();

    this.releaseAllButtons();
  }
}
