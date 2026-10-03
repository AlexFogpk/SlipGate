'use strict';
// Обстановка уровней: трубы и пульты на базе, знамёна и окна в замке, паутина, цепи,
// сталактиты, корни, черепа, светящиеся руны; факелы, лампы и рамки порталов.
// Всё фоновое рисуется в запечённый слой один раз при загрузке и не влияет на столкновения.

const DRESS = {
  base: { pipes: 0.16, vents: 0.05, screens: 0.035, cables: 0.12 },
  castle: { banners: 0.1, windows: 0.06, chains: 0.05, webs: 0.25 },
  crypt: { webs: 0.35, chains: 0.06, skulls: 0.05, roots: 0.05, niches: 0.05 },
  cave: { stalactites: 0.3, rocks: 0.14, roots: 0.12 },
  rune: { chains: 0.05, glyphs: 0.02, webs: 0.12 },
  nether: { stalactites: 0.18, glyphs: 0.03, skulls: 0.04, chains: 0.05 },
  void: { glyphs: 0.03, chains: 0.04, stalactites: 0.08 },
  elder: { stalactites: 0.2, skulls: 0.05, glyphs: 0.03, chains: 0.05 },
};
const DRESS_COL = {
  base: { rock: '#4e4a42', glyph: '#60d0ff' },
  castle: { rock: '#5a4430', glyph: '#ffb040' },
  crypt: { rock: '#4a4c3e', glyph: '#80ff60' },
  cave: { rock: '#5a4430', glyph: '#ffb040' },
  rune: { rock: '#3e4456', glyph: '#6aa0ff' },
  nether: { rock: '#3e2a46', glyph: '#e060ff' },
  void: { rock: '#2a3242', glyph: '#60e0ff' },
  elder: { rock: '#4a2a20', glyph: '#ff8030' },
};

function dressLevel(lv, ctx) {
  const theme = lv.theme, D = DRESS[theme] || {}, col = DRESS_COL[theme] || DRESS_COL.base;
  lv.glyphs = [];
  const open = (x, y) => lv.tile(x, y) === T.EMPTY && !lv.skyBack(x, y);
  const solid = (x, y) => lv.tileSolid(x, y);
  // клетки рядом с выходами, кнопками, факелами, лифтами — без украшений
  const busy = new Set();
  const reserve = (px, py, r) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) busy.add(x + ',' + y);
  };
  for (const e of lv.exits.concat(lv.teleports)) { reserve(e.cx, e.bottom - 8, 1); reserve(e.cx, e.bottom - 24, 1); }
  for (const b of lv.buttons) reserve(b.x, b.y, 1);
  for (const d of lv.decor) reserve(d.x, d.y, 1);
  for (const p of lv.jumpPads) reserve(p.x, p.y, 1);
  for (const lf of lv.lifts) for (let k = 0; k <= 1; k += 0.1) reserve(lerp(lf.x0, lf.x1, k) + lf.w / 2, lerp(lf.y0, lf.y1, k), 1);
  for (const s of lv.solids) if (s.rect) { const r = s.rect(); reserve(r.x + r.w / 2, r.y + r.h / 2, 1); }
  const free = (x, y) => open(x, y) && !busy.has(x + ',' + y);
  const take = (x, y) => busy.add(x + ',' + y);
  const chance = (x, y, salt, p) => hash2(x, y, salt) < p;
  // настенные украшения не ставим кучно: каждое держит дистанцию от себе подобных
  const placed = {};
  const spaced = (kind, x, y, rx, ry, cap = 40) => {
    const list = placed[kind] || (placed[kind] = []);
    if (list.length >= cap) return false;
    for (let i = 0; i < list.length; i += 2) if (Math.abs(list[i] - x) < rx && Math.abs(list[i + 1] - y) < ry) return false;
    list.push(x, y);
    return true;
  };

  for (let y = 1; y < lv.h - 1; y++) {
    for (let x = 1; x < lv.w - 1; x++) {
      if (!free(x, y)) continue;
      const px = x * TILE, py = y * TILE;
      const ceil = solid(x, y - 1), floor = solid(x, y + 1);
      // трубы от пола до потолка
      if (D.pipes && floor && chance(x, y, 1, D.pipes)) {
        let top = y;
        while (top > 0 && free(x, top - 1)) top--;
        if (solid(x, top - 1) && y - top >= 2 && y - top <= 12) {
          drawPipe(ctx, px + 4 + Math.floor(hash2(x, y, 2) * 6), top * TILE, py + TILE, hash2(x, y, 3) < 0.4);
          for (let k = top; k <= y; k++) take(x, k);
          continue;
        }
      }
      if (D.cables && ceil && free(x + 1, y) && free(x + 2, y) && solid(x + 1, y - 1) && solid(x + 2, y - 1) && chance(x, y, 4, D.cables)) {
        drawCable(ctx, px + 2, py, px + 3 * TILE - 2, py, 4 + hash2(x, y, 5) * 6);
      }
      if (D.banners && ceil && free(x, y + 1) && open(x, y + 2) && chance(x, y, 6, D.banners) && spaced('banner', x, y, 5, 3)) {
        drawBanner(ctx, px + 8, py, hash2(x, y, 7));
        take(x, y); take(x, y + 1); take(x - 1, y); take(x + 1, y);
        continue;
      }
      if (D.chains && ceil && free(x, y + 1) && chance(x, y, 8, D.chains)) {
        drawChain(ctx, px + 5 + Math.floor(hash2(x, y, 9) * 6), py, 10 + Math.floor(hash2(x, y, 10) * 18));
        take(x, y);
        continue;
      }
      if (D.webs && ceil && (solid(x - 1, y) || solid(x + 1, y)) && chance(x, y, 11, D.webs)) {
        const dir = solid(x - 1, y) ? 1 : -1;
        drawWeb(ctx, dir > 0 ? px : px + TILE, py, dir, 8 + Math.floor(hash2(x, y, 12) * 7));
      }
      if (D.stalactites && ceil && chance(x, y, 13, D.stalactites)) {
        const n = 1 + Math.floor(hash2(x, y, 14) * 3);
        for (let i = 0; i < n; i++) {
          const h = 4 + Math.floor(hash2(x, y, 20 + i) * (free(x, y + 1) ? 13 : 7));
          drawStalactite(ctx, px + 2 + Math.floor(hash2(x, y, 30 + i) * 12), py, 3 + Math.floor(hash2(x, y, 40 + i) * 4), h, col.rock);
        }
      }
      if (D.roots && ceil && chance(x, y, 15, D.roots)) drawRoots(ctx, px, py, hash2(x, y, 16));
      if (D.rocks && floor && chance(x, y, 17, D.rocks)) drawRocks(ctx, px, py + TILE, hash2(x, y, 18), col.rock);
      if (D.skulls && floor && chance(x, y, 19, D.skulls)) drawSkull(ctx, px + 3 + Math.floor(hash2(x, y, 21) * 8), py + TILE, hash2(x, y, 22));
      // настенные: окна, ниши, пульты, решётки, руны — на высоте, не у потолка и не у пола
      const midWall = !ceil && !floor && free(x, y + 1) && open(x, y - 1);
      if (!midWall) continue;
      if (D.windows && free(x, y - 1) && chance(x, y, 23, D.windows) && spaced('window', x, y, 5, 4)) { drawWindow(ctx, px + 2, py - 8); take(x, y); take(x, y - 1); continue; }
      if (D.niches && chance(x, y, 24, D.niches) && spaced('niche', x, y, 3, 2)) { drawNiche(ctx, px + 3, py + 2); take(x, y); continue; }
      if (D.screens && chance(x, y, 25, D.screens) && spaced('screen', x, y, 4, 3)) { drawScreen(ctx, px + 2, py + 3, hash2(x, y, 26)); take(x, y); continue; }
      if (D.vents && chance(x, y, 27, D.vents) && spaced('vent', x, y, 3, 2)) { drawVent(ctx, px + 3, py + 4); take(x, y); continue; }
      if (D.glyphs && chance(x, y, 28, D.glyphs) && spaced('glyph', x, y, 6, 4, 30)) { lv.glyphs.push(drawTablet(ctx, px + 3, py + 2, col.glyph, hash2(x, y, 29))); take(x, y); continue; }
    }
  }
}

// --- фоновые украшения (в запечённый слой) ---
function drawPipe(ctx, x, top, bottom, twin) {
  const shadeCols = ['#2c2a26', '#8c8676', '#6a6456', '#46423a'];
  const pipe = (px, w) => {
    for (let i = 0; i < w; i++) { ctx.fillStyle = shadeCols[Math.min(3, Math.round(i * 3 / (w - 1)))]; ctx.fillRect(px + i, top, 1, bottom - top); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + w, top, 1, bottom - top);
    for (let y = top + 10; y < bottom - 4; y += 22) {
      ctx.fillStyle = '#58544a'; ctx.fillRect(px - 1, y, w + 2, 2);
      ctx.fillStyle = '#9a9484'; ctx.fillRect(px - 1, y, w + 2, 1);
      ctx.fillStyle = '#2a2824'; ctx.fillRect(px - 1, y + 2, w + 2, 1);
    }
  };
  pipe(x, 4);
  if (twin) pipe(x + 6, 3);
}
function drawCable(ctx, x0, y0, x1, y1, sag) {
  ctx.fillStyle = '#1c1a18';
  const n = Math.ceil(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = lerp(y0, y1, t) + 1 + Math.sin(t * Math.PI) * sag;
    ctx.fillRect(Math.round(x0 + i), Math.round(y), 1, 1);
  }
}
function drawBanner(ctx, cx, top, k) {
  const cloth = k < 0.5 ? ['#3e0a06', '#6e1810', '#8e2418'] : ['#0e1a3a', '#1e3060', '#2c447a'];
  ctx.fillStyle = '#2a1e14'; ctx.fillRect(cx - 7, top + 1, 14, 2);
  ctx.fillStyle = '#8a6a38'; ctx.fillRect(cx - 8, top + 1, 1, 2); ctx.fillRect(cx + 7, top + 1, 1, 2);
  const h = 22;
  for (let y = 0; y < h; y++) {
    const notch = y > h - 5 ? (y - (h - 5)) : 0;
    for (let x = -5; x < 5; x++) {
      if (notch && Math.abs(x + 0.5) < notch) continue;
      const fold = x === -5 || x === 4 ? 0 : (x + 7) % 4 === 0 ? 0 : x < 0 ? 2 : 1;
      ctx.fillStyle = cloth[fold];
      ctx.fillRect(cx + x, top + 3 + y, 1, 1);
    }
  }
  ctx.fillStyle = '#b08a30';
  ctx.fillRect(cx - 5, top + 3, 10, 1);
  for (let i = 0; i < 4; i++) { ctx.fillRect(cx - i, top + 8 + i, 1, 1); ctx.fillRect(cx + i - 1, top + 8 + i, 1, 1); ctx.fillRect(cx - i, top + 14 - i, 1, 1); ctx.fillRect(cx + i - 1, top + 14 - i, 1, 1); }
}
function drawChain(ctx, x, top, len) {
  for (let y = 0; y < len; y += 3) {
    if ((y / 3) % 2 === 0) { ctx.fillStyle = '#3a3630'; ctx.fillRect(x, top + y, 3, 3); ctx.fillStyle = '#121010'; ctx.fillRect(x + 1, top + y + 1, 1, 1); ctx.fillStyle = '#6a645a'; ctx.fillRect(x, top + y, 1, 1); }
    else { ctx.fillStyle = '#4a453c'; ctx.fillRect(x + 1, top + y, 1, 3); }
  }
  ctx.fillStyle = '#3a3630'; ctx.fillRect(x - 1, top + len, 5, 1); ctx.fillRect(x - 1, top + len - 2, 1, 2); ctx.fillRect(x + 3, top + len - 2, 1, 2);
}
function drawWeb(ctx, x, y, dir, r) {
  ctx.fillStyle = 'rgba(210,210,200,0.32)';
  const angs = [0.05, 0.4, 0.8, 1.2, 1.5];
  for (const a of angs) for (let i = 1; i <= r; i++) ctx.fillRect(Math.round(x + dir * Math.cos(a) * i), Math.round(y + Math.sin(a) * i), 1, 1);
  ctx.fillStyle = 'rgba(210,210,200,0.22)';
  for (const rr of [r * 0.35, r * 0.65, r * 0.95]) {
    for (let k = 0; k < angs.length - 1; k++) {
      const a0 = angs[k], a1 = angs[k + 1];
      for (let s = 0; s <= 4; s++) {
        const a = lerp(a0, a1, s / 4), sag = Math.sin((s / 4) * Math.PI) * 0.8;
        ctx.fillRect(Math.round(x + dir * Math.cos(a) * (rr - sag)), Math.round(y + Math.sin(a) * (rr - sag)), 1, 1);
      }
    }
  }
}
function drawStalactite(ctx, cx, top, w, h, hex) {
  const rp = ramp(hex);
  for (let r = 0; r < h; r++) {
    const half = (w / 2) * Math.pow(1 - r / h, 0.8);
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    if (x1 <= x0) { ctx.fillStyle = rp[2]; ctx.fillRect(Math.round(cx), top + r, 1, 1); continue; }
    ctx.fillStyle = rp[1]; ctx.fillRect(x0, top + r, x1 - x0, 1);
    ctx.fillStyle = rp[2]; ctx.fillRect(x0, top + r, Math.max(1, Math.round((x1 - x0) * 0.6)), 1);
    ctx.fillStyle = rp[3]; ctx.fillRect(x0, top + r, 1, 1);
  }
}
function drawRoots(ctx, px, py, k) {
  const n = 2 + Math.floor(k * 3);
  for (let i = 0; i < n; i++) {
    let x = px + 2 + ((k * 97 + i * 5.3) % 12), len = 5 + ((k * 31 + i * 7) % 11);
    ctx.fillStyle = i % 2 ? '#3a2c1a' : '#4a3a20';
    for (let y = 0; y < len; y++) {
      ctx.fillRect(Math.round(x), py + y, 1, 1);
      x += Math.sin(y * 0.9 + i + k * 10) * 0.6;
    }
  }
}
function drawRocks(ctx, px, bottom, k, hex) {
  const n = 2 + Math.floor(k * 3);
  for (let i = 0; i < n; i++) {
    const w = 2 + Math.floor(((k * 13 + i * 3.7) % 1) * 4), h = Math.max(2, Math.round(w * 0.7));
    const x = px + 1 + Math.floor(((k * 7.1 + i * 0.37) % 1) * (14 - w));
    ball(ctx, x, bottom - h, w, h, shade(hex, 0.85), false);
  }
}
function drawSkull(ctx, x, bottom, k) {
  ctx.fillStyle = '#8a8270'; ctx.fillRect(x, bottom - 4, 4, 3); ctx.fillRect(x + 1, bottom - 5, 3, 1);
  ctx.fillStyle = '#b4ac94'; ctx.fillRect(x + 1, bottom - 5, 2, 1); ctx.fillRect(x, bottom - 4, 1, 1);
  ctx.fillStyle = '#1a1612'; ctx.fillRect(x + 2, bottom - 3, 1, 1); ctx.fillRect(x + 1, bottom - 1, 3, 1);
  if (k > 0.4) { ctx.fillStyle = '#7a7262'; ctx.fillRect(x - 5, bottom - 1, 5, 1); ctx.fillRect(x + 5, bottom - 2, 1, 2); ctx.fillRect(x + 4, bottom - 1, 4, 1); }
}
function drawWindow(ctx, x, y) {
  // арочное окно с решёткой: за ним ночь
  ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 1, y + 4, 14, 22);
  for (let r = 0; r < 6; r++) { const half = Math.round(Math.sqrt(36 - (6 - r) * (6 - r))); ctx.fillRect(x + 6 - half - 1, y + r - 1, half * 2 + 2, 1); }
  ctx.fillStyle = '#0c1024';
  for (let r = 0; r < 6; r++) { const half = Math.round(Math.sqrt(25 - (5 - r) * (5 - r))); ctx.fillRect(x + 6 - half, y + r, half * 2, 1); }
  ctx.fillRect(x + 1, y + 6, 10, 18);
  ctx.fillStyle = '#3a4a7a'; ctx.fillRect(x + 3, y + 8, 1, 1); ctx.fillRect(x + 8, y + 12, 1, 1);
  ctx.fillStyle = '#1a1612';
  for (const bx of [x + 3, x + 6, x + 9]) ctx.fillRect(bx, y + 1, 1, 23);
  ctx.fillRect(x + 1, y + 14, 10, 1);
  ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x - 2, y + 24, 16, 2);
  ctx.fillStyle = '#b09a70'; ctx.fillRect(x - 2, y + 24, 16, 1);
}
function drawNiche(ctx, x, y) {
  ctx.fillStyle = '#0e0e0a';
  for (let r = 0; r < 4; r++) { const half = Math.round(Math.sqrt(16 - (4 - r) * (4 - r)) + 1); ctx.fillRect(x + 5 - half, y + r, half * 2, 1); }
  ctx.fillRect(x, y + 4, 10, 8);
  ctx.fillStyle = 'rgba(255,240,210,0.2)'; ctx.fillRect(x - 1, y + 12, 12, 1);
  drawSkull(ctx, x + 3, y + 12, 0);
}
function drawScreen(ctx, x, y, k) {
  ctx.fillStyle = '#1e1c18'; ctx.fillRect(x, y, 12, 9);
  ctx.fillStyle = '#5e5a50'; ctx.fillRect(x, y, 12, 1); ctx.fillRect(x, y, 1, 9);
  ctx.fillStyle = '#0c1a10'; ctx.fillRect(x + 2, y + 2, 8, 5);
  ctx.fillStyle = k < 0.5 ? '#3a8a3a' : '#a07a20';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 3 + i * 1.5 | 0, 2 + ((k * 10 + i * 3) % 5 | 0), 1);
  ctx.fillStyle = '#c03018'; ctx.fillRect(x + 10, y + 1, 1, 1);
}
function drawVent(ctx, x, y) {
  ctx.fillStyle = '#1a1814'; ctx.fillRect(x, y, 10, 7);
  ctx.fillStyle = '#6a6458'; ctx.fillRect(x, y, 10, 1); ctx.fillRect(x, y, 1, 7);
  for (let i = 1; i < 7; i += 2) { ctx.fillStyle = '#4a463e'; ctx.fillRect(x + 1, y + i, 9, 1); }
}
// Каменная табличка с вырезанной руной; руна потом светится в ярком проходе.
function drawTablet(ctx, x, y, glowCol, k) {
  ctx.fillStyle = '#1a1814'; ctx.fillRect(x - 1, y - 1, 12, 14);
  ctx.fillStyle = '#4a4a50'; ctx.fillRect(x, y, 10, 12);
  ctx.fillStyle = '#6a6a72'; ctx.fillRect(x, y, 10, 1); ctx.fillRect(x, y, 1, 12);
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(x, y + 11, 10, 1); ctx.fillRect(x + 9, y, 1, 12);
  const shapes = [
    [[5, 2, 5, 9], [5, 3, 8, 5], [5, 6, 2, 8]],
    [[2, 2, 8, 9], [8, 2, 2, 9]],
    [[5, 2, 5, 9], [5, 5, 8, 2], [5, 5, 2, 2], [3, 9, 7, 9]],
    [[5, 2, 5, 9], [5, 2, 8, 4], [8, 4, 5, 6], [5, 6, 8, 9]],
  ];
  const segs = shapes[Math.floor(k * shapes.length) % shapes.length];
  const pts = [];
  for (const [x0, y0, x1, y1] of segs) {
    const st = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= st; i++) pts.push(x + Math.round(lerp(x0, x1, i / st)), y + Math.round(lerp(y0, y1, i / st)));
  }
  ctx.fillStyle = '#121216';
  for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
  return { pts, col: glowCol, phase: k * 10 };
}

// --- факелы, лампы, порталы ---
function drawTorchHolder(ctx, x, y) {
  ctx.fillStyle = '#2a221a'; ctx.fillRect(x - 2, y + 4, 5, 4);
  ctx.fillStyle = '#8a7458'; ctx.fillRect(x, y + 5, 1, 1);
  ctx.fillStyle = '#3e3022'; ctx.fillRect(x - 1, y - 1, 3, 6);
  ctx.fillStyle = '#5e4a34'; ctx.fillRect(x - 1, y - 1, 1, 6);
  ctx.fillStyle = '#2e241a'; ctx.fillRect(x - 3, y - 3, 7, 3);
  ctx.fillStyle = '#7a6448'; ctx.fillRect(x - 3, y - 3, 7, 1);
  ctx.fillStyle = '#4a3a28'; ctx.fillRect(x - 3, y - 2, 1, 2);
}
function drawTorchFlame(ctx, x, y, t, seed) {
  const h = 10 + Math.round(Math.sin(t * 11 + seed) * 1.3 + Math.sin(t * 17 + seed * 2) * 0.8);
  const sway = Math.sin(t * 6 + seed) * 1.3 + Math.sin(t * 15 + seed) * 0.4;
  for (let r = 0; r < h; r++) {
    const k = r / h, yy = y - 3 - r;
    const half = (1 - k) * 3.2 * (0.82 + 0.18 * Math.sin(t * 23 + r * 1.7 + seed)) + (r < 2 ? 0.4 : 0);
    const cx = x + 0.5 + sway * k * k;
    const w = Math.max(1, Math.round(half * 2));
    const x0 = Math.round(cx - w / 2);
    ctx.fillStyle = k > 0.75 ? '#b8300a' : '#d04a0e'; ctx.fillRect(x0, yy, w, 1);
    if (w > 2) { ctx.fillStyle = '#ff8c1c'; ctx.fillRect(x0 + 1, yy, w - 2, 1); }
    if (w > 4 && k < 0.6) { ctx.fillStyle = '#ffd860'; ctx.fillRect(x0 + 2, yy, w - 4, 1); }
    if (w > 4 && k < 0.25) { ctx.fillStyle = '#fff6d0'; ctx.fillRect(Math.round(cx) - 1, yy, 2, 1); }
  }
  // искры
  for (let i = 0; i < 2; i++) {
    const ph = (t * 1.6 + seed * 0.37 + i * 0.5) % 1;
    const sx = Math.round(x + Math.sin(seed * 3 + i * 2 + t * 4) * 2 * ph), sy = Math.round(y - 6 - ph * 16);
    ctx.globalAlpha = 1 - ph;
    ctx.fillStyle = ph < 0.4 ? '#ffe080' : '#ff8a30';
    ctx.fillRect(sx, sy, 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawLampHousing(ctx, x, y) {
  ctx.fillStyle = '#1e1c18'; ctx.fillRect(x - 7, y - 4, 14, 7);
  ctx.fillStyle = '#5e5a50'; ctx.fillRect(x - 7, y - 4, 14, 2);
  ctx.fillStyle = '#8a8474'; ctx.fillRect(x - 7, y - 4, 14, 1);
  ctx.fillStyle = '#a89e80'; ctx.fillRect(x - 5, y - 1, 10, 3);
  ctx.fillStyle = '#c8b890'; ctx.fillRect(x - 6, y - 3, 1, 1); ctx.fillRect(x + 5, y - 3, 1, 1);
}
let lampCone = null;
function drawLampLight(ctx, x, y, t) {
  if (!lampCone) {
    // конус света под лампой готовится один раз
    lampCone = makeCanvas(48, 34);
    const c = lampCone.getContext('2d');
    c.fillStyle = 'rgba(255,236,190,0.045)';
    for (let r = 0; r < 34; r++) { const half = 5 + r * 0.6; c.fillRect(Math.round(24 - half), r, Math.round(half * 2), 1); }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(lampCone, x - 24, y + 2);
  ctx.restore();
  ctx.fillStyle = '#fff2c8'; ctx.fillRect(x - 5, y - 1, 10, 3);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y, 8, 1);
  ctx.fillStyle = '#2a2620';
  for (const bx of [x - 3, x, x + 3]) ctx.fillRect(bx, y - 1, 1, 3);
}
// Рамка выхода/телепорта: на базе — металлическая с огнями, иначе каменная арка.
function drawPortalFrame(ctx, x, y, theme) {
  if (theme === 'base') {
    ctx.fillStyle = '#1a1814'; ctx.fillRect(x - 14, y - 44, 28, 44);
    for (const sx of [x - 13, x + 9]) {
      ctx.fillStyle = '#5e5a4e'; ctx.fillRect(sx, y - 40, 4, 40);
      ctx.fillStyle = '#8a8472'; ctx.fillRect(sx, y - 40, 1, 40);
      ctx.fillStyle = '#34312a'; ctx.fillRect(sx + 3, y - 40, 1, 40);
      for (let yy = y - 8; yy < y - 1; yy += 2) { ctx.fillStyle = '#b88a20'; ctx.fillRect(sx, yy, 4, 1); }
    }
    ctx.fillStyle = '#5e5a4e'; ctx.fillRect(x - 14, y - 44, 28, 5);
    ctx.fillStyle = '#8a8472'; ctx.fillRect(x - 14, y - 44, 28, 1);
    ctx.fillStyle = '#2a2620'; ctx.fillRect(x - 14, y - 40, 28, 1);
    ctx.fillStyle = '#3a3630'; ctx.fillRect(x - 15, y - 2, 30, 2);
    return;
  }
  const st = ramp(DRESS_COL[theme] ? shade(DRESS_COL[theme].rock, 1.3) : '#6a5c4c');
  ctx.fillStyle = '#141210'; ctx.fillRect(x - 14, y - 34, 28, 34);
  for (let r = 0; r < 12; r++) { const half = Math.round(Math.sqrt(196 - (12 - r) * (12 - r))); ctx.fillRect(x - half, y - 46 + r, half * 2, 1); }
  // колонны из блоков
  for (const sx of [x - 13, x + 9]) {
    for (let yy = y - 34; yy < y; yy += 6) {
      ctx.fillStyle = st[2]; ctx.fillRect(sx, yy, 4, 5);
      ctx.fillStyle = st[3]; ctx.fillRect(sx, yy, 4, 1);
      ctx.fillStyle = st[0]; ctx.fillRect(sx, yy + 5, 4, 1);
    }
  }
  // арка из клиньев с замковым камнем
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI, bx = Math.round(x + Math.cos(a) * 11), by = Math.round(y - 34 + Math.sin(a) * 11);
    ctx.fillStyle = i === 4 ? st[3] : st[2]; ctx.fillRect(bx - 2, by - 2, 4, 4);
    ctx.fillStyle = st[4]; ctx.fillRect(bx - 2, by - 2, 2, 1);
    ctx.fillStyle = st[0]; ctx.fillRect(bx - 2, by + 1, 4, 1);
  }
  ctx.fillStyle = st[1]; ctx.fillRect(x - 15, y - 2, 30, 2);
  ctx.fillStyle = st[3]; ctx.fillRect(x - 15, y - 2, 30, 1);
}
// Светящиеся руны на табличках (яркий проход).
function drawGlyphs(ctx, cam, list, t) {
  if (!list) return;
  for (const g of list) {
    const x0 = g.pts[0] - cam.x, y0 = g.pts[1] - cam.y;
    if (x0 < -20 || y0 < -20 || x0 > 2000 || y0 > 2000) continue;
    ctx.globalAlpha = 0.55 + Math.sin(t * 1.7 + g.phase) * 0.3;
    ctx.fillStyle = g.col;
    for (let i = 0; i < g.pts.length; i += 2) ctx.fillRect(g.pts[i] - cam.x, g.pts[i + 1] - cam.y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
