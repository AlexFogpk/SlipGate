'use strict';
// E3M2: затопленную выработку с угрями можно проплыть «по-человечески» — с ключом и живым.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'заплыв через выработку E3M2',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      Game.startFromSelect('e3m2', 1);
      const p = Game.player;
      p.health = 999;
      Game.monsters = Game.monsters.filter((m) => m.type === 'eel');
      p.x = 178 * 16; p.y = 61 * 16 - p.h; p.vx = p.vy = 0;
      let minAir = 99, t = 0, eels = 0, key = false;
      for (let i = 0; i < 60 * 40; i++) {
        Input.down.clear();
        Input.down.add('KeyD');
        const tx = p.cx / 16;
        const open = tx < 195 || (tx > 215 && tx < 223) || tx > 245;
        if (tx > 246) Input.down.add('Space');
        else if (open && (p.air < 11.5 || tx < 195) && !(tx > 230 && tx < 236)) Input.down.add('Space');
        else if (tx > 228 && tx < 236) Input.down.add('KeyS');
        else if (p.waterLevel >= 2 && Math.abs(p.vx) < 20 && i % 30 < 15) Input.down.add('Space');
        if (open && tx > 216 && tx < 222 && p.air < 11.5) Input.down.delete('KeyD');
        Game.update(1 / 60);
        minAir = Math.min(minAir, p.air);
        eels = Math.max(eels, Game.monsters.filter((m) => m.type === 'eel' && m.alive && m.state !== 'idle').length);
        key = key || p.keys.gold;
        if (tx > 266 && p.onGround) { t = i / 60; break; }
      }
      Input.down.clear();
      return { reached: t > 0, seconds: t, minAir, key, eels, alive: p.alive };
    });
    check(r.reached, 'не удалось доплыть до дальнего берега');
    check(r.alive && r.minAir > 0, 'герой захлебнулся');
    check(r.key, 'золотой ключ по пути не подобран');
    check(r.eels > 0, 'угри не заметили пловца');
    noPageErrors(page);
    await page.close();
    return `${r.seconds.toFixed(1)} с, запас воздуха ${r.minAir.toFixed(1)}`;
  },
};
