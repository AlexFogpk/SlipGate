'use strict';
// Передний план: вещи привязаны к потолкам мира и смещаются от центра кадра быстрее
// мира по обеим осям — в прыжке героя они уходят вниз, а не прыгают вместе с ним.
// Вещь над героем становится полупрозрачной, взрыв раскачивает цепи, переключатель в
// настройках выключает слой целиком, под открытым небом и в Пустоте вещей нет.
// Второй проход: у каждой темы свои вещи (лампы, фонари, крюки, черепа), длинное висит
// только в высоких залах и не опускается ниже четырёх клеток над полом, лампы и факелы
// светятся, тряска и пролетевший снаряд качают цепь и она звякает, в бою слой прозрачнее.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'передний план с глубиной',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = { counts: {}, types: {}, torches: 0, beacons: 0, tooLow: [], longLow: [] };
      for (const d of LEVELS) {
        const lv = new Level(d); lv.bake();
        out.counts[d.id] = { hang: lv.amb.fg.length, pillars: lv.amb.fgPillars.length, theme: d.theme };
        // ни одна вещь не висит под небом: над точкой крепления — камень
        out.counts[d.id].sky = lv.amb.fg.filter((o) => !lv.tileSolid(o.tx, o.ty - 1)).length;
        for (const o of lv.amb.fg) out.types[o.type] = (out.types[o.type] || 0) + 1;
        out.torches += lv.amb.fgPillars.filter((p) => p.torch).length;
        out.beacons += lv.amb.fgPillars.filter((p) => p.beacon).length;
        // низ вещи не ближе четырёх клеток к полу, длинное — только в залах от семи клеток
        for (const o of lv.amb.fg) {
          let room = 0;
          while (room < 30) { const t = lv.tile(o.tx, o.ty + room); if (isSolidType(t) || isLiquidType(t) || t === T.PLAT) break; room++; }
          if (fgExtent(o.type, o.len, o.v) * FG_LAYERS[o.layer].scale > (room - 4) * TILE + 0.5) out.tooLow.push(`${d.id} ${o.type} ${o.tx},${o.ty}`);
          if (FG_LONG.has(o.type) && room < 7) out.longLow.push(`${d.id} ${o.type} ${o.tx},${o.ty}`);
        }
      }
      Game.startFromSelect('e2m4', 1); Game.god = true; Game.monsters = [];
      const lv = Game.level, p = Game.player;
      HUD.centerT = 0;
      const o = lv.amb.fg.find((q) => q.layer === 0 && q.type === 'cage') || lv.amb.fg.find((q) => q.layer === 0);
      let fy = o.ty;
      while (!lv.tileSolid(Math.floor(o.x / TILE), fy) && fy < lv.h - 1) fy++;
      const put = (dx) => { p.x = o.x + dx; p.y = fy * TILE - p.h; p.vx = p.vy = 0; };
      put(110); Game.snapCamera();
      for (let i = 0; i < 60; i++) { put(110); Game.update(1 / 60); }
      const k = FG_LAYERS[o.layer].k;
      const screenY = () => fgProject(o.x, o.y, k, Game.cam, Game.viewW, Game.viewH).y;
      const heroY = () => p.y - Game.cam.y;
      // прыжок: камера уходит вверх за героем — вещь едет вниз в k раз быстрее мира
      const y0 = screenY(), cam0 = Game.cam.y, h0 = heroY();
      p.vy = -420; p.onGround = false;
      let best = { dy: 0 };
      for (let i = 0; i < 30; i++) {
        Game.update(1 / 60);
        const dc = cam0 - Game.cam.y;
        if (dc > best.dy) best = { dy: dc, fgShift: screenY() - y0, heroShift: heroY() - h0 };
      }
      out.jump = best;
      out.k = k;
      for (let i = 0; i < 90; i++) { put(110); Game.update(1 / 60); }
      out.fadeAway = o.fade;
      // герой прямо под вещью — вещь становится полупрозрачной
      for (let i = 0; i < 40; i++) {
        const s = fgProject(o.x, o.y, k, Game.cam, Game.viewW, Game.viewH);
        p.x = s.x + Game.cam.x - p.w / 2; p.y = s.y + Game.cam.y + (o.len + 20) * FG_LAYERS[o.layer].scale - p.h;
        p.vx = p.vy = 0;
        Game.update(1 / 60);
      }
      out.fadeOver = o.fade;
      // взрыв рядом раскачивает
      put(110);
      for (let i = 0; i < 30; i++) { put(110); Game.update(1 / 60); }
      o.ang = 0; o.vel = 0;
      FX.explosion(o.x + 60, o.y + o.len, 1.2);
      let swing = 0;
      for (let i = 0; i < 30; i++) { put(110); Game.update(1 / 60); swing = Math.max(swing, Math.abs(o.ang)); }
      out.swing = swing;
      // тряска (шаги босса, обвал) раскачивает
      for (let i = 0; i < 120; i++) { put(110); Game.update(1 / 60); }
      o.ang = 0; o.vel = 0;
      let tremor = 0;
      for (let i = 0; i < 30; i++) { put(110); Game.shakeAmt = 10; Game.update(1 / 60); tremor = Math.max(tremor, Math.abs(o.ang)); }
      Game.shakeAmt = 0;
      out.tremor = tremor;
      // снаряд пролетел мимо на экране — вещь качнулась по ходу полёта и звякнула
      for (let i = 0; i < 180; i++) { put(110); Game.update(1 / 60); }
      o.ang = 0; o.vel = 0; o.clinkT = 0;
      const sounds = [];
      const play = Sound.play;
      Sound.play = function (name, ...a) { sounds.push(name); return play.call(this, name, ...a); };
      const sp0 = fgProject(o.x, o.y, k, Game.cam, Game.viewW, Game.viewH);
      const hh = fgExtent(o.type, o.len, o.v) * FG_LAYERS[o.layer].scale;
      const fake = { x: Game.cam.x + sp0.x - 80, y: Game.cam.y + sp0.y + hh * 0.6, vx: 700, vy: 0, splash: 120, dead: false };
      Game.projectiles = [fake];
      let flyVel = 0;
      for (let i = 0; i < 20; i++) {
        fake.x += 700 / 60;
        updateForeground(lv, 1 / 60, Game.cam, Game.viewW, Game.viewH);
        flyVel = Math.max(flyVel, o.vel);
      }
      Game.projectiles = [];
      Sound.play = play;
      out.flyVel = flyVel;
      out.clink = sounds.includes('clink');
      // в бою передний план прозрачнее
      for (let i = 0; i < 60; i++) { put(110); Game.update(1 / 60); }
      const calm = o.want;
      const mi = Game.musicIntensity;
      Game.musicIntensity = () => 1;
      for (let i = 0; i < 240; i++) { put(110); Game.update(1 / 60); }
      out.combat = { calm, fight: o.want, level: lv.amb.fgCombat };
      Game.musicIntensity = mi;
      // переключатель: рисование передним планом считается по вызовам холста
      const count = () => {
        let n = 0;
        const ctx = new Proxy(Game.wctx, { get: (t, key) => { const v = t[key]; if (typeof v !== 'function') return v; return (...a) => { if (key === 'drawImage' || key === 'fillRect') n++; return v.apply(t, a); }; }, set: (t, key, v) => { t[key] = v; return true; } });
        drawForeground(ctx, Game.level, Game.cam, Game.viewW, Game.viewH);
        return n;
      };
      Game.fgOn = true; out.drawOn = count();
      Game.fgOn = false; out.drawOff = count();
      Game.fgOn = true;
      // пункт в настройках и сохранение выбора
      Menu.screen = 'options';
      const item = Menu.items().find((it) => /Передний план/.test(it.label));
      out.menuLabel = item && item.label;
      if (item) item.act();
      out.stored = Store.get('fg', true);
      out.menuLabel2 = Menu.items().find((it) => /Передний план/.test(it.label)).label;
      Game.fgOn = true; Store.set('fg', true);
      for (let i = 0; i < 5; i++) { Game.update(1 / 60); Game.render(); }
      // свет: лампа на базе (E1M1) светится, ореол рисуется
      Game.startFromSelect('e1m1', 1); Game.god = true; Game.monsters = [];
      out.glows = 0;
      {
        const lv1 = Game.level, p = Game.player;
        HUD.centerT = 0;
        for (const q of lv1.amb.fg.filter((z) => z.type === 'lamp')) {
          let fy1 = q.ty; while (!lv1.tileSolid(Math.floor(q.x / TILE), fy1) && fy1 < lv1.h - 1) fy1++;
          const put1 = () => { p.x = q.x + 120; p.y = fy1 * TILE - p.h; p.vx = p.vy = 0; };
          if (!lv1.boxFree(q.x + 120, fy1 * TILE - p.h, p.w, p.h)) continue;
          put1(); Game.snapCamera();
          for (let i = 0; i < 50; i++) { put1(); Game.update(1 / 60); }
          if (q.fade < 0.5) continue;
          Game.render();
          out.glows = lv1.amb.fgGlows;
          break;
        }
      }
      return out;
    });
    const themed = Object.entries(r.counts).filter(([, c]) => c.theme !== 'void');
    const empty = themed.filter(([, c]) => c.hang + c.pillars === 0).map(([id]) => id);
    check(empty.length <= 2, 'уровни без переднего плана: ' + empty.join(', '));
    check(Object.values(r.counts).filter((c) => c.theme === 'void').every((c) => c.hang === 0 && c.pillars === 0), 'в Пустоте висят вещи');
    check(Object.values(r.counts).every((c) => c.sky === 0), 'вещи висят под небом');
    const j = r.jump;
    check(j.dy > 30, 'камера не поднялась в прыжке: ' + JSON.stringify(j));
    check(Math.abs(j.fgShift - j.dy * r.k) < 6, `в прыжке вещь сместилась на ${j.fgShift.toFixed(1)} px, ожидалось ${(j.dy * r.k).toFixed(1)} (k ${r.k})`);
    check(Math.abs(j.fgShift - j.heroShift) > 25, 'вещь двигается вместе с героем: ' + JSON.stringify(j));
    check(r.fadeOver < 0.45, 'вещь над героем не стала прозрачной: ' + r.fadeOver.toFixed(2));
    check(r.swing > 0.05, 'взрыв не раскачал вещь: ' + r.swing.toFixed(3));
    check(r.tremor > 0.03, 'тряска не раскачала вещь: ' + r.tremor.toFixed(3));
    check(r.flyVel > 0.5 && r.clink, `снаряд рядом не качнул вещь или она не звякнула: скорость ${r.flyVel.toFixed(2)}, звон ${r.clink}`);
    check(r.combat.level > 0.8 && r.combat.fight < r.combat.calm * 0.8, 'в бою передний план не стал прозрачнее: ' + JSON.stringify(r.combat));
    check(r.glows > 0, 'лампа на базе не светится');
    for (const t of ['lamp', 'lantern', 'hook', 'skulls']) check((r.types[t] || 0) >= 3, `вещей «${t}» почти нет: ${r.types[t] || 0}`);
    check(r.torches >= 3 && r.beacons >= 1, `факелов на колоннах ${r.torches}, сигнальных огней ${r.beacons}`);
    check(!r.tooLow.length, 'вещи опускаются ниже четырёх клеток над полом:\n' + r.tooLow.join('\n'));
    check(!r.longLow.length, 'длинные вещи в низких залах:\n' + r.longLow.join('\n'));
    check(r.drawOn > 0 && r.drawOff === 0, `переключатель не работает: вкл ${r.drawOn}, выкл ${r.drawOff}`);
    check(r.menuLabel === 'Передний план: вкл' && r.stored === false && r.menuLabel2 === 'Передний план: выкл', 'пункт настроек не переключается: ' + r.menuLabel + ' → ' + r.menuLabel2);
    noPageErrors(page);
    await page.close();
    const total = Object.values(r.counts).reduce((a, c) => a + c.hang + c.pillars, 0);
    return `вещей ${total}, факелов ${r.torches}; в прыжке камера ${Math.round(j.dy)} px → вещь ${Math.round(j.fgShift)} px (k ${r.k}); в бою ${(r.combat.fight / r.combat.calm).toFixed(2)} от обычной`;
  },
};
