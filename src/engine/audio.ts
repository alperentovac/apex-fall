// Procedural Web Audio synthesizer with Chiptune Cat Melody & Piano Tile chimes.
// Zero external assets, ultra-fast and lightweight.
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;
  private catMusicTimer: number | null = null;
  private catNoteIndex: number = 0;
  private isCatMusicPlaying: boolean = false;

  // Pentatonic & musical scale pitches for Piano Tile dopamine
  private pianoNotes = [
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
    1567.98  // G6
  ];

  // Cute Chiptune Cat Melody Notes (Nyan Cat / Japanese 8-bit arcade motif)
  // Frequencies in Hz: F#5, G#5, D#5, B4, D5, C#5, B4, C#5, D5, C#5, B4, C#5, D#5, F#5, G#5...
  private catMelody = [
    739.99, 830.61, 622.25, 622.25, 493.88, 587.33, 554.37, 493.88,
    493.88, 554.37, 587.33, 587.33, 554.37, 493.88, 554.37, 622.25,
    739.99, 830.61, 622.25, 739.99, 554.37, 622.25, 493.88, 554.37,
    493.88, 622.25, 739.99, 622.25, 739.99, 830.61, 622.25, 554.37
  ];

  public init(): void {
    if (this.initialized) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
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
    if (this.isMuted) {
      this.stopCatMusic();
    }
    return this.isMuted;
  }

  // Piano Tiles style crisp rhythmic note on every gap passed
  public playPianoTileNote(streak: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const noteIdx = (streak - 1) % this.pianoNotes.length;
    const freq = this.pianoNotes[noteIdx];

    // High crisp piano chime (sine + overtone)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.08);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    // Cute high sparkle overtone
    const harm = this.ctx.createOscillator();
    const harmGain = this.ctx.createGain();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(freq * 2, now);
    harmGain.gain.setValueAtTime(0.12, now);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    harm.connect(harmGain);
    harmGain.connect(this.ctx.destination);
    harm.start(now);
    harm.stop(now + 0.14);
  }

  // Cute 8-bit Chiptune Cat Music Loop during Meteor Crush
  public startCatMusic(): void {
    if (this.isCatMusicPlaying) return;
    if (!this.ensureContext() || !this.ctx) return;

    this.isCatMusicPlaying = true;
    this.catNoteIndex = 0;

    const stepMs = 125; // ~150 BPM energetic 16th note rhythm
    const playNextNote = () => {
      if (!this.isCatMusicPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const freq = this.catMelody[this.catNoteIndex % this.catMelody.length];
      this.catNoteIndex++;

      // Melody note: bouncy square wave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);

      // Cute bass note on every 2nd beat
      if (this.catNoteIndex % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(freq * 0.25, now);
        bassGain.gain.setValueAtTime(0.15, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.2);
      }

      this.catMusicTimer = window.setTimeout(playNextNote, stepMs);
    };

    playNextNote();
  }

  public stopCatMusic(): void {
    this.isCatMusicPlaying = false;
    if (this.catMusicTimer !== null) {
      clearTimeout(this.catMusicTimer);
      this.catMusicTimer = null;
    }
  }

  public playPlungeWhoosh(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playBounce(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playShatter(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.26);
  }

  public playMeteorIgnite(): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playGem(comboStreak: number): void {
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const pitchIndex = (comboStreak - 1) % this.pianoNotes.length;
    const freq = this.pianoNotes[pitchIndex] * 1.5;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCrash(): void {
    this.stopCatMusic();
    if (!this.ensureContext() || !this.ctx) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.45);
  }
}

export const sound = new SoundManager();
