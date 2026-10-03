'use strict';
// Снабжение без тупиков: что подобрано после контрольной точки, переживает гибель;
// тайник снабжения у входа полон и достижим; голодающему герою монстры роняют рюкзак;
// новый эпизод начинается со стартовым набором.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'снабжение и контрольные точки',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      Game.startFromSelect('e2m2', 1);
      let p = Game.player;
      Game.monsters = [];
      const cp = Game.level.decor.find((d) => d.kind === 'checkpoint');
      p.x = cp.x - p.w / 2; p.y = cp.y - p.h; step(5);
      const cpOk = !!Game.checkpoint;
      const key = Game.items.find((it) => it.ch === ')');
      p.x = key.cx - p.w / 2; p.y = key.y + key.h - p.h; step(5);
      const gotKey = p.keys.gold;
      const gun = Game.items.find((it) => it.ch === '7' || it.ch === '5');
      const gunN = +gun.ch; p.weapons[gunN] = false;
      p.x = gun.cx - p.w / 2; p.y = gun.y + gun.h - p.h; step(5);
      const gotGun = p.weapons[gunN];
      p.ammo.shells = 0;
      p.takeDamage(999, null, 'lava', 0, 0, true);
      step(80);
      Game.respawnAtCheckpoint();
      p = Game.player;
      out.respawn = { cpOk, gotKey, gotGun, keyAfter: p.keys.gold, gunAfter: !!p.weapons[gunN], shellsAfter: p.ammo.shells };
      const cache = [];
      for (const def of LEVELS) {
        if (!def.kit) continue;
        Game.skill = 1;
        const bare = new Player(0, 0); bare.ammo = { shells: 0, nails: 0, rockets: 0, cells: 0 };
        const before = def.map.join('').split('').filter((c) => '+HMAYRUNKCQXVW()3456789'.includes(c)).length;
        Game.loadLevel(def.id, { inv: bare.inventory() });
        const want = def.kit.weapons.filter((n) => n >= 3).length + Object.keys(def.kit.ammo || {}).length;
        const got = Game.items.length - before;
        const pl = Game.player;
        let picked = 0;
        for (const it of Game.items.slice(before)) {
          pl.x = it.cx - pl.w / 2; pl.y = it.y + it.h - pl.h; pl.vx = pl.vy = 0;
          Game.monsters = [];
          step(3);
          if (it.taken) picked++;
        }
        cache.push({ id: def.id, got, want, picked });
      }
      out.cache = cache;
      Game.startFromSelect('e1m2', 1);
      p = Game.player;
      p.ammo = { shells: 0, nails: 0, rockets: 0, cells: 0 };
      const k = Game.monsters.find((m) => m.type === 'knight');
      const n0 = Game.items.length;
      k.takeDamage(500, p, 'melee');
      out.pack = !!Game.items.slice(n0).find((it) => it.ch === 'backpack');
      p.ammo.shells = 50;
      const k2 = Game.monsters.find((m) => m.type === 'knight' && m.alive);
      const n1 = Game.items.length;
      k2.takeDamage(500, p, 'melee');
      out.fedNoPack = Game.items.length === n1;
      Game.newGame(3);
      const portal = Game.level.exits.find((e) => e.skill === 1);
      p = Game.player;
      p.x = portal.cx - p.w / 2; p.y = portal.bottom - p.h; step(3);
      out.episodeStart = { level: Game.levelDef.id, weapons: Object.keys(Game.player.weapons).filter((n) => Game.player.weapons[n]).length };
      return out;
    });
    const rs = r.respawn;
    check(rs.cpOk, 'контрольная точка не активировалась');
    check(rs.gotKey && rs.keyAfter, 'золотой ключ потерян после гибели');
    check(rs.gotGun && rs.gunAfter, 'оружие потеряно после гибели');
    check(rs.shellsAfter > 0, 'после гибели нет даже резерва патронов');
    const badCache = r.cache.filter((c) => c.got < c.want || c.picked < c.got);
    check(!badCache.length, 'тайник снабжения неполон или недостижим: ' + badCache.map((c) => `${c.id} ${c.picked}/${c.got}/${c.want}`).join(', '));
    check(r.pack, 'голодающему герою не выпал рюкзак');
    check(r.fedNoPack, 'рюкзак выпал, хотя патроны есть');
    check(r.episodeStart.level === 'e3m1' && r.episodeStart.weapons >= 4, 'эпизод 3 начался без стартового набора');
    noPageErrors(page);
    await page.close();
    return `тайники на ${r.cache.length} уровнях`;
  },
};
