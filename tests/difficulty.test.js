'use strict';
// Кривая сложности ровная и без выбросов.
// • Дуэли (случайность с зерном — результат повторяется): урон, который бот получает за
//   секунду, растёт от «Лёгкого» к «Кошмару» ровными ступенями; солдат на «Кошмаре» не
//   опаснее «Нормального» вдвое (раньше — почти втрое: не вздрагивал и стрелял чаще).
// • Боль: доля атак, доведённых до конца, растёт со сложностью не больше чем в 1,2 раза
//   у любого монстра (раньше у солдата — в 3,4 раза).
// • Боссы: урон за весь бой (урон × частота × запас здоровья) на «Кошмаре» не больше 1,9
//   от «Нормального» (раньше — 2,8).
// Подробный отчёт по всем монстрам: node tools/dev/difficulty.js
const { openGame, check, noPageErrors } = require('./lib');
const { duels } = require('./duel');

module.exports = {
  name: 'кривая сложности',
  async run(browser) {
    const page = await openGame(browser);
    const types = ['grunt', 'fiend', 'ogre', 'enforcer', 'shambler', 'scorpion'];
    const d = await page.evaluate(duels, { types, skills: [0, 1, 2, 3], n: 10, dur: 15, seed: 1 });
    const t = await page.evaluate(() => {
      const at = (f, ...a) => [0, 1, 2, 3].map((s) => { Game.skill = s; return Game[f](...a); });
      const pain = {};
      for (const [k, def] of Object.entries(MONSTER_DEFS)) {
        if (!(def.pain > 0)) continue;
        const done = at('skillPainChance', def.pain).map((c) => 1 - c);
        pain[k] = done[3] / done[1];
      }
      const dmg = at('skillDamageScale'), cd = at('skillCdScale'), bcd = at('skillBossCd'), bhp = at('skillBossHp');
      const boss = [0, 1, 2, 3].map((s) => dmg[s] / bcd[s] * bhp[s]);
      Game.skill = 1;
      return { pain, dmg, cd, boss };
    });
    const tot = [0, 1, 2, 3].map((s) => types.reduce((q, k) => q + d[k][s], 0));
    const r = tot.map((x) => x / tot[1]);
    check(r[0] < 0.75 && r[0] > 0.35, `«Лёгкий»: ${r[0].toFixed(2)} от «Нормального» (нужно 0,35–0,75)`);
    check(r[2] > 1.05 && r[2] < 1.45, `«Сложный»: ${r[2].toFixed(2)} от «Нормального» (нужно 1,05–1,45)`);
    check(r[3] > r[2] + 0.08 && r[3] < 1.7, `«Кошмар»: ${r[3].toFixed(2)} от «Нормального» (нужно выше «Сложного» и меньше 1,7)`);
    const grunt = d.grunt[3] / d.grunt[1];
    check(grunt < 2.1, `солдат на «Кошмаре» опаснее в ${grunt.toFixed(2)} раза (нужно < 2,1)`);
    const painBad = Object.entries(t.pain).filter(([, v]) => v > 1.2 + 1e-9).map(([k, v]) => `${k} ×${v.toFixed(2)}`);
    check(!painBad.length, 'боль: атаки доходят до конца слишком часто: ' + painBad.join(', '));
    check(t.dmg.every((v, i) => !i || v > t.dmg[i - 1]) && t.cd.every((v, i) => !i || v < t.cd[i - 1]), 'множители урона и перезарядки не монотонны');
    const boss = t.boss.map((x) => x / t.boss[1]);
    check(boss[3] <= 1.9 && boss[2] < boss[3] && boss[0] < 0.6, `бой с боссом по сложностям: ${boss.map((x) => x.toFixed(2)).join(' / ')}`);
    noPageErrors(page);
    await page.close();
    return `урон по сложностям ${r.map((x) => x.toFixed(2)).join(' / ')}, солдат на «Кошмаре» ×${grunt.toFixed(2)}, бой с боссом ×${boss[3].toFixed(2)}`;
  },
};
