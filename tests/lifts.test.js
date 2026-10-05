'use strict';
// Лифты по вызову: встал — поехал на другую остановку; пульт на остановке вызывает
// лифт и касанием, и выстрелом; где пульта нет, лифт приезжает, когда герой подходит.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'лифты и пульты вызова',
  async run(browser) {
    const page = await openGame(browser);
    const res = await page.evaluate(() => {
      const out = { lifts: 0, buttons: 0, auto: 0, bad: [] };
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      const wait = (lf, goal, sec) => { for (let i = 0; i < sec * 60; i++) { Game.update(1 / 60); if (lf.t === goal && lf.idle) return true; } return false; };
      for (const def of LEVELS) {
        if (!def.map.some((r) => r.includes('_'))) continue;
        Game.startFromSelect(def.id, 1);
        Game.god = true;
        const lv = Game.level;
        lv.lifts.forEach((lf, i) => {
          out.lifts++;
          const tag = `${def.id} лифт ${i}`;
          Game.monsters = [];
          const p = Game.player;
          // поездка: встали на лифт на остановке 0 — он едет на остановку 1
          p.x = lf.x + lf.w / 2 - p.w / 2; p.y = lf.y - p.h - 1; p.vx = p.vy = 0;
          if (!wait(lf, 1, lf.dur + 3)) out.bad.push(tag + ': не поехал, когда на него встали');
          // уводим героя далеко и проверяем каждую остановку
          for (const st of [0, 1]) {
            const b = lv.liftButtons.find((x) => x.lift === lf && x.stop === st);
            p.x = 4 * TILE; p.y = 2 * TILE; p.vx = p.vy = 0;
            step(5);
            lf.goal = 1 - st; lf.t = 1 - st; lf.moving = false; lf.wait = 0; lf.armed = true;
            step(2);
            if (b) {
              out.buttons++;
              // касание пульта
              p.x = b.x + b.w / 2 - p.w / 2; p.y = b.y + b.h - p.h - 1; p.vx = p.vy = 0;
              if (!wait(lf, st, lf.dur + 3)) out.bad.push(`${tag}: пульт на остановке ${st} не вызвал лифт`);
            } else if (lf.autoStops && lf.autoStops.includes(st)) {
              out.auto++;
              const sx = (st ? lf.x1 : lf.x0) + lf.w / 2, sy = st ? lf.y1 : lf.y0;
              p.x = sx - p.w / 2 + (lf.vertical ? 0 : 0); p.y = sy - p.h - 1; p.vx = p.vy = 0;
              const base = { x: p.x, y: p.y };
              // стоим рядом с остановкой (герой может падать — держим его на месте)
              let ok = false;
              for (let k = 0; k < (lf.dur + 3) * 60; k++) { p.x = base.x; p.y = base.y; p.vy = 0; Game.update(1 / 60); if (lf.t === st && lf.idle) { ok = true; break; } }
              if (!ok) out.bad.push(`${tag}: без пульта на остановке ${st} лифт не приехал сам`);
            } else out.bad.push(`${tag}: на остановке ${st} ни пульта, ни самовызова`);
          }
        });
      }
      // выстрел по пульту тоже вызывает лифт
      Game.startFromSelect('e2m1', 1); Game.god = true; Game.monsters = [];
      const lv = Game.level, lf = lv.lifts[0];
      const b = lv.liftButtons.find((x) => x.lift === lf && x.stop === 0);
      lf.goal = 1; lf.t = 1; lf.moving = false; lf.wait = 0;
      const p = Game.player;
      p.x = b.x - 60; p.y = b.y + b.h - p.h; p.vx = p.vy = 0;
      step(3);
      hitscan(p, p.cx, b.y + 4, Math.atan2(b.y + 4 - (b.y + 4), b.x + 5 - p.cx), 1, 1, 0);
      let shot = false;
      for (let i = 0; i < (lf.dur + 3) * 60; i++) { Game.update(1 / 60); if (lf.t === 0 && lf.idle) { shot = true; break; } }
      out.shot = shot;
      return out;
    });
    check(res.lifts >= 25, 'лифтов меньше, чем ожидалось: ' + res.lifts);
    check(!res.bad.length, 'лифты:\n' + res.bad.join('\n'));
    check(res.shot, 'выстрел по пульту не вызвал лифт');
    noPageErrors(page);
    return `лифтов ${res.lifts}, пультов ${res.buttons}, самовызов ${res.auto}`;
  },
};
