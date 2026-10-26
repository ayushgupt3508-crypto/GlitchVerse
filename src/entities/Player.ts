import Phaser from 'phaser';
import type { StaffController } from '../systems/staff/StaffController';

export class Player extends Phaser.Physics.Arcade.Sprite {
  // Movement parameters
  public readonly moveSpeed = 160;
  public readonly jumpVelocity = -350;
  public readonly acceleration = 1200;
  public readonly drag = 1000;

  // Staff & ability stats
  public staffCharges = 3;
  public maxStaffCharges = 3;
  public staffController?: StaffController;

  // Integrity (health) system
  public integrity = 3;
  public readonly maxIntegrity = 3;
  private invincibleTimer = 0;
  private readonly INVINCIBLE_DURATION = 1500; // ms

  // Jump feel enhancers
  private coyoteTimer = 0;
  private readonly coyoteThreshold = 140; // ms
  private jumpBufferTimer = 0;
  private readonly jumpBufferThreshold = 140; // ms
  private isJumpKeyHeld = false;

  // Keys
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyInteractE!: Phaser.Input.Keyboard.Key;
  private keyInteractJ!: Phaser.Input.Keyboard.Key;

  // State
  public isInteracting = false;
  public isDead = false;
  private wasInAir = false;

  /**
   * Optional mobile input flags — set by MobileControls on touch devices.
   * When present, these are OR'd into the keyboard poll. On desktop this
   * is always undefined, so the existing keyboard path is untouched.
   */
  public mobileInput?: {
    moveLeft: boolean;
    moveRight: boolean;
    jumpIsDown: boolean;
    jumpJustPressed: boolean;
    interactJustPressed: boolean;
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'scientist_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics Body tuning
    this.setCollideWorldBounds(true);
    // Align 12x30 hitbox to 20x36 sprite, preventing snagging on platform edges
    this.setSize(12, 30);
    this.setOffset(4, 6);
    this.setMaxVelocity(this.moveSpeed, 600);

    // Setup input keys (A/D or Arrows to move, Space/W/Up to jump, E/J to interact)
    this.ensureKeys();
  }

  public update(time: number, _delta: number): void {
    if (this.isDead || !this.body) return;

    const onGround = this.body.blocked.down || this.body.touching.down;

    // Landing detection — emit once when transitioning from air to ground
    if (onGround && this.wasInAir) {
      this.wasInAir = false;
      this.emit('player_land');
    } else if (!onGround) {
      this.wasInAir = true;
    }

    // Invincibility timer countdown
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= (_delta ?? 16);
      if (this.invincibleTimer <= 0) {
        this.invincibleTimer = 0;
        this.setAlpha(1);
      }
    }

    // Coyote Time update
    if (onGround) {
      this.coyoteTimer = time + this.coyoteThreshold;
    }

    // Input polling
    const moveLeft = (this.keyA && this.keyA.isDown) || (this.cursors?.left?.isDown ?? false)
      || (this.mobileInput?.moveLeft ?? false);
    const moveRight = (this.keyD && this.keyD.isDown) || (this.cursors?.right?.isDown ?? false)
      || (this.mobileInput?.moveRight ?? false);
    const jumpJustPressed =
      (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
      (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW)) ||
      (this.cursors?.up ? Phaser.Input.Keyboard.JustDown(this.cursors.up) : false)
      || (this.mobileInput?.jumpJustPressed ?? false);
    const jumpIsDown =
      (this.keySpace && this.keySpace.isDown) ||
      (this.keyW && this.keyW.isDown) ||
      (this.cursors?.up?.isDown ?? false)
      || (this.mobileInput?.jumpIsDown ?? false);
    // Interact key is only queried for legacy useStaff if no StaffController is attached
    const interactJustPressed = !this.staffController && (
      (this.keyInteractE && Phaser.Input.Keyboard.JustDown(this.keyInteractE)) ||
      (this.keyInteractJ && Phaser.Input.Keyboard.JustDown(this.keyInteractJ))
      || (this.mobileInput?.interactJustPressed ?? false)
    );

    // Jump Buffering
    if (jumpJustPressed) {
      this.jumpBufferTimer = time + this.jumpBufferThreshold;
    }

    // Horizontal Movement
    if (moveLeft && !moveRight) {
      this.setVelocityX(-this.moveSpeed);
      this.setFlipX(true);
      // Adjust offset when flipped to maintain centered collider
      this.setOffset(4, 6);
    } else if (moveRight && !moveLeft) {
      this.setVelocityX(this.moveSpeed);
      this.setFlipX(false);
      this.setOffset(4, 6);
    } else {
      // Snappy deceleration
      this.setVelocityX(0);
    }

    // Jump Execution
    const canJump = onGround || time < this.coyoteTimer;
    const wantsJump = time < this.jumpBufferTimer;

    if (canJump && wantsJump) {
      this.setVelocityY(this.jumpVelocity);
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.isJumpKeyHeld = true;
      this.emit('player_jump');
    }

    // Variable Jump Height: cut jump short if button released early while ascending
    if (this.isJumpKeyHeld && !jumpIsDown && this.body.velocity.y < -80) {
      this.setVelocityY(this.body.velocity.y * 0.45);
      this.isJumpKeyHeld = false;
    }

    // Staff Interaction Trigger
    if (interactJustPressed) {
      this.useStaff();
    }

    // Animation Controller
    this.updateAnimation(onGround);
  }

  private updateAnimation(onGround: boolean): void {
    if (!this.body) return;

    if (!onGround) {
      if (this.body.velocity.y < -40) {
        if (this.anims.currentAnim?.key !== 'player_jump') {
          this.play('player_jump');
        }
      } else if (this.body.velocity.y > 40) {
        if (this.anims.currentAnim?.key !== 'player_fall') {
          this.play('player_fall');
        }
      }
    } else {
      if (Math.abs(this.body.velocity.x) > 10) {
        if (this.anims.currentAnim?.key !== 'player_run') {
          this.play('player_run');
        }
      } else {
        if (this.anims.currentAnim?.key !== 'player_idle') {
          this.play('player_idle');
        }
      }
    }
  }

  public useStaff(): void {
    if (this.staffCharges <= 0) {
      this.emit('staff_empty');
      return;
    }

    this.staffCharges--;
    this.emit('staff_used', this.staffCharges);

    // Glowing cyan pulse fx from staff tip
    const staffTipX = this.flipX ? this.x - 10 : this.x + 10;
    const staffTipY = this.y - 12;

    const ring = this.scene.add.circle(staffTipX, staffTipY, 4, 0x00f0ff, 0.9);
    this.scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Called when drone/hazard hits the player.
   * Returns true if the hit was lethal (integrity reached 0).
   * Returns false if still alive (and starts invincibility frames).
   */
  public setStaffController(controller: StaffController): void {
    this.staffController = controller;
    this.staffCharges = controller.chargeManager.getCharges();
    this.maxStaffCharges = controller.chargeManager.getMaxCharges();
    controller.chargeManager.on('charge_changed', (curr: number, max: number) => {
      this.staffCharges = curr;
      this.maxStaffCharges = max;
    });
  }

  /**
   * Called when drone/hazard hits the player.
   * Returns true if the hit was lethal (integrity reached 0).
   * Returns false if still alive (and starts invincibility frames).
   */
  public takeDamage(): boolean {
    if (this.invincibleTimer > 0) return false; // i-frames active
    if (this.isDead) return false;

    this.integrity = Math.max(0, this.integrity - 1);
    this.emit('player_damaged', this.integrity);

    if (this.integrity <= 0) {
      this.die();
      return true; // caller handles death sequence
    }

    // Survive — trigger i-frames + red blink
    this.invincibleTimer = this.INVINCIBLE_DURATION;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      yoyo: true,
      repeat: 5,
      duration: 110,
      onComplete: () => { if (!this.isDead) this.setAlpha(1); }
    });
    return false;
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.integrity = 0;
    this.setVelocity(0, 0);
    this.emit('player_damaged', 0);
    this.emit('player_died');
  }

  public restoreIntegrity(): void {
    this.integrity = this.maxIntegrity;
    this.emit('player_damaged', this.integrity); // reuse to refresh HUD
  }

  public restoreStaffCharges(amount = 1): void {
    if (this.staffController) {
      this.staffController.chargeManager.refill(amount);
    } else {
      this.staffCharges = Math.min(this.maxStaffCharges, this.staffCharges + amount);
      this.emit('staff_recharged', this.staffCharges);
    }
  }

  public ensureKeys(): void {
    if (!this.scene.input.keyboard) return;
    const kb = this.scene.input.keyboard;
    if (!this.cursors) {
      this.cursors = kb.createCursorKeys();
    }
    const checkAndAdd = (key: Phaser.Input.Keyboard.Key | undefined, code: number) => {
      if (!key || !kb.keys.some(k => k.keyCode === code)) {
        return kb.addKey(code);
      }
      return key;
    };
    this.keyA = checkAndAdd(this.keyA, Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = checkAndAdd(this.keyD, Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = checkAndAdd(this.keyW, Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = checkAndAdd(this.keySpace, Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyInteractE = checkAndAdd(this.keyInteractE, Phaser.Input.Keyboard.KeyCodes.E);
    this.keyInteractJ = checkAndAdd(this.keyInteractJ, Phaser.Input.Keyboard.KeyCodes.J);
  }

  public respawnAt(x: number, y: number): void {
    this.isDead = false;
    this.invincibleTimer = 0;
    this.integrity = this.maxIntegrity;
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.setAlpha(1);
    this.isJumpKeyHeld = false;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.wasInAir = false;

    // Reset input states and ensure keys are registered in the keyboard plugin
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.resetKeys();
      this.ensureKeys();
      this.keySpace?.reset();
      this.keyW?.reset();
      this.keyA?.reset();
      this.keyD?.reset();
      if (this.cursors) {
        this.cursors.up?.reset();
        this.cursors.down?.reset();
        this.cursors.left?.reset();
        this.cursors.right?.reset();
      }
    }

    if (this.staffController) {
      this.staffController.chargeManager.refillMax('respawn');
    } else {
      this.staffCharges = this.maxStaffCharges;
    }
    this.emit('player_respawn');
    this.emit('player_damaged', this.integrity); // refresh HUD integrity
  }
}
