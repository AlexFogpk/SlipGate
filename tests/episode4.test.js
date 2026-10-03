'use strict';
// Механики четвёртого эпизода и финала: пустота, мерцание фантома, щит стража,
// алтари и барьер Древнего, переход из E3 в E4.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'механики эпизода 4 и босс',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      Game.startFromSelect('e4m1', 1);
      let p = Game.player;
      p.pent = 30;
      p.x = 52 * 16; p.y = 50 * 16; p.vx = 0; p.vy = 0;
      step(120);
      out.void = { alive: p.alive, gibbed: p.gibbed };
      Game.startFromSelect('e4m1', 1);
      p = Game.player;
      Game.monsters = [];
      const ph = new Monster('phantom', p.cx + 90, p.y + p.h);
      Game.monsters.push(ph);
      ph.alert(p, false);
      const x0 = ph.x;
      let blinked = false;
      for (let i = 0; i < 20 && !blinked; i++) { ph.blinkCd = 0; ph.takeDamage(5, p, 'nail'); if (Math.abs(ph.x - x0) > 20) blinked = true; }
      out.blinked = blinked;
      Game.monsters = [];
      const g = new Monster('guardian', p.cx + 120, p.y + p.h);
      Game.monsters.push(g);
      g.facing = -1; g.state = 'chase'; g.target = p;
      let h = g.health; g.takeDamage(40, p, 'nail'); const front = h - g.health;
      g.facing = 1; h = g.health; g.takeDamage(40, p, 'nail'); const back = h - g.health;
      g.facing = -1; h = g.health; g.takeDamage(40, p, 'explosion'); const blast = h - g.health;
      out.guardian = { front, back, blast };
      Game.startFromSelect('e4m6', 1);
      p = Game.player;
      Game.god = true;
      const boss = Game.monsters.find((m) => m.type === 'elder');
      p.x = 100 * 16; p.y = 47 * 16 - p.h; p.vx = p.vy = 0;
      step(30);
      out.elderWake = boss.state;
      const hp0 = boss.health;
      boss.takeDamage(200, p, 'rocket');
      out.shieldHold = boss.health === hp0;
      const lit = [];
      for (const b of Game.level.buttons) {
        p.x = b.x; p.y = b.y + b.h - p.h; p.vx = p.vy = 0;
        step(3);
        lit.push(Game.level.buttons.filter((x) => x.lit).length);
      }
      out.altars = lit;
      out.shieldedAfter = boss.elderShielded();
      const hp1 = boss.health;
      boss.takeDamage(200, p, 'rocket');
      out.damaged = hp1 - boss.health;
      boss.takeDamage(boss.maxHealth * 0.4, p, 'rocket');
      out.rage = boss.rage;
      boss.takeDamage(99999, p, 'rocket');
      out.dying = boss.state;
      step(60 * 5);
      out.bossGone = !boss.alive;
      out.exits = Game.level.exits.filter((e) => !e.hidden).length;
      Game.startFromSelect('e4m6', 1);
      const b0 = Game.level.buttons[0];
      Game.level.pressButton(b0);
      out.shotAltar = !!b0.lit;
      Game.startFromSelect('e3m6', 1);
      Game.levelDef.finale && Game.startFinale(Game.levelDef.finale);
      Game.finaleDone = true;
      Game.nextLevel();
      out.afterE3 = Game.levelDef.id;
      return out;
    });
    check(!r.void.alive && r.void.gibbed, 'пустота не убила героя под пентаграммой');
    check(r.blinked, 'фантом не мерцает от урона');
    check(r.guardian.front < r.guardian.back && r.guardian.blast >= r.guardian.back, `щит стража: спереди ${r.guardian.front}, в спину ${r.guardian.back}, взрыв ${r.guardian.blast}`);
    check(r.elderWake === 'active', 'Древний не проснулся');
    check(r.shieldHold, 'барьер Древнего пропустил урон до алтарей');
    check(r.altars.join() === '1,2,3,4', 'алтари зажигаются неправильно: ' + r.altars.join());
    check(!r.shieldedAfter && r.damaged > 0, 'барьер не снят после всех алтарей');
    check(r.rage, 'Древний не впал в ярость');
    check(r.dying === 'dying' && r.bossGone, 'Древний не погиб');
    check(r.exits >= 1, 'после победы не открылся выход');
    check(!r.shotAltar, 'алтарь зажёгся выстрелом');
    check(r.afterE3 === 'e4m1', 'после финала E3 не начался E4: ' + r.afterE3);
    noPageErrors(page);
    await page.close();
    return 'алтари ' + r.altars.join('→');
  },
};
