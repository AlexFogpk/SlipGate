'use strict';
// Синтезированный звук на Web Audio: эффекты и мрачный эмбиент с боевым слоем.

const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuf: null,
  volume: Store.get('volume', 0.8),
  musicVolume: Store.get('musicVolume', 0.5),
  listenerX: 0,
  listenerY: 0,
  lastPlay: {},

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Music.onAudioReady();
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.volume;
    this.musicBus.gain.value = this.musicVolume * 0.6;
  },

  setVolume(v) { this.volume = clamp(v, 0, 1); Store.set('volume', this.volume); this.applyVolumes(); },
  setMusicVolume(v) { this.musicVolume = clamp(v, 0, 1); Store.set('musicVolume', this.musicVolume); this.applyVolumes(); },

  // --- примитивы ---
  osc(out, type, f0, f1, t, dur, vol, attack = 0.005) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  },

  noise(out, t, dur, vol, ftype, f0, f1, q = 1, attack = 0.004) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },

  // Воспроизведение с позиционированием относительно слушателя (игрока).
  play(name, x, y, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = this.ctx.currentTime;
    const minGap = opts.gap !== undefined ? opts.gap : 0.03;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    let vol = opts.vol !== undefined ? opts.vol : 1;
    let pan = 0;
    if (x !== undefined && x !== null) {
      const d = dist(x, y, this.listenerX, this.listenerY);
      vol *= clamp(1 - d / 750, 0, 1);
      pan = clamp((x - this.listenerX) / 320, -1, 1) * 0.8;
      if (vol < 0.02) return;
    }
    let out = this.sfxBus;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.sfxBus);
      out = p;
    }
    try { fn(this, out, now, vol, opts.p || 1); } catch (e) { /* звук не обязателен */ }
  },
};

// Библиотека эффектов: (S, out, t, v, pitch).
const SFX = {
  shotgun(S, o, t, v) {
    S.noise(o, t, 0.28, 0.9 * v, 'lowpass', 4000, 300, 0.7);
    S.osc(o, 'sine', 140, 40, t, 0.18, 0.9 * v);
    S.noise(o, t + 0.12, 0.08, 0.15 * v, 'bandpass', 2500, 1500, 3);
  },
  sshotgun(S, o, t, v) {
    S.noise(o, t, 0.45, 1.0 * v, 'lowpass', 3500, 200, 0.7);
    S.osc(o, 'sine', 110, 30, t, 0.3, 1.0 * v);
    S.noise(o, t + 0.02, 0.3, 0.6 * v, 'lowpass', 2000, 150, 0.7);
  },
  nail(S, o, t, v, p) {
    S.osc(o, 'square', 1100 * p, 380 * p, t, 0.045, 0.16 * v);
    S.noise(o, t, 0.05, 0.25 * v, 'highpass', 3000, 3000, 0.7);
  },
  ric(S, o, t, v) {
    S.osc(o, 'sine', rand(1800, 2600), rand(900, 1300), t, 0.09, 0.12 * v);
  },
  grenade(S, o, t, v) {
    S.osc(o, 'sine', 220, 60, t, 0.18, 0.7 * v);
    S.noise(o, t, 0.12, 0.4 * v, 'lowpass', 900, 200, 1);
  },
  bounce(S, o, t, v) {
    S.osc(o, 'triangle', 700, 400, t, 0.06, 0.25 * v);
  },
  rocket(S, o, t, v) {
    S.noise(o, t, 0.55, 0.7 * v, 'bandpass', 300, 1800, 1.5, 0.02);
    S.osc(o, 'sawtooth', 90, 45, t, 0.35, 0.25 * v);
  },
  explode(S, o, t, v) {
    S.noise(o, t, 1.3, 1.1 * v, 'lowpass', 2200, 60, 0.8);
    S.osc(o, 'sine', 80, 25, t, 0.6, 1.0 * v);
    S.noise(o, t + 0.05, 0.9, 0.4 * v, 'bandpass', 600, 100, 1);
  },
  lightning(S, o, t, v) {
    S.osc(o, 'sawtooth', rand(95, 140), rand(70, 100), t, 0.13, 0.28 * v);
    S.noise(o, t, 0.12, 0.25 * v, 'bandpass', rand(2500, 4000), 2000, 2);
  },
  zap(S, o, t, v) {
    S.noise(o, t, 0.5, 0.9 * v, 'bandpass', 3000, 400, 1.5);
    S.osc(o, 'sawtooth', 200, 40, t, 0.6, 0.5 * v);
  },
  axe(S, o, t, v) { S.noise(o, t, 0.16, 0.45 * v, 'bandpass', 1800, 500, 1.2, 0.03); },
  axehit(S, o, t, v) {
    S.osc(o, 'square', 170, 70, t, 0.1, 0.35 * v);
    S.noise(o, t, 0.1, 0.5 * v, 'lowpass', 1800, 300, 1);
  },
  jump(S, o, t, v) {
    S.osc(o, 'sawtooth', 170, 230, t, 0.1, 0.12 * v);
    S.noise(o, t, 0.08, 0.1 * v, 'bandpass', 900, 700, 3);
  },
  land(S, o, t, v) { S.noise(o, t, 0.1, 0.35 * v, 'lowpass', 500, 100, 1); },
  pain(S, o, t, v, p) {
    S.osc(o, 'sawtooth', 260 * p, 140 * p, t, 0.22, 0.3 * v);
    S.noise(o, t, 0.2, 0.15 * v, 'bandpass', 800 * p, 500 * p, 2);
  },
  death(S, o, t, v, p) {
    S.osc(o, 'sawtooth', 320 * p, 50 * p, t, 0.9, 0.35 * v);
    S.noise(o, t, 0.6, 0.2 * v, 'bandpass', 700 * p, 200, 2);
  },
  gib(S, o, t, v) {
    S.noise(o, t, 0.45, 1.0 * v, 'lowpass', 1400, 150, 1);
    for (let i = 0; i < 4; i++) S.noise(o, t + 0.05 + i * 0.07, 0.07, 0.4 * v, 'bandpass', rand(300, 900), 200, 4);
  },
  splat(S, o, t, v) { S.noise(o, t, 0.12, 0.35 * v, 'bandpass', rand(400, 800), 200, 3); },
  pickup(S, o, t, v) {
    S.osc(o, 'square', 660, 660, t, 0.07, 0.12 * v);
    S.osc(o, 'square', 990, 990, t + 0.07, 0.1, 0.12 * v);
  },
  health(S, o, t, v) { S.osc(o, 'sine', 440, 880, t, 0.25, 0.3 * v); S.osc(o, 'sine', 660, 1320, t, 0.25, 0.12 * v); },
  armor(S, o, t, v) {
    S.osc(o, 'triangle', 300, 620, t, 0.3, 0.35 * v);
    S.noise(o, t, 0.25, 0.2 * v, 'highpass', 4000, 3000, 1);
  },
  weapon(S, o, t, v) {
    S.osc(o, 'square', 196, 196, t, 0.12, 0.15 * v);
    S.osc(o, 'square', 294, 294, t + 0.08, 0.14, 0.15 * v);
    S.noise(o, t, 0.08, 0.3 * v, 'bandpass', 2000, 1500, 2);
  },
  powerup(S, o, t, v) {
    S.osc(o, 'sawtooth', 110, 440, t, 0.9, 0.25 * v, 0.05);
    S.osc(o, 'square', 220, 880, t, 0.9, 0.1 * v, 0.05);
  },
  powerdown(S, o, t, v) { S.osc(o, 'square', 600, 200, t, 0.4, 0.12 * v); },
  key(S, o, t, v) {
    S.osc(o, 'sine', 1200, 1200, t, 0.9, 0.2 * v);
    S.osc(o, 'sine', 1800, 1800, t + 0.06, 0.8, 0.12 * v);
  },
  door(S, o, t, v) {
    S.noise(o, t, 0.9, 0.35 * v, 'lowpass', 400, 150, 1, 0.05);
    S.osc(o, 'sawtooth', 55, 48, t, 0.9, 0.12 * v, 0.05);
  },
  crush(S, o, t, v) {
    S.noise(o, t, 0.5, 1.0 * v, 'lowpass', 900, 60, 1);
    S.osc(o, 'sine', 70, 30, t, 0.4, 0.9 * v);
    S.noise(o, t, 0.15, 0.4 * v, 'bandpass', 2400, 1200, 3);
  },
  jumppad(S, o, t, v) {
    S.osc(o, 'sine', 180, 900, t, 0.35, 0.35 * v, 0.01);
    S.noise(o, t, 0.35, 0.3 * v, 'bandpass', 600, 3000, 2);
  },
  shield(S, o, t, v) { S.osc(o, 'triangle', 900, 1400, t, 0.12, 0.12 * v); },
  zapsmall(S, o, t, v) {
    S.noise(o, t, 0.25, 0.5 * v, 'bandpass', 3500, 900, 2);
    S.osc(o, 'sawtooth', 160, 80, t, 0.25, 0.2 * v);
  },
  lift(S, o, t, v) {
    S.noise(o, t, 0.7, 0.25 * v, 'lowpass', 260, 180, 2, 0.08);
    S.osc(o, 'square', 70, 62, t, 0.5, 0.05 * v, 0.05);
  },
  checkpoint(S, o, t, v) {
    [523, 659, 784, 1046].forEach((f, i) => S.osc(o, 'sine', f, f, t + i * 0.07, 0.5, 0.16 * v));
  },
  button(S, o, t, v) {
    S.osc(o, 'square', 420, 420, t, 0.05, 0.2 * v);
    S.osc(o, 'square', 640, 640, t + 0.06, 0.07, 0.2 * v);
  },
  secret(S, o, t, v) {
    [392, 523, 659, 784].forEach((f, i) => S.osc(o, 'triangle', f, f, t + i * 0.09, 0.35, 0.18 * v));
  },
  teleport(S, o, t, v) {
    S.osc(o, 'sine', 180, 1600, t, 0.55, 0.3 * v, 0.02);
    S.noise(o, t, 0.6, 0.4 * v, 'bandpass', 400, 4000, 2, 0.02);
  },
  noammo(S, o, t, v) { S.osc(o, 'square', 200, 180, t, 0.05, 0.15 * v); },
  splash(S, o, t, v) { S.noise(o, t, 0.4, 0.5 * v, 'bandpass', 1200, 300, 1.2); },
  gasp(S, o, t, v) { S.noise(o, t, 0.35, 0.3 * v, 'bandpass', 1500, 900, 2, 0.05); },
  gurgle(S, o, t, v) {
    for (let i = 0; i < 3; i++) S.osc(o, 'sine', rand(200, 400), rand(500, 800), t + i * 0.08, 0.06, 0.2 * v);
  },
  burn(S, o, t, v) { S.noise(o, t, 0.3, 0.45 * v, 'highpass', 2500, 1200, 1); },
  // Голоса монстров
  sight(S, o, t, v, p) {
    S.osc(o, 'sawtooth', 150 * p, 90 * p, t, 0.45, 0.3 * v, 0.03);
    S.noise(o, t, 0.4, 0.25 * v, 'bandpass', 500 * p, 300 * p, 3, 0.03);
  },
  bark(S, o, t, v) {
    S.noise(o, t, 0.1, 0.5 * v, 'bandpass', 900, 500, 3);
    S.noise(o, t + 0.16, 0.1, 0.5 * v, 'bandpass', 900, 500, 3);
  },
  mpain(S, o, t, v, p) { S.osc(o, 'sawtooth', 220 * p, 120 * p, t, 0.18, 0.28 * v); },
  mdeath(S, o, t, v, p) {
    S.osc(o, 'sawtooth', 200 * p, 40 * p, t, 0.7, 0.3 * v);
    S.noise(o, t, 0.4, 0.2 * v, 'lowpass', 900, 100, 1);
  },
  gunshot(S, o, t, v) {
    S.noise(o, t, 0.22, 0.7 * v, 'lowpass', 3000, 300, 0.7);
    S.osc(o, 'sine', 120, 40, t, 0.15, 0.6 * v);
  },
  laser(S, o, t, v) { S.osc(o, 'square', 1400, 500, t, 0.12, 0.15 * v); },
  sword(S, o, t, v) { S.noise(o, t, 0.2, 0.4 * v, 'bandpass', 3000, 1200, 2, 0.04); },
  chainsaw(S, o, t, v) {
    S.osc(o, 'sawtooth', 90, 110, t, 0.3, 0.25 * v);
    S.noise(o, t, 0.3, 0.2 * v, 'bandpass', 1400, 1400, 2);
  },
  spit(S, o, t, v) { S.noise(o, t, 0.15, 0.35 * v, 'bandpass', 1800, 700, 2); },
  fireball(S, o, t, v) { S.noise(o, t, 0.4, 0.5 * v, 'lowpass', 1200, 300, 1, 0.03); },
  charge(S, o, t, v) {
    S.osc(o, 'sawtooth', 60, 520, t, 0.8, 0.22 * v, 0.1);
    S.noise(o, t, 0.8, 0.2 * v, 'bandpass', 500, 3500, 2, 0.1);
  },
  voreball(S, o, t, v) { S.osc(o, 'sine', 320, 110, t, 0.4, 0.3 * v); },
  roar(S, o, t, v) {
    S.osc(o, 'sawtooth', 70, 45, t, 1.6, 0.45 * v, 0.2);
    S.noise(o, t, 1.6, 0.4 * v, 'lowpass', 600, 150, 1, 0.2);
  },
  menu(S, o, t, v) { S.osc(o, 'square', 520, 520, t, 0.04, 0.1 * v); },
  menuok(S, o, t, v) { S.osc(o, 'square', 400, 800, t, 0.12, 0.12 * v); },
  tick(S, o, t, v) { S.osc(o, 'square', 900, 900, t, 0.025, 0.08 * v); },
};

// Фоновый эмбиент: гул, металлические удары и «вздохи» в темноте.
// Музыка: гул тональности уровня, редкие события и боевой слой.
// У каждого эпизода свой характер: E1 — механический гул базы, E2 — колокола и хор
// чёрной магии, E3 — тритоны и сердцебиение Нижнего мира, E4 — холодное мерцание
// Пустоты. Боевой слой — ритм со своим рисунком на эпизод; громкость его задаёт
// игра (setIntensity) по числу встревоженных монстров рядом.
const MUSIC_STYLES = {
  menu: {
    drone: [['sawtooth', 1, 0.12], ['sawtooth', 1.007, 0.12], ['sawtooth', 1.498 * 0.996, 0.05], ['sine', 0.5, 0.22]],
    lp: 260, lfo: 0.05, lfoDepth: 160,
    events: ['metal', 'sigh', 'note', 'heart'], scale: [1, 1.189, 1.335, 1.498, 1.587, 2],
  },
  e1: {
    drone: [['sawtooth', 1, 0.12], ['sawtooth', 1.007, 0.12], ['sawtooth', 1.498 * 0.996, 0.05], ['sine', 0.5, 0.22]],
    lp: 260, lfo: 0.05, lfoDepth: 160,
    events: ['metal', 'sigh', 'machine', 'note', 'heart', 'machine'], scale: [1, 1.189, 1.335, 1.498, 1.587, 2],
    bpm: 104, combat: 'industrial',
  },
  e2: {
    drone: [['sawtooth', 1, 0.08], ['sawtooth', 1.2 * 1.003, 0.05], ['triangle', 2.004, 0.05], ['sine', 0.5, 0.22]],
    lp: 380, lfo: 0.035, lfoDepth: 220,
    events: ['bell', 'choir', 'whisper', 'sigh', 'choir'], scale: [1, 1.067, 1.2, 1.335, 1.498, 1.6, 1.8, 2],
    bpm: 84, combat: 'ritual',
  },
  e3: {
    drone: [['sawtooth', 1, 0.1], ['sawtooth', 1.414, 0.05], ['square', 0.5, 0.035], ['sine', 0.5, 0.2]],
    lp: 210, lfo: 0.08, lfoDepth: 140,
    events: ['swell', 'glass', 'heart', 'metal', 'swell'], scale: [1, 1.059, 1.189, 1.414, 1.498, 1.682, 2],
    bpm: 126, combat: 'pulse',
  },
  e4: {
    drone: [['sine', 1, 0.12], ['sine', 1.498, 0.06], ['triangle', 2.003, 0.04], ['sine', 0.5, 0.24], ['sawtooth', 1.002, 0.03]],
    lp: 700, lfo: 0.025, lfoDepth: 400,
    events: ['shimmer', 'crystal', 'wind', 'swell', 'shimmer'], scale: [1, 1.125, 1.26, 1.414, 1.498, 1.682, 1.888, 2],
    bpm: 72, combat: 'cosmic',
  },
  finale: {
    drone: [['sine', 1, 0.14], ['sine', 1.498, 0.07], ['triangle', 2, 0.03], ['sine', 0.5, 0.2]],
    lp: 600, lfo: 0.03, lfoDepth: 200,
    events: ['shimmer', 'bell', 'note'], scale: [1, 1.125, 1.26, 1.498, 1.682, 2],
  },
};

const Music = {
  nodes: [],
  playing: false,
  wanted: false,
  timer: null,
  ticker: null,
  root: 55,
  style: 'menu',
  intensity: 0,     // цель боевого слоя 0..1
  combatLevel: 0,   // текущая громкость боевого слоя (плавно догоняет цель)
  step: 0,
  nextStep: 0,

  onAudioReady() { if (this.wanted) this.start(this.root, this.style); },

  start(root, style) {
    root = root || 55;
    style = MUSIC_STYLES[style] ? style : 'menu';
    this.wanted = true;
    if (this.playing) {
      if (root === this.root && style === this.style) return;
      // новый уровень — новая тональность: плавно гасим старый гул и запускаем заново
      this.stop();
      this.wanted = true;
      this.root = root; this.style = style;
      setTimeout(() => { if (this.wanted && !this.playing) this.start(this.root, this.style); }, 1300);
      return;
    }
    this.root = root; this.style = style;
    const S = Sound;
    if (!S.ctx) return;
    this.playing = true;
    const st = MUSIC_STYLES[style];
    const ctx = S.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(S.musicBus);
    // гул идёт через свою шину: в бою он тише и ярче, чтобы ритм читался
    const bed = ctx.createGain();
    bed.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = st.lp;
    lp.Q.value = 3;
    lp.connect(bed);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = st.lfo;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = st.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();
    for (const [type, k, vol] of st.drone) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = this.root * k;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g); g.connect(k < 1 ? bed : lp);
      o.start();
      this.nodes.push(o);
    }
    this.nodes.push(lfo);
    this.out = out;
    this.bed = bed;
    this.lp = lp;
    // боевой слой: своя шина, громкость плавно идёт за интенсивностью
    this.combat = ctx.createGain();
    this.combat.gain.value = 0.0001;
    this.combat.connect(out);
    this.combatLevel = 0;
    this.step = 0;
    this.nextStep = ctx.currentTime + 0.1;
    this.schedule();
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), 100);
  },

  // Игра сообщает, насколько жарко вокруг героя: 0 — тихо, 1 — бой с боссом.
  setIntensity(v) { this.intensity = clamp(v, 0, 1); },

  tick() {
    const ctx = Sound.ctx;
    if (!this.playing || !ctx || !this.combat) return;
    const st = MUSIC_STYLES[this.style];
    const want = st.combat ? this.intensity : 0;
    // вступает за ~1.5 с, затихает за ~5 с после боя
    this.combatLevel += (want - this.combatLevel) * (want > this.combatLevel ? 0.07 : 0.02);
    if (this.combatLevel < 0.005) this.combatLevel = 0;
    const c = this.combatLevel;
    this.combat.gain.setTargetAtTime(Math.max(0.0001, c * 1.3), ctx.currentTime, 0.15);
    this.bed.gain.setTargetAtTime(1 - c * 0.35, ctx.currentTime, 0.3);
    this.lp.frequency.setTargetAtTime(st.lp * (1 + c * 0.8), ctx.currentTime, 0.3);
    const stepLen = st.bpm ? 60 / st.bpm / 4 : 0.25;
    if (this.nextStep < ctx.currentTime) this.nextStep = ctx.currentTime + 0.05;
    while (this.nextStep < ctx.currentTime + 0.3) {
      if (this.combatLevel > 0.02) this.combatStep(st.combat, this.step, this.nextStep, stepLen);
      this.nextStep += stepLen;
      this.step++;
    }
  },

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      this.event();
      this.schedule();
    }, rand(3500, 8000));
  },

  // --- инструменты ---
  // Пэд через полосовые фильтры-форманты: «хор» без сэмплов.
  pad(f, t, dur, vol, formants) {
    const S = Sound, ctx = S.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
    for (const det of [0.996, 1.004]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * det;
      for (const [ff, q] of formants) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        o.connect(bp); bp.connect(g);
      }
      o.start(t); o.stop(t + dur + 0.1);
    }
  },

  // Нарастание и обрыв — как звук, пущенный задом наперёд.
  swell(f, t, dur, vol, type = 'sawtooth') {
    const S = Sound, ctx = S.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 1.02, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(lp); lp.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.15);
  },

  bell(f, t, vol, dur = 5) {
    const S = Sound;
    [[1, 1], [2, 0.6], [2.4, 0.45], [3, 0.3], [4.2, 0.22], [5.4, 0.12]].forEach(([k, a], i) => {
      S.osc(this.out, 'sine', f * k, f * k * 0.999, t, dur / (1 + i * 0.4), vol * a, 0.004);
    });
  },

  event() {
    const S = Sound, ctx = S.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + 0.05;
    const o = this.out;
    const st = MUSIC_STYLES[this.style];
    const scale = st.scale;
    const root = this.root;
    switch (pick(st.events)) {
      case 'metal':
        // металлический удар с долгим хвостом
        S.noise(o, t, 3.5, 0.18, 'bandpass', rand(300, 1400), rand(200, 900), 18, 0.01);
        break;
      case 'sigh':
        // низкий вздох
        S.noise(o, t, 4, 0.25, 'lowpass', 120, 700, 2, 1.5);
        break;
      case 'note': {
        // протяжная нота
        const f = root * 4 * pick(scale);
        S.osc(o, 'triangle', f, f * 0.99, t, 5, 0.05, 1.8);
        S.osc(o, 'sine', f * 1.5, f * 1.49, t + 0.5, 4.5, 0.025, 1.8);
        break;
      }
      case 'heart':
        // «сердцебиение»
        for (let i = 0; i < 2; i++) {
          S.osc(o, 'sine', 60, 35, t + i * 0.28, 0.25, 0.35, 0.01);
          S.osc(o, 'sine', 60, 35, t + 0.9 + i * 0.28, 0.25, 0.3, 0.01);
        }
        break;
      case 'machine': {
        // далёкий механизм: серия лязгов с затихающим эхом
        const f = rand(500, 1200), n = randInt(4, 7), gap = rand(0.16, 0.24);
        for (let i = 0; i < n; i++) S.noise(o, t + i * gap, 0.5, 0.12 * (1 - i / (n + 2)), 'bandpass', f * (i % 2 ? 0.8 : 1), f * 0.7, 12, 0.003);
        S.osc(o, 'sawtooth', root, root * 0.94, t, n * gap + 0.6, 0.04, 0.2);
        break;
      }
      case 'bell':
        this.bell(root * 4 * pick([1, 1.2, 1.498]), t, 0.06, 6);
        if (Math.random() < 0.5) this.bell(root * 2, t + 1.6, 0.05, 6);
        break;
      case 'choir': {
        const f = root * 2 * pick(scale);
        const vowel = pick([[[700, 6], [1150, 8]], [[400, 6], [800, 8]], [[300, 6], [2200, 10]]]);
        this.pad(f, t, rand(5, 7), 0.07, vowel);
        if (Math.random() < 0.6) this.pad(f * 1.498, t + 0.8, 5, 0.04, vowel);
        break;
      }
      case 'whisper':
        S.noise(o, t, 2.6, 0.05, 'bandpass', rand(1800, 2600), rand(3000, 4200), 4, 1);
        S.noise(o, t + 1.4, 2.2, 0.04, 'bandpass', rand(2400, 3400), rand(1600, 2200), 5, 0.8);
        break;
      case 'swell':
        this.swell(root * 2 * pick(scale), t, rand(2.5, 4), 0.07);
        if (Math.random() < 0.5) this.swell(root * 2 * 1.414, t, 3, 0.04, 'square');
        break;
      case 'glass': {
        const f = root * 8 * pick(scale);
        for (let i = 0; i < 3; i++) {
          S.osc(o, 'sine', f, f, t + i * 0.9, 2.5, 0.03, 0.01);
          S.osc(o, 'sine', f * 1.006, f * 1.006, t + i * 0.9, 2.5, 0.03, 0.01);
        }
        break;
      }
      case 'shimmer':
        for (let i = 0; i < 4; i++) {
          const f = root * 8 * scale[randInt(0, scale.length - 1)];
          S.osc(o, 'sine', f, f * 1.003, t + i * 0.35, 6, 0.018, 2.2);
        }
        break;
      case 'crystal': {
        const n = randInt(3, 6);
        for (let i = 0; i < n; i++) {
          const f = root * 8 * scale[(scale.length - 1 - i * 2 + scale.length * 4) % scale.length];
          S.osc(o, 'triangle', f, f, t + i * 0.22, 1.4, 0.035, 0.003);
          S.osc(o, 'triangle', f, f, t + i * 0.22 + 0.66, 1.2, 0.012, 0.003);
        }
        break;
      }
      case 'wind':
        S.noise(o, t, 7, 0.12, 'bandpass', 300, 900, 3, 3);
        break;
      default: break;
    }
  },

  // Один шаг (шестнадцатая) боевого ритма.
  combatStep(kind, step, t, len) {
    const S = Sound, o = this.combat, root = this.root;
    const s = step % 16, bar = Math.floor(step / 16);
    const kick = (vol = 0.5, f = 95) => S.osc(o, 'sine', f, 38, t, 0.28, vol, 0.002);
    const snare = (vol = 0.22) => S.noise(o, t, 0.16, vol, 'bandpass', 1900, 1200, 0.8, 0.002);
    const hat = (vol = 0.05) => S.noise(o, t, 0.045, vol, 'highpass', 7000, 7000, 0.7, 0.001);
    const bass = (f, dur, vol = 0.09, type = 'sawtooth') => {
      S.osc(o, type, f, f, t, dur, vol, 0.004);
      S.osc(o, 'sine', f / 2, f / 2, t, dur, vol * 1.2, 0.004);
    };
    switch (kind) {
      case 'industrial': {
        // E1: тяжёлый механический бит, пилящий бас и лязг на сильных долях
        if ([0, 6, 8, 11].includes(s) || (bar % 4 === 3 && s === 14)) kick();
        if (s === 4 || s === 12) { snare(); S.noise(o, t, 0.3, 0.06, 'bandpass', 600, 400, 10, 0.002); }
        if (s % 2 === 1) hat(s % 4 === 3 ? 0.06 : 0.035);
        const line = [1, 0, 0, 1, 0, 0, 1.189, 0, 1, 0, 1.335, 0, 0, 0, 1.189, 0];
        if (line[s]) bass(root * line[s], len * 1.6);
        if (s === 0 && bar % 2 === 0) S.noise(o, t, 1.2, 0.08, 'bandpass', 900, 500, 16, 0.003);
        break;
      }
      case 'ritual': {
        // E2: там-тамы, глухой барабан и колокол раз в два такта
        const tom = (f, vol) => S.osc(o, 'sine', f, f * 0.55, t, 0.35, vol, 0.002);
        if (s === 0 || s === 8) kick(0.45, 80);
        if ([3, 6, 10, 13].includes(s)) tom(150, 0.28);
        if ([12, 14, 15].includes(s) && bar % 2 === 1) tom(200, 0.22);
        if (s % 4 === 2) S.noise(o, t, 0.08, 0.04, 'bandpass', 3000, 2500, 2, 0.002);
        if (s === 0 && bar % 2 === 0) this.bell(root * 4, t, 0.045, 3);
        if (s === 0) bass(root * (bar % 4 === 3 ? 1.067 : 1), len * 7, 0.06, 'triangle');
        break;
      }
      case 'pulse': {
        // E3: учащённое сердцебиение и тритоновый пульс баса восьмыми
        if (s === 0 || s === 2 || s === 8 || s === 10) kick(s % 8 === 0 ? 0.5 : 0.35, 70);
        if (s % 2 === 0) bass(root * (bar % 2 ? 1.414 : 1) * (s === 6 || s === 14 ? 1.059 : 1), len * 1.2, 0.07, 'square');
        if (s % 4 === 3) hat(0.04);
        if (s === 12) S.noise(o, t, 0.5, 0.08, 'bandpass', 400, 2600, 6, 0.3);
        break;
      }
      case 'cosmic': {
        // E4: редкие глубокие удары и арпеджио из колокольчиков
        if (s === 0 || s === 10) kick(0.45, 60);
        if (s === 8) S.noise(o, t, 0.6, 0.06, 'lowpass', 900, 200, 1, 0.002);
        const sc = MUSIC_STYLES.e4.scale;
        if (s % 2 === 0) {
          const f = root * 8 * sc[(s / 2 + bar * 3) % sc.length];
          S.osc(o, 'triangle', f, f, t, len * 3, 0.03, 0.003);
          S.osc(o, 'sine', f * 2, f * 2, t + len * 3, len * 3, 0.01, 0.003);
        }
        if (s === 0 && bar % 2 === 0) S.osc(o, 'sine', root, root, t, len * 30, 0.12, 0.8);
        break;
      }
      default: break;
    }
  },

  stop() {
    this.wanted = false;
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    clearInterval(this.ticker);
    const ctx = Sound.ctx;
    const out = this.out;
    const nodes = this.nodes;
    this.nodes = [];
    this.out = null;
    this.combat = null; this.bed = null; this.lp = null;
    if (out) {
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    }
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* уже остановлен */ } }), 1400);
  },
};
