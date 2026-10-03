'use strict';
// Стартовый зал — башня выбора сложности: лёгкие врата в конце первого этажа, нормальные
// и сложные — выше, по лестнице площадок, «Кошмар» под водой. Ни одни врата не стоят на
// пути к другим: бег вправо с прыжками по первому этажу приводит к лёгким, подъём по
// площадкам — к нормальным и сложным, не задевая других врат.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'стартовый зал и выбор сложности',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      const reset = () => { Game.newGame(1); Game.god = true; Input.down.clear(); };
      reset();
      const lv = Game.level;
      // каждые врата — своя сложность, подписи над ними совпадают
      const gates = lv.exits.filter((e) => e.skill !== null).map((e) => ({ skill: e.skill, x: Math.floor(e.cx / TILE), y: Math.floor(e.bottom / TILE) - 1 }));
      out.gates = gates;
      out.labels = gates.map((g) => (Game.levelDef.labels.find((l) => Math.abs(l.x - g.x) <= 3 && l.y < g.y && g.y - l.y < 5) || {}).text);
      // бег вправо с прыжками по первому этажу
      const run = (hold, maxSec, each) => {
        for (let i = 0; i < maxSec * 60; i++) {
          Input.down.clear(); for (const k of hold(i)) Input.down.add(k);
          Game.update(1 / 60);
          if (each) each(i);
          if (Game.levelDef.id !== 'start') return true;
        }
        return false;
      };
      out.walked = run((i) => (i % 40 < 10 ? ['KeyD', 'Space'] : ['KeyD']), 30);
      out.walkSkill = Game.skill; out.walkLevel = Game.levelDef.id;
      // подъём: по лестнице во дворе, затем вправо по этажу
      const climb = (floorStand) => {
        reset();
        const p = Game.player;
        // ставим героя на верхнюю площадку лестницы нужной высоты и идём вправо по этажу
        const plats = [];
        for (let y = 0; y < lv.h; y++) for (let x = 1; x < lv.w; x++) if (lv.tile(x, y) === T.PLAT && lv.tile(x - 1, y) !== T.PLAT) plats.push({ x, y });
        const pl = plats.filter((q) => q.y - 1 > floorStand).sort((a, b) => a.y - b.y)[0];
        p.x = (pl.x + 1) * TILE; p.y = pl.y * TILE - p.h; p.vx = p.vy = 0;
        Game.update(1 / 60);
        return run((i) => (i < 14 ? ['KeyD', 'Space'] : ['KeyD']), 12) && Game.skill;
      };
      out.floor2 = climb(gates.find((g) => g.skill === 1).y);
      out.floor3 = climb(gates.find((g) => g.skill === 2).y);
      return out;
    });
    const by = Object.fromEntries(r.gates.map((g, i) => [g.skill, Object.assign({ label: r.labels[i] }, g)]));
    check(r.gates.length === 4 && [0, 1, 2, 3].every((s) => by[s]), 'врат сложности не четыре: ' + JSON.stringify(r.gates));
    check(by[0].label === 'ЛЁГКИЙ' && by[1].label === 'НОРМАЛЬНЫЙ' && by[2].label === 'СЛОЖНЫЙ', 'подписи не совпадают с вратами: ' + JSON.stringify(by));
    check(by[0].y > by[1].y && by[1].y > by[2].y, 'сложнее — не выше: ' + JSON.stringify(r.gates));
    check(r.walked && r.walkLevel === 'e1m1' && r.walkSkill === 0, `бег по первому этажу привёл не к лёгким вратам: сложность ${r.walkSkill}`);
    check(r.floor2 === 1, 'со второго этажа герой попал не в нормальные врата: ' + r.floor2);
    check(r.floor3 === 2, 'с третьего этажа герой попал не в сложные врата: ' + r.floor3);
    noPageErrors(page);
    await page.close();
    return 'лёгкий внизу, нормальный и сложный выше, кошмар под водой';
  },
};
