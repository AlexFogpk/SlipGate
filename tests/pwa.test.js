'use strict';
// Игра как приложение (сборка node tools/build.js --app) на локальном сервере:
// • Chrome считает её устанавливаемой: манифест без ошибок, значки нужных размеров;
// • сервис-воркер кэширует игру — после первого запуска она открывается и играется без сети;
// • пункт «Установить на телефон» появляется, когда браузер предлагает установку, и вызывает её;
// • вышла новая версия — в меню появляется «Обновить игру».
const os = require('os');
const { execFileSync } = require('child_process');
const { ROOT, check, fs, path } = require('./lib');
const { serve } = require('../tools/serve');

// ширина и высота PNG из заголовка IHDR
const pngSize = (file) => { const b = fs.readFileSync(file); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };

module.exports = {
  name: 'установка на телефон',
  async run(browser) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slipgate-app-'));
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--app', dir]);
    const server = await serve(dir);
    const url = `http://localhost:${server.address().port}/`;
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const errors = [];
    try {
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
      // воркер установлен и управляет страницей
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });

      // манифест и устанавливаемость глазами Chrome
      const cdp = await ctx.newCDPSession(page);
      const man = await cdp.send('Page.getAppManifest');
      check(man.errors.length === 0, 'ошибки манифеста: ' + JSON.stringify(man.errors));
      const m = JSON.parse(man.data);
      check(m.display === 'fullscreen' && m.orientation === 'landscape' && m.start_url === './', 'манифест: не полноэкранный, не горизонтальный или не тот адрес старта');
      for (const ic of m.icons) check(pngSize(path.join(dir, ic.src)) === ic.sizes, `значок ${ic.src}: ${pngSize(path.join(dir, ic.src))} вместо ${ic.sizes}`);
      check(m.icons.some((ic) => ic.purpose === 'maskable'), 'нет значка для круглой маски Android');
      // окно Playwright — как инкогнито: эту причину Chrome называет всегда, остальных быть не должно
      const inst = await cdp.send('Page.getInstallabilityErrors');
      const why = inst.installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito');
      check(!why.length, 'Chrome не даёт установить: ' + why.join(', '));

      // пункт «Установить на телефон» — только когда браузер предлагает установку
      const labels = () => page.evaluate(() => Menu.items().map((it) => it.label));
      check(!(await labels()).includes('Установить на телефон'), 'пункт установки есть без предложения браузера');
      await page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => { window.__prompted = true; return Promise.resolve(); };
        window.dispatchEvent(e);
      });
      check((await labels()).includes('Установить на телефон'), 'нет пункта «Установить на телефон»');
      await page.evaluate(() => Menu.activate(Menu.items().find((it) => it.label === 'Установить на телефон')));
      check(await page.evaluate(() => window.__prompted === true), 'пункт меню не вызывает установку');
      // запуск с главного экрана: игра и так во весь экран — ни кнопки ⛶, ни пункта установки
      const home = await page.evaluate(() => {
        const mm = window.matchMedia;
        window.matchMedia = (q) => ({ matches: /display-mode: (fullscreen|standalone)/.test(q) });
        App.offer = { prompt() {} };
        Game.resize();
        const r = { installed: App.installed, full: Input.touchButtons.some((b) => b.name === 'full'), item: Menu.items().some((it) => it.label === 'Установить на телефон') };
        window.matchMedia = mm; App.offer = null; Game.resize();
        return r;
      });
      check(home.installed && !home.full && !home.item, 'запуск с главного экрана: ' + JSON.stringify(home));

      // без сети: игра открывается из кэша и играется
      await ctx.setOffline(true);
      await page.reload();
      await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas, null, { timeout: 15000 });
      const off = await page.evaluate(() => {
        Game.startFromSelect('e1m1', 1);
        for (let i = 0; i < 120; i++) Game.update(1 / 60);
        Game.render();
        return { state: Game.state, level: Game.levelDef.id, alive: Game.player.alive };
      });
      check(off.state === 'playing' && off.level === 'e1m1' && off.alive, 'без сети игра не запустилась: ' + JSON.stringify(off));
      await ctx.setOffline(false);

      // новая версия на сайте: воркер обновляется, в меню — «Обновить игру»
      await page.evaluate(() => Game.toMenu());
      const swFile = path.join(dir, 'sw.js');
      fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-new'"));
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
      await page.waitForFunction(() => App.updated, null, { timeout: 15000 });
      check((await labels()).includes('Обновить игру'), 'нет пункта «Обновить игру»');
      // старую версию воркер стирает сам, чуть позже переключения страницы
      const one = () => caches.keys().then((ks) => ks.filter((k) => k.startsWith('slipgate-') && k !== 'slipgate-fonts').length === 1);
      const cleaned = await page.waitForFunction(one, null, { timeout: 10000, polling: 100 }).then(() => true, () => false);
      check(cleaned, 'старый кэш не удалён: ' + (await page.evaluate(() => caches.keys())).join(', '));
      check(!errors.length, 'ошибки на странице:\n' + errors.join('\n'));
      return `устанавливается, ${m.icons.length} значка, без сети запускается, обновление приходит`;
    } finally {
      await ctx.close();
      server.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};
