// Procedural Web Audio synthesizer for high-dopamine arcade feedback.
// Zero external assets required.
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;

  // Pentatonic scale pitches for dopamine gem combos
  private scalePitches = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
  ];

  public init(): void {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.setupWindAmbience();
    } catch {
      // Audio might be blocked until user gesture
    }
  }

  private ensureContext(): boolean {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !this.isMuted && this.ctx !== null;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.windGain && this.ctx) {
      this.windGain.gain.setValueAtTime(this.isMuted ? 0 : 0.05, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  private setupWindAmbience(): void {
    if (!this.ctx) return;
    try {
      // Create pink/white noise buffer for whoosh wind
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02; // pink noise approx
        lastOut = data[i];
      }

      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = buffer;
      this.windNode.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(200, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.windNode.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windNode.start();
    } catch {
      // Ignore background audio errors
    }
  }

  public updateWindIntensity(speed: number): void {
    if (!this.ensureContext() || !this.windGain || !this.windFilter || !this.ctx) return;
    const clampedSpeed = Math.min(Math.max((speed - 600) / 1400, 0), 1);
    const targetGain = this.isMuted ? 0 : clampedSpeed * 0.25;
    const targetFreq = 200 + clampedSpeed * 1800;

    this.windGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  public playJump(power: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Synth laser / power jump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 160 + power * 180;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.8, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playLand(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBounce(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playCrumble(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playGem(comboStreak: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const pitchIndex = (comboStreak - 1) % this.scalePitches.length;
    const octaveMultiplier = Math.floor((comboStreak - 1) / this.scalePitches.length) + 1;
    const freq = this.scalePitches[pitchIndex] * Math.min(octaveMultiplier, 2.5);

    // Main chime
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    // Overtone harmonic for sparkle
    const harm = this.ctx.createOscillator();
    const harmGain = this.ctx.createGain();
    harm.type = 'triangle';
    harm.frequency.setValueAtTime(freq * 2, now);
    harmGain.gain.setValueAtTime(0.15, now);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    harm.connect(harmGain);
    gain.connect(this.ctx.destination);
    harmGain.connect(this.ctx.destination);

    osc.start(now);
    harm.start(now);
    osc.stop(now + 0.36);
    harm.stop(now + 0.22);
  }

  public playComboFanfare(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio

    chord.forEach((freq, idx) => {
      const startTime = now + idx * 0.05;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.42);
    });
  }

  public playCrash(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Sub-bass thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.45);

    // Impact crunch
    const crunchOsc = this.ctx.createOscillator();
    const crunchGain = this.ctx.createGain();
    crunchOsc.type = 'sawtooth';
    crunchOsc.frequency.setValueAtTime(60, now);
    crunchGain.gain.setValueAtTime(0.25, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    crunchOsc.connect(crunchGain);
    crunchGain.connect(this.ctx.destination);
    crunchOsc.start(now);
    crunchOsc.stop(now + 0.18);
  }
}

export const sound = new SoundManager();
