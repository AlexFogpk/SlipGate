'use strict';
// Запуск браузерных тестов игры: node tests/run.js [часть имени файла ...]
// Пример: node tests/run.js soak traps
const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./lib');

(async () => {
  const filter = process.argv.slice(2);
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js'))
    .filter((f) => !filter.length || filter.some((s) => f.includes(s)));
  if (!files.length) { console.error('Нет тестов по фильтру: ' + filter.join(' ')); process.exit(1); }
  const browser = await launchBrowser();
  let failed = 0;
  for (const f of files) {
    const t = require(path.join(__dirname, f));
    const t0 = Date.now();
    try {
      const info = await t.run(browser);
      console.log(`✓ ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} с)${info ? ' — ' + info : ''}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${t.name} (${f})\n  ${String(e.message).split('\n').join('\n  ')}`);
    }
  }
  await browser.close();
  console.log(failed ? `\nПровалено: ${failed} из ${files.length}` : `\nВсе тесты пройдены: ${files.length}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
