'use strict';
// Дуэли для замера сложности: на ровной арене бот бегает, прыгает и стреляет из ружья по
// бессмертному монстру; считается урон, который бот получает за секунду. Случайность
// с зерном — у каждой дуэли своё, так что результат не зависит от порядка и повторяется.
// Используют тест difficulty и отчёт tools/dev/difficulty.js.

// Выполняется в странице: page.evaluate(duels, opts).
// opts: { types, skills, n, dur, keep: [ближе — отходит, дальше — подходит], seed, scales }
// scales — подмена множителей сложности (например, старые) для сравнения.
function duels(opts) {
  const { types, skills, n = 3, dur = 15, keep = [110, 230], seed = 1, scales = null } = opts;
  const W = 150, H = 22;
  if (!LEVELS.find((l) => l.id === 'duel')) {
    const map = [];
    for (let y = 0; y < H; y++) map.push(y === 0 || y >= H - 2 ? '#'.repeat(W) : '#' + ' '.repeat(W - 2) + '#');
    map[H - 3] = '#' + ' '.repeat(74) + 'P' + ' '.repeat(W - 77) + '#';
    LEVELS.push({ id: 'duel', name: 'DUEL', title: 'Дуэль', theme: 'base', map, kit: { weapons: [1, 2], ammo: {} } });
  }
  const saved = {};
  if (scales) {
    for (const [k, a] of Object.entries(scales)) {
      saved[k] = Game[k];
      // боль — выражение от p (боль монстра) и s (сложность), остальное — таблицы по сложностям
      const f = k === 'skillPainChance' ? new Function('p', 's', 'return ' + a) : null;
      Game[k] = f ? function (p) { return f(p, this.skill); } : function () { return a[this.skill]; };
    }
  }
  const rnd = Math.random;
  const taken = { v: 0 };
  const td = Player.prototype.takeDamage;
  Player.prototype.takeDamage = function (...a) { const h = this.health; td.apply(this, a); taken.v += Math.max(0, h - this.health); this.health = 100; this.alive = true; };
  const out = {};
  try {
    types.forEach((type, ti) => {
      out[type] = {};
      for (const skill of skills) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          Math.random = mulberry32(seed * 7919 + ti * 1009 + skill * 101 + k);
          Game.startFromSelect('duel', skill);
          const p = Game.player;
          p.weapons[2] = true; p.weapon = 2;
          Game.monsters = []; Game.projectiles = [];
          const side = k % 2 ? 1 : -1;
          const m = new Monster(type, p.cx + side * 200, p.y + p.h - (MONSTER_DEFS[type].fly ? 40 : 0));
          m.health = m.maxHealth = 1e6;
          Game.monsters.push(m); m.alert(p, false);
          taken.v = 0;
          let dir = 1, dirT = 0;
          for (let i = 0; i < 60 * dur; i++) {
            p.ammo.shells = 100; p.weapon = 2; p.armor = 0;
            const d = m.cx - p.cx, ad = Math.abs(d);
            dirT -= 1 / 60;
            if (dirT <= 0) { dirT = 0.5 + Math.random() * 0.6; dir = Math.random() < 0.5 ? -1 : 1; }
            let mv = dir;
            if (ad < keep[0]) mv = -Math.sign(d); else if (ad > keep[1]) mv = Math.sign(d);
            if ((p.x < 40 && mv < 0) || (p.x > (W - 3) * 16 && mv > 0)) mv = -mv;
            Input.down.clear();
            Input.down.add(mv > 0 ? 'KeyD' : 'KeyA');
            if (Math.random() < 0.04) Input.down.add('Space');
            Input.mouseDown = true;
            Input.mouseX = (Game.offX + (m.cx - Game.cam.x) * Game.scale) / Game.dpr;
            Input.mouseY = (Game.offY + (m.cy - Game.cam.y) * Game.scale) / Game.dpr;
            Game.update(1 / 60);
          }
          sum += taken.v / dur;
        }
        out[type][skill] = sum / n;
      }
    });
  } finally {
    Math.random = rnd;
    Player.prototype.takeDamage = td;
    for (const [k, f] of Object.entries(saved)) Game[k] = f;
    Input.down.clear(); Input.mouseDown = false;
  }
  return out;
}

// Множители сложности до выравнивания — для сравнения в отчёте и в тесте.
const OLD_SCALES_SRC = {
  skillDamageScale: [0.7, 1, 1, 1.1],
  skillCdScale: [1.35, 1, 0.8, 0.55],
  skillLeapCd: [1.35, 1, 0.8, 0.55],
  skillAI: [0.3, 0.7, 1, 1.25],
  skillLead: [0, 0.55, 0.85, 1],
  skillBossCd: [1.35, 1, 0.8, 0.55],
  skillBossHp: [0.7, 1, 1.2, 1.4],
};
// функции через page.evaluate не передаются — боль задана строкой и собирается в странице
const OLD_SCALES = Object.assign({ skillPainChance: 'p * [1, 1, 0.8, 0.4][s]' }, OLD_SCALES_SRC);

module.exports = { duels, OLD_SCALES };
