'use strict';
// Предметы: аптечки, броня, патроны, оружие, ключи, усиления, рюкзаки.

const WEAPON_PICKUP = {
  3: { ammo: 'shells', amount: 5, msg: 'Вы получили двустволку' },
  4: { ammo: 'nails', amount: 30, msg: 'Вы получили гвоздомёт' },
  5: { ammo: 'nails', amount: 30, msg: 'Вы получили супергвоздомёт' },
  6: { ammo: 'rockets', amount: 5, msg: 'Вы получили гранатомёт' },
  7: { ammo: 'rockets', amount: 5, msg: 'Вы получили ракетницу' },
  8: { ammo: 'cells', amount: 15, msg: 'Вы получили громовержец' },
  9: { ammo: 'cells', amount: 20, msg: 'Вы получили лазерную пушку' },
};
const AMMO_PICKUP = { U: ['shells', 20], N: ['nails', 30], K: ['rockets', 5], C: ['cells', 10] };
const ARMOR_PICKUP = { A: [0.3, 100, 'зелёную'], Y: [0.6, 150, 'жёлтую'], R: [0.8, 200, 'красную'] };
const POWERUPS = {
  Q: ['quad', 'Четверной урон!'],
  X: ['pent', 'Пентаграмма защиты!'],
  V: ['ring', 'Кольцо теней!'],
  W: ['suit', 'Биокостюм!'],
};
const ITEM_CHARS = '+HMAYRUNKCQXVW()3456789';

class Item {
  constructor(ch, cx, bottom, extra = {}) {
    this.ch = ch;
    this.w = 12; this.h = 12;
    this.x = cx - 6; this.y = bottom - 12;
    this.vx = extra.vx || 0; this.vy = extra.vy || 0;
    this.dropped = !!extra.dropped;
    this.ammo = extra.ammo || null;
    this.taken = false;
    this.phase = rand(0, TAU);
    this.onGround = false;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    if (this.taken) return;
    if (this.dropped) {
      this.vy = Math.min(this.vy + GRAVITY * dt, 700);
      this.vx = approach(this.vx, 0, 200 * dt);
      moveBody(this, dt);
      if (Game.level.liquidAt(this.cx, this.cy) === T.VOID) { this.taken = true; return; }
    }
    const p = Game.player;
    if (p && p.alive && overlap(p, { x: this.x - 2, y: this.y - 2, w: this.w + 4, h: this.h + 4 })) {
      if (this.pickup(p)) {
        this.taken = true;
        Game.bonusFlash = 0.3;
      }
    }
  }

  pickup(p) {
    const ch = this.ch;
    if (ch === 'backpack') {
      const got = [];
      for (const k in this.ammo) {
        if (p.ammo[k] >= AMMO_MAX[k]) continue;
        p.ammo[k] = Math.min(AMMO_MAX[k], p.ammo[k] + this.ammo[k]);
        got.push(this.ammo[k] + ' ' + AMMO_NAMES[k]);
      }
      if (!got.length) return false;
      HUD.message('Рюкзак: ' + got.join(', '));
      Sound.play('pickup');
      return true;
    }
    if (ch === '+' || ch === 'H') {
      if (p.health >= 100) return false;
      const n = ch === '+' ? 15 : 25;
      p.health = Math.min(100, p.health + n);
      HUD.message('Вы получили ' + n + ' ед. здоровья');
      Sound.play('health');
      return true;
    }
    if (ch === 'M') {
      if (p.health >= 250) return false;
      p.health = Math.min(250, p.health + 100);
      HUD.message('Мегаздоровье!');
      Sound.play('powerup');
      return true;
    }
    if (ARMOR_PICKUP[ch]) {
      const [type, val, name] = ARMOR_PICKUP[ch];
      if (p.armorType * p.armor >= type * val) return false;
      p.armorType = type; p.armor = val;
      HUD.message('Вы получили ' + name + ' броню');
      Sound.play('armor');
      return true;
    }
    if (AMMO_PICKUP[ch]) {
      const [k, n] = AMMO_PICKUP[ch];
      if (p.ammo[k] >= AMMO_MAX[k]) return false;
      const hadNone = !p.hasAmmoFor(p.weapon);
      p.ammo[k] = Math.min(AMMO_MAX[k], p.ammo[k] + n);
      HUD.message('Вы получили ' + AMMO_NAMES[k]);
      Sound.play('pickup');
      if (hadNone) p.weapon = p.bestWeapon();
      return true;
    }
    if (ch >= '3' && ch <= '9') {
      const n = +ch;
      const def = WEAPON_PICKUP[n];
      const isNew = !p.weapons[n];
      p.weapons[n] = true;
      p.ammo[def.ammo] = Math.min(AMMO_MAX[def.ammo], p.ammo[def.ammo] + def.amount);
      HUD.message(def.msg);
      Sound.play('weapon');
      if (isNew && n > p.weapon && !(n === 8 && p.waterLevel >= 2)) p.selectWeapon(n);
      return true;
    }
    if (ch === '(' || ch === ')') {
      const k = ch === '(' ? 'silver' : 'gold';
      if (p.keys[k]) return false;
      p.keys[k] = true;
      HUD.message(k === 'silver' ? 'Вы получили серебряный ключ' : 'Вы получили золотой ключ');
      Sound.play('key');
      return true;
    }
    if (POWERUPS[ch]) {
      const [k, msg] = POWERUPS[ch];
      p[k] = 30;
      HUD.message(msg);
      HUD.center(msg, 1.5);
      Sound.play('powerup');
      return true;
    }
    return false;
  }

  get isWeapon() { return this.ch >= '3' && this.ch <= '9' && this.ch.length === 1; }

  lights(out, t) {
    // свет из закрытого тайника не выдаёт его
    if (this.taken || Game.level.isHiddenAt(this.cx, this.cy)) return;
    // оружие на полу видно издалека: свой тёплый свет, как у пьедестала в Quake
    if (this.isWeapon) { out.push({ x: this.cx, y: this.cy - 2, r: 60, c: [1, 0.86, 0.55], i: 0.7 + Math.sin(t * 3 + this.phase) * 0.12 }); return; }
    const glow = { M: [0.4, 0.5, 1], Q: [0.3, 0.4, 1], X: [1, 0.25, 0.2], V: [1, 0.8, 0.3], W: [0.3, 1, 0.4], '(': [0.8, 0.85, 1], ')': [1, 0.8, 0.3] }[this.ch];
    if (glow) out.push({ x: this.cx, y: this.cy, r: 48, c: glow, i: 0.6 + Math.sin(t * 4 + this.phase) * 0.15 });
  }

  draw(ctx, cam, t) {
    if (this.taken) return;
    const x = Math.round(this.cx - cam.x), y = Math.round(this.y + this.h - cam.y);
    if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) return;
    drawItem(ctx, x, y, this, t);
  }

  // Поверх освещения: золотой отсвет под оружием, блик и искры — чтобы оружие не терялось.
  drawBright(ctx, cam, t) {
    if (this.taken || !this.isWeapon || Game.level.isHiddenAt(this.cx, this.cy)) return;
    const x = Math.round(this.cx - cam.x), y = Math.round(this.y + this.h - cam.y);
    if (x < -30 || y < -30 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) return;
    drawWeaponGlow(ctx, x, y, this, t);
  }
}
