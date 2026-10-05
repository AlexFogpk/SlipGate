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
      // мерцание — скачок на новое место; отступ от исходной точки не годится: фантом может
      // возникнуть рядом с ней, а за 18 попаданий он погибает
      ph.health = 1e4;
      let blinked = false;
      for (let i = 0; i < 20 && !blinked; i++) {
        const bx = ph.x, by = ph.y;
        ph.blinkCd = 0; ph.takeDamage(5, p, 'nail');
        if (ph.x !== bx || ph.y !== by) blinked = true;
      }
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
      out.dormant = boss.state;
      // в конце моста Древний поднимается из бездны; пока он появляется, алтари спят
      const zone = Game.levelDef.bossIntro;
      p.x = zone[0] * 16 + 8; p.y = (zone[3] + 1) * 16 - p.h; p.vx = p.vy = 0;
      step(10);
      out.cine = !!Game.cine;
      const b0 = Game.level.buttons[0];
      p.x = b0.x + 6 - p.w / 2; p.y = b0.y + 14 - p.h;
      step(60);
      out.chargeDuringIntro = b0.charge || 0;
      step(60 * 4);
      out.elderWake = boss.state;
      const hp0 = boss.health;
      boss.takeDamage(200, p, 'rocket');
      out.shieldHold = boss.health === hp0;
      const lit = [];
      // алтарь зажигается удержанием: касания мало
      p.x = b0.x + 6 - p.w / 2; p.y = b0.y + 14 - p.h; p.vx = p.vy = 0;
      step(3);
      out.touchLit = b0.lit;
      for (const b of Game.level.buttons) {
        Game.monsters = Game.monsters.filter((m) => !m.minion);
        let n = 0;
        while (!b.lit && n++ < 60 * 8) { p.x = b.x + 6 - p.w / 2; p.y = b.y + 14 - p.h; p.vx = p.vy = 0; step(1); }
        lit.push(Game.level.buttons.filter((x) => x.lit).length);
      }
      out.altars = lit;
      out.shieldedAfter = boss.elderShielded();
      out.stunned = boss.stunT > 0;
      out.hint = HUD.centerText;
      const hp1 = boss.health;
      boss.takeDamage(200, p, 'rocket');
      out.damaged = hp1 - boss.health;
      boss.takeDamage(boss.maxHealth * 0.4, p, 'rocket');
      // на половине здоровья Древний вытягивает две руны и снова под барьером
      out.drained = boss.drained && boss.elderShielded() && Game.level.buttons.filter((x) => x.lit).length === 2;
      for (const b of Game.level.buttons) {
        Game.monsters = Game.monsters.filter((m) => !m.minion);
        let n = 0;
        while (!b.lit && n++ < 60 * 8) { p.x = b.x + 6 - p.w / 2; p.y = b.y + 14 - p.h; p.vx = p.vy = 0; step(1); }
      }
      out.relit = !boss.elderShielded();
      boss.takeDamage(boss.maxHealth * 0.2, p, 'rocket');
      out.rage = boss.rage;
      boss.takeDamage(99999, p, 'rocket');
      out.dying = boss.state;
      step(60 * 8);   // гибель идёт в замедлении
      out.bossGone = !boss.alive;
      out.exits = Game.level.exits.filter((e) => !e.hidden).length;
      out.exitHint = Game.exitHint;
      Game.render();
      Game.startFromSelect('e4m6', 1);
      const shotB = Game.level.buttons[0];
      Game.level.pressButton(shotB);
      out.shotAltar = !!shotB.lit;
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
    check(r.dormant === 'dormant', 'Древний не ждёт в бездне до появления: ' + r.dormant);
    check(r.cine, 'в конце моста не началось появление Древнего');
    check(r.chargeDuringIntro === 0, 'алтарь заряжается, пока Древний ещё не явился');
    check(r.elderWake === 'active', 'Древний не проснулся после появления: ' + r.elderWake);
    check(!r.touchLit, 'алтарь зажёгся от одного касания');
    check(r.shieldHold, 'барьер Древнего пропустил урон до алтарей');
    check(r.altars.join() === '1,2,3,4', 'алтари зажигаются неправильно: ' + r.altars.join());
    check(!r.shieldedAfter && r.damaged > 0, 'барьер не снят после всех алтарей');
    check(r.stunned && /можно ранить/.test(r.hint), 'после алтарей нет оглушения Древнего и подсказки: ' + r.hint);
    check(r.drained, 'на половине здоровья Древний не вытянул руны');
    check(r.relit, 'после повторного зажжения барьер не пал');
    check(r.rage, 'Древний не впал в ярость');
    check(r.dying === 'dying' && r.bossGone, 'Древний не погиб');
    check(r.exits >= 1, 'после победы не открылся выход');
    check(r.exitHint, 'после победы нет стрелки к выходу');
    check(!r.shotAltar, 'алтарь зажёгся выстрелом');
    check(r.afterE3 === 'e4m1', 'после финала E3 не начался E4: ' + r.afterE3);
    noPageErrors(page);
    await page.close();
    return 'алтари ' + r.altars.join('→');
  },
};
