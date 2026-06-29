/**
 * SoundManager — procedurally synthesized game audio via Web Audio API.
 *
 * All sounds are generated on-the-fly with oscillator nodes; no audio files.
 * The AudioContext is lazily created on first playback to satisfy browser
 * autoplay policies (requires a user gesture).
 */
export default class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicPlaying = false;
  private musicStopFlag = false;
  private _muted = false;
  private _volume = 0.7; // default 70%

  /** Volume level 0–1. Defaults to 0.7, persisted via localStorage. */
  get volume(): number {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('polytopia_volume', String(this._volume)); } catch { /* unavailable */ }
    this.applyGain();
  }

  /** When true the master gain is silenced (oscillators still run, output is 0). */
  get mute(): boolean {
    return this._muted;
  }
  set mute(value: boolean) {
    this._muted = value;
    this.applyGain();
  }

  /** Apply current volume × mute state to the master gain node. */
  private applyGain(): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this._muted ? 0 : this._volume;
  }

  /** Read persisted volume from localStorage (call once at startup). */
  loadVolume(): void {
    try {
      const saved = localStorage.getItem('polytopia_volume');
      if (saved !== null) this._volume = Math.max(0, Math.min(1, parseFloat(saved)));
    } catch { /* localStorage unavailable */ }
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  /** Schedule a single tone and return when it finishes. */
  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume = 1,
    freqEnd?: number,
  ): void {
    this.ensureInit();
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.0001), now + duration);
    }

    env.gain.setValueAtTime(volume, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration + 0.01);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  // ── one-shot effects ─────────────────────────────────────────────────

  /** Short high-pitched blip (800Hz, 50ms, square wave, quick fade). */
  playUIclick(): void {
    this.tone(800, 0.05, 'square', 0.5);
  }

  /** Two-note ascending chime (523Hz→659Hz, 100ms each, sine wave). */
  playTribeSelect(): void {
    this.ensureInit();
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.1);

    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(env).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.21);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  /** Short impact noise (200Hz→100Hz sweep, 80ms, sawtooth, 0.3 volume). */
  playAttackHit(): void {
    this.tone(200, 0.08, 'sawtooth', 0.3, 100);
  }

  /** Descending tone (400Hz→100Hz, 250ms, sine wave, fade out). */
  playUnitDeath(): void {
    this.tone(400, 0.25, 'sine', 0.6, 100);
  }

  /** Three-note victory fanfare (523→659→784Hz, 150ms each, triangle wave). */
  playCityCapture(): void {
    this.ensureInit();
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.15);
    osc.frequency.setValueAtTime(784, now + 0.3);

    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(env).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.46);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  // ── ambient music (looping arpeggio) ─────────────────────────────────

  /**
   * Start a slow looping ambient arpeggio (130→165→196→165Hz, 400ms each,
   * 0.15 volume, 50ms gap). Safe to call multiple times without overlap.
   */
  startMusic(): void {
    this.ensureInit();
    if (this.musicPlaying) return;
    this.musicStopFlag = false;

    const notes = [130, 165, 196, 165];
    const noteDur = 0.4;
    const gap = 0.05;

    const playLoop = (): void => {
      if (this.musicStopFlag) {
        this.musicPlaying = false;
        return;
      }
      this.musicPlaying = true;

      const startTime = this.ctx!.currentTime + 0.05;
      let t = startTime;

      for (const freq of notes) {
        const osc = this.ctx!.createOscillator();
        const env = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        env.gain.setValueAtTime(0.15, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + noteDur);

        osc.connect(env).connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + noteDur + 0.01);
        osc.onended = () => {
          osc.disconnect();
          env.disconnect();
        };

        t += noteDur + gap;
      }

      const loopDuration = (noteDur + gap) * notes.length * 1000;
      setTimeout(playLoop, loopDuration);
    };

    playLoop();
  }

  /** Stop the ambient music loop. */
  stopMusic(): void {
    this.musicStopFlag = true;
    this.musicPlaying = false;
  }
}
