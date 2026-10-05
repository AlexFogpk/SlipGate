'use strict';
// Кольцо теней, как в Quake: монстры не видят героя вовсе.
// • Спокойный монстр не замечает героя даже вплотную.
// • Монстр, который уже гнался, теряет героя, ищет на месте и успокаивается.
// • На шум выстрела монстр приходит, но героя не видит и не стреляет.
// • Раненый монстр недолго бьёт туда, откуда стреляли, а потом за героем не следит.
// • Самонаводящийся шар не находит невидимого героя.
// Для сравнения — та же погоня без кольца: монстр стреляет и попадает.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'кольцо теней',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const out = {};
      const flat = (lv) => {
        for (let y = 3; y < lv.h - 2; y++) for (let x = 4; x < lv.w - 30; x++) {
          let ok = true;
          for (let i = 0; i < 24 && ok; i++) ok = lv.tileSolid(x + i, y + 1) && !lv.tileSolid(x + i, y) && !lv.tileSolid(x + i, y - 1) && !lv.liquidAt((x + i) * 16 + 8, y * 16 + 8) && !lv.liquidAt((x + i) * 16 + 8, (y + 1) * 16 + 8);
          if (ok) return [x, y];
        }
        return null;
      };
      let id = null;
      for (const d of LEVELS) { Game.startFromSelect(d.id, 2); if (flat(Game.level)) { id = d.id; break; } }
      out.level = id;
      // ровный пол, герой слева, монстры справа; урон по герою считаем, сам герой не гибнет
      const scene = (ring) => {
        Game.startFromSelect(id, 2); Game.monsters = []; Game.projectiles = [];
        const p = Game.player, [fx, fy] = flat(Game.level);
        const put = (tx) => { p.x = (fx + tx) * 16 + 8 - p.w / 2; p.y = (fy + 1) * 16 - p.h; p.vx = p.vy = 0; p.health = 100; p.ring = ring; };
        const hurt = { dmg: 0 };
        const td = p.takeDamage;
        p.takeDamage = function (d, ...a) { hurt.dmg += d; return td.call(this, d, ...a); };
        const grunt = (tx, facing) => { const g = new Monster('grunt', (fx + tx) * 16 + 8, (fy + 1) * 16); g.facing = facing; Game.monsters.push(g); return g; };
        put(4);
        return { p, fx, put, hurt, grunt };
      };
      const run = (n, each) => { for (let i = 0; i < n; i++) { each(i); Game.update(1 / 60); } };
      // 1. подходим вплотную к спокойному солдату, который смотрит на героя
      {
        const s = scene(30), g = s.grunt(20, -1);
        let noticed = false;
        run(240, (i) => { s.put(4 + Math.min(15, i / 12)); if (g.state !== 'idle') noticed = true; });
        out.walkUp = { noticed, gap: Math.round(g.distTo(s.p)) };
      }
      // 2. погоня: без кольца солдат попадает, с кольцом — теряет героя
      for (const ring of [0, 30]) {
        const s = scene(0), g = s.grunt(16, -1);
        g.alert(s.p, false);
        run(30, () => s.put(4));
        s.hurt.dmg = 0;
        run(60 * 8, () => s.put(4) || (s.p.ring = ring));
        out[ring ? 'chaseRing' : 'chaseNoRing'] = { dmg: Math.round(s.hurt.dmg), state: g.state };
      }
      // 3. шум выстрела: солдат приходит на шум, но не видит героя
      {
        const s = scene(30), g = s.grunt(18, 1);
        Game.noise(s.p.cx, s.p.cy, 420);
        let came = false;
        run(60 * 8, () => { s.put(4); if (g.state === 'chase') came = true; });
        out.noise = { came, dmg: Math.round(s.hurt.dmg) };
      }
      // 4. герой ранил солдата и ушёл: тот стреляет по месту выстрела, но не следит
      {
        const s = scene(30), g = s.grunt(16, -1);
        g.cd = 0;
        applyDamage(g, 5, s.p, 'bullet');
        let shots = 0, late = 0;
        run(60 * 8, (i) => {
          s.put(4 - Math.min(6, i / 10));
          if (i === 90) late = s.hurt.dmg;
          if (g.state === 'attack' && g.stateT < 1 / 60 + 1e-6) shots++;
        });
        out.hurt = { shots, early: Math.round(late), late: Math.round(s.hurt.dmg - late) };
      }
      // 5. шар вора не доворачивает к невидимому герою
      {
        const s = scene(30);
        const v = new Monster('vore', (s.fx + 18) * 16 + 8, (flat(Game.level)[1] + 1) * 16);
        Game.monsters.push(v);
        const ang = Math.PI;
        spawnProjectile('voreball', v, v.cx, v.cy - 30, ang, { target: s.p });
        const ball = Game.projectiles[Game.projectiles.length - 1];
        run(30, () => s.put(4));
        out.homing = Math.abs(angleDiff(Math.atan2(ball.vy, ball.vx), ang));
      }
      Game.render();
      return out;
    });
    check(r.level, 'не нашлось ровного пола для проверки');
    check(!r.walkUp.noticed, `солдат заметил невидимого героя вплотную (${r.walkUp.gap} px)`);
    check(r.chaseNoRing.dmg > 0, 'без кольца солдат в погоне не попал — проверка ничего не доказывает');
    check(r.chaseRing.dmg === 0, `с кольцом солдат в погоне всё равно попадал: урон ${r.chaseRing.dmg}`);
    check(r.noise.came, 'на шум выстрела солдат не пришёл');
    check(r.noise.dmg === 0, `пришёл на шум и увидел невидимого: урон ${r.noise.dmg}`);
    check(r.hurt.shots >= 1, 'раненый солдат не ответил огнём по месту выстрела');
    check(r.hurt.late === 0, `раненый солдат следит за невидимым героем: урон после ухода ${r.hurt.late}`);
    check(r.homing < 0.01, `шар вора навёлся на невидимого героя: поворот ${r.homing.toFixed(2)} рад`);
    noPageErrors(page);
    await page.close();
    return `без кольца урон ${r.chaseNoRing.dmg}, с кольцом 0; ответный огонь ${r.hurt.shots} выстр. по месту выстрела`;
  },
};
