'use strict';
// Передний план: вещи привязаны к потолкам мира и смещаются от центра кадра быстрее
// мира по обеим осям — в прыжке героя они уходят вниз, а не прыгают вместе с ним.
// Вещь над героем становится полупрозрачной, взрыв раскачивает цепи, переключатель в
// настройках выключает слой целиком, под открытым небом и в Пустоте вещей нет.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'передний план с глубиной',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = { counts: {} };
      for (const d of LEVELS) {
        const lv = new Level(d); lv.bake();
        out.counts[d.id] = { hang: lv.amb.fg.length, pillars: lv.amb.fgPillars.length, theme: d.theme };
        // ни одна вещь не висит под небом: над точкой крепления — камень
        out.counts[d.id].sky = lv.amb.fg.filter((o) => !lv.tileSolid(o.tx, o.ty - 1)).length;
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
      // переключатель: рисование передним планом считается по вызовам холста
      const count = () => {
        let n = 0;
        const ctx = new Proxy(Game.wctx, { get: (t, key) => { const v = t[key]; if (typeof v !== 'function') return v; return (...a) => { if (key === 'drawImage' || key === 'fillRect') n++; return v.apply(t, a); }; }, set: (t, key, v) => { t[key] = v; return true; } });
        drawForeground(ctx, lv, Game.cam, Game.viewW, Game.viewH);
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
    check(r.drawOn > 0 && r.drawOff === 0, `переключатель не работает: вкл ${r.drawOn}, выкл ${r.drawOff}`);
    check(r.menuLabel === 'Передний план: вкл' && r.stored === false && r.menuLabel2 === 'Передний план: выкл', 'пункт настроек не переключается: ' + r.menuLabel + ' → ' + r.menuLabel2);
    noPageErrors(page);
    await page.close();
    const total = Object.values(r.counts).reduce((a, c) => a + c.hang + c.pillars, 0);
    return `вещей ${total}; в прыжке камера ${Math.round(j.dy)} px → вещь ${Math.round(j.fgShift)} px (k ${r.k})`;
  },
};
