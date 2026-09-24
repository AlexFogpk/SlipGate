'use strict';
// Игрок: движение, плавание, броня, усиления, стрельба.

const RUN_SPEED = 130;
const JUMP_VEL = 350;
const WEAPON_ORDER_BEST = [8, 9, 5, 3, 4, 2, 1];

class Player {
  constructor(cx, bottom) {
    this.isPlayer = true;
    this.w = 10; this.h = 22;
    this.x = cx - this.w / 2; this.y = bottom - this.h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1; this.aim = 0;
    this.health = 100; this.armor = 0; this.armorType = 0;
    this.weapons = { 1: true, 2: true };
    this.weapon = 2;
    this.ammo = { shells: 25, nails: 0, rockets: 0, cells: 0 };
    this.keys = { silver: false, gold: false };
    this.quad = 0; this.pent = 0; this.ring = 0; this.suit = 0;
    this.air = 12; this.drownT = 0; this.drownDmg = 2;
    this.liquidT = 0;
    this.fireCd = 0; this.attackAnim = 0; this.nailSide = 0;
    this.alive = true; this.deadT = 0; this.gibbed = false;
    this.coyote = 0; this.jumpBuf = 0; this.prevJump = false; this.landT = 1; this.bhop = 0; this.jumping = false;
    this.dropT = 0; this.dropThrough = false;
    this.painSoundT = 0; this.faceT = 0;
    this.walkPhase = 0;
    this.megaT = 0;
    this.waterLevel = 0; this.waterType = 0;
    this.hurtFlash = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  shoulder() { return { x: this.cx, y: this.y + 9 }; }
  muzzle() {
    const s = this.shoulder(), len = WEAPONS[this.weapon].len;
    return { x: s.x + Math.cos(this.aim) * len, y: s.y + Math.sin(this.aim) * len };
  }

  inventory() {
    return {
      health: this.health, armor: this.armor, armorType: this.armorType,
      weapons: Object.assign({}, this.weapons), weapon: this.weapon, ammo: Object.assign({}, this.ammo),
    };
  }

  // Снимок для контрольной точки: как инвентарь, но с ключами.
  checkpointState() {
    return Object.assign(this.inventory(), { keys: Object.assign({}, this.keys) });
  }

  applyInventory(inv) {
    if (!inv) return;
    this.health = inv.health; this.armor = inv.armor; this.armorType = inv.armorType;
    this.weapons = Object.assign({}, inv.weapons); this.weapon = inv.weapon;
    this.ammo = Object.assign({}, inv.ammo);
  }

  update(dt) {
    const lv = Game.level;
    this.hurtFlash -= dt;
    if (!this.alive) {
      this.deadT += dt;
      this.vy += GRAVITY * dt;
      this.vx = approach(this.vx, 0, 400 * dt);
      moveBody(this, dt);
      return;
    }
    const aimPt = Game.aimWorld();
    const s = this.shoulder();
    this.aim = Math.atan2(aimPt.y - s.y, aimPt.x - s.x);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;

    const prevWater = this.waterLevel;
    const wl = computeWaterLevel(this);
    this.waterLevel = wl.level; this.waterType = wl.type;
    if (prevWater === 0 && this.waterLevel > 0 && this.vy > 120) {
      Sound.play('splash', this.cx, this.cy);
      FX.bubbles(this.cx, this.y + this.h, 6);
    }

    const move = Input.moveAxis();
    const jumpHeld = Input.jumpHeld();
    const jumpPressed = jumpHeld && !this.prevJump;
    this.prevJump = jumpHeld;
    if (jumpPressed) this.jumpBuf = 0.12; else this.jumpBuf -= dt;
    const down = Input.downHeld();

    if (this.waterLevel >= 2) this.swim(dt, move, jumpHeld, down);
    else this.walk(dt, move, jumpHeld, down);

    this.dropT -= dt;
    this.dropThrough = this.dropT > 0;
    const res = moveBody(this, dt);
    if (res.solidX instanceof Mover && res.solidX.kind === 'secret' && move !== 0) lv.openSecret(res.solidX);
    if (res.landed) {
      if (res.impactVy > 330 && this.waterLevel === 0) {
        Sound.play('land', this.cx, this.y + this.h);
        if (res.impactVy > 760) { this.takeDamage(5, null, 'fall'); }
      }
      if (this.landT > 0.05) this.landT = 0;
      this.jumping = false;
    }
    if (this.onGround) this.coyote = 0.08; else this.coyote -= dt;
    this.landT += dt;
    if (this.onGround && this.landT > 0.15) this.bhop = 0;
    if (this.onGround && Math.abs(this.vx) > 10) this.walkPhase += dt * Math.abs(this.vx) * 0.11;

    this.updateLiquids(dt);
    this.updateTimers(dt);
    this.updateWeapons(dt);

    // мягкое расталкивание с монстрами
    for (const m of Game.monsters) {
      if (!m.alive || m.def.fly || m.def.boss) continue;
      if (overlap(this, m)) {
        const push = this.cx < m.cx ? -1 : 1;
        this.vx += push * 400 * dt;
      }
    }
  }

  walk(dt, move, jumpHeld, down) {
    const lv = Game.level;
    const run = RUN_SPEED;
    if (this.onGround) {
      if (move !== 0) {
        if (Math.abs(this.vx) > run && sign(this.vx) === sign(move)) this.vx = approach(this.vx, move * run, 500 * dt);
        else this.vx = approach(this.vx, move * run, 1400 * dt);
      } else this.vx = approach(this.vx, 0, 1200 * dt);
    } else if (move !== 0) {
      if (sign(move) !== sign(this.vx) || Math.abs(this.vx) < Math.abs(move * run)) this.vx = approach(this.vx, move * run, 750 * dt);
    } else this.vx = approach(this.vx, 0, 110 * dt);

    if (this.jumpBuf > 0 && this.coyote > 0 && !(down && this.onPlatform())) {
      this.jumpBuf = 0; this.coyote = 0;
      this.vy = -JUMP_VEL;
      this.jumping = true;
      if (this.landT < 0.12 && move !== 0 && sign(move) === sign(this.vx)) this.bhop = Math.min(this.bhop + 0.1, 0.6);
      else this.bhop = 0;
      if (this.bhop > 0) this.vx = sign(move) * Math.max(Math.abs(this.vx), run * (1 + this.bhop));
      Sound.play('jump', this.cx, this.cy, { gap: 0.1 });
    }
    if (this.jumping && !jumpHeld && this.vy < -140) { this.vy = -140; this.jumping = false; }
    // S / «вниз» на платформе — спрыгнуть сквозь неё
    if (down && this.onGround && this.onPlatform()) this.dropT = Math.max(this.dropT, 0.2);
    const liq = this.waterLevel === 1 ? 0.85 : 1;
    this.vy = Math.min(this.vy + GRAVITY * liq * dt, 820);
    if (this.vx > 0) this.vx = Math.min(this.vx, 600); else this.vx = Math.max(this.vx, -600);
  }

  onPlatform() {
    if (this.lift) return true;
    const lv = Game.level;
    const ty = Math.floor((this.y + this.h + 1) / TILE);
    const a = lv.tile(Math.floor(this.x / TILE), ty), b = lv.tile(Math.floor((this.x + this.w - 0.01) / TILE), ty);
    return (a === T.PLAT || b === T.PLAT) && !isSolidType(a) && !isSolidType(b);
  }

  swim(dt, move, jumpHeld, down) {
    const lv = Game.level;
    this.vx = approach(this.vx, move * 90, 500 * dt);
    let ty = 25;
    if (jumpHeld) ty = -115; else if (down) ty = 115;
    this.vy = approach(this.vy, ty, 550 * dt);
    if (jumpHeld && this.waterLevel === 2 && !lv.liquidAt(this.cx, this.y - 1)) {
      this.vy = -330;
      this.jumping = false;
    }
    this.jumpBuf = 0;
    this.bhop = 0;
    if (this.waterLevel === 3 && Math.random() < dt * 1.5) FX.bubbles(this.cx + this.facing * 3, this.y + 4);
  }

  updateLiquids(dt) {
    if (this.waterLevel > 0 && (this.waterType === T.LAVA || this.waterType === T.SLIME)) {
      this.liquidT -= dt;
      if (this.liquidT <= 0) {
        if (this.waterType === T.LAVA) {
          this.liquidT = 0.25;
          if (this.pent <= 0) {
            this.takeDamage((this.suit > 0 ? 3 : 10) * this.waterLevel, null, 'lava');
            Sound.play('burn', this.cx, this.cy);
          }
        } else {
          this.liquidT = 1;
          if (this.suit <= 0 && this.pent <= 0) this.takeDamage(4 * this.waterLevel, null, 'slime');
        }
      }
    } else this.liquidT = 0;
    if (this.waterLevel === 3 && this.suit <= 0) {
      this.air -= dt;
      if (this.air < 0) {
        this.drownT -= dt;
        if (this.drownT <= 0) {
          this.drownT = 1;
          Sound.play('gurgle', this.cx, this.cy);
          this.takeDamage(this.drownDmg, null, 'drown', 0, 0, true);
          this.drownDmg = Math.min(15, this.drownDmg + 2);
        }
      }
    } else {
      if (this.air < 7) Sound.play('gasp', this.cx, this.cy);
      this.air = 12; this.drownDmg = 2; this.drownT = 0;
    }
  }

  updateTimers(dt) {
    this.painSoundT -= dt;
    this.faceT -= dt;
    for (const k of ['quad', 'pent', 'ring', 'suit']) {
      if (this[k] > 0) {
        const before = this[k];
        this[k] -= dt;
        if (before > 3 && this[k] <= 3) {
          HUD.message({ quad: 'Четверной урон заканчивается...', pent: 'Защита пентаграммы слабеет...', ring: 'Кольцо теней тускнеет...', suit: 'Воздух в биокостюме на исходе...' }[k]);
          Sound.play('powerdown');
        }
        if (this[k] < 0) this[k] = 0;
      }
    }
    if (this.health > 100) {
      this.megaT += dt;
      if (this.megaT >= 1) { this.megaT -= 1; this.health -= 1; }
    } else this.megaT = 0;
  }

  updateWeapons(dt) {
    this.fireCd -= dt;
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    for (let n = 1; n <= 9; n++) if (Input.wasPressed('Digit' + n, 'Numpad' + n)) this.selectWeapon(n, true);
    if (Input.wheel > 0 || Input.wasPressed('KeyE') || Input.buttonPresses.has('next')) this.cycleWeapon(1);
    if (Input.wheel < 0 || Input.wasPressed('KeyQ')) this.cycleWeapon(-1);
    if (Input.fireHeld() && this.fireCd <= 0) this.fire();
  }

  hasAmmoFor(n) {
    const w = WEAPONS[n];
    return !w.ammo || this.ammo[w.ammo] >= w.use;
  }

  selectWeapon(n, verbose) {
    if (!this.weapons[n]) { if (verbose) HUD.message('У вас нет этого оружия'); return false; }
    if (!this.hasAmmoFor(n)) { if (verbose) HUD.message('Нет боеприпасов'); return false; }
    if (this.weapon !== n) {
      this.weapon = n;
      this.fireCd = Math.max(this.fireCd, 0.12);
      Sound.play('menu');
    }
    return true;
  }

  cycleWeapon(dir) {
    for (let i = 1; i <= 9; i++) {
      const n = ((this.weapon - 1 + dir * i) % 9 + 9) % 9 + 1;
      if (this.weapons[n] && this.hasAmmoFor(n)) { this.selectWeapon(n); return; }
    }
  }

  bestWeapon() {
    for (const n of WEAPON_ORDER_BEST) {
      if (n === 8 && this.waterLevel >= 2) continue;
      if (this.weapons[n] && this.hasAmmoFor(n)) return n;
    }
    return 1;
  }

  fire() {
    const w = WEAPONS[this.weapon];
    if (!this.hasAmmoFor(this.weapon)) {
      Sound.play('noammo', null, null, { gap: 0.3 });
      this.weapon = this.bestWeapon();
      this.fireCd = 0.2;
      return;
    }
    if (w.ammo) this.ammo[w.ammo] -= w.use;
    this.fireCd = w.rate;
    this.attackAnim = this.weapon === 1 ? 0.3 : 0.12;
    const s = this.shoulder();
    const ang = this.aim;
    const mul = this.quad > 0 ? 4 : 1;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const m = this.muzzle();
    const flash = () => {
      FX.light(m.x, m.y, 90, [1, 0.8, 0.5], 1.0, 0.07);
      FX.add({ kind: 'spark', x: m.x, y: m.y, vx: cos * 30, vy: sin * 30, life: 0.05, max: 0.05, size: 3, col: '#ffe8a0', grav: 0, bright: true });
    };
    if (this.weapon !== 1) Game.noise(this.cx, this.cy, 520);
    if (this.quad > 0 && this.weapon !== 1) FX.light(this.cx, this.cy, 80, [0.3, 0.4, 1], 0.8, 0.12);
    switch (this.weapon) {
      case 1: this.axe(s, ang, mul); break;
      case 2:
        hitscan(this, s.x, s.y, ang, 6, 4 * mul, 0.045);
        Sound.play('shotgun'); flash(); Game.kick(1.5);
        break;
      case 3:
        hitscan(this, s.x, s.y, ang, 14, 4 * mul, 0.12);
        Sound.play('sshotgun'); flash(); Game.kick(3);
        this.vx -= cos * 30;
        break;
      case 4:
      case 5: {
        this.nailSide ^= 1;
        const off = this.nailSide ? 2 : -2;
        const px = s.x - sin * off, py = s.y + cos * off;
        const big = this.weapon === 5;
        spawnProjectile('nail', this, px, py, ang + rand(-0.01, 0.01), { dmg: big ? 18 : 9, mul });
        Sound.play('nail', null, null, { p: big ? 0.8 : 1, gap: 0.05 });
        flash();
        break;
      }
      case 6:
        spawnProjectile('grenade', this, s.x, s.y, ang, { vx: this.vx * 0.3, vy: -70, mul });
        Sound.play('grenade'); Game.kick(1);
        break;
      case 7:
        spawnProjectile('rocket', this, s.x, s.y, ang, { mul });
        Sound.play('rocket'); flash(); Game.kick(2);
        break;
      case 8:
        if (this.waterLevel >= 2) { this.discharge(); break; }
        lightningRay(this, m.x, m.y, ang, 380, 30 * mul);
        FX.light(m.x, m.y, 80, [0.6, 0.7, 1], 1, 0.1);
        Sound.play('lightning', null, null, { gap: 0.09 });
        break;
      case 9:
        spawnProjectile('bolt', this, s.x, s.y, ang + rand(-0.015, 0.015), { mul });
        Sound.play('laser', null, null, { gap: 0.05 });
        FX.light(m.x, m.y, 70, [1, 0.35, 0.2], 0.9, 0.06);
        break;
      default: break;
    }
  }

  axe(s, ang, mul) {
    const lv = Game.level;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const px = s.x + cos * 17, py = s.y + sin * 17;
    for (const t of Game.shootTargets(this)) {
      if (pointBoxDist(px, py, t) < 7) {
        applyDamage(t, 20 * mul, this, 'melee', cos * 60, sin * 60);
        FX.blood(px, py, cos, sin, 7);
        Sound.play('axehit');
        return;
      }
    }
    for (const b of lv.buttons) if (!b.pressed && pointBoxDist(px, py, b) < 6) lv.pressButton(b);
    const r = lv.rayCast(s.x, s.y, px, py);
    if (r.hit) {
      FX.sparks(r.x, r.y, 4);
      lv.shootSolid(r.solid, 20 * mul, this);
      Sound.play('axehit');
    } else Sound.play('axe');
  }

  discharge() {
    const cells = this.ammo.cells + 1;
    this.ammo.cells = 0;
    const dmg = 35 * cells;
    Sound.play('zap');
    FX.light(this.cx, this.cy, 300, [0.6, 0.7, 1], 1.5, 0.5);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), r = rand(40, 160);
      FX.beam(this.cx, this.cy, this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, '#c8d8ff', 0.3, 2);
    }
    for (const t of Game.damageables()) {
      if (t.isBox) continue;
      if (dist(t.cx, t.cy, this.cx, this.cy) > 420) continue;
      if (computeWaterLevel(t).level === 0) continue;
      applyDamage(t, dmg, this, 'discharge');
    }
  }

  takeDamage(dmg, attacker, kind, kx = 0, ky = 0, ignoreArmor = false) {
    if (!this.alive) return;
    this.vx += kx; this.vy += ky;
    if (ky < -60) { this.onGround = false; this.jumping = false; }
    if (Game.god) return;
    if (this.pent > 0 && kind !== 'telefrag') return;
    if (attacker && attacker.isMonster) dmg *= Game.skillDamageScale();
    let save = 0;
    if (!ignoreArmor && kind !== 'lava' && kind !== 'slime') {
      save = Math.ceil(this.armorType * dmg);
      if (save >= this.armor) { save = this.armor; this.armorType = 0; }
      this.armor -= save;
    }
    const take = Math.ceil(dmg - save);
    if (take <= 0) return;
    this.health -= take;
    this.faceT = 0.4;
    this.hurtFlash = 0.1;
    Game.damageFlash = Math.min(0.8, Game.damageFlash + take / 45);
    if (attacker && attacker !== this && attacker.cx !== undefined) HUD.hitFrom(attacker.cx, attacker.cy);
    FX.blood(this.cx, this.cy, rand(-1, 1), -1, Math.min(8, 2 + take / 5));
    if (this.health <= 0) this.die(attacker, kind);
    else if (this.painSoundT <= 0) {
      Sound.play('pain', this.cx, this.cy, { p: rand(0.95, 1.1) });
      this.painSoundT = 0.45;
    }
  }

  die(attacker, kind) {
    this.alive = false;
    this.deadT = 0;
    this.quad = this.pent = this.ring = this.suit = 0;
    if (this.health < -40) {
      this.gibbed = true;
      Sound.play('gib', this.cx, this.cy);
      for (let i = 0; i < 8; i++) FX.gib(this.cx, this.cy, rand(-200, 200), rand(-320, -60), pick(['#6a1a10', '#8a2a1a', '#4a5836']), randInt(2, 4));
      FX.gib(this.cx, this.y + 3, rand(-100, 100), -300, '#c09070', 5, true, 'player');
      FX.blood(this.cx, this.cy, 0, -1, 20, 2);
    } else Sound.play('death', this.cx, this.cy);
    Game.onPlayerDeath(attacker, kind);
  }

  lights(out) {
    // тусклый «ореол», чтобы в темноте было видно героя
    out.push({ x: this.cx, y: this.cy, r: 56, c: [0.9, 0.85, 0.8], i: 0.22 });
    if (this.quad > 0) out.push({ x: this.cx, y: this.cy, r: 70, c: [0.3, 0.45, 1], i: 0.7 });
    if (this.pent > 0) out.push({ x: this.cx, y: this.cy, r: 70, c: [1, 0.25, 0.2], i: 0.7 });
  }

  draw(ctx, cam) {
    if (this.gibbed) return;
    const x = Math.round(this.cx - cam.x), y = Math.round(this.y + this.h - cam.y);
    drawPlayerSprite(ctx, x, y, this);
  }
}
