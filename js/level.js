'use strict';
// Уровень: разбор ASCII-карты, двери/решётки/тайники, коллизии, лучи, запекание текстур и света.

// DECO — фоновая архитектура (колонны, арки, контрфорсы): рисуется, но не мешает движению.
const T = { EMPTY: 0, WALL: 1, WALL2: 2, PLAT: 3, WATER: 4, LAVA: 5, SLIME: 6, SKY: 7, VOID: 8, DECO: 9 };
const TILE_CHARS = { ' ': T.EMPTY, '#': T.WALL, '%': T.WALL2, '-': T.PLAT, '~': T.WATER, '!': T.LAVA, ';': T.SLIME, ',': T.SKY, '.': T.VOID, I: T.DECO };
const skyLike = (t) => t === T.SKY || t === T.VOID;
const PLANK = 6;   // толщина доски платформы в пикселях
const MOVER_CHARS = { D: 'door', '[': 'silver', ']': 'gold', '=': 'gate', $: 'secret' };
const LIQUID_NAMES = { [T.WATER]: 'water', [T.LAVA]: 'lava', [T.SLIME]: 'slime' };

function isSolidType(t) { return t === T.WALL || t === T.WALL2; }
function isLiquidType(t) { return t === T.WATER || t === T.LAVA || t === T.SLIME; }

class Mover {
  constructor(kind, tx0, ty0, tx1, ty1) {
    this.kind = kind;
    this.x = tx0 * TILE; this.y = ty0 * TILE;
    this.w = (tx1 - tx0 + 1) * TILE; this.h = (ty1 - ty0 + 1) * TILE;
    this.open = 0; this.target = 0;
    this.solid = true;
    this.waitT = 0;
    this.moving = false;
    this.locked = kind === 'silver' || kind === 'gold';
    this.speed = kind === 'secret' ? 0.7 : kind === 'gate' ? 0.8 : 1.7;
    this.found = false;
  }
  rect() {
    const vis = this.h * (1 - this.open);
    if (this.kind === 'secret') return { x: this.x, y: this.y + this.h - vis, w: this.w, h: vis };
    return { x: this.x, y: this.y, w: this.w, h: vis };
  }
}

class Box {
  constructor(tx, ty) {
    this.kind = 'box';
    this.x = tx * TILE + 1; this.y = ty * TILE + 2; this.w = 14; this.h = 14;
    this.solid = true;
    this.health = 20;
    this.isBox = true;
  }
  rect() { return this; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  takeDamage(dmg, attacker) {
    if (!this.solid) return;
    this.health -= dmg;
    if (this.health <= 0) {
      this.solid = false;
      // взрыв с маленькой задержкой, чтобы цепные реакции выглядели эффектно
      Game.later(0.08, () => {
        const lv = Game.level;
        lv.solids = lv.solids.filter((s) => s !== this);
        explode(this.cx, this.cy, 160, 72, attacker || null, null);
        for (let i = 0; i < 8; i++) FX.debris(this.cx, this.cy, '#6a4a2a');
      });
    }
  }
}

// Лифт: движущаяся односторонняя платформа, ездит между стартом ('_') и отметкой (':').
// Лифт ездит между двумя остановками по вызову, как в Quake: встал на него —
// через полсекунды поехал; пульты на остановках вызывают его или отправляют.
class Lift {
  constructor(tx, ty, len, ex, ey) {
    this.x0 = tx * TILE; this.y0 = ty * TILE;
    this.x1 = ex * TILE; this.y1 = ey * TILE;
    this.w = len * TILE; this.h = 7;
    this.x = this.x0; this.y = this.y0;
    this.dx = 0; this.dy = 0;
    this.t = 0; this.goal = 0; this.wait = 0;
    this.moving = false;
    this.riderT = 0; this.armed = true;
    this.vertical = this.x0 === this.x1;
    this.dur = Math.max(0.6, dist(this.x0, this.y0, this.x1, this.y1) / 58);
  }
  get idle() { return !this.moving && this.wait <= 0 && this.t === this.goal; }
  // Отправить к остановке s (0 — где лифт стоит на карте, 1 — куда он ходит).
  send(s, delay = 0.4) {
    if (this.goal === s && (this.moving || this.wait > 0 || this.t === s)) return false;
    this.goal = s;
    this.wait = this.moving ? 0 : delay;
    return true;
  }
  update(dt) {
    const px = this.x, py = this.y;
    if (this.t !== this.goal) {
      if (this.wait > 0) {
        this.wait -= dt;
        if (this.wait <= 0) { this.moving = true; Sound.play('lift', this.x + this.w / 2, this.y); }
      } else {
        this.moving = true;
        const dir = this.goal > this.t ? 1 : -1;
        this.t = clamp(this.t + dir * dt / this.dur, 0, 1);
        if (this.t === this.goal) {
          this.moving = false;
          Sound.play('door', this.x + this.w / 2, this.y, { vol: 0.5 });
        }
      }
    } else this.wait = 0;
    const k = this.t * this.t * (3 - 2 * this.t);
    this.x = lerp(this.x0, this.x1, k);
    this.y = lerp(this.y0, this.y1, k);
    this.dx = this.x - px; this.dy = this.y - py;
  }
}

// Давилка: тяжёлый блок '|' падает до пола, давит всех под собой и медленно поднимается обратно.
class Crusher {
  constructor(x0, y0, x1, y1, level) {
    this.kind = 'crusher';
    this.x = x0 * TILE; this.baseY = y0 * TILE; this.y = this.baseY;
    this.w = (x1 - x0 + 1) * TILE; this.h = (y1 - y0 + 1) * TILE;
    let ty = y1 + 1;
    const rowSolid = (r) => { for (let x = x0; x <= x1; x++) if (level.tileSolid(x, r)) return true; return false; };
    while (ty < level.h && !rowSolid(ty)) ty++;
    this.maxY = ty * TILE - this.h;
    this.solid = true;
    this.state = 'up';
    this.t = 0.6 + hash2(x0, y0, 3) * 1.4;
  }
  rect() { return this; }
  update(dt) {
    switch (this.state) {
      case 'up':
        this.t -= dt;
        if (this.t <= 0) this.state = 'down';
        break;
      case 'down': {
        const ny = Math.min(this.maxY, this.y + 330 * dt);
        const box = { x: this.x, y: ny, w: this.w, h: this.h };
        const victims = [];
        if (Game.player && Game.player.alive && overlap(box, Game.player)) victims.push(Game.player);
        for (const m of Game.monsters) if (m.alive && !m.def.boss && overlap(box, m)) victims.push(m);
        if (victims.length) {
          for (const v of victims) {
            applyDamage(v, 35, null, 'crush', 0, 60);
            FX.blood(v.cx, v.y, 0, 1, 14, 2);
          }
          Sound.play('axehit', this.x + this.w / 2, ny + this.h);
          Sound.play('splat', this.x + this.w / 2, ny + this.h);
          this.state = 'rise';
          break;
        }
        this.y = ny;
        if (this.y >= this.maxY) {
          this.state = 'wait'; this.t = 0.5;
          Sound.play('crush', this.x + this.w / 2, this.y + this.h);
          Game.shake(this.x + this.w / 2, this.y + this.h, 4);
          for (let i = 0; i < 8; i++) FX.add({ kind: 'smoke', x: this.x + rand(0, this.w), y: this.y + this.h - 2, vx: rand(-30, 30), vy: rand(-30, -5), life: 0.6, max: 0.6, size: 3, col: '#5a5048', grav: -10 });
        }
        break;
      }
      case 'wait':
        this.t -= dt;
        if (this.t <= 0) this.state = 'rise';
        break;
      case 'rise':
        this.y = Math.max(this.baseY, this.y - 75 * dt);
        if (this.y <= this.baseY) { this.state = 'up'; this.t = 1.4; }
        break;
      default: break;
    }
  }
}

const JUMP_PAD_VEL = 670;

const SCORCH_LIFE = 30;   // секунд до полного исчезновения копоти

class Level {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.theme = def.theme || 'base';
    const rows = def.map;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    const grid = rows.map((r) => r.padEnd(this.w, '#'));
    this.grid = grid;
    this.tiles = new Uint8Array(this.w * this.h);
    this.spawns = [];
    this.movers = [];
    this.buttons = [];
    this.teleports = [];
    this.exits = [];
    this.decor = [];
    this.lifts = [];
    this.crushers = [];
    this.jumpPads = [];
    this.hasSky = false;
    this.hasLiquid = false;
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;

    const moverMark = new Array(this.w * this.h).fill(null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = grid[y][x];
        let t;
        if (ch in TILE_CHARS) t = TILE_CHARS[ch];
        else if (ch in MOVER_CHARS) { t = this.inheritTile(grid, x, y, true); moverMark[y * this.w + x] = ch; }
        else { t = this.inheritTile(grid, x, y); this.spawns.push({ ch, tx: x, ty: y }); }
        this.tiles[y * this.w + x] = t;
        if (skyLike(t)) this.hasSky = true;
        if (t === T.VOID) this.hasVoid = true;
        if (isLiquidType(t)) this.hasLiquid = true;
      }
    }
    this.horizon = this.findHorizon();
    // группировка соседних клеток дверей в один объект
    const seen = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const ch = moverMark[i];
        if (!ch || seen[i]) continue;
        let x0 = x, x1 = x, y0 = y, y1 = y;
        const stack = [[x, y]];
        seen[i] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const ni = ny * this.w + nx;
            if (!seen[ni] && moverMark[ni] === ch) { seen[ni] = 1; stack.push([nx, ny]); }
          }
        }
        this.movers.push(new Mover(MOVER_CHARS[ch], x0, y0, x1, y1));
      }
    }
    this.moverMark = moverMark;
    this.explored = new Uint8Array(this.w * this.h);
    this.mapCanvas = makeCanvas(this.w, this.h);
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.mapImg = this.mapCtx.createImageData(this.w, this.h);
    this.mapDirty = false;
    this.solids = this.movers.slice();
    this.totalSecrets = this.movers.filter((m) => m.kind === 'secret').length;

    // статические объекты уровня
    const dests = [];
    const srcs = [];
    for (const s of this.spawns) {
      const px = s.tx * TILE, py = s.ty * TILE;
      switch (s.ch) {
        case 'x': this.solids.push(new Box(s.tx, s.ty)); break;
        case 'b': this.buttons.push({ x: px + 2, y: py + 2, w: 12, h: 12, pressed: false, resetT: 0 }); break;
        case '>': srcs.push({ x: px + 2, y: py - 16, w: 12, h: 30, cx: px + 8, bottom: py + TILE }); break;
        case '<': dests.push({ x: px + 8, y: py + TILE }); break;
        case 'E': this.exits.push({ x: px + 2, y: py - 16, w: 12, h: 30, cx: px + 8, bottom: py + TILE, skill: null }); break;
        // секретный слипгейт — на секретный уровень эпизода
        case 'Z': this.exits.push({ x: px + 2, y: py - 16, w: 12, h: 30, cx: px + 8, bottom: py + TILE, skill: null, secret: true }); break;
        case 'L': this.decor.push({ kind: 'torch', x: px + 8, y: py + 8 }); break;
        case '*': this.decor.push({ kind: 'lamp', x: px + 8, y: py + 4 }); break;
        case '@': this.decor.push({ kind: 'electrode', x: px + 8, y: py + TILE }); break;
        case '&': this.decor.push({ kind: 'checkpoint', x: px + 8, y: py + TILE, active: false }); break;
        case '^': this.jumpPads.push({ x: px + 1, y: py + TILE - 4, w: 14, h: 4, tx: s.tx, ty: s.ty }); break;
        default: break;
      }
    }
    // лифты: горизонтальные отрезки '_' и ближайшая отметка ':' в том же столбце или ряду
    // давилки: связные группы клеток '|'
    const crushSet = new Set(this.spawns.filter((s) => s.ch === '|').map((s) => s.ty * this.w + s.tx));
    for (const key of [...crushSet]) {
      if (!crushSet.has(key)) continue;
      let x0 = key % this.w, x1 = x0, y0 = Math.floor(key / this.w), y1 = y0;
      const st = [key];
      crushSet.delete(key);
      while (st.length) {
        const k = st.pop();
        const cx = k % this.w, cy = Math.floor(k / this.w);
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const nk of [k + 1, k - 1, k + this.w, k - this.w]) if (crushSet.has(nk)) { crushSet.delete(nk); st.push(nk); }
      }
      const c = new Crusher(x0, y0, x1, y1, this);
      this.crushers.push(c);
      this.solids.push(c);
    }
    const runs = this.spawns.filter((s) => s.ch === '_').sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    const marks = this.spawns.filter((s) => s.ch === ':');
    for (let i = 0; i < runs.length;) {
      let j = i;
      while (j + 1 < runs.length && runs[j + 1].ty === runs[i].ty && runs[j + 1].tx === runs[j].tx + 1) j++;
      const r = runs[i], len = j - i + 1;
      let best = null, bd = Infinity;
      for (const m of marks) {
        if (m.used || (m.tx !== r.tx && m.ty !== r.ty)) continue;
        const d = Math.abs(m.tx - r.tx) + Math.abs(m.ty - r.ty);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) best.used = true;
      this.lifts.push(new Lift(r.tx, r.ty, len, best ? best.tx : r.tx, best ? best.ty : r.ty));
      i = j + 1;
    }
    this.placeLiftButtons();
    srcs.forEach((s, i) => {
      s.dest = dests[i] || dests[0] || { x: s.cx, y: s.bottom };
      this.teleports.push(s);
    });
    if (def.skillPortals) this.exits.forEach((e, i) => { e.skill = def.skillPortals[i]; });
    if (def.exitAfterBoss) this.exits.forEach((e) => { if (!e.secret) e.hidden = true; });
    this.computeHidden();
  }

  // Пульт вызова на каждой остановке лифта, где есть площадка: стойка рядом с лифтом
  // на том же полу. Касание или выстрел вызывает лифт или отправляет его.
  placeLiftButtons() {
    this.liftButtons = [];
    for (const lf of this.lifts) {
      for (const s of [0, 1]) {
        const sx = s ? lf.x1 : lf.x0, sy = s ? lf.y1 : lf.y0;
        if (s === 1 && sx === lf.x0 && sy === lf.y0) continue;
        const row0 = Math.round(sy / TILE);
        const left = Math.floor(sx / TILE) - 1, right = Math.floor((sx + lf.w - 1) / TILE) + 1;
        let placed = false;
        // площадка рядом с остановкой: пол на уровне лифта, на клетку выше или до двух ниже
        for (const [c, side] of [[left, -1], [right, 1], [left - 1, -1], [right + 1, 1]]) {
          for (const row of [row0, row0 + 1, row0 - 1, row0 + 2]) {
            const stand = row - 1;
            if (this.tileSolid(c, stand) || this.tileSolid(c, stand - 1)) continue;
            const t = this.tile(c, row);
            if (!isSolidType(t) && t !== T.PLAT) continue;
            if (this.liquidAt(c * TILE + 8, stand * TILE + 8)) continue;
            this.liftButtons.push({ lift: lf, stop: s, side, x: c * TILE + 3, y: row * TILE - 18, w: 10, h: 18, flash: 0, cool: 0 });
            placed = true;
            break;
          }
          if (placed) break;
        }
        // поставить пульт негде — лифт сам приедет, когда герой подойдёт к этой остановке
        if (!placed) (lf.autoStops = lf.autoStops || []).push(s);
      }
    }
  }

  pressLiftButton(b) {
    if (b.cool > 0) return;
    const lf = b.lift;
    b.flash = 0.35; b.cool = 0.8;
    Sound.play('button', b.x + 5, b.y);
    const p = Game.player;
    if (lf.t === b.stop && !lf.moving) {
      // лифт уже здесь: если герой на нём — отправляем, иначе он ждёт
      if (p && p.lift === lf) { lf.send(1 - b.stop, 0.25); lf.armed = false; }
      return;
    }
    if (lf.send(b.stop, 0.15)) HUD.message('Лифт вызван');
  }

  updateLifts(dt) {
    const p = Game.player;
    for (const lf of this.lifts) {
      lf.update(dt);
      const on = p && p.alive && p.lift === lf;
      // встал на стоящий лифт — через полсекунды он едет на другую остановку
      if (on && lf.idle && lf.armed) {
        lf.riderT += dt;
        if (lf.riderT > 0.5) { lf.send(1 - lf.goal, 0); lf.armed = false; lf.riderT = 0; }
      } else lf.riderT = 0;
      if (!on && lf.idle) lf.armed = true;
      if (lf.autoStops && p && p.alive && !on && lf.idle) {
        for (const st of lf.autoStops) {
          if (lf.t === st) continue;
          const sx = (st ? lf.x1 : lf.x0) + lf.w / 2, sy = st ? lf.y1 : lf.y0;
          if (Math.abs(p.cx - sx) < lf.w / 2 + 40 && Math.abs(p.y + p.h - sy) < 40) lf.send(st, 0.3);
        }
      }
    }
    for (const b of this.liftButtons) {
      b.flash -= dt; b.cool -= dt;
      if (p && p.alive && overlap(p, { x: b.x - 3, y: b.y, w: b.w + 6, h: b.h })) this.pressLiftButton(b);
    }
  }

  // Комнаты, куда можно попасть только через тайник, скрыты стеной, пока тайник не открыт.
  computeHidden() {
    const W = this.w, H = this.h;
    this.hidden = new Int16Array(W * H).fill(-1);
    this.hiddenCells = [];
    const secretAt = new Int16Array(W * H).fill(-1);
    this.movers.forEach((m, i) => {
      if (m.kind !== 'secret') return;
      for (let y = m.y / TILE; y < (m.y + m.h) / TILE; y++) for (let x = m.x / TILE; x < (m.x + m.w) / TILE; x++) secretAt[y * W + x] = i;
    });
    const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !isSolidType(this.tiles[y * W + x]);
    const main = new Uint8Array(W * H);
    const stack = [];
    for (const s of this.spawns) if (s.ch === 'P' || s.ch === '<') { main[s.ty * W + s.tx] = 1; stack.push([s.tx, s.ty]); }
    if (!stack.length) return;
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy, ni = ny * W + nx;
        if (open(nx, ny) && !main[ni] && secretAt[ni] < 0) { main[ni] = 1; stack.push([nx, ny]); }
      }
    }
    this.movers.forEach((m, i) => {
      if (m.kind !== 'secret') return;
      const st = [];
      for (let y = m.y / TILE; y < (m.y + m.h) / TILE; y++) for (let x = m.x / TILE; x < (m.x + m.w) / TILE; x++) st.push([x, y]);
      while (st.length) {
        const [x, y] = st.pop();
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy, ni = ny * W + nx;
          if (open(nx, ny) && !main[ni] && secretAt[ni] < 0 && this.hidden[ni] < 0) {
            this.hidden[ni] = i;
            this.hiddenCells.push({ x: nx, y: ny, i });
            st.push([nx, ny]);
          }
        }
      }
    });
  }

  // Карта уровня (Tab): открываем клетки, попавшие в кадр.
  reveal(tx0, ty0, tx1, ty1) {
    tx0 = Math.max(0, tx0); ty0 = Math.max(0, ty0);
    tx1 = Math.min(this.w - 1, tx1); ty1 = Math.min(this.h - 1, ty1);
    const d = this.mapImg.data;
    const MOVER_COL = { D: [200, 160, 64], '[': [200, 208, 220], ']': [232, 184, 48], '=': [130, 130, 150] };
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * this.w + x;
        if (this.explored[i]) continue;
        if (this.hidden[i] >= 0 && this.movers[this.hidden[i]].open < 0.3) continue;
        this.explored[i] = 1;
        const t = this.tiles[i];
        const mk = this.moverMark[i];
        let c;
        if (mk && MOVER_COL[mk]) c = MOVER_COL[mk];
        else if (mk === '$' && this.movers.find((m) => m.kind === 'secret' && m.found && x * TILE >= m.x && x * TILE < m.x + m.w && y * TILE >= m.y && y * TILE < m.y + m.h)) c = [60, 40, 28];
        else if (isSolidType(t) || mk === '$') c = [118, 92, 62];
        else if (t === T.WATER) c = [40, 90, 140];
        else if (t === T.SLIME) c = [70, 130, 40];
        else if (t === T.LAVA) c = [230, 90, 20];
        else if (t === T.PLAT) c = [150, 120, 80];
        else if (t === T.SKY) c = [44, 36, 78];
        else if (t === T.VOID) c = [12, 6, 26];
        else if (t === T.DECO) c = [44, 32, 24];
        else c = [34, 24, 18];
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
        this.mapDirty = true;
      }
    }
  }

  drawMap(ctx, x, y, scale) {
    if (this.mapDirty) { this.mapCtx.putImageData(this.mapImg, 0, 0); this.mapDirty = false; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapCanvas, x, y, this.w * scale, this.h * scale);
  }

  // Светильнику не к чему крепиться: вокруг ни стены, ни колонны.
  decorFree(d) {
    const tx = Math.floor(d.x / TILE), ty = Math.floor((d.y - 1) / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = this.tile(tx + dx, ty + dy);
      if (isSolidType(t) || t === T.DECO) return false;
    }
    return true;
  }

  // Индекс тайника, за которым точка (или -1), — неважно, открыт он или нет.
  secretIndexAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (!this.hidden || tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return -1;
    return this.hidden[ty * this.w + tx];
  }

  isHiddenAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const i = this.hidden[ty * this.w + tx];
    return i >= 0 && this.movers[i].open < 0.3;
  }

  // Маскировка тайников: та же стена с теми же крупными пятнами, что и вокруг, —
  // чтобы закрытая комната не читалась плоским прямоугольником.
  bakeCovers(tex, blot, bw, bh) {
    this.covers = [];
    const by = new Map();
    for (const c of this.hiddenCells) {
      let b = by.get(c.i);
      if (!b) by.set(c.i, b = { i: c.i, x0: c.x, y0: c.y, x1: c.x, y1: c.y, cells: [] });
      b.x0 = Math.min(b.x0, c.x); b.y0 = Math.min(b.y0, c.y); b.x1 = Math.max(b.x1, c.x); b.y1 = Math.max(b.y1, c.y);
      b.cells.push(c);
    }
    for (const b of by.values()) {
      const cv = makeCanvas((b.x1 - b.x0 + 1) * TILE, (b.y1 - b.y0 + 1) * TILE);
      const g = cv.getContext('2d');
      for (const c of b.cells) g.drawImage(tex.wall, (c.x % 4) * TILE, (c.y % 4) * TILE, TILE, TILE, (c.x - b.x0) * TILE, (c.y - b.y0) * TILE, TILE, TILE);
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.imageSmoothingEnabled = true;
      g.drawImage(blot, -b.x0 * TILE, -b.y0 * TILE, bw * TILE * 3, bh * TILE * 3);
      g.restore();
      this.covers.push({ i: b.i, x: b.x0 * TILE, y: b.y0 * TILE, canvas: cv });
    }
  }

  drawHidden(ctx, cam, vw, vh) {
    if (this.covers) {
      for (const c of this.covers) {
        if (this.movers[c.i].open >= 0.3) continue;
        const x = c.x - cam.x, y = c.y - cam.y;
        if (x > vw || y > vh || x + c.canvas.width < 0 || y + c.canvas.height < 0) continue;
        ctx.drawImage(c.canvas, Math.round(x), Math.round(y));
      }
      return;
    }
    for (const c of this.hiddenCells) {
      if (this.movers[c.i].open >= 0.3) continue;
      const x = c.x * TILE - cam.x, y = c.y * TILE - cam.y;
      if (x < -TILE || y < -TILE || x > vw || y > vh) continue;
      ctx.drawImage(this.tex.wall, (c.x % 4) * TILE, (c.y % 4) * TILE, TILE, TILE, x, y, TILE, TILE);
    }
  }

  // Объект внутри воды/неба сохраняет фон соседей.
  inheritTile(grid, x, y, liquidsOnly = false) {
    const counts = {};
    const around = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of around) {
      if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[ny].length) continue;
      const t = TILE_CHARS[grid[ny][nx]];
      if (t === T.WATER || t === T.LAVA || t === T.SLIME || t === T.VOID || ((t === T.SKY || t === T.DECO) && !liquidsOnly)) counts[t] = (counts[t] || 0) + 1;
    }
    let best = T.EMPTY, bc = 1;
    for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = +k; }
    return best;
  }

  // Платформа на фоне неба (мост на улице) не рисует заднюю стену.
  skyBack(tx, ty) {
    if (this.tile(tx, ty) !== T.PLAT) return false;
    return skyLike(this.tile(tx - 1, ty)) || skyLike(this.tile(tx + 1, ty)) || skyLike(this.tile(tx, ty - 1)) || skyLike(this.tile(tx, ty + 1));
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.WALL;
    return this.tiles[ty * this.w + tx];
  }
  tileSolid(tx, ty) { return isSolidType(this.tile(tx, ty)); }
  tileAtPx(x, y) { return this.tile(Math.floor(x / TILE), Math.floor(y / TILE)); }

  // Куда доходит звук из точки (x, y): обход по открытым клеткам на r пикселей пути.
  // Сквозь стены и закрытые двери звук не идёт, зато огибает углы и проходит
  // коридорами. Возвращает массив расстояний в клетках (-1 — не слышно).
  soundReach(x, y, r) {
    const w = this.w, h = this.h, n = w * h;
    const tx = clamp(Math.floor(x / TILE), 0, w - 1), ty = clamp(Math.floor(y / TILE), 0, h - 1);
    const steps = Math.ceil(r / TILE);
    const key = ty * w + tx + ':' + steps;
    if (this.sound && this.sound.key === key && Game.time - this.sound.t < 0.25) return this.sound.dist;
    if (!this.sound) this.sound = { dist: new Int16Array(n), block: new Uint8Array(n), queue: new Int32Array(n) };
    const S = this.sound, dist = S.dist, block = S.block, q = S.queue;
    dist.fill(-1);
    block.fill(0);
    for (const m of this.movers) {
      if (m.open > 0.5) continue;
      for (let yy = Math.floor(m.y / TILE); yy < Math.ceil((m.y + m.h) / TILE); yy++) {
        for (let xx = Math.floor(m.x / TILE); xx < Math.ceil((m.x + m.w) / TILE); xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) block[yy * w + xx] = 1;
      }
    }
    let head = 0, tail = 0;
    const start = ty * w + tx;
    dist[start] = 0; q[tail++] = start;
    while (head < tail) {
      const i = q[head++], d = dist[i];
      if (d >= steps) continue;
      const cx = i % w;
      for (const j of [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= n || dist[j] >= 0 || block[j] || isSolidType(this.tiles[j])) continue;
        dist[j] = d + 1; q[tail++] = j;
      }
    }
    S.key = key; S.t = Game.time;
    return dist;
  }

  solidAt(x, y) {
    if (this.tileSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
    for (const s of this.solids) {
      if (!s.solid) continue;
      const r = s.rect();
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
    }
    return false;
  }

  liquidAt(x, y) {
    const t = this.tileAtPx(x, y);
    return isLiquidType(t) || t === T.VOID ? t : 0;
  }

  // Бездна: над ней звёзды, по краю — фиолетовая дымка.
  drawVoid(ctx, cam, vw, vh, t) {
    if (!this.hasVoid) return;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE)), tx1 = Math.min(this.w - 1, Math.floor((cam.x + vw) / TILE));
    const ty0 = Math.max(0, Math.floor(cam.y / TILE)), ty1 = Math.min(this.h - 1, Math.floor((cam.y + vh) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.tiles[ty * this.w + tx] !== T.VOID) continue;
        const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
        const surface = this.tile(tx, ty - 1) !== T.VOID;
        ctx.fillStyle = surface ? 'rgba(20,6,40,0.35)' : 'rgba(4,2,12,0.55)';
        ctx.fillRect(x, y, TILE, TILE);
        if (surface) {
          for (let i = 0; i < TILE; i += 2) {
            const h = 3 + Math.sin(t * 2 + (tx * TILE + i) * 0.21) * 2 + Math.sin(t * 3.3 + (tx * TILE + i) * 0.07) * 1.5;
            ctx.fillStyle = 'rgba(150,90,255,0.35)';
            ctx.fillRect(x + i, y + 6 - h, 2, h + 4);
          }
        }
      }
    }
  }

  boxFree(x, y, w, h) {
    const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - 0.01) / TILE);
    const ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.tileSolid(tx, ty)) return false;
    const b = { x, y, w, h };
    for (const s of this.solids) if (s.solid && overlap(b, s.rect())) return false;
    return true;
  }

  // Луч по тайлам (DDA) + динамические препятствия. plats — доски платформ тоже
  // останавливают луч (выстрелы и снаряды: пуля не проходит сквозь доску).
  rayCast(x0, y0, x1, y1, ignoreSolids = false, plats = false) {
    const dx = x1 - x0, dy = y1 - y0;
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx > 0 ? ((tx + 1) * TILE - x0) / dx : dx < 0 ? (tx * TILE - x0) / dx : Infinity;
    let tMaxY = dy > 0 ? ((ty + 1) * TILE - y0) / dy : dy < 0 ? (ty * TILE - y0) / dy : Infinity;
    let hitT = 1, nx = 0, ny = 0, hit = false;
    // доска — полоса PLANK у верха клетки платформы, как она нарисована
    const plank = (cx, cy) => {
      if (!plats || this.tile(cx, cy) !== T.PLAT) return false;
      const t = rayBox(x0, y0, dx, dy, cx * TILE, cy * TILE, TILE, PLANK);
      if (t < 0 || t > 1) return false;
      hitT = t; nx = 0; ny = dy > 0 ? -1 : 1; hit = true;
      return true;
    };
    if (this.tileSolid(tx, ty)) { hitT = 0; hit = true; }
    else if (!plank(tx, ty)) {
      for (let guard = 0; guard < 4000; guard++) {
        let t, cnx, cny;
        if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; cnx = -stepX; cny = 0; }
        else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; cnx = 0; cny = -stepY; }
        if (t > 1) break;
        if (this.tileSolid(tx, ty)) { hitT = t; nx = cnx; ny = cny; hit = true; break; }
        if (plank(tx, ty)) break;
      }
    }
    let solid = null;
    if (!ignoreSolids) {
      for (const s of this.solids) {
        if (!s.solid) continue;
        const r = s.rect();
        const t = rayBox(x0, y0, dx, dy, r.x, r.y, r.w, r.h);
        if (t >= 0 && t < hitT) {
          hitT = t; hit = true; solid = s;
          const hx = x0 + dx * t, hy = y0 + dy * t;
          if (Math.abs(hx - r.x) < 0.5) { nx = -1; ny = 0; }
          else if (Math.abs(hx - (r.x + r.w)) < 0.5) { nx = 1; ny = 0; }
          else if (Math.abs(hy - r.y) < 0.5) { nx = 0; ny = -1; }
          else { nx = 0; ny = 1; }
        }
      }
    }
    return { hit, t: hitT, x: x0 + dx * hitT, y: y0 + dy * hitT, nx, ny, solid };
  }

  los(x0, y0, x1, y1) { return !this.rayCast(x0, y0, x1, y1).hit; }

  // --- логика дверей, кнопок и тайников ---
  update(dt) {
    const p = Game.player;
    this.updateScorches(dt);
    this.updateLifts(dt);
    for (const c of this.crushers) c.update(dt);
    for (const m of this.movers) {
      if (m.kind === 'door' || m.kind === 'silver' || m.kind === 'gold') {
        const nearP = p && p.alive && p.x + p.w > m.x - 18 && p.x < m.x + m.w + 18 && p.y + p.h > m.y - 2 && p.y < m.y + m.h + 2;
        if (m.locked) {
          if (nearP) {
            const need = m.kind === 'silver' ? 'silver' : 'gold';
            if (p.keys[need]) {
              m.locked = false; m.target = 1;
              HUD.message(need === 'silver' ? 'Серебряный ключ открыл дверь' : 'Золотой ключ открыл дверь');
            } else if (p.x + p.w > m.x - 3 && p.x < m.x + m.w + 3) {
              const where = Input.touchMode || !Input.binds.map.length ? 'Он отмечен на карте' : 'Он отмечен на карте (' + keyName(Input.binds.map[0]) + ')';
              HUD.center((need === 'silver' ? 'Нужен серебряный ключ' : 'Нужен золотой ключ') + '\n' + where, 2);
            }
          }
        } else if (m.kind === 'door') {
          let near = nearP;
          if (!near) {
            for (const mon of Game.monsters) {
              if (!mon.alive || !mon.target) continue;
              if (mon.x + mon.w > m.x - 12 && mon.x < m.x + m.w + 12 && mon.y + mon.h > m.y && mon.y < m.y + m.h) { near = true; break; }
            }
          }
          if (near) { m.target = 1; m.waitT = 2.5; }
          else if (m.target === 1) { m.waitT -= dt; if (m.waitT <= 0) m.target = 0; }
        }
      }
      if (m.open !== m.target) {
        if (!m.moving) { m.moving = true; Sound.play('door', m.x + m.w / 2, m.y + m.h / 2); }
        const prev = m.open;
        if (m.target > m.open) m.open = Math.min(1, m.open + m.speed * dt);
        else {
          m.open = Math.max(0, m.open - m.speed * dt);
          if (this.moverBlocked(m)) { m.open = prev; m.target = 1; m.waitT = 1; }
        }
        m.solid = m.open < 0.98;
      } else m.moving = false;
    }
    for (const b of this.buttons) {
      if (b.pressed && b.resetT > 0) {
        b.resetT -= dt;
        if (b.resetT <= 0) b.pressed = false;
      }
      if (this.def.altarButtons) { this.chargeAltar(b, p, dt); continue; }
      if (!b.pressed && p && p.alive && overlap(p, b)) this.pressButton(b, true);
    }
  }

  // Алтарь зажигается, если простоять на нём несколько секунд (под огнём Древнего);
  // ушёл — заряд медленно гаснет. Пока Древний не явился, алтари спят.
  chargeAltar(b, p, dt) {
    b.on = false;
    if (b.lit) return;
    const boss = Game.monsters.find((m) => m.type === 'elder' && m.alive);
    const ready = !boss || (boss.state !== 'dormant' && boss.state !== 'intro');
    b.on = !!(ready && p && p.alive && Math.abs(p.cx - (b.x + 6)) < 14 && Math.abs(p.y + p.h - (b.y + 14)) < 16);
    if (b.on) {
      b.charge = (b.charge || 0) + dt / Game.altarTime();
      b.humT = (b.humT || 0) - dt;
      if (b.humT <= 0) { b.humT = 0.3; Sound.play('charge', b.x + 6, b.y, { p: 0.7 + b.charge * 0.8, vol: 0.35, gap: 0.2 }); }
      if (Math.random() < 0.6) FX.add({ kind: 'spark', x: b.x + 6 + rand(-12, 12), y: b.y + 12, vx: rand(-6, 6), vy: rand(-90, -40), life: 0.7, max: 0.7, size: 1, col: '#80f0ff', grav: -20, bright: true });
      if (b.charge >= 1) { b.charge = 1; this.pressButton(b, true); }
    } else b.charge = Math.max(0, (b.charge || 0) - dt * 0.2);
  }

  // Древний вытягивает силу руны: алтарь гаснет, его надо зажечь заново.
  drainAltar(b) {
    b.lit = false; b.pressed = false; b.charge = 0;
  }

  moverBlocked(m) {
    const r = m.rect();
    if (Game.player && Game.player.alive && overlap(Game.player, r)) return true;
    for (const mon of Game.monsters) if (mon.alive && overlap(mon, r)) return true;
    return false;
  }

  pressButton(b, touch = false) {
    if (b.pressed) return;
    // алтарь зажигается только касанием
    if (this.def.altarButtons && !touch) return;
    b.pressed = true;
    Sound.play('button', b.x, b.y);
    if (this.def.altarButtons) {
      b.lit = true;
      Game.onAltarLit(b);
      return;
    }
    if (this.def.bossButtons) {
      b.resetT = 1.5;
      Game.bossStrike(b);
      return;
    }
    let best = null, bd = Infinity;
    for (const m of this.movers) {
      if (m.kind !== 'gate' || m.target === 1) continue;
      const d = dist(b.x, b.y, m.x + m.w / 2, m.y + m.h / 2);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) { best.target = 1; HUD.center('Где-то открылся проход...', 1.5); }
  }

  openAllGates() {
    for (const m of this.movers) if (m.kind === 'gate') m.target = 1;
  }

  openSecret(m) {
    if (m.found) return;
    m.found = true;
    m.target = 1;
    this.lightSecret(this.movers.indexOf(m));
    for (let y = m.y / TILE; y < (m.y + m.h) / TILE; y++) for (let x = m.x / TILE; x < (m.x + m.w) / TILE; x++) this.explored[y * this.w + x] = 0;
    Game.secrets++;
    HUD.center('Вы нашли секретное место!', 2);
    Sound.play('secret');
  }

  // Урон по «объектам мира»: тайники от выстрелов, ящики, кнопки.
  shootSolid(s, dmg, attacker) {
    if (!s) return;
    if (s instanceof Mover && s.kind === 'secret') this.openSecret(s);
    else if (s.isBox) s.takeDamage(dmg, attacker);
  }

  // --- запекание ---
  bake() {
    const tex = Tex.get(this.theme);
    this.tex = tex;
    const W = this.pxW, H = this.pxH;
    this.canvas = makeCanvas(W, H);
    const ctx = this.canvas.getContext('2d');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.tiles[y * this.w + x];
        if (skyLike(t) || this.skyBack(x, y)) continue;
        const src = t === T.WALL || t === T.DECO ? tex.wall : t === T.WALL2 ? tex.wall2 : tex.back;
        ctx.drawImage(src, (x % 4) * TILE, (y % 4) * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
      }
    }
    // фоновая архитектура: колонны получают цилиндрическую светотень, широкие пояса — кромки
    const isDeco = (x, y) => this.tile(x, y) === T.DECO;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!isDeco(x, y) || isDeco(x - 1, y)) continue;
        let x1 = x;
        while (isDeco(x1 + 1, y)) x1++;
        const px = x * TILE, py = y * TILE, pw = (x1 - x + 1) * TILE;
        ctx.drawImage(tex.wall2, 0, (y % 4) * TILE, Math.min(pw, TILE * 4), TILE, px, py, Math.min(pw, TILE * 4), TILE);
        if (pw > TILE * 4) for (let xx = px + TILE * 4; xx < px + pw; xx += TILE * 4) ctx.drawImage(tex.wall2, 0, (y % 4) * TILE, Math.min(TILE * 4, px + pw - xx), TILE, xx, py, Math.min(TILE * 4, px + pw - xx), TILE);
        if (pw <= TILE * 4) {
          const g = ctx.createLinearGradient(px, 0, px + pw, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.35)');
          g.addColorStop(0.3, 'rgba(255,235,200,0.10)');
          g.addColorStop(0.55, 'rgba(0,0,0,0.1)');
          g.addColorStop(1, 'rgba(0,0,0,0.6)');
          ctx.fillStyle = g;
        } else ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px, py, pw, TILE);
        for (let xx = x; xx <= x1; xx++) {
          const qx = xx * TILE;
          if (!isDeco(xx, y - 1) && !this.tileSolid(xx, y - 1)) { ctx.fillStyle = 'rgba(255,235,200,0.25)'; ctx.fillRect(qx, py, TILE, 2); }
          if (!isDeco(xx, y + 1) && !this.tileSolid(xx, y + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(qx, py + TILE - 3, TILE, 3); }
        }
        ctx.fillStyle = 'rgba(255,235,200,0.18)'; ctx.fillRect(px, py, 1, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(px + pw - 2, py, 2, TILE);
      }
    }
    // крупные пятна, чтобы повторение текстур не бросалось в глаза
    const bw = Math.ceil(this.w / 3) + 1, bh = Math.ceil(this.h / 3) + 1;
    const blot = makeCanvas(bw, bh);
    const bctx = blot.getContext('2d');
    const bimg = bctx.createImageData(bw, bh);
    for (let i = 0; i < bw * bh; i++) bimg.data[i * 4 + 3] = hash2(i % bw, Math.floor(i / bw), 5) * 70;
    bctx.putImageData(bimg, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(blot, 0, 0, bw * TILE * 3, bh * TILE * 3);
    ctx.restore();
    this.bakeCovers(tex, blot, bw, bh);

    // клетки тайника для кромок — как камень: иначе кромки соседних стен обведут комнату
    const hid = (x, y) => !!this.hidden && x >= 0 && y >= 0 && x < this.w && y < this.h && this.hidden[y * this.w + x] >= 0;
    const solidOrOut = (x, y) => this.tileSolid(x, y);
    const edgeSolid = (x, y) => this.tileSolid(x, y) || hid(x, y);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.tiles[y * this.w + x];
        const px = x * TILE, py = y * TILE;
        if (isSolidType(t)) {
          // кромка пола сверху (бортик, карниз, дёрн) и тёмный край потолка снизу
          const sx = (x % 4) * TILE;
          if (!edgeSolid(x, y - 1)) ctx.drawImage(tex.trim, sx, 0, TILE, 6, px, py, TILE, 6);
          if (!edgeSolid(x, y + 1)) ctx.drawImage(tex.ceil, sx, 0, TILE, 4, px, py + TILE - 4, TILE, 4);
          if (!edgeSolid(x - 1, y)) { ctx.fillStyle = 'rgba(255,240,210,0.1)'; ctx.fillRect(px, py, 1, TILE); }
          if (!edgeSolid(x + 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + TILE - 1, py, 1, TILE); }
        } else if (!skyLike(t) && !this.skyBack(x, y)) {
          // «ambient occlusion» на задней стене рядом с твёрдыми тайлами
          const sh = (a, fn) => { for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(0,0,0,${a * (3 - i) / 3})`; fn(i); } };
          if (solidOrOut(x, y - 1)) sh(0.35, (i) => ctx.fillRect(px, py + i * 2, TILE, 2));
          if (solidOrOut(x, y + 1)) sh(0.2, (i) => ctx.fillRect(px, py + TILE - 2 - i * 2, TILE, 2));
          if (solidOrOut(x - 1, y)) sh(0.3, (i) => ctx.fillRect(px + i * 2, py, 2, TILE));
          if (solidOrOut(x + 1, y)) sh(0.3, (i) => ctx.fillRect(px + TILE - 2 - i * 2, py, 2, TILE));
        }
        if (t === T.PLAT) this.drawPlatform(ctx, x, y);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (const lf of this.lifts) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const xa = Math.min(lf.x0, lf.x1), xb = Math.max(lf.x0, lf.x1) + lf.w;
      const ya = Math.min(lf.y0, lf.y1), yb = Math.max(lf.y0, lf.y1) + lf.h;
      if (lf.x0 === lf.x1) {
        ctx.fillRect(xa + 3, ya, 2, yb - ya + 4); ctx.fillRect(xb - 5, ya, 2, yb - ya + 4);
      } else ctx.fillRect(xa, ya + 2, xb - xa, 2);
    }
    ctx.restore();
    // толща стен темнеет вглубь: играбельные кромки читаются, повтор текстуры не бросается в глаза
    const depth = new Uint8Array(this.w * this.h);
    let frontier = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.tileSolid(x, y)) depth[y * this.w + x] = 9;
      else frontier.push(x, y);
    }
    for (let d = 1; d <= 4 && frontier.length; d++) {
      const next = [];
      for (let i = 0; i < frontier.length; i += 2) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = frontier[i] + dx, ny = frontier[i + 1] + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const k = ny * this.w + nx;
          if (depth[k] === 9) { depth[k] = d; next.push(nx, ny); }
        }
      }
      frontier = next;
    }
    for (let d = 2; d <= 5; d++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.42, (d - 1) * 0.12)})`;
      for (let i = 0; i < depth.length; i++) {
        const v = depth[i];
        if (v >= 2 && Math.min(v, 5) === d) ctx.fillRect((i % this.w) * TILE, Math.floor(i / this.w) * TILE, TILE, TILE);
      }
    }
    dressLevel(this, ctx);
    prepareAmbience(this);
    for (const d of this.decor) {
      if (d.kind === 'checkpoint') {
        ctx.fillStyle = '#2a2622'; ctx.fillRect(d.x - 6, d.y - 5, 12, 5);
        ctx.fillStyle = '#5a544a'; ctx.fillRect(d.x - 6, d.y - 5, 12, 1);
        ctx.fillStyle = '#3a3630'; ctx.fillRect(d.x - 3, d.y - 19, 6, 14);
        ctx.fillStyle = '#4e4840'; ctx.fillRect(d.x - 3, d.y - 19, 1, 14);
        ctx.fillStyle = '#1a1612'; ctx.fillRect(d.x - 1, d.y - 16, 2, 8);
        continue;
      }
      // огню без опоры (в открытом небе Измерения Древних) держатель не нужен — он парит
      if ((d.kind === 'torch' || d.kind === 'lamp') && this.decorFree(d)) { d.free = true; continue; }
      if (d.kind === 'torch') drawTorchHolder(ctx, d.x, d.y);
      else if (d.kind === 'lamp') drawLampHousing(ctx, d.x, d.y);
    }
    this.bakeLight();
  }

  drawPlatform(ctx, x, y) {
    const px = x * TILE, py = y * TILE;
    ctx.drawImage(this.tex.plat, (x % 4) * TILE, 0, TILE, 6, px, py, TILE, 6);
    // кронштейны на концах полки
    const left = this.tile(x - 1, y) !== T.PLAT, right = this.tile(x + 1, y) !== T.PLAT;
    const br = (bx, dir) => {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, py + 5, 2, 5);
      for (let i = 0; i < 4; i++) ctx.fillRect(bx + dir * (i + 1), py + 6 + i, 1, 1);
      ctx.fillStyle = 'rgba(255,240,210,0.12)'; ctx.fillRect(bx, py + 5, 1, 5);
    };
    if (left) br(px + 2, 1);
    if (right) br(px + TILE - 4, -1);
  }

  // Источники света, запекаемые в карту освещения. Свет из закрытого тайника не
  // запекается: иначе он подсвечивает маскировку и выдаёт комнату. Его добавляем,
  // когда тайник открывают (см. openSecret).
  staticLights() {
    const all = this.allStaticLights();
    this.secretLights = [];
    return all.filter((l) => {
      const i = this.secretIndexAt(l.x, l.y + 6);
      if (i < 0) return true;
      this.secretLights.push(Object.assign(l, { secret: i }));
      return false;
    });
  }

  allStaticLights() {
    const L = [];
    for (const pad of this.jumpPads) L.push({ x: pad.x + 7, y: pad.y - 6, r: 50, c: [0.3, 1, 0.8], i: 0.5 });
    // свет из больших окон: лунный, витражный или адский
    const WIN = { night: [[0.55, 0.65, 1], 0.35], stained: [[0.5, 0.55, 1], 0.5], amber: [[1, 0.72, 0.38], 0.5], hell: [[1, 0.38, 0.15], 0.6] };
    for (const w of this.archWindows || []) { const [c, i] = WIN[w.kind]; L.push({ x: w.x + 24, y: w.y + 50, r: 96, c, i }); }
    for (const f of this.fans || []) L.push({ x: f.x, y: f.y, r: 40, c: [1, 0.75, 0.45], i: 0.3 });
    for (const d of this.decor) {
      if (d.kind === 'torch') L.push({ x: d.x, y: d.y - 4, r: 140, c: [1.0, 0.68, 0.38], i: 1.1 });
      else if (d.kind === 'lamp') L.push({ x: d.x, y: d.y + 3, r: 175, c: [1.0, 0.95, 0.82], i: 1.15 });
      else if (d.kind === 'electrode') L.push({ x: d.x, y: d.y - 30, r: 80, c: [0.6, 0.7, 1.0], i: 0.6 });
    }
    for (const e of this.exits.concat(this.teleports)) if (!e.hidden) L.push({ x: e.cx, y: e.bottom - 18, r: 80, c: e.secret ? [1, 0.35, 0.3] : [0.65, 0.5, 1.0], i: 0.9 });
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.tiles[y * this.w + x];
        const above = this.tile(x, y - 1);
        if (t === T.LAVA && above !== T.LAVA && !isSolidType(above) && x % 2 === 0) {
          L.push({ x: x * TILE + 16, y: y * TILE - 2, r: 64, c: [1.0, 0.45, 0.12], i: 0.5 });
        } else if (t === T.SLIME && above !== T.SLIME && !isSolidType(above) && x % 3 === 0) {
          L.push({ x: x * TILE + 8, y: y * TILE - 2, r: 44, c: [0.45, 0.85, 0.2], i: 0.3 });
        } else if (t === T.SKY) {
          let edge = false;
          for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
            const n = this.tile(x + dx, y + dy);
            if (n !== T.SKY && !isSolidType(n)) { edge = true; break; }
          }
          if (edge) L.push({ x: x * TILE + 8, y: y * TILE + 8, r: 96, c: [0.85, 0.8, 1.0], i: 0.33 });
        }
      }
    }
    return L;
  }

  lightVisible(x0, y0, x1, y1) {
    const d = dist(x0, y0, x1, y1);
    const steps = Math.ceil(d / 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (this.tileSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return d * (1 - t) < 7;
    }
    return true;
  }

  bakeLight() {
    const C = 4;
    const cw = this.w * C, ch = this.h * C;
    const L = new Float32Array(cw * ch * 3);
    const amb = this.tex.ambient;
    const ambScale = this.def.ambient || 1;
    for (let i = 0; i < cw * ch; i++) {
      L[i * 3] = amb[0] * ambScale; L[i * 3 + 1] = amb[1] * ambScale; L[i * 3 + 2] = amb[2] * ambScale;
    }
    this.lightBuf = { L, C, cw, ch };
    for (const l of this.staticLights()) this.addBakedLight(l);
    const lc = makeCanvas(cw, ch);
    this.lightCanvas = lc;
    this.encodeLight(0, 0, cw - 1, ch - 1);
  }

  // Добавить источник в запечённый свет (с тенями от стен); вернуть задетый прямоугольник.
  addBakedLight(l) {
    const { L, C, cw, ch } = this.lightBuf;
    const cell = TILE / C;
    const cx0 = Math.max(0, Math.floor((l.x - l.r) / cell)), cx1 = Math.min(cw - 1, Math.floor((l.x + l.r) / cell));
    const cy0 = Math.max(0, Math.floor((l.y - l.r) / cell)), cy1 = Math.min(ch - 1, Math.floor((l.y + l.r) / cell));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const px = cx * cell + cell / 2, py = cy * cell + cell / 2;
        const d = dist(l.x, l.y, px, py);
        if (d >= l.r) continue;
        if (!this.lightVisible(l.x, l.y, px, py)) continue;
        const f = 1 - d / l.r;
        const k = f * Math.sqrt(f) * l.i;
        const i = (cy * cw + cx) * 3;
        L[i] += l.c[0] * k; L[i + 1] += l.c[1] * k; L[i + 2] += l.c[2] * k;
      }
    }
    return [cx0, cy0, cx1, cy1];
  }

  // Перенести часть буфера света в холст.
  encodeLight(cx0, cy0, cx1, cy1) {
    const { L, C, cw } = this.lightBuf;
    const lctx = this.lightCanvas.getContext('2d');
    const w = cx1 - cx0 + 1, h = cy1 - cy0 + 1;
    const img = lctx.createImageData(w, h);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const i = cy * cw + cx, o = ((cy - cy0) * w + (cx - cx0)) * 4;
        const tx = Math.floor(cx / C), ty = Math.floor(cy / C);
        const sky = skyLike(this.tiles[ty * this.w + tx]) || this.skyBack(tx, ty);
        for (let k = 0; k < 3; k++) {
          const v = sky ? 1 : Math.pow(clamp(L[i * 3 + k], 0, 1), 0.85);
          img.data[o + k] = v * 255;
        }
        img.data[o + 3] = 255;
      }
    }
    lctx.putImageData(img, cx0, cy0);
  }

  // Тайник открыт: зажечь его свет в запечённой карте.
  lightSecret(idx) {
    if (!this.lightBuf || !this.secretLights) return;
    const list = this.secretLights.filter((l) => l.secret === idx && !l.done);
    if (!list.length) return;
    let box = null;
    for (const l of list) {
      l.done = true;
      const b = this.addBakedLight(l);
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
    }
    this.encodeLight(...box);
    if (this.amb) this.amb.fgLit = false;
  }

  // Пятна крови и копоть рисуются прямо в запечённый слой.
  paintDecal(x, y, color, size = 1) {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Копоть от взрыва — отдельное пятно поверх стены, а не краска в запечённом слое:
  // взрыв в том же месте обновляет пятно (а не темнит его до чёрного круга),
  // и через полминуты пятно тает.
  paintScorch(x, y, r) {
    if (!this.scorches) this.scorches = [];
    const near = this.scorches.find((s) => dist(s.x, s.y, x, y) < Math.max(s.r, r) * 0.6);
    if (near) {
      near.x = (near.x + x) / 2; near.y = (near.y + y) / 2;
      near.r = Math.min(Math.max(near.r, r) * 1.05, r * 1.6);
      near.t = 0;
      return;
    }
    this.scorches.push({ x, y, r, t: 0 });
    if (this.scorches.length > 48) this.scorches.shift();
  }

  updateScorches(dt) {
    if (!this.scorches || !this.scorches.length) return;
    for (const s of this.scorches) s.t += dt;
    this.scorches = this.scorches.filter((s) => s.t < SCORCH_LIFE);
  }

  // Пятна копоти: только на стенах и задней стене, не на небе.
  drawScorches(ctx, cam, vw, vh) {
    if (!this.scorches) return;
    for (const s of this.scorches) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -s.r || y < -s.r || x > vw + s.r || y > vh + s.r) continue;
      const fade = clamp((SCORCH_LIFE - s.t) / 8, 0, 1);
      ctx.save();
      ctx.beginPath();
      const tx0 = Math.floor((s.x - s.r) / TILE), tx1 = Math.floor((s.x + s.r) / TILE);
      const ty0 = Math.floor((s.y - s.r) / TILE), ty1 = Math.floor((s.y + s.r) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!skyLike(this.tile(tx, ty)) && !this.skyBack(tx, ty)) ctx.rect(tx * TILE - cam.x, ty * TILE - cam.y, TILE, TILE);
      }
      ctx.clip();
      const g = ctx.createRadialGradient(x, y, 0, x, y, s.r);
      g.addColorStop(0, `rgba(0,0,0,${0.5 * fade})`);
      g.addColorStop(0.6, `rgba(10,5,0,${0.22 * fade})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      ctx.restore();
    }
  }

  // Горизонт для силуэтов: медиана нижних клеток неба по столбцам (в пикселях мира).
  findHorizon() {
    const bottoms = [];
    for (let x = 0; x < this.w; x++) {
      for (let y = this.h - 1; y >= 0; y--) {
        if (skyLike(this.tiles[y * this.w + x])) { bottoms.push(y); break; }
      }
    }
    if (!bottoms.length) return this.h * TILE;
    bottoms.sort((a, b) => a - b);
    return (bottoms[bottoms.length >> 1] + 1) * TILE;
  }

  // Слой силуэтов: по горизонтали сдвигается медленнее камеры, по вертикали
  // привязан к горизонту уровня (у парящих островов — к середине уровня).
  drawSkyline(ctx, L, cam, vw, vh, t, glow) {
    const anchor = L.float ? this.pxH / 2 + L.h / 2 : this.horizon;
    const at = L.float ? 0.5 + L.h / vh / 2 : 0.72;
    const base = Math.round(vh * at + (anchor - vh * at - cam.y) * L.par);
    const top = base - L.h;
    if (top >= vh || base <= 0) {
      if (L.fill && base <= 0) { ctx.fillStyle = L.fill; ctx.fillRect(0, 0, vw, vh); }
      return;
    }
    const ox = -Math.round(((cam.x * L.par) % L.w + L.w) % L.w);
    for (let x = ox; x < vw; x += L.w) ctx.drawImage(L.canvas, x, top);
    if (L.fill && base < vh) { ctx.fillStyle = L.fill; ctx.fillRect(0, base, vw, vh - base); }
    if (!glow || !L.beacons.length) return;
    // мигающие огни: маяки на мачтах, кратеры, кристаллы
    ctx.fillStyle = glow;
    for (const b of L.beacons) {
      const a = 0.45 + 0.55 * Math.sin(t * (b.r > 1 ? 1.3 : 2.6) + b.ph);
      if (a <= 0.05) continue;
      for (let x = ox + b.x; x < vw + 4; x += L.w) {
        if (x < -4) continue;
        const y = top + b.y;
        ctx.globalAlpha = a * 0.35;
        ctx.fillRect(x - b.r - 1, y - b.r - 1, b.r * 2 + 3, b.r * 2 + 3);
        ctx.globalAlpha = a;
        ctx.fillRect(x - Math.floor(b.r / 2), y - Math.floor(b.r / 2), Math.max(1, b.r), Math.max(1, b.r));
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- отрисовка ---
  drawSky(ctx, cam, vw, vh, t) {
    if (!this.hasSky) return;
    const theme = this.def.skyTheme || this.theme;
    const sky = Tex.sky(theme);
    const sl = Skyline.get(theme);
    ctx.save();
    const pb = ctx.createPattern(sky.back, 'repeat');
    const ox1 = -(cam.x * 0.2 + t * 6) % 128, oy1 = -(cam.y * 0.1) % 128;
    ctx.translate(ox1, oy1);
    ctx.fillStyle = pb;
    ctx.fillRect(-ox1, -oy1, vw, vh);
    ctx.restore();
    ctx.save();
    const pf = ctx.createPattern(sky.front, 'repeat');
    const ox2 = -(cam.x * 0.35 + t * 16) % 128, oy2 = -(cam.y * 0.15 + t * 3) % 128;
    ctx.translate(ox2, oy2);
    ctx.fillStyle = pf;
    ctx.fillRect(-ox2, -oy2, vw, vh);
    ctx.restore();
    // облака высоко, силуэты перед ними
    this.drawSkyline(ctx, sl.far, cam, vw, vh, t, sl.glow);
    this.drawSkyline(ctx, sl.near, cam, vw, vh, t, sl.glow);
  }

  drawBaked(ctx, cam, vw, vh) {
    const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
    const ex = Math.min(this.pxW, cam.x + vw), ey = Math.min(this.pxH, cam.y + vh);
    if (ex <= sx || ey <= sy) return;
    ctx.drawImage(this.canvas, sx, sy, ex - sx, ey - sy, sx - cam.x, sy - cam.y, ex - sx, ey - sy);
  }

  drawLight(lctx, cam, vw, vh) {
    const k = 4 / TILE;
    lctx.imageSmoothingEnabled = true;
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, vw, vh);
    const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
    const ex = Math.min(this.pxW, cam.x + vw), ey = Math.min(this.pxH, cam.y + vh);
    if (ex <= sx || ey <= sy) return;
    lctx.drawImage(this.lightCanvas, sx * k, sy * k, (ex - sx) * k, (ey - sy) * k, sx - cam.x, sy - cam.y, ex - sx, ey - sy);
  }

  drawMovers(ctx, cam) {
    const tex = this.tex;
    for (const pad of this.jumpPads) {
      const x = Math.round(pad.x - cam.x), y = Math.round(pad.y - cam.y);
      ctx.fillStyle = '#1e1e22'; ctx.fillRect(x - 1, y, 16, 4);
      ctx.fillStyle = '#5a5a64'; ctx.fillRect(x, y, 14, 1);
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(x, y + 1, 14, 2);
    }
    for (const s of this.solids) {
      if (s.kind === 'crusher') { drawCrusher(ctx, s, cam); continue; }
      if (s.isBox) {
        if (!s.solid) continue;
        drawBox(ctx, s.x - cam.x, s.y - cam.y);
        continue;
      }
      const m = s;
      if (m.open >= 1) continue;
      const r = m.rect();
      const x = Math.round(r.x - cam.x), y = Math.round(r.y - cam.y);
      if (x > 2000 || y > 2000 || x + r.w < -50 || y + r.h < -50) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, r.w, Math.ceil(r.h));
      ctx.clip();
      const shift = m.kind === 'secret' ? m.h * m.open : -m.h * m.open;
      const baseY = Math.round(m.y - cam.y + shift);
      const baseX = Math.round(m.x - cam.x);
      if (m.kind === 'gate') {
        drawGate(ctx, baseX, baseY, m.w, m.h);
      } else {
        const src = m.kind === 'secret' ? tex.wall : tex.door;
        for (let ty = 0; ty < m.h / TILE; ty++) {
          for (let tx = 0; tx < m.w / TILE; tx++) {
            const wx = m.x / TILE + tx, wy = m.y / TILE + ty;
            const sy = m.kind === 'secret' ? (wy % 4) * TILE : (ty % 4) * TILE;
            ctx.drawImage(src, (wx % 4) * TILE, sy, TILE, TILE, baseX + tx * TILE, baseY + ty * TILE, TILE, TILE);
          }
        }
        if (m.kind === 'secret') {
          // подсказка для внимательных: чуть темнее и с трещиной
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(baseX, baseY, m.w, m.h);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          const cx = baseX + Math.floor(m.w / 2) - 2;
          for (let i = 0; i < m.h; i += 3) ctx.fillRect(cx + ((i * 7) % 5) - 2, baseY + i, 1, 3);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(baseX, baseY, 1, m.h); ctx.fillRect(baseX + m.w - 1, baseY, 1, m.h);
          ctx.fillRect(baseX, baseY + m.h - 2, m.w, 2);
        }
        if (m.kind === 'silver' || m.kind === 'gold') {
          const cx = baseX + m.w / 2, cy = baseY + m.h / 2;
          ctx.fillStyle = '#1a1612'; ctx.fillRect(cx - 5, cy - 7, 10, 14);
          drawKeyIcon(ctx, cx, cy, m.kind === 'silver' ? '#c8d0dc' : '#e8b830');
        }
      }
      ctx.restore();
    }
    for (const lf of this.lifts) drawLift(ctx, lf, cam, Game.time);
    for (const b of this.liftButtons) drawLiftButton(ctx, b, cam, Game.time);
    for (const b of this.buttons) {
      const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
      if (this.def.altarButtons) {
        // рунический алтарь: ступенчатое основание и обелиск с прорезью руны
        const f = (a, c, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + a, y + c, w, h); };
        f(-6, 10, 24, 4, '#141620'); f(-5, 10, 22, 1, '#4a5064');
        f(-3, 6, 18, 4, '#1a1c24'); f(-2, 6, 16, 1, '#50586e');
        f(1, -10, 10, 16, '#141620');
        f(2, -10, 8, 16, '#2c3040'); f(2, -10, 2, 16, '#3c4258'); f(8, -9, 2, 15, '#20242e');
        f(3, -13, 6, 3, '#2c3040'); f(4, -15, 4, 2, '#3c4258'); f(5, -16, 2, 1, '#50586e');
        f(4, -7, 4, 10, b.lit ? '#1a3a4a' : '#0c0e14');
        continue;
      }
      ctx.fillStyle = '#2a2622'; ctx.fillRect(x, y, 12, 12);
      ctx.fillStyle = '#5a544a'; ctx.fillRect(x + 1, y + 1, 10, 10);
      ctx.fillStyle = '#38342e'; ctx.fillRect(x + 2, y + 2, 8, 8);
      ctx.fillStyle = b.pressed ? '#2a4a2a' : '#8a1a12';
      ctx.fillRect(x + 3, y + (b.pressed ? 4 : 3), 6, b.pressed ? 5 : 6);
    }
  }

  drawPortals(ctx, cam, t, bright) {
    const list = this.exits.concat(this.teleports);
    for (const e of list) {
      if (e.hidden || this.isHiddenAt(e.cx, e.bottom - 8)) continue;
      const x = Math.round(e.cx - cam.x), y = Math.round(e.bottom - cam.y);
      if (x < -40 || x > 2000 || y < -60 || y > 2000) continue;
      if (!bright) {
        drawPortalFrame(ctx, x, y, this.theme);
      } else {
        ctx.save();
        ctx.beginPath();
        if (this.theme === 'base') ctx.rect(x - 9, y - 39, 18, 37);
        else { ctx.moveTo(x - 9, y - 2); ctx.lineTo(x - 9, y - 34); ctx.arc(x, y - 34, 9, Math.PI, 0); ctx.lineTo(x + 9, y - 2); ctx.closePath(); }
        ctx.clip();
        const tele = Tex.liquidAnim.tele;
        if (e.sealed) {
          // спящий телепорт: тёмный, с кровавым заполнением снизу по мере заряда
          const g = Game.shubGate, k = g ? g.have / g.need : 0;
          ctx.globalAlpha = 0.18;
          ctx.drawImage(tele, (t * 5) % 32, 0, 32, 64, x - 9, y - 44, 18, 43);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45 + Math.sin(t * 3) * 0.1;
          ctx.fillStyle = '#a02040';
          const hh = Math.round(41 * k);
          ctx.fillRect(x - 9, y - 2 - hh, 18, hh);
          ctx.restore();
          continue;
        }
        ctx.drawImage(tele, (t * 20) % 32, 0, 32, 64, x - 9, y - 44, 18, 43);
        if (e.secret) {
          // секретный слипгейт — кроваво-красный
          ctx.globalCompositeOperation = 'hue';
          ctx.fillStyle = '#ff2010';
          ctx.fillRect(x - 9, y - 44, 18, 43);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.1;
        ctx.fillStyle = e.secret ? '#ff3020' : '#8a70ff';
        ctx.fillRect(x - 9, y - 44, 18, 43);
        ctx.restore();
      }
    }
  }

  drawDecorBright(ctx, cam, t) {
    drawGlyphs(ctx, cam, this.glyphs, t);
    if (this.archWindows) drawArchGlows(ctx, cam, this.archWindows, t);
    if (this.amb && this.amb.strips) {
      for (const s of this.amb.strips) {
        const x = Math.round(s.x - cam.x), y = Math.round(s.y - cam.y);
        if (x < -20 || x > 2000 || y < -20 || y > 2000) continue;
        const fl = hash2(s.x, Math.floor(t * 8), 7) < 0.03 ? 0.3 : 1;   // изредка мигает
        ctx.globalAlpha = 0.25 * fl; ctx.fillStyle = '#c8e8ff'; ctx.fillRect(x - 2, y - 2, 18, 7);
        ctx.globalAlpha = fl; ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x + 1, y + 1, 12, 1);
        ctx.globalAlpha = 1;
      }
    }
    drawLiftLights(ctx, this.lifts, this.liftButtons, cam, t);
    if (this.def.altarButtons) {
      for (const b of this.buttons) {
        const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
        const k = 0.6 + Math.sin(t * 3 + b.x) * 0.4;
        const ch = b.charge || 0;
        // руна: фиолетовая — спит, голубеет по мере заряда, зажжённая — сияет
        ctx.fillStyle = b.lit ? '#80f0ff' : ch > 0 ? mix('#5a3a8a', '#80f0ff', ch) : '#5a3a8a';
        ctx.globalAlpha = b.lit ? 0.75 + k * 0.25 : 0.5 + k * 0.2 + ch * 0.3;
        ctx.fillRect(x + 5, y - 6, 2, 8); ctx.fillRect(x + 4, y - 4, 4, 1); ctx.fillRect(x + 4, y - 1, 4, 1);
        if (b.lit) {
          // столб света над зажжённым алтарём
          const g = ctx.createLinearGradient(0, y - 70, 0, y - 8);
          g.addColorStop(0, 'rgba(128,240,255,0)'); g.addColorStop(1, `rgba(128,240,255,${0.25 + k * 0.1})`);
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x + 3, y - 70, 6, 62);
        }
        ctx.globalAlpha = 1;
        if (!b.lit && (ch > 0 || b.on)) {
          // кольцо заряда вокруг алтаря
          ctx.strokeStyle = 'rgba(80,60,140,0.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x + 6, y - 2, 15, 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#a0f8ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x + 6, y - 2, 15, -Math.PI / 2, -Math.PI / 2 + TAU * ch); ctx.stroke();
        }
      }
    }
    for (const pad of this.jumpPads) {
      const x = Math.round(pad.x - cam.x), y = Math.round(pad.y - cam.y);
      if (x < -20 || x > 2000 || y < -20 || y > 2000) continue;
      const k = Math.floor(t * 6) % 3;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === k ? '#c0fff0' : '#40c8a0';
        const yy = y - 3 - i * 4;
        ctx.fillRect(x + 4, yy, 2, 1); ctx.fillRect(x + 8, yy, 2, 1);
        ctx.fillRect(x + 6, yy - 1, 2, 1);
      }
      ctx.fillStyle = '#60ffd0'; ctx.fillRect(x + 1, y + 1, 12, 1);
    }
    for (const d of this.decor) {
      const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
      if (x < -20 || y < -40 || x > 2000 || y > 2000) continue;
      if (this.isHiddenAt(d.x, d.y)) continue;
      if (d.free) drawWisp(ctx, x, y, t, d.x * 0.37 + d.y * 0.11, d.kind === 'torch');
      else if (d.kind === 'torch') drawTorchFlame(ctx, x, y, t, d.x * 0.37 + d.y * 0.11);
      else if (d.kind === 'lamp') drawLampLight(ctx, x, y, t);
      else if (d.kind === 'electrode') {
        drawElectrode(ctx, x, y, t, Game.bossFx, d);
      } else if (d.kind === 'checkpoint') {
        const pulse = 0.6 + Math.sin(t * 3) * 0.4;
        ctx.fillStyle = d.active ? '#60e0ff' : '#8a2a14';
        ctx.globalAlpha = d.active ? 0.7 + pulse * 0.3 : 0.8;
        ctx.fillRect(x - 1, y - 16, 2, 8);
        ctx.fillRect(x - 2, y - 13, 4, 1);
        if (d.active) { ctx.fillStyle = '#e0fbff'; ctx.fillRect(x, y - 15, 1, 5); }
        ctx.globalAlpha = 1;
      }
    }
  }

  drawLiquids(ctx, cam, vw, vh, t, which) {
    const tx0 = Math.max(0, Math.floor(cam.x / TILE)), tx1 = Math.min(this.w - 1, Math.floor((cam.x + vw) / TILE));
    const ty0 = Math.max(0, Math.floor(cam.y / TILE)), ty1 = Math.min(this.h - 1, Math.floor((cam.y + vh) / TILE));
    const anim = Tex.liquidAnim;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const lt = this.tiles[ty * this.w + tx];
        if (!isLiquidType(lt)) continue;
        const isLava = lt === T.LAVA;
        if (isLava !== (which === 'lava')) continue;
        const name = LIQUID_NAMES[lt];
        const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
        const above = this.tile(tx, ty - 1);
        const surface = above !== lt && !isSolidType(above);
        ctx.globalAlpha = lt === T.WATER ? 0.55 : lt === T.SLIME ? 0.8 : 1;
        ctx.drawImage(anim[name], (tx % 4) * TILE, (ty % 4) * TILE, TILE, TILE, x, y, TILE, TILE);
        if (surface) {
          ctx.globalAlpha = lt === T.WATER ? 0.45 : 0.7;
          ctx.fillStyle = lt === T.WATER ? '#9ac8e0' : lt === T.SLIME ? '#b8e060' : '#ffe080';
          for (let i = 0; i < TILE; i += 4) {
            const wy = Math.round(Math.sin(t * 3 + (tx * TILE + i) * 0.3) * 0.8);
            ctx.fillRect(x + i, y + wy, 4, 1);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

// --- мелкие спрайты уровня ---
function drawKeyIcon(ctx, cx, cy, col) {
  ctx.fillStyle = col;
  ctx.fillRect(cx - 2, cy - 5, 4, 4);
  ctx.fillStyle = '#1a1612'; ctx.fillRect(cx - 1, cy - 4, 2, 2);
  ctx.fillStyle = col;
  ctx.fillRect(cx - 1, cy - 1, 2, 6);
  ctx.fillRect(cx + 1, cy + 2, 2, 1);
  ctx.fillRect(cx + 1, cy + 4, 2, 1);
}

function drawCrusher(ctx, c, cam) {
  const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y);
  const by = Math.round(c.baseY - cam.y);
  if (x > 2000 || x + c.w < -20 || y > 2000 || y + c.h < -40) return;
  if (y > by) {
    const rx = x + c.w / 2 - 3;
    ctx.fillStyle = '#2a2826'; ctx.fillRect(rx, by, 6, y - by);
    ctx.fillStyle = '#6a6660'; ctx.fillRect(rx + 1, by, 1, y - by);
  }
  ctx.fillStyle = '#1c1a18'; ctx.fillRect(x, y, c.w, c.h - 4);
  ctx.fillStyle = '#4a4640'; ctx.fillRect(x + 1, y + 1, c.w - 2, c.h - 6);
  ctx.fillStyle = '#6e6a62'; ctx.fillRect(x + 1, y + 1, c.w - 2, 1);
  ctx.fillStyle = '#34312c';
  for (let yy = y + 5; yy < y + c.h - 6; yy += 6) ctx.fillRect(x + 2, yy, c.w - 4, 1);
  ctx.fillStyle = '#b89a30';
  for (let xx = x + 3; xx < x + c.w - 3; xx += 8) { ctx.fillRect(xx, y + c.h - 9, 4, 2); }
  ctx.fillStyle = '#8a8680';
  for (let xx = x; xx < x + c.w; xx += 4) {
    ctx.fillRect(xx, y + c.h - 4, 3, 1); ctx.fillRect(xx + 1, y + c.h - 3, 1, 3);
  }
}

function drawGate(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y, w, h);
  for (let bx = x + 1; bx < x + w - 1; bx += 5) {
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(bx, y, 3, h);
    ctx.fillStyle = '#5a5a66'; ctx.fillRect(bx, y, 1, h);
    ctx.fillStyle = '#3e3e48'; ctx.fillRect(bx + 1, y, 1, h);
  }
  for (let by = y + 4; by < y + h; by += 16) {
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x, by, w, 3);
    ctx.fillStyle = '#6a6a76'; ctx.fillRect(x, by, w, 1);
  }
  ctx.fillStyle = '#2a2a30';
  for (let bx = x + 2; bx < x + w - 1; bx += 5) ctx.fillRect(bx, y + h - 3, 1, 3);
}

function drawBox(ctx, x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#3a2614'; ctx.fillRect(x, y, 14, 14);
  ctx.fillStyle = '#7a5430'; ctx.fillRect(x + 1, y + 1, 12, 12);
  ctx.fillStyle = '#946a3c'; ctx.fillRect(x + 1, y + 1, 12, 1);
  ctx.fillStyle = '#5a3c20'; ctx.fillRect(x + 1, y + 6, 12, 2);
  ctx.fillStyle = '#d0a020'; ctx.fillRect(x + 3, y + 3, 8, 2); ctx.fillRect(x + 3, y + 9, 8, 2);
  ctx.fillStyle = '#1a1208'; ctx.fillRect(x + 4, y + 3, 1, 2); ctx.fillRect(x + 7, y + 3, 1, 2); ctx.fillRect(x + 10, y + 3, 1, 2);
  ctx.fillRect(x + 4, y + 9, 1, 2); ctx.fillRect(x + 7, y + 9, 1, 2); ctx.fillRect(x + 10, y + 9, 1, 2);
}

function drawElectrode(ctx, x, y, t, fx, d) {
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(x - 3, y - 30, 6, 30);
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x - 3, y - 30, 1, 30);
  // кольца загораются снизу вверх по мере заряда; заряженный электрод искрит
  const st = d && d.est, lit = st === 'ready' ? 5 : st === 'charging' ? Math.floor(clamp(d.et / 1.6, 0, 1) * 5) : 0;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 4 - i < lit ? (st === 'ready' && d.et < 4 && Math.floor(t * 8) % 2 ? '#6a7ab0' : '#b8c8ff') : '#2a2a30';
    ctx.fillRect(x - 5, y - 26 + i * 5, 10, 2);
  }
  ctx.fillStyle = st === 'ready' ? '#f0f4ff' : '#9ab0ff'; ctx.fillRect(x - 2, y - 34, 4, 4);
  if (st === 'ready') {
    for (let i = 0; i < 2; i++) drawLightning(ctx, x, y - 32, x + randInt(-12, 12), y - 40 - randInt(0, 12), '#c8d8ff', 1, 0.5 + Math.random() * 0.4);
  }
  if ((fx && fx > 0) || Math.sin(t * 17 + x) > 0.9) {
    ctx.fillStyle = '#e0e8ff';
    ctx.fillRect(x - 1 + randInt(-2, 2), y - 38 + randInt(-2, 1), 2, 2);
  }
}
