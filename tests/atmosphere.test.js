'use strict';
// Атмосфера: силуэты на горизонте, столбы света, дымка, передний план и музыка эпизодов
// с боевым слоем, который вступает, когда рядом встревоженные монстры.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'силуэты на небе и музыка эпизодов',
  async run(browser) {
    const page = await openGame(browser, { query: '?map=e1m1' });
    const sky = await page.evaluate(() => {
      const out = {};
      for (const th of Object.keys(SKYLINE_THEMES)) {
        const sl = Skyline.get(th);
        out[th] = ['far', 'near'].map((k) => {
          const L = sl[k];
          const d = L.canvas.getContext('2d').getImageData(0, 0, L.w, L.h).data;
          let solid = 0, top = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i]) { solid++; if (i < L.w * 4 * 4) top++; }
          return { share: solid / (L.w * L.h), top, float: L.float };
        });
      }
      return out;
    });
    for (const [th, layers] of Object.entries(sky)) {
      for (const l of layers) {
        check(l.share > (l.float ? 0.02 : 0.04) && l.share < 0.85, `${th}: слой силуэтов пустой или сплошной (${(l.share * 100).toFixed(1)}%)`);
        check(l.top === 0, `${th}: силуэт упирается в верх слоя`);
      }
    }
    // на уровнях с небом горизонт внутри карты
    const hz = await page.evaluate(() => LEVELS.filter((d) => new Level(d).hasSky).map((d) => { const lv = new Level(d); return [d.id, lv.horizon, lv.h * TILE]; }));
    for (const [id, h, max] of hz) check(h > 0 && h <= max, `${id}: горизонт вне карты (${h})`);

    // живая атмосфера: столбы света, дымка над жидкостями, силуэты переднего плана
    const amb = await page.evaluate(() => {
      let shafts = 0, lavaFog = 0, fg = 0, drips = 0, levels = 0;
      for (const d of LEVELS) {
        const lv = new Level(d); lv.bake();
        shafts += lv.amb.shafts.length; fg += lv.amb.fg.length; drips += lv.amb.drips.length;
        lavaFog += lv.amb.fogs.filter((f) => f.kind === 'lava').length;
        levels++;
      }
      Game.startFromSelect('e3m3', 1);
      for (let i = 0; i < 30; i++) { Game.update(1 / 60); Game.render(); }
      return { shafts, lavaFog, fg, drips, levels };
    });
    check(amb.shafts > 10 && amb.lavaFog > 5 && amb.fg > 100 && amb.drips > 20, 'мало атмосферы: ' + JSON.stringify(amb));

    // музыка: стиль эпизода и боевой слой
    await page.mouse.click(480, 270);
    const music = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      Sound.init();
      const res = {};
      Game.startFromSelect('e3m2', 1); Game.god = true;
      await sleep(1600);
      res.style = Music.style;
      res.calm = Music.combatLevel;
      for (const m of Game.monsters) if (!m.def.static) { m.alert(Game.player); m.x = Game.player.x + 100; m.y = Game.player.y - 30; }
      await sleep(2500);
      res.fight = Music.combatLevel;
      Game.toMenu();
      await sleep(400);
      res.menuStyle = Music.style;
      res.menuIntensity = Music.intensity;
      return res;
    });
    check(music.style === 'e3', 'на E3 не та музыка: ' + music.style);
    check(music.calm < 0.2, 'боевой слой играет без боя: ' + music.calm.toFixed(2));
    check(music.fight > 0.5, 'боевой слой не вступил в бою: ' + music.fight.toFixed(2));
    check(music.menuStyle === 'menu' && music.menuIntensity === 0, 'в меню осталась боевая музыка');
    noPageErrors(page);
    return `столбов света ${amb.shafts}, силуэтов ${amb.fg}, ${Object.keys(sky).length} тем неба, ${hz.length} уровней с горизонтом, бой ${music.fight.toFixed(2)}`;
  },
};
