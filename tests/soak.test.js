'use strict';
// Каждый уровень: минуту игры случайными нажатиями с прыжками по точкам появления монстров.
// Ловит исключения, NaN в координатах и ошибки отрисовки.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'прогон всех уровней',
  async run(browser) {
    const page = await openGame(browser);
    const frames = +(process.env.SOAK_FRAMES || 3600);
    const res = await page.evaluate((frames) => {
      const out = [];
      const keys = ['KeyA', 'KeyD', 'Space', 'KeyS'];
      for (const def of LEVELS) {
        const r = { id: def.id, err: null, kills: 0, total: 0 };
        try {
          Game.startFromSelect(def.id, 2);
          Game.god = true;
          const p = Game.player;
          for (const k of [3, 4, 5, 6, 7, 8, 9]) p.weapons[k] = true;
          Object.assign(p.ammo, { shells: 100, nails: 200, rockets: 100, cells: 100 });
          const spots = Game.level.spawns.filter((s) => MONSTER_CHARS[s.ch]);
          for (let i = 0; i < frames; i++) {
            if (i % 180 === 0 && spots.length) {
              const s = spots[Math.floor(Math.random() * spots.length)];
              p.x = s.tx * 16 - 40 + Math.random() * 80; p.y = s.ty * 16 - 30;
              if (!Game.level.boxFree(p.x, p.y, p.w, p.h)) { p.x = s.tx * 16 + 3; p.y = (s.ty + 1) * 16 - p.h; }
              p.vx = p.vy = 0;
            }
            if (i % 20 === 0) {
              Input.down.clear();
              for (const k of keys) if (Math.random() < 0.3) Input.down.add(k);
              Input.mouseDown = Math.random() < 0.7;
              Input.mouseX = (Game.offX + (p.cx - Game.cam.x + (Math.random() - 0.5) * 300) * Game.scale) / Game.dpr;
              Input.mouseY = (Game.offY + (p.cy - Game.cam.y + (Math.random() - 0.5) * 200) * Game.scale) / Game.dpr;
              if (Math.random() < 0.2) Input.pressed.add('Digit' + (1 + Math.floor(Math.random() * 9)));
            }
            if (Game.state !== 'playing') Game.state = 'playing';
            Game.update(1 / 60);
            if (i % 6 === 0) Game.render();
            for (const m of Game.monsters) if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) throw new Error('NaN у монстра ' + m.type);
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('NaN у героя');
          }
          r.kills = Game.kills; r.total = Game.totalKills;
        } catch (e) { r.err = e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' / '); }
        out.push(r);
      }
      Input.down.clear(); Input.mouseDown = false;
      return out;
    }, frames);
    const bad = res.filter((r) => r.err);
    check(res.length === 29, 'ожидалось 29 уровней, прогнано ' + res.length);
    check(!bad.length, bad.map((r) => r.id + ': ' + r.err).join('\n'));
    noPageErrors(page);
    await page.close();
    return res.length + ' уровней, убито ' + res.reduce((s, r) => s + r.kills, 0) + ' из ' + res.reduce((s, r) => s + r.total, 0);
  },
};
