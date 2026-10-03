'use strict';
// Секретные уровни: в каждом эпизоде за тайной стеной обычного уровня спрятан красный
// слипгейт; он ведёт на секретный уровень, а оттуда — обратно в эпизод, на уровень после
// того, где нашли тайник. Секретный уровень появляется в меню, только когда его нашли.
// Особенности: E1M7 — половинная тяжесть, E2M7 — только топор (оружие возвращается),
// E3M7 — пять волн и выход после последней, E4M7 — тьма и фонарь у героя.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'секретные уровни',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      const goTo = (e) => { const p = Game.player; p.x = e.cx - p.w / 2; p.y = e.bottom - p.h; p.vx = p.vy = 0; Game.hitstop = 0; step(3); };
      const menuIds = (ep) => { Menu.screen = 'levels'; Menu.pendingEpisode = ep; return LEVELS.filter((l) => l.episode === ep && Menu.items().some((it) => it.label.startsWith(l.name + ' '))).map((l) => l.id); };
      Store.set('found', {}); Store.set('done', {});
      const out = [];
      for (const [src, sec, back, ep] of [['e1m2', 'e1m7', 'e1m3', 1], ['e2m3', 'e2m7', 'e2m4', 2], ['e3m3', 'e3m7', 'e3m4', 3], ['e4m3', 'e4m7', 'e4m4', 4]]) {
        const o = { src, sec, back };
        o.hiddenInMenu = !menuIds(ep).includes(sec);
        Game.startFromSelect(src, 1); Game.god = true;
        const lv = Game.level;
        const z = lv.exits.find((e) => e.secret);
        o.hasZ = !!z;
        // слипгейт спрятан: рядом тайная стена
        o.behindSecret = !!z && lv.movers.some((m) => m.kind === 'secret' && Math.abs(m.x + m.w / 2 - z.cx) < 8 * TILE && Math.abs(m.y + m.h - z.bottom) < 2 * TILE);
        const weaponsBefore = Object.keys(Game.player.weapons).filter((n) => Game.player.weapons[n]).length;
        goTo(z);
        o.inter = Game.state === 'intermission' && Game.secretExit;
        o.saved = (Game.savedGame() || {}).id;
        Game.nextLevel();
        o.loaded = Game.levelDef.id;
        o.banner = /Секретный уровень/.test(HUD.centerText);
        o.inMenu = menuIds(ep).includes(sec);
        const p = Game.player;
        if (sec === 'e1m7') { o.gravity = GRAVITY / BASE_GRAVITY; }
        if (sec === 'e2m7') {
          o.axeWeapons = Object.keys(p.weapons).filter((n) => p.weapons[n]).join();
          o.stashSaved = !!(Game.savedGame() || {}).inv && !!Game.savedGame().inv.stash;
          o.weaponsBefore = weaponsBefore;
        }
        if (sec === 'e3m7') {
          const W = Game.waves;
          o.exitHiddenBefore = Game.level.exits.every((e) => e.hidden);
          const [x0, y0, x1, y1] = Game.levelDef.waves.at;
          p.x = (x0 + 1) * TILE; p.y = (y1 + 1) * TILE - p.h; p.vx = p.vy = 0;
          step(5);
          o.started = W.started;
          let waves = 0;
          const items0 = Game.items.length;
          for (let i = 0; i < 60 * 120 && !W.done; i++) {
            Game.update(1 / 60);
            if (W.i + 1 > waves) waves = W.i + 1;
            for (const m of Game.monsters) if (m.wave !== undefined && m.alive && i % 20 === 0) applyDamage(m, 9999, p, 'rocket');
          }
          o.waves = waves; o.done = W.done;
          o.drops = Game.items.length - items0;
          o.exitShown = Game.level.exits.some((e) => !e.hidden);
          o.kills = Game.kills + '/' + Game.totalKills;
        }
        if (sec === 'e4m7') {
          const lights = []; p.lights(lights);
          o.lantern = lights.some((l) => l.r >= 140);
          o.ambient = Game.levelDef.ambient;
        }
        Game.render();
        // выход секретного уровня возвращает в эпизод
        const e = Game.level.exits.find((x) => !x.secret && !x.hidden);
        goTo(e);
        o.inter2 = Game.state === 'intermission' && !Game.secretExit;
        Game.nextLevel();
        o.returned = Game.levelDef.id;
        if (sec === 'e1m7') o.gravityBack = GRAVITY / BASE_GRAVITY;
        if (sec === 'e2m7') o.weaponsBack = Object.keys(Game.player.weapons).filter((n) => Game.player.weapons[n]).length;
        out.push(o);
      }
      return out;
    });
    for (const o of r) {
      const tag = `${o.src} → ${o.sec} → ${o.back}`;
      check(o.hiddenInMenu, `${tag}: секретный уровень виден в меню до того, как его нашли`);
      check(o.hasZ && o.behindSecret, `${tag}: нет секретного слипгейта за тайной стеной`);
      check(o.inter && o.saved === o.sec, `${tag}: секретный выход не ведёт к итогам или «Продолжить» не на секретный уровень (${o.saved})`);
      check(o.loaded === o.sec && o.banner, `${tag}: загрузился ${o.loaded}, табличка ${o.banner}`);
      check(o.inMenu, `${tag}: найденный секретный уровень не появился в меню`);
      check(o.inter2 && o.returned === o.back, `${tag}: выход вернул на ${o.returned}`);
    }
    const [e1, e2, e3, e4] = r;
    check(e1.gravity === 0.5 && e1.gravityBack === 1, `E1M7: тяжесть ${e1.gravity}, после выхода ${e1.gravityBack}`);
    check(e2.axeWeapons === '1' && e2.stashSaved, `E2M7: оружие ${e2.axeWeapons}, отнятое сохранено ${e2.stashSaved}`);
    check(e2.weaponsBack >= e2.weaponsBefore, `E2M7: оружие не вернулось (${e2.weaponsBack} из ${e2.weaponsBefore})`);
    check(e3.exitHiddenBefore && e3.started && e3.waves === 5 && e3.done && e3.exitShown, 'E3M7: волны или выход работают неверно: ' + JSON.stringify(e3));
    check(e3.drops >= 10, 'E3M7: после волн мало припасов: ' + e3.drops);
    check(e4.lantern && e4.ambient < 0.5, 'E4M7: нет фонаря или уровень не тёмный');
    noPageErrors(page);
    await page.close();
    return `4 тайных уровня, волн ${e3.waves}, убито на арене ${e3.kills}`;
  },
};
