'use strict';
// Пиксельные спрайты, нарисованные кодом: герой, монстры, предметы, оружие.
// Фигуры рисуются в локальных координатах: (0,0) — середина низа, взгляд вправо.
// Герой и монстры собираются на черновом холсте из шарнирных конечностей,
// пиксельных деталей и затенённых объёмов, а в мир переносятся с тёмным контуром.

let SPR_FLASH = false;
const flashCache = {};
function C(hex) {
  if (!SPR_FLASH) return hex;
  return flashCache[hex] || (flashCache[hex] = mix(hex, '#ffffff', 0.55));
}
function R(ctx, x, y, w, h, hex) {
  ctx.fillStyle = C(hex);
  ctx.fillRect(x, y, w, h);
}

// ---------------- палитры ----------------
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
// Цвет из общей палитры игры (той же, что у текстур), чтобы герои и стены были одной породы.
const palCache = {};
function toPal(hex) {
  let c = palCache[hex];
  if (!c) { const [r, g, b] = hexToRgb(hex); c = palCache[hex] = rgbToHex(...qNearest(r, g, b)); }
  return c;
}
// Пять тонов из базового цвета: [глубокая тень, тень, основа, свет, блик].
// Тени уходят в холод, блики — в тепло, как у художников-пиксельщиков.
const rampCache = {};
function ramp(hex) {
  let r = rampCache[hex];
  if (r) return r;
  const [h, s, l] = hexToHsl(hex);
  const tw = (t, k) => h + ((((t - h) % 360) + 540) % 360 - 180) * k;
  const grey = s < 0.08;
  r = rampCache[hex] = [
    hslToHex(tw(250, 0.16), grey ? s : s * 1.05 + 0.04, l * 0.46),
    hslToHex(tw(250, 0.08), grey ? s : s * 1.02 + 0.02, l * 0.72),
    hex,
    hslToHex(tw(55, 0.07), s * 0.95, l + (1 - l) * 0.2),
    hslToHex(tw(55, 0.14), s * 0.85, l + (1 - l) * 0.42),
  ].map(toPal);
  return r;
}

// ---------------- пиксельные детали из строк ----------------
// rows — массив строк, символ = ключ палитры, '.' — прозрачно.
const partCache = new Map();
function part(id, rows, pal) {
  let c = partCache.get(id);
  if (c) return c;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  c = makeCanvas(w, h);
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) throw new Error('part ' + id + ': нет цвета для «' + ch + '»');
      x.fillStyle = col;
      x.fillRect(i, j, 1, 1);
    }
  }
  partCache.set(id, c);
  return c;
}

// Материал для деталей: пять символов строки получают пять тонов цвета,
// pal5('abcde', '#hex') — a самый тёмный, e — блик; '-' пропускает тон.
function pal5(chars, hex, into = {}) {
  const r = ramp(hex);
  for (let i = 0; i < chars.length && i < 5; i++) if (chars[i] !== '-') into[chars[i]] = r[i];
  return into;
}

// ---------------- объёмы ----------------
// Затенённый эллипсоид со светом сверху-слева (кэшируется по размеру и цвету).
const ballCache = new Map();
function ballCanvas(w, h, hex, dither = true) {
  const key = w + 'x' + h + hex + (dither ? 'd' : '');
  let c = ballCache.get(key);
  if (c) return c;
  const rp = ramp(hex);
  c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const lx = -0.48, ly = -0.62, lz = Math.sqrt(1 - lx * lx - ly * ly);
  for (let j = 0; j < h; j++) {
    const v = ((j + 0.5) / h) * 2 - 1;
    let run = -1, start = 0;
    for (let i = 0; i <= w; i++) {
      let idx = -1;
      if (i < w) {
        const u = ((i + 0.5) / w) * 2 - 1, d = u * u + v * v;
        if (d <= 1) {
          const I = u * lx + v * ly + Math.sqrt(1 - d) * lz + (dither ? ((i + j) & 1 ? 0.06 : -0.06) : 0);
          idx = I > 0.84 ? 4 : I > 0.52 ? 3 : I > 0.08 ? 2 : I > -0.32 ? 1 : 0;
        }
      }
      if (idx !== run) {
        if (run >= 0) { x.fillStyle = rp[run]; x.fillRect(start, j, i - start, 1); }
        run = idx; start = i;
      }
    }
  }
  ballCache.set(key, c);
  return c;
}
function ball(ctx, x, y, w, h, hex, dither) {
  ctx.drawImage(ballCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), hex, dither), Math.round(x), Math.round(y));
}
// Плоский эллипс без сглаживания (вписан в прямоугольник).
function ell(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  for (let j = 0; j < h; j++) {
    const v = ((j + 0.5) / h) * 2 - 1, k = Math.sqrt(Math.max(0, 1 - v * v));
    const half = Math.round((w / 2) * k);
    if (half > 0) ctx.fillRect(Math.round(x + w / 2 - half), y + j, half * 2, 1);
  }
}

// Выпуклый многоугольник без сглаживания: pts — плоский массив [x0,y0,x1,y1,...].
function poly(ctx, pts, col) {
  ctx.fillStyle = col;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
  const n = pts.length;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const x = ax + (yc - ay) * (bx - ax) / (by - ay);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    if (hi > lo) ctx.fillRect(Math.round(lo), y, Math.max(1, Math.round(hi) - Math.round(lo)), 1);
  }
}

// Каменная глыба: многоугольник в тени, внутри — смещённые к свету грань и блик.
function rock(ctx, pts, hex) {
  const rp = ramp(hex), n = pts.length / 2;
  let cx = 0, cy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    cx += pts[i] / n; cy += pts[i + 1] / n;
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  const w = x1 - x0, h = y1 - y0;
  const layer = (k, dx, dy) => pts.map((v, i) => (i % 2 ? cy + (v - cy) * k + dy : cx + (v - cx) * k + dx));
  poly(ctx, pts, rp[1]);
  poly(ctx, layer(0.84, -Math.min(3, w * 0.06), -Math.min(3, h * 0.06)), rp[2]);
  poly(ctx, layer(0.5, -w * 0.14, -h * 0.16), rp[3]);
}
// Каменная плита-конечность от (x0,y0) до (x1,y1) шириной w0→w1.
function slab(ctx, x0, y0, x1, y1, w0, w1, hex) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
  rock(ctx, [x0 + nx * w0 / 2, y0 + ny * w0 / 2, x1 + nx * w1 / 2, y1 + ny * w1 / 2, x1 - nx * w1 / 2, y1 - ny * w1 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2], hex);
}

// ---------------- конечности ----------------
// Толстый отрезок из квадратиков: тень, основа и блик со стороны света.
// t0/t1 — толщина у начала и конца, rp — палитра ramp().
function limb(ctx, x0, y0, x1, y1, t0, t1, rp, ol) {
  const dx = x1 - x0, dy = y1 - y0;
  const ad = Math.max(Math.abs(dx), Math.abs(dy)), len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(ad));
  const k = len > 0 ? 0.35 + 0.65 * ad / len : 1; // на диагоналях квадратики толще
  if (ol) {
    // собственный тёмный контур — чтобы рука читалась поверх корпуса
    ctx.fillStyle = ol;
    for (let i = 0; i <= n; i++) {
      const f = i / n, t = Math.max(1, Math.round(lerp(t0, t1, f) * k));
      ctx.fillRect(Math.round(x0 + dx * f - t / 2) - 1, Math.round(y0 + dy * f - t / 2) - 1, t + 2, t + 2);
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    ctx.fillStyle = rp[pass + 1];
    for (let i = 0; i <= n; i++) {
      const f = i / n, t = Math.max(1, Math.round(lerp(t0, t1, f) * k));
      const s = t === 1 ? (pass === 1 ? 1 : 0) : pass === 0 ? t : pass === 1 ? t - 1 : t >= 3 ? 1 : 0;
      if (s <= 0) continue;
      ctx.fillRect(Math.round(x0 + dx * f - t / 2), Math.round(y0 + dy * f - t / 2), s, s);
    }
  }
}
// Двухзвенная рука/нога: локоть ищется так, чтобы кисть попала в цель.
function ik(sx, sy, hx, hy, l1, l2, bend) {
  const dx = hx - sx, dy = hy - sy;
  const d = clamp(Math.hypot(dx, dy), 0.01, l1 + l2 - 0.01);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const base = Math.atan2(dy, dx) + bend * a;
  return [sx + Math.cos(base) * l1, sy + Math.sin(base) * l1];
}
function arm(ctx, sx, sy, hx, hy, l1, l2, bend, t, rp, hand, handSize = 2, ol) {
  const [ex, ey] = ik(sx, sy, hx, hy, l1, l2, bend);
  const d = Math.hypot(hx - sx, hy - sy);
  if (d > l1 + l2) { const k = (l1 + l2) / d; hx = sx + (hx - sx) * k; hy = sy + (hy - sy) * k; }
  if (ol) {
    limb(ctx, sx, sy, ex, ey, t, t, rp, ol);
    limb(ctx, ex, ey, hx, hy, t, Math.max(1, t - 1), rp, ol);
    if (hand) { ctx.fillStyle = ol; ctx.fillRect(Math.round(hx - handSize / 2) - 1, Math.round(hy - handSize / 2) - 1, handSize + 2, handSize + 2); }
  }
  limb(ctx, sx, sy, ex, ey, t, t, rp);
  limb(ctx, ex, ey, hx, hy, t, Math.max(1, t - 1), rp);
  if (hand) { ctx.fillStyle = hand; ctx.fillRect(Math.round(hx - handSize / 2), Math.round(hy - handSize / 2), handSize, handSize); }
  return [hx, hy];
}

// Поза ног: бедро-голень с шарнирами. Возвращает высоту таза над полом и точки.
// mode: 'stand' | 'walk' | 'air' | 'swim'. stride — размах шага в радианах.
function legPose(len, phase, mode, stride = 0.55, lift = 1) {
  const th = len * 0.52, sh = len - th, out = [];
  let low = 0;
  for (let k = 0; k < 2; k++) {
    const ph = phase + k * Math.PI;
    let a1, a2;
    if (mode === 'walk') { a1 = Math.sin(ph) * stride; a2 = Math.max(0, Math.cos(ph)) * 1.1 * lift + 0.08; }
    else if (mode === 'air') { a1 = k ? 0.65 : -0.15; a2 = k ? 1.3 : 0.45; }
    else if (mode === 'swim') { a1 = Math.sin(ph) * 0.35 - 0.5; a2 = 0.3 + Math.cos(ph) * 0.2; }
    else { a1 = k ? 0.24 : -0.16; a2 = k ? 0.2 : 0.1; }
    const kx = Math.sin(a1) * th, ky = Math.cos(a1) * th;
    const fx = kx + Math.sin(a1 - a2) * sh, fy = ky + Math.cos(a1 - a2) * sh;
    out.push({ kx, ky, fx, fy });
    low = Math.max(low, fy);
  }
  return { hip: mode === 'air' || mode === 'swim' ? len : Math.round(low), legs: out };
}
// Рисует обе ноги по позе: дальняя темнее. pal: {leg, boot} — цвета ramp-базы.
function drawLegPose(ctx, hx, hy, pose, legHex, bootHex, t = 3, bootLen = 4, bootFrom = 0.62) {
  for (let k = 0; k < 2; k++) {
    const L = pose.legs[k], far = k === 1;
    const rl = ramp(far ? shade(legHex, 0.72) : legHex), rb = ramp(far ? shade(bootHex, 0.72) : bootHex);
    const kx = hx + L.kx, ky = hy + L.ky, fx = hx + L.fx, fy = hy + L.fy;
    limb(ctx, hx, hy, kx, ky, t, t, rl);
    const bx = lerp(kx, fx, bootFrom), by = lerp(ky, fy, bootFrom);
    limb(ctx, kx, ky, bx, by, t, t, rl);
    limb(ctx, bx, by, fx, fy, t, t, rb);
    // стопа носком вперёд
    ctx.fillStyle = rb[2];
    ctx.fillRect(Math.round(fx - t / 2), Math.round(fy) - 2, bootLen, 2);
    ctx.fillStyle = rb[1];
    ctx.fillRect(Math.round(fx - t / 2), Math.round(fy) - 1, bootLen, 1);
  }
}

// ---------------- черновой холст и контур ----------------
// У каждого героя и монстра свой черновик: общий холст пришлось бы браузеру
// копировать при каждом повторном использовании внутри кадра.
const SPR = { cur: null, glows: [] };
function sprCanvas(ent, b) {
  const W = b.l * 2, H = b.u + b.d;
  let k = ent._spr;
  if (!k || k.W !== W || k.H !== H) {
    k = ent._spr = { W, H, OX: b.l, OY: b.u, c: makeCanvas(W, H), s: makeCanvas(W, H), still: false };
    k.x = k.c.getContext('2d'); k.sx = k.s.getContext('2d');
    k.x.imageSmoothingEnabled = false; k.sx.imageSmoothingEnabled = false;
  }
  return k;
}
// box: { l: полуширина, u: высота вверх, d: вниз } — размер черновика вокруг точки спрайта.
function sprBegin(b, ent) {
  const k = SPR.cur = sprCanvas(ent, b), s = k.x;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalAlpha = 1;
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, k.W, k.H);
  SPR.glows.length = 0;
  s.translate(k.OX, k.OY);
  return s;
}
// Готовит контур (силуэт) и вспышку ранения на черновике.
function sprFinish(flash, outline = '#0a0705') {
  const k = SPR.cur, s = k.x;
  s.setTransform(1, 0, 0, 1, 0, 0);
  if (flash) {
    s.globalCompositeOperation = 'source-atop';
    s.globalAlpha = 0.6;
    s.fillStyle = '#ffffff';
    s.fillRect(0, 0, k.W, k.H);
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-over';
  }
  k.outline = !!outline;
  if (outline) {
    const o = k.sx;
    o.globalCompositeOperation = 'copy';
    o.drawImage(k.c, 0, 0);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = outline;
    o.fillRect(0, 0, k.W, k.H);
    o.globalCompositeOperation = 'source-over';
  }
}
// Переносит готовый черновик в мир (ctx уже сдвинут в точку спрайта).
function sprBlit(ctx, k, alpha = 1) {
  const a0 = ctx.globalAlpha, X = -k.OX, Y = -k.OY;
  if (k.outline) {
    ctx.globalAlpha = a0 * alpha * 0.85;
    ctx.drawImage(k.s, X - 1, Y);
    ctx.drawImage(k.s, X + 1, Y);
    ctx.drawImage(k.s, X, Y - 1);
    ctx.drawImage(k.s, X, Y + 1);
  }
  ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(k.c, X, Y);
  ctx.globalAlpha = a0;
}
function sprEnd(ctx, b, flash, alpha = 1, outline) {
  sprFinish(flash, outline);
  sprBlit(ctx, SPR.cur, alpha);
}
// Светящаяся деталь: рисуется в спрайт и запоминается для яркого прохода (поверх освещения).
function glow(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  const m = ctx.getTransform(), cx = x + w / 2, cy = y + h / 2;
  SPR.glows.push(m.a * cx + m.c * cy + m.e - SPR.cur.OX, m.b * cx + m.d * cy + m.f - SPR.cur.OY, w, h, col);
}
function keepGlows(ent) {
  const g = ent.glows || (ent.glows = []);
  g.length = SPR.glows.length;
  for (let i = 0; i < g.length; i++) g[i] = SPR.glows[i];
}
function drawGlows(ctx, x, y, facing, g, alpha = 1) {
  if (!g || !g.length) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  for (let i = 0; i < g.length; i += 5) {
    const w = g[i + 2], h = g[i + 3], gx = Math.round(g[i] - w / 2), gy = Math.round(g[i + 1] - h / 2);
    ctx.fillStyle = g[i + 4];
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 * alpha;
    ctx.fillRect(gx - 1, gy - 1, w + 2, h + 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillRect(gx, gy, w, h);
  }
  ctx.restore();
}

// ---------------- оружие ----------------
// Картинки оружия стволом вправо. g — точка хвата (задняя рука), f — передняя рука.
const GUN_PAL = {
  k: '#1c1c22', m: '#383842', n: '#565662', M: '#7c7c8a', w: '#b4b4c2',
  d: '#341e10', b: '#5a3a1c', B: '#82542a',
  y: '#8a6420', Y: '#d8b048', r: '#7a1a10', R: '#d84028', o: '#ffa040',
  c: '#2a5aa0', C: '#a0d8ff', g: '#34401f', G: '#55673a', h: '#7c9050',
};
const GUN_ART = {
  1: { g: [1, 2], one: true, rows: [
    '.........mn...',
    '........mnMw..',
    'dbbbbBbbmnMMw.',
    '........mnMMMw',
    '.........mnMMw',
    '..........mmn.',
  ] },
  2: { g: [3, 1], f: [10, 2], rows: [
    '....nMMMMMMMMMMw',
    'BBbbmnnnmBBBBBnm',
    'bbd.k.k..dbbbd..',
    'bd..............',
  ] },
  3: { g: [3, 2], f: [8, 2], rows: [
    '...mMMMMMMMMMw',
    '...mnnnnnnnnnM',
    'BBbbmmdBBBBdmm',
    'bbd.k.........',
    'bd............',
  ] },
  4: { g: [3, 2], f: [7, 3], rows: [
    '..mnnnnnnm....',
    '.mnMMMMMMnmMMw',
    'mnnnnnnnnnmnnm',
    'm.k..mnnm.....',
    '.....mnm......',
  ] },
  5: { g: [3, 2], f: [7, 3], anim: true, rows: [
    '..mnnnnnnnm......',
    '.mnMMMMMMMnmMMMMw',
    'mnnnnnnnnnnkmmmmn',
    'mnnnnnnnnnnmMMMMw',
    'm.k..mnnm.mmmmm..',
    '.....mnm.........',
  ] },
  6: { g: [3, 2], f: [7, 3], rows: [
    '....gGGGGg....',
    'Bbmgghhhhgg.mMw',
    'bbmgGGGGGgmnnnm',
    'bd.k.gggggk....',
    'b.....k........',
  ] },
  7: { g: [6, 3], f: [10, 3], back: true, rows: [
    'rRmnMMMMMMMMMMMMMnw',
    'rRmnnnnnnnnnnnnnnmM',
    'rrmmmmmmmmmmmmmmmmn',
    '......mnm..mm......',
    '.......m...........',
  ] },
  8: { g: [3, 2], f: [7, 3], rows: [
    '..mnnnnnm......',
    '.mnyYyYyYnmMMMC',
    'mnnYyYyYynmnnnc',
    'm.k.mnnm.......',
    '....mnm........',
  ] },
  9: { g: [3, 2], f: [8, 3], rows: [
    '..mnnnnnnnnm....',
    '.mnMMMMMMMMMnmMk',
    'mnnRRRRRnnnnnmMo',
    'mnnrrrrrnnnnnmmo',
    'm.k..mnnm.......',
    '.....mnm........',
  ] },
  laser: { g: [2, 1], f: [6, 2], rows: [
    '.mnMMMMMMnk.',
    'mnnnnnnnnmMo',
    'm.k.mnm.....',
    '....mm......',
  ] },
};
function gunImg(kind, t = 0) {
  const a = GUN_ART[kind];
  if (!a) return null;
  if (a.anim) {
    // крутящийся блок стволов: светлая полоса бегает вверх-вниз
    const f = Math.floor(t * 30) % 2;
    const rows = a.rows.map((r, j) => (f && j >= 1 && j <= 3 ? r.slice(0, 12) + (j === 2 ? 'MMMMw' : 'mnnnn') : r));
    return part('gun' + kind + f, rows, GUN_PAL);
  }
  return part('gun' + kind, a.rows, GUN_PAL);
}
// Рисует оружие, повёрнутое вокруг (px,py) на угол ang; reach — вынос хвата от оси.
// Возвращает мировые точки задней и передней руки.
function drawGun(ctx, kind, px, py, ang, reach, t) {
  const a = GUN_ART[kind], img = gunImg(kind, t);
  if (!img) return null;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  const ox = Math.round(reach - a.g[0]), oy = -a.g[1];
  ctx.drawImage(img, ox, oy);
  ctx.restore();
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const at = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
  const rear = at(reach, 0);
  const front = a.f ? at(reach + a.f[0] - a.g[0], a.f[1] - a.g[1]) : null;
  return { rear, front };
}
// Оружие на полу (подбираемое): по центру, без рук.
function drawWeapon(ctx, sx, sy, ang, kind, anim, sleeve, hand, t = 0) {
  const img = gunImg(kind, t);
  if (!img) return;
  ctx.drawImage(img, Math.round(sx - 1), Math.round(sy - img.height / 2 + 1));
}

// ---------------- герой ----------------
const ARMOR_HEX = ['#5c4a30', '#3f7a38', '#b08a28', '#a02c22'];
function playerParts(armorType) {
  const pal = {};
  pal5('qrstu', '#4c5a34', pal);   // комбинезон
  pal5('ABCDE', ARMOR_HEX[armorType] || ARMOR_HEX[0], pal); // нагрудник
  pal5('vwxyz', '#5e4a2e', pal);   // ранец
  pal5('ijklm', '#4e3420', pal);   // ремни
  pal5('FGHIJ', '#5c6844', pal);   // шлем
  pal5('-abc-', '#c49070', pal);   // кожа
  pal.V = '#16242a'; pal.W = '#8cd0d0'; pal.Y = '#d8b040';
  const torso = part('pl-torso' + armorType, [
    '.xy.rsttu',
    'wxyrsCDDt',
    'wxyrBCDDs',
    'wxyrBCCDs',
    'wwxrBBCCr',
    '.wwkkkkYk',
    '...rssr..',
  ], pal);
  const head = part('pl-head', [
    '..HIIJ.',
    '.GHIIIH',
    'GHHFFFF',
    'GHHVVVV',
    'GGHVVWV',
    '.Gbcbb.',
    '..ab...',
  ], pal);
  const pad = part('pl-pad' + armorType, [
    '.CDD.',
    'BCCDE',
    'ABCCD',
    '.ABB.',
  ], pal);
  return { torso, head, pad };
}
const PLAYER_BOX = { l: 26, u: 40, d: 6 };
function playerArt(s, p) {
  const t = Game.time;
  const moving = p.onGround && Math.abs(p.vx) > 10;
  const swim = p.alive && !p.onGround && p.waterLevel >= 2;
  const air = p.alive && !p.onGround && p.waterLevel < 2;
  const mode = !p.alive ? 'stand' : swim ? 'swim' : air ? 'air' : moving ? 'walk' : 'stand';
  const pose = legPose(10, p.walkPhase + (swim ? t * 6 : 0), mode, 0.6);
  const hy = -pose.hip;
  const parts = playerParts(p.armorType || 0);
  const suit = ramp('#4c5a34'), suitFar = ramp('#3c4729');
  const glove = '#3a2c1e';
  const la = p.facing > 0 ? p.aim : Math.PI - p.aim;
  const kind = p.weapon;
  const ga = GUN_ART[kind] || GUN_ART[2];
  const top = hy - 7;
  // ось оружия — на уровне груди; ракетомёт лежит на плече
  const px = 1, py = ga.back ? top + 1 : top + 3;
  let ang = la, reach = ga.back ? 0 : 3;
  if (kind === 1 && p.attackAnim > 0) ang += lerp(0.9, -1.8, p.attackAnim / 0.3);
  else if (p.attackAnim > 0) reach -= 2 * p.attackAnim / 0.12;
  if (!p.alive) ang = 1.2;
  // 1. дальняя рука (к цевью) — за телом; пока оружия не видно, считаем точки без рисования
  let hands = null;
  if (p.alive) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const at = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
    hands = { rear: at(reach, 0), front: ga.f ? at(reach + ga.f[0] - ga.g[0], ga.f[1] - ga.g[1]) : null };
  }
  const shFar = [1, top + 1], shNear = [-1, top + 2];
  if (hands && hands.front) arm(s, shFar[0], shFar[1], hands.front[0], hands.front[1], 4, 5, 1, 2, suitFar, glove);
  else arm(s, shFar[0], shFar[1], shFar[0] + 1 + Math.sin(p.walkPhase) * (moving ? 2 : 0), shFar[1] + 7, 4, 4, -1, 2, suitFar, glove);
  // 2. ноги
  drawLegPose(s, 0, hy, pose, '#4a4430', '#2a2018', 3, 4);
  // 3. корпус и голова
  s.drawImage(parts.torso, -5, top);
  if (p.alive && ga.back) drawGun(s, kind, px, py, ang, reach, t); // труба на дальнем плече, за головой
  s.drawImage(parts.head, -3, top - 6);
  // 4. оружие и ближняя рука
  if (p.alive) {
    if (!ga.back) drawGun(s, kind, px, py, ang, reach, t);
    arm(s, shNear[0], shNear[1], hands.rear[0], hands.rear[1], 4, 5, 1, 2, suit, glove, 2, '#1a1c10');
    s.drawImage(parts.pad, -3, top);
  } else {
    arm(s, shNear[0], shNear[1], shNear[0] - 1, shNear[1] + 7, 4, 4, -1, 2, suit, glove);
  }
}
function drawPlayerSprite(ctx, x, y, p) {
  const s = sprBegin(PLAYER_BOX, p);
  playerArt(s, p);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing, 1);
  if (!p.alive) {
    const k = Math.min(1, p.deadT / 0.45);
    ctx.translate(0, -k * 3);
    ctx.rotate(-k * Math.PI / 2);
  }
  const invis = p.ring > 0;
  sprEnd(ctx, PLAYER_BOX, p.hurtFlash > 0, invis ? 0.16 : 1, invis ? null : undefined);
  if (invis) {
    // при невидимости видны только глаза
    ctx.globalAlpha = 0.9;
    R(ctx, 1, -19, 1, 1, '#ffe080');
    R(ctx, 3, -19, 1, 1, '#ffe080');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------- монстры ----------------
function moveMode(m) { return m.air ? 'air' : m.moving ? 'walk' : 'stand'; }
const MPAL = {};
function mpal(id, build) { return MPAL[id] || (MPAL[id] = build({})); }
// Точки рук на оружии без рисования (рука за оружием рисуется раньше него).
function gunHands(kind, px, py, ang, reach) {
  const a = GUN_ART[kind], cs = Math.cos(ang), sn = Math.sin(ang);
  const at = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
  return { rear: at(reach, 0), front: a.f ? at(reach + a.f[0] - a.g[0], a.f[1] - a.g[1]) : null };
}
// Клинок или иное оружие из картинки, повёрнутое вокруг хвата (gx, gy).
function drawHeld(ctx, img, gx, gy, hx, hy, ang) {
  ctx.save();
  ctx.translate(Math.round(hx), Math.round(hy));
  ctx.rotate(ang);
  ctx.drawImage(img, -gx, -gy);
  ctx.restore();
}
const BLADE_PAL = Object.assign({}, GUN_PAL, { s: '#c8ccd8', S: '#eef0f8', e: '#8a8e9a', f: '#ff7a30', F: '#ffd060' });
const BLADES = {
  sword: { g: [1, 2], rows: [
    '..y...........',
    '..y.......... ',
    'dbySSSSSSSSSSs',
    '..yeeeeeeeeee.',
    '..y...........',
  ] },
  flame: { g: [2, 2], rows: [
    '...y..............',
    '...y..............',
    'ddbymmmmmmmmmmmmmn',
    '...yfFfFfFfFfFfFf.',
    '...y..............',
  ] },
  hammer: { g: [1, 3], rows: [
    '.............nMMw',
    '.............nMMw',
    '.............nMMM',
    'dbbbbbbbbbbbbnMMM',
    '.............nnMM',
    '.............mnnM',
    '.............mnnn',
  ] },
};
function blade(id) { const b = BLADES[id]; return part('blade-' + id, b.rows, BLADE_PAL); }
function chainsaw(t, fast) {
  const f = Math.floor(t * (fast ? 30 : 5)) % 2;
  return part('saw' + f, [
    f ? '.mnnnm..M.M.M.M.M.' : '.mnnnm.M.M.M.M.M.M',
    'mnMMMnmwwwwwwwwwwM',
    'mnnRnnmMMMMMMMMMMw',
    'mnnnnnmwwwwwwwwwwM',
    f ? '.mmmmm..M.M.M.M.M.' : '.mmmmm.M.M.M.M.M.M',
  ], GUN_PAL);
}

// Стрелок: ноги, дальняя рука к цевью, корпус, голова, оружие и ближняя рука к хвату.
function gunner(s, m, o) {
  const pose = legPose(o.leg, m.walkPhase, moveMode(m), o.stride || 0.5);
  const hy = -pose.hip, top = hy - o.torso.height + (o.sink || 0);
  const ang = m.aimLocal || 0;
  const reach = 3 - (m.fireAnim > 0 ? 2 * m.fireAnim / 0.12 : 0);
  const px = 1, py = top + (o.gunY || 3);
  const h = gunHands(o.gun, px, py, ang, reach);
  const sl = ramp(o.sleeve), slFar = ramp(shade(o.sleeve, 0.75));
  if (h.front) arm(s, 1, top + 1, h.front[0], h.front[1], o.arm || 4, (o.arm || 4) + 1, 1, o.armT || 2, slFar, o.glove);
  drawLegPose(s, 0, hy, pose, o.legHex, o.boot, o.legT || 3, o.bootLen || 4);
  s.drawImage(o.torso, o.tx, top);
  s.drawImage(o.head, o.hx, top - o.head.height + (o.neck || 1));
  if (o.headGlow) o.headGlow(s, o.hx, top - o.head.height + (o.neck || 1));
  drawGun(s, o.gun, px, py, ang, reach, Game.time);
  arm(s, -1, top + 2, h.rear[0], h.rear[1], o.arm || 4, (o.arm || 4) + 1, 1, o.armT || 2, sl, o.glove, 2, '#140e0a');
  if (o.pad) s.drawImage(o.pad, -2, top - 1);
  return top;
}
// Мечник: клинок в ближней руке; ang — угол клинка, рука следует за ним.
function swordArm(s, sx, sy, ang, len, sleeveHex, glove, img, g, ol = '#140e0a', armT = 2) {
  const d = ang * 0.8 + 0.5;
  const hx = sx + Math.cos(d) * len, hy = sy + Math.sin(d) * len;
  drawHeld(s, img, g[0], g[1], hx, hy, ang);
  arm(s, sx, sy, hx, hy, len * 0.55, len * 0.6, -1, armT, ramp(sleeveHex), glove, 2, ol);
}

const MONSTER_ART = {
  grunt(s, m) {
    const pal = mpal('grunt', (p) => {
      pal5('qrstu', '#646034', p); pal5('FGHIJ', '#4e5236', p); pal5('-abc-', '#b48a6c', p); pal5('vwxyz', '#6e5236', p);
      p.e = '#2a1410'; p.m = '#5a2a1a'; p.k = '#3a2a18'; p.Y = '#b09040'; p.j = '#4a3420';
      return p;
    });
    gunner(s, m, {
      leg: 10, legHex: '#4e4a30', boot: '#2a2018', gun: 2, sleeve: '#646034', glove: '#8a6448',
      tx: -6, torso: part('gr-torso', [
        '.xy.rsstt.',
        'wxyjrrjstu',
        'wxyyqrrjss',
        'wxyyqrrsjs',
        'wwxx.qrrss',
        '.ww.kkkkYk',
        '....rssr..',
      ], pal),
      hx: -4, head: part('gr-head', [
        '..HHIJ..',
        '.GHHHIH.',
        'FGGGGGGG',
        '.Fabbec.',
        '.Fabbbcc',
        '..aabmb.',
        '...aa...',
      ], pal),
    });
  },

  enforcer(s, m) {
    const pal = mpal('enforcer', (p) => {
      pal5('ABCDE', '#8c8a6e', p); pal5('qrstu', '#46463a', p); pal5('fghij', '#5e5e56', p);
      p.V = '#e8c040'; p.k = '#22241c'; p.R = '#c03018'; return p;
    });
    gunner(s, m, {
      leg: 11, legT: 4, legHex: '#56564a', boot: '#24241e', gun: 'laser', sleeve: '#6a6a58', glove: '#2e2e26', armT: 3,
      tx: -7, torso: part('en-torso', [
        '.ghi...qrsstt.',
        'fghhi.qrBCCDt.',
        'fghRi.qBBCCDDs',
        'fghhiqrBCCCDDs',
        'fgghiqrBBCCCDr',
        '.fghi.qrBBBCr.',
        '..ff..kkkkkkkk',
        '.......rssr...',
      ], pal),
      hx: -3, head: part('en-head', [
        '..BCCD.',
        '.BCCDDD',
        'BBCCDDE',
        'BBCkkkk',
        'BBBCCCD',
        '.ABBCC.',
        '..qq...',
      ], pal),
      headGlow: (c, x, y) => glow(c, x + 4, y + 3, 3, 1, '#ffd848'),
      pad: part('en-pad', [
        '.CDD.',
        'BCCDE',
        'BBCCD',
        '.BBC.',
      ], pal),
    });
  },

  knight(s, m) {
    const pal = mpal('knight', (p) => {
      pal5('ABCDE', '#8a6c40', p); pal5('qrstu', '#6e6e66', p); pal5('vwxyz', '#5e5e58', p);
      p.V = '#120c08'; p.k = '#3a2a18'; p.Y = '#a08040'; return p;
    });
    const pose = legPose(10, m.walkPhase, moveMode(m), 0.6);
    const hy = -pose.hip, top = hy - 8;
    let ang = -0.9;
    if (m.state === 'attack') ang = lerp(-2.4, 0.7, clamp(m.stateT / 0.3, 0, 1));
    const sw = m.moving ? Math.sin(m.walkPhase) * 2 : 0;
    arm(s, 1, top + 2, 2 - sw, top + 9, 4, 4, -1, 2, ramp('#5e5e56'), '#4a3a2a');
    drawLegPose(s, 0, hy, pose, '#5e5446', '#2a2018', 3, 4);
    s.drawImage(part('kn-torso', [
      '..rCCDD..',
      '.rBCCDDE.',
      'qrBCCCDD.',
      'qrBBCCDC.',
      '.qrBBCCC.',
      '.kkkkYkkk',
      '..wxyxyw.',
      '..wxwxyx.',
      '...w.w.w.',
    ], pal), -4, top);
    s.drawImage(part('kn-head', [
      '..BCCD.',
      '.BCCDDD',
      'BCCDDDE',
      'BCCVVVV',
      'BBCCDVD',
      '.BBCCC.',
      '..qr...',
    ], pal), -3, top - 6);
    swordArm(s, -1, top + 2, ang, 6, '#6e6e66', '#4a3a2a', blade('sword'), BLADES.sword.g);
  },

  hknight(s, m) {
    const pal = mpal('hknight', (p) => {
      pal5('ABCDE', '#621f16', p); pal5('qrstu', '#2e100c', p); pal5('-hH--', '#d0c6a4', p);
      p.V = '#ff6020'; p.k = '#1a0806'; p.Y = '#c8c0a0'; return p;
    });
    const pose = legPose(12, m.walkPhase, moveMode(m), 0.55);
    const hy = -pose.hip, top = hy - 9;
    let ang = -0.8;
    if (m.state === 'attack' && m.attackKind === 'melee') ang = lerp(-2.4, 0.7, clamp(m.stateT / 0.35, 0, 1));
    else if (m.state === 'attack') ang = lerp(-0.8, -1.7, clamp(m.stateT / 0.4, 0, 1));
    const sw = m.moving ? Math.sin(m.walkPhase) * 2 : 0;
    arm(s, 1, top + 2, 2 - sw, top + 10, 5, 5, -1, 3, ramp('#3a1410'), '#1a0806');
    drawLegPose(s, 0, hy, pose, '#4a1812', '#1a0806', 4, 5);
    s.drawImage(part('hk-torso', [
      '..qBCCDD..',
      '.qBBCCDDE.',
      'qrBCCCDDD.',
      'qrBBCCCDD.',
      'qrBBCCCCD.',
      '.qrBBCCCr.',
      '.kkkkkYkkk',
      '..qrBCr...',
      '..qrBr....',
    ], pal), -5, top);
    const hx = -4, hyy = top - 8;
    s.drawImage(part('hk-head', [
      '..H.H.H.',
      '..hHhHh.',
      '.hBCCDh.',
      '.BCCDDE.',
      '.BCkkkk.',
      '.BBCCDD.',
      '..BBCC..',
      '...qr...',
    ], pal), hx, hyy);
    glow(s, hx + 4, hyy + 4, 3, 1, '#ff6a20');
    swordArm(s, -1, top + 2, ang, 7, '#4a1812', '#1a0806', blade('flame'), BLADES.flame.g, '#0a0404', 3);
  },

  zombie(s, m) {
    const pal = mpal('zombie', (p) => {
      pal5('ABCDE', '#9c8c80', p); pal5('qrstu', '#4a3c30', p);
      p.W = '#6a1010'; p.w = '#a82418'; p.i = '#d8d0bc'; p.e = '#1a0000'; return p;
    });
    const down = m.state === 'down';
    const pose = legPose(9, m.walkPhase * 0.7, moveMode(m), 0.35, 0.6);
    const hy = -pose.hip, top = hy - 7;
    let ang = 0.25 + Math.sin(m.anim * 2) * 0.08;
    const throwing = m.state === 'attack';
    if (throwing) ang = lerp(-2.6, 0.2, clamp((m.stateT - 0.2) / 0.3, 0, 1));
    const flesh = ramp('#9c8c80'), fleshFar = ramp('#7a6c62');
    const reach = (a, l) => [Math.cos(a) * l, Math.sin(a) * l];
    const [fx, fy] = reach(ang + 0.15, 8);
    arm(s, 1, top + 2, 1 + fx, top + 2 + fy, 4, 4, -1, 2, fleshFar, '#8a7a6e');
    drawLegPose(s, 0, hy, pose, '#4a3c30', '#2a221c', 3, 4);
    s.drawImage(part('zb-torso', [
      '..rssB..',
      '.rrsBCC.',
      'qrrBiCi.',
      'qrsBWiC.',
      '.qrrBBC.',
      '.rr.rr..',
      '..rssr..',
    ], pal), -3, top);
    s.drawImage(part('zb-head', [
      '.BCCD.',
      'ABCCCD',
      'ABCeCC',
      'AABCCC',
      '.AWww.',
      '..AB..',
    ], pal), 0, top - 5);
    const [nx, ny] = reach(ang, 8);
    const hx = 0 + nx, hyy = top + 2 + ny;
    arm(s, 0, top + 2, hx, hyy, 4, 4, -1, 2, flesh, '#b0a090', 2, '#1a1210');
    if (throwing && m.stateT < 0.5) { s.fillStyle = '#7a2010'; s.fillRect(Math.round(hx) - 1, Math.round(hyy) - 2, 3, 3); s.fillStyle = '#a83a20'; s.fillRect(Math.round(hx) - 1, Math.round(hyy) - 2, 2, 1); }
    if (down) { /* лежит — поза рисуется так же, поворот делает обёртка */ }
  },

  ogre(s, m) {
    const pal = mpal('ogre', (p) => {
      pal5('ABCDE', '#9e7c58', p); pal5('qrstu', '#4e3a26', p);
      p.V = '#ff4020'; p.i = '#e8e0c8'; p.k = '#2a1c10'; p.Y = '#b09040'; return p;
    });
    const pose = legPose(10, m.walkPhase, moveMode(m), 0.45);
    const hy = -pose.hip, top = hy - 13;
    const sawing = m.state === 'attack' && m.attackKind === 'melee';
    const lobbing = m.state === 'attack' && m.attackKind === 'ranged';
    const j = sawing ? randInt(-1, 1) : 0;
    const skin = ramp('#9e7c58'), skinFar = ramp('#7e6044');
    // гранатомёт за спиной
    s.drawImage(part('og-gl', [
      '.gGGg..',
      'mgGhGgm',
      'mgGGGgn',
      '.ggggk.',
    ], GUN_PAL), -10, top + 1);
    const sawAng = lobbing ? -0.5 : sawing ? 0.05 : 0.15;
    const sx = 3, sy = top + 9 + j;
    arm(s, 2, top + 3, sx + 6, sy + 1, 5, 5, 1, 4, skinFar, '#6a4e34');
    drawLegPose(s, 0, hy, pose, '#5a4630', '#2a1e14', 5, 6);
    ball(s, -8, top, 16, 14, '#9e7c58');
    s.drawImage(part('og-harness', [
      'rs..........',
      'qrs.........',
      '.qrs........',
      '..qrs.......',
      '...qrsY.....',
      '....qrs.....',
      'kkkkkkkkkkkk',
      'qrrsrrsYsrrq',
      '.qrrsrrsrrq.',
    ], pal), -8, top + 3);
    s.drawImage(part('og-head', [
      '...BCCD..',
      '..ABCCDD.',
      '.AAAAAAAD',
      '.ABBCkCC.',
      'qABBCCCCD',
      'qAABiAiA.',
      '.qAABBBA.',
      '..qqqqq..',
    ], pal), 1, top - 5);
    glow(s, 6, top - 2, 1, 1, '#ff5020');
    drawHeld(s, chainsaw(Game.time, sawing), 1, 2, sx, sy, sawAng);
    arm(s, -1, top + 3, sx + 1, sy, 5, 5, 1, 4, skin, '#6a4e34', 3, '#140c06');
  },

  phantom(s, m) {
    const pal = mpal('phantom', (p) => { pal5('ABCDE', '#52468c', p); p.V = '#0c0814'; p.v = '#1c1428'; return p; });
    const t = m.anim, bob = Math.round(Math.sin(t * 3 + m.seed));
    const cl = ramp('#52468c');
    // рваный подол — колышущиеся лоскуты
    for (let i = 0; i < 6; i++) {
      const len = 6 + Math.round(Math.sin(t * 6 + i * 1.7) * 2) + (i % 2) * 2;
      const x = -5 + i * 2;
      s.fillStyle = cl[i % 2 ? 1 : 2];
      s.fillRect(x, -10 + bob, 2, len);
      s.fillStyle = cl[0];
      s.fillRect(x + 1, -10 + bob + len - 2, 1, 2);
    }
    s.drawImage(part('ph-body', [
      '..BCCDD..',
      '.ABCCCDD.',
      '.ABBCCCD.',
      'AABBCCCDD',
      'AABBCCCCD',
      'AABBBCCCD',
      'AAABBCCCC',
      'AAABBBCCC',
      '.AABBBCC.',
      '.AAABBBC.',
      '..AABBC..',
    ], pal), -5, -21 + bob);
    s.drawImage(part('ph-hood', [
      '..BCCD..',
      '.ABCCDD.',
      'ABBCCVVD',
      'ABBCVVVv',
      'ABBCVVV.',
      'AABBCVv.',
      '.AABBC..',
    ], pal), -4, -27 + bob);
    glow(s, 1, -23 + bob, 1, 1, '#f0c8ff');
    glow(s, 3, -23 + bob, 1, 1, '#f0c8ff');
    const cast = m.state === 'attack';
    const a = cast ? m.aimLocal : 0.9 + Math.sin(t * 2) * 0.15;
    const hx = 1 + Math.cos(a) * 8, hyy = -16 + bob + Math.sin(a) * 8;
    arm(s, 1, -17 + bob, hx, hyy, 4, 5, -1, 2, cl, '#d8c0f8', 2, '#120c20');
  },

  guardian(s, m) {
    const pal = mpal('guardian', (p) => {
      pal5('ABCDE', '#56637a', p); pal5('qrstu', '#2c3442', p); p.Q = '#40d0ff'; p.k = '#1a2028'; return p;
    });
    const pose = legPose(12, m.walkPhase, moveMode(m), 0.4);
    const hy = -pose.hip, top = hy - 12;
    let ang = -1.2;
    if (m.state === 'attack' && m.attackKind === 'melee') ang = m.stateT < 0.45 ? lerp(-1.2, -2.8, m.stateT / 0.45) : lerp(-2.8, 0.9, clamp((m.stateT - 0.45) / 0.1, 0, 1));
    else if (m.state === 'attack') ang = m.aimLocal;
    // молот в дальней руке — за телом
    const d = ang * 0.8 + 0.4, hx = -3 + Math.cos(d) * 7, hyy = top + 3 + Math.sin(d) * 7;
    drawHeld(s, blade('hammer'), 1, 3, hx, hyy, ang);
    arm(s, -3, top + 3, hx, hyy, 4, 5, -1, 3, ramp('#3e4858'), '#2a3240');
    drawLegPose(s, 0, hy, pose, '#3c4656', '#1e232c', 5, 6);
    s.drawImage(part('gd-torso', [
      '...qrCCDDD...',
      '..qrBCCDDDE..',
      '.qrBBCCDDDDD.',
      'qrBBCCQCCDDDD',
      'qrBBCCQCCDDDD',
      'qrBBCQQQCCDDD',
      'qrBBCCQCCCDDC',
      '.qrBBCQCCCDC.',
      '.qrBBCCCCCC..',
      '.kkkkkkkkkkk.',
      '..qrBCCD.....',
      '..qrBCD......',
    ], pal), -6, top);
    glow(s, 0, top + 3, 1, 5, '#40d0ff');
    s.drawImage(part('gd-head', [
      '...QQ...',
      '..BCCD..',
      '.BCCDDE.',
      'BBCCDDDE',
      'BBCkkkkk',
      'BBCCCDDD',
      '.BBCCCD.',
      '..qrr...',
    ], pal), -3, top - 8);
    glow(s, 0, top - 8, 2, 1, '#40d0ff');
    glow(s, 1, top - 4, 4, 1, '#80f0ff');
    // башенный щит спереди
    const up = m.state === 'attack' ? 3 : 0;
    s.drawImage(part('gd-shield', [
      '.CDD.',
      'BCCDD',
      'BCCDD',
      'BCQDD',
      'BCQDD',
      'BQQQD',
      'BCQDD',
      'BCQDD',
      'BCCDD',
      'BCCDD',
      'BCCDD',
      'BCCDD',
      'BCCDD',
      'BBCCD',
      'BBCCD',
      'BBCCD',
      '.BBC.',
    ], pal), 6, top - 1 + up);
    glow(s, 8, top + 5 + up, 1, 4, '#40d0ff');
  },
};

// Когти: три светлых пикселя веером в точке (x,y) по направлению a.
function claws(ctx, x, y, a, col, len = 3) {
  ctx.fillStyle = col;
  for (const da of [-0.5, 0, 0.5]) {
    for (let i = 1; i <= len; i++) {
      ctx.fillRect(Math.round(x + Math.cos(a + da) * i), Math.round(y + Math.sin(a + da) * i), 1, 1);
    }
  }
}
// Хвост/щупальце: цепочка сужающихся отрезков, bend(i) — изгиб i-го звена.
function chain(ctx, x, y, a, seg, n, t0, t1, rp, bend) {
  let px = x, py = y;
  for (let i = 0; i < n; i++) {
    a += bend(i);
    const nx = px + Math.cos(a) * seg, ny = py + Math.sin(a) * seg;
    limb(ctx, px, py, nx, ny, lerp(t0, t1, i / n), lerp(t0, t1, (i + 1) / n), rp);
    px = nx; py = ny;
  }
  return [px, py, a];
}

Object.assign(MONSTER_ART, {
  fiend(s, m) {
    const pal = mpal('fiend', (p) => {
      pal5('ABCDE', '#a88858', p); p.k = '#3a2410'; p.i = '#f0e8d0'; p.r = '#5a1408'; p.h = '#d8d0b0'; return p;
    });
    const leap = m.state === 'leap';
    const skin = ramp('#a88858'), far = ramp('#86683e');
    const ph = m.walkPhase, mv = m.moving;
    // задние ноги — «собачьи» колени
    for (let k = 1; k >= 0; k--) {
      const sw = mv ? Math.sin(ph + k * Math.PI) * 0.5 : leap ? 0.6 : 0;
      const rp = k ? far : skin, hx = -5 + k, hy = -10;
      const kx = hx - 3 - sw * 3, ky = hy + 4;
      const ax = kx + 2 + sw * 2, ay = leap ? -2 : -1;
      limb(s, hx, hy, kx, ky, 4, 3, rp);
      limb(s, kx, ky, ax, ay, 3, 2, rp);
      s.fillStyle = rp[1]; s.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 4, 2);
    }
    // дальняя лапа
    let a = leap ? -0.35 : m.state === 'attack' ? lerp(-1.8, 0.8, clamp(m.stateT / 0.25, 0, 1)) : 1.1 + Math.sin(ph) * 0.25;
    const fa = a + 0.3;
    const fx = 3 + Math.cos(fa) * 11, fy = -16 + Math.sin(fa) * 11;
    arm(s, 3, -16, fx, fy, 6, 6, -1, 3, far);
    claws(s, fx, fy, fa, '#c8c0a8');
    // туловище и гребень
    ball(s, -11, -22, 17, 13, '#a88858');
    for (let i = 0; i < 5; i++) { s.fillStyle = i % 2 ? '#6a4a28' : '#86683e'; s.fillRect(-9 + i * 3, -23 - (i % 2), 2, 2); }
    s.fillStyle = skin[1];
    for (const x of [-7, -3, 1]) s.fillRect(x, -19, 1, 6);
    // голова с пастью
    const open = m.state === 'attack' || leap;
    s.drawImage(part(open ? 'fd-head1' : 'fd-head0', open ? [
      '.h......',
      'hBCCD...',
      'ABCCDDD.',
      'ABCkCCDD',
      'AABBCCC.',
      '.Arrrrr.',
      '.Airirii',
      '..AAAA..',
    ] : [
      '.h......',
      'hBCCD...',
      'ABCCDDD.',
      'ABCkCCDD',
      'AABBCCCC',
      '.AiAiAi.',
      '..AAAA..',
      '........',
    ], pal), 4, -22);
    glow(s, 7, -19, 1, 1, '#ffd040');
    // ближняя лапа
    const nx = 4 + Math.cos(a) * 12, ny = -15 + Math.sin(a) * 12;
    arm(s, 4, -15, nx, ny, 6, 6, -1, 3, skin, null, 2, '#1a0e04');
    claws(s, nx, ny, a, '#f0e8d0');
  },

  dog(s, m) {
    const pal = mpal('dog', (p) => {
      pal5('ABCDE', '#3e2a1c', p); pal5('-tuv-', '#8a5a30', p); p.k = '#100604'; p.i = '#e8e0d0'; p.r = '#6a1010'; return p;
    });
    const run = m.moving || m.state === 'leap';
    const ph = m.walkPhase * 1.5;
    const legs = [[-5, ph + 0.6, 1], [5, ph + Math.PI, 1], [-4, ph + 0.6 + Math.PI, 0], [6, ph, 0]];
    for (const [x, p, far] of legs) {
      const rp = ramp(far ? '#2a1c12' : '#3e2a1c');
      const sw = run ? Math.sin(p) : 0;
      const kx = x + sw * 2, ky = -4;
      const fx = x + sw * 3 + (run ? Math.max(0, Math.cos(p)) * 1.5 : 0), fy = run ? -Math.max(0, Math.cos(p)) * 2 : 0;
      limb(s, x, -7, kx, ky, 3, 2, rp);
      limb(s, kx, ky, fx, fy - 1, 2, 2, rp);
    }
    const bob = run ? Math.round(Math.sin(ph * 2) * 0.6) : 0;
    // хвост
    limb(s, -8, -9 + bob, -10, -12 + bob + (run ? Math.round(Math.sin(ph)) : 0), 2, 1, ramp('#3e2a1c'));
    ball(s, -9, -12 + bob, 15, 7, '#3e2a1c');
    s.fillStyle = '#7a4e28'; s.fillRect(-5, -7 + bob, 8, 1);
    const bite = m.state === 'attack' && m.stateT < 0.25;
    s.drawImage(part(bite ? 'dg-head1' : 'dg-head0', bite ? [
      '.B.....',
      'ABCC...',
      'ABCkCCD',
      'AABBCCt',
      '.Arrrr.',
      '.Aiii..',
      '..tu...',
    ] : [
      '.B.....',
      'ABCC...',
      'ABCkCCD',
      'AABBCCt',
      '.AAtuuk',
      '..tu...',
      '.......',
    ], pal), 3, -14 + bob);
    glow(s, 6, -12 + bob, 1, 1, '#ff3010');
  },

  scrag(s, m) {
    const pal = mpal('scrag', (p) => { pal5('ABCDE', '#7a8048', p); p.k = '#200806'; p.r = '#4a1008'; p.i = '#e0e0b8'; return p; });
    const t = m.anim, bob = Math.round(Math.sin(t * 4) * 1.5);
    const rp = ramp('#7a8048');
    s.translate(0, bob);
    // хвост-жгут вместо ног
    chain(s, -1, -6, 2.15, 2.2, 4, 3, 1, rp, (i) => 0.12 + Math.sin(t * 6 - i * 0.9) * 0.35);
    const attack = m.state === 'attack';
    const a = attack ? -0.3 : 0.5 + Math.sin(t * 3) * 0.3;
    // дальняя рука
    const fx = 2 + Math.cos(a + 0.7) * 6, fy = -10 + Math.sin(a + 0.7) * 6;
    arm(s, 1, -10, fx, fy, 3, 4, -1, 2, ramp('#5e6434'));
    claws(s, fx, fy, a + 0.7, '#a0a070', 2);
    s.drawImage(part('sc-body', [
      '..BCD..',
      '.ABCCD.',
      'AABCCDD',
      'AABCCCD',
      '.AABCC.',
      '.AABC..',
      '..AB...',
    ], pal), -4, -12);
    s.drawImage(part(attack ? 'sc-head1' : 'sc-head0', attack ? [
      '..BCD..',
      '.ABCCDD',
      'AABkCCD',
      'AABCCCD',
      '.ABrrrr',
      '..Aiir.',
    ] : [
      '..BCD..',
      '.ABCCDD',
      'AABkCCD',
      'AABCCCD',
      '.AABrri',
      '..AAB..',
    ], pal), -2, -18);
    glow(s, 1, -16, 1, 1, '#ff4020');
    const nx = 2 + Math.cos(a) * 7, ny = -9 + Math.sin(a) * 7;
    arm(s, 1, -9, nx, ny, 3, 4, -1, 2, rp, null, 2, '#1a1c08');
    claws(s, nx, ny, a, '#d0d0a0', 2);
  },

  vore(s, m) {
    const pal = mpal('vore', (p) => { p.r = '#7a4050'; p.R = '#5a2834'; p.k = '#1a0810'; p.i = '#e8d8c8'; p.v = '#d070ff'; return p; });
    const mv = m.moving, ph = m.walkPhase;
    const legRp = ramp('#6a4a50'), farRp = ramp('#4e343a');
    // три тонкие ноги-ходули
    const legs = [[-7, 0, 1], [7, 1, 1], [-1, 2, 0], [8, 3, 0]];
    for (const [x, i, far] of legs) {
      const p = ph + i * 2.1, sw = mv ? Math.sin(p) * 3 : 0;
      const hx = x * 0.6, hy = -12;
      const kx = x + sw * 0.5 + (x < 0 ? -3 : 3), ky = -16 + (mv ? Math.max(0, Math.cos(p)) * -2 : 0);
      const fx = x + sw + (x < 0 ? -2 : 2), fy = mv ? -Math.max(0, Math.cos(p)) * 2 : 0;
      const rp = far ? farRp : legRp;
      limb(s, hx, hy, kx, ky, 2, 2, rp);
      limb(s, kx, ky, fx, fy, 2, 1, rp);
    }
    ball(s, -11, -27, 22, 17, '#a87884');
    // извилины
    s.fillStyle = '#7a4a58';
    for (const [x, y, w] of [[-7, -24, 4], [-2, -25, 5], [-8, -20, 3], [-3, -21, 4], [3, -22, 3], [-6, -16, 4], [0, -17, 3]]) s.fillRect(x, y, w, 1);
    s.fillStyle = '#c8a0a8';
    for (const [x, y, w] of [[-6, -25, 2], [-1, -26, 2], [-7, -21, 2]]) s.fillRect(x, y, w, 1);
    const open = m.state === 'attack' && m.stateT > 0.3 && m.stateT < 0.8;
    s.drawImage(part(open ? 'vo-mouth1' : 'vo-mouth0', open ? [
      '.kkkkk.',
      'kiikiik',
      'kvvvvvk',
      'kiikiik',
      '.kkkkk.',
    ] : [
      '.......',
      '.RRRRR.',
      'RkkkkkR',
      '.RiRiR.',
      '.......',
    ], pal), 3, -16);
    if (open) glow(s, 4, -14, 5, 1, '#e090ff');
  },

  spawn(s, m) {
    const p = Math.round(Math.sin(m.anim * 8));
    const h = 9 + p, w = 13 - p;
    ball(s, -Math.round(w / 2), -h, w, h, '#2c4cb4');
    // внутри просвечивают тёмные сгустки, сверху — влажный блик
    s.fillStyle = '#1c3488';
    s.fillRect(-3, -Math.round(h / 2) + 1, 2, 1); s.fillRect(1, -Math.round(h / 2) - 1, 2, 1); s.fillRect(-1, -2, 2, 1);
    s.fillStyle = '#d8e8ff'; s.fillRect(-3, -h + 2, 2, 1); s.fillRect(-4, -h + 3, 1, 1);
    glow(s, 2, -Math.round(h / 2) + 1, 1, 1, '#90c0ff');
  },

  shambler(s, m) {
    const pal = mpal('shambler', (p) => { p.r = '#5a1010'; p.R = '#3a0808'; p.i = '#f4f0e0'; p.k = '#8a8070'; return p; });
    const charging = m.state === 'attack' && m.attackKind === 'ranged';
    const clawing = m.state === 'attack' && m.attackKind === 'melee';
    const fur = ramp('#d6cebe'), furFar = ramp('#aaa294');
    const pose = legPose(12, m.walkPhase * 0.8, moveMode(m), 0.4);
    const hy = -pose.hip;
    // дальняя рука
    let fx, fy, nx, ny;
    if (charging) { fx = -2; fy = -46; nx = 10; ny = -46; }
    else {
      const sw = clawing ? lerp(-2.2, 0.9, clamp(m.stateT / 0.4, 0, 1)) : 1.35 + Math.sin(m.walkPhase) * 0.12;
      fx = -6 + Math.cos(1.75) * 17; fy = -30 + Math.sin(1.75) * 17;
      nx = 6 + Math.cos(sw) * 18; ny = -30 + Math.sin(sw) * 18;
    }
    arm(s, -6, hy - 20, fx, fy, 9, 10, charging ? 1 : -1, 5, furFar);
    claws(s, fx, fy, Math.atan2(fy - (hy - 20), fx + 6), '#d0c8b8', 3);
    drawLegPose(s, 0, hy, pose, '#ccc4b4', '#a89e8c', 6, 7, 0.88);
    ball(s, -13, hy - 26, 26, 24, '#d6cebe');
    // клочья шерсти
    s.fillStyle = fur[1];
    for (const [x, y, h] of [[-10, -32, 5], [-6, -36, 6], [-1, -30, 7], [4, -34, 5], [8, -28, 6], [-8, -24, 5], [2, -22, 4]]) s.fillRect(x, hy - 36 + 36 + y + 12, 1, h);
    s.fillStyle = fur[4];
    for (const [x, y] of [[-8, -34], [-3, -37], [1, -33]]) s.fillRect(x, hy + y + 12, 2, 1);
    // голова-горб с огромной пастью
    ball(s, -1, hy - 32, 13, 11, '#e0d8c8');
    const gape = charging ? 4 : clawing ? 3 : 2 + Math.round(Math.sin(m.anim * 3) * 0.5 + 0.5);
    s.fillStyle = '#3a0808'; s.fillRect(3, hy - 27, 9, gape + 1);
    s.fillStyle = '#7a1414'; s.fillRect(4, hy - 26, 7, gape - 1 > 0 ? gape - 1 : 1);
    s.fillStyle = '#f4f0e0';
    for (let i = 0; i < 4; i++) { s.fillRect(3 + i * 2, hy - 27, 1, 1); s.fillRect(4 + i * 2, hy - 27 + gape, 1, 1); }
    // ближняя рука
    arm(s, 6, hy - 20, nx, ny, 9, 10, charging ? 1 : -1, 5, fur, null, 2, '#6a6458');
    claws(s, nx, ny, Math.atan2(ny - (hy - 20), nx - 6), '#f0ead8', 3);
  },

  gargoyle(s, m) {
    const pal = mpal('gargoyle', (p) => { pal5('ABCDE', '#727268', p); p.h = '#cfc8b0'; p.k = '#1a1410'; p.r = '#3a1410'; return p; });
    const dive = m.state === 'leap';
    const flap = Math.sin(m.anim * (dive ? 22 : 11));
    const stone = ramp('#727268');
    // перепончатое крыло: плечо, локоть и три пальца, между пальцами — фестоны
    const wing = (rx, ry, k, mem, memDark, bone) => {
      const up = dive ? -0.3 : flap * k;
      const ex = rx - 5, ey = ry - 6 - up * 4;
      const tips = [[rx - 15, ry - 8 - up * 7], [rx - 15, ry - 1 - up * 4], [rx - 9, ry + 4 - up * 1.5]];
      const pull = (a, b) => [lerp((a[0] + b[0]) / 2, ex, 0.3), lerp((a[1] + b[1]) / 2, ey, 0.3)];
      const n1 = pull(tips[0], tips[1]), n2 = pull(tips[1], tips[2]);
      poly(s, [rx, ry, ex, ey, tips[2][0], tips[2][1]], memDark);
      poly(s, [ex, ey, tips[0][0], tips[0][1], n1[0], n1[1]], mem);
      poly(s, [ex, ey, n1[0], n1[1], tips[1][0], tips[1][1]], mem);
      poly(s, [ex, ey, tips[1][0], tips[1][1], n2[0], n2[1]], memDark);
      poly(s, [ex, ey, n2[0], n2[1], tips[2][0], tips[2][1]], memDark);
      limb(s, rx, ry, ex, ey, 2, 2, bone);
      for (const tp of tips) limb(s, ex, ey, tp[0], tp[1], 1, 1, bone);
      s.fillStyle = '#cfc8b0'; s.fillRect(Math.round(ex), Math.round(ey) - 1, 1, 1);
    };
    wing(1, -12, 1.2, '#4a3e3a', '#3a302c', ramp('#5a5a52'));
    // хвост
    chain(s, -3, -6, 2.6, 2.5, 3, 2, 1, stone, (i) => 0.25 + Math.sin(m.anim * 5 + i) * 0.2);
    // лапы с когтями
    limb(s, -2, -5, -2, -1, 2, 2, stone); limb(s, 2, -5, 2, -1, 2, 2, stone);
    s.fillStyle = '#cfc8b0'; s.fillRect(-3, 0, 3, 1); s.fillRect(1, 0, 3, 1);
    s.drawImage(part('gg-body', [
      '..BCCD.',
      '.ABCCDD',
      'AABCCCD',
      'AABBCCD',
      'AABBCC.',
      '.AABBC.',
      '..AAB..',
      '...A...',
    ], pal), -3, -13);
    s.drawImage(part('gg-head', [
      'h...h.',
      '.hBCh.',
      'ABCCDD',
      'ABkCCD',
      'AABCrr',
      '.AAB..',
    ], pal), 1, -18);
    glow(s, 3, -15, 1, 1, '#ff5a20');
    wing(0, -11, 1.4, '#625650', '#4e4440', stone);
  },

  scorpion(s, m) {
    const sh = ramp('#8a7a44'), dark = ramp('#5a4a28');
    const run = m.moving || m.air;
    const ph = m.walkPhase * 1.6;
    // ноги: по три с каждой стороны
    for (let i = 0; i < 3; i++) {
      for (const far of [1, 0]) {
        const p = ph + i * 2.1 + far * Math.PI, sw = run ? Math.sin(p) * 1.5 : 0;
        const x = -5 + i * 4, rp = far ? dark : sh;
        const kx = x - 2 + sw, ky = -8 - (run ? Math.max(0, Math.cos(p)) * 1.5 : 0);
        limb(s, x, -5, kx, ky, 2, 2, rp);
        limb(s, kx, ky, kx - 1 + sw, 0, 2, 1, rp);
      }
    }
    // хвост дугой над спиной
    const sting = m.state === 'attack' && m.attackKind === 'melee' ? clamp(m.stateT / 0.2, 0, 1) : 0;
    const [tx, ty, ta] = chain(s, -8, -7, -2.3, 3.4, 5, 4, 2, sh, (i) => 0.45 + sting * 0.25 + Math.sin(m.anim * 3 + i) * 0.04);
    s.fillStyle = '#e0d0a0';
    s.fillRect(Math.round(tx + Math.cos(ta) * 2), Math.round(ty + Math.sin(ta) * 2), 2, 2);
    s.fillStyle = '#5a2010';
    s.fillRect(Math.round(tx + Math.cos(ta) * 3.5), Math.round(ty + Math.sin(ta) * 3.5), 1, 1);
    // брюшко из сегментов и головогрудь
    ball(s, -10, -9, 7, 5, '#7a6a3a');
    ball(s, -5, -10, 8, 6, '#8a7a44');
    ball(s, 1, -11, 9, 7, '#9a8a50');
    s.fillStyle = dark[1];
    for (const x of [-6, -1, 4]) s.fillRect(x, -10, 1, 5);
    glow(s, 7, -9, 1, 1, '#ffb040');
    // клешни
    const cl = run ? Math.sin(ph) * 0.15 : 0;
    for (const [dy, rp] of [[-1, dark], [0, sh]]) {
      const bx = 8, by = -6 + dy, ex = 11, ey = -5 + dy + cl * 4;
      limb(s, bx, by, ex, ey, 2, 2, rp);
      s.fillStyle = rp[2]; s.fillRect(Math.round(ex), Math.round(ey) - 2, 3, 2);
      s.fillStyle = rp[1]; s.fillRect(Math.round(ex), Math.round(ey) + 1, 3, 1);
    }
  },

  eel(s, m) {
    const body = ramp('#2e5a6a');
    const segs = 9;
    let px = -11, py = -4;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const x = -11 + i * 2.3, y = -4 + Math.sin(m.anim * 8 - i * 0.75) * 1.6 * (1 - i / (segs * 1.4));
      pts.push([x, y]);
    }
    // плавник
    for (let i = 1; i < segs - 1; i++) { s.fillStyle = body[1]; s.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]) - 3, 2, 1); }
    for (let i = 0; i < segs; i++) {
      const t = 1 + (i / segs) * 2.6;
      limb(s, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t, t, body);
    }
    // брюхо светлее
    s.fillStyle = '#5a8a8a';
    for (let i = 3; i < segs; i++) s.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]) + 1, 2, 1);
    // голова
    const [hx, hy] = pts[segs];
    const bite = m.state === 'attack';
    ball(s, hx - 1, hy - 3, 6, 5, '#3a6a7a');
    s.fillStyle = '#0e1e24'; s.fillRect(Math.round(hx) + 2, Math.round(hy) + (bite ? 0 : 1), 3, 1);
    if (bite) { s.fillStyle = '#e0f0f0'; s.fillRect(Math.round(hx) + 2, Math.round(hy) - 1, 1, 1); s.fillRect(Math.round(hx) + 4, Math.round(hy) + 1, 1, 1); }
    glow(s, Math.round(hx) + 2, Math.round(hy) - 2, 1, 1, '#a0ffe0');
    for (let i = 2; i < segs; i += 2) glow(s, Math.round(pts[i][0]), Math.round(pts[i][1]), 1, 1, '#60d0ff');
  },

  pylon(s, m) {
    const pal = mpal('pylon', (p) => {
      pal5('ABCDE', '#7a34a0', p); pal5('qrstu', '#3a3440', p); return p;
    });
    s.drawImage(part('py-base', [
      '..rssstt..',
      '.qrrsssttu',
      'qqrrrsssst',
      'qqqrrrsssr',
      '.qqqrrrrq.',
    ], pal), -5, -5);
    s.drawImage(part('py-crystal', [
      '....D....',
      '...CDE...',
      '...CDE...',
      '..BCDDE..',
      '..BCDDE..',
      '..BCCDD..',
      '.ABCCDDE.',
      '.ABCCDDE.',
      '.ABCCDDD.',
      '.ABBCDDD.',
      'AABBCCDDE',
      'AABBCCDDE',
      'AABBCCDDD',
      'AABBCCDDD',
      'AABBCCCDD',
      'AABBCCCDD',
      '.AABBCCD.',
      '.AABBCCD.',
      '.AABBCCC.',
      '..AABCC..',
      '..AABCC..',
      '...ABC...',
      '...ABC...',
      '....B....',
    ], pal), -4, -28);
    const k = Math.sin(m.anim * 3) * 0.5 + 0.5;
    glow(s, 0, -22, 1, 12, mix('#c040ff', '#ffd0ff', k));
    glow(s, 0, -26, 1, 2, '#ffe0ff');
  },
});

// Светящаяся трещина по ломаной: каждая точка — отдельный пиксель яркого прохода.
function crack(ctx, pts, col) {
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const n = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let k = 0; k < n; k++) glow(ctx, Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), 1, 1, col);
  }
}
// Контур эллипса по пикселям (для нимба и колец).
function ring(ctx, cx, cy, rx, ry, col, from = 0, to = TAU) {
  ctx.fillStyle = col;
  const n = Math.ceil((rx + ry) * 3);
  for (let i = 0; i <= n; i++) {
    const a = from + (to - from) * i / n;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}
function bossDying(s, m, dur, k1, k2 = k1) {
  if (m.state !== 'dying') return;
  const k = clamp(m.stateT / dur, 0, 1);
  s.translate(Math.round(rand(-2, 2)), 0);
  s.scale(1 - k * k1, 1 - k * k2);
}

Object.assign(MONSTER_ART, {
  chthon(s, m) {
    bossDying(s, m, 3, 0.25);
    const t = m.anim;
    const lava = '#ff7a20', hot = '#ffd050';
    const throwing = m.throwT > 0;
    // дальняя рука висит вдоль тела
    slab(s, -32, -100, -42, -74, 16, 13, '#3a2014');
    slab(s, -42, -74, -40, -48, 13, 11, '#3a2014');
    rock(s, [-48, -52, -34, -54, -32, -40, -46, -38], '#3a2014');
    // низ (по пояс в лаве) и торс
    rock(s, [-22, -66, 22, -66, 18, -8, -18, -8], '#4a2a1a');
    rock(s, [-30, -112, 30, -114, 38, -96, 28, -60, -28, -60, -38, -94], '#56301c');
    // плиты пресса
    rock(s, [-16, -58, -2, -58, -3, -44, -15, -44], '#4e2c1a');
    rock(s, [2, -58, 16, -58, 15, -44, 3, -44], '#4e2c1a');
    crack(s, [-20, -100, -14, -90, -16, -80, -10, -68], lava);
    crack(s, [-2, -104, 2, -92, -1, -80, 1, -64], lava);
    crack(s, [14, -98, 20, -88, 15, -76, 20, -66], lava);
    crack(s, [-15, -42, -6, -38, 4, -42, 15, -38], hot);
    crack(s, [-4, -32, -9, -22, -5, -12], lava);
    // голова с рогами
    chain(s, -10, -132, -2.1, 5, 4, 6, 2, ramp('#2e1a10'), () => 0.24);
    chain(s, 10, -132, -1.05, 5, 4, 6, 2, ramp('#2e1a10'), () => -0.24);
    rock(s, [-13, -140, 13, -140, 17, -124, 11, -110, -11, -110, -17, -124], '#4e2c1a');
    s.fillStyle = '#1e0e06'; s.fillRect(-13, -128, 27, 4);
    glow(s, -9, -127, 7, 2, '#ffd848');
    glow(s, 3, -127, 7, 2, '#ffd848');
    glow(s, -7, -118, 15, 3, '#ff6020');
    s.fillStyle = '#fff4d8';
    for (let i = 0; i < 4; i++) s.fillRect(-6 + i * 4, -118, 1, 1);
    // наплечники
    rock(s, [-46, -104, -32, -118, -16, -110, -20, -94, -42, -92], '#5e3822');
    // ближняя рука: замах и бросок
    const a = throwing ? lerp(-2.6, 0.2, 1 - m.throwT / 0.6) : 1.2 + Math.sin(t * 2) * 0.2;
    const ex = 32 + Math.cos(a - 0.35) * 24, ey = -100 + Math.sin(a - 0.35) * 24;
    const hx = ex + Math.cos(a + 0.25) * 22, hy = ey + Math.sin(a + 0.25) * 22;
    slab(s, 32, -100, ex, ey, 17, 14, '#5a3420');
    slab(s, ex, ey, hx, hy, 14, 12, '#5a3420');
    rock(s, [hx - 8, hy - 7, hx + 7, hy - 8, hx + 9, hy + 6, hx - 6, hy + 8], '#5e3822');
    crack(s, [Math.round(ex) - 3, Math.round(ey) + 2, Math.round(hx), Math.round(hy) - 2], lava);
    rock(s, [46, -104, 32, -118, 16, -110, 20, -94, 42, -92], '#66402a');
    if (throwing && m.throwT > 0.3) {
      ball(s, hx - 7, hy - 18, 14, 14, '#ff8a28', false);
      glow(s, Math.round(hx) - 3, Math.round(hy) - 14, 6, 6, '#ffd060');
    }
  },

  elder(s, m) {
    bossDying(s, m, 4, 0.3);
    const t = m.anim;
    const rune = '#40c8f0';
    const stones = (front) => {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + i * TAU / 6, sn = Math.sin(a);
        if ((sn > 0) !== front) continue;
        const px = Math.round(Math.cos(a) * 32), py = Math.round(-92 + sn * 6);
        rock(s, [px - 3, py - 4, px + 3, py - 3, px + 4, py + 3, px - 3, py + 4], sn > 0 ? '#5a6880' : '#36404e');
        if (front) glow(s, px, py, 1, 1, '#80f0ff');
      }
    };
    stones(false);
    // обломки-«юбка»
    for (let i = 0; i < 7; i++) {
      const off = Math.round(Math.sin(t * 2 + i * 1.3) * 3), x = -21 + i * 6, h = 6 + (i % 3) * 2;
      rock(s, [x - 3, -18 + off, x + 3, -19 + off, x + 2, -18 + off + h, x - 2, -17 + off + h], i % 2 ? '#2e3846' : '#3c4858');
    }
    const cast = m.castT > 0;
    const a1 = cast ? -2.4 : 2.1, a2 = cast ? -0.7 : 1.0;
    const fx = -30 + Math.cos(a1) * 22, fy = -56 + Math.sin(a1) * 22;
    slab(s, -30, -56, fx, fy, 10, 8, '#323c4a');
    glow(s, Math.round(fx) - 1, Math.round(fy) - 1, 3, 3, '#80e0ff');
    rock(s, [-27, -66, 27, -66, 24, -42, 13, -20, -13, -20, -24, -42], '#3c4858');
    crack(s, [-18, -60, -14, -52, -18, -46], rune);
    crack(s, [16, -60, 12, -52, 16, -46, 12, -34], rune);
    crack(s, [-12, -30, -6, -26, -8, -22], rune);
    // гнёзда для рун на груди (сами руны зажигает яркий проход)
    s.fillStyle = '#141c26';
    for (let i = 0; i < 4; i++) s.fillRect(-12 + i * 6, -43, 6, 7);
    rock(s, [-40, -64, -30, -72, -18, -66, -20, -54, -36, -52], '#465468');
    // голова-маска с рогами-обелисками
    rock(s, [-16, -88, -12, -98, -10, -80], '#3a4656');
    rock(s, [16, -88, 12, -98, 10, -80], '#3a4656');
    rock(s, [-12, -84, 12, -84, 15, -72, 9, -58, -9, -58, -15, -72], '#4a586e');
    s.fillStyle = '#0a0e14'; s.fillRect(-11, -67, 23, 4); s.fillRect(2, -72, 3, 5);
    glow(s, -3, -66, 4, 2, '#80f0ff');
    glow(s, 7, -66, 4, 2, '#80f0ff');
    glow(s, 3, -71, 2, 3, '#c0ffff');
    rock(s, [40, -64, 30, -72, 18, -66, 20, -54, 36, -52], '#56647a');
    const nx = 30 + Math.cos(a2) * 22, ny = -56 + Math.sin(a2) * 22;
    slab(s, 30, -56, nx, ny, 10, 8, '#4a586e');
    glow(s, Math.round(nx) - 1, Math.round(ny) - 1, 3, 3, '#80e0ff');
    stones(true);
  },

  herald(s, m) {
    bossDying(s, m, 3, 0.3);
    const t = m.anim;
    const robe = ramp('#3a2444');
    // рваный подол
    for (let i = 0; i < 9; i++) {
      const len = 8 + Math.round(Math.sin(t * 4 + i) * 3) + (i % 2) * 2;
      s.fillStyle = robe[i % 2 ? 0 : 1];
      s.fillRect(-19 + i * 4, -14, 4, len);
    }
    const cast = m.castT > 0;
    const a1 = cast ? -2.5 : 2.2, a2 = cast ? -0.6 : 0.9;
    const fx = -14 + Math.cos(a1) * 15, fy = -42 + Math.sin(a1) * 15;
    arm(s, -14, -42, fx, fy, 8, 8, 1, 5, ramp('#2a1832'));
    // мантия с золотой каймой
    poly(s, [-15, -47, 15, -47, 21, -12, -21, -12], robe[1]);
    poly(s, [-13, -46, 9, -46, 13, -13, -18, -13], robe[2]);
    poly(s, [-11, -45, -3, -45, -6, -14, -15, -14], robe[3]);
    s.fillStyle = '#a08030';
    s.fillRect(-21, -14, 42, 2);
    s.fillRect(-1, -44, 2, 30);
    s.fillStyle = '#e0c060'; s.fillRect(-21, -14, 42, 1);
    for (let i = 0; i < 5; i++) glow(s, -16 + i * 8, -13, 1, 1, '#ffd070');
    // капюшон, рога и пустота вместо лица
    chain(s, -8, -56, -2.4, 4, 3, 3, 1, ramp('#c8c0a0'), () => 0.45);
    chain(s, 7, -57, -0.9, 4, 3, 3, 1, ramp('#c8c0a0'), () => -0.45);
    ball(s, -11, -62, 22, 20, '#2e1c36');
    ell(s, -3, -56, 12, 11, '#0a050c');
    glow(s, 0, -52, 2, 1, '#ff5030');
    glow(s, 5, -52, 2, 1, '#ff5030');
    ring(s, 0, -64, 13, 3, '#c8a040', Math.PI, TAU);
    // правая рука и сферы в ладонях
    const nx = 14 + Math.cos(a2) * 15, ny = -42 + Math.sin(a2) * 15;
    arm(s, 14, -42, nx, ny, 8, 8, -1, 5, robe, null, 2, '#120a16');
    const orb = 5 + Math.round(Math.sin(t * 6));
    for (const [ox, oy] of [[fx, fy], [nx, ny]]) {
      ball(s, ox - orb / 2, oy - orb / 2, orb, orb, '#e070f0', false);
      glow(s, Math.round(ox) - 1, Math.round(oy) - 1, 2, 2, '#ffd0ff');
    }
    ring(s, 0, -64, 13, 3, '#f0d070', 0, Math.PI);
  },

  shub(s, m) {
    bossDying(s, m, 3, 0.35, 0.45);
    const t = m.anim;
    const flesh = ramp('#5a3448');
    // щупальца за телом
    for (let i = 0; i < 9; i++) {
      const a0 = -Math.PI + 0.35 + i * (Math.PI - 0.7) / 8;
      chain(s, Math.cos(a0) * 32, -44 + Math.sin(a0) * 28, a0, 5, 8, 9, 2, i % 2 ? flesh : ramp('#4a2a3c'),
        (k) => Math.sin(t * 1.6 + i * 1.3 + k * 0.6) * 0.22);
    }
    // корни по полу
    for (const sx of [-1, 1]) chain(s, sx * 30, -6, sx > 0 ? 0.1 : Math.PI - 0.1, 6, 6, 6, 2, ramp('#3a2230'), (k) => Math.sin(t * 2 + k) * 0.08 * sx);
    const pulse = Math.round(Math.sin(t * 2.2) * 2);
    ball(s, -45 - pulse, -88 + pulse, 90 + pulse * 2, 86 - pulse, '#4a2a3e');
    // складки плоти
    for (const [fx, fy, fw] of [[-24, -74, 14], [4, -78, 18], [-32, -54, 10], [18, -56, 16], [-10, -34, 20], [-36, -32, 8], [28, -36, 8]]) {
      s.fillStyle = flesh[1]; s.fillRect(fx, fy, fw, 1);
      s.fillStyle = flesh[3]; s.fillRect(fx + 1, fy - 1, fw - 2, 1);
    }
    // глазницы (сами глаза светятся в ярком проходе)
    for (const [ex, ey] of SHUB_EYES) {
      ell(s, ex - 3, ey - 3, 7, 6, '#1a0e14');
      s.fillStyle = flesh[3]; s.fillRect(ex - 2, ey - 4, 5, 1);
    }
    // пасть
    const open = 4 + Math.round((Math.sin(t * 3) + 1) * 2);
    ell(s, -14, -20, 28, open + 3, '#2a0408');
    s.fillStyle = '#6a1018'; s.fillRect(-10, -18 + Math.round(open / 2), 20, 2);
    s.fillStyle = '#e8e0c8';
    for (let i = 0; i < 6; i++) { s.fillRect(-11 + i * 4, -19, 2, 2); s.fillRect(-9 + i * 4, -18 + open - 1, 2, 2); }
  },
});

// Монстр: рисуем на черновике, переносим в мир с контуром, запоминаем светящиеся детали.
const ART_BOX = {};
function artBox(m) {
  let b = ART_BOX[m.type];
  if (!b) {
    const d = m.def, big = !!d.boss;
    b = ART_BOX[m.type] = {
      l: Math.ceil(d.w / 2) + (big ? 70 : 22),
      u: d.h + (big ? 50 : 22),
      d: big ? 30 : 6,
    };
  }
  return b;
}
function drawMonsterSprite(ctx, x, y, m) {
  const b = artBox(m);
  // труп, который уже упал, не меняется — рисуем готовый черновик
  const still = !m.alive && m.deathT > 0.5 && m.hurtFlash <= 0 && m._spr && m._spr.still;
  if (!still) {
    const s = sprBegin(b, m);
    MONSTER_ART[m.type](s, m);
    sprFinish(m.hurtFlash > 0);
    m._spr.still = !m.alive && m.deathT > 0.5;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(m.facing, 1);
  const lying = !m.alive || m.state === 'down';
  if (lying) {
    const k = m.state === 'down' ? 1 : Math.min(1, m.deathT / 0.35);
    if (m.type === 'dog') {
      // пёс падает на спину, лапами вверх
      ctx.translate(0, -6);
      ctx.rotate(k * Math.PI);
      ctx.translate(0, 6 - k * 3);
    } else if (m.def.squash || m.def.fly) {
      ctx.scale(1, 1 - k * 0.55);
    } else {
      ctx.translate(0, -k * Math.min(5, m.w / 2));
      ctx.rotate(-k * Math.PI / 2);
    }
  }
  let alpha = 1;
  if (m.type === 'phantom' && m.alive) alpha = 0.72 + Math.sin(m.anim * 7 + m.seed) * 0.18;
  sprBlit(ctx, m._spr, alpha);
  ctx.restore();
  if (m.alive && !lying) keepGlows(m);
  else if (m.glows) m.glows.length = 0;
}

// ---------------- предметы ----------------
function drawItem(ctx, x, y, it, t) {
  const ch = it.ch;
  const bob = it.dropped ? 0 : Math.round(Math.sin(t * 3 + it.phase) * 1.5) - 1;
  ctx.save();
  ctx.translate(x, y + bob);
  switch (ch) {
    case '+':
      R(ctx, -4, -6, 8, 6, '#b8b0a0'); R(ctx, -4, -6, 8, 1, '#e0d8c8'); R(ctx, -1, -5, 2, 4, '#c01010'); R(ctx, -3, -4, 6, 2, '#c01010');
      break;
    case 'H':
      R(ctx, -6, -9, 12, 9, '#9a9488'); R(ctx, -6, -9, 12, 1, '#d8d0c0'); R(ctx, -5, -8, 10, 7, '#c8c0b0');
      R(ctx, -1, -7, 2, 5, '#c01010'); R(ctx, -3, -5, 6, 2, '#c01010'); R(ctx, -6, -1, 12, 1, '#6a645a');
      break;
    case 'M': {
      const p = Math.sin(t * 5) * 0.5 + 0.5;
      ctx.fillStyle = '#3040c0'; ctx.beginPath(); ctx.arc(0, -6, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = mix('#6080ff', '#c0d0ff', p); ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, TAU); ctx.fill();
      R(ctx, -2, -9, 2, 2, '#ffffff');
      break;
    }
    case 'A': case 'Y': case 'R': {
      const col = ch === 'A' ? '#3a8a2e' : ch === 'Y' ? '#c0a020' : '#b02020';
      R(ctx, -6, -11, 12, 11, col);
      R(ctx, -2, -11, 4, 2, '#000000');
      R(ctx, -6, -11, 4, 1, mix(col, '#ffffff', 0.35));
      R(ctx, 2, -11, 4, 1, mix(col, '#ffffff', 0.35));
      R(ctx, -1, -9, 2, 9, shade(col, 0.6));
      R(ctx, 4, -10, 2, 10, shade(col, 0.7));
      R(ctx, -6, -1, 12, 1, shade(col, 0.5));
      break;
    }
    case 'U':
      R(ctx, -5, -7, 10, 7, '#8a2a1a'); R(ctx, -5, -7, 10, 1, '#aa4a2a');
      for (let i = 0; i < 4; i++) { R(ctx, -4 + i * 2, -9, 1, 2, '#a02010'); R(ctx, -4 + i * 2, -10, 1, 1, '#d0a040'); }
      break;
    case 'N':
      R(ctx, -5, -7, 10, 7, '#5a5a60'); R(ctx, -5, -7, 10, 1, '#7a7a82');
      for (let i = 0; i < 4; i++) R(ctx, -4 + i * 2, -9, 1, 2, '#b0b0b8');
      R(ctx, -3, -4, 6, 1, '#3a3a40');
      break;
    case 'K':
      R(ctx, -5, -6, 10, 6, '#6a4a2a'); R(ctx, -5, -6, 10, 1, '#8a6a3a');
      R(ctx, -3, -11, 2, 5, '#7a7a70'); R(ctx, 1, -11, 2, 5, '#7a7a70');
      R(ctx, -3, -12, 2, 1, '#b02010'); R(ctx, 1, -12, 2, 1, '#b02010');
      break;
    case 'C':
      R(ctx, -5, -8, 10, 8, '#4a5a3a'); R(ctx, -5, -8, 10, 1, '#6a7a52');
      R(ctx, 0, -7, 2, 3, '#e0c030'); R(ctx, -1, -4, 3, 1, '#e0c030'); R(ctx, -1, -3, 2, 2, '#e0c030');
      break;
    case 'Q': {
      const k = Math.sin(t * 2);
      const w = Math.max(2, Math.round(Math.abs(k) * 10));
      R(ctx, -w / 2, -12, w, 10, '#2038c0');
      R(ctx, -w / 2 + 1, -11, Math.max(1, w - 2), 8, '#4a68ff');
      if (w > 5) { R(ctx, -1, -10, 2, 6, '#c0d0ff'); R(ctx, -3, -8, 6, 1, '#c0d0ff'); }
      break;
    }
    case 'X': {
      ctx.strokeStyle = '#ff3020'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + i * (TAU * 2 / 5) + t * 0.8;
        const px = Math.cos(a) * 6, py = -7 + Math.sin(a) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -7, 6.5, 0, TAU); ctx.stroke();
      break;
    }
    case 'V':
      ctx.strokeStyle = '#d0a030'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -6, 5, 3.5, 0, 0, TAU); ctx.stroke();
      R(ctx, -1, -10, 2, 2, '#fff0a0');
      break;
    case 'W':
      R(ctx, -4, -12, 8, 5, '#2a7a3a'); R(ctx, -3, -14, 6, 3, '#3a8a4a'); R(ctx, -2, -13, 4, 1, '#a0e0ff');
      R(ctx, -4, -7, 3, 7, '#2a7a3a'); R(ctx, 1, -7, 3, 7, '#2a7a3a'); R(ctx, -6, -12, 2, 6, '#226a30'); R(ctx, 4, -12, 2, 6, '#226a30');
      break;
    case '(': case ')': {
      const col = ch === '(' ? '#c8d0dc' : '#e8b830';
      ctx.scale(1.5, 1.5);
      drawKeyIcon(ctx, 0, -6, col);
      break;
    }
    case 'backpack':
      R(ctx, -5, -9, 10, 9, '#6a5030'); R(ctx, -5, -9, 10, 1, '#8a6a40'); R(ctx, -4, -6, 8, 3, '#5a4028');
      R(ctx, -2, -10, 4, 1, '#4a3a20'); R(ctx, 3, -8, 1, 7, '#4a3a20');
      break;
    default:
      if (ch >= '3' && ch <= '9') {
        R(ctx, -9, -2, 18, 2, '#2a2420');
        drawWeapon(ctx, -6, -5, 0, +ch, 0, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', t);
      }
  }
  ctx.restore();
}

// ---------------- лицо героя для HUD ----------------
function drawFace(ctx, x, y, s, p, t) {
  const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a * s, y + b * s, w * s, h * s); };
  const hp = p.health;
  const tier = !p.alive ? 5 : hp >= 80 ? 0 : hp >= 60 ? 1 : hp >= 40 ? 2 : hp >= 20 ? 3 : 4;
  let skin = '#c09070', sh = '#96684e';
  if (p.pent > 0) { skin = '#d07060'; sh = '#a04a3a'; }
  if (tier === 5) { skin = '#8a7a6a'; sh = '#5a4a3a'; }
  r(3, 1, 10, 14, sh);
  r(3, 1, 9, 13, skin);
  r(2, 0, 12, 4, '#3a3020');
  r(2, 3, 2, 5, '#3a3020');
  r(12, 3, 2, 4, '#3a3020');
  r(2, 6, 1, 3, sh);
  r(13, 6, 1, 3, sh);
  const look = tier === 5 ? 0 : Math.round(Math.sin(t * 0.7) * 1.2);
  const pain = p.faceT > 0 || tier === 5;
  if (pain) {
    r(4, 7, 3, 1, '#2a1a10'); r(9, 7, 3, 1, '#2a1a10');
  } else {
    r(4, 6, 3, 2, p.quad > 0 ? '#80a0ff' : '#e8e0d0');
    r(9, 6, 3, 2, p.quad > 0 ? '#80a0ff' : '#e8e0d0');
    r(5 + look, 6, 1, 2, p.pent > 0 ? '#ff2010' : '#2a1a10');
    r(10 + look, 6, 1, 2, p.pent > 0 ? '#ff2010' : '#2a1a10');
  }
  r(4, 5, 3, 1, '#4a3a28'); r(9, 5, 3, 1, '#4a3a28');
  r(7, 8, 2, 3, sh);
  r(6, 12, 4, 1, pain ? '#3a1010' : '#6a3a2a');
  if (pain) r(6, 11, 4, 1, '#3a1010');
  if (tier >= 1) r(11, 9, 2, 3, '#8a0a08');
  if (tier >= 2) { r(3, 2, 2, 2, '#8a0a08'); r(10, 12, 3, 2, '#7a0a08'); }
  if (tier >= 3) { r(4, 9, 2, 4, '#7a0a08'); r(8, 1, 3, 2, '#9a1010'); }
  if (tier >= 4) { r(5, 3, 6, 1, '#6a0806'); r(3, 13, 9, 2, '#6a0806'); }
  if (p.ring > 0) { ctx.fillStyle = 'rgba(10,8,6,0.75)'; ctx.fillRect(x + 2 * s, y, 12 * s, 15 * s); r(5, 6, 1, 1, '#ffe080'); r(10, 6, 1, 1, '#ffe080'); }
}
