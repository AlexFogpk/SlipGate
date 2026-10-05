'use strict';
// Интерьер: у каждой темы свои крупные вещи, которые делают зал обжитым, — пульты и
// баки базы, гобелены, щиты с мечами и книжные шкафы замка, колумбарии и саркофаги
// склепа, светящиеся печати и кристаллы рунных храмов, лавовые прожилки, барельефы
// демонов и жаровни Нижнего мира. Плюс износ стен: потёки, мох, ржавчина, выбитые
// кирпичи. Всё рисуется в запечённый слой один раз; то, что светится, — ещё и в ярком
// проходе (lv.setGlows) и даёт свет (lv.setLights).

// Что ставить в какой теме: вид, где стоит (пол или стена), размер в клетках, доля от площади.
const INTERIOR = {
  base: [['console', 'floor', 2, 2, 1 / 700], ['crates', 'floor', 2, 2, 1 / 800], ['monitors', 'wall', 3, 2, 1 / 1300], ['tank', 'floor', 3, 3, 1 / 1800], ['sign', 'wall', 2, 1, 1 / 1100], ['locker', 'floor', 2, 3, 1 / 1500], ['stencil', 'high', 3, 2, 1 / 900], ['barrels', 'floor', 2, 2, 1 / 1100], ['fusebox', 'wall', 2, 2, 1 / 1300]],
  castle: [['rubble', 'floor', 1, 1, 1 / 1400], ['tapestry', 'wall', 2, 4, 1 / 1700], ['trophy', 'wall', 2, 2, 1 / 2200], ['bookcase', 'floor', 2, 3, 1 / 1500], ['brazier', 'floor', 1, 2, 1 / 1800], ['fireplace', 'floor', 3, 3, 1 / 2200], ['oculus', 'high', 2, 2, 1 / 1500], ['chandelier', 'ceil', 3, 3, 1 / 1400], ['weapons', 'floor', 2, 3, 1 / 1800]],
  crypt: [['loculi', 'wall', 3, 3, 1 / 1100], ['ossuary', 'wall', 3, 2, 1 / 1100], ['rubble', 'floor', 1, 1, 1 / 700], ['sarcophagus', 'floor', 3, 2, 1 / 1300], ['bones', 'floor', 1, 1, 1 / 400], ['candles', 'floor', 1, 1, 1 / 900], ['chandelier', 'ceil', 3, 3, 1 / 1800], ['oculus', 'high', 2, 2, 1 / 2400]],
  rune: [['seal', 'wall', 3, 3, 1 / 1200], ['crystals', 'floor', 2, 2, 1 / 1100], ['tapestry', 'wall', 2, 4, 1 / 1600], ['brazier', 'floor', 1, 2, 1 / 2000], ['oculus', 'high', 2, 2, 1 / 1300], ['chandelier', 'ceil', 3, 3, 1 / 2000]],
  nether: [['veins', 'wall', 2, 4, 1 / 700], ['rubble', 'floor', 1, 1, 1 / 800], ['relief', 'wall', 3, 3, 1 / 1400], ['brazier', 'floor', 1, 2, 1 / 1100], ['bones', 'floor', 1, 1, 1 / 600], ['flesh', 'wall', 3, 3, 1 / 1200], ['oculus', 'high', 2, 2, 1 / 1800]],
  elder: [['relief', 'wall', 3, 3, 1 / 1300], ['veins', 'wall', 2, 4, 1 / 900], ['brazier', 'floor', 1, 2, 1 / 1200], ['sarcophagus', 'floor', 3, 2, 1 / 2200], ['bones', 'floor', 1, 1, 1 / 700], ['flesh', 'wall', 3, 3, 1 / 1700], ['oculus', 'high', 2, 2, 1 / 2000]],
  cave: [['crystals', 'floor', 2, 2, 1 / 1200], ['mushrooms', 'floor', 1, 1, 1 / 500], ['stalagmites', 'floor', 2, 2, 1 / 600], ['bones', 'floor', 1, 1, 1 / 900]],
  // острова Пустоты: под открытым небом — обелиски с рунами и синие жаровни
  void: [['obelisk', 'sky', 1, 4, 1 / 1400], ['brazier', 'sky', 1, 2, 1 / 2400]],
};
// трафаретные надписи базы: номера секторов, как на стенах военных баз
const STENCIL = ['A-1', 'B-2', 'C-3', 'D-4', 'LAB', 'S-7', 'E-9', 'B-12', 'A-30', 'C-0'];
const FONT35 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  L: '100100100100111', S: '011100010001110', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111',
  '3': '110001010001110', '4': '101101111001001', '7': '111001010010010', '9': '111101111001110', '-': '000000111000000',
};
// окно-роза: что за ним в какой теме
const OCULUS = { castle: ['night', 'amber'], crypt: ['night'], rune: ['stained'], nether: ['hell'], elder: ['hell'] };
// износ стен по темам: потёки (цвет), мох, ржавчина, выбитые кирпичи
const WEAR = {
  base: { streak: '60,30,10', rust: true, chips: 0 },
  castle: { streak: '10,8,4', moss: '40,60,24', chips: 0.012 },
  crypt: { streak: '20,30,14', moss: '46,72,30', chips: 0.016 },
  rune: { streak: '6,10,20', chips: 0.01 },
  nether: { streak: '30,6,20', chips: 0.012 },
  elder: { streak: '24,8,4', chips: 0.014 },
  cave: { streak: '20,14,8', moss: '40,60,26', chips: 0 },
  void: null,
};

function dressInterior(lv, ctx, theme, col, h) {
  const { free, open, solid, take, spaced } = h;
  lv.setGlows = [];
  lv.setLights = [];
  dressWear(lv, ctx, theme, open, solid, free);
  dressCarpets(lv, ctx, theme, open, solid);
  const kinds = INTERIOR[theme] || [];
  if (!kinds.length) return;
  // на островах под небом: свои правила места (клетки неба над камнем)
  const skyCell = (x, y) => lv.tile(x, y) === T.SKY && !h.busy(x, y);
  const block = (x, y, w, hh) => {
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + w; xx++) if (!free(xx, yy)) return false;
    return true;
  };
  const rowOpen = (x, y, w) => { for (let xx = x; xx < x + w; xx++) if (!open(xx, y)) return false; return true; };
  const floorUnder = (x, y, w) => { for (let xx = x; xx < x + w; xx++) if (!solid(xx, y)) return false; return true; };
  const openBelow = (x, y, w, n) => { for (let i = 0; i < n; i++) if (!rowOpen(x, y + i, w)) return false; return true; };
  const area = lv.w * lv.h;
  const cands = [];
  for (let y = 2; y < lv.h - 2; y++) for (let x = 2; x < lv.w - 4; x++) cands.push([hash2(x, y, 131), x, y]);
  cands.sort((a, b) => a[0] - b[0]);
  const count = {};
  for (const [, x, y] of cands) {
    // каждая клетка-кандидат пробует вещи по очереди, начиная со случайной
    const start = Math.floor(hash2(x, y, 132) * kinds.length);
    for (let i = 0; i < kinds.length; i++) {
      const [kind, where, w, hh, dens] = kinds[(start + i) % kinds.length];
      const cap = Math.max(1, Math.round(area * dens));
      if ((count[kind] || 0) >= cap) continue;
      let ok;
      if (where === 'sky') {
        ok = floorUnder(x, y + 1, w);
        for (let yy = y - hh; yy <= y && ok; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (!skyCell(xx, yy)) { ok = false; break; }
      } else if (where === 'floor') ok = block(x, y - hh + 1, w, hh) && floorUnder(x, y + 1, w) && rowOpen(x, y - hh, w);
      // высоко на стене: над вещью воздух, под ней — ещё четыре свободных ряда
      else if (where === 'high') ok = block(x, y, w, hh) && rowOpen(x, y - 1, w) && openBelow(x, y + hh, w, 4);
      // под потолком: сверху камень, снизу — место для героя
      else if (where === 'ceil') ok = floorUnder(x, y - 1, w) && block(x, y, w, hh) && openBelow(x, y + hh, w, 3);
      else ok = block(x, y, w, hh) && rowOpen(x, y - 1, w) && rowOpen(x, y + hh, w) && rowOpen(x, y + hh + 1, w) && !floorUnder(x, y + hh, w);
      if (!ok) continue;
      // одинаковые вещи держатся далеко друг от друга, любые настенные — хотя бы на шаг
      const small = kind === 'bones' || kind === 'candles' || kind === 'mushrooms' || kind === 'rubble';
      const onWall = where !== 'floor';
      if (onWall && !spaced('int-wall', x, y, 6, 4, 2000)) continue;
      if (!spaced('int-' + kind, x, y, small ? 5 : onWall ? 16 : 11, 6, 400)) continue;
      const px = x * TILE, py = where === 'floor' || where === 'sky' ? (y + 1) * TILE : y * TILE;
      drawInteriorPiece(lv, ctx, kind, px, py, hash2(x, y, 133), col, theme);
      count[kind] = (count[kind] || 0) + 1;
      lv.interior = count;
      const y0 = where === 'floor' || where === 'sky' ? y - hh + 1 : y;
      for (let yy = y0 - 1; yy < y0 + hh; yy++) for (let xx = x - 1; xx <= x + w; xx++) take(xx, yy);
      break;
    }
  }
}

// Ковровые дорожки в замке (красные) и рунных храмах (синие): вдоль длинных полов.
function dressCarpets(lv, ctx, theme) {
  const pal = theme === 'castle' ? ['#6a1414', '#8a2020', '#c89a38'] : theme === 'rune' ? ['#182a5a', '#24407a', '#9aa8c8'] : null;
  if (!pal) return;
  for (let y = 2; y < lv.h - 1; y++) {
    let x = 1;
    while (x < lv.w - 1) {
      // отрезок пола: над камнем пусто, не небо
      const ok = (xx) => lv.tile(xx, y) === T.EMPTY && !lv.skyBack(xx, y) && lv.tileSolid(xx, y + 1);
      if (!ok(x)) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < lv.w - 1 && ok(x1 + 1)) x1++;
      if (x1 - x >= 7 && hash2(x, y, 190) < 0.55) {
        const a = (x + 1) * TILE + 4, b = x1 * TILE - 4, py = (y + 1) * TILE;
        ctx.fillStyle = pal[0]; ctx.fillRect(a, py, b - a, 3);
        ctx.fillStyle = pal[1]; ctx.fillRect(a, py, b - a, 1);
        ctx.fillStyle = pal[2]; ctx.fillRect(a, py + 2, b - a, 1);
        for (let xx = a; xx < b; xx += 2) { ctx.fillStyle = pal[2]; ctx.fillRect(xx, py + 3, 1, 1); }   // бахрома
        ctx.fillStyle = pal[2]; ctx.fillRect(a, py - 1, 2, 4); ctx.fillRect(b - 2, py - 1, 2, 4);
      }
      x = x1 + 1;
    }
  }
}

// Износ: потёки из-под потолка, мох у пола, ржавые подтёки на базе, выбитые кирпичи.
function dressWear(lv, ctx, theme, open, solid, free) {
  const W = WEAR[theme];
  if (!W) return;
  for (let y = 1; y < lv.h - 1; y++) {
    for (let x = 1; x < lv.w - 1; x++) {
      if (!open(x, y)) continue;
      const px = x * TILE, py = y * TILE;
      // потёк сверху вниз под потолком или кромкой
      if (solid(x, y - 1) && hash2(x, y, 141) < 0.09) {
        const len = 18 + hash2(x, y, 142) * 46, w = 2 + Math.floor(hash2(x, y, 143) * 4), sx = px + Math.floor(hash2(x, y, 144) * 12);
        const g = ctx.createLinearGradient(0, py, 0, py + len);
        g.addColorStop(0, `rgba(${W.streak},0.38)`); g.addColorStop(1, `rgba(${W.streak},0)`);
        ctx.fillStyle = g; ctx.fillRect(sx, py, w, len);
        ctx.fillStyle = `rgba(${W.streak},0.25)`; ctx.fillRect(sx + Math.floor(w / 2), py + len * 0.7, 1, 3);
      }
      // мох и сырость у пола
      if (W.moss && solid(x, y + 1) && hash2(x, y, 145) < 0.16) {
        for (let i = 0; i < 14; i++) {
          const mx = px + hash2(x * 7 + i, y, 146) * 16, mh = 1 + hash2(x, y * 3 + i, 147) * 6;
          ctx.fillStyle = `rgba(${W.moss},${0.35 + hash2(i, x, 148) * 0.3})`;
          ctx.fillRect(Math.round(mx), Math.round(py + TILE - mh), 1 + (i % 2), Math.round(mh));
        }
      }
      // ржавые подтёки на металле
      if (W.rust && hash2(x, y, 149) < 0.03 && open(x, y + 1)) {
        const g = ctx.createLinearGradient(0, py, 0, py + 26);
        g.addColorStop(0, 'rgba(140,62,20,0.4)'); g.addColorStop(1, 'rgba(140,62,20,0)');
        ctx.fillStyle = g; ctx.fillRect(px + 6, py + 2, 2, 26); ctx.fillRect(px + 9, py + 4, 1, 16);
        ctx.fillStyle = 'rgba(170,80,30,0.5)'; ctx.fillRect(px + 5, py + 1, 5, 2);
      }
      // выбитые кирпичи: тёмная глубина, светлая нижняя кромка, осколки внизу
      if (W.chips && free(x, y) && !solid(x, y - 1) && !solid(x, y + 1) && hash2(x, y, 150) < W.chips) {
        const n = 2 + Math.floor(hash2(x, y, 151) * 3);
        for (let i = 0; i < n; i++) {
          const bx = px + Math.floor(hash2(x, i, 152) * 10), by = py + Math.floor(hash2(y, i, 153) * 10);
          ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, 7, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(bx + 1, by + 4, 6, 1);
          ctx.fillStyle = 'rgba(255,235,200,0.14)'; ctx.fillRect(bx, by + 4, 7, 1);
        }
      }
    }
  }
}

function drawInteriorPiece(lv, ctx, kind, x, y, k, col, theme) {
  const f = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
  const rk = ramp(shade(col.rock, 1.15));
  switch (kind) {
    case 'console': {
      // пульт: стойка, наклонная панель с экраном, ряд кнопок, кабель в пол
      const b = y;
      f(x + 1, b - 18, 30, 18, '#2c2e30'); f(x + 1, b - 18, 30, 1, '#5a5c5c'); f(x + 1, b - 18, 1, 18, '#4a4c4c');
      f(x + 29, b - 18, 2, 18, '#1a1b1c');
      for (let i = 0; i < 3; i++) f(x + 4, b - 14 + i * 4, 24, 1, '#202224');
      f(x + 3, b - 30, 26, 12, '#3a3c3e'); f(x + 3, b - 30, 26, 1, '#6a6c6a');
      f(x + 6, b - 28, 20, 8, '#06120c');
      const lamps = ['#c03020', '#d0a020', '#30b040', '#3070d0'];
      for (let i = 0; i < 5; i++) f(x + 5 + i * 5, b - 17, 3, 2, lamps[Math.floor(hash2(x, i, 160) * 4)]);
      f(x + 14, b - 2, 4, 2, '#151617');
      lv.setGlows.push({ kind: 'screen', x: x + 6, y: b - 28, w: 20, h: 8, k, col: k < 0.6 ? '60,255,140' : '255,180,60' });
      lv.setLights.push({ x: x + 16, y: b - 24, r: 44, c: k < 0.6 ? [0.3, 1, 0.55] : [1, 0.7, 0.3], i: 0.35 });
      break;
    }
    case 'tank': {
      // бак-генератор: цилиндр со светотенью, обручи, заклёпки, манометр, трубы
      const b = y, top = b - 44, w = 40, x0 = x + 4;
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, '#1e2022'); g.addColorStop(0.3, '#5a5e60'); g.addColorStop(0.45, '#7a7e7e'); g.addColorStop(1, '#16181a');
      ctx.fillStyle = g; ctx.fillRect(x0, top + 6, w, b - top - 10);
      ctx.beginPath(); ctx.ellipse(x0 + w / 2, top + 6, w / 2, 5, 0, Math.PI, 0); ctx.fill();
      for (const yy of [top + 10, top + 26, b - 10]) { f(x0 - 1, yy, w + 2, 3, '#2a2c2e'); f(x0 - 1, yy, w + 2, 1, '#6a6c6a'); for (let i = 3; i < w; i += 6) f(x0 + i, yy + 1, 1, 1, '#9a9a96'); }
      f(x0 - 2, b - 4, w + 4, 4, '#2a2c2e');
      // манометр
      ctx.fillStyle = '#d8d4c0'; ctx.beginPath(); ctx.arc(x0 + 12, top + 21, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + 12, top + 21, 5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#b02010'; ctx.beginPath(); ctx.moveTo(x0 + 12, top + 21); ctx.lineTo(x0 + 12 + Math.cos(-0.6 - k * 2) * 4, top + 21 + Math.sin(-0.6 - k * 2) * 4); ctx.stroke();
      // полоса «опасно» и труба вверх
      for (let i = 0; i < w; i += 6) { f(x0 + i, top + 31, 3, 3, '#c8a030'); f(x0 + i + 3, top + 31, 3, 3, '#1a1a1a'); }
      f(x0 + w - 10, top - 10, 5, 16, '#3a3c3e'); f(x0 + w - 10, top - 10, 1, 16, '#6a6c6a');
      lv.setGlows.push({ kind: 'lamp', x: x0 + w - 6, y: top + 22, k, col: '255,60,30' });
      break;
    }
    case 'sign': {
      // табличка «опасно»: жёлто-чёрная рамка, значок
      const x0 = x + 4, y0 = y + 3;
      f(x0 - 1, y0 - 1, 26, 12, '#141414');
      for (let i = 0; i < 24; i += 4) { f(x0 + i, y0, 2, 10, '#d0a830'); f(x0 + i + 2, y0, 2, 10, '#1a1a1a'); }
      f(x0 + 4, y0 + 2, 16, 6, '#d8c070');
      const icon = Math.floor(k * 3);
      if (icon === 0) { f(x0 + 10, y0 + 2, 3, 2, '#1a1a1a'); f(x0 + 9, y0 + 4, 3, 2, '#1a1a1a'); f(x0 + 11, y0 + 6, 2, 2, '#1a1a1a'); } // молния
      else if (icon === 1) { f(x0 + 9, y0 + 2, 5, 4, '#1a1a1a'); f(x0 + 10, y0 + 3, 1, 1, '#d8c070'); f(x0 + 12, y0 + 3, 1, 1, '#d8c070'); f(x0 + 10, y0 + 6, 3, 2, '#1a1a1a'); } // череп
      else { f(x0 + 11, y0 + 2, 1, 4, '#1a1a1a'); f(x0 + 11, y0 + 7, 1, 1, '#1a1a1a'); } // восклицательный знак
      break;
    }
    case 'locker': {
      // шкафчики: две дверцы с прорезями, одна приоткрыта
      const b = y;
      f(x + 2, b - 46, 28, 46, '#3a4038'); f(x + 2, b - 46, 28, 1, '#6a7064');
      f(x + 16, b - 46, 1, 46, '#1a1c18');
      for (const dx of [5, 19]) for (let i = 0; i < 4; i++) f(x + dx, b - 42 + i * 2, 8, 1, '#1a1c18');
      f(x + 13, b - 26, 2, 4, '#9a9a90'); f(x + 18, b - 26, 2, 4, '#9a9a90');
      if (k < 0.4) { f(x + 17, b - 45, 12, 44, '#0c0d0b'); f(x + 29, b - 45, 3, 44, '#4a5046'); }
      break;
    }
    case 'tapestry': {
      // гобелен на штанге: кайма, узор, герб в центре, бахрома
      const rune = theme === 'rune';
      const cloth = rune ? '#1c2a5c' : '#5c1414', edge = rune ? '#9aa8c8' : '#c89a38', dark = rune ? '#101a3a' : '#3a0a0a';
      const x0 = x + 4, top = y + 4, w = 24, hgt = 52;
      f(x0 - 3, top - 2, w + 6, 2, '#3a2a18'); f(x0 - 4, top - 3, 2, 4, '#c8a050'); f(x0 + w + 2, top - 3, 2, 4, '#c8a050');
      for (let yy = 0; yy < hgt; yy++) {
        const sway = Math.round(Math.sin(yy * 0.12 + k * 6) * 0.6);
        f(x0 + sway, top + yy, w, 1, yy % 9 === 4 ? dark : cloth);
      }
      f(x0, top, 2, hgt, edge); f(x0 + w - 2, top, 2, hgt, edge); f(x0, top + 1, w, 1, edge);
      // герб: щит с крестом или руна в круге
      const cx = x0 + w / 2, cy = top + 22;
      if (rune) {
        ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
        f(cx, cy - 5, 1, 10, edge); f(cx - 3, cy - 2, 7, 1, edge); f(cx - 3, cy + 3, 3, 1, edge);
      } else {
        f(cx - 6, cy - 8, 12, 10, edge); f(cx - 5, cy + 2, 10, 2, edge); f(cx - 3, cy + 4, 6, 2, edge); f(cx - 1, cy + 6, 2, 1, edge);
        f(cx - 1, cy - 7, 2, 12, dark); f(cx - 5, cy - 3, 10, 2, dark);
      }
      for (let i = 0; i < w; i += 2) f(x0 + i, top + hgt, 1, 3 + (i % 4 === 0 ? 1 : 0), edge);
      f(x0 + w, top + 2, 1, hgt, 'rgba(0,0,0,0.4)');
      break;
    }
    case 'trophy': {
      // щит с гербом и скрещённые мечи
      const cx = x + 16, cy = y + 16;
      ctx.strokeStyle = '#a8a8b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 13, cy - 12); ctx.lineTo(cx + 12, cy + 12); ctx.moveTo(cx + 13, cy - 12); ctx.lineTo(cx - 12, cy + 12); ctx.stroke();
      f(cx - 14, cy + 9, 5, 2, '#6a4a20'); f(cx + 9, cy + 9, 5, 2, '#6a4a20');
      const c1 = ['#7a1a1a', '#1a3a7a', '#1a5a2a'][Math.floor(k * 3)], c2 = '#c8a040';
      f(cx - 7, cy - 9, 14, 12, '#2a2018');
      f(cx - 6, cy - 8, 6, 11, c1); f(cx, cy - 8, 6, 11, c2);
      f(cx - 5, cy + 3, 10, 2, k < 0.5 ? c1 : c2); f(cx - 3, cy + 5, 6, 2, '#2a2018'); f(cx - 1, cy + 7, 2, 1, '#2a2018');
      f(cx - 6, cy - 8, 12, 1, 'rgba(255,240,200,0.35)');
      break;
    }
    case 'bookcase': {
      // книжный шкаф: рама, три полки книг разной высоты и цвета, на верху — череп или свеча
      const b = y, x0 = x + 2, w = 28, top = b - 46;
      f(x0, top, w, 46, '#3a2414'); f(x0, top, w, 2, '#6a4628'); f(x0, top, 2, 46, '#5a3a20'); f(x0 + w - 2, top, 2, 46, '#24160c');
      const book = ['#6a1a14', '#1a3a5a', '#2a4a1a', '#6a5a2a', '#4a2a4a', '#8a6a3a'];
      for (let s = 0; s < 3; s++) {
        const sy = top + 4 + s * 14;
        f(x0 + 2, sy + 11, w - 4, 2, '#24160c');
        let bx = x0 + 3;
        while (bx < x0 + w - 4) {
          const bw = 2 + Math.floor(hash2(bx, sy, 161) * 2), bh = 7 + Math.floor(hash2(sy, bx, 162) * 4);
          if (hash2(bx, s, 163) < 0.12) { bx += bw + 1; continue; }
          f(bx, sy + 11 - bh, bw, bh, book[Math.floor(hash2(bx, sy, 164) * book.length)]);
          f(bx, sy + 11 - bh, 1, bh, 'rgba(255,240,200,0.18)');
          bx += bw;
        }
      }
      if (k < 0.5) drawSkull(ctx, x0 + 10, top, k);
      break;
    }
    case 'brazier': {
      // жаровня на треноге: чаша с углями, огонь — в ярком проходе
      const b = y, cx = x + 8;
      f(cx - 1, b - 14, 2, 14, '#2a2622'); f(cx - 6, b - 2, 12, 2, '#2a2622');
      ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 5, b); ctx.lineTo(cx, b - 10); ctx.lineTo(cx + 5, b); ctx.stroke();
      f(cx - 7, b - 20, 14, 3, '#3a3430'); f(cx - 6, b - 17, 12, 2, '#2a2420'); f(cx - 4, b - 15, 8, 1, '#2a2420');
      f(cx - 7, b - 20, 14, 1, '#7a6a5a');
      f(cx - 5, b - 21, 10, 1, '#c84010');
      const blue = theme === 'rune' || theme === 'void';
      lv.setGlows.push({ kind: 'fire', x: cx, y: b - 21, k, col: blue ? '120,180,255' : '255,140,40' });
      lv.setLights.push({ x: cx, y: b - 30, r: 120, c: blue ? [0.5, 0.7, 1] : [1, 0.6, 0.25], i: 0.85 });
      break;
    }
    case 'loculi': {
      // колумбарий: ниши в два ряда, часть заложена плитой с надписью, в остальных — черепа
      const x0 = x + 1, y0 = y + 4;
      f(x0 - 1, y0 - 2, 48, 42, rk[1]);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const nx = x0 + 1 + c * 15, ny = y0 + r * 19;
        f(nx, ny, 13, 15, '#0a0a08');
        f(nx, ny + 15, 13, 1, rk[3]);
        const s = hash2(x + c, y + r, 165);
        if (s < 0.35) { f(nx + 1, ny + 1, 11, 13, rk[2]); f(nx + 3, ny + 5, 7, 1, rk[0]); f(nx + 3, ny + 8, 5, 1, rk[0]); f(nx + 1, ny + 1, 11, 1, rk[4]); }
        else if (s < 0.75) drawSkull(ctx, nx + 4, ny + 15, s);
        else { f(nx + 2, ny + 12, 9, 2, '#b8b098'); f(nx + 4, ny + 11, 2, 1, '#d8d0b8'); }
      }
      f(x0 - 1, y0 - 3, 48, 1, rk[4]);
      break;
    }
    case 'sarcophagus': {
      // каменный саркофаг: ящик с резьбой и крышка с фигурой
      const b = y, x0 = x + 3, w = 42;
      f(x0, b - 14, w, 14, rk[2]); f(x0, b - 14, w, 1, rk[3]); f(x0 + w - 1, b - 14, 1, 14, rk[0]);
      for (let i = 4; i < w - 4; i += 9) { f(x0 + i, b - 11, 6, 8, rk[1]); f(x0 + i + 1, b - 10, 4, 6, rk[2]); }
      f(x0 - 2, b - 20, w + 4, 6, rk[3]); f(x0 - 2, b - 20, w + 4, 1, rk[4]); f(x0 - 2, b - 15, w + 4, 1, rk[0]);
      // фигура на крышке: голова, сложенные руки
      f(x0 + 4, b - 23, 6, 3, rk[3]); f(x0 + 10, b - 22, 26, 2, rk[3]); f(x0 + 18, b - 23, 4, 1, rk[4]);
      if (k < 0.4) f(x0 + w - 8, b - 22, 9, 3, '#0a0a08');   // крышка сдвинута
      break;
    }
    case 'bones': {
      // кости и череп на полу
      const b = y;
      f(x + 2, b - 2, 9, 2, '#b8b098'); f(x + 4, b - 3, 2, 1, '#d8d0b8'); f(x + 9, b - 4, 5, 2, '#a8a088');
      drawSkull(ctx, x + 3 + Math.floor(k * 6), b - 1, k);
      break;
    }
    case 'candles': {
      // свечи у стены, огоньки — в ярком проходе
      const b = y;
      for (let i = 0; i < 3; i++) {
        const cx = x + 3 + i * 4, ch = 4 + Math.floor(hash2(x, i, 166) * 5);
        f(cx, b - ch, 2, ch, '#d8ccb0'); f(cx, b - ch, 1, ch, '#f0e8d0');
        lv.setGlows.push({ kind: 'candle', x: cx + 1, y: b - ch - 1, k: hash2(x, i, 167), col: '255,190,90' });
      }
      f(x + 1, b - 1, 14, 1, '#c8bca0');
      lv.setLights.push({ x: x + 8, y: b - 8, r: 50, c: [1, 0.75, 0.4], i: 0.5 });
      break;
    }
    case 'seal': {
      // магическая печать: два круга, восемь рун по кругу, знак в центре — светится
      const cx = x + 24, cy = y + 24;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.stroke();
      const pts = [];
      const ring = (r, n) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)); } };
      ring(20, 64); ring(13, 44);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + 0.2, rx = cx + Math.cos(a) * 16.5, ry = cy + Math.sin(a) * 16.5;
        pts.push(Math.round(rx), Math.round(ry - 1), Math.round(rx), Math.round(ry), Math.round(rx + (i % 2 ? 1 : -1)), Math.round(ry + 1));
      }
      for (let i = -6; i <= 6; i++) pts.push(cx + i, cy + Math.round(Math.abs(i) * 0.6) - 2, cx, cy + i);
      ctx.fillStyle = '#121216';
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
      lv.glyphs.push({ pts, col: col.glyph, phase: k * 10 });
      lv.setLights.push({ x: cx, y: cy, r: 70, c: [0.45, 0.6, 1], i: 0.35 });
      break;
    }
    case 'crystals': {
      // друза кристаллов: грани со светом, светятся
      const b = y, hue = theme === 'cave' ? ['#4ac8c0', '#2a7a80', '#a0f0e8'] : ['#8a6ae8', '#4a3a9a', '#d0c0ff'];
      for (let i = 0; i < 5; i++) {
        const cx = x + 4 + i * 5 + Math.floor(hash2(x, i, 168) * 3), ch = 8 + Math.floor(hash2(i, x, 169) * 16), lean = (i - 2) * 1.2;
        ctx.fillStyle = hue[1];
        ctx.beginPath(); ctx.moveTo(cx - 3, b); ctx.lineTo(cx + lean, b - ch); ctx.lineTo(cx + 3, b); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hue[0];
        ctx.beginPath(); ctx.moveTo(cx - 1, b); ctx.lineTo(cx + lean, b - ch); ctx.lineTo(cx + 3, b); ctx.closePath(); ctx.fill();
        f(cx + lean, b - ch + 2, 1, 3, hue[2]);
      }
      lv.setGlows.push({ kind: 'crystal', x: x + 16, y: b - 10, k, col: theme === 'cave' ? '80,220,210' : '150,120,255' });
      lv.setLights.push({ x: x + 16, y: b - 12, r: 64, c: theme === 'cave' ? [0.35, 0.9, 0.85] : [0.6, 0.5, 1], i: 0.5 });
      break;
    }
    case 'mushrooms': {
      const b = y;
      for (let i = 0; i < 3; i++) {
        const cx = x + 3 + i * 4, ch = 3 + Math.floor(hash2(x, i, 170) * 4);
        f(cx, b - ch, 1, ch, '#c8c0a0'); f(cx - 2, b - ch - 2, 5, 2, '#5ac8a0'); f(cx - 1, b - ch - 3, 3, 1, '#8af0c8');
      }
      lv.setGlows.push({ kind: 'crystal', x: x + 8, y: b - 5, k, col: '90,230,170' });
      break;
    }
    case 'veins': {
      // трещины с лавой в стене: тёмные изломы, раскалённая сердцевина — в ярком проходе
      const pts = [];
      let px = x + 6 + k * 18, py = y + 2;
      while (py < y + 62) {
        const nx = px + (hash2(px, py, 171) - 0.5) * 8, ny = py + 3 + hash2(py, px, 172) * 5;
        const st = Math.max(Math.abs(nx - px), Math.abs(ny - py));
        for (let i = 0; i <= st; i++) pts.push(Math.round(lerp(px, nx, i / st)), Math.round(lerp(py, ny, i / st)));
        if (hash2(px, py, 173) < 0.25) { // ответвление
          const bx = nx + (hash2(nx, 1, 174) < 0.5 ? -6 : 6), by = ny + 4;
          for (let i = 0; i <= 6; i++) pts.push(Math.round(lerp(nx, bx, i / 6)), Math.round(lerp(ny, by, i / 6)));
        }
        px = nx; py = ny;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i] - 1, pts[i + 1], 3, 1);
      lv.setGlows.push({ kind: 'veins', pts, k });
      lv.setLights.push({ x: x + 16, y: y + 32, r: 70, c: [1, 0.4, 0.12], i: 0.45 });
      break;
    }
    case 'relief': {
      // барельеф демона: рога, глазницы, клыки — высечен в камне
      const cx = x + 24, cy = y + 24;
      ctx.fillStyle = rk[1]; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 15, 17, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rk[2]; ctx.beginPath(); ctx.ellipse(cx, cy + 1, 13, 15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rk[3];
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 8); ctx.quadraticCurveTo(cx - 22, cy - 18, cx - 16, cy - 24); ctx.quadraticCurveTo(cx - 14, cy - 15, cx - 6, cy - 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 10, cy - 8); ctx.quadraticCurveTo(cx + 22, cy - 18, cx + 16, cy - 24); ctx.quadraticCurveTo(cx + 14, cy - 15, cx + 6, cy - 12); ctx.fill();
      f(cx - 9, cy - 4, 6, 4, '#080606'); f(cx + 3, cy - 4, 6, 4, '#080606');
      f(cx - 12, cy - 7, 9, 2, rk[0]); f(cx + 3, cy - 7, 9, 2, rk[0]);
      f(cx - 1, cy, 2, 5, rk[0]);
      f(cx - 7, cy + 8, 14, 4, '#080606');
      for (let i = -6; i <= 5; i += 3) f(cx + i, cy + 8, 1, 2, rk[4]);
      f(cx - 13, cy - 2, 1, 14, rk[4]);
      lv.setGlows.push({ kind: 'eyes', x: cx, y: cy - 2, k, col: theme === 'elder' ? '255,120,40' : '255,40,40' });
      break;
    }
    case 'obelisk': {
      // обелиск Древних: сужающийся камень на постаменте, руны светятся
      const b = y, cx = x + 8, hgt = 54 + Math.floor(k * 10);
      f(cx - 8, b - 5, 16, 5, rk[1]); f(cx - 8, b - 5, 16, 1, rk[3]);
      for (let yy = 0; yy < hgt; yy++) {
        const half = 5 - (yy / hgt) * 2.5;
        f(cx - half, b - 5 - yy, Math.round(half * 2), 1, rk[2]);
        f(cx - half, b - 5 - yy, 1, 1, rk[3]); f(cx + half - 1, b - 5 - yy, 1, 1, rk[0]);
      }
      f(cx - 2, b - 6 - hgt, 4, 2, rk[2]); f(cx - 1, b - 8 - hgt, 2, 2, rk[3]);
      const pts = [];
      for (let r = 0; r < 4; r++) {
        const ry = b - 14 - r * 11, sh = Math.floor(hash2(x, r, 194) * 3);
        pts.push(cx, ry, cx, ry - 1, cx, ry - 2, cx, ry - 3);
        if (sh === 0) pts.push(cx - 1, ry - 3, cx + 1, ry - 3); else if (sh === 1) pts.push(cx - 1, ry - 1, cx + 1, ry - 2); else pts.push(cx + 1, ry, cx - 1, ry - 2);
      }
      ctx.fillStyle = '#101018';
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
      lv.glyphs.push({ pts, col: col.glyph, phase: k * 10 });
      lv.setLights.push({ x: cx, y: b - 30, r: 70, c: [0.4, 0.85, 1], i: 0.35 });
      break;
    }
    case 'rubble': {
      // обломки у стены: куски кладки и пыль
      const b = y;
      for (let i = 0; i < 5; i++) {
        const w = 2 + Math.floor(hash2(x, i, 191) * 4), hh = 1 + Math.floor(hash2(i, x, 192) * 3), rx = x + 1 + Math.floor(hash2(x, i * 3, 193) * 12);
        f(rx, b - hh, w, hh, rk[i % 2 ? 2 : 1]); f(rx, b - hh, w, 1, rk[3]);
      }
      f(x, b - 1, 16, 1, 'rgba(0,0,0,0.25)');
      break;
    }
    case 'stalagmites': {
      // сталагмиты: каменные зубья с пола, с наплывами и бликом
      const b = y;
      for (let i = 0; i < 3; i++) {
        const cx = x + 5 + i * 10 + Math.floor(hash2(x, i, 186) * 4), ch = 8 + Math.floor(hash2(i, x, 187) * 18), w = 4 + Math.floor(hash2(x, i, 188) * 4);
        for (let yy = 0; yy < ch; yy++) {
          const half = w * Math.pow(1 - yy / ch, 0.7) + (yy % 5 === 0 ? 0.6 : 0);
          f(cx - half, b - yy - 1, Math.max(1, Math.round(half * 2)), 1, yy < 2 ? rk[0] : rk[2]);
          if (yy > 1) f(cx - half, b - yy - 1, 1, 1, rk[3]);
        }
      }
      break;
    }
    case 'stencil': {
      // номер сектора краской по трафарету: крупно, краска выцвела и облупилась
      const text = STENCIL[Math.floor(k * STENCIL.length)];
      const sc = 3, gap = 1, w = text.length * (3 * sc + gap * sc);
      const x0 = x + Math.round((48 - w) / 2), y0 = y + 8;
      const paint = k < 0.5 ? '200,160,48' : '210,210,200';
      for (let i = 0; i < text.length; i++) {
        const bits = FONT35[text[i]] || '';
        for (let b = 0; b < 15; b++) {
          if (bits[b] !== '1') continue;
          const bx = x0 + i * (3 + gap) * sc + (b % 3) * sc, by = y0 + Math.floor(b / 3) * sc;
          for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
            if (hash2(bx + xx, by + yy, 182) < 0.18) continue;   // облупилось
            ctx.fillStyle = `rgba(${paint},${0.5 + hash2(bx + xx, by + yy, 183) * 0.25})`;
            ctx.fillRect(bx + xx, by + yy, 1, 1);
          }
        }
      }
      // полоса под надписью
      for (let xx = x0; xx < x0 + w; xx++) if (hash2(xx, y0, 184) > 0.15) { ctx.fillStyle = `rgba(${paint},0.45)`; ctx.fillRect(xx, y0 + 18, 1, 2); }
      break;
    }
    case 'barrels': {
      // бочки: две-три, с обручами и подтёками, одна может быть опрокинута
      const b = y;
      const drum = (cx, col) => {
        const g = ctx.createLinearGradient(cx - 6, 0, cx + 6, 0);
        g.addColorStop(0, shade(col, 0.5)); g.addColorStop(0.35, shade(col, 1.25)); g.addColorStop(1, shade(col, 0.45));
        ctx.fillStyle = g; ctx.fillRect(cx - 6, b - 18, 12, 18);
        f(cx - 6, b - 18, 12, 2, shade(col, 0.6)); f(cx - 6, b - 12, 12, 1, shade(col, 0.55)); f(cx - 6, b - 6, 12, 1, shade(col, 0.55));
        f(cx - 5, b - 18, 10, 1, shade(col, 1.4));
      };
      const cols = ['#7a2a1a', '#4a5a2a', '#2a4a6a', '#8a6a1a'];
      drum(x + 8, cols[Math.floor(k * 4)]);
      drum(x + 21, cols[Math.floor(k * 7) % 4]);
      // канистра рядом
      if (k < 0.5) { f(x + 27, b - 9, 5, 9, '#5a2a1a'); f(x + 27, b - 9, 5, 1, '#8a4a2a'); f(x + 29, b - 11, 2, 2, '#3a1a10'); }
      if (k > 0.6) { f(x + 2, b - 1, 12, 1, 'rgba(20,30,10,0.6)'); f(x + 5, b - 2, 6, 1, 'rgba(60,80,20,0.5)'); }
      break;
    }
    case 'fusebox': {
      // электрощит: коробка с дверцей, рубильник, жгут кабелей вниз
      const x0 = x + 6, y0 = y + 2;
      f(x0, y0, 20, 24, '#4a4e48'); f(x0, y0, 20, 1, '#7a7e76'); f(x0, y0, 1, 24, '#6a6e66'); f(x0 + 19, y0, 1, 24, '#262824');
      f(x0 + 3, y0 + 3, 14, 14, '#3a3e38'); f(x0 + 3, y0 + 3, 14, 1, '#262824');
      f(x0 + 8, y0 + 6, 4, 2, '#c8a030'); f(x0 + 9, y0 + 8, 2, 6, '#1a1a1a');
      f(x0 + 5, y0 + 19, 10, 2, '#1a1a1a'); f(x0 + 6, y0 + 19, 2, 2, '#c03020');
      for (let i = 0; i < 3; i++) {
        const cx = x0 + 6 + i * 4;
        ctx.strokeStyle = ['#1a1a1a', '#5a2a1a', '#2a2a3a'][i]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, y0 + 24); ctx.quadraticCurveTo(cx + (i - 1) * 3, y0 + 34, cx + (i - 1) * 2, y0 + 44); ctx.stroke();
      }
      lv.setGlows.push({ kind: 'lamp', x: x0 + 7, y: y0 + 20, k, col: '255,60,30' });
      break;
    }
    case 'ossuary': {
      // оссуарий: стена, выложенная черепами рядами, между ними — кости крест-накрест
      const x0 = x + 1, y0 = y + 2;
      f(x0 - 1, y0 - 1, 48, 30, rk[0]);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        const sx = x0 + 1 + c * 8 + (r % 2 ? 3 : 0), sy = y0 + 9 + r * 9;
        if (sx > x0 + 40) continue;
        drawSkull(ctx, sx, sy, hash2(c, r, 185));
      }
      f(x0, y0 - 2, 46, 2, rk[3]); f(x0, y0 + 28, 46, 2, rk[3]);
      break;
    }
    case 'fireplace': {
      // камин: каменный портал с полкой, тёмный зев, дрова и огонь
      const b = y, x0 = x + 2, w = 44;
      f(x0, b - 40, w, 40, rk[2]); f(x0, b - 40, w, 1, rk[4]);
      f(x0 - 3, b - 42, w + 6, 4, rk[3]); f(x0 - 3, b - 42, w + 6, 1, rk[4]); f(x0 - 3, b - 38, w + 6, 1, rk[0]);
      for (let yy = b - 34; yy < b; yy += 8) { f(x0 + 2, yy, 4, 1, rk[0]); f(x0 + w - 6, yy, 4, 1, rk[0]); }
      ctx.fillStyle = '#0c0806'; archPath(ctx, x0 + w / 2, b - 30, 13, b); ctx.fill();
      f(x0 + 12, b - 4, 20, 3, '#3a2414'); f(x0 + 14, b - 6, 16, 2, '#5a3a20');
      f(x0 + 6, b - 46, 6, 4, '#c8b890'); f(x0 + 32, b - 46, 4, 4, '#6a4a2a');   // свеча и кувшин на полке
      lv.setGlows.push({ kind: 'fire', x: x0 + w / 2, y: b - 5, k, col: '255,140,40' });
      lv.setGlows.push({ kind: 'fire', x: x0 + w / 2 - 5, y: b - 4, k: k + 0.37, col: '255,110,30' });
      lv.setLights.push({ x: x0 + w / 2, y: b - 14, r: 140, c: [1, 0.6, 0.25], i: 1 });
      break;
    }
    case 'crates': {
      // ящики штабелем: большой внизу, поменьше сверху со сдвигом; доски, скобы, трафарет
      const b = y;
      const box = (x0, y0, w, h, wood) => {
        const c = wood ? ['#5a4024', '#7a5a34', '#3a2814'] : ['#3a4440', '#5a6660', '#222826'];
        f(x0, y0, w, h, c[0]); f(x0, y0, w, 1, c[1]); f(x0, y0, 1, h, c[1]); f(x0 + w - 1, y0, 1, h, c[2]); f(x0, y0 + h - 1, w, 1, c[2]);
        f(x0 + 2, y0 + 2, w - 4, 1, c[2]); f(x0 + 2, y0 + h - 3, w - 4, 1, c[2]);
        ctx.strokeStyle = c[2]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 2, y0 + 3); ctx.lineTo(x0 + w - 2, y0 + h - 3); ctx.moveTo(x0 + w - 2, y0 + 3); ctx.lineTo(x0 + 2, y0 + h - 3); ctx.stroke();
        if (!wood) { f(x0 + w / 2 - 3, y0 + h / 2 - 1, 6, 2, '#c8a030'); }
      };
      box(x + 1, b - 16, 30, 16, k < 0.5);
      box(x + (k < 0.5 ? 3 : 13), b - 30, 16, 14, k >= 0.3);
      break;
    }
    case 'monitors': {
      // стена мониторов: три экрана в общей раме, под ними кнопки
      const x0 = x + 2, y0 = y + 3;
      f(x0 - 1, y0 - 1, 46, 28, '#1a1c1e'); f(x0, y0, 44, 26, '#3a3c3e'); f(x0, y0, 44, 1, '#6a6c6a');
      const cols = ['60,255,140', '255,180,60', '90,170,255'];
      for (let i = 0; i < 3; i++) {
        f(x0 + 2 + i * 14, y0 + 3, 12, 11, '#040a08');
        lv.setGlows.push({ kind: i === 1 && k < 0.5 ? 'graph' : 'screen', x: x0 + 2 + i * 14, y: y0 + 3, w: 12, h: 11, k: k + i * 0.3, col: cols[(i + Math.floor(k * 3)) % 3] });
      }
      for (let i = 0; i < 8; i++) f(x0 + 3 + i * 5, y0 + 18, 3, 2, ['#c03020', '#d0a020', '#30b040'][Math.floor(hash2(x, i, 175) * 3)]);
      f(x0 + 3, y0 + 22, 38, 1, '#202224');
      lv.setLights.push({ x: x0 + 22, y: y0 + 10, r: 56, c: [0.4, 0.8, 1], i: 0.35 });
      break;
    }
    case 'oculus': {
      // окно-роза: круглая рама из клиньев, переплёт-крест, за стеклом — вид по теме
      const kinds = OCULUS[theme] || ['night'];
      const kind = kinds[Math.floor(k * kinds.length)];
      const cx = x + 16, cy = y + 16, R = 12;
      ctx.fillStyle = rk[2]; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill();
      ctx.fillStyle = rk[0]; ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, TAU); ctx.clip();
      fillWindowView(ctx, cx - R, cy - R, R * 2, R * 2, kind, k);
      ctx.restore();
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rk[0];
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1)); ctx.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); ctx.stroke(); }
      // светлая кромка рамки сверху-слева
      ctx.strokeStyle = rk[4]; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R + 3.5, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
      lv.setGlows.push({ kind: 'oculus', x: cx, y: cy, r: R - 1, k, win: kind });
      const LC = { night: [[0.55, 0.65, 1], 0.3], stained: [[0.5, 0.55, 1], 0.45], amber: [[1, 0.72, 0.38], 0.45], hell: [[1, 0.38, 0.15], 0.5] }[kind];
      lv.setLights.push({ x: cx, y: cy + 20, r: 80, c: LC[0], i: LC[1] });
      break;
    }
    case 'chandelier': {
      // люстра: цепь от потолка, кованый обод, свечи — огоньки в ярком проходе
      const cx = x + 24, top = y, ring = top + 26 + Math.floor(k * 10);
      for (let yy = top; yy < ring - 6; yy += 4) { f(cx - 1, yy, 3, 3, '#2a2420'); f(cx - 1, yy, 1, 2, '#6a5a48'); }
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, ring - 7); ctx.lineTo(cx - 15, ring); ctx.moveTo(cx, ring - 7); ctx.lineTo(cx + 15, ring); ctx.stroke();
      f(cx - 17, ring, 34, 3, '#2a2420'); f(cx - 17, ring, 34, 1, '#7a6a52'); f(cx - 2, ring + 3, 4, 4, '#2a2420');
      const skull = theme === 'crypt';
      for (let i = -2; i <= 2; i++) {
        const sx = cx + i * 7;
        if (skull && i === 0) { drawSkull(ctx, sx - 2, ring, k); continue; }
        f(sx - 1, ring - 5, 2, 5, '#d8ccb0'); f(sx - 1, ring - 5, 1, 5, '#f0e8d0');
        lv.setGlows.push({ kind: 'candle', x: sx, y: ring - 6, k: hash2(x, i + 3, 176), col: theme === 'rune' ? '160,200,255' : '255,190,90' });
      }
      lv.setLights.push({ x: cx, y: ring - 4, r: 110, c: theme === 'rune' ? [0.6, 0.75, 1] : [1, 0.78, 0.45], i: 0.75 });
      break;
    }
    case 'weapons': {
      // стойка с оружием: копья, алебарда, щит у подножия
      const b = y, x0 = x + 2;
      f(x0, b - 4, 28, 4, '#3a2414'); f(x0, b - 4, 28, 1, '#6a4628');
      f(x0 + 1, b - 34, 26, 3, '#3a2414'); f(x0 + 1, b - 34, 26, 1, '#6a4628');
      for (let i = 0; i < 4; i++) {
        const sx = x0 + 4 + i * 6;
        f(sx, b - 44, 1, 40, '#5a4028');
        if (i === 2) { f(sx - 4, b - 44, 9, 5, '#9a9aa2'); f(sx - 4, b - 44, 9, 1, '#d0d0d8'); f(sx + 1, b - 48, 1, 4, '#9a9aa2'); }
        else { f(sx - 1, b - 48, 3, 4, '#a8a8b0'); f(sx, b - 50, 1, 2, '#d0d0d8'); }
      }
      const c1 = ['#7a1a1a', '#1a3a7a'][Math.floor(k * 2)];
      f(x0 + 8, b - 16, 12, 12, '#2a2018'); f(x0 + 9, b - 15, 10, 10, c1); f(x0 + 13, b - 15, 2, 10, '#c8a040'); f(x0 + 9, b - 11, 10, 2, '#c8a040');
      break;
    }
    case 'flesh': {
      // нарост плоти на стене: пузыри с прожилками и тёмными порами, слабо пульсирует
      const cx = x + 24, cy = y + 24;
      for (let i = 0; i < 7; i++) {
        const bx = cx + (hash2(x, i, 177) - 0.5) * 28, by = cy + (hash2(y, i, 178) - 0.5) * 26, r = 6 + hash2(i, x, 179) * 8;
        ctx.fillStyle = '#4a1222'; ctx.beginPath(); ctx.arc(bx, by, r + 1, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a1e30'; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a3446'; ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.35, r * 0.45, 0, TAU); ctx.fill();
        f(bx + r * 0.2, by + r * 0.2, 2, 2, '#200610');
      }
      ctx.strokeStyle = '#2a0812'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = hash2(x, i, 180) * TAU;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.5) * 14, cy + Math.sin(a + 0.5) * 14, cx + Math.cos(a) * 26, cy + Math.sin(a) * 24);
        ctx.stroke();
      }
      lv.setGlows.push({ kind: 'pulse', x: cx, y: cy, k });
      break;
    }
    default: break;
  }
}

// Яркий проход: экраны, лампы, огонь жаровен и свечей, кристаллы, лава в трещинах, глаза.
function drawInteriorGlows(ctx, cam, list, t) {
  if (!list || !list.length) return;
  const lv = Game.level;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of list) {
    const x = (g.x || (g.pts ? g.pts[0] : 0)) - cam.x, y = (g.y || (g.pts ? g.pts[1] : 0)) - cam.y;
    if (x < -60 || y < -80 || x > 2000 || y > 2000) continue;
    if (lv && lv.isHiddenAt(x + cam.x, y + cam.y)) continue;
    switch (g.kind) {
      case 'screen': {
        // строки текста бегут, изредка экран мигает
        const fl = hash2(Math.floor(t * 6), Math.floor(g.k * 100), 180) < 0.05 ? 0.3 : 1;
        ctx.globalAlpha = 0.35 * fl; ctx.fillStyle = `rgb(${g.col})`; ctx.fillRect(x, y, g.w, g.h);
        ctx.globalAlpha = 0.9 * fl;
        const sh = Math.floor(t * 3 + g.k * 10);
        for (let r = 0; r < 3; r++) {
          const len = 4 + Math.floor(hash2(sh + r, Math.floor(g.k * 50), 181) * (g.w - 6));
          ctx.fillRect(x + 2, y + 1 + r * 2.5, len, 1);
        }
        break;
      }
      case 'graph': {
        // график ползёт по экрану
        ctx.globalAlpha = 0.3; ctx.fillStyle = `rgb(${g.col})`; ctx.fillRect(x, y, g.w, g.h);
        ctx.globalAlpha = 0.95;
        for (let i = 0; i < g.w; i++) {
          const v = Math.sin((i + t * 8) * 0.6 + g.k * 9) * 0.5 + Math.sin((i + t * 5) * 1.3) * 0.25;
          ctx.fillRect(x + i, Math.round(y + g.h / 2 + v * (g.h / 2 - 1)), 1, 1);
        }
        break;
      }
      case 'oculus': {
        const col = { night: '150,170,255', stained: '120,140,255', amber: '255,180,90', hell: '255,90,30' }[g.win];
        const a = g.win === 'night' ? 0.08 : g.win === 'hell' ? 0.22 + Math.sin(t * 2.6 + g.k * 9) * 0.06 : 0.17 + Math.sin(t * 0.8 + g.k * 6) * 0.03;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, g.r);
        gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},${a * 0.5})`);
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, g.r, 0, TAU); ctx.fill();
        break;
      }
      case 'pulse': {
        const a = 0.06 + (Math.sin(t * 2.4 + g.k * 7) * 0.5 + 0.5) * 0.1;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 26);
        gr.addColorStop(0, `rgba(200,40,60,${a})`); gr.addColorStop(1, 'rgba(200,40,60,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - 26, y - 26, 52, 52);
        break;
      }
      case 'lamp': {
        const on = (t + g.k * 3) % 1.6 < 0.8;
        ctx.globalAlpha = on ? 1 : 0.25; ctx.fillStyle = `rgb(${g.col})`; ctx.fillRect(x - 1, y - 1, 3, 3);
        if (on) { const gr = ctx.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, `rgba(${g.col},0.5)`); gr.addColorStop(1, `rgba(${g.col},0)`); ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - 10, y - 10, 20, 20); }
        break;
      }
      case 'fire': case 'candle': {
        const big = g.kind === 'fire';
        const fl = 0.8 + Math.sin(t * 13 + g.k * 20) * 0.12 + Math.sin(t * 29 + g.k * 7) * 0.08;
        const h = (big ? 12 : 3) * fl, w = big ? 8 : 2;
        const tip = Math.sin(t * 8 + g.k * 9) * (big ? 1.5 : 0.5);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${g.col})`;
        ctx.fillRect(Math.round(x - w / 2), Math.round(y - h * 0.6), w, Math.round(h * 0.6) + 1);
        ctx.fillRect(Math.round(x - w / 4 + tip), Math.round(y - h), Math.max(1, Math.round(w / 2)), Math.round(h * 0.45));
        ctx.fillStyle = big ? '#fff0b0' : '#fff8e0';
        ctx.fillRect(Math.round(x - w / 4), Math.round(y - h * 0.45), Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h * 0.3)));
        const r = big ? 34 : 10;
        const gr = ctx.createRadialGradient(x, y - h * 0.4, 0, x, y - h * 0.4, r);
        gr.addColorStop(0, `rgba(${g.col},${0.4 * fl})`); gr.addColorStop(1, `rgba(${g.col},0)`);
        ctx.fillStyle = gr; ctx.fillRect(x - r, y - h * 0.4 - r, r * 2, r * 2);
        if (big && Math.random() < 0.15) FX.add({ kind: 'spark', x: x + cam.x + rand(-3, 3), y: y + cam.y - h, vx: rand(-15, 15), vy: rand(-60, -30), life: 0.7, max: 0.7, size: 1, col: '#ffb040', grav: -10, bright: true });
        break;
      }
      case 'crystal': {
        const a = 0.25 + Math.sin(t * 1.3 + g.k * 8) * 0.1;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 22);
        gr.addColorStop(0, `rgba(${g.col},${a})`); gr.addColorStop(1, `rgba(${g.col},0)`);
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - 22, y - 22, 44, 44);
        break;
      }
      case 'veins': {
        // лава пульсирует, по трещине бежит волна жара
        ctx.globalAlpha = 1;
        for (let i = 0; i < g.pts.length; i += 2) {
          const ph = Math.sin(t * 2.2 - i * 0.04 + g.k * 9) * 0.5 + 0.5;
          ctx.fillStyle = ph > 0.75 ? '#ffd070' : ph > 0.35 ? '#ff7a20' : '#a02a08';
          ctx.fillRect(g.pts[i] - cam.x, g.pts[i + 1] - cam.y, 1, 1);
        }
        break;
      }
      case 'eyes': {
        const a = 0.5 + Math.sin(t * 1.1 + g.k * 6) * 0.35;
        ctx.globalAlpha = a; ctx.fillStyle = `rgb(${g.col})`;
        ctx.fillRect(Math.round(x - 7), Math.round(y - 1), 2, 2); ctx.fillRect(Math.round(x + 5), Math.round(y - 1), 2, 2);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 16);
        gr.addColorStop(0, `rgba(${g.col},${0.25 * a})`); gr.addColorStop(1, `rgba(${g.col},0)`);
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - 16, y - 16, 32, 32);
        break;
      }
      default: break;
    }
  }
  ctx.restore();
}
