'use strict';
// Производительность: время загрузки (запекания) каждого уровня и среднее время кадра.
// node tools/dev/perf.js [id уровня ...]
const { launchBrowser, GAME_URL } = require('../../tests/lib');

(async () => {
  const only = process.argv.slice(2);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
  const rows = await page.evaluate((only) => {
    const out = [];
    for (const def of LEVELS) {
      if (only.length && !only.includes(def.id)) continue;
      const t0 = performance.now();
      Game.startFromSelect(def.id, 2);
      const load = performance.now() - t0;
      Game.god = true;
      for (let i = 0; i < 20; i++) { Game.update(1 / 60); Game.render(); }
      let tot = 0;
      for (let i = 0; i < 90; i++) {
        const a = performance.now();
        Game.update(1 / 60); Game.render();
        Game.ctx.getImageData(0, 0, 1, 1); // дождаться отрисовки
        tot += performance.now() - a;
      }
      out.push({ id: def.id, load: Math.round(load), frame: +(tot / 90).toFixed(2) });
    }
    return out;
  }, only);
  for (const r of rows) console.log(`${r.id.padEnd(6)} загрузка ${String(r.load).padStart(4)} мс   кадр ${r.frame.toFixed(2).padStart(5)} мс`);
  const worst = (k) => rows.reduce((a, b) => (b[k] > a[k] ? b : a));
  console.log(`\nхудшая загрузка ${worst('load').load} мс (${worst('load').id}), худший кадр ${worst('frame').frame} мс (${worst('frame').id})`);
  await browser.close();
})();
