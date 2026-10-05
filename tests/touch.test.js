'use strict';
// Телефон: все уровни запекаются, касание включает сенсорное управление,
// портретная ориентация не ломает страницу.
// Управление на экране с плотностью 2 (как у большинства телефонов): настоящие касания
// попадают в кнопки прыжка и оружия; левый стик ведёт героя, вверх — прыжок, а наклон
// вбок не прыгает; правый стик целится и стреляет, палец не закрывает цель; автоприцел
// доворачивает на монстра у линии прицела.
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
    // --- управление ---
    await page.evaluate(() => { Game.startFromSelect('e1m1', 1); Game.god = true; Game.monsters = []; HUD.centerT = 0; Game.player.weapons[1] = true; Game.render(); });
    const css = (name) => page.evaluate((name) => {
      const k = Game.canvas.width / Game.canvas.getBoundingClientRect().width;
      const b = name[0] === 'w' ? Input.slotRects.find((r) => 'w' + r.n === name) : Input.touchButtons.find((q) => q.name === name);
      return b.w ? { x: (b.x + b.w / 2) / k, y: (b.y + b.h / 2) / k } : { x: b.x / k, y: b.y / k };
    }, name);
    // кнопка прыжка — настоящим касанием; высоту меряем на каждом шаге игры (на медленной
    // машине за кадр проходит несколько шагов), тап должен давать полный прыжок
    const jb = await css('jump');
    await page.evaluate(async () => {
      for (let i = 0; i < 300 && !Game.player.onGround; i++) await new Promise((r) => requestAnimationFrame(r));
      window.__y0 = Game.player.y; window.__minY = Game.player.y;
      const update = Game.update;
      Game.update = function (dt) { update.call(this, dt); window.__minY = Math.min(window.__minY, Game.player.y); };
    });
    await page.touchscreen.tap(jb.x, jb.y);
    let rise = 0;
    for (let i = 0; i < 50 && rise <= 40; i++) { await page.waitForTimeout(100); rise = await page.evaluate(() => window.__y0 - window.__minY); }
    check(rise > 40, `тап по кнопке прыжка на экране с плотностью 2: подъём ${Math.round(rise)} px`);
    // ячейка оружия — настоящим касанием
    const ws = await css('w1');
    await page.touchscreen.tap(ws.x, ws.y);
    await page.waitForTimeout(150);
    check(await page.evaluate(() => Game.player.weapon) === 1, 'касание ячейки оружия не выбрало оружие');
    // стики: синтетические касания в координатах страницы
    const r = await page.evaluate(() => {
      const out = {};
      const p = Game.player;
      const ev = (id, x, y) => ({ pointerType: 'touch', pointerId: id, clientX: x, clientY: y, preventDefault() {} });
      const step = (n) => { for (let i = 0; i < n; i++) Game.update(1 / 60); };
      const R = Input.stickR / (Game.canvas.width / Game.canvas.getBoundingClientRect().width);
      for (let i = 0; i < 60; i++) Game.update(1 / 60);
      // бег вправо
      Input.onPointerDown(ev(21, 120, 260)); Input.onPointerMove(ev(21, 120 + R, 260));
      const x0 = p.x; step(30); out.ran = p.x - x0;
      // наклон вбок с лёгким подъёмом — не прыжок
      Input.onPointerMove(ev(21, 120 + R * 0.9, 260 - R * 0.5)); out.diagJump = Input.jumpHeld();
      // строго вверх — прыжок
      Input.onPointerMove(ev(21, 120, 260 - R)); out.upJump = Input.jumpHeld();
      Input.onPointerUp(ev(21, 0, 0)); step(60);
      // правый стик: тянем вверх — целимся вверх и стреляем
      p.weapon = 2; p.ammo.shells = 50;
      const shells = p.ammo.shells;
      Input.onPointerDown(ev(22, 700, 260)); Input.onPointerMove(ev(22, 700, 260 - R));
      step(30);
      out.aimUp = p.aim; out.fired = shells - p.ammo.shells;
      Input.onPointerUp(ev(22, 0, 0)); step(10);
      // автоприцел: монстр чуть выше линии прицела вправо
      const g = new Monster('grunt', p.cx + 150, p.y + p.h - 18); g.state = 'idle';
      Game.monsters.push(g);
      Input.onPointerDown(ev(23, 700, 260)); Input.onPointerMove(ev(23, 700 + R, 260));
      step(2);
      const s = p.shoulder();
      out.autoErr = Math.abs(angleDiff(p.aim, Math.atan2(g.cy - s.y, g.cx - s.x)));
      out.target = Game.autoTarget === g;
      Input.onPointerUp(ev(23, 0, 0));
      Game.render();
      return out;
    });
    check(r.ran > 20, 'левый стик не ведёт героя: ' + r.ran);
    check(!r.diagJump && r.upJump, `прыжок со стика: вбок ${r.diagJump}, вверх ${r.upJump}`);
    check(r.aimUp < -1.2 && r.fired > 0, `правый стик: прицел ${r.aimUp.toFixed(2)}, выстрелов ${r.fired}`);
    check(r.target && r.autoErr < 0.02, `автоприцел не довёл на монстра: ошибка ${r.autoErr.toFixed(3)} рад`);
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
