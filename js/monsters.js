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
  gargoyle: { name: 'Гаргулья', hp: 110, w: 16, h: 16, speed: 95, pain: 0.4, painT: 0.2, gib: -50, mass: 1.5, voice: 0.9, headCol: '#7a7a70', fly: true, cd: [1.1, 2.0] },
  shub: { name: 'Шуб-Ниггурат', hp: 1, w: 84, h: 92, speed: 0, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 0.3, headCol: '#4a2a3a', boss: true, cd: [2.2, 3.2] },
  scorpion: { name: 'Скорпион', hp: 110, w: 20, h: 12, speed: 115, pain: 0.35, painT: 0.2, gib: -60, mass: 1.5, voice: 1.6, headCol: '#7a6a3a', cd: [0.9, 1.7], keep: 80, jump: 300, squash: true },
  eel: { name: 'Угорь', hp: 60, w: 20, h: 8, speed: 95, pain: 0.3, painT: 0.2, gib: -40, mass: 0.7, voice: 1.8, headCol: '#2a4a5a', swim: true, cd: [1.1, 1.9], squash: true },
  pylon: { name: 'Кристалл', hp: 250, w: 14, h: 30, speed: 0, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 1, headCol: '#c040ff', static: true, cd: [9, 9] },
  herald: { name: 'Вестник Бездны', hp: 2200, w: 40, h: 56, speed: 75, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 0.35, headCol: '#3a2a44', boss: true, fly: true, cd: [1.3, 2.0] },
  phantom: { name: 'Фантом', hp: 90, w: 11, h: 24, speed: 80, pain: 0.4, painT: 0.2, gib: -40, mass: 0.9, voice: 1.5, headCol: '#6a5a8a', cd: [1.0, 1.8], keep: 110, blink: true },
  guardian: { name: 'Страж', hp: 320, w: 16, h: 30, speed: 45, pain: 0.15, painT: 0.3, gib: -80, mass: 4, voice: 0.45, headCol: '#5a6478', drop: { cells: 6 }, cd: [1.4, 2.4] },
  elder: { name: 'Древний', hp: 3200, w: 52, h: 76, speed: 70, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 0.3, headCol: '#2a3a4a', boss: true, fly: true, cd: [1.4, 2.1] },
  chthon: { name: 'Хтон', hp: 3, w: 56, h: 120, speed: 0, pain: 0, painT: 0, gib: -9999, mass: 99, voice: 0.3, headCol: '#4a2c1c', boss: true, cd: [1.6, 2.4] },
};

const SHUB_EYES = [[-18, -62], [-6, -70], [8, -66], [20, -56], [-24, -44], [26, -40], [0, -50], [-12, -34], [14, -30]];

const MONSTER_CHARS = { g: 'grunt', d: 'dog', e: 'enforcer', k: 'knight', o: 'ogre', z: 'zombie', f: 'fiend', s: 'scrag', n: 'hknight', v: 'vore', t: 'spawn', m: 'shambler', c: 'chthon', a: 'gargoyle', w: 'shub', r: 'scorpion', u: 'eel', y: 'pylon', h: 'herald', p: 'phantom', q: 'guardian', j: 'elder' };

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
    if (type === 'chthon') this.y += 14; // Хтон по пояс в лаве
    if (type === 'shub') this.facing = 1;
    if (d.static) { this.counted = false; this.facing = 1; }
    if (type === 'herald' || type === 'elder') { this.health = Math.round(d.hp * [0.7, 1, 1.2, 1.4][Game.skill || 1]); this.maxHealth = this.health; this.homeX = this.x; this.homeY = this.y; }
    this.blinkCd = rand(1, 3);
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
    if (!this.alive || this.def.boss || this.def.static) return;
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
    // угорь чует всплеск: замечает героя в воде с любой стороны
    const splash = this.def.swim && p.waterLevel > 0 && d < 300;
    const inFront = splash || sign(p.cx - this.cx) === this.facing || d < 110;
    if (!inFront) return;
    if (this.canSeeEntity(p)) this.alert(p);
  }

  update(dt) {
    this.anim += dt;
    this.hurtFlash -= dt;
    this.fireAnim = Math.max(0, this.fireAnim - dt);
    if (!this.alive) { this.updateCorpse(dt); return; }
    if (this.def.boss) { this.updateBoss(dt); return; }
    if (this.def.static) return;
    if (!this.def.swim) this.updateLiquid(dt);
    if (!this.alive) return;
    this.cd -= dt;
    this.jumpCd -= dt;
    this.blinkCd -= dt;
    this.shieldFlash = (this.shieldFlash || 0) - dt;

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
        if (this.def.swim) { this.vx = Math.sin(this.anim * 0.6 + this.seed) * 35; this.vy = Math.sin(this.anim * 1.1 + this.seed) * 12; this.facing = this.vx >= 0 ? 1 : -1; }
        break;
      case 'pain':
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 500 * dt);
        if (this.stateT <= 0) this.state = this.target ? 'chase' : 'idle';
        break;
      case 'chase':
        if (this.def.blink && this.blinkCd <= 0 && this.target && (!this.canSee || this.stuckT > 2)) {
          this.lostT = (this.lostT || 0) + dt;
          if (this.lostT > 1.5 && this.blinkNear(this.target)) this.lostT = 0;
        } else this.lostT = 0;
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
          const dmg = this.type === 'fiend' ? rand(30, 40) : this.type === 'gargoyle' ? rand(12, 18) : 10;
          applyDamage(this.target, dmg, this, 'melee', this.facing * 150, -80);
          Sound.play(this.type === 'fiend' || this.type === 'gargoyle' ? 'axehit' : 'bark', this.cx, this.cy);
        }
        if (this.def.fly) {
          // гаргулья после пике взмывает вверх
          if (this.stateT > 0.75 || this.leapHit || this.blockedX) {
            this.state = 'chase'; this.vy = -150; this.vx *= 0.3;
            this.cd = rand(...this.def.cd) * Game.skillCdScale();
          }
        } else if (this.onGround && this.stateT > 0.15) { this.state = 'chase'; this.cd = rand(...this.def.cd) * Game.skillCdScale(); }
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
      this.blockedX = moveBody(this, dt).hitX;
    } else if (this.def.swim) {
      // угорь не покидает воду
      const px = this.x, py = this.y;
      moveBody(this, dt);
      if (!Game.level.liquidAt(this.cx, this.cy)) { this.x = px; this.y = py; this.vy = Math.abs(this.vy) * 0.5 + 25; }
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
    if (this.def.swim) {
      const ddx = t.cx - this.cx, ddy = t.cy - this.cy;
      const d = Math.hypot(ddx, ddy) || 1;
      this.vx = approach(this.vx, ddx / d * speed, 300 * dt);
      this.vy = approach(this.vy, ddy / d * speed, 300 * dt);
      return;
    }
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
      case 'scorpion':
        if (gap < 8) this.startAttack('melee');
        else if (see && d < 330) this.startAttack('ranged');
        break;
      case 'phantom': if (see && d < 360) this.startAttack('ranged'); break;
      case 'guardian':
        if (gap < 14) this.startAttack('melee');
        else if (see && d < 400) this.startAttack('ranged');
        break;
      case 'eel':
        if (see && d < 95 && computeWaterLevel(t).level > 0) this.startAttack('ranged');
        break;
      case 'gargoyle':
        if (see && d < 250) {
          const a = Math.atan2(t.cy - this.cy, t.cx - this.cx);
          this.state = 'leap'; this.stateT = 0; this.leapHit = false;
          this.vx = Math.cos(a) * 330; this.vy = Math.sin(a) * 330;
          Sound.play('sight', this.cx, this.cy, { p: 1.6, gap: 0.2 });
        }
        break;
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
    if (wl.level > 0 && wl.type === T.VOID) {
      // пустота поглощает без следа
      this.alive = false; this.gibbed = true;
      if (this.counted) Game.kills++;
      Sound.play('death', this.cx, this.cy, { p: 0.5 });
      FX.teleport(this.cx, this.cy);
      return;
    }
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
    if (this.type === 'herald') { this.heraldDamage(dmg, attacker, kind); return; }
    if (this.type === 'elder') { this.elderDamage(dmg, attacker, kind); return; }
    if (this.def.boss) {
      if (this.type === 'shub' && kind === 'telefrag' && this.alive && this.state !== 'dying') {
        this.state = 'dying'; this.stateT = 0;
        HUD.center('Шуб-Ниггурат разорвана изнутри!', 3);
        Sound.play('roar'); Sound.play('gib');
        for (const m of Game.monsters) if (m.minion && m.alive) applyDamage(m, 5000, attacker, 'telefrag');
        return;
      }
      this.hurtFlash = 0.05;
      if (attacker && attacker.isPlayer && !Game.bossHintShown) {
        Game.bossHintShown = true;
        HUD.center(this.type === 'shub' ? 'Её плоть не берёт оружие!\nПроникните внутрь...' : 'Оружие бессильно против Хтона!\nИщите иной способ...', 3);
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
    if (this.type === 'guardian' && this.state !== 'attack' && kind !== 'explosion' && attacker && attacker !== this && sign(attacker.cx - this.cx) === this.facing) {
      // щит стража держит удары спереди, пока он не замахнулся
      dmg *= 0.25;
      this.shieldFlash = 0.2;
      Sound.play('shield', this.cx, this.cy, { gap: 0.1 });
      FX.sparks(this.cx + this.facing * 9, this.cy, 3, '#80e0ff', 100);
    }
    this.health -= dmg;
    this.hurtFlash = 0.08;
    if (!this.def.static) this.retarget(attacker);
    if (this.health <= 0) { this.die(attacker); return; }
    if (this.def.blink && this.blinkCd <= 0 && this.target && Math.random() < 0.45) { this.blinkNear(this.target); return; }
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
    if (this.type === 'pylon') {
      this.gibbed = true;
      FX.explosion(this.cx, this.cy, 0.7);
      Sound.play('explode', this.cx, this.cy);
      Sound.play('zap', this.cx, this.cy);
      for (let i = 0; i < 12; i++) FX.gib(this.cx, this.y + rand(0, this.h), rand(-220, 220), rand(-320, -80), pick(['#c040ff', '#e090ff', '#6a2a8a']), randInt(2, 4), false);
      Game.onPylonDestroyed();
      return;
    }
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
    if (this.type === 'shub') { this.updateShub(dt); return; }
    if (this.type === 'herald') { this.updateHerald(dt); return; }
    if (this.type === 'elder') { this.updateElder(dt); return; }
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

  // --- Шуб-Ниггурат: неподвижна, плюётся шарами и порождает слуг; погибает только от телефрага ---
  updateShub(dt) {
    const p = Game.player;
    this.stateT += dt;
    this.hurtFlash -= dt;
    switch (this.state) {
      case 'idle':
        if (p && p.alive && dist(p.cx, p.cy, this.cx, this.cy) < 520) {
          this.state = 'active'; this.stateT = 0; this.cd = 2; this.spawnCd = 2.5;
          Sound.play('roar'); Game.shake(this.cx, this.cy, 8);
          HUD.center('Шуб-Ниггурат пробудилась!', 2.5);
        }
        break;
      case 'active': {
        this.cd -= dt; this.spawnCd -= dt;
        if (this.cd <= 0 && p && p.alive) {
          this.cd = rand(...this.def.cd) * Game.skillCdScale();
          const sx = this.cx, sy = this.y + 40;
          if (Game.level.los(sx, sy, p.cx, p.cy)) {
            spawnProjectile('voreball', this, sx, sy, Math.atan2(p.cy - sy, p.cx - sx) - 0.4 + Math.random() * 0.8, { target: p });
            Sound.play('voreball', sx, sy);
          }
        }
        if (this.spawnCd <= 0) {
          this.spawnCd = rand(5, 8) * Game.skillCdScale();
          const alive = Game.monsters.filter((m) => m.minion && m.alive).length;
          if (alive < 5) this.spawnMinion();
        }
        break;
      }
      case 'dying':
        this.shubBoomT = (this.shubBoomT || 0) - dt;
        if (this.shubBoomT <= 0) {
          this.shubBoomT = 0.18;
          const x = this.x + rand(0, this.w), y = this.y + rand(0, this.h);
          FX.explosion(x, y, 0.8);
          Sound.play('explode', x, y);
          FX.blood(x, y, 0, -1, 12, 2);
          Game.shake(x, y, 6);
        }
        if (this.stateT > 3) {
          this.alive = false;
          this.gibbed = true;
          Game.kills++;
          for (let i = 0; i < 30; i++) FX.gib(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-300, 300), rand(-450, -100), pick(['#3a2430', '#5a2a3a', '#7a1a10', '#2a1a20']), randInt(3, 6));
          FX.explosion(this.cx, this.cy, 2);
          Sound.play('gib');
          Game.onBossDefeated();
        }
        break;
      default: break;
    }
  }

  // --- Вестник Бездны: летает под сводом, щит держат кристаллы ---
  heraldShielded() { return Game.monsters.some((m) => m.type === 'pylon' && m.alive); }

  heraldWake() {
    if (this.state !== 'idle') return;
    this.state = 'active'; this.stateT = 0; this.cd = 1.5; this.pattern = 0;
    Sound.play('roar'); Game.shake(this.cx, this.cy, 8);
    HUD.center('Вестник Бездны явился!', 2.5);
  }

  heraldDamage(dmg, attacker, kind) {
    if (!this.alive || this.state === 'dying') return;
    if (attacker && attacker.isPlayer) this.heraldWake();
    if (this.heraldShielded()) {
      this.shieldFlash = 0.25;
      Sound.play('shield', this.cx, this.cy, { gap: 0.08 });
      if (attacker && attacker.isPlayer && !Game.bossHintShown) {
        Game.bossHintShown = true;
        HUD.center('Щит Вестника питают кристаллы!\nРазбейте их.', 3);
      }
      return;
    }
    this.health -= dmg;
    this.hurtFlash = 0.06;
    if (this.health <= 0) {
      this.state = 'dying'; this.stateT = 0;
      HUD.center('Вестник Бездны повержен!', 3);
      Sound.play('roar');
      for (const m of Game.monsters) if (m.minion && m.alive) applyDamage(m, 5000, attacker, 'telefrag');
    }
  }

  updateHerald(dt) {
    const p = Game.player;
    this.stateT += dt;
    this.hurtFlash -= dt;
    this.castT = Math.max(0, (this.castT || 0) - dt);
    this.shieldFlash = (this.shieldFlash || 0) - dt;
    if (this.state === 'idle') {
      this.vy = Math.sin(this.anim * 1.2) * 10; this.vx = 0;
      moveBody(this, dt);
      if (p && p.alive && dist(p.cx, p.cy, this.cx, this.cy) < 480) this.heraldWake();
      return;
    }
    if (this.state === 'dying') {
      this.vx *= 0.9; this.vy = 25;
      moveBody(this, dt);
      this.shubBoomT = (this.shubBoomT || 0) - dt;
      if (this.shubBoomT <= 0) {
        this.shubBoomT = 0.15;
        const x = this.x + rand(0, this.w), y = this.y + rand(0, this.h);
        FX.explosion(x, y, 0.8); Sound.play('explode', x, y); Game.shake(x, y, 6);
      }
      if (this.stateT > 3) {
        this.alive = false; this.gibbed = true;
        Game.kills++;
        for (let i = 0; i < 24; i++) FX.gib(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-300, 300), rand(-400, -100), pick(['#2a1a30', '#5a2a6a', '#7a1a10', '#c040ff']), randInt(3, 6));
        FX.explosion(this.cx, this.cy, 2);
        Game.onBossDefeated();
      }
      return;
    }
    // парение: держится над игроком, но в пределах своей арены
    const shielded = this.heraldShielded();
    const tx = clamp(p ? p.cx + Math.sin(this.anim * 0.45) * 150 : this.homeX, this.homeX - 420, this.homeX + 420);
    const ty = this.homeY + Math.sin(this.anim * 0.8) * 30;
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
    const sp = this.def.speed * (shielded ? 1 : 1.35);
    this.vx = approach(this.vx, dx / d * sp * Math.min(1, d / 60), 200 * dt);
    this.vy = approach(this.vy, dy / d * sp * Math.min(1, d / 60), 200 * dt);
    moveBody(this, dt);
    if (p) this.facing = p.cx >= this.cx ? 1 : -1;
    this.cd -= dt;
    if (this.cd > 0 || !p || !p.alive) return;
    this.cd = rand(...this.def.cd) * Game.skillCdScale() * (shielded ? 1 : 0.75);
    const sx = this.cx + this.facing * 16, sy = this.y + 20;
    const aim = Math.atan2(p.cy - sy, p.cx - sx);
    this.castT = 0.4;
    switch (this.pattern++ % 4) {
      case 0:
        for (let i = -2; i <= 2; i++) spawnProjectile('fireball', this, sx, sy, aim + i * 0.13, { dmg: 12 });
        Sound.play('fireball', sx, sy);
        break;
      case 1:
        for (const off of [-0.6, 0.6]) spawnProjectile('voreball', this, sx, sy, aim + off, { target: p });
        Sound.play('voreball', sx, sy);
        break;
      case 2:
        Sound.play('charge', sx, sy);
        this.castT = 1.1;
        for (const [k, tt] of [[0, 0.8], [1, 0.9], [2, 1.0]]) {
          Game.later(tt, () => {
            if (!this.alive || this.state !== 'active' || !Game.player || !Game.player.alive) return;
            const q = Game.player;
            const ox = this.cx + this.facing * 16, oy = this.y + 20;
            lightningRay(this, ox, oy, Math.atan2(q.cy - oy, q.cx - ox), 520, 12);
            if (k === 0) Sound.play('lightning', ox, oy);
          });
        }
        break;
      default:
        if (Game.monsters.filter((m) => m.minion && m.alive).length < 4) {
          for (const t of ['gargoyle', 'scrag']) {
            const m = new Monster(t, this.cx + rand(-40, 40), this.y + 20);
            m.counted = false; m.minion = true;
            m.alert(p, false);
            Game.monsters.push(m);
            FX.teleport(m.cx, m.cy);
          }
          Sound.play('teleport', this.cx, this.cy);
        } else {
          for (let i = -1; i <= 1; i++) spawnProjectile('fireball', this, sx, sy, aim + i * 0.2, { dmg: 12 });
          Sound.play('fireball', sx, sy);
        }
    }
  }

  // --- фантом: мерцает и возникает рядом с целью ---
  blinkNear(t) {
    const lv = Game.level;
    const footRow = Math.floor((t.y + t.h - 1) / TILE);
    for (let i = 0; i < 14; i++) {
      const cx = t.cx + (chance(0.5) ? 1 : -1) * rand(60, 150);
      const tx = Math.floor(cx / TILE);
      for (let ty = footRow - 1; ty <= footRow + 3; ty++) {
        const below = lv.tile(tx, ty + 1);
        if (!(isSolidType(below) || below === T.PLAT)) continue;
        const nx = cx - this.w / 2, ny = (ty + 1) * TILE - this.h;
        if (!lv.boxFree(nx, ny, this.w, this.h) || lv.liquidAt(cx, ny + this.h - 2)) continue;
        if (!lv.los(cx, ny + 4, t.cx, t.cy)) continue;
        FX.teleport(this.cx, this.cy);
        this.x = nx; this.y = ny; this.vx = 0; this.vy = 0;
        FX.teleport(this.cx, this.cy);
        Sound.play('teleport', this.cx, this.cy, { p: 1.6, vol: 0.6 });
        this.blinkCd = rand(2.5, 4) * Game.skillCdScale();
        this.facing = t.cx >= this.cx ? 1 : -1;
        this.state = 'chase';
        this.cd = Math.min(this.cd, 0.5);
        return true;
      }
    }
    this.blinkCd = 1;
    return false;
  }

  // --- Древний: барьер держат четыре руны на алтарях ---
  elderShielded() { return Game.level.buttons.some((b) => !b.lit); }

  elderWake() {
    if (this.state !== 'idle') return;
    this.state = 'active'; this.stateT = 0; this.cd = 1.5; this.pattern = 0; this.rage = 0;
    Sound.play('roar'); Game.shake(this.cx, this.cy, 10);
    HUD.center('Древний пробудился!', 2.5);
  }

  elderBarrierDown() {
    this.elderWake();
    this.cd = Math.min(this.cd, 1);
    this.shieldFlash = 0.6;
  }

  elderDamage(dmg, attacker, kind) {
    if (!this.alive || this.state === 'dying') return;
    if (attacker && attacker.isPlayer) this.elderWake();
    if (this.elderShielded()) {
      this.shieldFlash = 0.25;
      Sound.play('shield', this.cx, this.cy, { gap: 0.08 });
      if (attacker && attacker.isPlayer && !Game.bossHintShown) {
        Game.bossHintShown = true;
        HUD.center('Барьер Древнего питают руны!\nЗажгите все алтари.', 3);
      }
      return;
    }
    this.health -= dmg;
    this.hurtFlash = 0.06;
    const frac = this.health / this.maxHealth;
    const rage = frac < 0.33 ? 2 : frac < 0.66 ? 1 : 0;
    if (rage > this.rage && this.health > 0) {
      // ярость: рывок через арену и призыв фантомов
      this.rage = rage;
      HUD.center('Древний в ярости!', 2);
      Sound.play('roar');
      FX.teleport(this.cx, this.cy);
      this.x = clamp(this.homeX + (this.cx < this.homeX + this.w / 2 ? 1 : -1) * 300, this.homeX - 560, this.homeX + 560);
      FX.teleport(this.cx, this.cy);
      this.elderSummon(3);
    }
    if (this.health <= 0) {
      this.state = 'dying'; this.stateT = 0;
      HUD.center('Древний повержен!', 3);
      Sound.play('roar');
      for (const m of Game.monsters) if (m.minion && m.alive) applyDamage(m, 5000, attacker, 'telefrag');
    }
  }

  elderSummon(n) {
    const p = Game.player;
    if (!p || !p.alive) return;
    if (Game.monsters.filter((m) => m.minion && m.alive).length >= 4) return;
    for (let i = 0; i < n; i++) {
      const m = new Monster('phantom', this.cx, this.y + this.h);
      m.counted = false; m.minion = true;
      m.alert(p, false);
      m.blinkCd = 0;
      if (m.blinkNear(p)) Game.monsters.push(m);
    }
  }

  updateElder(dt) {
    const p = Game.player;
    this.stateT += dt;
    this.hurtFlash -= dt;
    this.castT = Math.max(0, (this.castT || 0) - dt);
    this.shieldFlash = (this.shieldFlash || 0) - dt;
    // Древний бесплотен для камня: пролетает сквозь острова
    if (this.state === 'idle') {
      this.y += Math.sin(this.anim * 1.1) * 10 * dt;
      if (p && p.alive && dist(p.cx, p.cy, this.cx, this.cy) < 460) this.elderWake();
      return;
    }
    if (this.state === 'dying') {
      this.vx *= 0.9;
      this.y += 12 * dt;
      this.shubBoomT = (this.shubBoomT || 0) - dt;
      if (this.shubBoomT <= 0) {
        this.shubBoomT = 0.12;
        const x = this.x + rand(0, this.w), y = this.y + rand(0, this.h);
        FX.explosion(x, y, 0.9); Sound.play('explode', x, y); Game.shake(x, y, 7);
        if (chance(0.3)) FX.beam(this.cx, this.cy, this.cx + rand(-200, 200), this.cy + rand(-160, 160), '#80e0ff', 0.4, 2);
      }
      if (this.stateT > 4) {
        this.alive = false; this.gibbed = true;
        Game.kills++;
        for (let i = 0; i < 30; i++) FX.gib(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-320, 320), rand(-420, -100), pick(['#1a2230', '#3a4a60', '#60e0ff', '#c0f0ff']), randInt(3, 6));
        FX.explosion(this.cx, this.cy, 2.5);
        FX.teleport(this.cx, this.cy);
        Game.onBossDefeated();
      }
      return;
    }
    const shielded = this.elderShielded();
    // парит над героем, чтобы оставаться в кадре
    const tx = clamp(p ? p.cx + Math.sin(this.anim * 0.4) * 170 : this.homeX, this.homeX - 560, this.homeX + 560);
    const ty = clamp((p ? p.cy - 175 : this.homeY) + Math.sin(this.anim * 0.7) * 22, this.homeY, this.homeY + 320);
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
    const sp = this.def.speed * (1 + this.rage * 0.25);
    this.vx = approach(this.vx, dx / d * sp * Math.min(1, d / 60), 180 * dt);
    this.vy = approach(this.vy, dy / d * sp * Math.min(1, d / 60), 180 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (p) this.facing = p.cx >= this.cx ? 1 : -1;
    this.cd -= dt;
    if (this.cd > 0 || !p || !p.alive) return;
    this.cd = rand(...this.def.cd) * Game.skillCdScale() * (shielded ? 1.15 : 1 - this.rage * 0.18);
    const sx = this.cx + this.facing * 18, sy = this.y + 26;
    const aim = Math.atan2(p.cy - sy, p.cx - sx);
    this.castT = 0.45;
    switch (this.pattern++ % 5) {
      case 0: {
        const n = 3 + this.rage;
        for (let i = -n; i <= n; i++) spawnProjectile('rune', this, sx, sy, aim + i * 0.11);
        Sound.play('laser', sx, sy, { p: 0.6 });
        break;
      }
      case 1:
        for (const off of [-0.7, 0, 0.7]) spawnProjectile('voreball', this, sx, sy, aim + off, { target: p });
        Sound.play('voreball', sx, sy);
        break;
      case 2:
        Sound.play('charge', sx, sy);
        this.castT = 1.1;
        for (const [k, tt] of [[0, 0.8], [1, 0.9], [2, 1.0], [3, 1.1]]) {
          if (k === 3 && this.rage === 0) continue;
          Game.later(tt, () => {
            if (!this.alive || this.state !== 'active' || !Game.player || !Game.player.alive) return;
            const q = Game.player;
            const ox = this.cx + this.facing * 18, oy = this.y + 26;
            lightningRay(this, ox, oy, Math.atan2(q.cy - oy, q.cx - ox), 560, 12);
            if (k === 0) Sound.play('lightning', ox, oy);
          });
        }
        break;
      case 3: {
        // дождь рун: падают сверху вокруг цели
        this.castT = 1;
        Sound.play('charge', sx, sy, { p: 1.4 });
        const n = 6 + this.rage * 2;
        for (let i = 0; i < n; i++) {
          Game.later(0.3 + i * 0.12, () => {
            if (!this.alive || this.state !== 'active' || !Game.player) return;
            const q = Game.player;
            const x = q.cx + rand(-110, 110) + q.vx * 0.3;
            const y = Game.cam.y - 6;
            spawnProjectile('rune', this, x, y, Math.PI / 2 + rand(-0.05, 0.05), { speed: 300 });
          });
        }
        break;
      }
      default:
        if (Game.monsters.filter((m) => m.minion && m.alive).length < 3) {
          this.elderSummon(2);
          Sound.play('teleport', this.cx, this.cy, { p: 0.7 });
        } else {
          for (let i = -1; i <= 1; i++) spawnProjectile('rune', this, sx, sy, aim + i * 0.2);
          Sound.play('laser', sx, sy, { p: 0.6 });
        }
    }
  }

  spawnMinion() {
    this.minionIdx = ((this.minionIdx || 0) + 1) % 4;
    const type = ['spawn', 'gargoyle', 'spawn', 'scrag'][this.minionIdx];
    const x = this.cx + rand(-this.w / 2, this.w / 2);
    const fly = MONSTER_DEFS[type].fly;
    const m = new Monster(type, x, fly ? this.y + 10 : this.y + this.h);
    m.counted = false;
    m.minion = true;
    if (Game.player && Game.player.alive) m.alert(Game.player, false);
    Game.monsters.push(m);
    FX.teleport(m.cx, m.cy);
    Sound.play('teleport', m.cx, m.cy);
  }

  lights(out) {
    if (this.type === 'chthon' && this.state !== 'idle') out.push({ x: this.cx, y: this.y + 40, r: 180, c: [1, 0.5, 0.2], i: 0.7 });
    if (this.type === 'pylon') out.push({ x: this.cx, y: this.y + 8, r: 70, c: [0.8, 0.3, 1], i: 0.6 + Math.sin(this.anim * 3) * 0.15 });
    if (this.type === 'herald') out.push({ x: this.cx, y: this.cy, r: 160, c: [0.9, 0.3, 0.8], i: 0.6 });
    if (this.type === 'elder') out.push({ x: this.cx, y: this.cy, r: 190, c: [0.4, 0.85, 1], i: this.state === 'idle' ? 0.4 : 0.7 });
    if (this.type === 'phantom') out.push({ x: this.cx, y: this.y + 6, r: 36, c: [0.7, 0.45, 1], i: 0.35 });
    if (this.type === 'guardian') out.push({ x: this.cx, y: this.y + 6, r: 34, c: [0.4, 0.9, 1], i: 0.3 });
    if (this.type === 'eel' && this.state === 'attack') out.push({ x: this.cx, y: this.cy, r: 60, c: [0.5, 0.7, 1], i: 0.7 });
    if (this.type === 'shub') out.push({ x: this.cx, y: this.cy, r: 200, c: [0.7, 0.3, 0.9], i: this.state === 'idle' ? 0.35 : 0.65 });
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
    if (this.type === 'phantom' && this.alive) ctx.globalAlpha = 0.72 + Math.sin(this.anim * 7 + this.seed) * 0.18;
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
    if (this.type === 'shub' && this.state !== 'dying') {
      for (const [ex, ey] of SHUB_EYES) {
        const blink = Math.sin(this.anim * 1.7 + ex) > 0.93;
        ctx.fillStyle = blink ? '#3a2430' : '#ffe060';
        ctx.fillRect(x + ex - 1, y + this.h + ey - 1, 3, 2);
      }
    }
    if (this.type === 'pylon') {
      const boss = Game.monsters.find((m) => m.type === 'herald' && m.alive);
      if (boss) drawLightning(ctx, x + 7, y + 4, Math.round(boss.cx - cam.x), Math.round(boss.cy - cam.y), '#e080ff', 1, 0.35 + Math.random() * 0.3);
      const k = Math.sin(this.anim * 3) * 0.5 + 0.5;
      ctx.fillStyle = mix('#c040ff', '#ffd0ff', k);
      ctx.fillRect(x + 5, y + 5, 4, 12);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, y + 7, 1, 6);
    }
    if (this.type === 'herald') {
      ctx.fillStyle = '#ff5030';
      const ex = x + this.w / 2 + this.facing * 3;
      ctx.fillRect(ex - 5, y + 7, 3, 2); ctx.fillRect(ex + 2, y + 7, 3, 2);
      const orb = 2 + Math.round(Math.sin(this.anim * 6));
      ctx.fillStyle = '#ff90ff';
      ctx.fillRect(x + this.w / 2 - 19 - orb, y + 30 - orb, orb * 2 + 2, orb * 2 + 2);
      ctx.fillRect(x + this.w / 2 + 17 - orb, y + 30 - orb, orb * 2 + 2, orb * 2 + 2);
      if (this.heraldShielded()) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + (this.shieldFlash > 0 ? 0.5 : 0) + Math.sin(this.anim * 4) * 0.05;
        ctx.strokeStyle = '#e080ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x + this.w / 2, y + this.h / 2, this.w * 0.85, this.h * 0.7, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#6020a0'; ctx.globalAlpha *= 0.3; ctx.fill();
        ctx.restore();
      }
    }
    if (this.type === 'phantom') {
      ctx.fillStyle = '#e0b0ff';
      const ex = x + (this.facing > 0 ? 1 : -3);
      ctx.fillRect(ex, y + 3, 2, 1);
      if (this.state === 'attack' && this.stateT < 0.6) { ctx.fillStyle = '#c080ff'; ctx.fillRect(x + this.facing * 7 - 1, y + 8 + rand(-1, 1), 3, 3); }
    }
    if (this.type === 'guardian') {
      ctx.fillStyle = '#80f0ff';
      ctx.fillRect(x + (this.facing > 0 ? 1 : -4), y + 4, 3, 1);
      if (this.shieldFlash > 0) {
        ctx.globalAlpha = clamp(this.shieldFlash / 0.2, 0, 1) * 0.8;
        ctx.fillStyle = '#a0f0ff';
        ctx.fillRect(x + this.facing * 10 - 1, y + 4, 2, 20);
        ctx.globalAlpha = 1;
      }
    }
    if (this.type === 'elder') {
      const cxs = x + this.w / 2;
      if (this.elderShielded()) {
        for (const b of Game.level.buttons) if (!b.lit) drawLightning(ctx, Math.round(b.x + 6 - cam.x), Math.round(b.y - cam.y), cxs, y + this.h / 2, '#60e0ff', 1, 0.2 + Math.random() * 0.25);
      }
      const k = Math.sin(this.anim * 5) * 0.5 + 0.5;
      ctx.fillStyle = mix('#60e0ff', '#ffffff', k * 0.6);
      const ex = cxs + this.facing * 4;
      ctx.fillRect(ex - 7, y + 12, 4, 2); ctx.fillRect(ex + 3, y + 12, 4, 2);
      ctx.fillRect(ex - 1, y + 7, 2, 3);
      // руны на груди горят по числу зажжённых алтарей
      const lit = Game.level.buttons.filter((b) => b.lit).length;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < lit ? '#80f0ff' : '#2a4050';
        ctx.fillRect(cxs - 11 + i * 6, y + 34, 4, 5);
      }
      if (this.elderShielded() && this.state !== 'dying') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22 + (this.shieldFlash > 0 ? 0.5 : 0) + Math.sin(this.anim * 4) * 0.05;
        ctx.strokeStyle = '#60e0ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cxs, y + this.h / 2, this.w * 0.9, this.h * 0.68, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#1060a0'; ctx.globalAlpha *= 0.3; ctx.fill();
        ctx.restore();
      } else if (this.shieldFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.shieldFlash;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cxs, y + this.h / 2, this.w * (1.6 - this.shieldFlash), this.h * (1.2 - this.shieldFlash * 0.5), 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    if (this.type === 'eel') {
      ctx.fillStyle = '#ffe040';
      ctx.fillRect(x + (this.facing > 0 ? this.w - 4 : 3), y + 2, 1, 1);
      if (this.state === 'attack') for (let i = 0; i < 3; i++) { ctx.fillStyle = '#c0e0ff'; ctx.fillRect(x + rand(0, this.w), y + rand(-2, this.h), 1, 1); }
    }
    if (this.type === 'scorpion') {
      ctx.fillStyle = '#ffe040';
      ctx.fillRect(x + (this.facing > 0 ? this.w - 5 : 4), y + this.h - 9, 1, 1);
    }
    if (this.type === 'gargoyle') {
      ctx.fillStyle = '#ff4020';
      ctx.fillRect(x + this.facing * 4 - 1, y + this.h - 15, 2, 1);
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
  gargoyle() { /* атака — пике, см. tryAttack */ },
  pylon() { /* неподвижный кристалл */ },
  herald() { /* см. updateHerald */ },
  elder() { /* см. updateElder */ },
  phantom(m) {
    for (const [i, tt] of [[0, 0.35], [1, 0.55]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        const s = m.shootPoint();
        spawnProjectile('shard', m, s.x + m.facing * 6, s.y, m.aimAt(m.target, 0.05), { target: m.target });
        Sound.play('spit', m.cx, m.cy, { p: 0.7 });
      }
    }
    if (m.stateT > 0.85) m.endAttack();
  },
  guardian(m) {
    if (m.attackKind === 'melee') {
      if (m.fired === 0 && m.stateT > 0.5) {
        // удар молотом о землю: ударная волна по стоящим рядом
        m.fired = 1;
        const gx = m.cx + m.facing * 12, gy = m.y + m.h;
        Game.shake(gx, gy, 6);
        Sound.play('explode', gx, gy, { vol: 0.5, p: 1.6 });
        FX.sparks(gx, gy - 2, 14, '#80e0ff', 200);
        for (const t of Game.damageables()) {
          if (t === m || t.isBox || !t.alive) continue;
          const tb = t.y + t.h;
          if (Math.abs(t.cx - gx) < 38 && Math.abs(tb - gy) < 20) applyDamage(t, rand(20, 28), m, 'melee', sign(t.cx - m.cx) * 160, -260);
        }
      }
      if (m.stateT > 0.95) m.endAttack();
      return;
    }
    for (const [i, tt] of [[0, 0.5], [1, 0.72]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        const s = m.shootPoint();
        spawnProjectile('rune', m, s.x + m.facing * 8, s.y - 4, m.aimAt(m.target, 0.03));
        Sound.play('laser', m.cx, m.cy, { p: 0.7 });
        m.fireAnim = 0.12;
      }
    }
    if (m.stateT > 1.1) m.endAttack();
  },
  scorpion(m) {
    if (m.attackKind === 'melee') {
      if (m.fired === 0 && m.stateT > 0.2) { m.fired = 1; m.meleeHit(10, rand(10, 15), 'axehit'); }
      if (m.stateT > 0.45) m.endAttack();
      return;
    }
    for (const [i, tt] of [[0, 0.25], [1, 0.33], [2, 0.41], [3, 0.49]]) {
      if (m.fired === i && m.stateT > tt) {
        m.fired++;
        const sx = m.cx + m.facing * 10, sy = m.y + 4;
        spawnProjectile('nail', m, sx, sy, Math.atan2(m.target.cy - sy, m.target.cx - sx) + rand(-0.06, 0.06), { dmg: 6 });
        Sound.play('nail', m.cx, m.cy, { p: 1.2, gap: 0.05 });
      }
    }
    if (m.stateT > 0.8) m.endAttack();
  },
  eel(m) {
    if (m.fired === 0 && m.stateT > 0.25) {
      m.fired = 1;
      const t = m.target;
      if (t && dist(t.cx, t.cy, m.cx, m.cy) < 110) {
        lightningRay(m, m.cx, m.cy, Math.atan2(t.cy - m.cy, t.cx - m.cx), 120, 14);
        Sound.play('zapsmall', m.cx, m.cy);
      }
    }
    if (m.stateT > 0.6) m.endAttack();
  },
  shub() { /* см. updateShub */ },
};
