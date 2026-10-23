import Phaser from 'phaser';

/**
 * SentinelDrone — Phase 3 Enemy
 *
 * States:
 *  PATROL  → hovers back and forth between patrolLeft / patrolRight
 *  ALERT   → detected player within range, moves toward them faster
 *  STUNNED → frozen by staff hit for STUN_DURATION ms
 *
 * Contact with a non-stunned drone kills the player.
 * Player can stun it by using the staff within STAFF_RANGE px.
 */
export type DroneState = 'patrol' | 'alert' | 'stunned';

export class SentinelDrone extends Phaser.Physics.Arcade.Sprite {
  public droneState: DroneState = 'patrol';

  private readonly patrolLeft: number;
  private readonly patrolRight: number;
  private readonly patrolSpeed = 48;
  private readonly alertSpeed  = 100;
  private readonly detectRange = 110;
  private readonly loseRange   = 160;

  private movingRight = true;
  private stunRemaining = 0;
  private readonly STUN_DURATION = 3200;

  private eyeGlow?: Phaser.GameObjects.Graphics;
  private alertIcon?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolLeft: number,
    patrolRight: number
  ) {
    super(scene, x, y, 'drone_active');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.setSize(18, 12);

    // Idle hover bob
    scene.tweens.add({
      targets: this,
      y: y - 5,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut'
    });

    // Red eye glow overlay (rendered each frame via update)
    this.eyeGlow = scene.add.graphics().setDepth(this.depth + 1);
  }

  public update(_time: number, delta: number, playerX: number, playerY: number): void {
    if (!this.body || !this.active) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);

    // --- Stunned state ---
    if (this.droneState === 'stunned') {
      this.stunRemaining -= delta;
      body.setVelocityX(0);
      this.drawEye(0x00f0ff);
      if (this.stunRemaining <= 0) this.recover();
      return;
    }

    // --- State transitions ---
    if (dist < this.detectRange && this.droneState === 'patrol') {
      this.enterAlert();
    } else if (dist > this.loseRange && this.droneState === 'alert') {
      this.enterPatrol();
    }

    // --- Movement ---
    if (this.droneState === 'patrol') {
      if (this.movingRight) {
        body.setVelocityX(this.patrolSpeed);
        if (this.x >= this.patrolRight) this.movingRight = false;
      } else {
        body.setVelocityX(-this.patrolSpeed);
        if (this.x <= this.patrolLeft) this.movingRight = true;
      }
      this.setFlipX(!this.movingRight);
      this.drawEye(0xff2222);
    } else {
      const dir = playerX > this.x ? 1 : -1;
      body.setVelocityX(this.alertSpeed * dir);
      this.setFlipX(dir < 0);
      this.drawEye(0xff8800);
    }
  }

  private drawEye(color: number): void {
    if (!this.eyeGlow) return;
    this.eyeGlow.clear();
    this.eyeGlow.fillStyle(color, 0.85);
    this.eyeGlow.fillCircle(this.x + (this.flipX ? -4 : 4), this.y - 1, 3);
  }

  private enterAlert(): void {
    this.droneState = 'alert';
    this.setTint(0xff6633);
    this.emit('drone_alert');

    // ! indicator
    if (!this.alertIcon) {
      this.alertIcon = this.scene.add.text(this.x, this.y - 20, '!', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#ff8800'
      }).setOrigin(0.5).setDepth(30);
    }
    this.alertIcon.setPosition(this.x, this.y - 20).setVisible(true);
  }

  private enterPatrol(): void {
    this.droneState = 'patrol';
    this.clearTint();
    this.alertIcon?.setVisible(false);
  }

  public stun(): void {
    if (this.droneState === 'stunned') return;
    this.droneState = 'stunned';
    this.stunRemaining = this.STUN_DURATION;
    this.clearTint();
    this.alertIcon?.setVisible(false);
    this.emit('drone_stunned');
  }

  private recover(): void {
    this.droneState = 'patrol';
    this.clearTint();
    this.emit('drone_recovered');
  }

  public get isLethal(): boolean {
    return this.droneState !== 'stunned';
  }

  public preDestroy(): void {
    this.eyeGlow?.destroy();
    this.alertIcon?.destroy();
  }
}
