'use strict';
// Нормы баланса обычных уровней (нормальная сложность):
//   урон всех патронов уровня (с выпадающими из монстров) не меньше 1,3 здоровья монстров вместе с засадами;
//   лечения не меньше 4,4 единицы на 100 единиц здоровья монстров; хотя бы два тайника;
//   ни один монстр не появляется внутри стены.
// Подробный отчёт: node tools/dev/balance.js
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'баланс уровней',
  async run(browser) {
    const page = await openGame(browser);
    const rows = await page.evaluate(() => {
      const DPA = { shells: 24, nails: 9, rockets: 120, cells: 30 };
      const out = [];
      for (const def of LEVELS) {
        if (def.id === 'start') continue;
        Game.startFromSelect(def.id, 1);
        const lv = Game.level;
        let hp = 0, ammo = 0, heal = 0;
        const stuck = [];
        for (const m of Game.monsters) {
          if (m.state !== 'dormant' && !lv.boxFree(m.x, m.y, m.w, m.h)) stuck.push(m.type + '@' + Math.floor(m.cx / 16) + ',' + Math.floor((m.y + m.h - 1) / 16));
          if (m.def.boss || m.def.static) continue;
          hp += m.def.hp;
          for (const k in (m.def.drop || {})) ammo += m.def.drop[k] * DPA[k];
        }
        for (const tr of (def.traps || [])) for (const sp of tr.spawn) { const t = MONSTER_CHARS[sp[2]]; if (t) hp += MONSTER_DEFS[t].hp; }
        for (const it of Game.items) {
          const c = it.ch;
          if (c === '+') heal += 15; else if (c === 'H') heal += 25; else if (c === 'M') heal += 100;
          else if (AMMO_PICKUP[c]) ammo += AMMO_PICKUP[c][1] * DPA[AMMO_PICKUP[c][0]];
          else if (WEAPON_PICKUP[c]) ammo += WEAPON_PICKUP[c].amount * DPA[WEAPON_PICKUP[c].ammo];
        }
        const boss = Game.monsters.some((m) => m.def.boss);
        out.push({ id: def.id, boss, ammo: ammo / Math.max(1, hp), heal: heal / Math.max(1, hp) * 100, secrets: Game.totalSecrets, stuck });
      }
      return out;
    });
    const bad = [];
    for (const r of rows) {
      if (r.stuck.length) bad.push(`${r.id}: монстры в стене ${r.stuck.join(' ')}`);
      if (r.boss) continue;
      if (r.ammo < 1.3) bad.push(`${r.id}: патронов ${r.ammo.toFixed(2)} от здоровья монстров (нужно ≥ 1,3)`);
      if (r.heal < 4.4) bad.push(`${r.id}: лечения ${r.heal.toFixed(1)} на 100 (нужно ≥ 4,4)`);
      if (r.secrets < 2) bad.push(`${r.id}: тайников ${r.secrets} (нужно ≥ 2)`);
    }
    check(!bad.length, bad.join('\n'));
    noPageErrors(page);
    await page.close();
    const reg = rows.filter((r) => !r.boss);
    const min = (k) => Math.min(...reg.map((r) => r[k]));
    return `минимум по обычным уровням: патроны ${min('ammo').toFixed(2)}, лечение ${min('heal').toFixed(1)}, тайников ${min('secrets')}`;
  },
};
