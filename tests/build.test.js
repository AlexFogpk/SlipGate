'use strict';
// Однофайловая сборка: собирается, содержит все уровни и играется без внешних файлов.
const os = require('os');
const { execFileSync } = require('child_process');
const { ROOT, check, fs, path } = require('./lib');

module.exports = {
  name: 'однофайловая сборка',
  async run(browser) {
    const out = path.join(os.tmpdir(), 'slipgate-test-' + process.pid + '.html');
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--fragment', out], { stdio: 'pipe' });
    const frag = fs.readFileSync(out, 'utf8');
    fs.unlinkSync(out);
    check(!/<script[^>]+src=/.test(frag), 'во фрагменте остались внешние скрипты');
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body>' + frag + '</body></html>');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
    const r = await page.evaluate(() => {
      for (const id of ['e1m1', 'e2m1', 'e3m1', 'e4m1']) {
        Game.startFromSelect(id, 1);
        for (let i = 0; i < 30; i++) { Game.update(1 / 60); Game.render(); }
      }
      return { levels: LEVELS.length, episodes: EPISODES.length };
    });
    check(r.levels === 25 && r.episodes === 4, `во фрагменте ${r.levels} уровней и ${r.episodes} эпизодов`);
    check(!errors.length, 'ошибки во фрагменте:\n' + errors.join('\n'));
    await page.close();
    return Math.round(frag.length / 1024) + ' КБ';
  },
};
