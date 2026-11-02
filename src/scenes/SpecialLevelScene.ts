import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player } from '../entities/Player';
import { AudioManager } from '../systems/AudioManager';
import { SaveSystem } from '../systems/SaveSystem';
import { TextureGenerator } from '../utils/TextureGenerator';
import { setupMobileForScene, MobileSetupHandle } from '../ui/MobileSetup';
import { CONVERGENCE_CONFIG } from '../config/convergenceConfig';
import { ConvergenceWorldBuilder, WorldBuildResult } from './special/ConvergenceWorldBuilder';
import { ConvergenceHUD } from './special/ConvergenceHUD';

export class SpecialLevelScene extends Phaser.Scene {
  private player!: Player;
  private world!: WorldBuildResult;
  private hud!: ConvergenceHUD;
  private mobileHandle: MobileSetupHandle | null = null;

  // Run State
  private attempts = 3;
  private timeRemainingSeconds = 270;
  private score = 0;
  private abilitiesUsed = 0;
  private surgeHits = 0;
  private isRespawning = false;
  private isLevelComplete = false;
  private isGameOver = false;

  // Ability & Puzzle Active States
  private activeCheckpoint = { x: 100, y: 340, bayId: 1 };
  private isCloaked = false;
  private cloakTimer = 0;
  private currentReality: 'A' | 'B' = 'A';
  private hasConvergenceCore = false;

  // Surge State
  private surgeTimer = 0;
  private surgeState: 'idle' | 'warning' | 'impact' = 'idle';
  private surgeGfx!: Phaser.GameObjects.Graphics;

  // Timer event
  private secondTimerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super(GAME_CONFIG.sceneKeys.SpecialLevel || 'SpecialLevelScene');
  }

  create(): void {
    // 1. Reset state
    this.attempts = CONVERGENCE_CONFIG.run.maxAttempts;
    this.timeRemainingSeconds = CONVERGENCE_CONFIG.run.totalTimeSeconds;
    this.score = 0;
    this.abilitiesUsed = 0;
    this.surgeHits = 0;
    this.isRespawning = false;
    this.isLevelComplete = false;
    this.isGameOver = false;
    this.isCloaked = false;
    this.cloakTimer = 0;
    this.currentReality = 'A';
    this.hasConvergenceCore = false;
    this.surgeTimer = 0;
    this.surgeState = 'idle';
    this.activeCheckpoint = { x: 100, y: 340, bayId: 1 };

    // 2. Generate all textures from previous levels
    TextureGenerator.generatePlayerTextures(this);
    TextureGenerator.generateEnvironmentTextures(this);
    TextureGenerator.generateMedievalTextures(this);
    TextureGenerator.generateCityTextures(this);
    TextureGenerator.generateFuturisticTextures(this);

    // 3. Audio & World Bounds
    AudioManager.init();
    AudioManager.startLevel5Music();

    const CW = CONVERGENCE_CONFIG.chamber.width;  // 3800
    const CH = CONVERGENCE_CONFIG.chamber.height; // 480
    this.physics.world.setBounds(0, 0, CW, CH + 150);
    this.cameras.main.setBounds(0, 0, CW, CH);
    this.cameras.main.fadeIn(500, 5, 12, 28);

    // 4. Build world geometry, textures & puzzle objects
    this.world = ConvergenceWorldBuilder.build(this);

    // 5. Spawn Player at active checkpoint
    this.player = new Player(this, this.activeCheckpoint.x, this.activeCheckpoint.y);
    this.player.staffCharges = CONVERGENCE_CONFIG.run.initialStaffCharges;
    this.player.maxStaffCharges = CONVERGENCE_CONFIG.run.maxStaffCharges;
    this.player.integrity = CONVERGENCE_CONFIG.run.maxIntegrity;
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, 0, 40);

    // 6. Setup Collisions
    this.setupCollisions();

    // 7. Surge warning visual overlay
    this.surgeGfx = this.add.graphics().setScrollFactor(0).setDepth(150);

    // 8. Build HUD & Controls
    this.hud = new ConvergenceHUD(this);
    this.setupControls();

    // 9. Countdown clock
    this.secondTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.isLevelComplete || this.isGameOver) return;
        this.timeRemainingSeconds = Math.max(0, this.timeRemainingSeconds - 1);
        if (this.timeRemainingSeconds <= 0) {
          this.triggerGameOver();
        }
      }
    });

    // Cleanup on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownScene());
  }

  private setupCollisions(): void {
    // Normal static platforms
    this.physics.add.collider(this.player, this.world.platforms);
    this.physics.add.collider(this.player, this.world.phasePlatformsA, undefined, () => this.currentReality === 'A');
    this.physics.add.collider(this.player, this.world.phasePlatformsB, undefined, () => this.currentReality === 'B');

    // Hazards (lava, icicles, thorns, glitch void)
    this.physics.add.overlap(this.player, this.world.hazardGroup, () => {
      this.handlePlayerDamage('ENVIRONMENTAL HAZARD');
    });

    // Cryo Geyser damage if unfrozen
    this.physics.add.overlap(this.player, this.world.cryoGeyser.waterSprite, () => {
      if (!this.world.cryoGeyser.frozen) {
        this.handlePlayerDamage('BOILING CRYO GEYSER');
      }
    });

    // Final Magma damage if unfrozen
    this.physics.add.overlap(this.player, this.world.finalMagma.lavaSprite, () => {
      if (!this.world.finalMagma.frozen) {
        this.handlePlayerDamage('MAGMA FLUX SURGE');
      }
    });

    // Data Shard Collectibles
    this.world.collectibles.forEach(col => {
      this.physics.add.overlap(this.player, col.sprite, () => {
        if (!col.collected) {
          col.collected = true;
          col.sprite.destroy();
          this.score += CONVERGENCE_CONFIG.scoring.collectibleValue;
          AudioManager.playFailsafe();
          this.hud.showWorldBanner(`+${CONVERGENCE_CONFIG.scoring.collectibleValue} DATA SHARD`, col.x, col.y - 16, 0xffd166);
        }
      });
    });

    // Elemental Seals
    this.world.seals.forEach(seal => {
      this.physics.add.overlap(this.player, seal.sprite, () => {
        if (!seal.completed) {
          seal.completed = true;
          seal.sprite.setAlpha(0.4);
          this.score += CONVERGENCE_CONFIG.scoring.basePerSeal;
          AudioManager.playComponent3Collect();
          this.hud.showWorldBanner(`★ ${seal.name} SECURED! ★`, this.player.x, this.player.y - 40, 0x70e000);

          if (this.areAllSealsCollected()) {
            this.time.delayedCall(800, () => {
              this.hud.showWorldBanner('ALL 5 SEALS SECURED! APEX UNSEALED!', this.player.x, this.player.y - 60, 0x00f0ff);
            });
          }
        }
      });
    });

    // Checkpoints
    this.world.checkpoints.forEach(cp => {
      this.physics.add.overlap(this.player, cp.sprite, () => {
        if (!cp.active) {
          this.world.checkpoints.forEach(c => (c.active = false));
          cp.active = true;
          this.activeCheckpoint = { x: cp.x, y: cp.y, bayId: cp.bayId };
          AudioManager.playCheckpoint();
          this.hud.showWorldBanner('CHECKPOINT SAVED', cp.x, cp.y - 36, 0x00f0ff);

          // Refill 1 staff charge if needed
          if (this.player.staffCharges < this.player.maxStaffCharges) {
            this.player.staffCharges = Math.min(this.player.maxStaffCharges, this.player.staffCharges + 1);
            AudioManager.playConduitRecharge();
          }
        }
      });
    });

    // Conduits (Refill staff charges when touched)
    this.world.conduits.forEach(cond => {
      this.physics.add.overlap(this.player, cond.sprite, () => {
        if (this.player.staffCharges < this.player.maxStaffCharges) {
          this.player.staffCharges = this.player.maxStaffCharges;
          AudioManager.playConduitRecharge();
          this.hud.showWorldBanner('STAFF FULLY RECHARGED (3/3)', cond.x, cond.y - 30, 0x00f0ff);
        }
      });
    });

    // Convergence Core
    this.physics.add.overlap(this.player, this.world.convergenceCore, () => {
      if (!this.hasConvergenceCore) {
        this.hasConvergenceCore = true;
        this.world.convergenceCore.destroy();
        AudioManager.playComponent3Collect();
        this.hud.showWorldBanner('CONVERGENCE CORE STABILIZED!', this.player.x, this.player.y - 40, 0x70e000);
        this.world.exitPortal.setTint(0x70e000); // Illuminate exit portal!
      }
    });

    // Exit Portal
    this.physics.add.overlap(this.player, this.world.exitPortal, () => {
      if (this.hasConvergenceCore && this.areAllSealsCollected() && !this.isLevelComplete) {
        this.triggerVictory();
      }
    });
  }

  private setupControls(): void {
    // Mobile controls setup
    this.mobileHandle = setupMobileForScene({
      scene: this,
      player: this.player,
      onAbilityPressed: () => this.handleAbilityActivation(),
      getAbilityState: () => ({
        label: this.getCurrentBayAbilityName(),
        available: this.player.staffCharges > 0,
        tint: this.player.staffCharges > 0 ? 0x00f0ff : 0x555555
      })
    });

    // Desktop keys: E and J
    if (this.input.keyboard) {
      const keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      const keyJ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
      const onAction = () => this.handleAbilityActivation();
      keyE.on('down', onAction);
      keyJ.on('down', onAction);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyE.off('down', onAction);
        keyJ.off('down', onAction);
      });
    }
  }

  update(time: number, delta: number): void {
    if (this.isLevelComplete || this.isGameOver) return;

    // 1. Update player physics & movement
    this.player.update(time, delta);

    // 2. Mobile controls sync
    if (this.mobileHandle) {
      this.mobileHandle.update();
    }

    // 3. Fall into abyss check
    if (this.player.y > CONVERGENCE_CONFIG.chamber.height + 60 && !this.isRespawning) {
      this.handlePlayerDamage('VOID HAZARD');
    }

    // 4. Update patrolling sentry in Bay 3
    this.updatePalaceSentry();

    // 5. Update Tripwire laser detection in Bay 3
    this.updateTripwireLaser();

    // 6. Update Cloak Timer
    if (this.isCloaked) {
      this.cloakTimer -= delta;
      if (this.cloakTimer <= 0) {
        this.isCloaked = false;
        this.player.setAlpha(1.0);
        AudioManager.playCamouflageDeactivate();
        this.hud.showWorldBanner('CLOAK EXPIRED', this.player.x, this.player.y - 30, 0xff8899);
      }
    }

    // 7. Update Thermal Vent Updraft
    if (this.world.thermalVent.ignited) {
      const ventBounds = this.world.thermalVent.updraftZone.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), ventBounds)) {
        this.player.setVelocityY(-480); // High launch updraft
        this.player.setVelocityX(140);   // Forward momentum
      }
    }

    // 8. Update Glitch Surge cycle
    this.updateGlitchSurge(delta);

    // 9. Update Dynamic Floating Hints & HUD
    this.updateHintsAndHUD();
  }

  // ── Ability Triggers ───────────────────────────────────────────────────

  private handleAbilityActivation(): void {
    if (this.isLevelComplete || this.isGameOver || this.isRespawning) return;

    if (this.player.staffCharges <= 0) {
      AudioManager.playInsufficientCharge();
      this.hud.showWorldBanner('NO STAFF CHARGES! REFILL AT CONDUIT', this.player.x, this.player.y - 30, 0xff3366);
      return;
    }

    const px = this.player.x;
    let used = false;

    // BAY 1: FREEZE GEYSER (X: 0 to 740)
    if (px >= 0 && px < 740) {
      if (!this.world.cryoGeyser.frozen) {
        this.world.cryoGeyser.frozen = true;
        this.world.cryoGeyser.waterSprite.setVisible(false);
        this.world.cryoGeyser.iceTiles.forEach(t => {
          t.setVisible(true);
          (t.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        });
        AudioManager.playTimeFreeze();
        this.spawnBurst(this.world.cryoGeyser.x, this.world.cryoGeyser.y, 0x48cae4);
        this.hud.showWorldBanner('CRYO FREEZE ACTIVATED — GEYSER SOLIDIFIED!', this.player.x, this.player.y - 40, 0x48cae4);
        used = true;
      }
    }
    // BAY 2: IGNITE THERMAL VENT (X: 740 to 1400)
    else if (px >= 740 && px < 1400) {
      if (!this.world.thermalVent.ignited) {
        this.world.thermalVent.ignited = true;
        this.world.thermalVent.sprite.setTint(0xff6b00);
        AudioManager.playEmpZap();
        this.spawnBurst(this.world.thermalVent.x, this.world.thermalVent.y, 0xff6b00);
        this.hud.showWorldBanner('THERMAL VENT IGNITED — UPDRAFT ACTIVE!', this.player.x, this.player.y - 40, 0xff6b00);
        used = true;
      }
    }
    // BAY 3: ACTIVATE CLOAK (X: 1400 to 2060)
    else if (px >= 1400 && px < 2060) {
      if (!this.isCloaked) {
        this.isCloaked = true;
        this.cloakTimer = 6000;
        this.player.setAlpha(0.35);
        AudioManager.playCamouflageActivate();
        this.spawnBurst(this.player.x, this.player.y, 0xd4af37);
        this.hud.showWorldBanner('CLOAK ENGAGED — INVISIBLE (6s)', this.player.x, this.player.y - 40, 0xd4af37);
        used = true;
      }
    }
    // BAY 4: CHRONO VINE GROWTH (X: 2060 to 2720)
    else if (px >= 2060 && px < 2720) {
      if (!this.world.chronoVine.grown) {
        this.world.chronoVine.grown = true;
        this.world.chronoVine.bridgeTiles.forEach(t => {
          t.setVisible(true);
          (t.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        });
        AudioManager.playStoneRumble();
        this.spawnBurst(this.world.chronoVine.saplingSprite.x, this.world.chronoVine.saplingSprite.y, 0x52b788);
        this.hud.showWorldBanner('CHRONO VINE ACCELERATED — BRIDGE FORMED!', this.player.x, this.player.y - 40, 0x52b788);
        used = true;
      }
    }
    // BAY 5: PHASE SHIFT (X: 2720 to 3380)
    else if (px >= 2720 && px < 3380) {
      this.currentReality = this.currentReality === 'A' ? 'B' : 'A';
      AudioManager.playPhaseShift();
      this.spawnBurst(this.player.x, this.player.y, this.currentReality === 'A' ? 0x00f0ff : 0xff007f);

      // Toggle solid bodies & opacity
      this.world.phasePlatformsA.children.iterate((c) => {
        const p = c as Phaser.Physics.Arcade.Sprite;
        p.setAlpha(this.currentReality === 'A' ? 1.0 : 0.2);
        if (p.body) (p.body as Phaser.Physics.Arcade.StaticBody).enable = this.currentReality === 'A';
        return null;
      });
      this.world.phasePlatformsB.children.iterate((c) => {
        const p = c as Phaser.Physics.Arcade.Sprite;
        p.setAlpha(this.currentReality === 'B' ? 1.0 : 0.2);
        if (p.body) (p.body as Phaser.Physics.Arcade.StaticBody).enable = this.currentReality === 'B';
        return null;
      });

      this.hud.showWorldBanner(`REALITY PHASE SHIFT: [${this.currentReality}]`, this.player.x, this.player.y - 40, this.currentReality === 'A' ? 0x00f0ff : 0xff007f);
      used = true;
    }
    // APEX CHAMBER: FREEZE FINAL MAGMA / GROW VINE LADDER (X: 3380 to 3800)
    else if (px >= 3380) {
      if (!this.world.finalMagma.frozen) {
        this.world.finalMagma.frozen = true;
        this.world.finalMagma.lavaSprite.setVisible(false);
        this.world.finalMagma.iceTiles.forEach(t => {
          t.setVisible(true);
          (t.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        });
        AudioManager.playTimeFreeze();
        this.hud.showWorldBanner('FINAL MAGMA FROZEN!', this.player.x, this.player.y - 40, 0x00f0ff);
        used = true;
      } else if (!this.world.finalVine.grown) {
        this.world.finalVine.grown = true;
        this.world.finalVine.vineTiles.forEach(t => {
          t.setVisible(true);
          (t.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        });
        AudioManager.playStoneRumble();
        this.hud.showWorldBanner('VINE LADDER GROWN TO PORTAL!', this.player.x, this.player.y - 40, 0x70e000);
        used = true;
      }
    }

    if (used) {
      this.player.staffCharges--;
      this.abilitiesUsed++;
    } else {
      // Staff use animation anyway for feedback
      this.player.useStaff();
    }
  }

  // ── Sentry & Laser Security ───────────────────────────────────────────

  private updatePalaceSentry(): void {
    const sentry = this.world.palaceSentry.sprite;
    const gfx = this.world.palaceSentry.visionGfx;
    if (!sentry.active || !sentry.body) return;

    // Patrol movement
    if (sentry.body.velocity.x === 0) {
      sentry.setVelocityX(55);
    }
    if (sentry.x >= this.world.palaceSentry.maxX) {
      sentry.setVelocityX(-55);
      sentry.setFlipX(true);
    } else if (sentry.x <= this.world.palaceSentry.minX) {
      sentry.setVelocityX(55);
      sentry.setFlipX(false);
    }

    // Vision cone
    gfx.clear();
    const facingDir = sentry.body.velocity.x > 0 ? 1 : -1;
    const coneDist = 90;
    const coneAngle = 0.5;

    gfx.fillStyle(this.isCloaked ? 0x00f0ff : 0xff0044, 0.22);
    gfx.beginPath();
    gfx.moveTo(sentry.x, sentry.y);
    gfx.lineTo(sentry.x + facingDir * coneDist, sentry.y - Math.sin(coneAngle) * coneDist);
    gfx.lineTo(sentry.x + facingDir * coneDist, sentry.y + Math.sin(coneAngle) * coneDist);
    gfx.closePath();
    gfx.fillPath();

    // Check player detection if not cloaked
    if (!this.isCloaked) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sentry.x, sentry.y);
      if (dist < 85 && Math.sign(this.player.x - sentry.x) === facingDir) {
        this.handlePlayerDamage('ROYAL SENTRY DETECTED');
      }
    }
  }

  private updateTripwireLaser(): void {
    if (this.isCloaked) return;
    const laserBounds = this.world.tripwireLaser.getBounds();
    if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), laserBounds)) {
      this.handlePlayerDamage('SECURITY LASER TRIPWIRE');
    }
  }

  // ── Glitch Surge Loop ──────────────────────────────────────────────────

  private updateGlitchSurge(delta: number): void {
    this.surgeTimer += delta;
    const period = CONVERGENCE_CONFIG.surge.intervalMs; // 22000
    const warnTime = period - CONVERGENCE_CONFIG.surge.warningDurationMs; // 19000

    this.surgeGfx.clear();
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    if (this.surgeTimer < warnTime) {
      this.surgeState = 'idle';
    } else if (this.surgeTimer < period) {
      this.surgeState = 'warning';
      // Warning border flashes
      const pulse = (Math.sin(this.time.now / 100) + 1) / 2;
      this.surgeGfx.lineStyle(6, 0xff0044, 0.4 + pulse * 0.5);
      this.surgeGfx.strokeRect(0, 0, W, H);
    } else if (this.surgeTimer < period + CONVERGENCE_CONFIG.surge.impactDurationMs) {
      this.surgeState = 'impact';
      this.surgeGfx.fillStyle(0xff0044, 0.15);
      this.surgeGfx.fillRect(0, 0, W, H);
      this.cameras.main.shake(120, 0.005);

      // Check if player is near any safe checkpoint or conduit
      const isSafe = this.isPlayerInSafeZone();
      if (!isSafe && !this.player.body?.touching.none) {
        // Impact hits player once per surge cycle
        if (this.surgeHits === 0) {
          this.surgeHits++;
          this.handlePlayerDamage('GLITCH SURGE WAVE');
        }
      }
    } else {
      // Reset cycle
      this.surgeTimer = 0;
      this.surgeHits = 0;
      this.surgeState = 'idle';
    }
  }

  private isPlayerInSafeZone(): boolean {
    for (const cp of this.world.checkpoints) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, cp.x, cp.y) < 70) return true;
    }
    for (const cond of this.world.conduits) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, cond.x, cond.y) < 70) return true;
    }
    return false;
  }

  // ── Dynamic Hints & HUD Update ─────────────────────────────────────────

  private updateHintsAndHUD(): void {
    const px = this.player.x;
    let zoneName = 'ZONE 1: CRYO ENGINE';
    let zoneSub = '// CRYO-HYDRO ENGINE //';
    let abilityName = 'FREEZE';
    let abilityHint = '[E] FREEZE GEYSER';
    let abilityColor = 0x48cae4;

    if (px < 740) {
      zoneName = 'ZONE 1: CRYO ENGINE';
      zoneSub = '// CRYO-HYDRO ENGINE //';
      abilityName = 'FREEZE';
      abilityHint = this.world.cryoGeyser.frozen ? 'GEYSER FROZEN [✓]' : '[E] FREEZE GEYSER';
      abilityColor = 0x48cae4;
      if (!this.world.cryoGeyser.frozen && Math.abs(px - this.world.cryoGeyser.x) < 80) {
        this.hud.showFloatingPrompt(this.world.cryoGeyser.x, this.world.cryoGeyser.y - 30, '[E] FREEZE GEYSER', 0x48cae4);
      } else {
        this.hud.hideFloatingPrompt();
      }
    } else if (px < 1400) {
      zoneName = 'ZONE 2: THERMAL CRUCIBLE';
      zoneSub = '// THERMAL CRUCIBLE //';
      abilityName = 'IGNITE';
      abilityHint = this.world.thermalVent.ignited ? 'VENT ACTIVE [✓]' : '[E] IGNITE VENT';
      abilityColor = 0xff6b00;
      if (!this.world.thermalVent.ignited && Math.abs(px - this.world.thermalVent.x) < 70) {
        this.hud.showFloatingPrompt(this.world.thermalVent.x, this.world.thermalVent.y - 30, '[E] IGNITE VENT', 0xff6b00);
      } else {
        this.hud.hideFloatingPrompt();
      }
    } else if (px < 2060) {
      zoneName = 'ZONE 3: ROYAL PALACE VAULT';
      zoneSub = '// ROYAL VAULT SECURITY //';
      abilityName = 'CLOAK';
      abilityHint = this.isCloaked ? `CLOAKED: ${(this.cloakTimer / 1000).toFixed(1)}s` : '[E] ACTIVATE CLOAK';
      abilityColor = 0xd4af37;
      if (!this.isCloaked && px > 1620 && px < 1850) {
        this.hud.showFloatingPrompt(this.player.x, this.player.y - 40, '[E] ACTIVATE CLOAK', 0xd4af37);
      } else {
        this.hud.hideFloatingPrompt();
      }
    } else if (px < 2720) {
      zoneName = 'ZONE 4: ANCIENT CHRONO FOREST';
      zoneSub = '// CHRONO-SAPLING VAULT //';
      abilityName = 'CHRONO';
      abilityHint = this.world.chronoVine.grown ? 'VINE GROWN [✓]' : '[E] GROW VINE BRIDGE';
      abilityColor = 0x52b788;
      if (!this.world.chronoVine.grown && Math.abs(px - 2240) < 80) {
        this.hud.showFloatingPrompt(2240, 340, '[E] GROW VINE BRIDGE', 0x52b788);
      } else {
        this.hud.hideFloatingPrompt();
      }
    } else if (px < 3380) {
      zoneName = 'ZONE 5: QUANTUM RIFT CORE';
      zoneSub = '// QUANTUM RIFT CORE //';
      abilityName = 'PHASE';
      abilityHint = `[E] PHASE: REALITY [${this.currentReality}]`;
      abilityColor = this.currentReality === 'A' ? 0x00f0ff : 0xff007f;
      this.hud.hideFloatingPrompt();
    } else {
      zoneName = 'APEX: THE CONVERGENCE';
      zoneSub = '// CONVERGENCE CORE //';
      abilityName = 'SYNCHRONIZE';
      abilityHint = !this.hasConvergenceCore ? 'COLLECT CORE' : '[E] CLEAR PATH TO PORTAL';
      abilityColor = 0x70e000;
      if (this.hasConvergenceCore && !this.world.finalMagma.frozen && Math.abs(px - 3560) < 60) {
        this.hud.showFloatingPrompt(3560, 340, '[E] FREEZE MAGMA', 0x00f0ff);
      } else if (this.hasConvergenceCore && !this.world.finalVine.grown && Math.abs(px - 3640) < 60) {
        this.hud.showFloatingPrompt(3640, 340, '[E] GROW VINE LADDER', 0x70e000);
      } else {
        this.hud.hideFloatingPrompt();
      }
    }

    // Surge countdown seconds
    const period = CONVERGENCE_CONFIG.surge.intervalMs;
    const remainingMs = Math.max(0, period - this.surgeTimer);
    const surgeSecs = Math.ceil(remainingMs / 1000);

    this.hud.update({
      zoneName,
      zoneSubtitle: zoneSub,
      abilityName,
      abilityHint,
      abilityColor,
      sealsCompleted: this.world.seals.map(s => s.completed),
      staffCharges: this.player.staffCharges,
      maxStaffCharges: this.player.maxStaffCharges,
      attempts: this.attempts,
      timeRemainingSeconds: this.timeRemainingSeconds,
      score: this.score,
      surgeState: this.surgeState,
      surgeSeconds: surgeSecs
    });
  }

  // ── Damage & Respawn ───────────────────────────────────────────────────

  private handlePlayerDamage(source: string): void {
    if (this.isRespawning || this.isLevelComplete || this.isGameOver) return;

    this.isRespawning = true;
    this.attempts--;
    AudioManager.playDeath();
    this.cameras.main.shake(200, 0.012);
    this.hud.showWorldBanner(`HIT BY ${source}!`, this.player.x, this.player.y - 40, 0xff0044);

    if (this.attempts <= 0) {
      this.triggerGameOver();
      return;
    }

    // Fade and respawn at active checkpoint
    this.cameras.main.fade(250, 20, 0, 10, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.player.setPosition(this.activeCheckpoint.x, this.activeCheckpoint.y);
        this.player.setVelocity(0, 0);
        this.player.setAlpha(1.0);
        this.isCloaked = false;
        this.cameras.main.fadeIn(250);
        this.isRespawning = false;
      }
    });
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.player.setVelocity(0, 0);
    this.hud.showGameOverModal(
      () => this.scene.restart(),
      () => this.scene.start(GAME_CONFIG.sceneKeys.MainMenu)
    );
  }

  private triggerVictory(): void {
    this.isLevelComplete = true;
    this.player.setVelocity(0, 0);

    // Calculate score
    const timeBonus = this.timeRemainingSeconds * CONVERGENCE_CONFIG.scoring.timeBonusPerSecond;
    const attemptBonus = this.attempts * CONVERGENCE_CONFIG.scoring.attemptBonusPerHeart;
    const totalScore = this.score + timeBonus + attemptBonus;

    // Rank calculation
    let rank = 'C';
    if (totalScore >= CONVERGENCE_CONFIG.scoring.rankThresholds.S) rank = 'S';
    else if (totalScore >= CONVERGENCE_CONFIG.scoring.rankThresholds.A) rank = 'A';
    else if (totalScore >= CONVERGENCE_CONFIG.scoring.rankThresholds.B) rank = 'B';

    // Save score
    SaveSystem.saveConvergenceScore(totalScore);

    this.hud.showVictoryModal(
      totalScore,
      this.timeRemainingSeconds,
      this.attempts,
      rank,
      () => this.scene.restart(),
      () => this.scene.start(GAME_CONFIG.sceneKeys.MainMenu)
    );
  }

  private areAllSealsCollected(): boolean {
    return this.world.seals.every(s => s.completed);
  }

  private getCurrentBayAbilityName(): string {
    const px = this.player?.x ?? 0;
    if (px < 740) return 'FREEZE';
    if (px < 1400) return 'IGNITE';
    if (px < 2060) return 'CLOAK';
    if (px < 2720) return 'CHRONO';
    return 'PHASE';
  }

  private spawnBurst(x: number, y: number, color: number): void {
    for (let i = 0; i < 14; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const spd = Phaser.Math.Between(40, 120);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * spd,
        y: y + Math.sin(angle) * spd,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(300, 600),
        onComplete: () => p.destroy()
      });
    }
  }

  private teardownScene(): void {
    if (this.secondTimerEvent) {
      this.secondTimerEvent.destroy();
      this.secondTimerEvent = undefined;
    }
  }
}
