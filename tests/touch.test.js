'use strict';
// Телефон: все уровни запекаются, касание включает сенсорное управление,
// портретная ориентация не ломает страницу.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'сенсорный экран',
  async run(browser) {
    const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await openGame(browser, { context: ctx, query: '?map=e1m2' });
    const worst = await page.evaluate(() => {
      let w = { id: '', ms: 0 };
      for (const d of LEVELS) {
        const t0 = performance.now();
        const lv = new Level(d); lv.bake();
        const ms = performance.now() - t0;
        if (ms > w.ms) w = { id: d.id, ms: Math.round(ms) };
      }
      return w;
    });
    await page.touchscreen.tap(700, 200);
    await page.waitForTimeout(300);
    check(await page.evaluate(() => Input.touchMode), 'касание не включило сенсорное управление');
    noPageErrors(page);
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p2 = await openGame(browser, { context: ctx2 });
    await p2.waitForTimeout(500);
    noPageErrors(p2);
    await ctx2.close();
    return `самое долгое запекание ${worst.ms} мс (${worst.id})`;
  },
};
