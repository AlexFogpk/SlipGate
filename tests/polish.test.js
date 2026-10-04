'use strict';
// Правки после прохождения:
// • Тайник ничем себя не выдаёт: за каждой тайной стеной есть спрятанная комната; свет,
//   пламя факелов и слипгейт в ней не видны, пока стену не открыли, а после — свет зажигается.
// • Оружие на полу светится (свой свет и отсвет), из закрытого тайника — нет.
// • Копоть от ракет в одно место не копится в чёрный круг и со временем исчезает.
// • Значок супергвоздомёта в ячейке 5 неподвижен.
// • Факелы в начале E4M1, E4M2, E4M5 висят на колоннах; огонь без опоры — парящий.
// • Арена Вестника: трамплины к столбу выхода с обеих сторон, аптечки и тайник с мегааптечкой.
// • В тайниках есть лечение. Большие окна, вентиляторы и ниши расставлены по темам.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'правки после прохождения',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = { unhidden: [], noHealth: [], arch: {}, free: [] };
      // 1. тайники спрятаны и в каждом есть лечение (кроме комнаты со слипгейтом)
      for (const d of LEVELS) {
        const lv = new Level(d); lv.bake();
        lv.movers.forEach((m, i) => {
          if (m.kind !== 'secret') return;
          const cells = lv.hiddenCells.filter((c) => c.i === i);
          if (!cells.length) { out.unhidden.push(`${d.id} (${m.x / 16},${m.y / 16})`); return; }
          const inRoom = (ch) => lv.spawns.some((s) => s.ch === ch && lv.hidden[s.ty * lv.w + s.tx] === i);
          if (!inRoom('Z') && !'+HM'.split('').some(inRoom)) out.noHealth.push(`${d.id} (${m.x / 16},${m.y / 16})`);
        });
        out.arch[d.id] = { theme: d.theme, windows: lv.archWindows.length, fans: lv.fans.length };
        for (const dd of lv.decor) if (dd.free && /^e4m[125]$/.test(d.id) && dd.y > lv.pxH - 30 * 16) out.free.push(`${d.id} ${dd.kind} (${Math.floor(dd.x / 16)},${Math.floor(dd.y / 16)})`);
      }
      // 2. комната со слипгейтом на E2M3: до открытия не видна и не светит, после — светит
      Game.startFromSelect('e2m3', 1); Game.god = true; Game.monsters = [];
      let lv = Game.level;
      const z = lv.exits.find((e) => e.secret);
      const mi = lv.secretIndexAt(z.cx, z.bottom - 8);
      const lightAt = () => {
        const d = lv.lightCanvas.getContext('2d').getImageData(Math.floor(z.cx / 4), Math.floor((z.bottom - 20) / 4), 1, 1).data;
        return d[0] + d[1] + d[2];
      };
      out.zHidden = lv.isHiddenAt(z.cx, z.bottom - 8);
      out.zLightBefore = lightAt();
      out.secretLights = lv.secretLights.filter((l) => l.secret === mi).length;
      // яркий проход не рисует портал и пламя закрытой комнаты: считаем рисование по клеткам комнаты
      const drawnIn = () => {
        let n = 0;
        const ctx = new Proxy(Game.wctx, { get: (t, k) => { const v = t[k]; if (typeof v !== 'function') return v; return (...a) => { if ((k === 'fillRect' || k === 'drawImage') && typeof a[0] === 'number') { const wx = a[0] + Game.cam.x; if (Math.abs(wx - z.cx) < 50) n++; } return v.apply(t, a); }; }, set: (t, k, v) => { t[k] = v; return true; } });
        Game.cam.x = z.cx - Game.viewW / 2; Game.cam.y = z.bottom - Game.viewH / 2;
        lv.drawPortals(ctx, Game.cam, 1, true);
        lv.drawDecorBright(ctx, Game.cam, 1);
        return n;
      };
      out.drawnClosed = drawnIn();
      lv.openSecret(lv.movers[mi]);
      for (let i = 0; i < 90; i++) Game.update(1 / 60);
      out.zLightAfter = lightAt();
      out.drawnOpen = drawnIn();
      // 3. оружие на полу: свой свет; копоть
      Game.startFromSelect('e1m1', 1); Game.god = true; Game.monsters = [];
      lv = Game.level;
      const gun = Game.items.find((it) => it.ch === '3');
      const L = []; gun.lights(L, 1);
      out.gunLight = L.length;
      const hp = Game.items.find((it) => it.ch === '+'); const L2 = []; hp.lights(L2, 1);
      out.healthLight = L2.length;
      // копоть: двадцать взрывов в одну точку
      const p = Game.player;
      for (let i = 0; i < 20; i++) lv.paintScorch(p.cx + (i % 3), p.y + p.h - 4, 20);
      out.scorchSame = lv.scorches.length;
      for (let i = 0; i < 60 * 31; i++) lv.updateScorches(1 / 60);
      out.scorchLater = lv.scorches.length;
      // 4. значок супергвоздомёта в ячейке неподвижен: HUD зовёт gunImg без времени
      p.weapons[5] = true;
      const calls = [];
      const orig = window.gunImg;
      window.gunImg = function (k, t) { calls.push([k, t]); return orig(k, t); };
      for (let i = 0; i < 3; i++) { Game.time += 0.05; Game.render(); }
      window.gunImg = orig;
      const sng = calls.filter((c) => c[0] === 5);
      out.sngCalls = sng.length;
      out.sngAnimated = sng.filter((c) => c[1]).length;
      // 5. арена Вестника
      const e3m6 = LEVELS.find((d) => d.id === 'e3m6').map;
      out.heraldPads = [e3m6[50][114], e3m6[50][128]].join('');
      out.heraldSmall = e3m6.join('').split('+').length - 1;
      out.heraldSecretMega = e3m6.some((row) => /\$M/.test(row) || /\$ *M/.test(row));
      Game.render();
      return out;
    });
    check(!r.unhidden.length, 'тайники видны с уровня: ' + r.unhidden.join(', '));
    check(!r.noHealth.length, 'тайники без лечения: ' + r.noHealth.join(', '));
    check(r.zHidden, 'комната со слипгейтом E2M3 не спрятана');
    check(r.secretLights > 0, 'свет комнаты со слипгейтом запечён заранее');
    check(r.drawnClosed === 0, `в закрытой комнате рисуются портал или пламя: ${r.drawnClosed}`);
    check(r.zLightAfter > r.zLightBefore + 30, `после открытия свет не зажёгся: ${r.zLightBefore} → ${r.zLightAfter}`);
    check(r.drawnOpen > 0, 'после открытия портал не рисуется');
    check(r.gunLight === 1 && r.healthLight === 0, `свет у оружия ${r.gunLight}, у аптечки ${r.healthLight}`);
    check(r.scorchSame <= 2, `двадцать взрывов в одну точку дали ${r.scorchSame} пятен копоти`);
    check(r.scorchLater === 0, 'копоть не исчезла через 31 с');
    check(r.sngCalls > 0 && r.sngAnimated === 0, `значок супергвоздомёта анимирован: ${r.sngAnimated} из ${r.sngCalls}`);
    check(!r.free.length, 'факелы без опоры в начале E4: ' + r.free.join(', '));
    check(r.heraldPads === '^^', 'у столба выхода на арене Вестника нет трамплина с одной из сторон: ' + r.heraldPads);
    check(r.heraldSmall >= 3 && r.heraldSecretMega, `на арене Вестника аптечек ${r.heraldSmall}, мегааптечка в тайнике: ${r.heraldSecretMega}`);
    const themed = Object.entries(r.arch);
    const noWin = themed.filter(([, a]) => ['castle', 'rune', 'nether', 'crypt'].includes(a.theme) && a.windows === 0).map(([id]) => id);
    check(!noWin.length, 'нет больших окон: ' + noWin.join(', '));
    check(themed.filter(([, a]) => a.theme === 'base').every(([, a]) => a.fans > 0), 'на базе нет вентиляторов');
    noPageErrors(page);
    await page.close();
    const wins = themed.reduce((s, [, a]) => s + a.windows, 0);
    return `тайники спрятаны и с лечением, окон ${wins}, копоть ${r.scorchSame} пятно → 0`;
  },
};
