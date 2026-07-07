// Procedural audio via WebAudio — no external files. Covers the sound
// categories from dev spec §15 plus an adaptive tension bed.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bed = null;       // ambient pad
    this.bedGain = null;
    this.volume = 0.7;
    this.ready = false;
    this.enabled = true;
  }

  // Must be called from a user gesture (browsers block autoplay otherwise).
  resume() {
    if (!this.ctx) this._init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(ctx.destination);

    // Ambient bed: two detuned saws through a gentle lowpass, quiet by default.
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;
    bedGain.connect(filter);
    filter.connect(master);

    const oscA = ctx.createOscillator(); oscA.type = 'sawtooth'; oscA.frequency.value = 55;
    const oscB = ctx.createOscillator(); oscB.type = 'sawtooth'; oscB.frequency.value = 55 * 1.005;
    const oscC = ctx.createOscillator(); oscC.type = 'sine'; oscC.frequency.value = 110;
    const bg = ctx.createGain(); bg.gain.value = 0.5;
    oscA.connect(bg); oscB.connect(bg); oscC.connect(bg); bg.connect(bedGain);
    oscA.start(); oscB.start(); oscC.start();

    this.ctx = ctx; this.master = master; this.bedGain = bedGain; this.bedFilter = filter;
    this.ready = true;
    this.setVolume(this.volume);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // Tension 0..1 drives the ambient bed brightness/loudness (red light => tense).
  setTension(t) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.bedGain.gain.setTargetAtTime(0.02 + t * 0.10, now, 0.25);
    this.bedFilter.frequency.setTargetAtTime(420 + t * 900, now, 0.3);
  }

  _env(type, freq, dur, gain = 0.4, opt = {}) {
    if (!this.ready || !this.enabled) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.to), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + (opt.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(this.master);
    o.start(now); o.stop(now + dur + 0.02);
  }

  _noise(dur, gain = 0.3, freq = 1800, type = 'highpass') {
    if (!this.ready || !this.enabled) return;
    const now = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now);
  }

  // ---- named cues ----
  greenStart()  { this._env('triangle', 523, 0.16, 0.35); setTimeout(() => this._env('triangle', 784, 0.18, 0.3), 90); }
  redWarning()  { this._env('square', 440, 0.09, 0.22); }
  redStart()    { this._env('sawtooth', 220, 0.4, 0.4, { to: 90 }); this._noise(0.18, 0.18, 1200, 'lowpass'); }
  freezeSnap()  { this._noise(0.06, 0.25, 3200, 'highpass'); this._env('square', 1200, 0.04, 0.12); }
  uiMove()      { this._env('triangle', 660, 0.05, 0.14); }
  uiSelect()    { this._env('triangle', 880, 0.07, 0.18); }
  syncStart()   { this._env('sine', 520, 0.12, 0.25, { to: 780 }); }
  syncEnd()     { this._env('sine', 400, 0.1, 0.18); }
  action()      { this._env('triangle', 500, 0.09, 0.2, { to: 620 }); }
  penalty()     { this._env('sawtooth', 180, 0.28, 0.35, { to: 70 }); }
  reticleLock() { this._env('square', 300, 0.08, 0.16); this._env('square', 300, 0.08, 0.16); }
  accuse()      { this._env('sawtooth', 660, 0.16, 0.4, { to: 130 }); this._noise(0.1, 0.2, 900, 'lowpass'); }
  caught()      { this._env('sawtooth', 300, 0.6, 0.45, { to: 60 }); this._noise(0.4, 0.25, 700, 'lowpass'); }
  falseAccuse() { this._env('square', 200, 0.22, 0.3, { to: 150 }); }
  heartbeat(i = 1) { this._env('sine', 62, 0.15, 0.22 * i, { to: 40 }); setTimeout(() => this._env('sine', 58, 0.13, 0.16 * i, { to: 38 }), 140); }
  scorePop()    { this._env('triangle', 880, 0.08, 0.2, { to: 1320 }); }
  missionDone() { [660, 880, 1175].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.14, 0.26), i * 70)); }
  roundWin()    { [523, 784, 1047].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.18, 0.3), i * 90)); }
  roundLose()   { [392, 311, 233].forEach((f, i) => setTimeout(() => this._env('sawtooth', f, 0.2, 0.26), i * 110)); }
  alertSting()  { this._env('square', 1500, 0.10, 0.22, { to: 950 }); this._noise(0.05, 0.1, 2800, 'highpass'); }
  relief()      { this._env('sine', 680, 0.28, 0.18, { to: 1180 }); this._noise(0.1, 0.05, 1600, 'highpass'); }
  impact()      { this._env('sawtooth', 150, 0.5, 0.5, { to: 40 }); this._noise(0.3, 0.32, 520, 'lowpass'); this._env('sine', 80, 0.4, 0.4, { to: 36 }); }
  goal()        { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.22, 0.32), i * 110)); }
  win()         { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.3, 0.34), i * 130)); }
  lose()        { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._env('sawtooth', f, 0.34, 0.3), i * 150)); }
}
