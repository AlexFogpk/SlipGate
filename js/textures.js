'use strict';
// Процедурные текстуры: стены, фон, жидкости и небо. Всё генерируется при запуске.

const TEX_SIZE = 64;

function tileNoise(size, cells, rng) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const k = size / cells;
  const at = (i, j) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  return (x, y) => {
    const fx = x / k, fy = y / k;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    let tx = fx - x0, ty = fy - y0;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
  };
}

function texFromFn(fn, size = TEX_SIZE) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = fn(x, y);
      const i = (y * size + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
      d[i + 3] = col.length > 3 ? col[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function genPanels(o, seed) {
  const rng = mulberry32(seed);
  const n1 = tileNoise(64, 16, rng), n2 = tileNoise(64, 4, rng), n3 = tileNoise(64, 32, rng);
  const base = hexToRgb(o.base), light = hexToRgb(o.light), dark = hexToRgb(o.dark);
  const stripe = o.stripe ? hexToRgb(o.stripe) : null;
  const pw = o.pw, ph = o.ph;
  const vars = [];
  for (let i = 0; i < 64; i++) vars.push(rng());
  return (x, y) => {
    const px = Math.floor(x / pw), py = Math.floor(y / ph);
    const lx = x % pw, ly = y % ph;
    const v = 0.88 + vars[(py * 8 + px) % 64] * 0.24;
    const n = 0.82 + n1(x, y) * 0.22 + n2(x, y) * 0.12 + n3(x, y) * 0.06;
    let c = mul(base, v * n);
    if (lx === 0 || ly === 0) c = mul(light, n);
    else if (lx === pw - 1 || ly === ph - 1) c = mul(dark, n);
    else if (lx === 1 || ly === 1) c = mul(c, 1.07);
    else if (lx === pw - 2 || ly === ph - 2) c = mul(c, 0.9);
    if (o.rivets) {
      const rx = lx === 3 || lx === pw - 4, ry = ly === 3 || ly === ph - 4;
      if (rx && ry) c = light;
      const sx = lx === 4 || lx === pw - 3, sy = ly === 4 || ly === ph - 3;
      if (sx && sy) c = dark;
    }
    if (stripe && vars[(py * 8 + px) % 64] > 0.45 && ly >= (ph >> 1) - 1 && ly <= (ph >> 1) + 1 && lx > 2 && lx < pw - 3) {
      c = mul(stripe, (ly === (ph >> 1) - 1 ? 1.2 : 0.9) * n);
      if ((lx >> 1) % 3 === 0) c = mul(c, 0.55);
    }
    if (o.grooves && ly > 3 && ly < ph - 4 && lx > 3 && lx < pw - 4 && ly % 4 === 0) c = mul(c, 0.7);
    return c;
  };
}

function genBricks(o, seed) {
  const rng = mulberry32(seed);
  const n1 = tileNoise(64, 32, rng), n2 = tileNoise(64, 8, rng);
  const base = hexToRgb(o.base), mortar = hexToRgb(o.mortar);
  const alt = o.alt ? hexToRgb(o.alt) : base;
  const bw = o.bw, bh = o.bh;
  const colsN = 64 / bw;
  const vars = [], hues = [];
  for (let i = 0; i < 256; i++) { vars.push(rng()); hues.push(rng()); }
  return (x, y) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * (bw >> 1);
    const xx = (x + off) % 64;
    const col = Math.floor(xx / bw);
    const lx = xx % bw, ly = y % bh;
    const n = 0.78 + n1(x, y) * 0.3 + n2(x, y) * 0.16;
    if (lx === 0 || ly === 0) return mul(mortar, n);
    const id = (row * colsN + col) % 256;
    let f = (1 + (vars[id] - 0.5) * o.vary * 2) * n;
    if (ly === 1) f *= 1.2; else if (ly === bh - 1) f *= 0.7;
    if (lx === 1) f *= 1.08; else if (lx === bw - 1) f *= 0.78;
    const c = mixc(base, alt, hues[id] * 0.6);
    return mul(c, f);
  };
}

function genRock(o, seed) {
  const rng = mulberry32(seed);
  const a = tileNoise(64, 4, rng), b = tileNoise(64, 8, rng), c = tileNoise(64, 16, rng), d = tileNoise(64, 32, rng);
  const h = (x, y) => a(x, y) * 0.45 + b(x, y) * 0.3 + c(x, y) * 0.15 + d(x, y) * 0.1;
  const dark = hexToRgb(o.dark), light = hexToRgb(o.light);
  const accent = o.accent ? hexToRgb(o.accent) : null;
  const vein = o.vein ? hexToRgb(o.vein) : null;
  return (x, y) => {
    const n = h(x, y);
    let col = mixc(dark, light, clamp((n - 0.28) * 2, 0, 1));
    const emb = 1 + (h(x - 1, y - 1) - h(x + 1, y + 1)) * 5;
    col = mul(col, clamp(emb, 0.6, 1.4));
    const cr = Math.abs(b(x, y) - 0.5);
    if (vein && cr < 0.03) col = mixc(vein, col, cr / 0.03);
    else if (cr < 0.02) col = mul(col, 0.55);
    if (accent && c(x, y) > 0.66) col = mixc(col, accent, clamp((c(x, y) - 0.66) * 4, 0, 0.8));
    return col;
  };
}

function genPlanks(o, seed) {
  const rng = mulberry32(seed);
  const n = tileNoise(64, 8, rng), g = tileNoise(64, 32, rng);
  const base = hexToRgb(o.base);
  const ph = 8;
  const seams = [], vars = [];
  for (let r = 0; r < 8; r++) { seams.push(Math.floor(rng() * 64)); vars.push(rng()); }
  return (x, y) => {
    const r = Math.floor(y / ph), ly = y % ph;
    const grain = Math.sin(x * 0.4 + n(x, y) * 10 + r * 7) * 0.07;
    let f = 0.82 + vars[r] * 0.26 + grain + g(x, y) * 0.1;
    if (ly === 0) f *= 0.4; else if (ly === 1) f *= 1.15; else if (ly === ph - 1) f *= 0.75;
    const sx = (x - seams[r] + 64) % 64;
    if (sx === 0) f *= 0.45; else if (sx === 1) f *= 1.12;
    if ((sx === 3 || sx === 61) && ly === 4) return [70, 64, 58];
    return mul(base, f);
  };
}

function genRuneBlocks(o, seed) {
  const rng = mulberry32(seed);
  const n1 = tileNoise(64, 16, rng), n2 = tileNoise(64, 32, rng);
  const base = hexToRgb(o.base), mortar = hexToRgb(o.mortar);
  const glow = o.glow ? hexToRgb(o.glow) : null;
  const bw = 32, bh = 16;
  const mask = new Uint8Array(64 * 64);
  const vars = [];
  const plot = (x, y) => { mask[(((y % 64) + 64) % 64) * 64 + (((x % 64) + 64) % 64)] = 1; };
  const line = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= steps; i++) plot(Math.round(lerp(x0, x1, i / steps)), Math.round(lerp(y0, y1, i / steps)));
  };
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      vars.push(rng());
      if (rng() > o.runeChance) continue;
      const off = (row % 2) * 16;
      const cx = col * bw + off + 16, cy = row * bh + 8;
      // руна: вертикальная черта и 2-3 отростка
      line(cx, cy - 5, cx, cy + 4);
      const k = Math.floor(rng() * 4);
      if (k === 0) { line(cx, cy - 5, cx + 4, cy - 1); line(cx, cy - 1, cx - 4, cy + 3); }
      else if (k === 1) { line(cx - 4, cy - 5, cx + 4, cy + 4); line(cx + 4, cy - 5, cx - 4, cy + 4); }
      else if (k === 2) { line(cx, cy - 2, cx + 4, cy - 5); line(cx, cy - 2, cx - 4, cy - 5); line(cx - 3, cy + 4, cx + 3, cy + 4); }
      else { line(cx, cy - 5, cx + 4, cy - 3); line(cx + 4, cy - 3, cx, cy - 1); line(cx, cy - 1, cx + 4, cy + 4); }
    }
  }
  return (x, y) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * 16;
    const xx = (x + off) % 64;
    const col = Math.floor(xx / bw);
    const lx = xx % bw, ly = y % bh;
    const n = 0.8 + n1(x, y) * 0.25 + n2(x, y) * 0.12;
    if (lx === 0 || ly === 0) return mul(mortar, n);
    let f = (0.9 + vars[(row * 2 + col) % vars.length] * 0.2) * n;
    if (ly === 1) f *= 1.2; else if (ly === bh - 1) f *= 0.7;
    if (lx === 1) f *= 1.1; else if (lx === bw - 1) f *= 0.8;
    if (mask[y * 64 + x]) return glow ? mul(glow, 0.8 + n1(x, y) * 0.4) : mul(base, f * 0.45);
    if (mask[((y + 63) % 64) * 64 + ((x + 63) % 64)]) f *= 1.25;
    return mul(base, f);
  };
}

function genDoor(o, seed) {
  const rng = mulberry32(seed);
  const n1 = tileNoise(64, 16, rng), n2 = tileNoise(64, 32, rng);
  const base = hexToRgb(o.base);
  const band = hexToRgb(o.band || '#4a4a4a');
  return (x, y) => {
    const n = 0.82 + n1(x, y) * 0.22 + n2(x, y) * 0.1;
    const lx = x % 16;
    let f = n;
    if (o.wood) {
      f *= 1 + Math.sin(y * 0.5 + n1(x, y) * 8) * 0.05;
      if (lx === 0) f *= 0.5; else if (lx === 1) f *= 1.1;
      const ly = y % 32;
      if (ly >= 6 && ly <= 9) {
        let c = mul(band, n * (ly === 6 ? 1.3 : ly === 9 ? 0.7 : 1));
        if (lx === 4 && ly === 7) c = [150, 140, 120];
        return c;
      }
      return mul(base, f);
    }
    // металл: вертикальные пластины с утопленными полосами
    if (lx === 0) f *= 0.55; else if (lx === 1) f *= 1.2; else if (lx === 15) f *= 0.7;
    const ly = y % 16;
    if (ly === 0) f *= 0.7; else if (ly === 1) f *= 1.1;
    if (lx >= 6 && lx <= 9 && ly > 3 && ly < 12) f *= lx === 6 ? 0.7 : lx === 9 ? 1.1 : 0.85;
    return mul(base, f);
  };
}

function genLiquid(stops, seed, cells = 4) {
  const rng = mulberry32(seed);
  const a = tileNoise(64, cells, rng), b = tileNoise(64, cells * 2, rng), c = tileNoise(64, cells * 4, rng);
  const cols = stops.map(hexToRgb);
  return (x, y) => {
    let n = a(x, y) * 0.55 + b(x, y) * 0.3 + c(x, y) * 0.15;
    n = 0.5 + Math.sin(n * 14) * 0.5;
    if (n < 0.5) return mixc(cols[0], cols[1], n * 2);
    return mixc(cols[1], cols[2], (n - 0.5) * 2);
  };
}

const THEMES = {
  base: {
    wall: () => genPanels({ base: '#6a6254', light: '#948b76', dark: '#2e2a24', pw: 32, ph: 32, rivets: true }, 11),
    wall2: () => genPanels({ base: '#4d4640', light: '#70685c', dark: '#211e1a', pw: 16, ph: 16, stripe: '#b86a22', grooves: true }, 12),
    back: () => genPanels({ base: '#3a3631', light: '#4e4942', dark: '#1d1b18', pw: 32, ph: 16, grooves: true }, 13),
    door: () => genDoor({ base: '#77705f' }, 14),
    plat: '#8a7e66',
    ambient: [0.2, 0.19, 0.21],
    sky: ['#140c26', '#3e2766', '#9a7ac8'],
  },
  castle: {
    wall: () => genBricks({ base: '#74502f', alt: '#6a5a44', mortar: '#2a1c10', bw: 16, bh: 8, vary: 0.18 }, 21),
    wall2: () => genPlanks({ base: '#6a4424' }, 22),
    back: () => genBricks({ base: '#46321f', alt: '#3e3528', mortar: '#1a120a', bw: 16, bh: 8, vary: 0.2 }, 23),
    door: () => genDoor({ base: '#6f4724', band: '#44403a', wood: true }, 24),
    plat: '#7a5530',
    ambient: [0.21, 0.18, 0.15],
    sky: ['#1a0e1a', '#4a2a44', '#b07a8a'],
  },
  crypt: {
    wall: () => genRuneBlocks({ base: '#5e6150', mortar: '#22241c', runeChance: 0.35 }, 31),
    wall2: () => genRock({ dark: '#2c2f24', light: '#6e725c', accent: '#4a5c22' }, 32),
    back: () => genRuneBlocks({ base: '#34372d', mortar: '#15160f', runeChance: 0.2 }, 33),
    door: () => genDoor({ base: '#62625a' }, 34),
    plat: '#6a6456',
    ambient: [0.19, 0.2, 0.17],
    sky: ['#0e1418', '#27404a', '#7a9aa0'],
  },
  cave: {
    wall: () => genRock({ dark: '#34261a', light: '#86694a' }, 41),
    wall2: () => genRock({ dark: '#202a16', light: '#5c6c38', accent: '#6a7a2a' }, 42),
    back: () => genRock({ dark: '#1a140e', light: '#44372a' }, 43),
    door: () => genDoor({ base: '#6a4a2c', band: '#3e3a36', wood: true }, 44),
    plat: '#76603e',
    ambient: [0.19, 0.17, 0.14],
    sky: ['#0c1010', '#243030', '#6a8070'],
  },
  rune: {
    wall: () => genRuneBlocks({ base: '#50566a', mortar: '#181b24', glow: '#6a9aff', runeChance: 0.3 }, 71),
    wall2: () => genBricks({ base: '#454a5a', alt: '#3e4a4a', mortar: '#15171e', bw: 16, bh: 8, vary: 0.2 }, 72),
    back: () => genRuneBlocks({ base: '#2e3240', mortar: '#101218', runeChance: 0.18 }, 73),
    door: () => genDoor({ base: '#5c6070', band: '#303440' }, 74),
    plat: '#6e7280',
    ambient: [0.18, 0.19, 0.25],
    sky: ['#04081a', '#1a2a5e', '#7a9ae0'],
  },
  nether: {
    wall: () => genRock({ dark: '#1c1022', light: '#56385e', vein: '#c040ff' }, 81),
    wall2: () => genRuneBlocks({ base: '#3e2e48', mortar: '#140c18', glow: '#e060ff', runeChance: 0.45 }, 82),
    back: () => genBricks({ base: '#261a2e', alt: '#2e1a24', mortar: '#0c080e', bw: 16, bh: 8, vary: 0.22 }, 83),
    door: () => genDoor({ base: '#4e4458', band: '#2a2230' }, 84),
    plat: '#5e4a66',
    ambient: [0.19, 0.15, 0.22],
    sky: ['#0e0214', '#4a0a3e', '#d05090'],
  },
  elder: {
    wall: () => genRock({ dark: '#2e1512', light: '#6a4034', vein: '#e0601c' }, 51),
    wall2: () => genRuneBlocks({ base: '#4a3c3a', mortar: '#1a1212', glow: '#e87030', runeChance: 0.5 }, 52),
    back: () => genBricks({ base: '#321a16', alt: '#2a2020', mortar: '#0e0706', bw: 16, bh: 8, vary: 0.22 }, 53),
    door: () => genDoor({ base: '#5e4c46' }, 54),
    plat: '#6a4232',
    ambient: [0.21, 0.16, 0.14],
    sky: ['#1a0606', '#5a1a10', '#d06030'],
  },
};

const Tex = {
  themes: {},
  liquids: null,
  liquidAnim: null,
  warpTmp: null,
  skies: {},

  get(theme) {
    if (this.themes[theme]) return this.themes[theme];
    const def = THEMES[theme] || THEMES.base;
    const backFn = def.back();
    const backRaw = texFromFn((x, y) => { const c = backFn(x, y); return [c[0] * 1.35, c[1] * 1.35, c[2] * 1.35]; });
    // затемняем фон и добавляем «грязь», чтобы он читался как задняя стена
    const back = makeCanvas(64, 64);
    const bctx = back.getContext('2d');
    bctx.drawImage(backRaw, 0, 0);
    const rng = mulberry32(99);
    const grime = tileNoise(64, 4, rng);
    const gimg = bctx.getImageData(0, 0, 64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const f = 0.78 * (0.75 + grime(x, y) * 0.35);
        gimg.data[i] *= f; gimg.data[i + 1] *= f; gimg.data[i + 2] *= f;
      }
    }
    bctx.putImageData(gimg, 0, 0);
    // текстуры светлее «нормы»: карта освещения затем приглушает всё, что вдали от ламп
    const bright = (fn, k) => (x, y) => { const c = fn(x, y); return [c[0] * k, c[1] * k, c[2] * k]; };
    const set = {
      wall: texFromFn(bright(def.wall(), 1.4)),
      wall2: texFromFn(bright(def.wall2(), 1.4)),
      back,
      door: texFromFn(bright(def.door(), 1.3)),
      plat: def.plat,
      ambient: def.ambient,
      skyCols: def.sky,
    };
    this.themes[theme] = set;
    return set;
  },

  initLiquids() {
    if (this.liquids) return;
    this.liquids = {
      water: texFromFn(genLiquid(['#0e2436', '#23506a', '#4f8298'], 61)),
      slime: texFromFn(genLiquid(['#1a2e06', '#3f6a14', '#86b036'], 62)),
      lava: texFromFn(genLiquid(['#5a0a00', '#d04008', '#ffd050'], 63)),
      tele: texFromFn(genLiquid(['#0a0420', '#3a1a8a', '#b0a0ff'], 64, 2)),
    };
    this.liquidAnim = {};
    for (const k in this.liquids) this.liquidAnim[k] = makeCanvas(64, 64);
    this.warpTmp = makeCanvas(64, 64);
  },

  // «Турбулентность» в духе Quake: смещение строк и столбцов по синусу.
  animateLiquids(t) {
    const tmp = this.warpTmp.getContext('2d');
    for (const k in this.liquids) {
      const src = this.liquids[k];
      const dst = this.liquidAnim[k].getContext('2d');
      const sp = k === 'lava' ? 0.6 : k === 'tele' ? 2.5 : 1.2;
      tmp.clearRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 2) {
        const off = Math.round(Math.sin(t * sp * 1.7 + y * 0.2) * 3);
        tmp.drawImage(src, 0, y, 64, 2, off, y, 64, 2);
        tmp.drawImage(src, 0, y, 64, 2, off - 64 * Math.sign(off || 1), y, 64, 2);
      }
      dst.clearRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 2) {
        const off = Math.round(Math.sin(t * sp * 1.3 + x * 0.2 + 1.3) * 3);
        dst.drawImage(this.warpTmp, x, 0, 2, 64, x, off, 2, 64);
        dst.drawImage(this.warpTmp, x, 0, 2, 64, x, off - 64 * Math.sign(off || 1), 2, 64);
      }
    }
  },

  sky(theme) {
    if (this.skies[theme]) return this.skies[theme];
    const cols = (THEMES[theme] || THEMES.base).sky.map(hexToRgb);
    const rng = mulberry32(77);
    const a = tileNoise(128, 4, rng), b = tileNoise(128, 8, rng), c = tileNoise(128, 16, rng);
    const back = texFromFn((x, y) => {
      const n = a(x, y) * 0.5 + b(x, y) * 0.3 + c(x, y) * 0.2;
      return mixc(cols[0], cols[1], clamp(n * 1.3 - 0.1, 0, 1));
    }, 128);
    const rng2 = mulberry32(78);
    const a2 = tileNoise(128, 4, rng2), b2 = tileNoise(128, 8, rng2), c2 = tileNoise(128, 32, rng2);
    const front = texFromFn((x, y) => {
      const n = a2(x, y) * 0.5 + b2(x, y) * 0.35 + c2(x, y) * 0.15;
      const al = clamp((n - 0.48) * 4, 0, 1);
      const col = mixc(cols[1], cols[2], clamp((n - 0.5) * 3, 0, 1));
      return [col[0], col[1], col[2], al * 230];
    }, 128);
    this.skies[theme] = { back, front };
    return this.skies[theme];
  },
};
