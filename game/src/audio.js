// audio.js — every sound is synthesized live with WebAudio: no audio files,
// no network. Oscillators for zaps and chimes, filtered noise for explosions,
// and a quiet bass pulse that loops while the game runs. The context is
// created on the first user gesture (browsers block audio before that) and
// M toggles the master gain.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Call from a user gesture (click / keypress). Safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  _osc(type, from, to, duration, volume, when = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noise(duration, volume, filterFreq, when = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  laser() {
    this._osc('square', 880, 220, 0.09, 0.10);
  }

  enemyShot() {
    this._osc('sawtooth', 320, 140, 0.14, 0.06);
  }

  explosion(big = false) {
    this._noise(big ? 0.55 : 0.3, big ? 0.5 : 0.28, big ? 900 : 1400);
    this._osc('sine', big ? 160 : 120, 40, big ? 0.5 : 0.28, 0.35);
  }

  hit() {
    this._osc('sawtooth', 200, 60, 0.22, 0.25);
    this._noise(0.15, 0.2, 800);
  }

  pickup() {
    this._osc('sine', 660, 660, 0.09, 0.16);
    this._osc('sine', 990, 990, 0.12, 0.16, 0.08);
  }

  shieldUp() {
    this._osc('triangle', 440, 880, 0.2, 0.16);
  }

  dash() {
    this._noise(0.18, 0.16, 3200);
  }

  bomb() {
    this._noise(0.8, 0.5, 700);
    this._osc('sine', 90, 28, 0.8, 0.5);
    this._osc('sine', 1200, 100, 0.4, 0.12);
  }

  waveHorn() {
    this._osc('sawtooth', 110, 110, 0.35, 0.14);
    this._osc('sawtooth', 165, 165, 0.35, 0.12, 0.02);
    this._osc('sawtooth', 220, 220, 0.4, 0.10, 0.05);
  }

  gameOver() {
    const notes = [392, 311, 262, 196];
    notes.forEach((freq, i) => this._osc('triangle', freq, freq * 0.94, 0.5, 0.2, i * 0.22));
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    // A slow minor bass pulse: A1 / C2 / E2 / G1, one note per beat.
    const bass = [55, 65.41, 82.41, 49];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const freq = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      this._osc('sine', freq, freq, 0.42, 0.11);
      this._osc('triangle', freq * 2, freq * 2, 0.3, 0.04);
    }, 480);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
