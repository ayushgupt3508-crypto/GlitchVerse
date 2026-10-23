import { SaveSystem } from './SaveSystem';

/**
 * AudioManager — Procedural chiptune SFX using Web Audio API.
 * No audio files required. Volume reads from SaveSystem settings.
 */
export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static initialised = false;

  /** Must be called from a user gesture (click / keydown) to unlock AudioContext. */
  public static init(): void {
    if (this.initialised) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyVolume();
      this.initialised = true;
    } catch {
      console.warn('AudioManager: Web Audio API not available');
    }
  }

  public static applyVolume(): void {
    if (!this.masterGain) return;
    const settings = SaveSystem.getSettings();
    this.masterGain.gain.value = settings.sfxVolume * settings.masterVolume;
  }

  // ── Individual SFX ─────────────────────────────────────────────────────

  public static playJump(): void {
    this.playTone(440, 0.08, 'square', 880);
  }

  public static playLand(): void {
    this.playNoise(0.05, 800);
  }

  public static playStaffUse(): void {
    this.playTone(660, 0.12, 'sine', 1320);
    setTimeout(() => this.playTone(990, 0.08, 'sine'), 60);
  }

  public static playInsufficientCharge(): void {
    // Low double-buzz error tone
    this.playTone(180, 0.08, 'sawtooth');
    setTimeout(() => this.playTone(140, 0.12, 'sawtooth'), 90);
  }

  public static playCheckpoint(): void {
    this.playTone(523, 0.1, 'triangle');
    setTimeout(() => this.playTone(659, 0.1, 'triangle'), 100);
    setTimeout(() => this.playTone(784, 0.15, 'triangle'), 200);
  }

  public static playFailsafe(): void {
    this.playTone(523, 0.08, 'square');
    setTimeout(() => this.playTone(659, 0.08, 'square'), 80);
    setTimeout(() => this.playTone(784, 0.08, 'square'), 160);
    setTimeout(() => this.playTone(1047, 0.2, 'square'), 240);
  }

  public static playDeath(): void {
    this.playTone(220, 0.15, 'sawtooth', 55);
    setTimeout(() => this.playNoise(0.2, 400), 100);
  }

  public static playDroneAlert(): void {
    this.playTone(880, 0.06, 'square', 440);
    setTimeout(() => this.playTone(880, 0.06, 'square', 440), 80);
  }

  public static playDroneStun(): void {
    this.playTone(1200, 0.1, 'sine', 200);
  }

  public static playConduitRecharge(): void {
    this.playTone(330, 0.1, 'triangle', 660);
    setTimeout(() => this.playTone(440, 0.1, 'triangle', 880), 100);
  }

  public static playMenuHover(): void {
    this.playTone(600, 0.03, 'sine');
  }

  public static playMenuSelect(): void {
    this.playTone(800, 0.06, 'square');
  }

  // ── Level 3: Medieval Palace & Camouflage SFX ──────────────────────────

  public static playCamouflageActivate(): void {
    // Holographic phase-shift whoosh
    this.playTone(400, 0.25, 'sine', 1200);
    setTimeout(() => this.playTone(880, 0.18, 'triangle', 440), 80);
    setTimeout(() => this.playNoise(0.12, 1200), 40);
  }

  public static playCamouflageDeactivate(): void {
    // Decloak shimmer down
    this.playTone(880, 0.15, 'sine', 280);
    setTimeout(() => this.playNoise(0.08, 600), 50);
  }

  public static playDecoyDeploy(): void {
    // Holographic emitter spark
    this.playTone(660, 0.1, 'sawtooth', 330);
    setTimeout(() => this.playTone(1100, 0.12, 'square', 1400), 50);
  }

  public static playGuardAlert(): void {
    // Medieval horn / brass alert fanfare
    this.playTone(587, 0.12, 'sawtooth');
    setTimeout(() => this.playTone(880, 0.22, 'square'), 70);
  }

  public static playDoorUnlock(): void {
    // Heavy iron bolt slide + stone rumble
    this.playTone(220, 0.18, 'triangle', 110);
    setTimeout(() => this.playTone(440, 0.15, 'square'), 90);
    setTimeout(() => this.playNoise(0.25, 450), 120);
  }

  public static playKeyCollect(): void {
    // Gilded key sparkle chime
    this.playTone(880, 0.08, 'sine');
    setTimeout(() => this.playTone(1174, 0.08, 'sine'), 60);
    setTimeout(() => this.playTone(1568, 0.14, 'triangle'), 120);
  }

  public static playComponent3Collect(): void {
    // Grand royal fanfare + technological harmonic
    this.playTone(523, 0.12, 'triangle');
    setTimeout(() => this.playTone(659, 0.12, 'triangle'), 80);
    setTimeout(() => this.playTone(784, 0.14, 'triangle'), 160);
    setTimeout(() => this.playTone(1046, 0.25, 'square'), 240);
    setTimeout(() => this.playTone(1318, 0.35, 'sine'), 340);
  }

  // ── Level 4: Modern City & Electromagnetic SFX ─────────────────────────

  public static playEmpZap(): void {
    // High-voltage capacitor discharge
    this.playTone(1400, 0.1, 'sawtooth', 200);
    setTimeout(() => this.playNoise(0.12, 3500), 20);
    setTimeout(() => this.playTone(600, 0.15, 'sine', 120), 50);
  }

  public static playCircuitSwitch(): void {
    // Heavy industrial solenoid clack + current surge
    this.playTone(350, 0.05, 'square', 150);
    setTimeout(() => this.playTone(700, 0.08, 'sawtooth', 300), 40);
    setTimeout(() => this.playTone(1200, 0.1, 'sine', 800), 80);
  }

  // ── Level 4: Ancient Forest & Time Ability SFX ──────────────────────────

  public static playTimeRewind(): void {
    // Reverse temporal tape sweep & chronos harmonic
    this.playTone(330, 0.22, 'sine', 1320);
    setTimeout(() => this.playTone(880, 0.15, 'triangle', 440), 60);
    setTimeout(() => this.playNoise(0.12, 1400), 30);
  }

  public static playTimeFreeze(): void {
    // Crystalline stasis chime + temporal glass lock
    this.playTone(1046, 0.15, 'sine', 2093);
    setTimeout(() => this.playTone(1318, 0.2, 'triangle'), 50);
    setTimeout(() => this.playTone(523, 0.35, 'square', 261), 100);
  }

  public static playWoodCreak(): void {
    // Ancient wooden bridge groan / plank tension
    this.playTone(160, 0.08, 'sawtooth', 90);
    setTimeout(() => this.playNoise(0.06, 600), 40);
  }

  public static playStoneRumble(): void {
    // Heavy overgrown ruin / machinery gear grinding
    this.playTone(90, 0.25, 'triangle', 55);
    setTimeout(() => this.playNoise(0.2, 350), 60);
  }

  // ── Level 5: Futuristic City & Phasing SFX ─────────────────────────────

  public static playPhaseShift(): void {
    // Dimensional frequency warp & resonant phase sweep
    this.playTone(300, 0.22, 'sine', 1800);
    setTimeout(() => this.playTone(1800, 0.18, 'triangle', 450), 70);
    setTimeout(() => this.playNoise(0.15, 1800), 40);
  }

  public static playAlarm(): void {
    // Emergency evacuation red alert klaxon
    this.playTone(880, 0.18, 'sawtooth', 587);
    setTimeout(() => this.playTone(880, 0.18, 'sawtooth', 587), 220);
  }

  public static playAssembleFailsafe(): void {
    // Complete 5-crystal harmonic lock
    const notes = [440, 554, 659, 880, 1108, 1318];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.3, 'sine'), idx * 90);
    });
  }

  public static playVictory(): void {
    // Triumphant orchestral chiptune victory theme
    const fanfare = [
      { f: 523, d: 0.14 },
      { f: 659, d: 0.14 },
      { f: 784, d: 0.18 },
      { f: 1046, d: 0.35 },
      { f: 880, d: 0.14 },
      { f: 1046, d: 0.5 }
    ];
    let offset = 0;
    fanfare.forEach(note => {
      setTimeout(() => this.playTone(note.f, note.d, 'triangle'), offset);
      offset += note.d * 1000 + 40;
    });
  }

  // ── Core synthesis helpers ─────────────────────────────────────────────

  private static playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    freqEnd?: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  private static playNoise(duration: number, cutoff = 2000): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }
}
