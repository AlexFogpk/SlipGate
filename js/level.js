'use strict';
// Уровень: разбор ASCII-карты, двери/решётки/тайники, коллизии, лучи, запекание текстур и света.

const T = { EMPTY: 0, WALL: 1, WALL2: 2, PLAT: 3, WATER: 4, LAVA: 5, SLIME: 6, SKY: 7 };
const TILE_CHARS = { ' ': T.EMPTY, '#': T.WALL, '%': T.WALL2, '-': T.PLAT, '~': T.WATER, '!': T.LAVA, ';': T.SLIME, ',': T.SKY };
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
class Lift {
  constructor(tx, ty, len, ex, ey) {
    this.x0 = tx * TILE; this.y0 = ty * TILE;
    this.x1 = ex * TILE; this.y1 = ey * TILE;
    this.w = len * TILE; this.h = 7;
    this.x = this.x0; this.y = this.y0;
    this.dx = 0; this.dy = 0;
    this.t = 0; this.dir = 1; this.wait = 1.2;
    this.dur = Math.max(0.6, dist(this.x0, this.y0, this.x1, this.y1) / 58);
  }
  update(dt) {
    const px = this.x, py = this.y;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) Sound.play('lift', this.x + this.w / 2, this.y);
    } else {
      this.t += this.dir * dt / this.dur;
      if (this.t >= 1) { this.t = 1; this.dir = -1; this.wait = 1.6; }
      else if (this.t <= 0) { this.t = 0; this.dir = 1; this.wait = 1.6; }
    }
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
        if (t === T.SKY) this.hasSky = true;
        if (isLiquidType(t)) this.hasLiquid = true;
      }
    }
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
    srcs.forEach((s, i) => {
      s.dest = dests[i] || dests[0] || { x: s.cx, y: s.bottom };
      this.teleports.push(s);
    });
    if (def.skillPortals) this.exits.forEach((e, i) => { e.skill = def.skillPortals[i]; });
    if (def.exitAfterBoss) this.exits.forEach((e) => { e.hidden = true; });
    this.computeHidden();
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

  isHiddenAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const i = this.hidden[ty * this.w + tx];
    return i >= 0 && this.movers[i].open < 0.3;
  }

  drawHidden(ctx, cam, vw, vh) {
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
      if (t === T.WATER || t === T.LAVA || t === T.SLIME || (t === T.SKY && !liquidsOnly)) counts[t] = (counts[t] || 0) + 1;
    }
    let best = T.EMPTY, bc = 1;
    for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = +k; }
    return best;
  }

  // Платформа на фоне неба (мост на улице) не рисует заднюю стену.
  skyBack(tx, ty) {
    if (this.tile(tx, ty) !== T.PLAT) return false;
    return this.tile(tx - 1, ty) === T.SKY || this.tile(tx + 1, ty) === T.SKY || this.tile(tx, ty - 1) === T.SKY || this.tile(tx, ty + 1) === T.SKY;
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.WALL;
    return this.tiles[ty * this.w + tx];
  }
  tileSolid(tx, ty) { return isSolidType(this.tile(tx, ty)); }
  tileAtPx(x, y) { return this.tile(Math.floor(x / TILE), Math.floor(y / TILE)); }

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
    return isLiquidType(t) ? t : 0;
  }

  boxFree(x, y, w, h) {
    const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - 0.01) / TILE);
    const ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.tileSolid(tx, ty)) return false;
    const b = { x, y, w, h };
    for (const s of this.solids) if (s.solid && overlap(b, s.rect())) return false;
    return true;
  }

  // Луч по тайлам (DDA) + динамические препятствия.
  rayCast(x0, y0, x1, y1, ignoreSolids = false) {
    const dx = x1 - x0, dy = y1 - y0;
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx > 0 ? ((tx + 1) * TILE - x0) / dx : dx < 0 ? (tx * TILE - x0) / dx : Infinity;
    let tMaxY = dy > 0 ? ((ty + 1) * TILE - y0) / dy : dy < 0 ? (ty * TILE - y0) / dy : Infinity;
    let hitT = 1, nx = 0, ny = 0, hit = false;
    if (this.tileSolid(tx, ty)) { hitT = 0; hit = true; }
    else {
      for (let guard = 0; guard < 4000; guard++) {
        let t, cnx, cny;
        if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; cnx = -stepX; cny = 0; }
        else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; cnx = 0; cny = -stepY; }
        if (t > 1) break;
        if (this.tileSolid(tx, ty)) { hitT = t; nx = cnx; ny = cny; hit = true; break; }
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
    for (const lf of this.lifts) lf.update(dt);
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
              HUD.center(need === 'silver' ? 'Нужен серебряный ключ' : 'Нужен золотой ключ', 1.2);
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
      if (!b.pressed && p && p.alive && overlap(p, b)) this.pressButton(b);
    }
  }

  moverBlocked(m) {
    const r = m.rect();
    if (Game.player && Game.player.alive && overlap(Game.player, r)) return true;
    for (const mon of Game.monsters) if (mon.alive && overlap(mon, r)) return true;
    return false;
  }

  pressButton(b) {
    if (b.pressed) return;
    b.pressed = true;
    Sound.play('button', b.x, b.y);
    if (this.def.bossButtons) {
      b.resetT = 6;
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
        if (t === T.SKY || this.skyBack(x, y)) continue;
        const src = t === T.WALL ? tex.wall : t === T.WALL2 ? tex.wall2 : tex.back;
        ctx.drawImage(src, (x % 4) * TILE, (y % 4) * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
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

    const solidOrOut = (x, y) => this.tileSolid(x, y);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.tiles[y * this.w + x];
        const px = x * TILE, py = y * TILE;
        if (isSolidType(t)) {
          // фаски на краях стен
          if (!solidOrOut(x, y - 1)) {
            ctx.fillStyle = 'rgba(255,240,210,0.22)'; ctx.fillRect(px, py, TILE, 1);
            ctx.fillStyle = 'rgba(255,240,210,0.08)'; ctx.fillRect(px, py + 1, TILE, 1);
          }
          if (!solidOrOut(x, y + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, py + TILE - 2, TILE, 2); }
          if (!solidOrOut(x - 1, y)) { ctx.fillStyle = 'rgba(255,240,210,0.1)'; ctx.fillRect(px, py, 1, TILE); }
          if (!solidOrOut(x + 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + TILE - 1, py, 1, TILE); }
        } else if (t !== T.SKY && !this.skyBack(x, y)) {
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
    for (const d of this.decor) {
      if (d.kind === 'checkpoint') {
        ctx.fillStyle = '#2a2622'; ctx.fillRect(d.x - 6, d.y - 5, 12, 5);
        ctx.fillStyle = '#5a544a'; ctx.fillRect(d.x - 6, d.y - 5, 12, 1);
        ctx.fillStyle = '#3a3630'; ctx.fillRect(d.x - 3, d.y - 19, 6, 14);
        ctx.fillStyle = '#4e4840'; ctx.fillRect(d.x - 3, d.y - 19, 1, 14);
        ctx.fillStyle = '#1a1612'; ctx.fillRect(d.x - 1, d.y - 16, 2, 8);
        continue;
      }
      if (d.kind === 'torch') {
        ctx.fillStyle = '#2a221a'; ctx.fillRect(d.x - 1, d.y - 1, 3, 9);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(d.x - 3, d.y - 2, 7, 3);
        ctx.fillStyle = '#6a5438'; ctx.fillRect(d.x - 3, d.y - 2, 7, 1);
      } else if (d.kind === 'lamp') {
        ctx.fillStyle = '#2c2a26'; ctx.fillRect(d.x - 6, d.y - 3, 12, 6);
        ctx.fillStyle = '#4a4640'; ctx.fillRect(d.x - 6, d.y - 3, 12, 1);
      }
    }
    this.bakeLight();
  }

  drawPlatform(ctx, x, y) {
    const px = x * TILE, py = y * TILE;
    const c = this.tex.plat;
    ctx.fillStyle = shade(c, 0.55); ctx.fillRect(px, py, TILE, 5);
    ctx.fillStyle = c; ctx.fillRect(px, py, TILE, 4);
    ctx.fillStyle = shade(c, 1.3); ctx.fillRect(px, py, TILE, 1);
    ctx.fillStyle = shade(c, 0.7); ctx.fillRect(px + (x % 2 ? 3 : 11), py + 1, 1, 3);
    const left = this.tile(x - 1, y) !== T.PLAT, right = this.tile(x + 1, y) !== T.PLAT;
    ctx.fillStyle = shade(c, 0.6);
    if (left) { ctx.fillRect(px + 2, py + 4, 2, 5); ctx.fillRect(px + 1, py + 4, 1, 2); }
    if (right) { ctx.fillRect(px + TILE - 4, py + 4, 2, 5); ctx.fillRect(px + TILE - 2, py + 4, 1, 2); }
  }

  staticLights() {
    const L = [];
    for (const pad of this.jumpPads) L.push({ x: pad.x + 7, y: pad.y - 6, r: 50, c: [0.3, 1, 0.8], i: 0.5 });
    for (const d of this.decor) {
      if (d.kind === 'torch') L.push({ x: d.x, y: d.y - 4, r: 140, c: [1.0, 0.68, 0.38], i: 1.1 });
      else if (d.kind === 'lamp') L.push({ x: d.x, y: d.y + 3, r: 175, c: [1.0, 0.95, 0.82], i: 1.15 });
      else if (d.kind === 'electrode') L.push({ x: d.x, y: d.y - 30, r: 80, c: [0.6, 0.7, 1.0], i: 0.6 });
    }
    for (const e of this.exits.concat(this.teleports)) if (!e.hidden) L.push({ x: e.cx, y: e.bottom - 18, r: 80, c: [0.65, 0.5, 1.0], i: 0.9 });
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
    const cell = TILE / C;
    for (const l of this.staticLights()) {
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
    }
    const lc = makeCanvas(cw, ch);
    const lctx = lc.getContext('2d');
    const img = lctx.createImageData(cw, ch);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const i = cy * cw + cx;
        const tx = Math.floor(cx / C), ty = Math.floor(cy / C);
        const sky = this.tiles[ty * this.w + tx] === T.SKY || this.skyBack(tx, ty);
        for (let k = 0; k < 3; k++) {
          const v = sky ? 1 : Math.pow(clamp(L[i * 3 + k], 0, 1), 0.85);
          img.data[i * 4 + k] = v * 255;
        }
        img.data[i * 4 + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    this.lightCanvas = lc;
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

  paintScorch(x, y, r) {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(10,5,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- отрисовка ---
  drawSky(ctx, cam, vw, vh, t) {
    if (!this.hasSky) return;
    const sky = Tex.sky(this.def.skyTheme || this.theme);
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
          // едва заметная подсказка для внимательных
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(baseX, baseY, m.w, m.h);
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
    for (const lf of this.lifts) {
      const x = Math.round(lf.x - cam.x), y = Math.round(lf.y - cam.y);
      if (x > 2000 || y > 2000 || x + lf.w < -20 || y < -20) continue;
      ctx.fillStyle = '#1e1a16'; ctx.fillRect(x, y, lf.w, lf.h);
      ctx.fillStyle = '#5e564a'; ctx.fillRect(x + 1, y + 1, lf.w - 2, lf.h - 2);
      ctx.fillStyle = '#9a8e78'; ctx.fillRect(x, y, lf.w, 1);
      ctx.fillStyle = '#3a342c'; ctx.fillRect(x + 1, y + 4, lf.w - 2, 1);
      ctx.fillStyle = '#c8a040';
      for (let i = 4; i < lf.w - 2; i += 8) ctx.fillRect(x + i, y + 2, 2, 1);
      ctx.fillStyle = '#2a2520';
      ctx.fillRect(x + 2, y + lf.h, 2, 3); ctx.fillRect(x + lf.w - 4, y + lf.h, 2, 3);
    }
    for (const b of this.buttons) {
      const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
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
      if (e.hidden) continue;
      const x = Math.round(e.cx - cam.x), y = Math.round(e.bottom - cam.y);
      if (x < -40 || x > 2000 || y < -60 || y > 2000) continue;
      if (!bright) {
        // каменная арка
        ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 13, y - 42, 26, 42);
        ctx.fillStyle = '#5a4e42'; ctx.fillRect(x - 12, y - 41, 24, 3);
        ctx.fillStyle = '#4a4036'; ctx.fillRect(x - 12, y - 38, 3, 38); ctx.fillRect(x + 9, y - 38, 3, 38);
        ctx.fillStyle = '#6a5c4c'; ctx.fillRect(x - 12, y - 41, 24, 1);
        ctx.fillStyle = '#3a322a'; ctx.fillRect(x - 14, y - 2, 28, 2);
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 9, y - 38, 18, 37);
        ctx.clip();
        const tele = Tex.liquidAnim.tele;
        ctx.drawImage(tele, (t * 20) % 32, 0, 32, 64, x - 9, y - 38, 18, 37);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.1;
        ctx.fillStyle = '#8a70ff';
        ctx.fillRect(x - 9, y - 38, 18, 37);
        ctx.restore();
      }
    }
  }

  drawDecorBright(ctx, cam, t) {
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
      if (d.kind === 'torch') {
        const f = Math.sin(t * 13 + d.x) * 0.5 + Math.sin(t * 23 + d.y) * 0.5;
        ctx.fillStyle = '#c03a08'; ctx.fillRect(x - 3, y - 8, 7, 6);
        ctx.fillStyle = '#ff7a18'; ctx.fillRect(x - 2, y - 10 - (f > 0 ? 1 : 0), 5, 7);
        ctx.fillStyle = '#ffd050'; ctx.fillRect(x - 1, y - 8 - (f > 0.3 ? 1 : 0), 3, 5);
        ctx.fillStyle = '#fff4c0'; ctx.fillRect(x, y - 6, 1, 2);
        if (f > 0.5) { ctx.fillStyle = '#ff9a28'; ctx.fillRect(x + (f > 0.8 ? 1 : -1), y - 13, 1, 2); }
      } else if (d.kind === 'lamp') {
        ctx.fillStyle = '#fff2c8'; ctx.fillRect(x - 5, y - 1, 10, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y, 6, 1);
      } else if (d.kind === 'electrode') {
        drawElectrode(ctx, x, y, t, Game.bossFx);
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

function drawElectrode(ctx, x, y, t, fx) {
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(x - 3, y - 30, 6, 30);
  ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x - 3, y - 30, 1, 30);
  ctx.fillStyle = '#2a2a30';
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 5, y - 26 + i * 5, 10, 2);
  ctx.fillStyle = '#9ab0ff'; ctx.fillRect(x - 2, y - 34, 4, 4);
  if ((fx && fx > 0) || Math.sin(t * 17 + x) > 0.9) {
    ctx.fillStyle = '#e0e8ff';
    ctx.fillRect(x - 1 + randInt(-2, 2), y - 38 + randInt(-2, 1), 2, 2);
  }
}
