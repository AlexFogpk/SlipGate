'use strict';
// iPhone с вырезом (как 17 Pro Max: 956×440 в горизонтали, плотность 3):
// • поворот: iPhone шлёт resize раньше, чем пересчитает раскладку, — игра сама сверяет размер
//   холста каждый кадр, картинка не остаётся сжатой, и касания попадают в меню и в кнопки;
// • вырезы экрана (Dynamic Island, полоска «Домой»): картинка на весь экран, а кнопки, стики
//   и строка состояния — внутри безопасной зоны;
// • жесты браузера на холсте (прокрутка, масштаб) запрещены — они отменяли касания.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'iPhone: поворот и вырезы экрана',
  async run(browser) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await openGame(browser, { context: ctx });
    const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const sync = () => page.evaluate(() => {
      const c = Game.canvas;
      return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, ok: c.width === Math.round(c.clientWidth * Game.dpr) && c.height === Math.round(c.clientHeight * Game.dpr) };
    });
    // в книжной ориентации — касание включает сенсорный режим
    await page.touchscreen.tap(200, 400);
    await frames(3);

    // 1. поворот без своевременного resize, как на iPhone: размер холста устаревает
    await page.evaluate(() => { window.__resize = Game.resize; Game.resize = function () {}; });
    await page.setViewportSize({ width: 956, height: 440 });
    await frames(3);
    const stale = await sync();
    await page.evaluate(() => { Game.resize = window.__resize; });
    await frames(3);
    const fixed = await sync();
    check(!stale.ok, 'имитация не удалась: холст не устарел после поворота');
    check(fixed.ok && fixed.cw === 956 && fixed.ch === 440, 'после поворота холст не подстроился: ' + JSON.stringify(fixed));

    // касание по пункту меню после поворота
    await page.evaluate(() => { Game.toMenu(); Game.render(); });
    await frames(2);
    const item = await page.evaluate(() => {
      const i = Menu.items().findIndex((it) => it.label === 'Настройки');
      const h = Menu.hitboxes.find((b) => b.i === i);
      const k = Game.canvas.width / Game.canvas.clientWidth;
      return { x: (h.x + h.w / 2) / k, y: (h.y + h.h / 2) / k };
    });
    await page.touchscreen.tap(item.x, item.y);
    await frames(3);
    check(await page.evaluate(() => Menu.screen) === 'options', 'касание по «Настройки» не открыло настройки');

    // 2. вырезы: безопасная зона как у iPhone в горизонтали (по 62 pt по бокам, 21 pt снизу)
    const r = await page.evaluate(() => {
      const k = Game.canvas.width / Game.canvas.clientWidth;
      Game.safeInsets = () => ({ t: 0, r: Math.round(62 * k), b: Math.round(21 * k), l: Math.round(62 * k) });
      Game.resize();
      Game.startFromSelect('e1m1', 1); Game.god = true; Input.touchMode = true;
      for (let i = 0; i < 10; i++) Game.update(1 / 60);
      Game.render();
      const W = Game.canvas.width, H = Game.canvas.height, s = Game.safe, u = Game.u;
      const rect = Game.canvas.getBoundingClientRect();
      const outside = Input.touchButtons.filter((b) => b.x + b.r > W - s.r || b.x - b.r < s.l || b.y - b.r < s.t || b.y + b.r > H - s.b).map((b) => b.name);
      return { full: rect.left === 0 && rect.top === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight, outside, bar: HUD.barTop(H, u), barWant: H - HUD_BAR * u - s.b };
    });
    check(r.full, 'картинка не на весь экран');
    check(!r.outside.length, 'кнопки под вырезом: ' + r.outside.join(', '));
    check(r.bar === r.barWant, 'строка состояния не над полоской «Домой»');

    // кнопка прыжка настоящим касанием — с вырезами и после поворота
    const jb = await page.evaluate(() => {
      const b = Input.touchButtons.find((q) => q.name === 'jump'), k = Game.canvas.width / Game.canvas.clientWidth;
      return { x: b.x / k, y: b.y / k };
    });
    await page.evaluate(async () => {
      for (let i = 0; i < 300 && !Game.player.onGround; i++) await new Promise((res) => requestAnimationFrame(res));
      window.__y0 = Game.player.y; window.__minY = Game.player.y;
      const update = Game.update;
      Game.update = function (dt) { update.call(this, dt); window.__minY = Math.min(window.__minY, Game.player.y); };
    });
    await page.touchscreen.tap(jb.x, jb.y);
    let rise = 0;
    for (let i = 0; i < 50 && rise <= 40; i++) { await page.waitForTimeout(100); rise = await page.evaluate(() => window.__y0 - window.__minY); }
    check(rise > 40, `тап по кнопке прыжка с вырезами: подъём ${Math.round(rise)} px`);

    // 3. жесты браузера на холсте запрещены
    const blocked = await page.evaluate(() => {
      const t = new Event('touchmove', { cancelable: true });
      Game.canvas.dispatchEvent(t);
      return t.defaultPrevented;
    });
    check(blocked, 'прокрутка касанием на холсте не запрещена');
    noPageErrors(page);
    await ctx.close();
    return `холст подстроился после поворота (${fixed.w}×${fixed.h}), касания в меню и кнопку прыжка, кнопки вне вырезов`;
  },
};
