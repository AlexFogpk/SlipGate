'use strict';
// ИИ монстров на маленьких тестовых картах: обход по следу героя, прыжок через
// провал, уворот от ракеты, стрельба на упреждение, дистанция стрелка, огонь сквозь своих.
const { openGame, check, noPageErrors } = require('./lib');

// Карта из строк; '#' по краям дописывается сама.
function room(w, h, draw) {
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : ' ')));
  draw((x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; });
  return g.map((r) => r.join(''));
}

module.exports = {
  name: 'ИИ монстров',
  async run(browser) {
    const page = await openGame(browser);
    const maps = {
      // карниз (#) над полом: подняться можно только по платформам слева
      stairs: room(34, 14, (f) => { f(2, 11, 5, 11, '-'); f(6, 9, 9, 9, '-'); f(11, 7, 32, 7, '#'); f(28, 6, 28, 6, 'P'); }),
      // провал в три клетки, глубже, чем монстр решится спрыгнуть
      gap: room(40, 18, (f) => { f(1, 8, 38, 16, '#'); f(15, 8, 17, 16, ' '); f(30, 7, 30, 7, 'P'); }),
      flat: room(40, 10, (f) => { f(1, 8, 38, 8, '#'); f(4, 7, 4, 7, 'P'); }),
    };
    const res = await page.evaluate((maps) => {
      const out = {};
      for (const [id, map] of Object.entries(maps)) LEVELS.push({ id: 'ai_' + id, name: 'AI', title: id, theme: 'base', map });
      const load = (id, skill = 2) => { Game.skill = skill; Game.loadLevel('ai_' + id, { inv: null }); Game.state = 'playing'; Game.god = true; Game.monsters = []; };
      const add = (type, tx, ty) => { const m = new Monster(type, tx * TILE + 8, (ty + 1) * TILE); Game.monsters.push(m); m.alert(Game.player, false); return m; };
      const run = (sec, until) => { for (let i = 0; i < sec * 60; i++) { Game.update(1 / 60); if (until && until()) return i / 60; } return -1; };

      // 1. обход: монстр под карнизом идёт по следу героя к лестнице из платформ
      load('stairs');
      const crumbs = [];
      for (let x = 22; x >= 3; x -= 1.5) crumbs.push([x, 13]);
      for (let x = 2.5; x <= 5.5; x += 1.5) crumbs.push([x, 11]);
      for (let x = 6.5; x <= 9.5; x += 1.5) crumbs.push([x, 9]);
      for (let x = 11.5; x <= 28; x += 1.5) crumbs.push([x, 7]);
      const setTrail = () => { Game.trail = crumbs.map(([x, y]) => ({ x: x * TILE, y: y * TILE })); };
      setTrail();
      const recordTrail = Game.recordTrail;
      Game.recordTrail = function () {};   // герой стоит, след задан вручную
      const k = add('knight', 26, 12);
      out.stairs = run(15, () => k.y + k.h <= 7 * TILE + 2);
      // без следа тот же монстр застревает под карнизом
      load('stairs'); Game.trail = [];
      const k2 = add('knight', 26, 12);
      out.stairsNoTrail = run(8, () => k2.y + k2.h <= 7 * TILE + 2);
      Game.recordTrail = recordTrail;

      // 2. провал: рыцарь перепрыгивает, а не стоит у края
      load('gap');
      const k3 = add('knight', 8, 7);
      out.gap = run(6, () => k3.x > 19 * TILE && k3.onGround);
      out.gapFell = k3.y + k3.h > 8 * TILE + 4;

      // 3. уворот: ракета летит в рыцаря — он прыгает (при удаче); без удачи — нет
      const rnd = Math.random;
      for (const [luck, key] of [[0, 'dodge'], [0.999, 'noDodge']]) {
        load('flat');
        const m = add('knight', 18, 7);
        run(0.3);
        Math.random = () => luck;
        const p = Game.player;
        spawnProjectile('rocket', p, p.cx + 10, m.cy, 0);
        let jumped = false;
        for (let i = 0; i < 24; i++) { Game.update(1 / 60); if (m.vy < -150) jumped = true; }
        Math.random = rnd;
        out[key] = jumped;
      }

      // 4. упреждение: цель уходит вправо — выстрел направлен вперёд по ходу
      load('flat');
      const e = add('enforcer', 10, 7);
      const tgt = { cx: e.cx + 200, cy: e.cy - 60, vx: 200, vy: 0 };
      const direct = e.aimAt(Object.assign({}, tgt, { vx: 0 }), 0, PROJ.laser.speed);
      out.lead = Math.abs(direct - e.aimAt(tgt, 0, PROJ.laser.speed));
      Game.skill = 0;
      out.leadEasy = Math.abs(direct - e.aimAt(tgt, 0, PROJ.laser.speed));

      // 5. стрелок вплотную к герою пятится на свою дистанцию
      load('flat');
      const g = add('grunt', 6, 7);
      g.pref = 100;   // удобная дистанция этого солдата
      const d0 = Math.abs(g.cx - Game.player.cx);
      run(2);
      out.backoff = [d0, Math.abs(g.cx - Game.player.cx)];

      // 6. солдат не стреляет сквозь рыцаря, который стоит между ним и героем
      load('flat');
      const shooter = add('grunt', 14, 7);
      const ally = add('knight', 9, 7);
      ally.update = function () {};   // рыцарь стоит на месте
      out.allyBlocked = shooter.allyInLine();
      ally.x = 30 * TILE;
      out.allyClear = !shooter.allyInLine();
      return out;
    }, maps);
    check(res.stairs >= 0, 'монстр не нашёл обход по лестнице к герою на карнизе');
    check(res.stairsNoTrail < 0, 'тестовая карта слишком простая: без следа монстр тоже дошёл');
    check(res.gap >= 0 && !res.gapFell, 'рыцарь не перепрыгнул провал');
    check(res.dodge && !res.noDodge, `уворот работает неверно: удача → ${res.dodge}, неудача → ${res.noDodge}`);
    check(res.lead > 0.05, 'нет стрельбы на упреждение: разница ' + res.lead.toFixed(3));
    check(res.leadEasy < 1e-6, 'на «Лёгком» упреждения быть не должно');
    check(res.backoff[1] >= 50, `стрелок не отступил: ${res.backoff.map(Math.round).join(' → ')}`);
    check(res.allyBlocked && res.allyClear, 'проверка союзника на линии огня неверна');
    noPageErrors(page);
    return `обход ${res.stairs.toFixed(1)} с, провал ${res.gap.toFixed(1)} с, упреждение ${res.lead.toFixed(2)} рад, отступ ${res.backoff.map(Math.round).join('→')} px`;
  },
};
