'use strict';
// Монстры: параметры, ИИ (зрение, слух, погоня, прыжки), атаки, междоусобицы, босс.

const MONSTER_DEFS = {
  grunt: { name: 'Солдат', hp: 30, w: 10, h: 22, speed: 55, pain: 0.8, painT: 0.25, gib: -35, mass: 1, voice: 1.2, headCol: '#b08868', drop: { shells: 5 }, cd: [1.1, 2.0], keep: 90, bleed: '#7a0a08' },
  dog: { name: 'Пёс', hp: 25, w: 18, h: 12, speed: 150, pain: 1, painT: 0.15, gib: -35, mass: 0.7, voice: 1.4, headCol: '#4a3220', cd: [0.4, 0.8], jump: 300 },
  enforcer: { name: 'Каратель', hp: 80, w: 11, h: 24, speed: 50, pain: 0.5, painT: 0.3, gib: -35, mass: 1.3, voice: 0.8, headCol: '#6a7078', drop: { cells: 5 }, cd: [1.3, 2.3], keep: 110 },
  knight: { name: 'Рыцарь', hp: 75, w: 11, h: 24, speed: 95, pain: 0.6, painT: 0.25, gib: -40, mass: 1.2, voice: 0.9, headCol: '#8a7a50', cd: [0.5, 0.9] },
  ogre: { name: 'Огр', hp: 200, w: 16, h: 28, speed: 48, pain: 0.35, painT: 0.3, gib: -80, mass: 3, voice: 0.55, headCol: '#9a7a5a', drop: { rockets: 2 }, cd: [1.6, 2.6] },
  zombie: { name: 'Зомби', hp: 60, w: 11, h: 22, speed: 26, pain: 1, painT: 0.45, gib: -9999, mass: 1, voice: 0.7, headCol: '#8a9a78', cd: [1.8, 3.0] },
  fiend: { name: 'Изверг', hp: 300, w: 20, h: 22, speed: 90, pain: 0.3, painT: 0.25, gib: -80, mass: 2.5, voice: 0.5, headCol: '#b89868', cd: [0.7, 1.3], jump: 340, squash: true },
  scrag: { name: 'Скраг', hp: 80, w: 14, h: 16, speed: 72, pain: 0.7, painT: 0.2, gib: -40, mass: 1, voice: 1.3, headCol: '#7a8048', fly: true, cd: [1.4, 2.4] },
  hknight: { name: 'Рыцарь Смерти', hp: 250, w: 12, h: 28, speed: 62, pain: 0.35, painT: 0.3, gib: -40, mass: 2, voice: 0.75, headCol: '#5a2018', cd: [1.3, 2.3] },
  vore: { name: 'Ворог', hp: 400, w: 22, h: 24, speed: 38, pain: 0.2, painT: 0.3, gib: -80, mass: 3, voice: 0.5, headCol: '#b08080', cd: [2.0, 3.2], keep: 140, squash: true },
  spawn: { name: 'Порождение', hp: 80, w: 12, h: 10, speed: 70, pain: 0, painT: 0, gib: -9999, mass: 0.8, voice: 1.6, headCol: '#2a4490', cd: [0.3, 0.7], squash: true },
  shambler: { name: 'Шамблер', hp: 600, w: 24, h: 36, speed: 52, pain: 0.12, painT: 0.3, gib: -60, mass: 6, voice: 0.4, headCol: '#cfc8b8', cd: [1.7, 2.8], halfExplosion: true },
  chthon: { name: 'Хтон', hp: 3, w: 56, h: 120, speed: 0, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 0.3, headCol: '#4a2c1c', boss: true, cd: [1.6, 2.4] },
};

const MONSTER_CHARS = { g: 'grunt', d: 'dog', e: 'enforcer', k: 'knight', o: 'ogre', z: 'zombie', f: 'fiend', s: 'scrag', n: 'hknight', v: 'vore', t: 'spawn', m: 'shambler', c: 'chthon' };

class Monster {
  constructor(type, cx, bottom) {
    const d = MONSTER_DEFS[type];
    this.isMonster = true;
    this.type = type;
    this.def = d;
    this.w = d.w; this.h = d.h;
    this.x = cx - d.w / 2; this.y = bottom - d.h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.noPlatforms = !!d.fly;
    this.health = d.hp;
    this.alive = true;
    this.state = 'idle';
    this.stateT = 0;
    this.facing = chance(0.5) ? 1 : -1;
    this.target = null;
    this.cd = rand(0.4, 1.2);
    this.thinkT = rand(0, 0.3);
    this.seeT = 0;
    this.canSee = false;
    this.anim = rand(0, 10);
    this.walkPhase = 0;
    this.hurtFlash = 0;
    this.fireAnim = 0;
    this.aimLocal = 0;
    this.deathT = 0;
    this.gibbed = false;
    this.fired = 0;
    this.stuckT = 0;
    this.jumpCd = 0;
    this.turnT = rand(2, 6);
    this.liquidT = 0;
    this.waterLevel = 0;
    this.seed = Math.random() * 10;
    this.attackKind = null;
    this.leapHit = false;
    this.counted = true;
    // босс
    this.hits = 0;
    this.throwT = 0;
    if (d.boss) this.y += 14; // босс по пояс в лаве
    this.baseY = this.y;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get moving() { return this.onGround && Math.abs(this.vx) > 5; }
  get air() { return !this.onGround && !this.def.fly; }
  eye() { return { x: this.cx + this.facing * 2, y: this.y + 5 }; }

  distTo(t) { return dist(this.cx, this.cy, t.cx, t.cy); }
  gapTo(t) {
    const gx = Math.max(t.x - (this.x + this.w), this.x - (t.x + t.w), 0);
    const gy = Math.max(t.y - (this.y + this.h), this.y - (t.y + t.h), 0);
    return Math.max(gx, gy * 1.5);
  }

  canSeeEntity(t) {
    const e = this.eye();
    const lv = Game.level;
    return lv.los(e.x, e.y, t.cx, t.cy) || lv.los(e.x, e.y, t.cx, t.y + 3);
  }

  alert(target, loud = true) {
    if (!this.alive || this.def.boss) return;
    const wasIdle = this.state === 'idle';
    this.target = target;
    if (wasIdle) {
      this.state = 'chase';
      this.cd = Math.max(this.cd, rand(0.3, 0.8));
      if (loud) {
        if (this.type === 'dog') Sound.play('bark', this.cx, this.cy);
        else if (this.type !== 'spawn') Sound.play('sight', this.cx, this.cy, { p: this.def.voice * rand(0.95, 1.05), gap: 0.15 });
        if (this.type === 'shambler') Sound.play('roar', this.cx, this.cy);
      }
      // будим соседей
      for (const m of Game.monsters) {
        if (m === this || !m.alive || m.state !== 'idle') continue;
        if (dist(m.cx, m.cy, this.cx, this.cy) < 170 && Game.level.los(m.cx, m.cy, this.cx, this.cy)) m.alert(target, false);
      }
    }
  }

  lookForPlayer() {
    const p = Game.player;
    if (!p || !p.alive) return;
    const d = this.distTo(p);
    const range = p.ring > 0 ? 70 : 380;
    if (d > range) return;
    const inFront = sign(p.cx - this.cx) === this.facing || d < 110;
    if (!inFront) return;
    if (this.canSeeEntity(p)) this.alert(p);
  }

  update(dt) {
    this.anim += dt;
    this.hurtFlash -= dt;
    this.fireAnim = Math.max(0, this.fireAnim - dt);
    if (!this.alive) { this.updateCorpse(dt); return; }
    if (this.def.boss) { this.updateBoss(dt); return; }
    this.updateLiquid(dt);
    if (!this.alive) return;
    this.cd -= dt;
    this.jumpCd -= dt;

    // проверка цели
    if (this.target && (!this.target.alive || (this.target.isPlayer && Game.player !== this.target))) {
      const p = Game.player;
      if (this.target !== p && p && p.alive) this.target = p;
      else { this.target = null; this.state = this.state === 'down' ? 'down' : 'idle'; }
    }
    if (this.target) {
      this.seeT -= dt;
      if (this.seeT <= 0) { this.seeT = 0.15; this.canSee = this.canSeeEntity(this.target); }
    }

    switch (this.state) {
      case 'idle':
        this.thinkT -= dt;
        if (this.thinkT <= 0) { this.thinkT = 0.2 + Math.random() * 0.1; this.lookForPlayer(); }
        this.turnT -= dt;
        if (this.turnT <= 0) { this.turnT = rand(3, 7); this.facing = -this.facing; }
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.def.fly) this.vy = Math.sin(this.anim * 1.5 + this.seed) * 8;
        break;
      case 'pain':
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 500 * dt);
        if (this.stateT <= 0) this.state = this.target ? 'chase' : 'idle';
        break;
      case 'chase':
        this.chase(dt);
        if (this.cd <= 0 && this.target) this.tryAttack();
        break;
      case 'attack':
        this.stateT += dt;
        this.faceTarget();
        this.vx = approach(this.vx, 0, (this.def.fly ? 200 : 900) * dt);
        if (this.def.fly) this.vy = approach(this.vy, 0, 200 * dt);
        ATTACKS[this.type](this, dt);
        break;
      case 'leap':
        this.stateT += dt;
        if (this.target && !this.leapHit && overlap(this, { x: this.target.x - 3, y: this.target.y - 3, w: this.target.w + 6, h: this.target.h + 6 })) {
          this.leapHit = true;
          const dmg = this.type === 'fiend' ? rand(30, 40) : 10;
          applyDamage(this.target, dmg, this, 'melee', this.facing * 150, -80);
          Sound.play(this.type === 'fiend' ? 'axehit' : 'bark', this.cx, this.cy);
        }
        if (this.onGround && this.stateT > 0.15) { this.state = 'chase'; this.cd = rand(...this.def.cd) * Game.skillCdScale(); }
        break;
      case 'down':
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.state = this.target ? 'chase' : 'idle';
          this.health = this.def.hp;
          this.h = this.def.h;
          this.y -= this.def.h - 6;
          Sound.play('sight', this.cx, this.cy, { p: 0.6 });
        }
        break;
      default: break;
    }

    // физика
    if (this.def.fly && this.state !== 'down') {
      moveBody(this, dt);
    } else {
      const g = this.waterLevel >= 2 ? 0.35 : 1;
      this.vy = Math.min(this.vy + GRAVITY * g * dt, 800);
      const res = moveBody(this, dt);
      this.blockedX = res.hitX;
      if (this.waterLevel >= 2) { this.vx *= 0.97; this.vy *= 0.97; }
    }
    if (this.moving) this.walkPhase += dt * Math.abs(this.vx) * 0.12;
    if (this.state !== 'attack' && this.state !== 'leap') this.fired = 0;
  }

  faceTarget() {
    if (!this.target) return;
    const t = this.target;
    this.facing = t.cx >= this.cx ? 1 : -1;
    const a = Math.atan2(t.cy - (this.y + this.h * 0.4), t.cx - this.cx);
    this.aimLocal = this.facing > 0 ? a : Math.PI - a;
  }

  chase(dt) {
    const t = this.target;
    if (!t) { this.state = 'idle'; return; }
    this.faceTarget();
    const dx = t.cx - this.cx;
    const adx = Math.abs(dx);
    const speed = this.def.speed * (this.waterLevel >= 2 ? 0.6 : 1);
    if (this.def.fly) {
      const tx = t.cx + Math.sin(this.anim * 0.7 + this.seed) * 50;
      const ty = t.y - 34 + Math.sin(this.anim * 1.3 + this.seed) * 16;
      const ddx = tx - this.cx, ddy = ty - this.cy;
      const d = Math.hypot(ddx, ddy) || 1;
      const keep = 70;
      const k = d > keep ? 1 : -0.4;
      this.vx = approach(this.vx, ddx / d * speed * k, 260 * dt);
      this.vy = approach(this.vy, ddy / d * speed * (d > keep ? 1 : 0.3), 260 * dt);
      return;
    }
    let want = 0;
    const keep = this.canSee ? (this.def.keep || 0) : 0;
    if (adx > Math.max(4, keep)) want = sign(dx);
    if (this.type === 'spawn') want = 0;
    if (want !== 0 && this.onGround) {
      const aheadX = want > 0 ? this.x + this.w + 3 : this.x - 3;
      const g = groundBelow(aheadX, this.y + this.h + 1, 5);
      const targetBelow = t.y + t.h > this.y + this.h + 20;
      if (g === -1 || (g === null && !targetBelow)) want = 0;
    }
    const accel = this.onGround ? 900 : 300;
    this.vx = approach(this.vx, want * speed, accel * dt);
    if (this.onGround && want !== 0 && this.blockedX && this.jumpCd <= 0) {
      this.vy = -(this.def.jump || 330);
      this.jumpCd = 0.7;
      this.stuckT += 1;
      if (this.stuckT > 4) { this.stuckT = 0; this.vx = -want * speed; this.jumpCd = 1.5; }
    }
    if (!this.blockedX && this.onGround) this.stuckT = Math.max(0, this.stuckT - dt);
    // монстр застрял под целью, которая стоит выше — изредка подпрыгивает
    if (this.onGround && adx < 20 && t.y + t.h < this.y - 20 && this.jumpCd <= 0) { this.vy = -(this.def.jump || 330); this.jumpCd = 1.2; }
  }

  startAttack(kind) {
    this.state = 'attack';
    this.stateT = 0;
    this.fired = 0;
    this.attackKind = kind;
  }

  endAttack() {
    this.state = 'chase';
    this.cd = rand(this.def.cd[0], this.def.cd[1]) * Game.skillCdScale();
  }

  tryAttack() {
    const t = this.target;
    const d = this.distTo(t);
    const gap = this.gapTo(t);
    const see = this.canSee;
    switch (this.type) {
      case 'grunt': if (see && d < 360) this.startAttack('ranged'); break;
      case 'enforcer': if (see && d < 380) this.startAttack('ranged'); break;
      case 'dog':
        if (gap < 6) this.startAttack('melee');
        else if (see && this.onGround && d > 45 && d < 150 && Math.abs(t.cy - this.cy) < 50) this.leap(260, 230);
        break;
      case 'knight': if (gap < 8) this.startAttack('melee'); break;
      case 'hknight':
        if (gap < 8) this.startAttack('melee');
        else if (see && d < 380 && d > 50) this.startAttack('ranged');
        break;
      case 'ogre':
        if (gap < 8) this.startAttack('melee');
        else if (see && d > 70 && d < 380) this.startAttack('ranged');
        break;
      case 'zombie': if (see && d < 340) this.startAttack('ranged'); break;
      case 'fiend':
        if (gap < 7) this.startAttack('melee');
        else if (see && this.onGround && d > 55 && d < 230 && Math.abs(t.cy - this.cy) < 70) this.leap(330, 250);
        break;
      case 'scrag': if (see && d < 380) this.startAttack('ranged'); break;
      case 'vore': if (see && d < 420) this.startAttack('ranged'); break;
      case 'shambler':
        if (gap < 10) this.startAttack('melee');
        else if (see && d < 420) this.startAttack('ranged');
        break;
      case 'spawn':
        if (this.onGround) {
          this.vy = -rand(260, 340);
          this.vx = sign(t.cx - this.cx) * rand(90, 150);
          this.state = 'leap'; this.stateT = 0; this.leapHit = false;
          Sound.play('splat', this.cx, this.cy, { vol: 0.5 });
        }
        break;
      default: break;
    }
  }

  leap(vx, vy) {
    this.state = 'leap';
    this.stateT = 0;
    this.leapHit = false;
    this.vx = this.facing * vx;
    this.vy = -vy;
    this.onGround = false;
    Sound.play('sight', this.cx, this.cy, { p: this.def.voice * 1.2, gap: 0.2 });
  }

  meleeHit(range, dmg, sound) {
    const t = this.target;
    if (t && this.gapTo(t) < range) {
      applyDamage(t, dmg, this, 'melee', this.facing * 80, -40);
      FX.blood(t.cx, t.cy, this.facing, 0, 5);
      Sound.play(sound || 'axehit', this.cx, this.cy);
      return true;
    }
    Sound.play('sword', this.cx, this.cy);
    return false;
  }

  shootPoint() { return { x: this.cx + this.facing * 5, y: this.y + this.h * 0.4 }; }

  aimAt(t, spreadByDist = 0) {
    const s = this.shootPoint();
    const d = dist(s.x, s.y, t.cx, t.cy);
    // упреждение для медленных снарядов
    return Math.atan2(t.cy - s.y, t.cx - s.x) + rand(-1, 1) * spreadByDist * Math.min(1, d / 300);
  }

  updateLiquid(dt) {
    if (this.def.fly) return;
    const wl = computeWaterLevel(this);
    this.waterLevel = wl.level;
    if (wl.level > 0 && (wl.type === T.LAVA || wl.type === T.SLIME)) {
      this.liquidT -= dt;
      if (this.liquidT <= 0) {
        this.liquidT = wl.type === T.LAVA ? 0.25 : 1;
        this.takeDamage((wl.type === T.LAVA ? 10 : 4) * wl.level, null, wl.type === T.LAVA ? 'lava' : 'slime');
      }
    }
  }

  takeDamage(dmg, attacker, kind, kx = 0, ky = 0) {
    if (this.gibbed) return;
    if (this.def.boss) {
      if (attacker && attacker.isPlayer && !Game.bossHintShown) {
        Game.bossHintShown = true;
        HUD.center('Оружие бессильно против Хтона!\nИщите иной способ...', 3);
      }
      return;
    }
    if (this.def.halfExplosion && kind === 'explosion') dmg *= 0.5;
    const m = this.def.mass;
    this.vx += kx / m;
    this.vy += ky / m;
    if (ky / m < -40) this.onGround = false;
    if (!this.alive) {
      this.health -= dmg;
      if (this.health < this.def.gib) this.gib();
      return;
    }
    if (this.type === 'zombie') { this.zombieDamage(dmg, attacker); return; }
    this.health -= dmg;
    this.hurtFlash = 0.08;
    this.retarget(attacker);
    if (this.health <= 0) { this.die(attacker); return; }
    if (Math.random() < this.def.pain * Game.skillPainScale() && this.state !== 'leap' && this.state !== 'pain') {
      this.state = 'pain';
      this.stateT = this.def.painT;
      Sound.play('mpain', this.cx, this.cy, { p: this.def.voice * rand(0.9, 1.1), gap: 0.1 });
    }
  }

  retarget(attacker) {
    if (!attacker || attacker === this || !attacker.alive) return;
    if (attacker.isPlayer) {
      if (this.target !== attacker) { this.target = attacker; if (this.state === 'idle') this.state = 'chase'; }
    } else if (attacker.isMonster && attacker.type !== this.type && !attacker.def.boss) {
      // междоусобица, как в Quake
      this.target = attacker;
      if (this.state === 'idle') this.state = 'chase';
    }
  }

  zombieDamage(dmg, attacker) {
    this.hurtFlash = 0.08;
    this.retarget(attacker);
    if (dmg >= 60) { this.health = -100; this.die(attacker); return; }
    if (this.state === 'down') { this.stateT = Math.max(this.stateT, 4); return; }
    this.health -= dmg;
    if (this.health <= 0) {
      this.state = 'down';
      this.stateT = 5;
      this.y += this.h - 6;
      this.h = 6;
      Sound.play('mdeath', this.cx, this.cy, { p: 0.7 });
      FX.blood(this.cx, this.cy, 0, -1, 10);
      return;
    }
    if (this.state !== 'pain') {
      this.state = 'pain';
      this.stateT = this.def.painT;
      Sound.play('mpain', this.cx, this.cy, { p: 0.7 });
    }
  }

  die(attacker) {
    this.alive = false;
    this.deathT = 0;
    this.state = 'dead';
    if (this.counted) Game.kills++;
    if (attacker && attacker.isPlayer) Game.player.lastKill = this.def.name;
    if (this.def.drop) Game.dropBackpack(this.cx, this.y + this.h / 2, this.def.drop);
    if (this.type === 'spawn') {
      this.gibbed = true;
      explode(this.cx, this.cy, 120, 72, this, this);
      return;
    }
    if (this.health < this.def.gib || this.type === 'zombie') { this.gib(); return; }
    Sound.play('mdeath', this.cx, this.cy, { p: this.def.voice * rand(0.9, 1.1) });
    FX.blood(this.cx, this.cy, 0, -1, 8);
  }

  gib() {
    if (this.gibbed) return;
    this.gibbed = true;
    this.alive = false;
    Sound.play('gib', this.cx, this.cy);
    const n = Math.min(10, 4 + Math.round(this.w * this.h / 90));
    for (let i = 0; i < n; i++) {
      FX.gib(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-220, 220) + this.vx * 0.3, rand(-360, -80), pick(['#6a1a10', '#8a2a1a', '#5a0a08', this.def.headCol]), randInt(2, 4));
    }
    FX.gib(this.cx, this.y + 4, rand(-120, 120), rand(-340, -180), this.def.headCol, 5, true, this.type);
    FX.blood(this.cx, this.cy, 0, -1, 24, 2.5);
  }

  updateCorpse(dt) {
    this.deathT += dt;
    this.vy = Math.min(this.vy + GRAVITY * dt, 800);
    this.vx = approach(this.vx, 0, (this.onGround ? 500 : 60) * dt);
    moveBody(this, dt);
  }

  // --- босс ---
  updateBoss(dt) {
    const p = Game.player;
    this.throwT = Math.max(0, this.throwT - dt);
    this.stateT += dt;
    const rest = this.baseY;
    const hidden = rest + this.h + 10;
    switch (this.state) {
      case 'idle':
        this.y = hidden;
        if (p && p.alive && Math.abs(p.cx - this.cx) < 430) {
          this.state = 'rise'; this.stateT = 0;
          Sound.play('roar'); Game.shake(this.cx, this.cy, 10);
          HUD.center('Хтон пробуждается!', 2.5);
        }
        break;
      case 'rise':
        this.y = lerp(hidden, rest, clamp(this.stateT / 2.5, 0, 1));
        if (Math.random() < 0.4) FX.sparks(this.cx + rand(-30, 30), rest + 70, 2, '#ff8030', 120);
        if (this.stateT > 2.5) { this.state = 'active'; this.stateT = 0; this.cd = 1; }
        break;
      case 'active':
        this.y = rest + Math.sin(this.anim * 1.2) * 3;
        if (p) this.facing = p.cx >= this.cx ? 1 : -1;
        this.cd -= dt;
        if (this.cd <= 0 && p && p.alive) {
          this.cd = rand(...this.def.cd) * Game.skillCdScale();
          this.throwT = 0.6;
          Game.later(0.3, () => {
            if (!this.alive || !Game.player) return;
            const sx = this.cx + this.facing * 34, sy = this.y + 24;
            const tp = Game.player;
            const lead = tp.vx * 0.4;
            const g = PROJ.lavaball.grav;
            // скорость подбирается под дальность, иначе шар не долетит до дальних уступов
            const dx = Math.abs(tp.cx + lead - sx), rise = Math.max(0, sy - tp.cy);
            const speed = Math.max(300, Math.sqrt(g * (dx + rise * 1.5)) * 1.12);
            const ang = lobAngle(sx, sy, tp.cx + lead, tp.cy, speed, g);
            spawnProjectile('lavaball', this, sx, sy, ang, { speed });
            Sound.play('fireball', sx, sy);
          });
        }
        break;
      case 'pain':
        this.y = rest + Math.sin(this.stateT * 40) * 2;
        if (this.stateT > 1.4) { this.state = 'active'; this.stateT = 0; this.cd = 0.8; }
        break;
      case 'dying':
        this.y = lerp(rest, hidden + 20, clamp(this.stateT / 3.5, 0, 1));
        if (Math.random() < 0.6) FX.sparks(this.cx + rand(-30, 30), rest + rand(20, 70), 3, '#ff8030', 160);
        if (this.stateT > 3.5) {
          this.alive = false;
          this.gibbed = true;
          Game.kills++;
          Game.onBossDefeated();
        }
        break;
      default: break;
    }
  }

  bossHit() {
    if (!this.alive || (this.state !== 'active' && this.state !== 'pain')) return false;
    this.hits++;
    this.hurtFlash = 0.3;
    Sound.play('roar');
    Game.shake(this.cx, this.cy, 12);
    if (this.hits >= this.def.hp) {
      this.state = 'dying'; this.stateT = 0;
      HUD.center('Хтон повержен!', 3);
    } else { this.state = 'pain'; this.stateT = 0; }
    return true;
  }

  lights(out) {
    if (this.type === 'chthon' && this.state !== 'idle') out.push({ x: this.cx, y: this.y + 40, r: 180, c: [1, 0.5, 0.2], i: 0.7 });
    if (this.type === 'shambler' && this.state === 'attack' && this.attackKind === 'ranged') {
      out.push({ x: this.cx + this.facing * 6, y: this.y - 8, r: 70, c: [0.6, 0.7, 1], i: 0.8 * Math.random() + 0.3 });
    }
  }

  draw(ctx, cam) {
    if (this.gibbed) return;
    if (this.type === 'chthon' && this.state === 'idle') return;
    const x = Math.round(this.cx - cam.x), y = Math.round(this.y + this.h - cam.y);
    if (x < -80 || x > ctx.canvas.width + 80 || y < -40 || y > ctx.canvas.height + 140) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.facing, 1);
    const lying = !this.alive || this.state === 'down';
    if (lying) {
      const k = this.state === 'down' ? 1 : Math.min(1, this.deathT / 0.35);
      if (this.def.squash || this.def.fly) {
        ctx.scale(1, 1 - k * 0.55);
      } else {
        ctx.translate(0, -k * Math.min(5, this.w / 2));
        ctx.rotate(-k * Math.PI / 2);
      }
    }
    SPR_FLASH = this.hurtFlash > 0;
    if (!this.alive) ctx.globalAlpha = 1;
    MONSTER_ART[this.type](ctx, this);
    SPR_FLASH = false;
    ctx.restore();
  }

  drawBright(ctx, cam) {
    if (!this.alive) return;
    const x = Math.round(this.cx - cam.x), y = Math.round(this.y - cam.y);
    if (this.type === 'shambler' && this.state === 'attack' && this.attackKind === 'ranged' && this.stateT < 0.8) {
      const hx = x + this.facing * 4, hy = y - 10;
      drawLightning(ctx, hx - 6, hy + rand(-2, 2), hx + 6, hy + rand(-2, 2), '#c8d8ff', 1, 0.9);
    }
    if (this.type === 'hknight') {
      ctx.fillStyle = '#ff6030';
      const ex = x + (this.facing > 0 ? 1 : -4);
      ctx.fillRect(ex, y + 3, 3, 1);
    }
    if (this.type === 'dog' || this.type === 'scrag') {
      ctx.fillStyle = '#ff3010';
      const bob = this.type === 'scrag' ? Math.round(Math.sin(this.anim * 4) * 1.5) : 0;
      const ey = this.type === 'dog' ? y + this.h - 11 : y + this.h - 14 + bob;
      ctx.fillRect(x + this.facing * (this.type === 'dog' ? 7 : 1) - (this.facing < 0 ? 1 : 0), ey, this.type === 'scrag' ? 2 * this.facing : 1, 1);
    }
  }
}

// Таймлайны атак: stateT растёт от 0; fired — счётчик уже сделанных «выстрелов».
const ATTACKS = {
  grunt(m) {
    if (m.fired === 0 && m.stateT > 0.4) {
      m.fired = 1;
      const s = m.shootPoint();
      hitscan(m, s.x, s.y, m.aimAt(m.target, 0.05), 4, 4, 0.07, 600);
      Sound.play('gunshot', m.cx, m.cy);
      FX.light(s.x + m.facing * 8, s.y, 70, [1, 0.8, 0.5], 1, 0.07);
      m.fireAnim = 0.12;
    }
    if (m.stateT > 0.75) m.endAttack();
  },
  enforcer(m) {
    for (const [i, tt] of [[0, 0.35], [1, 0.6]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        const s = m.shootPoint();
        spawnProjectile('laser', m, s.x + m.facing * 8, s.y - 2, m.aimAt(m.target, 0.04));
        Sound.play('laser', m.cx, m.cy);
        m.fireAnim = 0.1;
      }
    }
    if (m.stateT > 0.9) m.endAttack();
  },
  dog(m) {
    if (m.fired === 0 && m.stateT > 0.15) { m.fired = 1; m.meleeHit(8, rand(6, 10), 'bark'); }
    if (m.stateT > 0.4) m.endAttack();
  },
  knight(m) {
    if (m.fired === 0 && m.stateT > 0.25) { m.fired = 1; m.meleeHit(12, rand(10, 16), 'axehit'); }
    if (m.stateT > 0.5) m.endAttack();
  },
  hknight(m) {
    if (m.attackKind === 'melee') {
      if (m.fired === 0 && m.stateT > 0.3) { m.fired = 1; m.meleeHit(13, rand(12, 20), 'axehit'); }
      if (m.stateT > 0.55) m.endAttack();
      return;
    }
    if (m.fired === 0 && m.stateT > 0.45) {
      m.fired = 1;
      const s = m.shootPoint();
      const base = m.aimAt(m.target);
      for (let i = -2.5; i <= 2.5; i += 1) spawnProjectile('fireball', m, s.x, s.y - 4, base + i * 0.09);
      Sound.play('fireball', m.cx, m.cy);
    }
    if (m.stateT > 0.95) m.endAttack();
  },
  ogre(m) {
    if (m.attackKind === 'melee') {
      if (m.stateT > 0.15 && m.stateT < 0.7) {
        const k = Math.floor((m.stateT - 0.15) / 0.1);
        if (k >= m.fired) {
          m.fired = k + 1;
          const t = m.target;
          if (t && m.gapTo(t) < 12) {
            applyDamage(t, 5, m, 'melee', m.facing * 30, 0);
            FX.blood(t.cx, t.cy, m.facing, -0.5, 4);
          }
          Sound.play('chainsaw', m.cx, m.cy, { gap: 0.25 });
        }
      }
      if (m.stateT > 0.8) m.endAttack();
      return;
    }
    if (m.fired === 0 && m.stateT > 0.4) {
      m.fired = 1;
      const s = m.shootPoint();
      const t = m.target;
      const ang = lobAngle(s.x, s.y - 6, t.cx, t.cy, 330, PROJ.grenade.grav);
      spawnProjectile('grenade', m, s.x, s.y - 6, ang, { speed: 330, splash: 40 });
      Sound.play('grenade', m.cx, m.cy);
    }
    if (m.stateT > 0.8) m.endAttack();
  },
  zombie(m) {
    if (m.fired === 0 && m.stateT > 0.5) {
      m.fired = 1;
      const s = { x: m.cx, y: m.y + 4 };
      const t = m.target;
      const ang = lobAngle(s.x, s.y, t.cx, t.cy, 300, PROJ.flesh.grav);
      spawnProjectile('flesh', m, s.x, s.y, ang, { speed: 300 });
      Sound.play('spit', m.cx, m.cy);
    }
    if (m.stateT > 0.9) m.endAttack();
  },
  fiend(m) {
    if (m.fired === 0 && m.stateT > 0.2) { m.fired = 1; m.meleeHit(10, rand(10, 15), 'axehit'); }
    if (m.stateT > 0.45) m.endAttack();
  },
  scrag(m) {
    for (const [i, tt] of [[0, 0.3], [1, 0.45], [2, 0.6]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        spawnProjectile('spike', m, m.cx + m.facing * 4, m.cy, m.aimAt(m.target, 0.06));
        Sound.play('spit', m.cx, m.cy);
      }
    }
    if (m.stateT > 0.9) m.endAttack();
  },
  vore(m) {
    if (m.fired === 0 && m.stateT > 0.6) {
      m.fired = 1;
      spawnProjectile('voreball', m, m.cx + m.facing * 6, m.y + 8, m.aimAt(m.target) - 0.5, { target: m.target });
      Sound.play('voreball', m.cx, m.cy);
    }
    if (m.stateT > 1.2) m.endAttack();
  },
  spawn() { /* атака — прыжок, см. tryAttack */ },
  shambler(m) {
    if (m.attackKind === 'melee') {
      if (m.fired === 0 && m.stateT > 0.4) { m.fired = 1; m.meleeHit(14, rand(35, 45), 'gib'); }
      if (m.stateT > 0.75) m.endAttack();
      return;
    }
    if (m.fired === 0) { m.fired = 1; Sound.play('charge', m.cx, m.cy); }
    for (const [i, tt] of [[1, 0.8], [2, 0.9], [3, 1.0]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        const s = { x: m.cx + m.facing * 4, y: m.y + 6 };
        lightningRay(m, s.x, s.y, Math.atan2(m.target.cy - s.y, m.target.cx - s.x), 480, 10);
        Sound.play('lightning', m.cx, m.cy, { gap: 0.05 });
      }
    }
    if (m.stateT > 1.2) m.endAttack();
  },
  chthon() { /* босс атакует в updateBoss */ },
};
