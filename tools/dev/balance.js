'use strict';
// Отчёт по балансу: node tools/dev/balance.js
// ammo× — урон всех патронов уровня (с выпадающими из монстров) к здоровью монстров вместе с засадами;
// hp/100 — лечение на 100 единиц здоровья монстров; arm — поглощение брони; pow — усиления; cp — контрольные точки.
const { launchBrowser, GAME_URL } = require('../../tests/lib');
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(GAME_URL);
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => {
    const DPA = { shells: 24, nails: 9, rockets: 120, cells: 30 };
    const out = [];
    for (const def of LEVELS) {
      if (def.id === 'start') continue;
      Game.startFromSelect(def.id, 1);
      const ms = Game.monsters.filter((m) => m.alive);
      let hp = 0, dropDmg = 0;
      const types = {};
      for (const m of ms) {
        if (m.def.boss || m.def.static) continue;
        hp += m.def.hp; types[m.type] = (types[m.type] || 0) + 1;
        for (const k in (m.def.drop || {})) dropDmg += m.def.drop[k] * DPA[k];
      }
      let trapN = 0, trapHp = 0;
      for (const tr of (def.traps || [])) for (const sp of tr.spawn) {
        const t = Object.keys(MONSTER_CHARS).includes(sp[2]) ? MONSTER_CHARS[sp[2]] : null;
        if (t && MONSTER_DEFS[t]) { trapN++; trapHp += MONSTER_DEFS[t].hp; }
      }
      let heal = 0, armor = 0, ammoDmg = 0, power = [];
      for (const it of Game.items) {
        const c = it.ch;
        if (c === '+') heal += 15; else if (c === 'H') heal += 25; else if (c === 'M') heal += 100;
        else if (ARMOR_PICKUP[c]) armor += ARMOR_PICKUP[c][1] * ARMOR_PICKUP[c][0];
        else if (AMMO_PICKUP[c]) ammoDmg += AMMO_PICKUP[c][1] * DPA[AMMO_PICKUP[c][0]];
        else if (WEAPON_PICKUP[c]) ammoDmg += WEAPON_PICKUP[c].amount * DPA[WEAPON_PICKUP[c].ammo];
        else if (POWERUPS[c]) power.push(c);
      }
      const lv = Game.level;
      const totalHp = hp + trapHp;
      out.push({
        id: def.id, size: lv.w + 'x' + lv.h, mon: ms.filter((m) => !m.def.boss && !m.def.static).length, trap: trapN,
        hp: totalHp, ammoX: +((ammoDmg + dropDmg) / Math.max(1, totalHp)).toFixed(2),
        heal, healPer100: +(heal / Math.max(1, totalHp) * 100).toFixed(1), armor: Math.round(armor), power: power.join(''),
        secrets: Game.totalSecrets, cps: lv.decor.filter((d) => d.kind === 'checkpoint').length,
        top: Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + v).join(' '),
      });
    }
    return out;
  });
  console.log('id    size     mon trap    hp  ammo× heal hp/100 arm  pow sec cp  top');
  for (const r of rows) console.log([r.id.padEnd(5), r.size.padEnd(8), String(r.mon).padStart(3), String(r.trap).padStart(4), String(r.hp).padStart(6), String(r.ammoX).padStart(5), String(r.heal).padStart(4), String(r.healPer100).padStart(6), String(r.armor).padStart(4), (r.power || '-').padStart(4), String(r.secrets).padStart(3), String(r.cps).padStart(2), ' ' + r.top].join(' '));
  await browser.close();
})();
