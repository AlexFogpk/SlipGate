'use strict';
// Доски платформ держат выстрелы: пуля солдата, лазер карателя и выстрел героя не
// проходят сквозь доску ни снизу, ни сверху. Стрелок под доской не тратит выстрелы
// в неё, а отходит к краю. Сбоку доска не мешает: над её краем стрелять можно.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'выстрелы и доски платформ',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      // E1M1: доска в клетках 136–146 ряда 24, под ней пусто до пола
      Game.startFromSelect('e1m1', 1);
      const lv = Game.level, p = Game.player;
      Game.monsters = [];
      let floorRow = 25;
      while (!lv.tileSolid(141, floorRow)) floorRow++;
      const onPlank = () => { p.x = 141 * TILE + 8 - p.w / 2; p.y = 24 * TILE - p.h; p.vx = p.vy = 0; };
      onPlank(); p.health = 100; p.armor = 0;
      const hits = [];
      const takeDamage = p.takeDamage;
      p.takeDamage = function (d, a, k, ...rest) { hits.push(k); return takeDamage.call(this, d, a, k, ...rest); };
      const g = new Monster('grunt', 141 * TILE + 8, floorRow * TILE);
      const e = new Monster('enforcer', 139 * TILE + 8, floorRow * TILE);
      // пуля снизу вверх
      let through = 0;
      for (let i = 0; i < 20; i++) { const s = g.shootPoint(); if (hitscan(g, s.x, s.y, Math.atan2(p.cy - s.y, p.cx - s.x), 1, 4, 0)) through++; }
      out.bulletUp = through;
      // лазер снизу вверх
      Game.monsters.push(g, e);
      const s = e.shootPoint();
      spawnProjectile('laser', e, s.x, s.y, Math.atan2(p.cy - s.y, p.cx - s.x));
      for (let i = 0; i < 40; i++) { onPlank(); Game.update(1 / 60); }
      out.laserUp = hits.length;
      // выстрел героя сверху вниз сквозь доску тоже не проходит
      const sh = p.shoulder();
      out.playerDown = hitscan(p, sh.x, sh.y, Math.atan2(g.cy - sh.y, g.cx - sh.x), 1, 4, 0);
      // а сбоку, над краем доски, — проходит
      const side = new Monster('grunt', 150 * TILE + 8, 24 * TILE);
      Game.monsters.push(side);
      out.overEdge = hitscan(p, sh.x, sh.y, Math.atan2(side.cy - sh.y, side.cx - sh.x), 1, 1, 0);
      Game.monsters = Game.monsters.filter((m) => m !== side);
      // бой: стрелки под доской не стреляют сквозь неё и идут к краю
      hits.length = 0;
      const gx = g.cx, ex = e.cx;
      g.alert(p, false); e.alert(p, false);
      let wasted = 0;
      for (let i = 0; i < 60 * 6; i++) {
        onPlank(); p.health = 100;
        Game.update(1 / 60);
        for (const m of [g, e]) if (m.state === 'attack' && m.stateT < 1 / 60 + 1e-6 && lv.rayCast(m.shootPoint().x, m.shootPoint().y, p.cx, p.cy, false, true).hit) wasted++;
      }
      out.fightHits = hits.length;
      out.wasted = wasted;
      out.moved = Math.max(Math.abs(g.cx - gx), Math.abs(e.cx - ex));
      Game.render();
      return out;
    });
    check(r.bulletUp === 0, `пули солдата прошли сквозь доску: ${r.bulletUp} из 20`);
    check(r.laserUp === 0, 'лазер карателя прошёл сквозь доску');
    check(!r.playerDown, 'выстрел героя прошёл сквозь доску под ним');
    check(r.overEdge, 'выстрел над краем доски не долетел');
    check(r.fightHits === 0 && r.wasted === 0, `стрелки под доской попадали или стреляли в неё: попаданий ${r.fightHits}, выстрелов в доску ${r.wasted}`);
    check(r.moved > 40, 'стрелки под доской не пошли к её краю: ' + Math.round(r.moved));
    noPageErrors(page);
    await page.close();
    return `сквозь доску 0 из 20, стрелки отошли на ${Math.round(r.moved)} px`;
  },
};
