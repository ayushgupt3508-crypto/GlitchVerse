import Phaser from 'phaser';
import { LEVEL6_CONFIG, GauntletObjective } from '../../config/level6Config';
import { AudioManager } from '../../systems/AudioManager';
import { HUD } from '../../ui/HUD';

export interface PuzzleStateChangeCallback {
  (type: 'objective' | 'key' | 'socket' | 'surge' | 'gameover' | 'victory', data?: any): void;
}

/**
 * GauntletPuzzleManager
 * ──────────────────────
 * Manages objective states, keys, cross-section carry-overs, S6 sequential socket locking,
 * and the dynamic Glitch Surge hazard wave.
 */
export class GauntletPuzzleManager {
  private scene: Phaser.Scene;
  private hud: HUD;

  // Objective Tracking
  public objectives: Map<string, GauntletObjective> = new Map();
  public keysCollected: Set<number> = new Set(); // 1 = Frost, 2 = Ember, 3 = Vault, 4 = Seed, 5 = Rift
  public socketsFilled: Set<number> = new Set(); // 1 = F1, 2 = F2, 3 = F3, 4 = F4, 5 = F5

  // Carry-over flags
  public isS2HeatGateLowered = false;
  public areS3BraziersIgnited = false;
  public isS5TransceiverEnergized = false;

  // Scoring and Stats
  public currentScore = 0;
  public abilityChargesUsed = 0;
  public alertCount = 0;
  public surgeHits = 0;

  // Glitch Surge State
  public isSurgeWarning = false;
  public isSurgeActive = false;
  private surgeTimer = 0;
  private surgePhase: 'idle' | 'warning' | 'active' = 'idle';

  // Listeners
  public onStateChange?: PuzzleStateChangeCallback;

  constructor(scene: Phaser.Scene, hud: HUD) {
    this.scene = scene;
    this.hud = hud;
    this.initObjectives();
  }

  private initObjectives(): void {
    this.objectives.clear();
    this.keysCollected.clear();
    this.socketsFilled.clear();
    this.currentScore = 0;
    this.abilityChargesUsed = 0;
    this.alertCount = 0;
    this.surgeHits = 0;
    this.isS2HeatGateLowered = false;
    this.areS3BraziersIgnited = false;
    this.isS5TransceiverEnergized = false;

    LEVEL6_CONFIG.objectives.forEach(obj => {
      this.objectives.set(obj.id, { ...obj, completed: false });
    });
  }

  public completeObjective(id: string): boolean {
    const obj = this.objectives.get(id);
    if (!obj || obj.completed) return false;

    obj.completed = true;
    this.currentScore += obj.score;

    AudioManager.playKeyCollect();
    this.hud.showBanner(`OBJECTIVE CLEARED: ${obj.title} (+${obj.score})`);

    // Check if this was a primary objective yielding a key
    if (obj.type === 'primary') {
      const keyIndex = obj.section;
      this.collectKey(keyIndex);
    }

    this.onStateChange?.('objective', obj);
    return true;
  }

  public collectKey(keyIndex: number): void {
    if (this.keysCollected.has(keyIndex)) return;
    this.keysCollected.add(keyIndex);

    AudioManager.playComponent3Collect();
    this.hud.setFailsafeFound(this.keysCollected.size, 5);

    // Apply Cross-Section Carry-Overs and clear guidance
    if (keyIndex === 1) {
      this.isS2HeatGateLowered = true;
      this.hud.showBanner('★ FROST RELIC (S1) SECURED! SEAM 1 UNLOCKED · PLACE AT S6 ALTAR 1');
    } else if (keyIndex === 2) {
      this.areS3BraziersIgnited = true;
      this.hud.showBanner('★ EMBER RELIC (S2) SECURED! SEAM 2 UNLOCKED · PLACE AT S6 ALTAR 2');
    } else if (keyIndex === 3) {
      this.hud.showBanner('★ ROYAL SIGIL (S3) SECURED! SEAM 3 UNLOCKED · PLACE AT S6 ALTAR 3');
    } else if (keyIndex === 4) {
      this.isS5TransceiverEnergized = true;
      this.hud.showBanner('★ CHRONO SEED (S4) SECURED! SEAM 4 UNLOCKED · PLACE AT S6 ALTAR 4');
    } else if (keyIndex === 5) {
      this.hud.showBanner('★ VOID SHARD (S5) SECURED! SEAM 5 UNLOCKED · PLACE AT S6 ALTAR 5');
    }

    this.onStateChange?.('key', keyIndex);
  }

  /**
   * Altar interaction in S6 Convergence Core.
   * Requires that the player collected the relic from the corresponding section (S1-S5).
   * Enforces forced sequential order: Altar 1 -> Altar 2 -> Altar 3 -> Altar 4 -> Altar 5.
   */
  public attemptFillSocket(socketNum: number): boolean {
    if (this.socketsFilled.has(socketNum)) return false;

    const RELIC_NAMES = [
      '',
      'FROST RELIC',
      'EMBER RELIC',
      'ROYAL SIGIL',
      'CHRONO SEED',
      'VOID SHARD'
    ];

    // Check if player collected the corresponding section relic
    if (!this.keysCollected.has(socketNum)) {
      AudioManager.playDroneStun();
      this.hud.showBanner(`ALTAR ${socketNum} EMPTY: YOU NEED THE ${RELIC_NAMES[socketNum]} FROM SECTION ${socketNum}!`);
      this.scene.cameras.main.shake(120, 0.006);
      return false;
    }

    const expected = this.socketsFilled.size + 1;
    if (socketNum !== expected) {
      // Wrong order attempt: visual spark & audio warning
      AudioManager.playDroneStun();
      this.hud.showBanner(`ALTAR ORDER: ACTIVATE ALTAR ${expected} BEFORE ALTAR ${socketNum}!`);
      this.scene.cameras.main.shake(150, 0.008);
      return false;
    }

    // Correct order & relic possessed: lock socket!
    this.socketsFilled.add(socketNum);
    const objId = `F${socketNum}`;
    this.completeObjective(objId);

    AudioManager.playAssembleFailsafe();
    this.hud.showBanner(`★ ALTAR ${socketNum}/5 ACTIVATED: ${RELIC_NAMES[socketNum]} PLACED!`);

    if (this.socketsFilled.size === 5) {
      this.hud.showBanner('🌟 ALL 5 RELICS PLACED! EXTRACTION RIFT UNSEALED — ENTER THE PORTAL!');
    }

    this.onStateChange?.('socket', socketNum);
    return true;
  }

  /**
   * Updates the Glitch Surge cycle with delta time (paused when scene is paused)
   */
  public updateSurge(delta: number, _player?: Phaser.GameObjects.Sprite): void {
    this.surgeTimer += delta;

    const { intervalMs, warningDurationMs, surgeDurationMs } = LEVEL6_CONFIG.surge;

    if (this.surgePhase === 'idle' && this.surgeTimer >= intervalMs - warningDurationMs) {
      this.surgePhase = 'warning';
      this.isSurgeWarning = true;
      AudioManager.playAlarm();
      this.hud.showBanner('WARNING: GLITCH SURGE ANOMALY DETECTED INCOMING!');
      this.onStateChange?.('surge', 'warning');
    } else if (this.surgePhase === 'warning' && this.surgeTimer >= intervalMs) {
      this.surgePhase = 'active';
      this.isSurgeWarning = false;
      this.isSurgeActive = true;

      AudioManager.playDroneStun();
      this.scene.cameras.main.flash(200, 255, 0, 128);
      this.scene.cameras.main.shake(250, 0.012);
      this.hud.showBanner('// GLITCH SURGE WAVE IMPACT //');
      this.onStateChange?.('surge', 'impact');
    } else if (this.surgePhase === 'active' && this.surgeTimer >= intervalMs + surgeDurationMs) {
      this.surgePhase = 'idle';
      this.isSurgeActive = false;
      this.surgeTimer = 0;
      this.onStateChange?.('surge', 'idle');
    }
  }

  public recordChargeUse(): void {
    this.abilityChargesUsed++;
  }

  public recordAlert(): void {
    this.alertCount++;
  }

  public recordSurgeHit(): void {
    this.surgeHits++;
  }

  /**
   * Computes the final score breakdown according to the spec
   */
  public calculateFinalScore(timeRemainingMs: number, attemptsRemaining: number): {
    totalScore: number;
    breakdown: {
      objectiveScore: number;
      timeBonus: number;
      attemptBonus: number;
      parBonus: number;
      noAlertBonus: number;
      surgePenalty: number;
    };
    rank: string;
  } {
    const sc = LEVEL6_CONFIG.scoring;
    const timeSec = Math.max(0, Math.floor(timeRemainingMs / 1000));
    const timeBonus = timeSec * sc.timeBonusPerSecond;
    const attemptBonus = attemptsRemaining * sc.attemptBonusRemaining;
    const parBonus = this.abilityChargesUsed <= sc.parChargeLimit ? sc.parEfficiencyBonus : 0;
    const noAlertBonus = this.alertCount === 0 ? sc.noAlertBonus : 0;
    const surgePenalty = this.surgeHits * sc.surgeHitPenalty;

    const totalScore = Math.max(
      1000,
      this.currentScore + timeBonus + attemptBonus + parBonus + noAlertBonus - surgePenalty
    );

    let rank = 'D';
    if (totalScore >= sc.ranks.S) rank = 'S';
    else if (totalScore >= sc.ranks.A) rank = 'A';
    else if (totalScore >= sc.ranks.B) rank = 'B';
    else if (totalScore >= sc.ranks.C) rank = 'C';

    return {
      totalScore,
      breakdown: {
        objectiveScore: this.currentScore,
        timeBonus,
        attemptBonus,
        parBonus,
        noAlertBonus,
        surgePenalty
      },
      rank
    };
  }
}
