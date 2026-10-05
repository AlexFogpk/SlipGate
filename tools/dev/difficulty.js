'use strict';
// Отчёт по сложности: урон в секунду, который получает бот в дуэли с каждым монстром,
// на четырёх сложностях — вдали (110–230 px) и вплотную (30–80 px), и отношение к «Нормальному».
//   node tools/dev/difficulty.js            — нынешние множители
//   node tools/dev/difficulty.js --old      — множители до выравнивания (для сравнения)
//   N=12 DUR=20 node tools/dev/difficulty.js — больше дуэлей, меньше шума
// Каждая сложность считается в своём процессе.
const { fork } = require('child_process');
const { launchBrowser, openGame } = require('../../tests/lib');
const { duels, OLD_SCALES } = require('../../tests/duel');

const FAR = ['grunt', 'dog', 'enforcer', 'ogre', 'fiend', 'scrag', 'hknight', 'vore', 'shambler', 'gargoyle', 'scorpion', 'phantom', 'guardian'];
const NEAR = ['dog', 'knight', 'fiend', 'hknight', 'shambler', 'ogre', 'scorpion', 'guardian', 'spawn'];
const SKILLS = ['Лёгкий', 'Нормальный', 'Сложный', 'Кошмар'];

async function worker(skill, old) {
  const browser = await launchBrowser();
  const page = await openGame(browser);
  const common = { skills: [skill], n: +(process.env.N || 8), dur: +(process.env.DUR || 15), seed: +(process.env.SEED || 1), scales: old ? OLD_SCALES : null };
  const far = await page.evaluate(duels, Object.assign({ types: FAR }, common));
  const near = await page.evaluate(duels, Object.assign({ types: NEAR, keep: [30, 80] }, common));
  await browser.close();
  process.send({ skill, far, near });
}

function table(title, types, res) {
  console.log(`\n${title}: урон в секунду   ${SKILLS.map((s) => s.slice(0, 5).padStart(6)).join('')}  | к «Нормальному»`);
  const tot = [0, 0, 0, 0];
  for (const t of types) {
    const v = [0, 1, 2, 3].map((s) => res[s][t][s]);
    v.forEach((x, i) => { tot[i] += x; });
    console.log(`  ${t.padEnd(30)}${v.map((x) => x.toFixed(1).padStart(6)).join('')}  |${v.map((x) => (x / Math.max(0.1, v[1])).toFixed(2).padStart(6)).join('')}`);
  }
  console.log(`  ${'всего'.padEnd(30)}${tot.map((x) => x.toFixed(1).padStart(6)).join('')}  |${tot.map((x) => (x / tot[1]).toFixed(2).padStart(6)).join('')}`);
}

if (process.argv[2] === '--worker') {
  worker(+process.argv[3], process.argv[4] === 'old').catch((e) => { console.error(e); process.exit(1); });
} else {
  const old = process.argv.includes('--old');
  const far = [], near = [];
  let left = 4;
  for (let s = 0; s < 4; s++) {
    const w = fork(__filename, ['--worker', String(s), old ? 'old' : 'new']);
    w.on('message', (m) => { far[m.skill] = m.far; near[m.skill] = m.near; });
    w.on('exit', (code) => {
      if (code) { console.error('сложность ' + s + ': ошибка'); process.exit(1); }
      if (--left) return;
      console.log(old ? 'Множители до выравнивания' : 'Нынешние множители');
      table('Вдали, 110–230 px', FAR, far);
      table('Вплотную, 30–80 px', NEAR, near);
    });
  }
}
