/**
 * LevelSoundtracks — Procedural procedural soundtracks for each sector theme in Project Z / GlitchVerse:
 *  - Level 1: Frozen Age (Cryo-Glitch) — 120 BPM, Crystalline frost bells, glacial sub-bass, cold pads
 *  - Level 2: Heat Age (Volcanic Forge) — 132 BPM, Heavy industrial kicks, anvil strikes, searing saw bass & flame lead
 *  - Level 3: Medieval Palace (Royal Infiltration) — 106 BPM, Plucked lute arpeggios, court flute, stealth bodhrán & tambourine
 *  - Level 4: Ancient Forest (Elder Grove) — 92 BPM, Breathy pan-flute, wooden marimba, dewdrop bells, lush blooming chords
 *  - Level 5: Futuristic Core (Quantum Singularity) — 140 BPM, Relentless rolling 303 acid bass, quantum arps, cyber laser stabs
 *
 * All audio generated in real time using the Web Audio API — zero external sound files required.
 */

// ── Common Equal-Temperament Note Frequencies (Hz) ──────────────────────────
const E1 = 41.20, G1 = 49.00, B1 = 61.74;
const C2 = 65.41, Cs2 = 69.30, D2 = 73.42, Eb2 = 77.78, E2 = 82.41, F2 = 87.31, Fs2 = 92.50, G2 = 98.00, Gs2 = 103.83, Ab2 = 103.83, A2 = 110.00, Bb2 = 116.54, B2 = 123.47;
const C3 = 130.81, Cs3 = 138.59, D3 = 146.83, E3 = 164.81, F3 = 174.61, Fs3 = 185.00, G3 = 196.00, Gs3 = 207.65, A3 = 220.00, B3 = 246.94;
const C4 = 261.63, Cs4 = 277.18, D4 = 293.66, E4 = 329.63, F4 = 349.23, Fs4 = 369.99, G4 = 392.00, Gs4 = 415.30, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, Cs5 = 554.37, D5 = 587.33, E5 = 659.25, F5 = 698.46, Fs5 = 739.99, G5 = 783.99, Gs5 = 830.61, A5 = 880.00, Bb5 = 932.33, B5 = 987.77;
const C6 = 1046.50, Cs6 = 1108.73, D6 = 1174.66, E6 = 1318.51, F6 = 1396.91;

export class LevelSoundtracks {
  // ──────────────────────────────────────────────────────────────────────────
  // LEVEL 1: FROZEN AGE (120 BPM · Cryo-Glitch)
  // ──────────────────────────────────────────────────────────────────────────

  public static scheduleLevel1Step(
    ctx: AudioContext,
    dest: AudioNode,
    step: number,
    time: number,
    stepDuration: number
  ): void {
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Cold Sub Kick
    if (stepInBar === 0 || stepInBar === 8 || (stepInBar === 14 && (bar === 1 || bar === 3))) {
      this.synthFrostKick(ctx, dest, time);
    }

    // 2. Ice Crack Hi-Hats
    if (stepInBar % 2 === 0) {
      this.synthIceCrackHat(ctx, dest, time, stepInBar === 4 || stepInBar === 12);
    }

    // 3. Glacial Sub Bass
    const bassFreq = L1_BASS_PATTERN[step];
    if (bassFreq && bassFreq > 0) {
      this.synthGlacialBass(ctx, dest, time, bassFreq, stepDuration * 0.9);
    }

    // 4. Crystalline Frost Bells (Arp)
    const bellFreq = L1_BELL_PATTERN[step];
    if (bellFreq && bellFreq > 0) {
      this.synthCrystalBell(ctx, dest, time, bellFreq, stepDuration * 1.5);
    }

    // 5. Frost Drone Pad (downbeat of each bar)
    if (stepInBar === 0) {
      const chord = L1_FROST_PADS[bar % L1_FROST_PADS.length];
      if (chord) {
        this.synthFrostPad(ctx, dest, time, chord, stepDuration * 15.2);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LEVEL 2: HEAT AGE (132 BPM · Volcanic Forge)
  // ──────────────────────────────────────────────────────────────────────────

  public static scheduleLevel2Step(
    ctx: AudioContext,
    dest: AudioNode,
    step: number,
    time: number,
    stepDuration: number
  ): void {
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Heavy Industrial Kick (Four-on-the-floor with syncopation)
    const isKick = stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12 || (stepInBar === 14 && bar % 2 === 1);
    if (isKick) {
      this.synthForgeKick(ctx, dest, time);
    }

    // 2. Anvil Strike / Metallic Clank (on off-beats 4 and 12, plus syncopated accent)
    if (stepInBar === 4 || stepInBar === 12 || (stepInBar === 15 && bar === 3)) {
      this.synthAnvilStrike(ctx, dest, time, stepInBar === 12);
    }

    // 3. Sizzling Steam Hat
    if (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
      this.synthSizzleHat(ctx, dest, time, true);
    } else if (stepInBar % 2 === 0) {
      this.synthSizzleHat(ctx, dest, time, false);
    }

    // 4. Gritty Furnace Saw Bass (E Phrygian)
    const bassNote = L2_FURNACE_BASS[step];
    if (bassNote && bassNote > 0) {
      this.synthFurnaceBass(ctx, dest, time, bassNote, stepDuration * 0.85);
    }

    // 5. Searing Flame Lead
    const leadNote = L2_FLAME_LEAD[step];
    if (leadNote && leadNote > 0) {
      this.synthFlameLead(ctx, dest, time, leadNote, stepDuration * 1.8);
    }

    // 6. Subterranean Magma Rumble (every 2 bars)
    if (stepInBar === 0 && bar % 2 === 0) {
      this.synthMagmaRumble(ctx, dest, time, stepDuration * 31);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LEVEL 3: MEDIEVAL PALACE (106 BPM · Royal Infiltration)
  // ──────────────────────────────────────────────────────────────────────────

  public static scheduleLevel3Step(
    ctx: AudioContext,
    dest: AudioNode,
    step: number,
    time: number,
    stepDuration: number
  ): void {
    const stepInBar = step % 8;
    const bar = Math.floor(step / 8);

    // 1. Plucked Lute / Harpsichord Arpeggios (in A minor / D minor)
    const luteNote = L3_LUTE_PATTERN[step];
    if (luteNote && luteNote > 0) {
      this.synthLutePluck(ctx, dest, time, luteNote, stepDuration * 1.3);
    }

    // 2. Royal Court Flute (melodic lead in bars 2 through 7)
    const fluteNote = L3_COURT_FLUTE[step];
    if (fluteNote && fluteNote > 0) {
      this.synthCourtFlute(ctx, dest, time, fluteNote, stepDuration * 2.2);
    }

    // 3. Castle Percussion: Soft bodhrán on downbeat, court tambourine on beats 2 & 4 (steps 2 & 6)
    if (stepInBar === 0) {
      this.synthBodhran(ctx, dest, time);
    } else if (stepInBar === 2 || stepInBar === 6) {
      this.synthTambourine(ctx, dest, time);
    }

    // 4. Cathedral Stone Reverb Pad (on downbeat of each bar)
    if (stepInBar === 0) {
      const chord = L3_CATHEDRAL_PADS[bar % L3_CATHEDRAL_PADS.length];
      if (chord) {
        this.synthCathedralPad(ctx, dest, time, chord, stepDuration * 7.8);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LEVEL 4: ANCIENT FOREST (92 BPM · Elder Grove)
  // ──────────────────────────────────────────────────────────────────────────

  public static scheduleLevel4Step(
    ctx: AudioContext,
    dest: AudioNode,
    step: number,
    time: number,
    stepDuration: number
  ): void {
    const stepInBar = step % 8;
    const bar = Math.floor(step / 8);

    // 1. Breathy Pan-Flute Melody (Pentatonic G-Major / E-Minor)
    const fluteNote = L4_PAN_FLUTE[step];
    if (fluteNote && fluteNote > 0) {
      this.synthPanFlute(ctx, dest, time, fluteNote, stepDuration * 2.5);
    }

    // 2. Wooden Marimba / Log Drum Taps
    const marimbaNote = L4_MARIMBA_PATTERN[step];
    if (marimbaNote && marimbaNote > 0) {
      this.synthWoodMarimba(ctx, dest, time, marimbaNote);
    }

    // 3. Dewdrop Bell Shimmers
    const bellNote = L4_DEWDROP_BELLS[step];
    if (bellNote && bellNote > 0) {
      this.synthDewdropBell(ctx, dest, time, bellNote);
    }

    // 4. Soft Organic Forest Leaf Shaker
    if (stepInBar % 2 === 0) {
      this.synthForestShaker(ctx, dest, time);
    }

    // 5. Earth Sub Bass & Blooming Grove Pad (bar downbeat)
    if (stepInBar === 0) {
      const chord = L4_GROVE_PADS[bar % L4_GROVE_PADS.length];
      if (chord) {
        this.synthGrovePad(ctx, dest, time, chord, stepDuration * 7.8);
      }
      const bass = L4_EARTH_BASS[bar % L4_EARTH_BASS.length];
      if (bass) {
        this.synthEarthSub(ctx, dest, time, bass, stepDuration * 7.4);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LEVEL 5: FUTURISTIC CORE (140 BPM · Quantum Singularity)
  // ──────────────────────────────────────────────────────────────────────────

  public static scheduleLevel5Step(
    ctx: AudioContext,
    dest: AudioNode,
    step: number,
    time: number,
    stepDuration: number
  ): void {
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Cyber Kick Drum (Heavy 140 BPM driving pulse)
    const isKick = stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12;
    if (isKick) {
      this.synthHyperKick(ctx, dest, time);
    }

    // 2. Laser Snare Clap on 4 and 12
    if (stepInBar === 4 || stepInBar === 12) {
      this.synthLaserSnare(ctx, dest, time);
    }

    // 3. Rolling Acid 303 Bassline in F# Minor
    const bassNote = L5_ACID_BASS[step];
    if (bassNote && bassNote[0] > 0) {
      this.synthAcid303(ctx, dest, time, bassNote[0], bassNote[1], stepDuration * 0.9);
    }

    // 4. Quantum Hyperdrive Arpeggiator
    const arpNote = L5_QUANTUM_ARP[step];
    if (arpNote && arpNote > 0) {
      this.synthQuantumArp(ctx, dest, time, arpNote, stepDuration * 0.85);
    }

    // 5. Laser Zap Stabs on bar breaks
    if (step === 31 || step === 63) {
      this.synthLaserStab(ctx, dest, time);
    }

    // 6. Deep Space Void Pad (downbeat of each bar)
    if (stepInBar === 0) {
      const chord = L5_CORE_PADS[bar % L5_CORE_PADS.length];
      if (chord) {
        this.synthCorePad(ctx, dest, time, chord, stepDuration * 15.2);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SYNTHESIS VOICES (Web Audio API Primitive Nodes)
  // ──────────────────────────────────────────────────────────────────────────

  // ── Level 1 Synth Voices ──
  private static synthFrostKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(34, time + 0.1);
    gain.gain.setValueAtTime(0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private static synthIceCrackHat(ctx: AudioContext, dest: AudioNode, time: number, accent: boolean): void {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8500, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.18 : 0.09, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  private static synthGlacialBass(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthCrystalBell(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, time);
    filter.Q.setValueAtTime(4.0, time);
    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthFrostPad(ctx: AudioContext, dest: AudioNode, time: number, chord: number[], dur: number): void {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.04, time + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur);
    });
  }

  // ── Level 2 Synth Voices ──
  private static synthForgeKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.1);
    gain.gain.setValueAtTime(0.48, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  private static synthAnvilStrike(ctx: AudioContext, dest: AudioNode, time: number, loud: boolean): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1380, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.Q.setValueAtTime(8.0, time);
    gain.gain.setValueAtTime(loud ? 0.28 : 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private static synthSizzleHat(ctx: AudioContext, dest: AudioNode, time: number, open: boolean): void {
    const len = open ? 0.09 : 0.035;
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.45;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6200, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.22 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + len);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  private static synthFurnaceBass(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(280, time + dur * 0.85);
    filter.Q.setValueAtTime(4.5, time);
    gain.gain.setValueAtTime(0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthFlameLead(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(3.0, time);
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthMagmaRumble(ctx: AudioContext, dest: AudioNode, time: number, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  // ── Level 3 Synth Voices ──
  private static synthLutePluck(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 2, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(450, time + dur);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur);
    osc2.stop(time + dur);
  }

  private static synthCourtFlute(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthBodhran(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  private static synthTambourine(ctx: AudioContext, dest: AudioNode, time: number): void {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5400, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  private static synthCathedralPad(ctx: AudioContext, dest: AudioNode, time: number, chord: number[], dur: number): void {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.035, time + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur);
    });
  }

  // ── Level 4 Synth Voices ──
  private static synthPanFlute(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthWoodMarimba(ctx: AudioContext, dest: AudioNode, time: number, freq: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(3.0, time);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  private static synthDewdropBell(ctx: AudioContext, dest: AudioNode, time: number, freq: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  private static synthForestShaker(ctx: AudioContext, dest: AudioNode, time: number): void {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.035), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4200, time);
    filter.Q.setValueAtTime(2.0, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  private static synthGrovePad(ctx: AudioContext, dest: AudioNode, time: number, chord: number[], dur: number): void {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.045, time + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur);
    });
  }

  private static synthEarthSub(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  // ── Level 5 Synth Voices ──
  private static synthHyperKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.09);
    gain.gain.setValueAtTime(0.46, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  private static synthLaserSnare(ctx: AudioContext, dest: AudioNode, time: number): void {
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  private static synthAcid303(ctx: AudioContext, dest: AudioNode, time: number, freq: number, accent: boolean, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accent ? 2200 : 900, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + dur * 0.85);
    filter.Q.setValueAtTime(accent ? 7.5 : 4.5, time);
    gain.gain.setValueAtTime(accent ? 0.35 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthQuantumArp(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900, time);
    filter.Q.setValueAtTime(2.5, time);
    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur);
  }

  private static synthLaserStab(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.12);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private static synthCorePad(ctx: AudioContext, dest: AudioNode, time: number, chord: number[], dur: number): void {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.038, time + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur);
    });
  }
}

// ── Patterns & Chords Data ──────────────────────────────────────────────────

// Level 1: Frozen Age (64 steps)
const L1_BASS_PATTERN: number[] = [
  D2, 0, D2, 0, F2, 0, D2, 0, G2, 0, D2, 0, A2, 0, F2, 0,
  Bb2, 0, Bb2, 0, F2, 0, Bb2, 0, C3, 0, C3, 0, G2, 0, C3, 0,
  D2, 0, D2, 0, F2, 0, D2, 0, G2, 0, Ab2, 0, A2, 0, C3, 0,
  Bb2, 0, A2, 0, G2, 0, F2, 0, D2, 0, C2, 0, D2, 0, 0, 0
];

const L1_BELL_PATTERN: number[] = [
  D5, 0, A5, 0, F5, 0, D6, 0, C6, 0, A5, 0, F5, 0, D5, 0,
  Bb5, 0, D6, 0, F6, 0, D6, 0, C6, 0, G5, 0, E5, 0, C6, 0,
  D6, 0, C6, 0, A5, 0, F5, 0, G5, 0, A5, 0, C6, 0, D6, 0,
  F6, 0, D6, 0, C6, 0, A5, 0, F5, 0, D5, 0, 0, 0, 0, 0
];

const L1_FROST_PADS: number[][] = [
  [D3, F3, A3, C4],     // Dm7
  [Bb2, D3, F3, A3],    // Bbmaj7
  [G2, Bb2, D3, F3],    // Gm7
  [A2, C3, E3, G3]      // Am7
];

// Level 2: Heat Age (64 steps)
const L2_FURNACE_BASS: number[] = [
  E2, E2, E2, E2, F2, 0, E2, G2, E2, E2, Bb2, 0, A2, G2, F2, 0,
  E2, E2, E2, E2, G2, 0, E2, A2, E2, E2, C3, 0, B2, A2, G2, 0,
  E2, E2, E2, E2, F2, 0, E2, G2, E2, E2, Bb2, 0, A2, G2, F2, 0,
  C2, 0, C2, 0, D2, 0, D2, 0, Eb2, 0, Eb2, 0, F2, 0, G2, 0
];

const L2_FLAME_LEAD: number[] = [
  0, 0, E4, 0, 0, 0, G4, 0, 0, 0, F4, 0, Gs4, 0, 0, 0,
  0, 0, B4, 0, 0, 0, C5, 0, 0, 0, B4, 0, A4, 0, G4, 0,
  0, 0, E4, 0, 0, 0, G4, 0, 0, 0, F4, 0, Gs4, 0, 0, 0,
  E5, 0, D5, 0, C5, 0, B4, 0, A4, 0, G4, 0, F4, 0, E4, 0
];

// Level 3: Medieval Palace (64 steps of 8th notes)
const L3_LUTE_PATTERN: number[] = [
  // Bar 0: Am
  A3, C4, E4, A4, C5, A4, E4, C4,
  // Bar 1: Dm
  D4, F4, A4, D5, F5, D5, A4, F4,
  // Bar 2: G
  G3, B3, D4, G4, B4, G4, D4, B3,
  // Bar 3: C
  C4, E4, G4, C5, E5, C5, G4, E4,
  // Bar 4: F
  F3, A3, C4, F4, A4, F4, C4, A3,
  // Bar 5: Bdim
  B3, D4, F4, B4, D5, B4, F4, D4,
  // Bar 6: E7
  E3, Gs3, B3, E4, Gs4, E4, B3, Gs3,
  // Bar 7: Am
  A3, C4, E4, A4, E4, C4, A3, 0
];

const L3_COURT_FLUTE: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  G4, 0, B4, 0, D5, 0, B4, 0,
  C5, 0, E5, 0, D5, 0, C5, 0,
  A4, 0, C5, 0, F5, 0, E5, 0,
  D5, 0, F5, 0, E5, 0, D5, 0,
  B4, 0, D5, 0, E5, 0, Gs4, 0,
  A4, 0, E4, 0, A4, 0, 0, 0
];

const L3_CATHEDRAL_PADS: number[][] = [
  [A2, E3, A3, C4],     // Am
  [D3, A3, D4, F4],     // Dm
  [G2, D3, G3, B3],     // G
  [C3, G3, C4, E4],     // C
  [F2, C3, F3, A3],     // F
  [B2, F3, B3, D4],     // Bdim
  [E2, B2, E3, Gs3],    // E
  [A2, E3, A3, C4]      // Am
];

// Level 4: Ancient Forest (64 steps of 8th notes)
const L4_PAN_FLUTE: number[] = [
  // Bar 0
  G4, 0, B4, 0, D5, 0, E5, 0,
  // Bar 1
  G5, 0, E5, 0, D5, 0, B4, 0,
  // Bar 2
  A4, 0, B4, 0, D5, 0, A4, 0,
  // Bar 3
  G4, 0, E4, 0, G4, 0, D4, 0,
  // Bar 4
  E4, 0, G4, 0, A4, 0, B4, 0,
  // Bar 5
  D5, 0, B4, 0, A4, 0, G4, 0,
  // Bar 6
  E5, 0, D5, 0, B4, 0, G4, 0,
  // Bar 7
  A4, 0, G4, 0, D4, 0, G4, 0
];

const L4_MARIMBA_PATTERN: number[] = [
  D3, 0, G3, 0, B3, 0, D4, 0,
  C3, 0, E3, 0, G3, 0, C4, 0,
  E3, 0, G3, 0, B3, 0, E4, 0,
  D3, 0, A3, 0, D4, 0, 0, 0,
  G3, 0, B3, 0, D4, 0, G4, 0,
  C3, 0, G3, 0, C4, 0, E4, 0,
  E3, 0, B3, 0, E4, 0, G4, 0,
  D3, 0, G3, 0, B3, 0, 0, 0
];

const L4_DEWDROP_BELLS: number[] = [
  0, 0, G5, 0, 0, 0, B5, 0,
  0, 0, D6, 0, 0, 0, E6, 0,
  0, 0, B5, 0, 0, 0, G5, 0,
  0, 0, D5, 0, 0, 0, 0, 0,
  0, 0, G5, 0, 0, 0, B5, 0,
  0, 0, E6, 0, 0, 0, D6, 0,
  0, 0, B5, 0, 0, 0, G5, 0,
  0, 0, D6, 0, 0, 0, 0, 0
];

const L4_GROVE_PADS: number[][] = [
  [G2, D3, G3, B3, D4],  // Gmaj9
  [C3, G3, C4, E4, G4],  // Cmaj7
  [E2, B2, E3, G3, B3],  // Em7
  [D3, A3, D4, Fs4, A4], // D
  [G2, D3, G3, B3, D4],  // Gmaj9
  [C3, G3, C4, E4, G4],  // Cmaj7
  [E2, B2, E3, G3, B3],  // Em7
  [D3, A3, D4, G4, B4]   // Dsus4
];

const L4_EARTH_BASS: number[] = [
  G1, C2, E1, D2, G1, C2, E1, D2
];

// Level 5: Futuristic Core (64 steps of 16th notes)
// [Frequency, isAccented]
const L5_ACID_BASS: Array<[number, boolean]> = [
  [Fs2, true], [Fs2, false], [Fs3, false], [Fs2, false],
  [A2, true], [Fs2, false], [B2, false], [Fs2, false],
  [Cs3, true], [Fs2, false], [E3, false], [Fs2, false],
  [Fs3, true], [E3, false], [Cs3, false], [A2, false],

  [D2, true], [D2, false], [D3, false], [D2, false],
  [Fs2, true], [D2, false], [A2, false], [D2, false],
  [E2, true], [E2, false], [B2, false], [E2, false],
  [E2, true], [Gs2, false], [B2, false], [D3, false],

  [Fs2, true], [Fs2, false], [Fs3, false], [Fs2, false],
  [A2, true], [Fs2, false], [B2, false], [Fs2, false],
  [Cs3, true], [Fs2, false], [E3, false], [Fs2, false],
  [Fs3, true], [A3, false], [Cs4, false], [E4, false],

  [D2, true], [Fs2, false], [A2, false], [D3, true],
  [Cs2, true], [E2, false], [Gs2, false], [Cs3, true],
  [B1, true], [D2, false], [Fs2, false], [B2, true],
  [Cs2, true], [E2, false], [Gs2, false], [Cs3, true]
];

const L5_QUANTUM_ARP: number[] = [
  Fs4, A4, Cs5, Fs5, E5, Cs5, A4, Fs4,
  A4, Cs5, E5, A5, Gs5, E5, Cs5, A4,
  Fs4, A4, Cs5, Fs5, E5, Cs5, A4, Fs4,
  B4, D5, Fs5, B5, A5, Fs5, D5, B4,

  Fs4, A4, Cs5, Fs5, E5, Cs5, A4, Fs4,
  A4, Cs5, E5, A5, Gs5, E5, Cs5, A4,
  D5, Fs5, A5, D6, Cs6, A5, Fs5, D5,
  Cs5, E5, Gs5, Cs6, B5, Gs5, E5, Cs5
];

const L5_CORE_PADS: number[][] = [
  [Fs2, Cs3, Fs3, A3],   // F#m
  [D3, A3, D4, Fs4],     // D
  [B2, Fs3, B3, D4],     // Bm
  [Cs3, Gs3, Cs4, E4]    // C#m
];
