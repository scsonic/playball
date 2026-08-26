type SoundName = 'countdown' | 'go' | 'pitch' | 'catch' | 'miss' | 'win' | 'lose' | 'select' | 'dwell';

/**
 * Audio with no required assets.
 *
 * Every cue is synthesised with the Web Audio API, so the prototype ships with a
 * complete soundscape and an empty `/public/assets/audio` folder. If licensed or
 * stock audio files are dropped in via the asset manifest they take priority.
 *
 * Autoplay policy is handled gracefully: the context starts suspended and is
 * resumed on the first user gesture; if that never happens the game stays silent
 * instead of throwing.
 */
class SoundService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private unlocked = false;
  private buffers = new Map<SoundName, AudioBuffer>();
  private ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.9 : 0;
    if (!enabled) this.stopAmbient();
  }

  isEnabled() {
    return this.enabled;
  }

  isUnlocked() {
    return this.unlocked;
  }

  /** Must be called from a user gesture (button click / dwell selection). */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.9 : 0;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      return this.unlocked;
    } catch {
      this.unlocked = false;
      return false;
    }
  }

  /** Optional: preload a real audio file for a cue. Failure is silent by design. */
  async loadFile(name: SoundName, url: string) {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      this.buffers.set(name, await this.ctx.decodeAudioData(data));
    } catch {
      /* placeholder file absent — synthesised cue is used instead */
    }
  }

  play(name: SoundName) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;

    const buffer = this.buffers.get(name);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.master);
      src.start();
      return;
    }

    switch (name) {
      case 'countdown':
        this.tone(660, 0.12, 'square', 0.18);
        break;
      case 'go':
        this.tone(990, 0.28, 'square', 0.22);
        break;
      case 'pitch':
        this.noise(0.22, 1400, 0.14);
        break;
      case 'catch':
        this.tone(180, 0.09, 'sine', 0.5);
        this.noise(0.12, 900, 0.32);
        this.tone(520, 0.14, 'triangle', 0.16, 0.04);
        break;
      case 'miss':
        this.noise(0.3, 620, 0.1);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.2, i * 0.11));
        break;
      case 'lose':
        [440, 392].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.14, i * 0.14));
        break;
      case 'select':
        this.tone(880, 0.1, 'sine', 0.16);
        this.tone(1320, 0.12, 'sine', 0.1, 0.05);
        break;
      case 'dwell':
        this.tone(1200, 0.05, 'sine', 0.06);
        break;
    }
  }

  /** Soft synthesised crowd bed, used when no ambience file is provided. */
  startAmbient() {
    if (!this.enabled || !this.ctx || !this.master || this.ambient) return;
    const length = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      // Brown-ish noise reads as distant crowd rather than static.
      last = (last + Math.random() * 2 - 1) * 0.5;
      data[i] = last * 0.35;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.ambient = { source, gain };
  }

  stopAmbient() {
    if (!this.ambient) return;
    try {
      this.ambient.source.stop();
      this.ambient.source.disconnect();
    } catch {
      /* already stopped */
    }
    this.ambient = null;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainValue: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, cutoff: number, gainValue: number) {
    if (!this.ctx || !this.master) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  dispose() {
    this.stopAmbient();
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.unlocked = false;
  }
}

export const sound = new SoundService();
