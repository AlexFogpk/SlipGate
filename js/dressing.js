'use strict';
// Обстановка уровней: трубы и пульты на базе, знамёна и окна в замке, паутина, цепи,
// сталактиты, корни, черепа, светящиеся руны; факелы, лампы и рамки порталов.
// Всё фоновое рисуется в запечённый слой один раз при загрузке и не влияет на столкновения.

const DRESS = {
  // pilasters — шаг колонн вдоль стен в клетках; band — стиль цоколя и фриза
  base: { pipes: 0.16, vents: 0.05, screens: 0.035, cables: 0.12, girders: 0.07, hazard: 1, strips: 0.05, pilasters: 14, band: 'metal' },
  castle: { banners: 0.1, windows: 0.06, chains: 0.05, webs: 0.25, rafters: 0.08, cages: 0.03, pilasters: 11, band: 'stone' },
  crypt: { webs: 0.35, chains: 0.06, skulls: 0.05, roots: 0.05, niches: 0.05, rafters: 0.06, cages: 0.035, chained: 0.03, drips: 0.35, pilasters: 13, band: 'skulls' },
  cave: { stalactites: 0.3, rocks: 0.14, roots: 0.12, drips: 0.25 },
  rune: { chains: 0.05, glyphs: 0.02, webs: 0.12, pilasters: 10, cages: 0.02, band: 'rune' },
  nether: { stalactites: 0.18, glyphs: 0.03, skulls: 0.04, chains: 0.05, spikes: 0.05, cages: 0.03, pilasters: 12, band: 'stone' },
  void: { glyphs: 0.03, chains: 0.04, stalactites: 0.08, band: 'rune' },
  elder: { stalactites: 0.2, skulls: 0.05, glyphs: 0.03, chains: 0.05, spikes: 0.05, cages: 0.025, chained: 0.02, pilasters: 12, band: 'stone' },
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
  // точки для живой атмосферы: капли со сталактитов, пар из решёток, окна, лампы-полосы
  lv.amb = { drips: [], vents: [], windows: [], strips: [] };
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

  // пролёт под потолком: клетки свободны, над ними потолок, под ними ещё две пустых
  const span = (x, y, n) => {
    for (let i = 0; i < n; i++) if (!free(x + i, y) || !solid(x + i, y - 1) || !open(x + i, y + 1) || !open(x + i, y + 2)) return false;
    return true;
  };
  // архитектурный ритм: цоколь вдоль пола и фриз под потолком в каждом помещении
  if (D.band) {
    const rk = ramp(shade(col.rock, 1.15));
    for (let y = 1; y < lv.h - 1; y++) {
      for (let x = 1; x < lv.w - 1; x++) {
        if (!open(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        if (solid(x, y + 1)) drawWainscot(ctx, px, py + TILE, x, D.band, rk);
        if (solid(x, y - 1) && !solid(x, y + 1)) drawFrieze(ctx, px, py, x, D.band, rk);
      }
    }
  }
  for (let y = 1; y < lv.h - 1; y++) {
    for (let x = 1; x < lv.w - 1; x++) {
      if (!free(x, y)) continue;
      const px = x * TILE, py = y * TILE;
      const ceil = solid(x, y - 1), floor = solid(x, y + 1);
      // стальные балки (база) и деревянные стропила (замок, склеп) под потолком
      if ((D.girders || D.rafters) && ceil && chance(x, y, 50, D.girders || D.rafters)) {
        const n = 5 + Math.floor(hash2(x, y, 51) * 4);
        if (span(x, y, n) && spaced('beam', x, y, 14, 4, 30)) {
          if (D.girders) drawGirder(ctx, px, py, n * TILE); else drawRafter(ctx, px, py, n * TILE);
          for (let i = 0; i < n; i++) take(x + i, y);
          continue;
        }
      }
      // клетка со скелетом на цепи
      if (D.cages && ceil && open(x, y + 1) && open(x, y + 2) && free(x, y + 1) && chance(x, y, 53, D.cages) && spaced('cage', x, y, 12, 6, 10)) {
        drawCage(ctx, px + 8, py, 4 + Math.floor(hash2(x, y, 54) * 12), hash2(x, y, 55));
        take(x, y); take(x, y + 1);
        continue;
      }
      // пилястры (на базе — стальные стойки) с ровным шагом вдоль стен
      if (D.pilasters && floor && x % D.pilasters === lv.w % D.pilasters) {
        let top = y;
        while (top > 0 && free(x, top - 1)) top--;
        if (solid(x, top - 1) && y - top >= 2 && y - top <= 11 && spaced('pilaster', x, y, D.pilasters - 2, 30, 80)) {
          if (D.band === 'metal') drawSteelColumn(ctx, px + 4, top * TILE, py + TILE);
          else drawPilaster(ctx, px + 5, top * TILE, py + TILE, col.rock);
          for (let k = top; k <= y; k++) take(x, k);
          continue;
        }
      }
      // полосы «осторожно» у края пола над провалом
      if (D.hazard && floor) {
        for (const d of [-1, 1]) {
          if (open(x + d, y) && open(x + d, y + 1) && !solid(x + d, y + 1) && lv.tile(x + d, y + 1) !== T.PLAT) drawHazard(ctx, d > 0 ? px + TILE - 8 : px, py + TILE, 8);
        }
      }
      // шипы у стен
      if (D.spikes && floor && (solid(x - 1, y) || solid(x + 1, y)) && chance(x, y, 57, D.spikes)) drawSpikes(ctx, px, py + TILE, hash2(x, y, 58), col.rock);
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
          const sx = px + 2 + Math.floor(hash2(x, y, 30 + i) * 12);
          drawStalactite(ctx, sx, py, 3 + Math.floor(hash2(x, y, 40 + i) * 4), h, col.rock);
          if (D.drips && i === 0 && hash2(x, y, 59) < D.drips) lv.amb.drips.push({ x: sx, y: py + h });
        }
      }
      if (D.roots && ceil && chance(x, y, 15, D.roots)) drawRoots(ctx, px, py, hash2(x, y, 16));
      if (D.rocks && floor && chance(x, y, 17, D.rocks)) drawRocks(ctx, px, py + TILE, hash2(x, y, 18), col.rock);
      if (D.skulls && floor && chance(x, y, 19, D.skulls)) drawSkull(ctx, px + 3 + Math.floor(hash2(x, y, 21) * 8), py + TILE, hash2(x, y, 22));
      // настенные: окна, ниши, пульты, решётки, руны — на высоте, не у потолка и не у пола
      const midWall = !ceil && !floor && free(x, y + 1) && open(x, y - 1);
      if (!midWall) continue;
      if (D.windows && free(x, y - 1) && chance(x, y, 23, D.windows) && spaced('window', x, y, 5, 4)) { drawWindow(ctx, px + 2, py - 8); lv.amb.windows.push({ x: px + 8, y: py + 4 }); take(x, y); take(x, y - 1); continue; }
      if (D.chained && free(x, y - 1) && chance(x, y, 60, D.chained) && spaced('chained', x, y, 12, 6, 6)) { drawChainedSkeleton(ctx, px + 8, py - 10); take(x, y); take(x, y - 1); continue; }
      if (D.strips && chance(x, y, 61, D.strips) && spaced('strip', x, y, 7, 4, 40)) { drawStripHousing(ctx, px + 1, py + 5); lv.amb.strips.push({ x: px + 1, y: py + 5 }); take(x, y); continue; }
      if (D.niches && chance(x, y, 24, D.niches) && spaced('niche', x, y, 3, 2)) { drawNiche(ctx, px + 3, py + 2); take(x, y); continue; }
      if (D.screens && chance(x, y, 25, D.screens) && spaced('screen', x, y, 4, 3)) { drawScreen(ctx, px + 2, py + 3, hash2(x, y, 26)); take(x, y); continue; }
      if (D.vents && chance(x, y, 27, D.vents) && spaced('vent', x, y, 3, 2)) { drawVent(ctx, px + 3, py + 4); lv.amb.vents.push({ x: px + 8, y: py + 4 }); take(x, y); continue; }
      if (D.glyphs && chance(x, y, 28, D.glyphs) && spaced('glyph', x, y, 6, 4, 30)) { lv.glyphs.push(drawTablet(ctx, px + 3, py + 2, col.glyph, hash2(x, y, 29))); take(x, y); continue; }
    }
  }
}

// --- фоновые украшения (в запечённый слой) ---
// Цоколь вдоль пола: металлическая панель с болтами или каменный плинтус из блоков.
function drawWainscot(ctx, px, bottom, x, style, rk) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  if (style === 'metal') {
    f(px, bottom - 7, 16, 7, '#2c2924');
    f(px, bottom - 7, 16, 1, '#7a7466'); f(px, bottom - 6, 16, 1, '#4a463e');
    if (x % 2 === 0) { f(px + 2, bottom - 4, 1, 1, '#8a8474'); f(px + 13, bottom - 4, 1, 1, '#8a8474'); }
    if (x % 4 === 3) f(px + 15, bottom - 7, 1, 7, '#1a1814');
    return;
  }
  f(px, bottom - 8, 16, 8, rk[1]);
  f(px, bottom - 8, 16, 1, rk[3]); f(px, bottom - 7, 16, 1, rk[2]);
  f(px, bottom - 1, 16, 1, rk[0]);
  if (x % 2 === 1) f(px + 15, bottom - 7, 1, 6, rk[0]);
  if (style === 'rune' && x % 3 === 0) f(px + 7, bottom - 5, 2, 2, rk[0]);
}
// Фриз под потолком: зубчики, ряд черепов, кабель-канал.
function drawFrieze(ctx, px, top, x, style, rk) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  if (style === 'metal') {
    f(px, top, 16, 4, '#34312a'); f(px, top + 4, 16, 1, '#1a1814'); f(px, top + 1, 16, 1, '#5a564c');
    if (x % 3 === 0) f(px + 7, top + 2, 2, 1, '#8a8474');
    return;
  }
  f(px, top, 16, 2, rk[1]); f(px, top + 2, 16, 1, rk[3]);
  if (style === 'skulls' && x % 2 === 0) {
    f(px + 6, top + 3, 4, 3, '#9a927c'); f(px + 6, top + 3, 4, 1, '#b4ac94'); f(px + 7, top + 4, 1, 1, '#1a1612'); f(px + 9, top + 4, 1, 1, '#1a1612');
  } else {
    for (let i = 1; i < 16; i += 4) { f(px + i, top + 3, 2, 2, rk[2]); f(px + i, top + 5, 2, 1, rk[0]); }
  }
}
// Стальная стойка-двутавр от пола до потолка (база).
function drawSteelColumn(ctx, x, top, bottom) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  f(x, top, 8, bottom - top, '#3a362e');
  f(x, top, 1, bottom - top, '#8a8474'); f(x + 1, top, 1, bottom - top, '#5e5a4e');
  f(x + 6, top, 1, bottom - top, '#26231e'); f(x + 7, top, 1, bottom - top, '#5e5a4e');
  f(x + 3, top, 2, bottom - top, '#2c2924');
  for (let y = top + 6; y < bottom - 4; y += 12) { f(x + 1, y, 6, 1, '#6a6456'); f(x + 2, y + 2, 1, 1, '#8a8474'); f(x + 5, y + 2, 1, 1, '#8a8474'); }
  f(x - 2, top, 12, 3, '#4a463e'); f(x - 2, top, 12, 1, '#8a8474');
  f(x - 2, bottom - 3, 12, 3, '#4a463e'); f(x - 2, bottom - 3, 12, 1, '#8a8474');
  for (let y = bottom - 12; y < bottom - 3; y++) f(x + ((y >> 1) & 1 ? 1 : 3), y, 4, 1, (y >> 1) & 1 ? '#c89a28' : '#1a1610');
}
// Стальная двутавровая балка с заклёпками на подвесах.
function drawGirder(ctx, x, y, len) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  for (let i = 6; i < len - 4; i += 40) { f(x + i, y, 1, 4, '#2a2620'); f(x + i + 1, y, 1, 4, '#5a5448'); }
  f(x, y + 4, len, 1, '#9a9484'); f(x, y + 5, len, 1, '#6a6456');
  f(x, y + 6, len, 4, '#3e3a32');
  f(x, y + 10, len, 1, '#6a6456'); f(x, y + 11, len, 1, '#24211c');
  for (let i = 3; i < len - 2; i += 6) f(x + i, y + 8, 1, 1, '#8a8474');
  // раскосы
  for (let i = 0; i + 10 < len; i += 12) for (let k = 0; k < 4; k++) f(x + i + k * 2 + 1, y + 6 + k, 2, 1, '#2c2924');
}
// Деревянное стропило с железными скобами и упорами.
function drawRafter(ctx, x, y, len) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  f(x, y + 1, len, 6, '#4a2e16');
  f(x, y + 1, len, 1, '#82542a'); f(x, y + 2, len, 1, '#6a4422');
  f(x, y + 6, len, 1, '#28160a');
  for (let i = 2; i < len; i += 9) f(x + i, y + 3 + (i % 2), 3, 1, '#5a3a1c');
  for (let i = 8; i < len - 4; i += 32) { f(x + i, y, 4, 8, '#1e1c1a'); f(x + i, y, 4, 1, '#5a5448'); f(x + i + 1, y + 3, 1, 1, '#8a8474'); }
  for (const [ex, d] of [[x + 1, 1], [x + len - 2, -1]]) for (let k = 0; k < 6; k++) f(ex + d * k, y + 7 + k, 2, 1, '#3a2412');
}
// Клетка на цепи со скелетом внутри.
function drawCage(ctx, cx, top, chainLen, k) {
  drawChain(ctx, cx - 1, top, chainLen);
  const y0 = top + chainLen + 1;
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  f(cx - 3, y0, 7, 1, '#3a3630'); f(cx - 5, y0 + 1, 11, 2, '#2a2620'); f(cx - 5, y0 + 1, 11, 1, '#6a645a');
  // скелет: череп, рёбра, свисающая кость
  f(cx - 2, y0 + 4, 4, 3, '#a89e84'); f(cx - 2, y0 + 4, 4, 1, '#c8bea4'); f(cx - 1, y0 + 5, 1, 1, '#1a1612'); f(cx + 1, y0 + 5, 1, 1, '#1a1612');
  f(cx - 1, y0 + 7, 2, 6, '#8a8270');
  for (let i = 0; i < 3; i++) f(cx - 3, y0 + 8 + i * 2, 6, 1, '#9a927c');
  if (k > 0.5) { f(cx + 4, y0 + 9, 1, 7, '#9a927c'); f(cx + 4, y0 + 16, 2, 1, '#b4ac94'); }
  for (let bx = cx - 5; bx <= cx + 5; bx += 2) f(bx, y0 + 3, 1, 12, '#3a3630');
  f(cx - 5, y0 + 3, 1, 12, '#6a645a');
  f(cx - 5, y0 + 15, 11, 2, '#2a2620'); f(cx - 4, y0 + 15, 9, 1, '#5a544a');
}
// Пилястра: капитель, ствол со светотенью, база.
function drawPilaster(ctx, x, top, bottom, rock) {
  const r = ramp(shade(rock, 1.25));
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  f(x, top, 6, bottom - top, r[2]);
  f(x, top, 1, bottom - top, r[3]); f(x + 1, top, 1, bottom - top, r[4]);
  f(x + 4, top, 1, bottom - top, r[1]); f(x + 5, top, 1, bottom - top, r[0]);
  f(x + 6, top, 1, bottom - top, 'rgba(0,0,0,0.35)');
  for (let yy = top + 12; yy < bottom - 6; yy += 16) f(x, yy, 6, 1, r[1]);
  f(x - 2, top, 10, 3, r[3]); f(x - 2, top + 2, 10, 1, r[0]); f(x - 1, top + 3, 8, 1, r[1]);
  f(x - 2, bottom - 3, 10, 3, r[2]); f(x - 2, bottom - 3, 10, 1, r[4]); f(x - 1, bottom - 4, 8, 1, r[3]);
}
// Полоса «осторожно» на кромке пола у провала.
function drawHazard(ctx, x, y, w) {
  for (let i = 0; i < w; i++) {
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (((x + i + r) >> 1) & 1) ? '#c89a28' : '#1a1610';
      ctx.fillRect(x + i, y + r, 1, 1);
    }
  }
}
// Шипы у стены: железные или костяные.
function drawSpikes(ctx, x, bottom, k, rock) {
  const r = ramp(shade(rock, 1.1));
  const n = 3 + Math.floor(k * 3);
  for (let i = 0; i < n; i++) {
    const sx = x + 2 + Math.floor((i / n) * 12), h = 4 + Math.floor(((k * 17 + i * 3.1) % 1) * 5);
    for (let r2 = 0; r2 < h; r2++) {
      const half = Math.round((1 - r2 / h) * 1.5);
      ctx.fillStyle = r2 > h - 2 ? r[4] : r[2];
      ctx.fillRect(sx - half, bottom - 1 - r2, half * 2 + 1, 1);
      ctx.fillStyle = r[1]; ctx.fillRect(sx + half, bottom - 1 - r2, 1, 1);
    }
  }
}
// Лампа-полоса на стене (трубка светится в ярком проходе).
function drawStripHousing(ctx, x, y) {
  ctx.fillStyle = '#1a1814'; ctx.fillRect(x - 1, y - 1, 16, 5);
  ctx.fillStyle = '#5e5a50'; ctx.fillRect(x - 1, y - 1, 16, 1);
  ctx.fillStyle = '#a8b8c0'; ctx.fillRect(x + 1, y + 1, 12, 1);
  ctx.fillStyle = '#2a2620'; ctx.fillRect(x - 1, y + 3, 16, 1);
}
// Скелет, прикованный к стене за руки.
function drawChainedSkeleton(ctx, cx, y) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  for (const sx of [cx - 7, cx + 6]) { f(sx, y, 2, 3, '#2a2620'); f(sx, y, 2, 1, '#6a645a'); }
  for (let i = 0; i < 4; i++) { f(cx - 6 + i, y + 3 + i, 1, 1, '#9a927c'); f(cx + 6 - i, y + 3 + i, 1, 1, '#9a927c'); }
  f(cx - 2, y + 5, 4, 4, '#b4ac94'); f(cx - 2, y + 5, 4, 1, '#cec6ac'); f(cx - 1, y + 6, 1, 1, '#1a1612'); f(cx + 1, y + 6, 1, 1, '#1a1612'); f(cx - 1, y + 8, 2, 1, '#5a5244');
  f(cx, y + 9, 1, 9, '#8a8270');
  for (let i = 0; i < 3; i++) f(cx - 2, y + 10 + i * 2, 5, 1, '#9a927c');
  f(cx - 2, y + 17, 5, 1, '#8a8270');
  f(cx - 2, y + 18, 1, 6, '#8a8270'); f(cx + 2, y + 18, 1, 5, '#8a8270');
}
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

// ---------------- лифты и пульты вызова ----------------
// Состояние лампы: зелёная — лифт на месте и готов, жёлтая мигает — едет или вызван.
function liftLamp(lf, t, here = true) {
  if (lf.moving || lf.wait > 0) return Math.floor(t * 6) % 2 ? '#ffb030' : '#6a4010';
  return here ? '#40ff70' : '#ffb030';
}

function drawLift(ctx, lf, cam, t) {
  const x = Math.round(lf.x - cam.x), y = Math.round(lf.y - cam.y);
  if (x > 2000 || x + lf.w < -40 || y > 2000 || y < -900) return;
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  // тросы вертикального лифта и блок над верхней остановкой
  if (lf.vertical) {
    const top = Math.round(Math.min(lf.y0, lf.y1) - cam.y) - 28;
    if (y > top) {
      f(x + 3, top, 1, y - top, '#2a2620'); f(x + lf.w - 4, top, 1, y - top, '#2a2620');
      f(x + 4, top, 1, y - top, '#5a5244'); f(x + lf.w - 3, top, 1, y - top, '#5a5244');
      f(x + 1, top - 5, lf.w - 2, 5, '#1e1a16');
      f(x + 2, top - 4, lf.w - 4, 1, '#6a604e');
      for (const px of [x + 2, x + lf.w - 7]) { f(px, top - 3, 5, 3, '#4a4438'); f(px + 2, top - 2, 1, 1, '#9a8e78'); }
    }
  }
  // платформа: рифлёный настил, полоса «осторожно» по кромке, рама
  f(x, y, lf.w, lf.h, '#141210');
  f(x + 1, y + 1, lf.w - 2, 2, '#6e6656');
  f(x, y, lf.w, 1, '#a89c84');
  for (let i = 2; i < lf.w - 2; i += 3) f(x + i, y + 1, 1, 1, '#4a4438');
  for (let i = 1; i < lf.w - 1; i++) f(x + i, y + 3, 1, 2, ((i + Math.floor(lf.x / 4)) >> 1) % 2 ? '#d0a030' : '#2a2218');
  f(x + 1, y + 5, lf.w - 2, 1, '#3a342c');
  // ферма снизу
  for (let i = 3; i < lf.w - 3; i += 6) { f(x + i, y + lf.h, 1, 3, '#2a2520'); f(x + i + 1, y + lf.h + 1, 1, 1, '#2a2520'); f(x + i + 2, y + lf.h + 2, 1, 1, '#2a2520'); }
  f(x + 2, y + lf.h + 3, lf.w - 4, 1, '#2a2520');
  // пульт на краю платформы
  const cx = x + lf.w - 7;
  f(cx + 1, y - 7, 2, 7, '#2a2520');
  f(cx - 1, y - 11, 6, 5, '#1e1a16');
  f(cx, y - 10, 4, 3, '#4a4438');
}

function drawLiftButton(ctx, b, cam, t) {
  const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
  if (x < -20 || x > 2000 || y < -30 || y > 2000) return;
  const f = (a, c, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(a, c, w, h); };
  // стойка с основанием
  f(x + 3, y + 7, 4, 11, '#1e1a16'); f(x + 4, y + 7, 1, 11, '#6a604e');
  f(x + 1, y + 16, 8, 2, '#1e1a16'); f(x + 2, y + 16, 6, 1, '#5a5244');
  // панель: рамка, стрелка к другой остановке, кнопка
  f(x, y, 10, 8, '#141210');
  f(x + 1, y + 1, 8, 6, '#5a544a');
  f(x + 1, y + 1, 8, 1, '#8a8070');
  f(x + 2, y + 2, 3, 4, '#1a1612');
  const lf = b.lift;
  const ox = b.stop ? lf.x0 : lf.x1, oy = b.stop ? lf.y0 : lf.y1;
  const sx = b.stop ? lf.x1 : lf.x0, sy = b.stop ? lf.y1 : lf.y0;
  ctx.fillStyle = '#c8b890';
  if (lf.vertical || Math.abs(oy - sy) > Math.abs(ox - sx)) {
    const up = oy < sy;
    f(x + 3, y + (up ? 2 : 5), 1, 1, '#c8b890'); f(x + 2, y + (up ? 3 : 4), 3, 1, '#c8b890'); f(x + 3, y + (up ? 4 : 3), 1, 1, '#c8b890');
  } else {
    const right = ox > sx;
    f(x + (right ? 4 : 2), y + 3, 1, 2, '#c8b890'); f(x + 3, y + 2, 1, 4, '#c8b890'); f(x + (right ? 2 : 4), y + 3, 1, 2, '#c8b890');
  }
  const pressed = b.flash > 0;
  f(x + 6, y + (pressed ? 3 : 2), 2, pressed ? 3 : 4, '#1a1612');
}

// Лампы лифтов и пультов светятся в темноте (рисуются после освещения).
function drawLiftLights(ctx, lifts, buttons, cam, t) {
  for (const lf of lifts) {
    const x = Math.round(lf.x - cam.x) + lf.w - 6, y = Math.round(lf.y - cam.y) - 9;
    if (x < -20 || x > 2000 || y < -20 || y > 2000) continue;
    const col = liftLamp(lf, t);
    ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.fillRect(x - 1, y - 1, 4, 3);
    ctx.globalAlpha = 1; ctx.fillRect(x, y, 2, 1);
  }
  for (const b of buttons) {
    const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
    if (x < -20 || x > 2000 || y < -30 || y > 2000) continue;
    const here = b.lift.t === b.stop;
    const col = b.flash > 0 ? '#ffffff' : liftLamp(b.lift, t, here);
    ctx.globalAlpha = 0.3; ctx.fillStyle = col; ctx.fillRect(x + 5, y + 1, 4, 6);
    ctx.globalAlpha = 1; ctx.fillRect(x + 6, y + (b.flash > 0 ? 3 : 2), 2, b.flash > 0 ? 3 : 4);
  }
}
