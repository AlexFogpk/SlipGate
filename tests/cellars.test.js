'use strict';
// Погреба под люками (floor_secret) не ловушки: открыв люк и спрыгнув вниз, герой
// выбирается обратно — с площадки внутри погреба через люк на пол рядом с ним.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'погреба под люками',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const res = [];
      for (const def of LEVELS) {
        // люк: '$' в два тайла шириной, под ним пусто, ниже — площадка '-'
        const rows = def.map, hatches = [];
        rows.forEach((row, y) => {
          for (let x = 0; x + 1 < row.length; x++) {
            if (row[x] === '$' && row[x + 1] === '$' && row[x - 1] !== '$' && row[x + 2] !== '$' && rows[y + 1] && rows[y - 1][x] !== '$' &&
                rows[y + 2] && rows[y + 3] && rows[y + 3][x] === '-') hatches.push({ x, y });
          }
        });
        for (const hz of hatches) {
          Game.startFromSelect(def.id, 1);
          Game.god = true;
          Game.monsters = [];
          const lv = Game.level, p = Game.player;
          const mover = lv.movers.find((m) => m.kind === 'secret' && m.x === hz.x * 16 && m.y === hz.y * 16);
          if (!mover) { res.push({ id: def.id, x: hz.x, y: hz.y, ok: false, why: 'нет мовера' }); continue; }
          lv.openSecret(mover);
          for (let i = 0; i < 90; i++) Game.update(1 / 60);
          // 1) со дна погреба запрыгнуть на площадку под люком
          const platTop = (hz.y + 3) * 16, floorTop = hz.y * 16;
          p.x = (hz.x - 2) * 16 + 2; p.y = (hz.y + 5) * 16 - p.h; p.vx = p.vy = 0;
          let onPlat = false;
          for (let i = 0; i < 60 * 3 && !onPlat; i++) {
            Input.down.clear();
            if (p.cx < hz.x * 16 + 8) Input.down.add('KeyD');
            if (i % 40 < 20) Input.down.add('Space');
            Game.update(1 / 60);
            onPlat = p.onGround && Math.abs(p.y + p.h - platTop) < 2;
          }
          // 2) с площадки — прыжок вверх через люк и шаг в сторону на пол (две траектории, как у человека)
          let out = false;
          for (const [tile, dir, delay] of [[0, 1, 8], [1, -1, 12], [0, -1, 12], [1, 1, 12]]) {
            if (out) break;
            p.x = (hz.x + tile) * 16 + 3; p.y = platTop - p.h; p.vx = p.vy = 0;
            for (let i = 0; i < 10; i++) { Input.down.clear(); Game.update(1 / 60); }
            for (let i = 0; i < 90 && !out; i++) {
              Input.down.clear();
              Input.down.add('Space');
              if (i >= delay) Input.down.add(dir > 0 ? 'KeyD' : 'KeyA');
              Game.update(1 / 60);
              if (p.onGround && p.y + p.h <= floorTop + 1) out = true;
            }
          }
          out = out && onPlat;
          Input.down.clear();
          res.push({ id: def.id, x: hz.x, y: hz.y, ok: out });
        }
      }
      return res;
    });
    const bad = r.filter((h) => !h.ok);
    check(r.length > 0, 'не найдено ни одного люка');
    check(!bad.length, 'из погреба не выбраться: ' + bad.map((h) => `${h.id} (${h.x},${h.y})${h.why ? ' ' + h.why : ''}`).join(', '));
    noPageErrors(page);
    await page.close();
    return `люков: ${r.length}, из всех можно выбраться`;
  },
};
