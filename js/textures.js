'use strict';
// Процедурные текстуры: стены, фон, кромки, площадки, жидкости и небо.
// Всё генерируется при запуске и приводится к собственной 256-цветной палитре
// в духе шутеров девяностых: бурые металлы, камень, ржавчина, грязь.

const TEX_SIZE = 64;

// ---------------- палитра ----------------
// 16 рядов по 16 оттенков: от почти чёрного до выбеленного.
const QPAL_ANCHORS = [
  [128, 128, 128], // серый
  [124, 112, 96], // серо-бурый металл
  [112, 80, 48], // тёмно-коричневый (дерево, земля)
  [150, 124, 88], // песочный камень
  [150, 84, 40], // ржавчина
  [108, 108, 60], // оливковый
  [72, 110, 52], // мох
  [100, 110, 124], // сталь
  [70, 86, 140], // синий
  [112, 72, 128], // фиолетовый
  [140, 40, 32], // кровь
  [200, 96, 28], // оранжевый
  [176, 140, 52], // охра, латунь
  [176, 128, 104], // кожа
  [56, 120, 120], // бирюза
  [255, 200, 120], // огонь
];
const QPAL = [];
for (const a of QPAL_ANCHORS) {
  for (let s = 0; s < 16; s++) {
    const k = 0.07 + s * 0.13;
    QPAL.push(a.map((v) => Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1) * 0.55)));
  }
}
const qLut = new Int16Array(32768).fill(-1);
function qNearest(r, g, b) {
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let idx = qLut[key];
  if (idx < 0) {
    const R = (r & ~7) + 4, G = (g & ~7) + 4, B = (b & ~7) + 4;
    let best = 1e9;
    for (let i = 0; i < QPAL.length; i++) {
      const p = QPAL[i], dr = p[0] - R, dg = p[1] - G, db = p[2] - B;
      const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (d < best) { best = d; idx = i; }
    }
    qLut[key] = idx;
  }
  return QPAL[idx];
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

// ---------------- шум ----------------
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
function fbm(size, rng, cells = [4, 8, 16, 32], w = [0.45, 0.28, 0.17, 0.1]) {
  const fs = cells.map((c) => tileNoise(size, c, rng));
  return (x, y) => { let s = 0; for (let i = 0; i < fs.length; i++) s += fs[i](x, y) * w[i]; return s; };
}

const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

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

// ---------------- холст текстуры ----------------
// Буфер RGB с заворачиванием краёв: всё, что рисуется у кромки, переходит на другую сторону,
// поэтому текстура бесшовно повторяется.
class TB {
  constructor(seed, w = TEX_SIZE, h = w) { this.w = w; this.h = h; this.d = new Float32Array(w * h * 3); this.rng = mulberry32(seed); }
  i(x, y) { const w = this.w, h = this.h; return ((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 3; }
  get(x, y) { const i = this.i(x, y); return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  set(x, y, c) { const i = this.i(x, y); this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; }
  mul(x, y, k) { const i = this.i(x, y); this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k; }
  mix(x, y, c, a) { const i = this.i(x, y); for (let k = 0; k < 3; k++) this.d[i + k] += (c[k] - this.d[i + k]) * a; }
  fill(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, fn(x, y)); }
  rect(x, y, w, h, fn) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) fn(x + i, y + j, i, j); }
  mulRect(x, y, w, h, k) { this.rect(x, y, w, h, (px, py) => this.mul(px, py, k)); }
  // Фаска: светлый верх и левый край, тёмные низ и правый (выпуклая деталь); inv — утопленная.
  bevel(x, y, w, h, hi = 1.3, lo = 0.55, t = 1, inv = false) {
    for (let k = 0; k < t; k++) {
      const f = k === 0 ? 1 : 0.45;
      const a = 1 + ((inv ? lo : hi) - 1) * f, b = 1 + ((inv ? hi : lo) - 1) * f;
      for (let i = k; i < w - k; i++) { this.mul(x + i, y + k, a); this.mul(x + i, y + h - 1 - k, b); }
      for (let j = k + 1; j < h - k - 1; j++) { this.mul(x + k, y + j, 1 + (a - 1) * 0.8); this.mul(x + w - 1 - k, y + j, 1 + (b - 1) * 0.8); }
    }
  }
  // Болт 2×2 с тенью.
  bolt(x, y) {
    this.mul(x, y, 1.6); this.mul(x + 1, y, 1.25); this.mul(x, y + 1, 1.2); this.mul(x + 1, y + 1, 0.8);
    this.mul(x + 2, y + 1, 0.6); this.mul(x + 1, y + 2, 0.6); this.mul(x + 2, y + 2, 0.7);
  }
  // Трещина: тёмная ломаная со светлой кромкой справа-снизу.
  crack(x, y, len, down = true) {
    const r = this.rng;
    for (let i = 0; i < len; i++) {
      this.mul(x, y, 0.42);
      this.mul(x + 1, y, 1.12);
      if (down) { y++; if (r() < 0.45) x += r() < 0.5 ? -1 : 1; }
      else { x++; if (r() < 0.45) y += r() < 0.5 ? -1 : 1; }
    }
  }
  // Потёк (ржавчина, сырость): сверху вниз, затухает.
  streak(x, y, len, c, a) {
    for (let i = 0; i < len; i++) {
      const k = a * (1 - i / len);
      this.mix(x, y + i, c, k);
      if (i < len * 0.5) this.mix(x + 1, y + i, c, k * 0.5);
    }
  }
  grain(amp) { const r = this.rng; for (let i = 0; i < this.d.length; i += 3) { const k = 1 + (r() - 0.5) * amp; this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k; } }
  // Перевод в палитру с лёгким упорядоченным дизерингом.
  canvas(k = 1, dither = 7) {
    const c = makeCanvas(this.w, this.h), ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h), o = img.data;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 3, j = (y * this.w + x) * 4, dd = BAYER4[(y & 3) * 4 + (x & 3)] * dither;
        const p = qNearest(this.d[i] * k + dd, this.d[i + 1] * k + dd, this.d[i + 2] * k + dd);
        o[j] = p[0]; o[j + 1] = p[1]; o[j + 2] = p[2]; o[j + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

// ---------------- металл ----------------
// Клёпаные листы: фаски, болты по углам, ржавые потёки, утопленные вставки.
function texPlates(seed, o) {
  const b = new TB(seed), r = b.rng;
  const base = hexToRgb(o.base), rust = hexToRgb(o.rust || '#7a4a22');
  const n = fbm(64, r);
  b.fill((x, y) => mul(base, 0.8 + n(x, y) * 0.4));
  for (let y = 0; y < 64; y++) { const k = 0.95 + r() * 0.08; for (let x = 0; x < 64; x++) b.mul(x, y, k); } // шлифовка
  for (const [px, py, pw, ph] of o.layout) {
    b.mulRect(px, py, pw, ph, 0.88 + r() * 0.22);
    if (r() < (o.inset ?? 0.5)) { b.bevel(px + 6, py + 6, pw - 12, ph - 12, 1.3, 0.6, 1, true); b.mulRect(px + 7, py + 7, pw - 14, ph - 14, 0.9); }
    b.bevel(px, py, pw, ph, 1.38, 0.5, 2);
    for (const [bx, by] of [[3, 3], [pw - 5, 3], [3, ph - 5], [pw - 5, ph - 5]]) {
      b.bolt(px + bx, py + by);
      if (by > 3 && r() < 0.55) b.streak(px + bx, py + by + 3, 4 + Math.floor(r() * 9), rust, 0.45);
    }
    if (r() < 0.35) b.streak(px + 6 + Math.floor(r() * (pw - 12)), py + 2, 6 + Math.floor(r() * 14), mul(base, 0.5), 0.35);
  }
  b.grain(0.1);
  return b;
}
// Технопанели: решётки, индикаторы, полосы «осторожно».
function texTech(seed, o) {
  const b = new TB(seed), r = b.rng;
  const base = hexToRgb(o.base), n = fbm(64, r);
  b.fill((x, y) => mul(base, 0.82 + n(x, y) * 0.32));
  const lights = [hexToRgb('#e03a20'), hexToRgb('#40d040'), hexToRgb('#f0c030'), hexToRgb('#40a0ff')];
  let kind = 0;
  for (let py = 0; py < 64; py += 32) {
    for (let px = 0; px < 64; px += 16) {
      const t = (kind++ + Math.floor(r() * 2)) % 4;
      if (t === 0) { // решётка
        for (let y = py + 6; y < py + 26; y += 2) for (let x = px + 3; x < px + 13; x++) { b.mul(x, y, 0.35); b.mul(x, y + 1, 1.15); }
      } else if (t === 1) { // индикаторы и экран
        b.bevel(px + 3, py + 5, 10, 8, 1.2, 0.6, 1, true);
        b.rect(px + 4, py + 6, 8, 6, (x, y) => b.set(x, y, mul(hexToRgb('#1e2a22'), 0.8 + r() * 0.4)));
        for (let k = 0; k < 3; k++) {
          const c = lights[Math.floor(r() * 4)];
          b.set(px + 4 + k * 3, py + 17, c); b.set(px + 5 + k * 3, py + 17, mul(c, 0.7));
        }
        b.bevel(px + 3, py + 21, 10, 6, 1.25, 0.6, 1, true);
      } else if (t === 2) { // полоса «осторожно»
        for (let y = py + 12; y < py + 20; y++) for (let x = px; x < px + 16; x++) {
          b.set(x, y, ((x + y) >> 2) % 2 ? hexToRgb('#2a2620') : mul(hexToRgb('#c8a028'), 0.85 + r() * 0.2));
        }
        b.bevel(px, py + 12, 16, 8, 1.2, 0.6, 1);
      } else { // рёбра
        for (let x = px + 3; x < px + 13; x += 3) for (let y = py + 4; y < py + 28; y++) { b.mul(x, y, 1.25); b.mul(x + 1, y, 0.6); }
      }
      b.bevel(px, py, 16, 32, 1.35, 0.5, 1);
      b.bolt(px + 2, py + 2);
      b.bolt(px + 12, py + 28);
    }
  }
  b.grain(0.1);
  return b;
}
// Задняя стена: вертикальные рифлёные панели и швы.
function texRibbed(seed, o) {
  const b = new TB(seed), r = b.rng;
  const base = hexToRgb(o.base), n = fbm(64, r);
  b.fill((x, y) => mul(base, 0.8 + n(x, y) * 0.35));
  for (let px = 0; px < 64; px += 16) {
    b.mulRect(px, 0, 16, 64, 0.9 + r() * 0.2);
    for (let y = 0; y < 64; y++) { b.mul(px + 5, y, 0.6); b.mul(px + 6, y, 1.15); b.mul(px + 10, y, 0.6); b.mul(px + 11, y, 1.15); }
    for (let py = 0; py < 64; py += 32) b.bevel(px, py, 16, 32, 1.3, 0.55, 1);
    if (r() < 0.5) { const vy = 8 + Math.floor(r() * 12); for (let y = vy; y < vy + 8; y += 2) for (let x = px + 2; x < px + 14; x++) b.mul(x, y, 0.45); }
  }
  b.grain(0.12);
  return b;
}
function texMetalDoor(seed, o) {
  const b = new TB(seed), r = b.rng;
  const base = hexToRgb(o.base), n = fbm(64, r);
  b.fill((x, y) => mul(base, 0.84 + n(x, y) * 0.3));
  for (let px = 0; px < 64; px += 16) {
    b.bevel(px, 0, 16, 64, 1.35, 0.5, 2);
    for (let y = 0; y < 64; y++) { b.mul(px + 7, y, 0.55); b.mul(px + 8, y, 1.2); }
    for (let py = 0; py < 64; py += 32) {
      for (let y = py + 24; y < py + 30; y++) for (let x = px + 2; x < px + 14; x++) b.set(x, y, ((x + y) >> 1) % 3 ? mul(hexToRgb(o.stripe || '#b88a20'), 0.9 + r() * 0.15) : hexToRgb('#2a241c'));
      b.bevel(px + 2, py + 24, 12, 6, 1.2, 0.6, 1);
      b.bolt(px + 3, py + 3); b.bolt(px + 11, py + 3);
    }
  }
  b.grain(0.08);
  return b;
}

// ---------------- камень ----------------
// Кладка из блоков разной ширины: оттенок на блок, фаски, сколы, трещины, мох в швах.
function texStones(seed, o) {
  const b = new TB(seed), r = b.rng;
  const stone = hexToRgb(o.stone), alt = hexToRgb(o.alt || o.stone), mortar = hexToRgb(o.mortar);
  const moss = o.moss ? hexToRgb(o.moss) : null;
  const n = fbm(64, r), fine = tileNoise(64, 32, r);
  b.fill((x, y) => mul(mortar, 0.8 + n(x, y) * 0.4));
  const rows = o.rows || [8, 8, 8, 8, 8, 8, 8, 8];
  let y0 = 0;
  for (const h of rows) {
    const start = Math.floor(r() * 64);
    let filled = 0;
    while (filled < 64) {
      let w = o.minW + Math.floor(r() * (o.maxW - o.minW + 1));
      if (64 - filled - w < o.minW) w = 64 - filled;
      const x0 = start + filled;
      const tint = mul(mixc(stone, alt, r()), 0.8 + r() * 0.32);
      const gx = o.gap ?? 1;
      b.rect(x0 + gx, y0 + gx, w - gx, h - gx, (x, y) => b.set(x, y, mul(tint, 0.8 + n(x, y) * 0.28 + fine(x, y) * 0.14)));
      b.bevel(x0 + gx, y0 + gx, w - gx, h - gx, 1.28, 0.62, h > 10 ? 2 : 1);
      // сколы на углах
      if (r() < 0.5) b.set(x0 + gx, y0 + gx, mortar);
      if (r() < 0.5) b.set(x0 + w - 1, y0 + h - 1, mortar);
      if (r() < 0.3) { b.set(x0 + w - 1, y0 + gx, mortar); b.set(x0 + w - 2, y0 + gx, mul(mortar, 1.2)); }
      if (r() < (o.cracks ?? 0.25) && w > 6) b.crack(x0 + 2 + Math.floor(r() * (w - 4)), y0 + gx + 1, Math.max(2, h - 3));
      if (o.carve && r() < o.carve) carveGlyph(b, x0 + Math.floor(w / 2), y0 + Math.floor(h / 2), r, o.glow ? hexToRgb(o.glow) : null);
      filled += w;
    }
    // мох и сырость скапливаются в горизонтальных швах
    if (moss) for (let x = 0; x < 64; x++) if (n(x, y0) > 0.52 && r() < 0.6) { b.mix(x, y0, moss, 0.7); if (r() < 0.4) b.mix(x, y0 + 1, moss, 0.5); }
    y0 += h;
  }
  b.grain(o.grain ?? 0.1);
  return b;
}
// Вырезанная руна: тёмные штрихи со светлой кромкой (или свечение).
function carveGlyph(b, cx, cy, r, glow) {
  const segs = [];
  const k = Math.floor(r() * 5);
  segs.push([0, -4, 0, 4]);
  if (k === 0) segs.push([0, -4, 3, -1], [0, 0, -3, 3]);
  else if (k === 1) segs.push([-3, -4, 3, 4], [3, -4, -3, 4]);
  else if (k === 2) segs.push([0, -1, 3, -4], [0, -1, -3, -4], [-2, 4, 2, 4]);
  else if (k === 3) segs.push([0, -4, 3, -2], [3, -2, 0, 0], [0, 0, 3, 4]);
  else segs.push([-3, -2, 3, -2], [-2, 2, 2, 2]);
  for (const [x0, y0, x1, y1] of segs) {
    const st = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= st; i++) {
      const x = cx + Math.round(lerp(x0, x1, i / st)), y = cy + Math.round(lerp(y0, y1, i / st));
      if (glow) { b.set(x, y, glow); b.mix(x + 1, y + 1, glow, 0.25); }
      else { b.mul(x, y, 0.45); b.mul(x + 1, y + 1, 1.15); }
    }
  }
}
// Скала: слои, рельеф со светом сверху-слева, трещины, камешки, мох и жилы.
function texRock(seed, o) {
  const b = new TB(seed), r = b.rng;
  const dark = hexToRgb(o.dark), light = hexToRgb(o.light);
  const h = fbm(64, r), lay = tileNoise(64, 4, r), fine = tileNoise(64, 32, r);
  const vein = o.vein ? hexToRgb(o.vein) : null, moss = o.moss ? hexToRgb(o.moss) : null;
  const vn = tileNoise(64, 8, r);
  b.fill((x, y) => {
    let v = h(x, y);
    if (o.strata) v = v * 0.7 + (0.5 + Math.sin(y * 0.45 + lay(x, y) * 6) * 0.5) * 0.3;
    let c = mixc(dark, light, clamp((v - 0.25) * 2, 0, 1));
    const emb = 1 + (h(x - 1, y - 1) - h(x + 1, y + 1)) * 6;
    c = mul(c, clamp(emb, 0.55, 1.45) * (0.9 + fine(x, y) * 0.2));
    if (moss && h(x, y - 1) - h(x, y + 1) < -0.02 && v > 0.45) c = mixc(c, moss, 0.55);
    const cr = Math.abs(vn(x, y) - 0.5);
    if (vein && cr < 0.025) c = mixc(vein, c, cr / 0.025);
    else if (cr < 0.018) c = mul(c, 0.5);
    return c;
  });
  // камешки
  for (let i = 0; i < (o.pebbles ?? 10); i++) {
    const x = Math.floor(r() * 64), y = Math.floor(r() * 64);
    b.mul(x, y, 1.45); b.mul(x + 1, y, 1.2); b.mul(x, y + 1, 0.65); b.mul(x + 1, y + 1, 0.6);
  }
  for (let i = 0; i < (o.cracks ?? 3); i++) b.crack(Math.floor(r() * 64), Math.floor(r() * 64), 5 + Math.floor(r() * 10));
  b.grain(0.12);
  return b;
}

// ---------------- дерево ----------------
function texPlanks(seed, o) {
  const b = new TB(seed), r = b.rng;
  const wood = hexToRgb(o.wood), iron = hexToRgb(o.iron || '#4a4640');
  const n = tileNoise(64, 8, r), f = tileNoise(64, 32, r);
  const widths = [], xs = [];
  let x = 0;
  while (x < 64) { let w = 7 + Math.floor(r() * 5); if (64 - x - w < 6) w = 64 - x; xs.push(x); widths.push(w); x += w; }
  const vars = widths.map(() => 0.82 + r() * 0.3);
  b.fill((px, py) => {
    let k = 0;
    while (k + 1 < xs.length && px >= xs[k + 1]) k++;
    const lx = px - xs[k];
    const grain = Math.sin(lx * 1.3 + n(px, py) * 9 + k * 5 + py * 0.06) * 0.08;
    let v = vars[k] * (0.86 + grain + f(px, py) * 0.14);
    if (lx === 0) v *= 0.4; else if (lx === 1) v *= 1.15; else if (lx === widths[k] - 1) v *= 0.75;
    return mul(wood, v);
  });
  // сучки
  for (let i = 0; i < 4; i++) { const kx = Math.floor(r() * 64), ky = Math.floor(r() * 64); b.mul(kx, ky, 0.5); b.mul(kx + 1, ky, 0.65); b.mul(kx, ky + 1, 0.7); }
  // железные полосы с заклёпками
  if (o.bands) {
    for (const by of o.bands) {
      b.rect(0, by, 64, 4, (px, py) => b.set(px, py, mul(iron, 0.85 + r() * 0.25)));
      b.bevel(0, by, 64, 4, 1.35, 0.55, 1);
      for (let px = 3; px < 64; px += 8) b.bolt(px, by + 1);
      for (let px = 0; px < 64; px++) b.mul(px, by + 4, 0.6);
    }
  }
  b.grain(0.08);
  return b;
}

// ---------------- узор «гравированный металл» ----------------
function texEngraved(seed, o) {
  const b = new TB(seed), r = b.rng;
  const base = hexToRgb(o.base), n = fbm(64, r);
  b.fill((x, y) => mul(base, 0.8 + n(x, y) * 0.35));
  for (let py = 0; py < 64; py += 32) {
    for (let px = 0; px < 64; px += 32) {
      b.bevel(px, py, 32, 32, 1.35, 0.5, 2);
      // ромб, утопленный в лист
      for (let k = 0; k < 10; k++) {
        const cx = px + 16, cy = py + 16;
        b.mul(cx - 10 + k, cy - k, 0.55); b.mul(cx + k, cy - 10 + k, 0.55);
        b.mul(cx - 10 + k, cy + k, 1.25); b.mul(cx + k, cy + 10 - k, 1.25);
      }
      b.mulRect(px + 13, py + 13, 6, 6, 0.85);
      if (o.glow) carveGlyph(b, px + 16, py + 16, r, hexToRgb(o.glow));
      for (const [bx, by] of [[3, 3], [27, 3], [3, 27], [27, 27]]) b.bolt(px + bx, py + by);
    }
  }
  b.grain(0.1);
  return b;
}

// ---------------- кромки и площадки ----------------
// Полоса сверху тайла пола (64×6): металлический бортик, каменный карниз, дёрн.
function trimMetal(seed, base) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base);
  b.fill((x, y) => mul(c, [1.5, 1.05, 1, 0.95, 0.62, 0.42][y] * (0.9 + r() * 0.15)));
  for (let x = 2; x < 64; x += 8) b.bolt(x, 1);
  return b;
}
function trimStone(seed, base, moss) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base), m = moss ? hexToRgb(moss) : null;
  b.fill((x, y) => mul(c, [1.4, 1.1, 1.0, 0.75, 0.5, 0.4][y] * (0.88 + r() * 0.2)));
  for (let x = 0; x < 64; x += 16) { const sx = x + Math.floor(r() * 4); for (let y = 1; y < 4; y++) { b.mul(sx, y, 0.5); b.mul(sx + 1, y, 1.15); } }
  if (m) for (let x = 0; x < 64; x++) if (r() < 0.45) { b.mix(x, 0, m, 0.75); if (r() < 0.4) b.mix(x, 1, m, 0.6); }
  return b;
}
function trimRock(seed, base, top) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base), t = hexToRgb(top);
  b.fill((x, y) => mul(c, (0.75 + r() * 0.3) * (y === 5 ? 0.6 : 1)));
  for (let x = 0; x < 64; x++) {
    const d = 1 + Math.floor(r() * 3);
    for (let y = 0; y < d; y++) b.set(x, y, mul(t, (y === 0 ? 1.25 : 0.95) * (0.85 + r() * 0.3)));
  }
  return b;
}
// Площадка-полка (64×6) в стиле темы.
function platGrate(seed, base) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base);
  b.fill((x, y) => mul(c, [1.45, 1.0, 1.0, 0.95, 0.6, 0.4][y] * (0.92 + r() * 0.12)));
  for (let x = 0; x < 64; x += 3) { b.mul(x, 2, 0.35); b.mul(x, 3, 0.4); }
  return b;
}
function platWood(seed, base) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base);
  b.fill((x, y) => mul(c, [1.35, 1.05, 1.0, 0.95, 0.6, 0.4][y] * (0.9 + Math.sin(x * 0.7 + y) * 0.05 + r() * 0.1)));
  for (let x = 0; x < 64; x += 16) { b.mul(x, 1, 0.5); b.mul(x, 2, 0.5); b.mul(x, 3, 0.5); b.mul(x + 3, 2, 1.5); b.mul(x + 12, 2, 1.5); }
  return b;
}
function platStone(seed, base) {
  const b = new TB(seed, 64, 6), r = b.rng, c = hexToRgb(base);
  b.fill((x, y) => mul(c, [1.4, 1.08, 1.0, 0.9, 0.58, 0.4][y] * (0.85 + r() * 0.22)));
  for (let x = 0; x < 64; x += 16) for (let y = 0; y < 5; y++) b.mul(x, y, 0.55);
  return b;
}

// ---------------- жидкости ----------------
function genLiquid(stops, seed, cells = 4) {
  const rng = mulberry32(seed);
  const a = tileNoise(64, cells, rng), b = tileNoise(64, cells * 2, rng), c = tileNoise(64, cells * 4, rng);
  const cols = stops.map(hexToRgb);
  return (x, y) => {
    let n = a(x, y) * 0.55 + b(x, y) * 0.3 + c(x, y) * 0.15;
    n = 0.5 + Math.sin(n * 14) * 0.5;
    const col = n < 0.5 ? mixc(cols[0], cols[1], n * 2) : mixc(cols[1], cols[2], (n - 0.5) * 2);
    return qNearest(col[0] + BAYER4[(y & 3) * 4 + (x & 3)] * 8, col[1] + BAYER4[(y & 3) * 4 + (x & 3)] * 8, col[2] + BAYER4[(y & 3) * 4 + (x & 3)] * 8);
  };
}

// ---------------- темы ----------------
const PLATES_4 = [[0, 0, 32, 32], [32, 0, 32, 32], [0, 32, 32, 32], [32, 32, 32, 32]];
const PLATES_MIX = [[0, 0, 32, 32], [32, 0, 32, 16], [32, 16, 32, 16], [0, 32, 16, 32], [16, 32, 48, 32]];
const THEMES = {
  base: {
    wall: () => texPlates(11, { base: '#6e6656', layout: PLATES_MIX }),
    wall2: () => texTech(12, { base: '#5a564c' }),
    back: () => texRibbed(13, { base: '#4a463e' }),
    door: () => texMetalDoor(14, { base: '#76705e' }),
    trim: () => trimMetal(15, '#6e6656'),
    plat: () => platGrate(16, '#7a7262'),
    ambient: [0.2, 0.19, 0.21],
    sky: ['#140c26', '#3e2766', '#9a7ac8'],
  },
  castle: {
    wall: () => texStones(21, { stone: '#8a6640', alt: '#76603e', mortar: '#2a1c10', minW: 9, maxW: 22, rows: [8, 8, 8, 8, 8, 8, 8, 8] }),
    wall2: () => texStones(22, { stone: '#9a8460', alt: '#8a7a5e', mortar: '#2e2216', minW: 16, maxW: 32, rows: [16, 16, 16, 16], cracks: 0.3 }),
    back: () => texStones(23, { stone: '#584430', alt: '#4e4034', mortar: '#1a120a', minW: 14, maxW: 28, rows: [16, 16, 16, 16], cracks: 0.4 }),
    door: () => texPlanks(24, { wood: '#74492a', bands: [10, 42] }),
    trim: () => trimStone(25, '#8a6a46'),
    plat: () => platWood(26, '#7a5230'),
    ambient: [0.21, 0.18, 0.15],
    sky: ['#1a0e1a', '#4a2a44', '#b07a8a'],
  },
  crypt: {
    wall: () => texStones(31, { stone: '#6a6c58', alt: '#5c6250', mortar: '#1e2018', moss: '#4a5e22', minW: 18, maxW: 32, rows: [16, 16, 16, 16], cracks: 0.45, carve: 0.15 }),
    wall2: () => texEngraved(32, { base: '#545a4c' }),
    back: () => texStones(33, { stone: '#3e4234', alt: '#363c30', mortar: '#121410', moss: '#34441a', minW: 8, maxW: 16, rows: [8, 8, 8, 8, 8, 8, 8, 8] }),
    door: () => texMetalDoor(34, { base: '#62645a', stripe: '#6a6a50' }),
    trim: () => trimStone(35, '#6e705c', '#56702a'),
    plat: () => platStone(36, '#6a6456'),
    ambient: [0.19, 0.2, 0.17],
    sky: ['#0e1418', '#27404a', '#7a9aa0'],
  },
  cave: {
    wall: () => texRock(41, { dark: '#2e2016', light: '#8c6c48', strata: true, pebbles: 14 }),
    wall2: () => texRock(42, { dark: '#1e2814', light: '#64703c', moss: '#4e6a20', strata: true }),
    back: () => texRock(43, { dark: '#18120c', light: '#4a3a2a', pebbles: 4 }),
    door: () => texPlanks(44, { wood: '#6a4a2c', bands: [8, 40] }),
    trim: () => trimRock(45, '#5a4430', '#7a6a3a'),
    plat: () => platWood(46, '#76603e'),
    ambient: [0.19, 0.17, 0.14],
    sky: ['#0c1010', '#243030', '#6a8070'],
  },
  rune: {
    wall: () => texStones(71, { stone: '#5a6074', alt: '#4e5668', mortar: '#161820', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.35, glow: '#6aa0ff' }),
    wall2: () => texStones(72, { stone: '#4c5262', alt: '#465060', mortar: '#14161c', minW: 10, maxW: 18, rows: [8, 8, 8, 8, 8, 8, 8, 8] }),
    back: () => texStones(73, { stone: '#32364a', alt: '#2e3444', mortar: '#0e1016', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.2 }),
    door: () => texMetalDoor(74, { base: '#5c6070', stripe: '#4a6aa0' }),
    trim: () => trimStone(75, '#626a80'),
    plat: () => platStone(76, '#6e7280'),
    ambient: [0.18, 0.19, 0.25],
    sky: ['#04081a', '#1a2a5e', '#7a9ae0'],
  },
  nether: {
    wall: () => texRock(81, { dark: '#1c1022', light: '#5e3e66', vein: '#c040ff', pebbles: 6 }),
    wall2: () => texStones(82, { stone: '#46344e', alt: '#3e2e46', mortar: '#140c18', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.45, glow: '#e060ff' }),
    back: () => texStones(83, { stone: '#2a1e32', alt: '#321e2a', mortar: '#0c080e', minW: 10, maxW: 18, rows: [8, 8, 8, 8, 8, 8, 8, 8] }),
    door: () => texMetalDoor(84, { base: '#4e4458', stripe: '#8a3a9a' }),
    trim: () => trimStone(85, '#5a4462'),
    plat: () => platStone(86, '#5e4a66'),
    ambient: [0.19, 0.15, 0.22],
    sky: ['#0e0214', '#4a0a3e', '#d05090'],
  },
  void: {
    wall: () => texRock(91, { dark: '#12151e', light: '#46526a', vein: '#40d0ff', pebbles: 6 }),
    wall2: () => texStones(92, { stone: '#323a4c', alt: '#2c3446', mortar: '#0c0e14', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.4, glow: '#60e0ff' }),
    back: () => texStones(93, { stone: '#1e2434', alt: '#1a202e', mortar: '#08090e', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.15 }),
    door: () => texMetalDoor(94, { base: '#4a5060', stripe: '#3a7aa0' }),
    trim: () => trimStone(95, '#4a5470'),
    plat: () => platStone(96, '#5a6478'),
    ambient: [0.18, 0.2, 0.26],
    sky: ['#02030a', '#141038', '#6a5ac0'],
  },
  elder: {
    wall: () => texRock(51, { dark: '#2e1512', light: '#744434', vein: '#e0601c', strata: true }),
    wall2: () => texStones(52, { stone: '#564240', alt: '#4a3a38', mortar: '#1a1212', minW: 16, maxW: 32, rows: [16, 16, 16, 16], carve: 0.5, glow: '#e87030' }),
    back: () => texStones(53, { stone: '#3a201a', alt: '#30221e', mortar: '#0e0706', minW: 10, maxW: 18, rows: [8, 8, 8, 8, 8, 8, 8, 8] }),
    door: () => texMetalDoor(54, { base: '#5e4c46', stripe: '#a04a20' }),
    trim: () => trimRock(55, '#4a2a20', '#7a4a34'),
    plat: () => platStone(56, '#6a4232'),
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
    // фон темнее и с «грязью», чтобы читался как задняя стена
    const bb = def.back();
    const grime = tileNoise(64, 4, mulberry32(99));
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) bb.mul(x, y, 0.62 + grime(x, y) * 0.32);
    // текстуры светлее «нормы»: карта освещения затем приглушает всё, что вдали от ламп
    const set = {
      wall: def.wall().canvas(1.4),
      wall2: def.wall2().canvas(1.4),
      back: bb.canvas(1.3),
      door: def.door().canvas(1.3),
      trim: def.trim().canvas(1.35, 4),
      plat: def.plat().canvas(1.3, 4),
      ambient: def.ambient,
      skyCols: def.sky,
    };
    // кромка потолка: та же полоса вверх ногами и в тени
    set.ceil = makeCanvas(64, 4);
    const cc = set.ceil.getContext('2d');
    cc.translate(0, 4); cc.scale(1, -1);
    cc.drawImage(set.trim, 0, 1, 64, 4, 0, 0, 64, 4);
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.fillStyle = 'rgba(0,0,0,0.4)'; cc.fillRect(0, 0, 64, 4);
    cc.fillStyle = 'rgba(0,0,0,0.45)'; cc.fillRect(0, 3, 64, 1);
    this.themes[theme] = set;
    return set;
  },

  initLiquids() {
    if (this.liquids) return;
    this.liquids = {
      water: texFromFn(genLiquid(['#14262e', '#2c5260', '#5e8a8e'], 61)),
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
    if (theme === 'void') {
      // звёздное небо с туманностями
      const rng = mulberry32(91);
      const a = tileNoise(128, 4, rng), b = tileNoise(128, 8, rng);
      const stars = new Map();
      for (let i = 0; i < 90; i++) stars.set(Math.floor(rng() * 128) + 128 * Math.floor(rng() * 128), 0.4 + rng() * 0.6);
      const back = texFromFn((x, y) => {
        const n = a(x, y) * 0.65 + b(x, y) * 0.35;
        let c = mixc([3, 3, 12], [34, 18, 70], clamp((n - 0.45) * 2.2, 0, 1));
        const s = stars.get(y * 128 + x);
        if (s) c = mixc(c, [200, 210, 255], s);
        return c;
      }, 128);
      const rng2 = mulberry32(92);
      const front = texFromFn((x, y) => (rng2() < 0.004 ? [230, 235, 255, 255] : [0, 0, 0, 0]), 128);
      this.skies[theme] = { back, front };
      return this.skies[theme];
    }
    // небо как в старых шутерах: тёмный слой и быстрые облака, ступенчатые цвета
    const cols = (THEMES[theme] || THEMES.base).sky.map(hexToRgb);
    const rng = mulberry32(77);
    const a = tileNoise(128, 4, rng), b = tileNoise(128, 8, rng), c = tileNoise(128, 16, rng);
    // ступени только из цветов самого неба: так облака полосатые, но без чужих оттенков
    const steps = 9;
    const q = (t, x, y) => {
      const k = Math.round(clamp(t + BAYER4[(y & 3) * 4 + (x & 3)] * 0.09, 0, 1) * (steps - 1)) / (steps - 1);
      return k < 0.5 ? mixc(cols[0], cols[1], k * 2) : mixc(cols[1], cols[2], (k - 0.5) * 2);
    };
    const back = texFromFn((x, y) => {
      const n = a(x, y) * 0.5 + b(x, y) * 0.3 + c(x, y) * 0.2;
      return q(clamp(n * 1.3 - 0.1, 0, 1) * 0.5, x, y);
    }, 128);
    const rng2 = mulberry32(78);
    const a2 = tileNoise(128, 4, rng2), b2 = tileNoise(128, 8, rng2), c2 = tileNoise(128, 32, rng2);
    const front = texFromFn((x, y) => {
      const n = a2(x, y) * 0.5 + b2(x, y) * 0.35 + c2(x, y) * 0.15;
      const al = clamp((n - 0.48) * 4, 0, 1);
      const col = q(0.5 + clamp((n - 0.5) * 3, 0, 1) * 0.5, x, y);
      return [col[0], col[1], col[2], al > 0.15 ? 235 : 0];
    }, 128);
    this.skies[theme] = { back, front };
    return this.skies[theme];
  },
};
