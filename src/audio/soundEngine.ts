import { AmbientLayerId, AudioPreferences, MusicStyle, SceneMode } from '../types';

/**
 * Pure Web Audio API Generative Music & Ambient Soundscape Engine.
 * Synthesizes Lo-Fi study beats, Soft Jazz Rhodes & upright bass, Gentle Felt Piano,
 * Cozy Café room murmur + porcelain clinks, Rain against windows, Fireplace crackle,
 * and Mechanical/Tactile Keyboard Typing.
 * Includes smooth exterior-to-interior storefront lowpass crossfading.
 */
class CafeSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sceneFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGains: Record<AmbientLayerId, GainNode | null> = {
    cafe: null,
    rain: null,
    fire: null,
    keyboard: null,
  };

  private isInitialized = false;
  private currentScene: SceneMode = 'street';
  private prefs: AudioPreferences = {
    isPlaying: true,
    autoPlay: true,
    isMuted: false,
    quietMode: false,
    masterVolume: 0.75,
    musicStyle: 'lofi',
    musicVolume: 0.55,
    ambientVolumes: {
      cafe: 0.45,
      rain: 0.35,
      fire: 0.3,
      keyboard: 0.3,
    },
    ambientEnabled: {
      cafe: true,
      rain: true,
      fire: false,
      keyboard: false,
    },
    sfxEnabled: true,
  };

  private musicIntervalId: number | null = null;
  private ambientIntervalId: number | null = null;
  private stepCounter = 0;
  private activeNodes: AudioNode[] = [];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockIfNeeded(): void {
    if (!this.prefs.isPlaying || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.isInitialized) {
      this.setupGraph(ctx);
      this.isInitialized = true;
    }
    this.updateVolumes();
  }

  public initAndApply(prefs: AudioPreferences): void {
    this.prefs = { ...prefs };
    if (!this.prefs.isPlaying) {
      this.updateVolumes();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.isInitialized) {
      this.setupGraph(ctx);
      this.isInitialized = true;
    }

    this.updateVolumes();
  }

  /**
   * Smoothly crossfades interior warmth vs exterior muffled storefront sound
   * when transitioning from the Street into the Café Interior.
   */
  public setSceneMode(scene: SceneMode): void {
    this.currentScene = scene;
    if (!this.ctx || !this.sceneFilter) return;
    const now = this.ctx.currentTime;
    const targetFreq = scene === 'street' ? 680 : 12000;
    this.sceneFilter.frequency.setTargetAtTime(targetFreq, now, 0.45);
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    type: 'pink' | 'brown' | 'white',
    seconds = 4
  ): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
    } else {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 0.18;
      }
    }
    return buffer;
  }

  private setupGraph(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(ctx.destination);

    this.sceneFilter = ctx.createBiquadFilter();
    this.sceneFilter.type = 'lowpass';
    this.sceneFilter.frequency.value = this.currentScene === 'street' ? 680 : 12000;
    this.sceneFilter.connect(this.masterGain);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.prefs.musicVolume;
    this.musicGain.connect(this.sceneFilter);

    // 1. Cozy Café Ambience Continuous Bed
    const cafeGain = ctx.createGain();
    cafeGain.gain.value = 0;
    cafeGain.connect(this.sceneFilter);
    this.ambientGains.cafe = cafeGain;

    const cafeNoise = ctx.createBufferSource();
    cafeNoise.buffer = this.createNoiseBuffer(ctx, 'pink', 5);
    cafeNoise.loop = true;

    const cafeFilter = ctx.createBiquadFilter();
    cafeFilter.type = 'bandpass';
    cafeFilter.frequency.value = 420;
    cafeFilter.Q.value = 0.7;

    const cafeLowpass = ctx.createBiquadFilter();
    cafeLowpass.type = 'lowpass';
    cafeLowpass.frequency.value = 780;

    const cafeBedGain = ctx.createGain();
    cafeBedGain.gain.value = 0.35;

    cafeNoise.connect(cafeFilter);
    cafeFilter.connect(cafeLowpass);
    cafeLowpass.connect(cafeBedGain);
    cafeBedGain.connect(cafeGain);
    cafeNoise.start();
    this.activeNodes.push(cafeNoise);

    // 2. Rain Against Windows Continuous Bed (audible both outside and inside)
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(this.masterGain);
    this.ambientGains.rain = rainGain;

    const rainNoise = ctx.createBufferSource();
    rainNoise.buffer = this.createNoiseBuffer(ctx, 'pink', 4);
    rainNoise.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1150;
    rainFilter.Q.value = 0.45;

    const rainHighShelf = ctx.createBiquadFilter();
    rainHighShelf.type = 'lowpass';
    rainHighShelf.frequency.value = 2400;

    const rainBedGain = ctx.createGain();
    rainBedGain.gain.value = 0.48;

    rainNoise.connect(rainFilter);
    rainFilter.connect(rainHighShelf);
    rainHighShelf.connect(rainBedGain);
    rainBedGain.connect(rainGain);
    rainNoise.start();
    this.activeNodes.push(rainNoise);

    // 3. Fireplace Hearth Continuous Bed
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    fireGain.connect(this.sceneFilter);
    this.ambientGains.fire = fireGain;

    const fireNoise = ctx.createBufferSource();
    fireNoise.buffer = this.createNoiseBuffer(ctx, 'brown', 4);
    fireNoise.loop = true;

    const fireLowpass = ctx.createBiquadFilter();
    fireLowpass.type = 'lowpass';
    fireLowpass.frequency.value = 260;

    const fireBedGain = ctx.createGain();
    fireBedGain.gain.value = 0.55;

    fireNoise.connect(fireLowpass);
    fireLowpass.connect(fireBedGain);
    fireBedGain.connect(fireGain);
    fireNoise.start();
    this.activeNodes.push(fireNoise);

    // 4. Keyboard Typing Gain Node (triggered organically in triggerAmbientDetails)
    const keyboardGain = ctx.createGain();
    keyboardGain.gain.value = 0;
    keyboardGain.connect(this.sceneFilter);
    this.ambientGains.keyboard = keyboardGain;

    this.startGenerativeLoops();
  }

  public updatePreferences(prefs: AudioPreferences): void {
    const wasPlaying = this.prefs.isPlaying;
    this.prefs = { ...prefs };

    if (this.prefs.isPlaying && !this.isInitialized) {
      this.initAndApply(this.prefs);
      return;
    }

    if (this.prefs.isPlaying && !wasPlaying && this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.updateVolumes();
  }

  private updateVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const shouldPlay = this.prefs.isPlaying && !this.prefs.isMuted && !this.prefs.quietMode;
    const targetMaster = shouldPlay ? this.prefs.masterVolume : 0;

    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.12);

    const targetMusic = this.prefs.musicStyle === 'none' ? 0 : this.prefs.musicVolume;
    this.musicGain.gain.setTargetAtTime(targetMusic, now, 0.14);

    (['cafe', 'rain', 'fire', 'keyboard'] as AmbientLayerId[]).forEach((id) => {
      const node = this.ambientGains[id];
      if (node) {
        const vol = this.prefs.ambientEnabled[id] ? (this.prefs.ambientVolumes[id] ?? 0.35) : 0;
        node.gain.setTargetAtTime(vol, now, 0.15);
      }
    });
  }

  private startGenerativeLoops(): void {
    if (this.musicIntervalId !== null) window.clearInterval(this.musicIntervalId);
    if (this.ambientIntervalId !== null) window.clearInterval(this.ambientIntervalId);

    this.musicIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.prefs.isPlaying || this.prefs.isMuted || this.prefs.quietMode) return;
      if (this.prefs.musicStyle === 'none' || this.prefs.musicVolume <= 0.01) return;

      this.playMusicStep(this.prefs.musicStyle, this.stepCounter);
      this.stepCounter = (this.stepCounter + 1) % 32;
    }, 620);

    this.ambientIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.prefs.isPlaying || this.prefs.isMuted || this.prefs.quietMode) return;
      this.triggerAmbientDetails();
    }, 320);
  }

  private playMusicStep(style: MusicStyle, step: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const chordVoicings = [
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
      [146.83, 220.0, 261.63, 329.63, 349.23], // Dm9
      [116.54, 174.61, 220.0, 261.63, 293.66], // Bbmaj9
      [130.81, 196.0, 233.08, 293.66, 329.63], // C9sus4
    ];

    const chordIdx = Math.floor(step / 8) % chordVoicings.length;
    const chord = chordVoicings[chordIdx];
    const beatInBar = step % 8;

    if (style === 'lofi') {
      if (beatInBar === 0) {
        chord.forEach((freq, i) => {
          this.playWarmKey(freq, now + i * 0.035, 3.8, 0.045, 'triangle');
        });
      }
      if (beatInBar === 0 || beatInBar === 5) {
        this.playSoftBass(chord[0] * 0.5, now, 1.1, 0.09);
      }
      if (beatInBar === 3 || beatInBar === 6) {
        const melodyNotes = [523.25, 587.33, 659.25, 440.0, 392.0];
        const note = melodyNotes[(step + chordIdx) % melodyNotes.length];
        if (Math.random() > 0.25) {
          this.playWarmKey(note, now, 1.4, 0.032, 'sine');
        }
      }
      if (beatInBar % 2 === 1) {
        this.playBrushPulse(now, 0.018);
      }
    } else if (style === 'jazz') {
      if (beatInBar === 0 || beatInBar === 3) {
        chord.slice(1).forEach((freq, i) => {
          this.playWarmKey(freq, now + i * 0.02, 2.2, 0.038, 'sine');
        });
      }
      if (beatInBar % 2 === 0) {
        const walkFactors = [0.5, 0.625, 0.75, 0.56];
        const bassFreq = chord[0] * walkFactors[(beatInBar / 2) % 4];
        this.playSoftBass(bassFreq, now, 0.95, 0.085);
      }
      if (beatInBar === 2 || beatInBar === 5 || beatInBar === 7) {
        const jazzScale = [440.0, 523.25, 587.33, 659.25, 698.46, 783.99];
        const note = jazzScale[(step * 3 + chordIdx) % jazzScale.length];
        if (Math.random() > 0.3) {
          this.playWarmKey(note, now + 0.08, 1.6, 0.028, 'sine');
        }
      }
      this.playBrushPulse(now, beatInBar % 2 === 0 ? 0.012 : 0.02);
    } else if (style === 'piano') {
      if (beatInBar === 0) {
        this.playWarmKey(chord[0] * 0.5, now, 4.2, 0.065, 'sine');
      }
      const arpNote = chord[beatInBar % chord.length];
      const octaveMultiplier = beatInBar >= 5 ? 2 : 1;
      this.playWarmKey(arpNote * octaveMultiplier, now, 2.6, 0.04, 'sine');
    }
  }

  private playWarmKey(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, startTime);
    filter.frequency.exponentialRampToValueAtTime(420, startTime + duration);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private playSoftBass(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    env.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private playBrushPulse(startTime: number, peakGain: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, startTime);
    osc.frequency.exponentialRampToValueAtTime(48, startTime + 0.09);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.11);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + 0.12);
  }

  private triggerAmbientDetails(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Cozy Café occasional porcelain cup clink
    if (
      this.prefs.ambientEnabled.cafe &&
      this.prefs.ambientVolumes.cafe > 0.05 &&
      this.ambientGains.cafe
    ) {
      if (Math.random() < 0.07) {
        const clinkFreq = 2100 + Math.random() * 900;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(clinkFreq, now);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.015, now + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(env);
        env.connect(this.ambientGains.cafe);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    }

    // 2. Fireplace occasional warm ember crackle
    if (
      this.prefs.ambientEnabled.fire &&
      this.prefs.ambientVolumes.fire > 0.05 &&
      this.ambientGains.fire
    ) {
      if (Math.random() < 0.34) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const env = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900 + Math.random() * 1600, now);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.value = 3.5;

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.035 * Math.random(), now + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.ambientGains.fire);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    }

    // 3. Soft Tactile Mechanical Keyboard Typing Cadence
    if (
      this.prefs.ambientEnabled.keyboard &&
      (this.prefs.ambientVolumes.keyboard ?? 0.3) > 0.05 &&
      this.ambientGains.keyboard
    ) {
      // Cluster of 1-3 soft keystrokes
      const burstCount = Math.random() < 0.65 ? (Math.random() < 0.45 ? 2 : 1) : 0;
      for (let k = 0; k < burstCount; k++) {
        const offset = k * (0.075 + Math.random() * 0.06);
        const t = now + offset;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const env = this.ctx.createGain();

        // Warm thocky keycap resonance
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340 + Math.random() * 140, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.028);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.065, t + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.ambientGains.keyboard);
        osc.start(t);
        osc.stop(t + 0.036);
      }
    }
  }

  // --- Interactive Spatial Sound Effects (SFX) ---

  public playDoorBell(): void {
    if (!this.prefs.sfxEnabled || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [659.25, 830.61, 987.77];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      env.gain.setValueAtTime(0.0001, now + idx * 0.11);
      env.gain.linearRampToValueAtTime(0.06, now + idx * 0.11 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 1.4);

      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 1.45);
    });
  }

  public playSeatSelect(): void {
    if (!this.prefs.sfxEnabled || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [293.66, 440.0, 587.33];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.15 + idx * 0.08);

      env.gain.setValueAtTime(0.0001, now + 0.15 + idx * 0.08);
      env.gain.linearRampToValueAtTime(0.035, now + 0.15 + idx * 0.08 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.15 + idx * 0.08 + 0.7);

      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(now + 0.15 + idx * 0.08);
      osc.stop(now + 0.15 + idx * 0.08 + 0.75);
    });
  }

  public playCoffeeSip(): void {
    if (!this.prefs.sfxEnabled || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [1860, 2480].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      env.gain.setValueAtTime(0.0001, now + idx * 0.05);
      env.gain.linearRampToValueAtTime(0.03, now + idx * 0.05 + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.18);

      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.2);
    });
  }

  public playWaveChime(): void {
    if (!this.prefs.sfxEnabled || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [587.33, 880.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      env.gain.setValueAtTime(0.0001, now + idx * 0.07);
      env.gain.linearRampToValueAtTime(0.025, now + idx * 0.07 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.45);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.48);
    });
  }

  public playTimerComplete(): void {
    if (!this.prefs.sfxEnabled || this.prefs.isMuted || this.prefs.quietMode) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      env.gain.setValueAtTime(0.0001, now + idx * 0.14);
      env.gain.linearRampToValueAtTime(0.055, now + idx * 0.14 + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 2.4);

      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 2.5);
    });
  }
}

export const soundEngine = new CafeSoundEngine();
