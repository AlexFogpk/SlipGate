'use strict';
// Оружие игрока, мгновенные выстрелы (hitscan) и снаряды.

const WEAPONS = {
  1: { name: 'Топор', ammo: null, use: 0, rate: 0.5, len: 11 },
  2: { name: 'Ружьё', ammo: 'shells', use: 1, rate: 0.5, len: 11 },
  3: { name: 'Двустволка', ammo: 'shells', use: 2, rate: 0.7, len: 12 },
  4: { name: 'Гвоздомёт', ammo: 'nails', use: 1, rate: 0.1, len: 11 },
  5: { name: 'Супергвоздомёт', ammo: 'nails', use: 2, rate: 0.1, len: 12 },
  6: { name: 'Гранатомёт', ammo: 'rockets', use: 1, rate: 0.6, len: 10 },
  7: { name: 'Ракетница', ammo: 'rockets', use: 1, rate: 0.8, len: 13 },
  8: { name: 'Громовержец', ammo: 'cells', use: 1, rate: 0.1, len: 11 },
  9: { name: 'Лазерная пушка', ammo: 'cells', use: 1, rate: 0.13, len: 12 },
};
const AMMO_MAX = { shells: 100, nails: 200, rockets: 100, cells: 100 };
const AMMO_NAMES = { shells: 'патроны', nails: 'гвозди', rockets: 'ракеты', cells: 'батареи' };

const PROJ = {
  nail: { speed: 520, dmg: 9, lit: true },
  rocket: { speed: 420, dmg: 110, splash: 120, radius: 72, light: [1, 0.6, 0.3, 70] },
  grenade: { speed: 380, dmg: 0, splash: 120, radius: 72, grav: 800, life: 2.5, bounce: true, lit: true },
  laser: { speed: 340, dmg: 15, light: [1, 0.55, 0.2, 40] },
  spike: { speed: 300, dmg: 9, light: [0.4, 1, 0.3, 32] },
  fireball: { speed: 270, dmg: 9, light: [1, 0.5, 0.15, 48] },
  flesh: { speed: 300, dmg: 10, grav: 650, lit: true },
  voreball: { speed: 150, dmg: 20, splash: 40, radius: 44, homing: 2.2, life: 7, light: [0.8, 0.35, 1, 64] },
  lavaball: { speed: 300, dmg: 30, splash: 50, radius: 60, grav: 420, light: [1, 0.5, 0.1, 90] },
  bolt: { speed: 620, dmg: 18, life: 2, light: [1, 0.3, 0.2, 44] },
  rune: { speed: 330, dmg: 13, lit: true, light: [0.35, 0.85, 1, 44] },
  shard: { speed: 260, dmg: 9, homing: 0.9, life: 3, lit: true, light: [0.7, 0.4, 1, 34] },
};

// Мгновенный выстрел (дробь, пули солдат). Урон дробинок суммируется — как в Quake.
function hitscan(attacker, x0, y0, ang, pellets, dmg, spread, range = 900) {
  const lv = Game.level;
  const acc = new Map();
  const targets = Game.shootTargets(attacker);
  for (let i = 0; i < pellets; i++) {
    const a = ang + (Math.random() + Math.random() - 1) * spread;
    const cx = Math.cos(a), cy = Math.sin(a);
    const dx = cx * range, dy = cy * range;
    const hit = lv.rayCast(x0, y0, x0 + dx, y0 + dy);
    let best = hit.t, tgt = null;
    for (const t of targets) {
      const tt = rayBox(x0, y0, dx, dy, t.x, t.y, t.w, t.h);
      if (tt >= 0 && tt < best) { best = tt; tgt = t; }
    }
    for (const b of lv.buttons) {
      const tt = rayBox(x0, y0, dx, dy, b.x, b.y, b.w, b.h);
      if (tt >= 0 && tt < best && !b.pressed) lv.pressButton(b);
    }
    const hx = x0 + dx * best, hy = y0 + dy * best;
    if (tgt) {
      acc.set(tgt, (acc.get(tgt) || 0) + dmg);
      FX.blood(hx, hy, cx, cy, 3);
    } else if (hit.hit) {
      FX.puff(hx - cx, hy - cy, hit.nx, hit.ny);
      lv.shootSolid(hit.solid, dmg, attacker);
      if (Math.random() < 0.15) Sound.play('ric', hx, hy, { gap: 0.05 });
    }
  }
  for (const [t, d] of acc) applyDamage(t, d, attacker, 'bullet', Math.cos(ang) * d * 3, Math.sin(ang) * d * 3);
  return acc.size > 0;
}

// Луч «Громовержца» / молнии шамблера.
function lightningRay(attacker, x0, y0, ang, range, dmg) {
  const lv = Game.level;
  const dx = Math.cos(ang) * range, dy = Math.sin(ang) * range;
  const hit = lv.rayCast(x0, y0, x0 + dx, y0 + dy);
  let best = hit.t, tgt = null;
  for (const t of Game.shootTargets(attacker)) {
    const tt = rayBox(x0, y0, dx, dy, t.x, t.y, t.w, t.h);
    if (tt >= 0 && tt < best) { best = tt; tgt = t; }
  }
  const hx = x0 + dx * best, hy = y0 + dy * best;
  FX.beam(x0, y0, hx, hy, '#c8d8ff', 0.1, 2);
  if (tgt) {
    applyDamage(tgt, dmg, attacker, 'lightning', Math.cos(ang) * 40, Math.sin(ang) * 40);
    FX.blood(hx, hy, Math.cos(ang), Math.sin(ang), 2);
  } else if (hit.hit) {
    FX.sparks(hx, hy, 4, '#c8d8ff', 120);
    lv.shootSolid(hit.solid, dmg, attacker);
  }
  for (const b of lv.buttons) {
    const tt = rayBox(x0, y0, dx, dy, b.x, b.y, b.w, b.h);
    if (tt >= 0 && tt < best && !b.pressed) lv.pressButton(b);
  }
  return { x: hx, y: hy, target: tgt };
}

class Projectile {
  constructor(kind, owner, x, y, ang, o = {}) {
    const d = PROJ[kind];
    this.kind = kind;
    this.owner = owner;
    this.x = x; this.y = y;
    const sp = o.speed || d.speed;
    this.vx = Math.cos(ang) * sp + (o.vx || 0);
    this.vy = Math.sin(ang) * sp + (o.vy || 0);
    this.dmg = (o.dmg !== undefined ? o.dmg : d.dmg);
    this.splash = o.splash !== undefined ? o.splash : (d.splash || 0);
    this.radius = d.radius || 0;
    this.grav = d.grav || 0;
    this.life = o.life || d.life || 6;
    this.homing = d.homing || 0;
    this.mul = o.mul || 1;
    this.lit = !!d.lit;
    this.lightDef = d.light;
    this.age = 0;
    this.dead = false;
    this.spin = rand(0, TAU);
    this.target = o.target || null;
    this.bounces = kind === 'bolt' ? 3 : 0;
  }

  update(dt) {
    this.age += dt;
    this.life -= dt;
    const lv = Game.level;
    if (this.life <= 0) {
      if (this.splash) this.detonate(this.x, this.y, null);
      this.dead = true;
      return;
    }
    if (this.kind === 'rocket' && Math.random() < 0.8) FX.smokeTrail(this.x - this.vx * 0.01, this.y - this.vy * 0.01);
    if (this.kind === 'voreball' || this.kind === 'lavaball') {
      if (Math.random() < 0.5) FX.add({ kind: 'spark', x: this.x, y: this.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, size: 1, col: this.kind === 'voreball' ? '#d080ff' : '#ff9030', grav: 0, bright: true });
    }
    if (this.homing && this.target && this.target.alive) {
      const want = Math.atan2(this.target.cy - this.y, this.target.cx - this.x);
      const cur = Math.atan2(this.vy, this.vx);
      const na = cur + clamp(angleDiff(cur, want), -this.homing * dt, this.homing * dt);
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }
    if (this.kind === 'grenade') { this.updateGrenade(dt); return; }
    this.vy += this.grav * dt;
    this.spin += dt * 12;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const hit = lv.rayCast(this.x, this.y, nx, ny);
    let best = hit.hit ? hit.t : 1, tgt = null;
    const pad = this.kind === 'lavaball' ? 4 : 1;
    for (const t of Game.shootTargets(this.owner)) {
      const tt = rayBox(this.x, this.y, nx - this.x, ny - this.y, t.x - pad, t.y - pad, t.w + pad * 2, t.h + pad * 2);
      if (tt >= 0 && tt <= best) { best = tt; tgt = t; }
    }
    const hx = this.x + (nx - this.x) * best, hy = this.y + (ny - this.y) * best;
    if (tgt) { this.hitEntity(tgt, hx, hy); return; }
    if (hit.hit) { this.hitWall(hx, hy, hit); return; }
    this.x = nx; this.y = ny;
    if (lv.liquidAt(this.x, this.y) === T.WATER && Math.random() < 0.2) FX.bubbles(this.x, this.y);
  }

  updateGrenade(dt) {
    const b = { x: this.x - 2, y: this.y - 2, w: 4, h: 4, vx: this.vx, vy: this.vy + this.grav * dt, onGround: false };
    const pvx = b.vx, pvy = b.vy;
    const r = moveBody(b, dt);
    this.x = b.x + 2; this.y = b.y + 2;
    this.vx = b.vx; this.vy = b.vy;
    if (r.hitX) { this.vx = -pvx * 0.5; if (Math.abs(pvx) > 40) Sound.play('bounce', this.x, this.y); }
    if (r.hitY) {
      this.vy = Math.abs(pvy) < 90 ? 0 : -pvy * 0.45;
      this.vx *= 0.7;
      if (Math.abs(pvy) > 90) Sound.play('bounce', this.x, this.y);
    }
    if (r.solidX && r.solidX.isBox) { this.detonate(this.x, this.y, null); return; }
    if (b.onGround) this.vx = approach(this.vx, 0, 200 * dt);
    this.spin += this.vx * dt * 0.3;
    for (const t of Game.shootTargets(this.owner)) {
      if (this.x > t.x - 2 && this.x < t.x + t.w + 2 && this.y > t.y - 2 && this.y < t.y + t.h + 2) {
        this.detonate(this.x, this.y, null);
        return;
      }
    }
  }

  hitEntity(t, x, y) {
    this.dead = true;
    const dirx = Math.sign(this.vx), speed = Math.hypot(this.vx, this.vy) || 1;
    const kx = this.vx / speed, ky = this.vy / speed;
    switch (this.kind) {
      case 'rocket':
        applyDamage(t, (this.dmg + rand(0, 20)) * this.mul, this.owner, 'rocket', kx * 150, ky * 150);
        this.detonate(x - kx * 2, y - ky * 2, t);
        break;
      case 'voreball':
      case 'lavaball':
        applyDamage(t, this.dmg * this.mul, this.owner, 'explosion', kx * 100, ky * 100);
        this.detonate(x, y, t);
        break;
      default:
        applyDamage(t, this.dmg * this.mul, this.owner, this.kind === 'nail' ? 'nail' : 'missile', kx * this.dmg * 3, ky * this.dmg * 3);
        FX.blood(x, y, dirx, 0, this.kind === 'nail' ? 2 : 5);
        if (this.kind === 'flesh') Sound.play('splat', x, y);
    }
  }

  hitWall(x, y, hit) {
    this.dead = true;
    const lv = Game.level;
    const speed = Math.hypot(this.vx, this.vy) || 1;
    if (this.kind === 'bolt' && this.bounces > 0 && (hit.nx || hit.ny)) {
      // лазерный заряд рикошетит от стен
      this.bounces--;
      this.dead = false;
      if (hit.nx) this.vx = -this.vx;
      if (hit.ny) this.vy = -this.vy;
      this.x = x + hit.nx * 1.5; this.y = y + hit.ny * 1.5;
      FX.sparks(x, y, 3, '#ff8060', 90);
      Sound.play('ric', x, y, { gap: 0.04 });
      lv.shootSolid(hit.solid, this.dmg * this.mul, this.owner);
      return;
    }
    const bx = x - this.vx / speed * 2, by = y - this.vy / speed * 2;
    if (this.splash) { this.detonate(bx, by, null); return; }
    lv.shootSolid(hit.solid, this.dmg * this.mul, this.owner);
    switch (this.kind) {
      case 'nail':
        FX.puff(bx, by, hit.nx, hit.ny);
        if (Math.random() < 0.3) Sound.play('ric', x, y, { gap: 0.05 });
        break;
      case 'flesh':
        Sound.play('splat', x, y);
        for (let i = 0; i < 4; i++) lv.paintDecal(bx + rand(-2, 2), by + rand(-2, 2), '#5a0604', 1);
        FX.blood(bx, by, hit.nx, hit.ny, 4);
        break;
      case 'laser':
        FX.sparks(bx, by, 5, '#ffb050', 120);
        break;
      case 'spike':
        FX.sparks(bx, by, 5, '#80ff50', 100);
        break;
      case 'rune':
        FX.sparks(bx, by, 6, '#80e0ff', 120);
        break;
      case 'shard':
        FX.sparks(bx, by, 5, '#c090ff', 100);
        break;
      default:
        FX.sparks(bx, by, 6, '#ff9030', 120);
    }
  }

  detonate(x, y, ignore) {
    this.dead = true;
    explode(x, y, this.splash * this.mul, this.radius, this.owner, ignore);
  }

  light(out) {
    const l = this.lightDef;
    if (l) out.push({ x: this.x, y: this.y, r: l[3], c: [l[0], l[1], l[2]], i: 0.9 });
  }

  draw(ctx, cam, bright) {
    if (this.lit === bright) return;
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    const ang = Math.atan2(this.vy, this.vx);
    switch (this.kind) {
      case 'nail':
        ctx.fillStyle = '#9a9aa0';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillStyle = '#d0d0d8';
        ctx.fillRect(x + (this.vx > 0 ? 1 : -1), y, 1, 1);
        break;
      case 'grenade':
        ctx.fillStyle = '#1e2a1a'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#4a5a3a'; ctx.fillRect(x - 2, y - 2, 2, 2);
        if (Math.floor(this.age * 8) % 2) { ctx.fillStyle = '#ff4020'; ctx.fillRect(x, y - 1, 1, 1); }
        break;
      case 'flesh':
        ctx.fillStyle = '#5a1a10'; ctx.fillRect(x - 2, y - 2, 4, 3);
        ctx.fillStyle = '#9a3a2a'; ctx.fillRect(x - 1, y - 2, 2, 1);
        break;
      case 'rocket': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd060'; ctx.fillRect(-9 - rand(0, 3), -1, 4, 2);
        ctx.fillStyle = '#ff7020'; ctx.fillRect(-6, -1, 2, 2);
        ctx.fillStyle = '#5a5850'; ctx.fillRect(-4, -1, 7, 3);
        ctx.fillStyle = '#8a1a10'; ctx.fillRect(3, -1, 2, 3);
        ctx.restore();
        break;
      }
      case 'laser':
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = '#ff8020'; ctx.fillRect(-5, -1, 10, 2);
        ctx.fillStyle = '#fff0a0'; ctx.fillRect(-4, 0, 8, 1);
        ctx.restore();
        break;
      case 'spike':
        ctx.fillStyle = '#50c020'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#d0ff80'; ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      case 'fireball':
        ctx.fillStyle = '#c03008'; ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = '#ff8020'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#ffe080'; ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      case 'voreball': {
        const p = 1 + Math.sin(this.age * 20) * 0.5;
        ctx.fillStyle = '#5a1a8a'; ctx.fillRect(x - 3 - p, y - 3 - p, 6 + p * 2, 6 + p * 2);
        ctx.fillStyle = '#c070ff'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#ffe0ff'; ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      }
      case 'bolt':
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = '#ff3010'; ctx.fillRect(-6, -1, 12, 3);
        ctx.fillStyle = '#ffb090'; ctx.fillRect(-5, 0, 10, 1);
        ctx.restore();
        break;
      case 'rune':
        ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin * 0.5);
        ctx.fillStyle = '#1a8ab0'; ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = '#80f0ff'; ctx.fillRect(-2, -2, 4, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        break;
      case 'shard':
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = '#6a3aa0'; ctx.fillRect(-4, -1, 8, 3);
        ctx.fillStyle = '#e0c0ff'; ctx.fillRect(-2, 0, 5, 1);
        ctx.restore();
        break;
      case 'lavaball':
        ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin);
        ctx.fillStyle = '#5a1a08'; ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#e05010'; ctx.fillRect(-4, -4, 7, 7);
        ctx.fillStyle = '#ffc040'; ctx.fillRect(-2, -2, 3, 3);
        ctx.restore();
        break;
      default: break;
    }
  }
}

function spawnProjectile(kind, owner, x, y, ang, o) {
  const p = new Projectile(kind, owner, x, y, ang, o);
  Game.projectiles.push(p);
  return p;
}

// Баллистика: угол броска, чтобы попасть в точку (для огров и гранат).
function lobAngle(x0, y0, x1, y1, speed, g) {
  const dx = x1 - x0, dy = -(y1 - y0);
  const dir = dx >= 0 ? 1 : -1;
  const adx = Math.abs(dx);
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * adx * adx + 2 * dy * v2);
  let theta;
  if (disc < 0) theta = Math.PI / 4;
  else theta = Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(adx, 1)));
  // экранный угол: вверх = отрицательный y
  return dir > 0 ? -theta : Math.PI + theta;
}
