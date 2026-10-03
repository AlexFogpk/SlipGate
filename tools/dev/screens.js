'use strict';
// Скриншоты уровней в реальном масштабе (монстры замирают).
// node tools/dev/screens.js папка e1m1 e2m1@300,0 e1m3@exit ...
//   @dx,dy — сдвиг героя от старта в пикселях, @exit — встать у первого выхода
const { launchBrowser, GAME_URL } = require('../../tests/lib');
(async () => {
  const [dir, ...ids] = process.argv.slice(2);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(GAME_URL);
  await page.waitForTimeout(500);
  for (const spec of ids) {
    const [id, off] = spec.split('@');
    const [dx, dy] = off === 'exit' ? [9999, 0] : (off || '0,0').split(',').map(Number);
    await page.evaluate(({ id, dx, dy }) => {
      Game.startFromSelect(id, 1); Game.god = true;
      const p = Game.player;
      if (dx === 9999) { const e = Game.level.exits[0] || Game.level.teleports[0]; p.x = e.cx - 60; p.y = e.bottom - p.h; }
      else { p.x += dx; p.y += dy; }
      for (const m of Game.monsters) m.update = function () { this.anim += 1 / 60; };
      for (let i = 0; i < 90; i++) Game.update(1 / 60);
      HUD.msgs && (HUD.msgs.length = 0);
    }, { id, dx, dy });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${dir}/${id}${off ? '_' + off.replace(',', '_') : ''}.png`, clip: { x: 0, y: 0, width: 1280, height: 640 } });
  }
  console.log(errors.length ? errors.join('\n') : 'ok');
  await browser.close();
})();
