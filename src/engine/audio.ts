import { TurnResult } from '../types';

export class SoundManager {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  private initialized = false;
  private activeTier = 0;

  public onMilestone?: (combo: number, tier: number) => void;

  // Pentatonic scale (C major / A minor pentatonic frequencies C4 to A6)
  private pentatonicFrequencies = [
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
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
    1567.98, // G6
    1760.00  // A6
  ];

  public init(): void {
    if (this.initialized) return;
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.initialized = true;
        }
      }
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  private ensureContext(): boolean {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return !this.isMuted && this.ctx !== null;
  }

  public getTierForCombo(combo: number): number {
    if (combo <= 0) return 0;
    if (combo < 10) return 1;
    if (combo < 25) return 2;
    if (combo < 50) return 3;
    if (combo < 100) return 4;
    return 5;
  }

  public getActiveTier(): number {
    return this.activeTier;
  }

  public handleTurnEvent(result: TurnResult, combo: number): void {
    if (result === 'PERFECT') {
      const comboTier = this.getTierForCombo(combo);
      this.activeTier = Math.max(this.activeTier, comboTier);

      // Check milestones at 10, 25, 50, 100
      if (combo === 10 || combo === 25 || combo === 50 || combo === 100) {
        this.onMilestone?.(combo, this.activeTier);
        this.playMilestoneFlourish(this.activeTier);
      }

      this.playPerfectTurn(combo, this.activeTier);
    } else if (result === 'GOOD') {
      // Degrade tier smoothly by 1 level
      this.activeTier = Math.max(0, this.activeTier - 1);
      this.playGoodTurn();
    } else {
      // Missed turn
      this.activeTier = 0;
      this.playMissTurn();
    }
  }

  public playPerfectTurn(combo: number, tier: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const noteIdx = (combo - 1) % this.pentatonicFrequencies.length;
    const freq = this.pentatonicFrequencies[noteIdx];

    // Primary bell/piano tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = tier >= 4 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const baseVol = 0.22;
    gain.gain.setValueAtTime(baseVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (tier >= 5 ? 0.35 : 0.2));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    // Tier 1+: Sparkle harmonic overtone (octave up)
    if (tier >= 1) {
      const harm = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(freq * 2, now);
      harmGain.gain.setValueAtTime(baseVol * 0.4, now);
      harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      harm.connect(harmGain);
      harmGain.connect(this.ctx.destination);
      harm.start(now);
      harm.stop(now + 0.16);
    }

    // Tier 2+: Percussive hi-hat / click pulse
    if (tier >= 2) {
      this.playPercussionPulse(now);
    }

    // Tier 3+: Deep driving bass synth
    if (tier >= 3) {
      this.playBassPulse(now, freq);
    }

    // Tier 4+: Rich harmonic arp note (+ fifth)
    if (tier >= 4) {
      this.playArpNote(now + 0.05, freq * 1.5);
    }

    // Tier 5: Full Flow Mode shimmer flourish
    if (tier >= 5) {
      this.playFlowShimmer(now, freq);
    }
  }

  private playPercussionPulse(time: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.035);

    gain.gain.setValueAtTime(0.09, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.045);
  }

  private playBassPulse(time: number, primaryFreq: number): void {
    if (!this.ctx) return;
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();

    // 2 octaves below
    const bassFreq = Math.max(55, primaryFreq / 4);
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(bassFreq, time);

    bassGain.gain.setValueAtTime(0.24, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(time);
    bassOsc.stop(time + 0.3);
  }

  private playArpNote(time: number, freq: number): void {
    if (!this.ctx) return;
    const arpOsc = this.ctx.createOscillator();
    const arpGain = this.ctx.createGain();

    arpOsc.type = 'sine';
    arpOsc.frequency.setValueAtTime(freq, time);

    arpGain.gain.setValueAtTime(0.14, time);
    arpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    arpOsc.connect(arpGain);
    arpGain.connect(this.ctx.destination);
    arpOsc.start(time);
    arpOsc.stop(time + 0.24);
  }

  private playFlowShimmer(time: number, freq: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 3, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 2.5, time + 0.3);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  public playGoodTurn(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playMissTurn(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playMilestoneFlourish(_tier: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Upward pentatonic arpeggio chord
    const chord = [523.25, 659.25, 783.99, 1046.50];
    chord.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      const startTime = now + i * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const sound = new SoundManager();
