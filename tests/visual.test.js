'use strict';
// Строка состояния во всех состояниях героя, картинки предметов и настройка яркости.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'интерфейс, предметы и яркость',
  async run(browser) {
    const page = await openGame(browser, { query: '?map=e1m3' });
    const res = await page.evaluate(() => {
      const out = {};
      // картинки предметов не пустые
      out.empty = [];
      for (const k of ['+', 'H', 'M', 'U', 'N', 'K', 'C', 'A', 'Y', 'R', 'backpack']) {
        const img = itemImg(k);
        const d = img ? img.getContext('2d').getImageData(0, 0, img.width, img.height).data : [];
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        if (n < 30) out.empty.push(k);
      }
      for (const k of ['shells', 'nails', 'rockets', 'cells']) if (!ammoIcon(k)) out.empty.push('icon:' + k);
      // строка состояния в разных состояниях героя
      const p = Game.player;
      Game.god = true;
      for (const m of Game.monsters) m.update = function () {};
      const frame = () => { Game.update(1 / 60); Game.render(); };
      const states = [
        () => { p.weapons = { 1: true }; p.weapon = 1; p.armor = 0; p.health = 100; },
        () => { for (let n = 1; n <= 9; n++) p.weapons[n] = true; p.ammo = { shells: 100, nails: 200, rockets: 0, cells: 50 }; p.weapon = 9; p.armor = 200; p.armorType = 0.8; },
        () => { p.keys.silver = true; p.keys.gold = true; p.quad = 20; p.pent = 2; p.ring = 10; p.suit = 25; p.health = 15; },
        () => { p.health = 180; p.weapon = 4; p.waterLevel = 3; p.suit = 0; p.air = 2; },
      ];
      out.flash = false;
      for (const st of states) { st(); for (let i = 0; i < 3; i++) frame(); }
      p.health = 60; frame();
      out.flash = !!(HUD.flash.health && HUD.flash.health.t > 0 && !HUD.flash.health.up);
      p.weapon = 2; frame();
      out.weaponName = HUD.weaponT > 0;
      // яркость: средняя светлота кадра мира
      const mean = () => {
        Game.render();
        const d = Game.wctx.getImageData(0, 0, Game.world.width, Game.world.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 16) s += d[i] + d[i + 1] + d[i + 2];
        return s / (d.length / 16) / 3;
      };
      Game.setBrightness(0.5); out.dark = mean();
      Game.setBrightness(1.6); out.bright = mean();
      out.stored = Store.get('brightness');
      Menu.reset('main'); Menu.open('options');
      const it = Menu.items().find((x) => x.label.startsWith('Яркость'));
      out.menu = it ? it.label : null;
      if (it) it.adj(-1);
      out.afterAdj = Game.brightness;
      return out;
    });
    check(!res.empty.length, 'пустые картинки предметов: ' + res.empty.join(', '));
    check(res.flash, 'число здоровья не вспыхнуло при потере');
    check(res.weaponName, 'при смене оружия нет его названия');
    check(res.bright > res.dark * 1.4, `яркость почти не меняет картинку: ${res.dark.toFixed(1)} → ${res.bright.toFixed(1)}`);
    check(res.stored === 1.6, 'яркость не сохранилась');
    check(res.menu === 'Яркость: 160%' && Math.abs(res.afterAdj - 1.5) < 1e-9, 'пункт «Яркость» в настройках работает неверно: ' + res.menu + ' → ' + res.afterAdj);
    noPageErrors(page);
    return `яркость 50% → 160%: ${res.dark.toFixed(0)} → ${res.bright.toFixed(0)}`;
  },
};
