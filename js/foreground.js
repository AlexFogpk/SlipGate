'use strict';
// Передний план: вещи ближе к зрителю, чем мир, — цепи, клетки, знамёна, корни,
// сталактиты, балки и кабели, а совсем близко — редкие колонны во весь кадр.
//
// Как это устроено и почему так:
// • Каждая вещь привязана к месту в мире — к потолку комнаты. На экране она смещается
//   от центра кадра в k раз сильнее мира (k > 1 — значит, ближе к зрителю), по обеим
//   осям. Поэтому на бегу вещи обгоняют стены, а в прыжке уходят вниз, как и положено
//   близким предметам, — не прыгают вместе с героем.
// • Два слоя висящих вещей: средний (k = 1,22) и ближний (k = 1,55) — крупнее, темнее
//   и размыт, как вне фокуса. Колонны ещё ближе (k = 1,8) и проезжают через весь кадр.
// • Передний план не мешает бою: висящее живёт в верхней части кадра и растворяется,
//   опускаясь к середине; всё, что закрывает героя, прицел или монстра рядом, становится
//   полупрозрачным. Плотность умеренная — в кадре обычно две-четыре вещи.
// • Цепи, клетки и знамёна раскачиваются от взрывов рядом и чуть-чуть сами по себе.
// • Контур подсвечен там, где светло (лава, факелы, лампы), и почти не виден в темноте.
// • Всё выключается: «Настройки» → «Передний план».

const FG_LAYERS = [
  { k: 1.22, scale: 1, blur: 0, alpha: 0.95, gap: [10, 18], vgap: 6 },
  { k: 1.55, scale: 1.65, blur: 0.8, alpha: 0.92, gap: [24, 36], vgap: 9 },
];
const FG_PILLAR = { k: 1.8, w: 12, gap: [46, 72], alpha: 0.92 };
const FG_SWING = new Set(['chain', 'cage', 'banner', 'roots']);
const FG_WIDTH = { chain: 10, cage: 22, banner: 22, roots: 30, stal: 54, horn: 56, girder: 144, cable: 168 };
const FG_CACHE = new Map();

// Где висеть: потолок (камень), под ним не меньше четырёх клеток воздуха, не под небом.
function prepareForeground(lv, A) {
  const amb = lv.amb;
  amb.fg = [];
  amb.fgPillars = [];
  amb.rim = A.rim;
  // силуэт не чисто чёрный: почти чёрный с оттенком темы (тёплый в замке, стальной на базе)
  amb.fgDark = mix('#050407', A.rim, 0.14);
  amb.fgLit = false;
  FG_CACHE.clear();
  if (!A.fg.length) return;
  const air = (x, y) => {
    const t = lv.tile(x, y);
    return !isSolidType(t) && !isLiquidType(t) && !skyLike(t) && t !== T.PLAT && !lv.skyBack(x, y);
  };
  const ceil = [];
  for (let y = 1; y < lv.h - 5; y++) {
    for (let x = 2; x < lv.w - 2; x++) {
      if (!lv.tileSolid(x, y) || !air(x, y + 1)) continue;
      let d = 1;
      while (d < 30 && air(x, y + d)) d++;
      if (d - 1 >= 5) ceil.push({ x, y: y + 1, room: d - 1 });
    }
  }
  FG_LAYERS.forEach((L, li) => {
    // порядок кандидатов псевдослучайный, но одинаковый при каждой загрузке
    const order = ceil.map((c) => ({ c, r: hash2(c.x * 3 + li, c.y * 7, 21 + li) })).sort((a, b) => a.r - b.r);
    const taken = [];
    for (const { c } of order) {
      const gap = L.gap[0] + (L.gap[1] - L.gap[0]) * hash2(c.x, c.y, 23 + li);
      if (taken.some((o) => Math.abs(o.x - c.x) < gap && Math.abs(o.y - c.y) < L.vgap)) continue;
      if (amb.fg.some((o) => Math.abs(o.tx - c.x) < 7 && Math.abs(o.ty - c.y) < 6)) continue;
      const type = A.fg[Math.floor(hash2(c.x, c.y, 25) * A.fg.length)];
      // свисает не ниже, чем за четыре клетки до пола, — иначе закроет героя
      let len = type === 'girder' || type === 'cable' ? 16 + hash2(c.x, c.y, 27) * 22 : 22 + hash2(c.x, c.y, 27) * 56;
      len = Math.min(len, (c.room - 4) * TILE / L.scale);
      if (len < 14) continue;
      taken.push(c);
      amb.fg.push({
        layer: li, tx: c.x, ty: c.y, x: c.x * TILE + 8, y: c.y * TILE, type,
        len: Math.max(12, Math.round(len / 8) * 8), v: ['roots', 'stal', 'horn'].includes(type) ? Math.floor(hash2(c.x, c.y, 29) * 3) : 0,
        ang: 0, vel: 0, fade: 0, want: 0, lit: 0.5, seed: hash2(c.x, c.y, 31) * 10,
      });
    }
  });
  // колонны совсем близко: в комнатах высотой 5–16 клеток с полом и потолком
  if (A.pillar) {
    let x = 24 + Math.floor(hash2(lv.w, lv.h, 33) * 24);
    while (x < lv.w - 4) {
      for (let y = 1; y < lv.h - 2; y++) {
        if (!lv.tileSolid(x, y) || !air(x, y + 1)) continue;
        let d = 1;
        while (d < 20 && air(x, y + d)) d++;
        if (d - 1 >= 5 && d - 1 <= 16 && lv.tileSolid(x, y + d)) {
          amb.fgPillars.push({ x: x * TILE + 8, top: (y + 1) * TILE, bottom: (y + d) * TILE, style: A.pillar, fade: 0, want: 0, lit: 0.5 });
        }
      }
      x += FG_PILLAR.gap[0] + Math.floor(hash2(x, lv.h, 35) * (FG_PILLAR.gap[1] - FG_PILLAR.gap[0]));
    }
  }
}

// Подсветка контура — по запечённому свету в месте, где висит вещь (считается один раз).
function litForeground(lv) {
  const amb = lv.amb;
  amb.fgLit = true;
  const lc = lv.lightCanvas;
  let data = null;
  try { data = lc.getContext('2d').getImageData(0, 0, lc.width, lc.height).data; } catch (e) { return; }
  const cell = TILE / 4;
  const at = (x, y) => {
    const cx = clamp(Math.floor(x / cell), 0, lc.width - 1), cy = clamp(Math.floor(y / cell), 0, lc.height - 1);
    const i = (cy * lc.width + cx) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 765;
  };
  for (const o of amb.fg) o.lit = clamp((at(o.x, o.y + 12) - 0.18) * 1.7, 0.08, 1);
  for (const p of amb.fgPillars) p.lit = clamp((at(p.x, (p.top + p.bottom) / 2) - 0.18) * 1.7, 0.08, 1);
}

// Положение на экране: смещение от центра кадра в k раз сильнее, чем у мира.
function fgProject(wx, wy, k, cam, vw, vh) {
  return { x: (wx - cam.x - vw / 2) * k + vw / 2, y: (wy - cam.y - vh / 2) * k + vh / 2 };
}

// Что передний план не должен закрывать: героя, прицел и монстров рядом с героем (в экране).
function fgGuards(cam) {
  const p = Game.player;
  if (!p || !p.alive) return [];
  const out = [{ x: p.x - cam.x - 10, y: p.y - cam.y - 12, w: p.w + 20, h: p.h + 22 }];
  const a = Game.aimWorld();
  out.push({ x: a.x - cam.x - 14, y: a.y - cam.y - 14, w: 28, h: 28 });
  let n = 0;
  for (const m of Game.monsters) {
    if (!m.alive || n >= 6 || Math.abs(m.cx - p.cx) > 260 || Math.abs(m.cy - p.cy) > 180) continue;
    out.push({ x: m.x - cam.x - 6, y: m.y - cam.y - 6, w: m.w + 12, h: m.h + 12 });
    n++;
  }
  return out;
}

const fgHit = (r, gs) => gs.some((g) => r.x < g.x + g.w && r.x + r.w > g.x && r.y < g.y + g.h && r.y + r.h > g.y);

// Раз в кадр: раскачка, прозрачность над героем и у середины кадра.
function updateForeground(lv, dt, cam, vw, vh) {
  const amb = lv.amb;
  if (!amb || !amb.fg) return;
  const guards = fgGuards(cam);
  const ease = Math.min(1, dt * 7);
  // голова героя на экране (в меню — верхние две трети кадра)
  const p = Game.player;
  const headY = p && p.alive ? p.y - cam.y : vh * 0.66;
  for (const o of amb.fg) {
    const L = FG_LAYERS[o.layer];
    const s = fgProject(o.x, o.y, L.k, cam, vw, vh);
    const w = FG_WIDTH[o.type] * L.scale, h = (o.len + 12) * L.scale;
    if (s.x + w < -40 || s.x - w > vw + 40 || s.y > vh + 40 || s.y + h < -40) { o.fade = 0; continue; }
    if (FG_SWING.has(o.type)) {
      // пружина к покою и лёгкий сквозняк
      const acc = -o.ang * 9 - o.vel * 1.3 + Math.sin(Game.time * 0.9 + o.seed) * 0.12;
      o.vel += acc * dt;
      o.ang = clamp(o.ang + o.vel * dt, -0.7, 0.7);
    }
    // висящее живёт над героем: опускаясь к его голове, растворяется
    const bottom = s.y + h;
    let want = L.alpha * clamp((headY - 18 - bottom) / 46, 0, 1);
    // ближняя вещь свисает из-за верхнего края кадра: её крепление всегда за кадром
    if (o.layer === 1) want *= clamp(1 - (s.y + 4) / 26, 0, 1);
    if (want > 0 && fgHit({ x: s.x - w / 2, y: s.y, w, h }, guards)) want *= 0.28;
    o.want = want;
    o.fade += (want - o.fade) * ease;
  }
  const cy = cam.y + vh / 2;
  for (const c of amb.fgPillars) {
    const s = fgProject(c.x, c.top, FG_PILLAR.k, cam, vw, vh);
    const w = FG_PILLAR.w * FG_PILLAR.k;
    // колонна стоит в своей комнате: камера ушла на другой этаж — колонна тает
    const inRoom = clamp(1 - Math.max(0, c.top - cy, cy - c.bottom) / 90, 0, 1);
    if (s.x + w < -20 || s.x - w > vw + 20 || inRoom <= 0) { c.fade = 0; continue; }
    let want = FG_PILLAR.alpha * inRoom;
    if (fgHit({ x: s.x - w / 2 - 6, y: 0, w: w + 12, h: vh }, guards)) want = Math.min(want, 0.2);
    c.want = want;
    c.fade += (want - c.fade) * ease;
  }
}

// Взрыв рядом раскачивает цепи, клетки и знамёна.
function foregroundJolt(x, y, power) {
  const amb = Game.level && Game.level.amb;
  if (!amb || !amb.fg) return;
  for (const o of amb.fg) {
    if (!FG_SWING.has(o.type)) continue;
    const d = dist(o.x, o.y + o.len * 0.5, x, y);
    if (d > 320) continue;
    o.vel += (sign(o.x - x) || 1) * power * 2.4 * (1 - d / 320);
  }
}

// Силуэт вещи в своих координатах: x — от центра, y — вниз от точки крепления.
// part: 'dark' — сам силуэт, 'rim' — только подсвеченный контур.
function paintFgShape(g, type, len, v, dark, rim, part) {
  const D = dark, R = rim;
  const f = (a, b, w, h, c) => {
    if ((c === D) !== (part === 'dark')) return;
    g.fillStyle = c; g.fillRect(Math.round(a), Math.round(b), w, h);
  };
  switch (type) {
    case 'chain':
      f(-5, 0, 11, 3, D); f(-5, 2, 11, 1, R);
      for (let y = 3; y < len; y += 5) {
        if (((y - 3) / 5) % 2 === 0) { f(-2, y, 5, 5, D); f(-2, y, 1, 4, R); } else f(0, y, 1, 5, D);
      }
      f(-3, len, 7, 4, D); f(-3, len + 3, 7, 1, R);
      break;
    case 'cage': {
      f(-5, 0, 11, 3, D);
      for (let y = 3; y < len * 0.5; y += 5) f(-1, y, 2, 4, D);
      const y0 = Math.round(len * 0.5);
      f(-10, y0, 21, 3, D);
      for (let bx = -10; bx <= 9; bx += 3) f(bx, y0 + 3, 2, 24, D);
      f(-10, y0 + 26, 21, 3, D);
      f(-10, y0, 1, 28, R); f(-10, y0 + 28, 21, 1, R);
      // кости в клетке
      f(-4, y0 + 20, 8, 2, D); f(-2, y0 + 15, 4, 4, D);
      break;
    }
    case 'banner':
      f(-11, 0, 22, 3, D); f(-11, 2, 22, 1, R);
      for (let y = 3; y < len; y++) {
        const notch = y > len - 8 ? y - (len - 8) : 0;
        const w = 18 - notch * 2;
        f(-9 + notch, y, Math.max(1, w), 1, D);
      }
      f(-9, 3, 1, len - 10, R);
      break;
    case 'roots':
      f(-14, 0, 28, 4, D); f(-14, 3, 28, 1, R);
      for (let r = 0; r < 4; r++) {
        let x = (r - 1.5) * 7;
        const n = len * (0.55 + 0.45 * (((v * 0.37 + r * 0.29) % 1)));
        for (let y = 3; y < n; y++) {
          f(x, y, 2, 1, D);
          x += Math.sin(y * 0.3 + r * 2 + v * 3) * 0.6;
        }
      }
      break;
    case 'stal':
      f(-26, 0, 52, 4, D); f(-26, 3, 52, 1, R);
      for (let s = 0; s < 3; s++) {
        const cx = (s - 1) * 15 + ((v * 5 + s * 3) % 6) - 3;
        const hgt = len * (0.45 + 0.55 * ((v * 0.41 + s * 0.31) % 1)), w = 10 + s * 2;
        for (let y = 3; y < hgt; y++) {
          const half = (w / 2) * Math.pow(1 - y / hgt, 0.8);
          f(cx - half, y, Math.max(1, half * 2), 1, D);
        }
        f(cx - w / 2, 3, 1, hgt * 0.4, R);
      }
      break;
    case 'horn': {
      f(-14, 0, 28, 4, D);
      const dir = v % 2 ? 1 : -1;
      for (let y = 3; y < len; y++) {
        const k = y / len, half = 7 * (1 - k) + 1;
        f(Math.pow(k, 2) * 22 * dir - half, y, half * 2, 1, D);
        if (y % 3 === 0) f(Math.pow(k, 2) * 22 * dir - half, y, 1, 1, R);
      }
      break;
    }
    case 'girder':
      // балка на двух подвесах под потолком
      f(-58, 0, 3, len, D); f(56, 0, 3, len, D);
      f(-72, len, 144, 9, D); f(-72, len + 9, 144, 1, R);
      for (let i = -68; i < 70; i += 10) f(i, len + 4, 2, 2, R);
      for (let i = -72; i < 72; i += 18) for (let k = 0; k < 8; k++) f(i + k, len + 9 + k, 2, 1, D);
      break;
    case 'cable':
      f(-84, 0, 6, 4, D); f(78, 0, 6, 4, D);
      for (let i = 0; i <= 160; i += 2) {
        const tt = i / 160, y = Math.sin(tt * Math.PI) * len;
        f(-80 + i, y + 2, 2, 3, D);
        if (i % 8 === 0) f(-80 + i, y + 2, 2, 1, R);
      }
      break;
    default: break;
  }
}

// Готовый спрайт (силуэт или контур) в нужном масштабе и с размытием ближнего слоя.
function fgSprite(type, len, v, layer, dark, rim, part) {
  const key = `${type}|${len}|${v}|${layer}|${part}`;
  let s = FG_CACHE.get(key);
  if (s) return s;
  const L = FG_LAYERS[layer];
  const pad = Math.ceil(L.blur * 3) + 2;
  const w = Math.ceil(FG_WIDTH[type] * L.scale) + pad * 2;
  const top = type === 'girder' || type === 'cable' ? 0 : 0;
  const hgt = Math.ceil((len + (type === 'cage' ? 32 : 14)) * L.scale) + pad * 2 + top;
  const raw = makeCanvas(w, hgt);
  const g = raw.getContext('2d');
  g.translate(w / 2, pad);
  g.scale(L.scale, L.scale);
  paintFgShape(g, type, len, v, dark, rim, part);
  let canvas = raw;
  if (L.blur > 0) {
    canvas = makeCanvas(w, hgt);
    const b = canvas.getContext('2d');
    b.filter = `blur(${L.blur}px)`;
    b.drawImage(raw, 0, 0);
  }
  s = { canvas, px: w / 2, py: pad };
  FG_CACHE.set(key, s);
  return s;
}

// Колонна совсем близко, во весь кадр: каменная кладка, стальная двутавровая балка или
// неровный каменный столб пещеры. Края мягкие — как вне фокуса; швы, заклёпки и выступы
// привязаны к миру и едут с параллаксом колонны (в прыжке — вниз).
function drawFgPillar(ctx, p, cam, vw, vh, amb) {
  const k = FG_PILLAR.k, rim = amb.rim, dark = amb.fgDark;
  const s = fgProject(p.x, p.top, k, cam, vw, vh);
  const w = Math.round(FG_PILLAR.w * k), x0 = Math.round(s.x - w / 2);
  const base = s.y;                       // экранная высота потолка комнаты — от неё отсчёт швов
  const lit = 0.2 + p.lit * 0.8;
  ctx.globalAlpha = p.fade;
  if (p.style === 'rock') {
    // каменный столб: ширина «дышит» по высоте, выступы привязаны к миру и едут с ним
    for (let y = -4; y < vh + 4; y += 3) {
      const wy = Math.floor((y - base) / (3 * k));
      const n = hash2(Math.floor(p.x), wy, 37), n2 = hash2(Math.floor(p.x), wy >> 3, 39);
      const half = w * (0.42 + 0.16 * n2 + 0.05 * n), off = (n2 - 0.5) * w * 0.3;
      const xa = Math.round(s.x + off - half), wa = Math.round(half * 2);
      ctx.globalAlpha = p.fade;
      ctx.fillStyle = dark; ctx.fillRect(xa, y, wa, 3);
      ctx.globalAlpha = p.fade * lit * 0.45;
      ctx.fillStyle = rim; ctx.fillRect(xa, y, 2, 3);
      ctx.globalAlpha = p.fade * 0.35;
      ctx.fillStyle = '#000'; ctx.fillRect(xa + wa - 3, y, 3, 3);
    }
  } else {
    // ствол: мягкие края (как вне фокуса), светлая грань со стороны света, тёмная — с другой
    const gr = ctx.createLinearGradient(x0 - 4, 0, x0 + w + 4, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.1, dark);
    gr.addColorStop(0.9, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x0 - 4, -4, w + 8, vh + 8);
    ctx.globalAlpha = p.fade * lit * 0.5;
    ctx.fillStyle = rim; ctx.fillRect(x0 + 1, -4, 2, vh + 8);
    ctx.globalAlpha = p.fade * 0.45;
    ctx.fillStyle = '#000'; ctx.fillRect(x0 + w - 4, -4, 3, vh + 8);
    if (p.style === 'steel') {
      // двутавр: полки по краям, стенка в середине, заклёпки
      ctx.globalAlpha = p.fade * lit * 0.35;
      ctx.fillStyle = rim;
      ctx.fillRect(x0 + Math.round(w * 0.3), -4, 1, vh + 8);
      ctx.fillRect(x0 + Math.round(w * 0.7), -4, 1, vh + 8);
      const step = 12 * k;
      ctx.globalAlpha = p.fade * lit * 0.8;
      for (let y = base - Math.ceil((base + 8) / step) * step; y < vh + 4; y += step) {
        ctx.fillRect(x0 + 4, Math.round(y), 2, 2); ctx.fillRect(x0 + w - 7, Math.round(y), 2, 2);
      }
    } else {
      // кладка: швы через ряд со смещённым вертикальным, камни чуть разного тона
      const step = 16 * k;
      let row = -Math.ceil((base + 8) / step);
      for (let y = base + row * step; y < vh + 4; y += step, row++) {
        const jx = x0 + Math.round(w * (row & 1 ? 0.38 : 0.62));
        const n = hash2(Math.floor(p.x), row, 43);
        ctx.globalAlpha = p.fade * lit * 0.12 * n;
        ctx.fillStyle = rim; ctx.fillRect(x0 + 3, Math.round(y), jx - x0 - 3, Math.round(step));
        ctx.globalAlpha = p.fade * 0.6;
        ctx.fillStyle = '#000';
        ctx.fillRect(x0 + 2, Math.round(y), w - 4, 1);
        ctx.fillRect(jx, Math.round(y), 1, Math.round(step));
        ctx.globalAlpha = p.fade * lit * 0.4;
        ctx.fillStyle = rim; ctx.fillRect(x0 + 2, Math.round(y) + 1, w - 4, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// Передний план поверх мира: средний слой, ближний слой, колонны.
function drawForeground(ctx, lv, cam, vw, vh) {
  const amb = lv.amb;
  if (!Game.fgOn || !amb || !amb.fg) return;
  if (!amb.fgLit && lv.lightCanvas) litForeground(lv);
  for (let layer = 0; layer < FG_LAYERS.length; layer++) {
    const L = FG_LAYERS[layer];
    for (const o of amb.fg) {
      if (o.layer !== layer || o.fade < 0.02) continue;
      const s = fgProject(o.x, o.y, L.k, cam, vw, vh);
      const dark = fgSprite(o.type, o.len, o.v, layer, amb.fgDark, amb.rim, 'dark');
      const rim = fgSprite(o.type, o.len, o.v, layer, amb.fgDark, amb.rim, 'rim');
      ctx.save();
      ctx.translate(Math.round(s.x), Math.round(s.y));
      if (o.ang) ctx.rotate(o.ang);
      ctx.globalAlpha = o.fade;
      ctx.drawImage(dark.canvas, -dark.px, -dark.py);
      ctx.globalAlpha = o.fade * o.lit;
      ctx.drawImage(rim.canvas, -rim.px, -rim.py);
      ctx.restore();
    }
  }
  for (const p of amb.fgPillars) if (p.fade >= 0.02) drawFgPillar(ctx, p, cam, vw, vh, amb);
}
