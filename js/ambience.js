'use strict';
// Живая атмосфера уровней: столбы света из проёмов и окон с пылинками, дымка над
// лавой, слизью и Пустотой, искры над лавой, капли со сталактитов, пар из решёток
// (тёмные силуэты переднего плана — в foreground.js).
// Всё это не влияет на игру: считается один раз при загрузке, рисуется поверх.

const AMB = {
  base: { shaft: [255, 238, 205], fg: ['girder', 'cable', 'lamp', 'chain', 'lamp'], pillar: 'steel', rim: '#7a7262' },
  castle: { shaft: [255, 222, 176], fg: ['chain', 'banner', 'cage', 'lantern', 'hook'], pillar: 'stone', rim: '#8a6a44' },
  crypt: { shaft: [205, 235, 212], fg: ['chain', 'roots', 'cage', 'skulls', 'hook'], pillar: 'stone', rim: '#6a6e58' },
  cave: { shaft: [225, 232, 205], fg: ['stal', 'roots', 'stal'], pillar: 'rock', rim: '#7a6444' },
  rune: { shaft: [195, 212, 255], fg: ['chain', 'cage', 'stal', 'lantern'], pillar: 'stone', rim: '#5a6480' },
  nether: { shaft: [255, 185, 242], fg: ['horn', 'stal', 'chain', 'hook'], pillar: 'stone', rim: '#6a4278' },
  void: { shaft: [195, 222, 255], fg: [], pillar: null, rim: '#3a4662' },
  elder: { shaft: [255, 192, 140], fg: ['stal', 'chain', 'cage', 'skulls'], pillar: 'stone', rim: '#8a4a2c' },
};

function prepareAmbience(lv) {
  const A = AMB[lv.theme] || AMB.base;
  const amb = lv.amb || (lv.amb = { drips: [], vents: [], windows: [], strips: [] });
  // столбы света: проём в потолке на небо (небо над пустой комнатой, по краям — потолок)
  amb.shafts = [];
  const open = (x, y) => lv.tile(x, y) === T.EMPTY;
  for (let y = 1; y < lv.h - 2; y++) {
    let x = 1;
    while (x < lv.w - 1) {
      if (!(skyLike(lv.tile(x, y)) && open(x, y + 1) && lv.tileSolid(x - 1, y))) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < lv.w - 1 && skyLike(lv.tile(x1 + 1, y)) && open(x1 + 1, y + 1)) x1++;
      if (lv.tileSolid(x1 + 1, y) && x1 - x <= 8) {
        let d = 1;
        const mid = (x + x1) >> 1;
        while (d < 14 && !lv.tileSolid(mid, y + d) && !isLiquidType(lv.tile(mid, y + d))) d++;
        amb.shafts.push({ x0: x * TILE, x1: (x1 + 1) * TILE, top: (y + 1) * TILE, h: (d - 1) * TILE, slant: 0.28 });
      }
      x = x1 + 1;
    }
  }
  for (const w of amb.windows) amb.shafts.push({ x0: w.x - 5, x1: w.x + 5, top: w.y, h: 70, slant: 0.5 });
  amb.shaftCol = A.shaft;
  // поверхности лавы, слизи и Пустоты: над ними дымка и искры
  amb.fogs = [];
  for (let y = 1; y < lv.h - 1; y++) {
    let x = 0;
    while (x < lv.w) {
      const t = lv.tile(x, y);
      const kind = t === T.LAVA ? 'lava' : t === T.SLIME ? 'slime' : t === T.VOID ? 'void' : null;
      const above = lv.tile(x, y - 1);
      if (!kind || above === t || isSolidType(above)) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < lv.w && lv.tile(x1 + 1, y) === t && lv.tile(x1 + 1, y - 1) !== t && !isSolidType(lv.tile(x1 + 1, y - 1))) x1++;
      amb.fogs.push({ x0: x * TILE, x1: (x1 + 1) * TILE, y: y * TILE, kind });
      x = x1 + 1;
    }
  }
  // где капля упадёт: первая твёрдая клетка или жидкость под сталактитом
  for (const d of amb.drips) {
    let ty = Math.floor(d.y / TILE) + 1;
    while (ty < lv.h && !lv.tileSolid(Math.floor(d.x / TILE), ty) && !isLiquidType(lv.tile(Math.floor(d.x / TILE), ty))) ty++;
    d.floor = ty * TILE;
    d.t = hash2(d.x, d.y, 3) * 3;
  }
  for (const v of amb.vents) v.t = hash2(v.x, v.y, 4) * 2;
  // передний план: цепи, клетки, балки и колонны ближе к зрителю (см. foreground.js)
  prepareForeground(lv, A);
}

// Частицы атмосферы рождаются только рядом с камерой.
function updateAmbience(lv, dt, cam, vw, vh) {
  const amb = lv.amb;
  if (!amb || !amb.fogs) return;
  updateForeground(lv, dt, cam, vw, vh);
  const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m;
  for (const f of amb.fogs) {
    if (f.x1 < cam.x - 20 || f.x0 > cam.x + vw + 20 || f.y < cam.y - 20 || f.y > cam.y + vh + 40) continue;
    const w = Math.min(f.x1, cam.x + vw) - Math.max(f.x0, cam.x);
    if (w <= 0) continue;
    const rate = f.kind === 'lava' ? 0.05 : f.kind === 'void' ? 0.025 : 0.012;
    if (Math.random() < rate * dt * w) {
      const x = Math.max(f.x0, cam.x) + Math.random() * w;
      if (f.kind === 'lava') FX.add({ kind: 'spark', x, y: f.y - 1, vx: rand(-12, 12), vy: rand(-70, -30), life: rand(0.8, 1.6), max: 1.6, size: 1, col: pick(['#ffb040', '#ff7020', '#ffe080']), grav: -8, bright: true });
      else if (f.kind === 'void') FX.add({ kind: 'spark', x, y: f.y + 2, vx: rand(-6, 6), vy: rand(-26, -10), life: rand(1.2, 2.4), max: 2.4, size: 1, col: pick(['#8070ff', '#60d0ff', '#c0a0ff']), grav: -4, bright: true });
      else FX.add({ kind: 'smoke', x, y: f.y - 2, vx: rand(-5, 5), vy: rand(-12, -5), life: 1.4, max: 1.4, size: 4, col: '#6a9a30', grav: 0 });
    }
  }
  for (const d of amb.drips) {
    if (!inView(d.x, d.y, 60)) continue;
    d.t -= dt;
    if (d.t > 0) continue;
    d.t = 1.6 + hash2(d.x, Math.floor(Game.time), 5) * 3;
    const fall = d.floor - d.y, life = Math.sqrt(2 * fall / 600);
    FX.add({ kind: 'spark', x: d.x, y: d.y, vx: 0, vy: 0, life, max: 3, size: 1, col: '#9ac8e0', grav: 600 });
    Game.later(life, () => Sound.play('drip', d.x, d.floor, { vol: 0.6, gap: 0.04, p: d.floor - d.y > 120 ? 0.85 : 1.1 }));
  }
  if (lv.theme === 'base') {
    for (const v of amb.vents) {
      if (!inView(v.x, v.y)) continue;
      v.t -= dt;
      if (v.t > 0) continue;
      v.t = 0.25 + Math.random() * 0.35;
      FX.add({ kind: 'smoke', x: v.x + rand(-3, 3), y: v.y, vx: rand(-4, 4), vy: rand(-22, -12), life: 1.6, max: 1.6, size: 4, col: '#8a8a88', grav: -4 });
    }
  }
  // пылинки в столбах света
  for (const s of amb.shafts) {
    if (!inView(s.x0, s.top + s.h / 2, 80)) continue;
    if (Math.random() < dt * (s.x1 - s.x0) * 0.04) {
      const k = Math.random();
      FX.add({ kind: 'spark', x: lerp(s.x0, s.x1, Math.random()) + s.h * k * s.slant, y: s.top + s.h * k, vx: rand(-4, 4), vy: rand(-3, 5), life: rand(1.5, 3), max: 3, size: 1, col: 'rgba(255,245,215,0.55)', grav: 0, bright: true });
    }
  }
}

// Столбы света (яркий проход): косые полосы с мягким затуханием книзу.
function drawShafts(ctx, lv, cam, vw, vh, t) {
  const amb = lv.amb;
  // на тёмном уровне снаружи света нет
  if (!amb || !amb.shafts || !amb.shafts.length || lv.def.dark) return;
  const [r, g, b] = amb.shaftCol;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of amb.shafts) {
    const x0 = s.x0 - cam.x, x1 = s.x1 - cam.x, y0 = s.top - cam.y, dx = s.h * s.slant;
    if (Math.max(x1, x1 + dx) < -10 || Math.min(x0, x0 + dx) > vw + 10 || y0 > vh || y0 + s.h < 0) continue;
    const a = 0.16 + Math.sin(t * 0.7 + s.x0 * 0.01) * 0.03;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + s.h);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1 + dx + 6, y0 + s.h); ctx.lineTo(x0 + dx - 6, y0 + s.h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Дымка над лавой (светится), слизью и Пустотой: волнистые полупрозрачные языки.
function drawFog(ctx, lv, cam, vw, vh, t) {
  const amb = lv.amb;
  if (!amb || !amb.fogs) return;
  for (const f of amb.fogs) {
    const sx0 = Math.max(f.x0, cam.x - 4), sx1 = Math.min(f.x1, cam.x + vw + 4);
    const y = f.y - cam.y;
    if (sx1 <= sx0 || y < -30 || y > vh + 30) continue;
    const lava = f.kind === 'lava', voidF = f.kind === 'void';
    ctx.save();
    if (lava) ctx.globalCompositeOperation = 'lighter';
    const layers = lava ? [['#ff5a08', 0.1, 26], ['#ff8a20', 0.1, 13], ['#ffd060', 0.08, 5]] : voidF ? [['#3a2a80', 0.2, 18], ['#6a60d0', 0.1, 8]] : [['#4a7a18', 0.16, 12], ['#8ac030', 0.08, 5]];
    for (const [col, a, hgt] of layers) {
      ctx.fillStyle = col;
      ctx.globalAlpha = a;
      for (let x = Math.floor(sx0 / 2) * 2; x < sx1; x += 2) {
        const h = hgt * (0.6 + 0.4 * Math.sin(x * 0.05 + t * 1.3) * Math.sin(x * 0.021 - t * 0.7));
        ctx.fillRect(Math.round(x - cam.x), Math.round(y - h), 2, Math.ceil(h) + 1);
      }
    }
    ctx.restore();
  }
}

// Виньетка: мягкое затемнение к краям кадра (готовится под размер вида).
let vignette = null;
function drawVignette(ctx, vw, vh) {
  if (!vignette || vignette.width !== vw || vignette.height !== vh) {
    vignette = makeCanvas(vw, vh);
    const c = vignette.getContext('2d');
    const g = c.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.58);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g; c.fillRect(0, 0, vw, vh);
  }
  ctx.drawImage(vignette, 0, 0);
}

