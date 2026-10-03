'use strict';
// Боссы E1–E3 по образцу финала E4M6: появление под табличку, фазы и гибель в замедлении.
// Хтон: электроды заряжаются пультами по разные стороны озера, после ран поднимается лава.
// Шуб-Ниггурат: телепорт в её чрево пробуждает кровь её отродий, со второй фазы — щупальца.
// Вестник Бездны: щит держат кристаллы, без щита он бросается рывками, на 40 % — гроза.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'боссы: Хтон, Шуб-Ниггурат, Вестник Бездны',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      const put = (p, tx, ty) => { p.x = tx * TILE + 8 - p.w / 2; p.y = (ty + 1) * TILE - p.h; p.vx = p.vy = 0; };
      const out = {};

      // --- Хтон ---
      Game.startFromSelect('e1m6', 1); Game.god = true;
      let p = Game.player, lv = Game.level;
      const ch = Game.monsters.find((m) => m.type === 'chthon');
      step(30);
      out.cWait = ch.state;
      put(p, 45, 35); step(2);
      out.cCine = !!Game.cine && Game.cine.boss === ch;
      step(60 * 5);
      out.cActive = ch.state;
      const [b0, b1] = lv.buttons;
      const els = ch.electrodes();
      put(p, 30, 35);
      lv.pressButton(b0, true); step(60 * 3);
      out.cOne = { hits: ch.hits, ready: els.filter((e) => e.est === 'ready').length };
      lv.pressButton(b1, true); step(60 * 2);
      out.cHit1 = ch.hits;
      out.cFloodOn = Game.flood.st !== 'off';
      // герой стоит на берегу, пока лава не поднимется (считаем только ожоги лавой)
      Game.god = false; p.health = 100; p.armor = 0;
      let lavaHits = 0;
      const takeDamage = p.takeDamage;
      p.takeDamage = function (d, a, kind, ...rest) { if (kind === 'lava') lavaHits++; return takeDamage.call(this, d, a, kind, ...rest); };
      let maxH = 0;
      for (let i = 0; i < 60 * 20 && Game.flood.st !== 'hold'; i++) {
        put(p, 48, 35); p.health = 100;
        Game.update(1 / 60);
        maxH = Math.max(maxH, Game.flood.h);
      }
      out.cFlood = { maxH, burned: lavaHits > 0 };
      // на уступе лава не достаёт
      put(p, 53, 32); p.health = 100;
      lavaHits = 0;
      for (let i = 0; i < 60; i++) { ch.cd = 9; Game.projectiles = []; Game.update(1 / 60); }
      out.cLedgeSafe = lavaHits === 0 && Game.flood.h > 15;
      p.takeDamage = takeDamage;
      Game.god = true;
      for (let k = 0; k < 2; k++) {
        step(60 * 2);
        for (const b of [b0, b1]) { b.pressed = false; lv.pressButton(b, true); }
        step(60 * 2);
      }
      out.cDying = ch.state;
      out.cSlow = Game.slowT > 0;
      step(60 * 8);
      out.cDead = !ch.alive;
      out.cGates = lv.movers.filter((m) => m.kind === 'gate' && m.target === 1).length;
      out.cHint = Game.exitHint === true;

      // --- Шуб-Ниггурат ---
      Game.startFromSelect('e2m6', 1); Game.god = true;
      p = Game.player; lv = Game.level;
      const sh = Game.monsters.find((m) => m.type === 'shub');
      out.sSealed = lv.teleports.length > 0 && lv.teleports.every((t) => t.sealed);
      put(p, 64, 40); step(2);
      out.sCine = !!Game.cine && Game.cine.boss === sh;
      step(60 * 5);
      out.sActive = sh.state;
      // запечатанный телепорт не пускает
      const tp = lv.teleports[0];
      p.x = tp.x; p.y = tp.y + tp.h - p.h; p.vx = p.vy = 0;
      step(2);
      out.sBlocked = sh.alive && sh.state === 'active' && Math.abs(p.cx - tp.cx) < 30;
      put(p, 70, 40);
      let strikes = 0, phase2At = -1;
      for (let i = 0; i < 60 * 90 && !Game.shubGate.open; i++) {
        Game.update(1 / 60);
        if (sh.phase >= 2 && phase2At < 0) phase2At = Game.shubGate.have;
        strikes = Math.max(strikes, Game.strikes.length);
        if (i % 40 === 0) for (const m of Game.monsters) if (m.minion && m.alive) { applyDamage(m, 500, p, 'rocket'); break; }
      }
      out.sGate = { have: Game.shubGate.have, need: Game.shubGate.need, open: Game.shubGate.open, phase: sh.phase, phase2At, strikes };
      out.sUnsealed = lv.teleports.every((t) => !t.sealed);
      out.sPointer = Game.exitHint;
      Game.hitstop = 0;
      p.x = tp.x; p.y = tp.y + tp.h - p.h; p.vx = p.vy = 0;
      step(3);
      out.sDying = sh.state;
      out.sSlow = Game.slowT > 0;
      step(60 * 8);
      out.sDead = !sh.alive;
      out.sExit = lv.exits.filter((e) => !e.hidden).length;

      // --- Вестник Бездны ---
      Game.startFromSelect('e3m6', 1); Game.god = true;
      p = Game.player; lv = Game.level;
      const he = Game.monsters.find((m) => m.type === 'herald');
      out.hWait = he.state;
      const hp0 = he.health;
      put(p, 54, 50); step(2);
      out.hCine = !!Game.cine && Game.cine.boss === he;
      applyDamage(he, 500, p, 'rocket');
      out.hIntroImmune = he.health === hp0;
      step(60 * 5);
      out.hActive = he.state;
      for (const m of Game.monsters) if (m.type === 'pylon') applyDamage(m, 9999, p, 'rocket');
      step(5);
      applyDamage(he, he.maxHealth * 0.65, p, 'rocket');
      out.hStorm = !!he.storm;
      let bolts = 0, dive = false;
      put(p, 100, 50);
      for (let i = 0; i < 60 * 30 && !(bolts && dive); i++) {
        Game.update(1 / 60);
        bolts = Math.max(bolts, Game.strikes.filter((s) => s.kind === 'bolt').length);
        if (he.dive) dive = true;
      }
      out.hBolts = bolts; out.hDive = dive;
      Game.render();
      applyDamage(he, 99999, p, 'rocket');
      out.hDying = he.state;
      out.hSlow = Game.slowT > 0;
      step(60 * 8);
      out.hDead = !he.alive;
      out.hExit = lv.exits.filter((e) => !e.hidden).length;
      Game.render();
      return out;
    });
    // Хтон
    check(r.cWait === 'idle', 'Хтон поднялся раньше, чем герой вошёл на арену: ' + r.cWait);
    check(r.cCine, 'нет появления Хтона');
    check(r.cActive === 'active', 'Хтон не начал бой после появления: ' + r.cActive);
    check(r.cOne.hits === 0 && r.cOne.ready === 1, 'один электрод уже ранит Хтона или не заряжается: ' + JSON.stringify(r.cOne));
    check(r.cHit1 === 1, 'два заряженных электрода не ранили Хтона: ' + r.cHit1);
    check(r.cFloodOn && r.cFlood.maxH > 15 && r.cFlood.burned, 'лава не поднялась или не жжёт: ' + JSON.stringify(r.cFlood));
    check(r.cLedgeSafe, 'лава достаёт героя на уступе');
    check(r.cDying === 'dying' && r.cSlow, 'Хтон не гибнет в замедлении: ' + r.cDying);
    check(r.cDead && r.cGates > 0 && r.cHint, `после Хтона нет пути к руне: ворот ${r.cGates}, стрелка ${r.cHint}`);
    // Шуб-Ниггурат
    check(r.sSealed, 'телепорт к Шуб-Ниггурат не запечатан');
    check(r.sCine && r.sActive === 'active', 'нет появления Шуб-Ниггурат: ' + r.sActive);
    check(r.sBlocked, 'запечатанный телепорт пропустил героя');
    check(r.sGate.open && r.sGate.have >= r.sGate.need, 'кровь отродий не открыла телепорт: ' + JSON.stringify(r.sGate));
    check(r.sGate.phase2At > 0 && r.sGate.phase2At < r.sGate.need && r.sGate.strikes > 0, 'нет второй фазы со щупальцами: ' + JSON.stringify(r.sGate));
    check(r.sGate.phase === 3 && r.sUnsealed && r.sPointer === 'teleport', 'телепорт открыт без паники Матери или стрелки к нему');
    check(r.sDying === 'dying' && r.sSlow, 'телефраг не убил Шуб-Ниггурат: ' + r.sDying);
    check(r.sDead && r.sExit > 0, 'после Шуб-Ниггурат не открылся выход');
    // Вестник Бездны
    check(r.hWait === 'dormant', 'Вестник висит над ареной до появления: ' + r.hWait);
    check(r.hCine && r.hIntroImmune, 'нет появления Вестника или он уязвим во время него');
    check(r.hActive === 'active', 'Вестник не начал бой: ' + r.hActive);
    check(r.hStorm && r.hBolts >= 2, 'нет грозы Бездны: молний ' + r.hBolts);
    check(r.hDive, 'Вестник без щита не бросается рывком');
    check(r.hDying === 'dying' && r.hSlow && r.hDead && r.hExit > 0, 'Вестник не гибнет в замедлении или нет выхода');
    noPageErrors(page);
    await page.close();
    return `лава до ${Math.round(r.cFlood.maxH)} px, кровь ${r.sGate.need}, молний ${r.hBolts}`;
  },
};
