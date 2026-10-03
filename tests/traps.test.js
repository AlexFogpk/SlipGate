'use strict';
// Засады: срабатывают один раз, монстры сразу идут на героя, на «Лёгком» их меньше,
// и ни один монстр засады не появляется внутри стены.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'засады',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      for (const skill of [0, 2]) {
        Game.startFromSelect('e1m2', skill);
        const p = Game.player;
        const before = Game.monsters.length;
        const t = Game.traps[1];
        const [x0, , x1, y1] = t.at;
        p.x = (x0 + x1) / 2 * 16; p.y = (y1 + 1) * 16 - p.h; p.vx = p.vy = 0;
        step(40);
        const spawned = Game.monsters.length - before;
        const alerted = Game.monsters.slice(before).every((m) => m.target === p);
        const again = Game.monsters.length;
        step(60);
        out['skill' + skill] = { fired: t.fired, spawned, noRefire: Game.monsters.length === again, alerted };
      }
      const blocked = [];
      for (const def of LEVELS) {
        if (!def.traps) continue;
        Game.startFromSelect(def.id, 2);
        const lv = Game.level;
        for (const t of def.traps) for (const [sx, sy, ch] of t.spawn) {
          const m = new Monster(MONSTER_CHARS[ch], sx * 16 + 8, (sy + 1) * 16);
          if (!lv.boxFree(m.x, m.y, m.w, m.h)) blocked.push(def.id + ' ' + ch + '@' + sx + ',' + sy);
        }
      }
      out.blocked = blocked;
      return out;
    });
    for (const k of ['skill0', 'skill2']) {
      const s = r[k];
      check(s.fired && s.spawned > 0, k + ': засада не сработала');
      check(s.noRefire, k + ': засада сработала повторно');
      check(s.alerted, k + ': монстры засады не нацелены на героя');
    }
    check(r.skill0.spawned < r.skill2.spawned, 'на «Лёгком» монстров засады должно быть меньше');
    check(!r.blocked.length, 'монстры засад в стене: ' + r.blocked.join(', '));
    noPageErrors(page);
    await page.close();
    return `лёгкий ${r.skill0.spawned}, трудный ${r.skill2.spawned} монстров`;
  },
};
