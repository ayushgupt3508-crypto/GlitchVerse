import { SaveSystem } from './SaveSystem';
import { LevelSoundtracks } from './LevelSoundtracks';

export type MusicTrack = 'none' | 'matrix' | 'story' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

/**
 * AudioManager — Procedural Matrix Cyberpunk & Calming Story Soundtracks + Chiptune SFX using Web Audio API.
 * No external audio files required. Full real-time volume controls mapped to SaveSystem settings.
 */
export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;
  private static musicGain: GainNode | null = null;
  private static musicDuckGain: GainNode | null = null;
  private static musicFilter: BiquadFilterNode | null = null;
  private static initialised = false;
  private static isMusicPlaying = false;
  private static currentTrack: MusicTrack = 'none';
  private static musicSchedulerId: number | null = null;
  private static nextNoteTime = 0;
  private static current16thStep = 0;
  private static storyStep = 0;
  private static levelStep = 0;

  // ── Initialization & Audio Graph ──────────────────────────────────────

  /** Unlocks and builds Web Audio graph on user gesture (click / keydown / touch). */
  public static init(): void {
    if (this.initialised) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Master Gain -> Destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // SFX Gain -> Master Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      // Music Gain -> Master Gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);

      // Music Duck Gain -> Music Gain (for pause / modal ducking)
      this.musicDuckGain = this.ctx.createGain();
      this.musicDuckGain.gain.value = 1.0;
      this.musicDuckGain.connect(this.musicGain);

      // Music Master Filter -> Music Duck Gain (lowpass resonant filter)
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.musicFilter.Q.value = 1.0;
      this.musicFilter.connect(this.musicDuckGain);

      this.applyVolume();
      this.initialised = true;

      // Auto-unlock listener for browser autoplay restrictions
      const unlockAndPlay = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            if (!this.isMusicPlaying) {
              this.resumeCurrentTrack();
            }
          }).catch(() => {});
        } else if (!this.isMusicPlaying) {
          this.resumeCurrentTrack();
        }
      };

      window.addEventListener('pointerdown', unlockAndPlay, { once: true });
      window.addEventListener('keydown', unlockAndPlay, { once: true });

      if (this.ctx.state === 'running' && !this.isMusicPlaying) {
        this.resumeCurrentTrack();
      }
    } catch {
      console.warn('AudioManager: Web Audio API not available');
    }
  }

  /** Dynamically applies Master, Music, and SFX volumes from SaveSystem settings without clicks. */
  public static applyVolume(): void {
    if (!this.ctx) return;
    const settings = SaveSystem.getSettings();
    const now = this.ctx.currentTime;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(settings.masterVolume, now, 0.03);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.03);
    }
    if (this.musicGain) {
      // 0.32 scale factor delivers balanced mix for both matrix and story music
      const targetMusic = settings.musicVolume * 0.32;
      this.musicGain.gain.setTargetAtTime(targetMusic, now, 0.03);
    }
  }

  /** Smoothly ducks and lowpass-muffles music during pause menu or modals. */
  public static setMusicDucked(ducked: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.musicDuckGain) {
      const targetGain = ducked ? 0.32 : 1.0;
      this.musicDuckGain.gain.setTargetAtTime(targetGain, now, 0.08);
    }
    if (this.musicFilter) {
      const targetFreq = ducked ? 650 : (this.currentTrack === 'story' ? 14000 : 18000);
      const targetQ = ducked ? 2.8 : 1.0;
      this.musicFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.musicFilter.Q.setTargetAtTime(targetQ, now, 0.08);
    }
  }

  // ── Music Track Management ─────────────────────────────────────────────

  /** Starts the continuous Matrix / Glitchverse cyberpunk soundtrack. */
  public static startMatrixMusic(): void {
    if (this.currentTrack === 'matrix' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.currentTrack = 'matrix';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.current16thStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(18000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
    }
    if (this.musicDuckGain) {
      this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    this.musicSchedulerId = window.setInterval(() => {
      this.matrixMusicScheduler();
    }, 25);
  }

  /** Starts the calm, soothing storytime loading ambient music. */
  public static startStoryMusic(): void {
    if (this.currentTrack === 'story' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.currentTrack = 'story';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.storyStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(14000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
    }
    if (this.musicDuckGain) {
      this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    this.musicSchedulerId = window.setInterval(() => {
      this.storyMusicScheduler();
    }, 25);
  }

  /** Starts Level 1: Frozen Age (Cryo-Glitch) — 120 BPM chiptune & crystalline bells. */
  public static startLevel1Music(): void {
    if (this.currentTrack === 'level1' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    this.currentTrack = 'level1';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.levelStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(14000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
    }
    if (this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const bpm = 120;
    const stepDuration = 60 / (bpm * 4);
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'level1' || !this.musicFilter) return;
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
        LevelSoundtracks.scheduleLevel1Step(this.ctx, this.musicFilter, this.levelStep, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.levelStep = (this.levelStep + 1) % 64;
      }
    }, 25);
  }

  /** Starts Level 2: Heat Age (Volcanic Forge) — 132 BPM industrial kicks, anvil strikes & searing saw bass. */
  public static startLevel2Music(): void {
    if (this.currentTrack === 'level2' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    this.currentTrack = 'level2';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.levelStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(16000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);
    }
    if (this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const bpm = 132;
    const stepDuration = 60 / (bpm * 4);
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'level2' || !this.musicFilter) return;
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
        LevelSoundtracks.scheduleLevel2Step(this.ctx, this.musicFilter, this.levelStep, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.levelStep = (this.levelStep + 1) % 64;
      }
    }, 25);
  }

  /** Starts Level 3: Medieval Palace (Royal Infiltration) — 106 BPM lute plucks, flute & court tambourine. */
  public static startLevel3Music(): void {
    if (this.currentTrack === 'level3' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    this.currentTrack = 'level3';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.levelStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(11000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.1, this.ctx.currentTime);
    }
    if (this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const bpm = 106;
    const stepDuration = 60 / (bpm * 2);
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'level3' || !this.musicFilter) return;
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
        LevelSoundtracks.scheduleLevel3Step(this.ctx, this.musicFilter, this.levelStep, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.levelStep = (this.levelStep + 1) % 64;
      }
    }, 25);
  }

  /** Starts Level 4: Ancient Forest (Elder Grove) — 92 BPM pan-flute, wooden marimba & dewdrop bells. */
  public static startLevel4Music(): void {
    if (this.currentTrack === 'level4' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    this.currentTrack = 'level4';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.levelStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(9500, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(0.9, this.ctx.currentTime);
    }
    if (this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const bpm = 92;
    const stepDuration = 60 / (bpm * 2);
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'level4' || !this.musicFilter) return;
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        LevelSoundtracks.scheduleLevel4Step(this.ctx, this.musicFilter, this.levelStep, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.levelStep = (this.levelStep + 1) % 64;
      }
    }, 25);
  }

  /** Starts Level 5: Futuristic Core (Quantum Singularity) — 140 BPM rolling acid 303 & laser stabs. */
  public static startLevel5Music(): void {
    if (this.currentTrack === 'level5' && this.isMusicPlaying) return;
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    this.currentTrack = 'level5';
    this.isMusicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.levelStep = 0;

    if (this.musicFilter) {
      this.musicFilter.frequency.setValueAtTime(18000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);
    }
    if (this.musicDuckGain) this.musicDuckGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const bpm = 140;
    const stepDuration = 60 / (bpm * 4);
    this.musicSchedulerId = window.setInterval(() => {
      if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'level5' || !this.musicFilter) return;
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
        LevelSoundtracks.scheduleLevel5Step(this.ctx, this.musicFilter, this.levelStep, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.levelStep = (this.levelStep + 1) % 64;
      }
    }, 25);
  }

  /**
   * Universal level soundtrack selector: plays the specific procedural theme for the given level.
   *  1 / 'level1' / 'GameScene': Frozen Age
   *  2 / 'level2' / 'Sector2Scene': Heat Age
   *  3 / 'level3' / 'Level3Scene': Medieval Palace
   *  4 / 'level4' / 'Level4Scene': Ancient Forest
   *  5 / 'level5' / 'Level5Scene': Futuristic Core
   */
  public static playLevelMusic(level: number | string): void {
    const key = String(level).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key === '1' || key === 'level1' || key === 'gamescene' || key === 'frozenage') {
      this.startLevel1Music();
    } else if (key === '2' || key === 'level2' || key === 'sector2scene' || key === 'heatage') {
      this.startLevel2Music();
    } else if (key === '3' || key === 'level3' || key === 'level3scene' || key === 'medievalpalace') {
      this.startLevel3Music();
    } else if (key === '4' || key === 'level4' || key === 'level4scene' || key === 'ancientforest') {
      this.startLevel4Music();
    } else if (key === '5' || key === 'level5' || key === 'level5scene' || key === 'futuristiccore') {
      this.startLevel5Music();
    } else if (key === 'story' || key === 'storyscene') {
      this.startStoryMusic();
    } else {
      this.startMatrixMusic();
    }
  }

  /** Resumes the active music track upon browser audio unlock. */
  private static resumeCurrentTrack(): void {
    switch (this.currentTrack) {
      case 'level1': this.startLevel1Music(); break;
      case 'level2': this.startLevel2Music(); break;
      case 'level3': this.startLevel3Music(); break;
      case 'level4': this.startLevel4Music(); break;
      case 'level5': this.startLevel5Music(); break;
      case 'story': this.startStoryMusic(); break;
      case 'matrix':
      default:
        this.startMatrixMusic();
        break;
    }
  }

  /** Stops any currently playing music. */
  public static stopMusic(): void {
    if (this.musicSchedulerId !== null) {
      window.clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = null;
    }
    this.isMusicPlaying = false;
    this.currentTrack = 'none';
  }

  /** Returns which music track is currently active. */
  public static getCurrentTrack(): MusicTrack {
    return this.currentTrack;
  }

  /** Checks if soundtrack is currently active. */
  public static getIsMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  // ── Matrix Soundtrack Scheduler (126 BPM) ──────────────────────────────

  private static matrixMusicScheduler(): void {
    if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'matrix') return;

    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }

    const scheduleAheadTime = 0.12;
    const bpm = 126;
    const stepDuration = 60 / (bpm * 4); // ~0.119s per 16th note

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleMatrixStep(this.current16thStep, this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.current16thStep = (this.current16thStep + 1) % 128; // 8-bar loop
    }
  }

  private static scheduleMatrixStep(step: number, time: number, stepDuration: number): void {
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Cyber Kick Drum
    const isKick =
      stepInBar === 0 ||
      stepInBar === 4 ||
      stepInBar === 8 ||
      stepInBar === 12 ||
      (stepInBar === 14 && (bar === 1 || bar === 3 || bar === 5)) ||
      (stepInBar === 10 && (bar === 4 || bar === 6));

    if (isKick && !(bar === 7 && stepInBar >= 12)) {
      this.synthesizeKick(time, stepInBar === 0);
    }

    // 2. Cyber Snare / Noise Clap
    const isSnare = stepInBar === 4 || stepInBar === 12;
    const isGhostSnare = (bar === 3 || bar === 5) && stepInBar === 15;
    if ((isSnare || isGhostSnare) && !(bar === 7 && stepInBar >= 12)) {
      this.synthesizeSnare(time, isGhostSnare);
    }

    // 3. Cyber Hi-Hats
    const isClosedHat = stepInBar % 2 === 0;
    const isOpenHat = stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;
    if (!(bar === 7 && stepInBar >= 12)) {
      if (isOpenHat) {
        this.synthesizeHiHat(time, true);
      } else if (isClosedHat) {
        this.synthesizeHiHat(time, false);
      }
    }

    // 4. Matrix TB-303 Acid Bassline
    const bassNote = MATRIX_BASS_PATTERN[step];
    if (bassNote && bassNote[0] > 0) {
      this.synthesizeAcidBass(time, bassNote[0], bassNote[1], stepDuration);
    }

    // 5. Matrix Code Cascade (Arpeggiator)
    const arpNote = MATRIX_ARP_PATTERN[step];
    if (arpNote && arpNote[0] > 0) {
      this.synthesizeArp(time, arpNote[0], arpNote[1], stepDuration);
    }

    // 6. Atmospheric Drone Pad Chords (every bar)
    if (stepInBar === 0) {
      const chord = MATRIX_PAD_CHORDS[bar];
      if (chord) {
        this.synthesizePadChord(time, chord, stepDuration * 15.5);
      }
    }

    // 7. Glitch Artifacts & Data Stutter
    if (step === 31 || step === 62 || step === 63 || step === 95 || step === 124 || step === 125 || step === 126 || step === 127) {
      this.synthesizeGlitchArtifact(time, step >= 124);
    }
  }

  // ── Calm & Soothing Story Soundtrack Scheduler (70 BPM) ─────────────────

  private static storyMusicScheduler(): void {
    if (!this.ctx || !this.isMusicPlaying || this.currentTrack !== 'story') return;

    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }

    const scheduleAheadTime = 0.15;
    const bpm = 70;
    const stepDuration = 60 / (bpm * 2); // ~0.4286s per 8th note

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStoryStep(this.storyStep, this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.storyStep = (this.storyStep + 1) % 64; // 8-bar loop
    }
  }

  private static scheduleStoryStep(step: number, time: number, stepDuration: number): void {
    const stepInBar = step % 8;
    const bar = Math.floor(step / 8);

    // 1. Warm Ethereal Pad & Deep Soft Sub Bass (downbeat of each bar)
    if (stepInBar === 0) {
      const chord = STORY_PAD_CHORDS[bar];
      if (chord) {
        this.synthesizeStoryPad(time, chord, stepDuration * 7.8);
      }
      const bassNote = STORY_BASS_NOTES[bar];
      if (bassNote) {
        this.synthesizeStorySubBass(time, bassNote, stepDuration * 7.5);
      }
    }

    // 2. Crystalline Music-Box Celesta Melody
    const melodyNote = STORY_MELODY_PATTERN[step];
    if (melodyNote && melodyNote > 0) {
      this.synthesizeStoryMelody(time, melodyNote, stepDuration * 1.8);
    }

    // 3. Stardust Shimmer Sparkles
    const shimmerNote = STORY_SHIMMER_PATTERN[step];
    if (shimmerNote && shimmerNote > 0) {
      this.synthesizeStoryShimmer(time, shimmerNote);
    }
  }

  // ── Matrix Synth Voices ────────────────────────────────────────────────

  private static synthesizeAcidBass(time: number, freq: number, accent: boolean, duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(accent ? 6.5 : 4.0, time);
    filter.frequency.setValueAtTime(accent ? 1600 : 850, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration * 0.85);

    const amp = accent ? 0.32 : 0.22;
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + duration);
  }

  private static synthesizeArp(time: number, freq: number, isGlitch: boolean, duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    if (isGlitch) {
      osc.frequency.setValueAtTime(freq * 1.45, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, time + duration * 0.8);
    } else {
      osc.frequency.setValueAtTime(freq, time);
    }

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.Q.setValueAtTime(2.2, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + duration);
  }

  private static synthesizeKick(time: number, accent: boolean): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 150 : 130, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.08);

    gain.gain.setValueAtTime(accent ? 0.45 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + 0.16);

    // Punchy transient click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(380, time);
    clickOsc.frequency.linearRampToValueAtTime(60, time + 0.012);
    clickGain.gain.setValueAtTime(0.15, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

    clickOsc.connect(clickGain);
    clickGain.connect(this.musicFilter);
    clickOsc.start(time);
    clickOsc.stop(time + 0.012);
  }

  private static synthesizeSnare(time: number, isGhost = false): void {
    if (!this.ctx || !this.musicFilter) return;
    const dur = isGhost ? 0.06 : 0.13;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, time);
    filter.Q.setValueAtTime(1.4, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isGhost ? 0.09 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    noise.start(time);

    // Low tone body
    if (!isGhost) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(185, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.06);
      oscGain.gain.setValueAtTime(0.18, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

      osc.connect(oscGain);
      oscGain.connect(this.musicFilter);
      osc.start(time);
      osc.stop(time + 0.06);
    }
  }

  private static synthesizeHiHat(time: number, open: boolean): void {
    if (!this.ctx || !this.musicFilter) return;
    const dur = open ? 0.14 : 0.038;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.13 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    noise.start(time);
  }

  private static synthesizePadChord(time: number, chord: number[], duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    chord.forEach((freq) => {
      if (!this.ctx || !this.musicFilter) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 0.998, time);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.003, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(460, time);
      filter.Q.setValueAtTime(1.6, time);

      // Smooth atmospheric envelope
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.045, time + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicFilter);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    });
  }

  private static synthesizeGlitchArtifact(time: number, isBreakdown: boolean): void {
    if (!this.ctx || !this.musicFilter) return;
    const dur = isBreakdown ? 0.09 : 0.045;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const startFreq = isBreakdown ? 2400 : 600;
    const endFreq = isBreakdown ? 180 : 3200;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.linearRampToValueAtTime(endFreq, time + dur);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(7.0, time);

    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + dur);
  }

  // ── Story Ambient Synth Voices ─────────────────────────────────────────

  private static synthesizeStoryPad(time: number, chord: number[], duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    chord.forEach((freq) => {
      if (!this.ctx || !this.musicFilter) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq * 0.999, time);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.002, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, time);
      filter.Q.setValueAtTime(0.8, time);

      // Gentle breathing envelope
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.038, time + 0.8);
      gain.gain.setValueAtTime(0.038, time + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicFilter);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    });
  }

  private static synthesizeStoryMelody(time: number, freq: number, duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const bellHarmonic = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    bellHarmonic.type = 'triangle';
    bellHarmonic.frequency.setValueAtTime(freq * 2, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.Q.setValueAtTime(0.9, time);

    // Delicate music-box / celesta felt-hammer attack & release
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.12, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    bellHarmonic.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    bellHarmonic.start(time);
    osc.stop(time + duration);
    bellHarmonic.stop(time + duration);
  }

  private static synthesizeStorySubBass(time: number, freq: number, duration: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + duration);
  }

  private static synthesizeStoryShimmer(time: number, freq: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.045, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    osc.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    osc.stop(time + 0.6);
  }

  // ── Existing SFX Methods (Preserved 100% and routed through SFX Gain) ──

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

  // ── Level 3 SFX ──

  public static playCamouflageActivate(): void {
    this.playTone(400, 0.25, 'sine', 1200);
    setTimeout(() => this.playTone(880, 0.18, 'triangle', 440), 80);
    setTimeout(() => this.playNoise(0.12, 1200), 40);
  }

  public static playCamouflageDeactivate(): void {
    this.playTone(880, 0.15, 'sine', 280);
    setTimeout(() => this.playNoise(0.08, 600), 50);
  }

  public static playDecoyDeploy(): void {
    this.playTone(660, 0.1, 'sawtooth', 330);
    setTimeout(() => this.playTone(1100, 0.12, 'square', 1400), 50);
  }

  public static playGuardAlert(): void {
    this.playTone(587, 0.12, 'sawtooth');
    setTimeout(() => this.playTone(880, 0.22, 'square'), 70);
  }

  public static playDoorUnlock(): void {
    this.playTone(220, 0.18, 'triangle', 110);
    setTimeout(() => this.playTone(440, 0.15, 'square'), 90);
    setTimeout(() => this.playNoise(0.25, 450), 120);
  }

  public static playKeyCollect(): void {
    this.playTone(880, 0.08, 'sine');
    setTimeout(() => this.playTone(1174, 0.08, 'sine'), 60);
    setTimeout(() => this.playTone(1568, 0.14, 'triangle'), 120);
  }

  public static playComponent3Collect(): void {
    this.playTone(523, 0.12, 'triangle');
    setTimeout(() => this.playTone(659, 0.12, 'triangle'), 80);
    setTimeout(() => this.playTone(784, 0.14, 'triangle'), 160);
    setTimeout(() => this.playTone(1046, 0.25, 'square'), 240);
    setTimeout(() => this.playTone(1318, 0.35, 'sine'), 340);
  }

  // ── Level 4 SFX ──

  public static playEmpZap(): void {
    this.playTone(1400, 0.1, 'sawtooth', 200);
    setTimeout(() => this.playNoise(0.12, 3500), 20);
    setTimeout(() => this.playTone(600, 0.15, 'sine', 120), 50);
  }

  public static playCircuitSwitch(): void {
    this.playTone(350, 0.05, 'square', 150);
    setTimeout(() => this.playTone(700, 0.08, 'sawtooth', 300), 40);
    setTimeout(() => this.playTone(1200, 0.1, 'sine', 800), 80);
  }

  public static playTimeRewind(): void {
    this.playTone(330, 0.22, 'sine', 1320);
    setTimeout(() => this.playTone(880, 0.15, 'triangle', 440), 60);
    setTimeout(() => this.playNoise(0.12, 1400), 30);
  }

  public static playTimeFreeze(): void {
    this.playTone(1046, 0.15, 'sine', 2093);
    setTimeout(() => this.playTone(1318, 0.2, 'triangle'), 50);
    setTimeout(() => this.playTone(523, 0.35, 'square', 261), 100);
  }

  public static playWoodCreak(): void {
    this.playTone(160, 0.08, 'sawtooth', 90);
    setTimeout(() => this.playNoise(0.06, 600), 40);
  }

  public static playStoneRumble(): void {
    this.playTone(90, 0.25, 'triangle', 55);
    setTimeout(() => this.playNoise(0.2, 350), 60);
  }

  // ── Level 5 SFX ──

  public static playPhaseShift(): void {
    this.playTone(300, 0.22, 'sine', 1800);
    setTimeout(() => this.playTone(1800, 0.18, 'triangle', 450), 70);
    setTimeout(() => this.playNoise(0.15, 1800), 40);
  }

  public static playAlarm(): void {
    this.playTone(880, 0.18, 'sawtooth', 587);
    setTimeout(() => this.playTone(880, 0.18, 'sawtooth', 587), 220);
  }

  public static playAssembleFailsafe(): void {
    const notes = [440, 554, 659, 880, 1108, 1318];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.3, 'sine'), idx * 90);
    });
  }

  public static playVictory(): void {
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

  // ── Core Tone & Noise Synthesis Helpers (SFX) ──────────────────────────

  private static playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    freqEnd?: number
  ): void {
    if (!this.ctx) return;
    const dest = this.sfxGain || this.masterGain;
    if (!dest) return;

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
    gain.connect(dest);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  private static playNoise(duration: number, cutoff = 2000): void {
    if (!this.ctx) return;
    const dest = this.sfxGain || this.masterGain;
    if (!dest) return;

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
    gain.connect(dest);
    source.start();
  }
}

// ── Matrix Soundtrack Frequencies & Patterns ─────────────────────────────

const C2 = 65.41;
const D2 = 73.42, Eb2 = 77.78, F2 = 87.31, G2 = 98.00, Ab2 = 103.83, A2 = 110.00, Bb2 = 116.54, C3 = 130.81;
const D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, Ab3 = 207.65, A3 = 220.00, C4 = 261.63;
const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, Ab4 = 415.30, A4 = 440.00, Bb4 = 466.16, C5 = 523.25;
const D5 = 587.33, Eb5 = 622.25, F5 = 698.46, G5 = 783.99, A5 = 880.00;

// [Frequency, isAccented]
const MATRIX_BASS_PATTERN: Array<[number, boolean]> = [
  // Bar 0: Driving D2 groove
  [D2, true], [D2, false], [D3, false], [D2, false],
  [D2, true], [F2, false], [D2, false], [G2, false],
  [D2, true], [D2, false], [Ab2, false], [G2, false],
  [F2, true], [D2, false], [C2, false], [D2, false],

  // Bar 1: Octave energy
  [D2, true], [D2, false], [D3, false], [D2, false],
  [F2, true], [D2, false], [G2, false], [D2, false],
  [A2, true], [D2, false], [C3, false], [D2, false],
  [D3, true], [C3, false], [A2, false], [G2, false],

  // Bar 2: Modulation to Bb / C
  [Bb2, true], [Bb2, false], [F2, false], [Bb2, false],
  [Bb2, true], [D2, false], [F2, false], [Bb2, false],
  [C3, true], [C3, false], [G2, false], [C3, false],
  [C3, true], [E3, false], [G2, false], [C3, false],

  // Bar 3: Tension build (D -> Eb -> Ab)
  [D2, true], [D2, false], [D3, false], [D2, false],
  [Eb2, true], [Eb2, false], [Bb2, false], [Eb2, false],
  [D2, true], [D2, false], [A2, false], [Ab2, false],
  [G2, true], [F2, false], [Eb2, false], [C2, false],

  // Bar 4: Resonant acid drive
  [D2, true], [D3, false], [D2, false], [D3, true],
  [F2, false], [D2, false], [G2, true], [Ab2, false],
  [D2, true], [D3, false], [D2, false], [D3, true],
  [A2, false], [G2, false], [F2, true], [D2, false],

  // Bar 5: Syncopated cyber funk
  [D2, true], [D2, false], [F2, false], [G2, true],
  [Ab2, false], [G2, false], [F2, true], [D2, false],
  [C2, true], [D2, false], [Eb2, false], [D2, true],
  [F2, false], [G2, false], [A2, true], [C3, false],

  // Bar 6: Heavy chromatic descent
  [Bb2, true], [D2, false], [F2, false], [Bb2, true],
  [A2, true], [C3, false], [E3, false], [A2, true],
  [G2, true], [Bb2, false], [D2, false], [G2, true],
  [Ab2, true], [C3, false], [Eb2, false], [Ab2, true],

  // Bar 7: Stutter breakdown into drop
  [D2, true], [D2, false], [D3, false], [D2, true],
  [D2, true], [D3, false], [D2, false], [D3, true],
  [D2, true], [0, false], [D2, true], [0, false],
  [D2, true], [D2, false], [0, false], [0, false],
];

// [Frequency, isGlitch] (0 = rest)
const MATRIX_ARP_PATTERN: Array<[number, boolean]> = [
  // Bar 0: Falling glyphs
  [D4, false], [0, false], [A4, false], [0, false],
  [F4, false], [0, false], [D5, false], [0, false],
  [C5, false], [0, false], [A4, false], [0, false],
  [F4, false], [G4, false], [A4, false], [0, false],

  // Bar 1: Cascading data stream
  [D4, false], [F4, false], [A4, false], [D5, false],
  [C5, false], [A4, false], [G4, false], [F4, false],
  [Ab4, false], [G4, false], [F4, false], [D4, false],
  [C4, false], [D4, false], [F4, false], [A4, false],

  // Bar 2: Harmonic response
  [Bb4, false], [0, false], [D5, false], [0, false],
  [F5, false], [0, false], [D5, false], [0, false],
  [C5, false], [0, false], [G4, false], [0, false],
  [E4, false], [0, false], [C5, false], [0, false],

  // Bar 3: Cyber blues run
  [D5, false], [C5, false], [A4, false], [F4, false],
  [G4, false], [Ab4, false], [A4, false], [C5, false],
  [D5, false], [Eb5, false], [D5, false], [C5, false],
  [A4, false], [G4, false], [F4, false], [D4, false],

  // Bar 4: High velocity falling rain
  [D5, false], [A4, false], [F4, false], [D4, false],
  [C5, false], [G4, false], [E4, false], [C4, false],
  [D5, false], [F5, false], [D5, false], [A4, false],
  [C5, false], [D5, false], [Eb5, false], [D5, false],

  // Bar 5: Resonant stabs
  [F5, false], [0, false], [D5, false], [0, false],
  [Ab4, false], [0, false], [G4, false], [0, false],
  [F4, false], [0, false], [D4, false], [0, false],
  [C4, false], [D4, false], [F4, false], [G4, false],

  // Bar 6: Peak melodic tension
  [F5, false], [D5, false], [C5, false], [A4, false],
  [G4, false], [Ab4, false], [A4, false], [C5, false],
  [D5, false], [F5, false], [G5, false], [A5, false],
  [G5, false], [F5, false], [Eb5, false], [C5, false],

  // Bar 7: Glitch breakdown
  [D5, false], [0, false], [D5, false], [0, false],
  [C5, true], [0, false], [A4, true], [0, false],
  [Ab4, true], [G4, true], [F4, true], [D4, true],
  [C4, true], [0, false], [0, false], [0, false],
];

// Harmonic atmospheric pad chords (1 chord per bar)
const MATRIX_PAD_CHORDS: number[][] = [
  [D3, F3, A3],         // Bar 0: Dm
  [D3, G3, A3],         // Bar 1: Dsus4
  [Bb2, D3, F3],        // Bar 2: Bb
  [C3, E3, G3],         // Bar 3: C
  [D3, F3, A3],         // Bar 4: Dm
  [D3, Ab3, C4],        // Bar 5: Ddim (Matrix cyber tension)
  [Bb2, D3, F3, A3],    // Bar 6: Bbmaj7
  [A3, C4, E4, G4],     // Bar 7: A7 -> resolves to Dm
];

// ── Story Time Calm & Soothing Soundtrack Frequencies & Patterns ─────────

const F1 = 43.65, G1 = 49.00, A1 = 55.00;
const E2 = 82.41;
const B3 = 246.94;
const B4 = 493.88;
const E5 = 659.25;
const B5 = 987.77, C6 = 1046.50, D6 = 1174.66, E6 = 1318.51;

// Pad chords (1 chord per 8-step bar)
const STORY_PAD_CHORDS: number[][] = [
  [C3, G3, D4, E4],      // Bar 0: Cadd9
  [E3, B3, D4, G4],      // Bar 1: Em7
  [A2, E3, G3, C4],      // Bar 2: Am7
  [F2, C3, E3, A3],      // Bar 3: Fmaj7
  [G2, D3, G3, B3],      // Bar 4: G
  [A2, E3, C4, E4],      // Bar 5: Am
  [F2, C3, E3, B3],      // Bar 6: Fmaj7(#11) (Celestial Lydian)
  [G2, D3, G3, C4],      // Bar 7: Gsus4 -> peaceful resolution
];

// Deep warm sub-bass roots (1 note per bar)
const STORY_BASS_NOTES: number[] = [
  C2,  // Bar 0: C
  E2,  // Bar 1: E
  A1,  // Bar 2: A
  F1,  // Bar 3: F
  G1,  // Bar 4: G
  A1,  // Bar 5: A
  F1,  // Bar 6: F
  G1,  // Bar 7: G
];

// Delicate celestial music-box melody (64 steps)
const STORY_MELODY_PATTERN: number[] = [
  // Bar 0: Gentle opening
  G4, 0, E4, 0, D4, 0, C4, 0,
  // Bar 1: Rising wonder
  B3, 0, D4, 0, G4, 0, B4, 0,
  // Bar 2: Emotional reflection
  C5, 0, B4, 0, A4, 0, G4, 0,
  // Bar 3: Hopeful response
  E4, 0, G4, 0, A4, 0, C5, 0,
  // Bar 4: Melodic descent
  D5, 0, C5, 0, B4, 0, G4, 0,
  // Bar 5: Reaching higher
  A4, 0, C5, 0, E5, 0, D5, 0,
  // Bar 6: Lydian shimmer
  C5, 0, B4, 0, A4, 0, F4, 0,
  // Bar 7: Peaceful cadence into loop
  G4, 0, D4, 0, E4, 0, D4, 0,
];

// Sparkle shimmer accents (64 steps, 0 = silent)
const STORY_SHIMMER_PATTERN: number[] = [
  0, 0, 0, 0, 0, 0, G5, 0,
  0, 0, 0, 0, 0, 0, E5, 0,
  0, 0, 0, 0, 0, 0, B5, 0,
  0, 0, 0, 0, 0, 0, C6, 0,
  0, 0, 0, 0, 0, 0, D6, 0,
  0, 0, 0, 0, 0, 0, G5, 0,
  0, 0, 0, 0, 0, 0, E6, 0,
  0, 0, 0, 0, 0, 0, D5, 0,
];
