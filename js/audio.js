'use strict';
// Синтезированный звук на Web Audio: эффекты и мрачный эмбиент.

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
const Music = {
  nodes: [],
  playing: false,
  wanted: false,
  timer: null,
  root: 55,

  onAudioReady() { if (this.wanted) this.start(this.root); },

  start(root) {
    root = root || 55;
    this.wanted = true;
    if (this.playing) {
      if (root === this.root) return;
      // новый уровень — новая тональность: плавно гасим старый гул и запускаем заново
      this.stop();
      this.wanted = true;
      this.root = root;
      setTimeout(() => { if (this.wanted && !this.playing) this.start(this.root); }, 1300);
      return;
    }
    this.root = root;
    const S = Sound;
    if (!S.ctx) return;
    this.playing = true;
    const ctx = S.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(S.musicBus);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 3;
    lp.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();
    const mk = (type, f, vol, dest) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g); g.connect(dest);
      o.start();
      this.nodes.push(o);
      return o;
    };
    mk('sawtooth', this.root, 0.12, lp);
    mk('sawtooth', this.root * 1.007, 0.12, lp);
    mk('sawtooth', this.root * 1.5 * 0.996, 0.05, lp);
    mk('sine', this.root / 2, 0.22, out);
    this.nodes.push(lfo);
    this.out = out;
    this.schedule();
  },

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      this.event();
      this.schedule();
    }, rand(3500, 8000));
  },

  event() {
    const S = Sound, ctx = S.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + 0.05;
    const o = this.out;
    const k = Math.random();
    const scale = [1, 1.189, 1.335, 1.498, 1.587, 2];
    if (k < 0.3) {
      // металлический удар с долгим хвостом
      S.noise(o, t, 3.5, 0.18, 'bandpass', rand(300, 1400), rand(200, 900), 18, 0.01);
    } else if (k < 0.55) {
      // низкий вздох
      S.noise(o, t, 4, 0.25, 'lowpass', 120, 700, 2, 1.5);
    } else if (k < 0.8) {
      // протяжная нота
      const f = this.root * 4 * pick(scale);
      S.osc(o, 'triangle', f, f * 0.99, t, 5, 0.05, 1.8);
      S.osc(o, 'sine', f * 1.5, f * 1.49, t + 0.5, 4.5, 0.025, 1.8);
    } else {
      // «сердцебиение»
      for (let i = 0; i < 2; i++) {
        S.osc(o, 'sine', 60, 35, t + i * 0.28, 0.25, 0.35, 0.01);
        S.osc(o, 'sine', 60, 35, t + 0.9 + i * 0.28, 0.25, 0.3, 0.01);
      }
    }
  },

  stop() {
    this.wanted = false;
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    const ctx = Sound.ctx;
    const out = this.out;
    const nodes = this.nodes;
    this.nodes = [];
    this.out = null;
    if (out) {
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    }
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* уже остановлен */ } }), 1400);
  },
};
