'use strict';
// Передний план: вещи ближе к зрителю, чем мир, — цепи, клетки, знамёна, корни,
// сталактиты, балки, кабели, лампы, фонари, крюки и черепа, а совсем близко — редкие
// колонны во весь кадр.
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
// • Вещи складываются в группы: клетка на цепях, пара знамён, гроздь сталактитов, фонарь
//   рядом с цепью. Длинное (клетки, знамёна, крюки, черепа) висит только в высоких залах.
// • Лампы базы и фонари замка светятся сами и мигают по строкам яркости, как свет в Quake
//   («a» — темно, «m» — обычно, «z» — вдвое ярче). На каменных колоннах изредка горит факел,
//   на стальных — полосы «осторожно» и сигнальный огонь.
// • Висящее раскачивается от взрывов, от тряски (босс, обвал) и от снаряда, пролетевшего
//   рядом; металл при этом звякает.
// • Контур подсвечен там, где светло (лава, факелы, лампы), и почти не виден в темноте.
// • В бою передний план отступает — становится прозрачнее, чтобы не мешать читать схватку.
// • Всё выключается: «Настройки» → «Передний план».

const FG_LAYERS = [
  { k: 1.22, scale: 1, blur: 0, alpha: 0.95, gap: [12, 20], vgap: 6 },
  { k: 1.55, scale: 1.65, blur: 0.8, alpha: 0.92, gap: [24, 36], vgap: 9 },
];
const FG_PILLAR = { k: 1.8, w: 12, gap: [46, 72], alpha: 0.92 };
const FG_SWING = new Set(['chain', 'cage', 'banner', 'roots', 'lamp', 'lantern', 'hook', 'skulls']);
const FG_WIDTH = {
  chain: 10, cage: 22, banner: 22, roots: 30, stal: 54, horn: 56, girder: 144, cable: 168,
  lamp: 20, lantern: 16, hook: 26, skulls: 16,
};
// длинные вещи — только в залах высотой от семи клеток
const FG_LONG = new Set(['cage', 'banner', 'hook', 'skulls']);
// с кем вещь висит в паре (рядом, в трёх-пяти клетках)
const FG_COMPANION = { cage: 'chain', banner: 'banner', stal: 'stal', lantern: 'chain', hook: 'chain', skulls: 'chain', lamp: 'lamp', horn: 'stal', roots: 'roots' };
// масса (насколько легко раскачать), затухание и голос металла (высота звона)
const FG_MASS = { chain: 1, cage: 0.6, banner: 1.2, roots: 0.5, lamp: 0.9, lantern: 0.9, hook: 0.7, skulls: 0.8 };
const FG_DAMP = { banner: 2.4, roots: 2 };
const FG_CLINK = { chain: 1, cage: 0.75, lamp: 1.3, lantern: 1.12, hook: 0.85, skulls: 0.5 };
// свет: цвет, где горит (от точки крепления вниз), радиус ореола, строка яркости
const FG_GLOW = {
  lamp: { c: [255, 236, 190], dy: 7, r: 44, style: (o) => (o.v === 2 ? FG_STYLE.fluor : FG_STYLE.steady) },
  lantern: { c: [255, 178, 80], dy: 9, r: 40, style: () => FG_STYLE.candle },
};
// строки яркости, как световые стили Quake: «a» — темно, «m» — обычно, «z» — вдвое ярче
const FG_STYLE = {
  steady: 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmamm',
  fluor: 'mmmamammmmmmaammmmmmmmammmmaaamm',
  candle: 'mmnmmlmnmmomnmlmmnmlk',
  torch: 'mnmlmonmmlnmomnmlmn',
};
const FG_CACHE = new Map();

function fgStyle(str, t, seed) {
  const c = str.charCodeAt(Math.floor(t + seed * 7) % str.length);
  return (c - 97) / 12;
}

// Сколько вещь занимает вниз от точки крепления (в своих пикселях).
function fgExtent(type, len, v) {
  switch (type) {
    case 'cage': return len * 0.5 + 30;
    case 'hook': return v === 2 ? len + 10 : len + 43;
    case 'lantern': return len + 18;
    case 'lamp': return len + 10;
    case 'skulls': return len + 8;
    case 'girder': return len + 17;
    default: return len + 7;
  }
}

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
  const byXY = new Map(ceil.map((c) => [c.x + ',' + c.y, c]));
  const otherLayer = (c, li) => amb.fg.some((o) => o.layer !== li && Math.abs(o.tx - c.x) < 7 && Math.abs(o.ty - c.y) < 6);
  // вещь заданного типа; длина — по хешу, но так, чтобы низ был не ближе четырёх клеток к полу
  const place = (c, type, li, salt, lenK = 1) => {
    const L = FG_LAYERS[li];
    const v = Math.floor(hash2(c.x, c.y, 29 + salt) * 3);
    const r = hash2(c.x, c.y, 27 + salt);
    let len = (type === 'girder' || type === 'cable' ? 16 + r * 22 : type === 'lamp' ? 14 + r * 40 : 22 + r * 56) * lenK;
    len = Math.max(12, Math.round(len / 4) * 4);
    while (len >= 12 && fgExtent(type, len, v) * L.scale > (c.room - 4) * TILE) len -= 4;
    if (len < 12) return null;
    const ext = fgExtent(type, len, v);
    const o = {
      layer: li, tx: c.x, ty: c.y, x: c.x * TILE + 8, y: c.y * TILE, type, len, v,
      ang: 0, vel: 0, fade: 0, want: 0, lit: 0.5, seed: hash2(c.x, c.y, 31 + salt) * 10,
      // маятник: чем длиннее, тем медленнее; ткань и корни гаснут быстро
      k2: clamp(380 / (ext + 10), 3.5, 16), damp: FG_DAMP[type] || (FG_MASS[type] < 0.8 ? 0.9 : 1.1),
      clinkT: 0, lastPr: null,
    };
    amb.fg.push(o);
    return o;
  };
  FG_LAYERS.forEach((L, li) => {
    // порядок кандидатов псевдослучайный, но одинаковый при каждой загрузке
    const order = ceil.map((c) => ({ c, r: hash2(c.x * 3 + li, c.y * 7, 21 + li) })).sort((a, b) => a.r - b.r);
    const taken = [];
    for (const { c } of order) {
      const gap = L.gap[0] + (L.gap[1] - L.gap[0]) * hash2(c.x, c.y, 23 + li);
      if (taken.some((o) => Math.abs(o.x - c.x) < gap && Math.abs(o.y - c.y) < L.vgap)) continue;
      if (otherLayer(c, li)) continue;
      let type = A.fg[Math.floor(hash2(c.x, c.y, 25) * A.fg.length)];
      // в низком зале длинное заменяем коротким из той же темы
      if (c.room < 7 && FG_LONG.has(type)) {
        const short = A.fg.filter((t) => !FG_LONG.has(t));
        if (!short.length) continue;
        type = short[Math.floor(hash2(c.x, c.y, 26) * short.length)];
      }
      const o = place(c, type, li, 0);
      if (!o) continue;
      taken.push(c);
      // пара: клетка на цепях, два знамени, гроздь сталактитов, фонарь рядом с цепью
      const comp = FG_COMPANION[type];
      if (!comp || !A.fg.includes(comp) || hash2(c.x, c.y, 47) > 0.45) continue;
      const d = 3 + Math.floor(hash2(c.x, c.y, 48) * 3), dir = hash2(c.x, c.y, 49) < 0.5 ? -1 : 1;
      for (const dx of [d * dir, -d * dir]) {
        const n = byXY.get((c.x + dx) + ',' + c.y);
        if (!n || otherLayer(n, li) || (c.room < 7 && FG_LONG.has(comp))) continue;
        // той же породы — короче главной, чтобы группа читалась как группа
        if (place(n, comp, li, 1, comp === type ? 0.55 + hash2(n.x, n.y, 50) * 0.25 : 0.7)) { taken.push(n); break; }
      }
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
        const room = d - 1;
        if (room >= 5 && room <= 16 && lv.tileSolid(x, y + d)) {
          const p = { x: x * TILE + 8, top: (y + 1) * TILE, bottom: (y + d) * TILE, style: A.pillar, fade: 0, want: 0, lit: 0.5, seed: hash2(x, y, 51) };
          // каменная колонна иногда несёт факел, стальная — полосы «осторожно» и сигнальный огонь
          if (A.pillar === 'stone' && room >= 6 && hash2(x, y, 52) < 0.5) p.torch = (y + 1 + Math.max(2, Math.round(room * 0.3))) * TILE;
          if (A.pillar === 'steel') { p.bands = true; p.beacon = hash2(x, y, 53) < 0.7; }
          amb.fgPillars.push(p);
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
  // то, что светится само (лампа, фонарь, факел на колонне), подсвечивает и свой контур
  for (const o of amb.fg) o.lit = Math.max(clamp((at(o.x, o.y + 12) - 0.18) * 1.7, 0.08, 1), FG_GLOW[o.type] ? 0.75 : 0);
  for (const p of amb.fgPillars) p.lit = Math.max(clamp((at(p.x, (p.top + p.bottom) / 2) - 0.18) * 1.7, 0.08, 1), p.torch ? 0.6 : 0);
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

// Толчок: качнуть вещь (тяжёлое — слабее); металл, качнувшись сильно, звякает.
function fgPush(o, dv) {
  o.vel += dv * (FG_MASS[o.type] || 1);
  const pitch = FG_CLINK[o.type];
  if (pitch && o.clinkT <= 0 && o.fade > 0.1 && Math.abs(o.vel) > 1.1) {
    Sound.play('clink', o.x, o.y + o.len, { vol: 0.3 * Math.min(1, Math.abs(o.vel) / 3), p: pitch * (0.95 + hash2(o.tx, o.ty, 55) * 0.1), gap: 0.05 });
    o.clinkT = 0.45;
  }
}

// Раз в кадр: раскачка, прозрачность над героем, у середины кадра и в бою.
function updateForeground(lv, dt, cam, vw, vh) {
  const amb = lv.amb;
  if (!amb || !amb.fg) return;
  const guards = fgGuards(cam);
  const ease = Math.min(1, dt * 7);
  // голова героя на экране (в меню — верхние две трети кадра)
  const p = Game.player;
  const headY = p && p.alive ? p.y - cam.y : vh * 0.66;
  const playing = Game.state === 'playing';
  // бой рядом: передний план отступает (за полторы секунды), после боя — возвращается
  const heat = playing ? Music.intensity : 0;
  amb.fgCombat = amb.fgCombat || 0;
  amb.fgCombat += (heat - amb.fgCombat) * Math.min(1, dt * (heat > amb.fgCombat ? 1.6 : 0.35));
  // тряска (взрыв, шаги босса, обвал) и снаряды, пролетающие мимо
  const tremor = playing ? Game.shakeAmt : 0;
  const shots = playing ? Game.projectiles : [];
  for (const o of amb.fg) {
    const L = FG_LAYERS[o.layer];
    const s = fgProject(o.x, o.y, L.k, cam, vw, vh);
    const w = FG_WIDTH[o.type] * L.scale, h = fgExtent(o.type, o.len, o.v) * L.scale;
    if (o.clinkT > 0) o.clinkT -= dt;
    if (s.x + w < -40 || s.x - w > vw + 40 || s.y > vh + 40 || s.y + h < -40) { o.fade = 0; continue; }
    if (FG_SWING.has(o.type)) {
      if (tremor > 1.5) fgPush(o, (Math.random() - 0.5) * tremor * 0.16);
      for (const pr of shots) {
        if (pr.dead || pr === o.lastPr) continue;
        // снаряд на экране прошёл вплотную к вещи — воздух толкает её по ходу полёта
        const sx = pr.x - cam.x, sy = pr.y - cam.y;
        if (Math.abs(sx - s.x) > 18 * L.scale || sy < s.y - 6 || sy > s.y + h + 6) continue;
        o.lastPr = pr;
        if (Math.hypot(pr.vx, pr.vy) > 250) fgPush(o, (sign(pr.vx) || 1) * (pr.splash ? 2 : 0.8));
      }
      // маятник с затуханием и лёгкий сквозняк
      const acc = -o.ang * o.k2 - o.vel * o.damp + Math.sin(Game.time * 0.9 + o.seed) * 0.12;
      o.vel += acc * dt;
      o.ang = clamp(o.ang + o.vel * dt, -0.7, 0.7);
    }
    // висящее живёт над героем: опускаясь к его голове, растворяется
    const bottom = s.y + h;
    let want = L.alpha * clamp((headY - 18 - bottom) / 46, 0, 1) * (1 - 0.3 * amb.fgCombat);
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
    let want = FG_PILLAR.alpha * inRoom * (1 - 0.4 * amb.fgCombat);
    if (fgHit({ x: s.x - w / 2 - 6, y: 0, w: w + 12, h: vh }, guards)) want = Math.min(want, 0.2);
    c.want = want;
    c.fade += (want - c.fade) * ease;
  }
}

// Взрыв рядом раскачивает всё, что висит на цепях и тросах.
function foregroundJolt(x, y, power) {
  const amb = Game.level && Game.level.amb;
  if (!amb || !amb.fg) return;
  for (const o of amb.fg) {
    if (!FG_SWING.has(o.type)) continue;
    const d = dist(o.x, o.y + o.len * 0.5, x, y);
    if (d > 320) continue;
    fgPush(o, (sign(o.x - x) || 1) * power * 2.4 * (1 - d / 320));
  }
}

// Силуэт вещи в своих координатах: x — от центра, y — вниз от точки крепления.
// part: 'D' — сам силуэт, 'R' — подсвеченный контур, 'G' — то, что светится само.
function paintFgShape(g, type, len, v, C, part) {
  const D = 'D', R = 'R', G = 'G';
  const f = (a, b, w, h, c) => {
    if (c !== part) return;
    g.fillStyle = C[c]; g.fillRect(Math.round(a), Math.round(b), w, h);
  };
  // дырка в силуэте (глазницы черепа)
  const hole = (a, b, w, h) => { if (part === D) g.clearRect(Math.round(a), Math.round(b), w, h); };
  // цепь из звеньев от y0 до y1
  const links = (y0, y1) => {
    for (let y = y0; y < y1; y += 4) {
      if (((y - y0) / 4) % 2 === 0) { f(-1, y, 3, 4, D); f(-1, y, 1, 3, R); } else f(0, y, 1, 4, D);
    }
  };
  switch (type) {
    case 'chain':
      f(-5, 0, 11, 3, D); f(-5, 2, 11, 1, R);
      for (let y = 3; y < len; y += 5) {
        if (((y - 3) / 5) % 2 === 0) { f(-2, y, 5, 5, D); f(-2, y, 1, 4, R); } else f(0, y, 1, 5, D);
      }
      // на конце — то крюк, то обрывок, то тяжёлое кольцо
      if (v === 1) { f(-1, len, 3, 4, D); f(1, len + 3, 3, 2, D); f(3, len + 1, 2, 3, D); }
      else if (v === 2) { f(-3, len, 7, 2, D); f(-4, len + 1, 2, 4, D); f(3, len + 1, 2, 4, D); f(-3, len + 4, 7, 2, D); f(-4, len + 1, 1, 4, R); }
      else { f(-3, len, 7, 4, D); f(-3, len + 3, 7, 1, R); }
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
    case 'lamp': {
      // промышленная лампа: стакан у потолка, кабель, конус абажура, колба снизу
      f(-3, 0, 7, 2, D); f(0, 2, 1, len - 2, D);
      for (let i = 0; i < 6; i++) {
        const hw = Math.round(2 + i * 1.4);
        f(-hw, len + i, hw * 2 + 1, 1, D);
        f(-hw, len + i, 1, 1, R);
      }
      f(-2, len - 1, 5, 1, R);
      f(-2, len + 6, 5, 2, G); f(-1, len + 8, 3, 1, G);
      break;
    }
    case 'lantern':
      // фонарь на цепи: кольцо, крышка, стёкла в рамке с перемычкой, донце
      links(0, len - 1);
      f(-2, len - 1, 5, 2, D);
      f(-3, len + 1, 7, 1, D); f(-5, len + 2, 11, 2, D); f(-5, len + 2, 11, 1, R);
      f(-3, len + 4, 3, 10, G); f(1, len + 4, 3, 10, G);
      f(-5, len + 4, 2, 10, D); f(4, len + 4, 2, 10, D); f(0, len + 4, 1, 10, D);
      f(-5, len + 4, 1, 10, R);
      f(-5, len + 14, 11, 2, D); f(-2, len + 16, 5, 1, D);
      break;
    case 'hook': {
      // мясной крюк на цепи; на двух из трёх — туша, подвешенная за ноги
      links(0, len);
      f(-1, len, 3, 6, D); f(-1, len, 1, 6, R);
      f(-1, len + 6, 3, 2, D); f(1, len + 7, 3, 2, D); f(3, len + 4, 2, 4, D);
      if (v === 2) break;
      // тело вниз головой: ноги расходятся от крюка, торс с рёбрами, свисающие руки, голова
      const y0 = len + 8;
      for (let y = 0; y < 9; y++) { f(-1 - y * 0.45, y0 + y, 2, 1, D); f(1 + y * 0.45, y0 + y, 2, 1, D); }
      f(-5, y0 + 9, 11, 3, D);
      for (let y = 12; y < 26; y++) {
        const half = 5 + Math.sin((y - 12) / 14 * Math.PI) * 1.5;
        f(-half, y0 + y, Math.round(half * 2) + 1, 1, D);
        if (y > 15 && y < 24 && y % 2 === 0) f(-half + 1, y0 + y, 3, 1, R);
      }
      f(-5, y0 + 9, 1, 16, R);
      f(-2, y0 + 26, 5, 2, D);
      f(-3, y0 + 28, 7, 5, D); f(-2, y0 + 33, 5, 1, D); f(-3, y0 + 28, 1, 4, R);
      f(-7, y0 + 23, 2, 2, D); f(-8, y0 + 25, 1, 9, D); f(6, y0 + 23, 2, 2, D); f(7, y0 + 25, 1, 9, D);
      break;
    }
    case 'skulls': {
      // черепа на верёвке: два-три, нижний — на конце
      f(0, 0, 1, len, D); f(-2, 0, 5, 2, D);
      const at = len < 30 ? [len * 0.5, len] : [len * 0.34, len * 0.67, len];
      for (const yy of at) {
        const y = Math.round(yy) - 2;
        f(-2, y, 5, 1, D); f(-3, y + 1, 7, 4, D); f(-2, y + 5, 5, 2, D);
        hole(-2, y + 2, 2, 2); hole(1, y + 2, 2, 2); hole(0, y + 4, 1, 1);
        hole(-1, y + 6, 1, 1); hole(1, y + 6, 1, 1);
        f(-3, y + 1, 1, 3, R); f(-2, y, 2, 1, R);
      }
      break;
    }
    default: break;
  }
}

// Готовый спрайт (силуэт, контур или свечение) в нужном масштабе, ближний слой — размыт.
function fgSprite(type, len, v, layer, C, part) {
  const key = `${type}|${len}|${v}|${layer}|${part}`;
  let s = FG_CACHE.get(key);
  if (s) return s;
  const L = FG_LAYERS[layer];
  const pad = Math.ceil(L.blur * 3) + 2;
  const w = Math.ceil(FG_WIDTH[type] * L.scale) + pad * 2;
  const hgt = Math.ceil((fgExtent(type, len, v) + 4) * L.scale) + pad * 2;
  const raw = makeCanvas(w, hgt);
  const g = raw.getContext('2d');
  g.translate(w / 2, pad);
  g.scale(L.scale, L.scale);
  paintFgShape(g, type, len, v, C, part);
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

// Мягкий ореол света (рисуется сложением поверх).
function fgHalo(ctx, x, y, r, c, a) {
  if (a < 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.35})`);
  g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = ga;
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
  if (p.bands) {
    // полосы «осторожно» под потолком и у пола — привязаны к миру
    for (const wy of [p.top + 18, p.bottom - 30]) fgHazardBand(ctx, p, x0, w, fgProject(p.x, wy, k, cam, vw, vh).y, Math.round(8 * k), lit, vh);
  }
  if (p.beacon) fgBeacon(ctx, p, x0, w, fgProject(p.x, p.top + 8, k, cam, vw, vh).y, dark, amb);
  if (p.torch) fgTorch(ctx, p, fgProject(p.x, p.torch, k, cam, vw, vh), dark, rim, amb, vh);
  ctx.globalAlpha = 1;
}

function fgHazardBand(ctx, p, x0, w, y, h, lit, vh) {
  if (y > vh + h || y < -h) return;
  y = Math.round(y);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + 2, y, w - 4, h); ctx.clip();
  ctx.globalAlpha = p.fade * (0.22 + 0.55 * lit);
  ctx.fillStyle = '#c9a032';
  for (let i = -h; i < w + h; i += 10) {
    ctx.beginPath();
    ctx.moveTo(x0 + i, y + h); ctx.lineTo(x0 + i + 5, y + h); ctx.lineTo(x0 + i + 5 + h, y); ctx.lineTo(x0 + i + h, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Сигнальный огонь на стальной колонне: короткая красная вспышка раз в две секунды.
function fgBeacon(ctx, p, x0, w, y, dark, amb) {
  const x = x0 + w - 8;
  y = Math.round(y);
  ctx.globalAlpha = p.fade;
  ctx.fillStyle = dark; ctx.fillRect(x - 1, y - 1, 7, 7);
  const on = (Game.time + p.seed * 3) % 1.9 < 0.22;
  ctx.fillStyle = on ? '#ff4a2a' : '#3c100c'; ctx.fillRect(x + 1, y + 1, 3, 3);
  if (on) { fgHalo(ctx, x + 2.5, y + 2.5, 30, [255, 70, 40], 0.4 * p.fade); amb.fgGlows++; }
}

// Факел на каменной колонне: держатель, древко, живое пламя и тёплый ореол.
function fgTorch(ctx, p, s, dark, rim, amb, vh) {
  const x = Math.round(s.x), y = Math.round(s.y);
  if (y < -80 || y > vh + 40) return;
  const fl = fgStyle(FG_STYLE.torch, Game.time * 11, p.seed);
  // накладка на колонне, древко и чаша
  ctx.globalAlpha = p.fade;
  ctx.fillStyle = dark;
  ctx.fillRect(x - 4, y + 6, 9, 11); ctx.fillRect(x - 1, y + 2, 3, 5);
  ctx.fillRect(x - 5, y - 3, 11, 2); ctx.fillRect(x - 4, y - 1, 9, 3);
  ctx.globalAlpha = p.fade * 0.8;
  ctx.fillStyle = rim; ctx.fillRect(x - 5, y - 3, 11, 1); ctx.fillRect(x - 4, y + 6, 1, 11);
  ctx.globalAlpha = p.fade * 0.6; ctx.fillRect(x - 2, y + 8, 1, 1); ctx.fillRect(x + 2, y + 14, 1, 1);
  // пламя: три яруса, кончик гуляет
  const h = 10 + fl * 4 + Math.sin(Game.time * 23 + p.seed * 9) * 1.5;
  const fx = x + Math.round(Math.sin(Game.time * 9 + p.seed * 5) * 0.7), tip = Math.round(Math.sin(Game.time * 13 + p.seed) * 1.4);
  const yb = y - 3, R = (a, b, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(a), Math.round(b), w, Math.max(1, Math.round(hh))); };
  ctx.globalAlpha = p.fade;
  R(fx - 4, yb - h * 0.45, 9, h * 0.45, '#d8481a'); R(fx - 3, yb - h * 0.75, 7, h * 0.32, '#d8481a'); R(fx - 1 + tip, yb - h, 3, h * 0.27, '#d8481a');
  R(fx - 3, yb - h * 0.4, 7, h * 0.36, '#ffa232'); R(fx - 2 + tip * 0.5, yb - h * 0.66, 5, h * 0.28, '#ffa232');
  R(fx - 1, yb - h * 0.36, 3, h * 0.26, '#fff0b8');
  fgHalo(ctx, fx, yb - h * 0.4, 90, [255, 138, 52], 0.42 * fl * p.fade);
  amb.fgGlows++;
}

// Передний план поверх мира: средний слой, ближний слой, колонны.
function drawForeground(ctx, lv, cam, vw, vh) {
  const amb = lv.amb;
  if (!Game.fgOn || !amb || !amb.fg) return;
  if (!amb.fgLit && lv.lightCanvas) litForeground(lv);
  amb.fgGlows = 0;
  const C = { D: amb.fgDark, R: amb.rim };
  for (let layer = 0; layer < FG_LAYERS.length; layer++) {
    const L = FG_LAYERS[layer];
    for (const o of amb.fg) {
      if (o.layer !== layer || o.fade < 0.02) continue;
      const s = fgProject(o.x, o.y, L.k, cam, vw, vh);
      const dark = fgSprite(o.type, o.len, o.v, layer, C, 'D');
      const rim = fgSprite(o.type, o.len, o.v, layer, C, 'R');
      ctx.save();
      ctx.translate(Math.round(s.x), Math.round(s.y));
      if (o.ang) ctx.rotate(o.ang);
      ctx.globalAlpha = o.fade;
      ctx.drawImage(dark.canvas, -dark.px, -dark.py);
      ctx.globalAlpha = o.fade * o.lit;
      ctx.drawImage(rim.canvas, -rim.px, -rim.py);
      const gl = FG_GLOW[o.type];
      if (gl) {
        // свет мигает по своей строке яркости; колба светится, даже когда вещь в тени
        const fl = fgStyle(gl.style(o), Game.time * 10, o.seed);
        const glow = fgSprite(o.type, o.len, o.v, layer, { G: `rgb(${gl.c.join(',')})` }, 'G');
        ctx.globalAlpha = o.fade * clamp(0.25 + fl * 0.75, 0, 1);
        ctx.drawImage(glow.canvas, -glow.px, -glow.py);
        fgHalo(ctx, 0, (o.len + gl.dy) * L.scale, gl.r * L.scale, gl.c, 0.45 * fl * o.fade);
        amb.fgGlows++;
      }
      ctx.restore();
    }
  }
  for (const p of amb.fgPillars) if (p.fade >= 0.02) drawFgPillar(ctx, p, cam, vw, vh, amb);
}
