'use strict';
// Монстры не оказываются в стенах, лаве, слизи и пустоте.
// • Точки появления: монстры карты, засад и волн арены — в свободном месте, не в жидкости,
//   ходячие — не над лавой (Хтон по пояс в лаве и угри в воде — так задумано).
// • Расталкивание: двое вплотную расходятся только в свободное место и не с края,
//   в том числе когда один из них в прыжке над лавой.
// • Живая игра: на уровнях с лавой и кислотой монстры гонятся за героем и не попадают
//   в стены и в лаву сами (отброс от попадания — канон Quake, его не считаем).
// • Кочки над кислотой E1M1: солдат перепрыгивает их и не падает.
// • Слуги боссов появляются в свободном месте.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'монстры не в стенах и не в лаве',
  async run(browser) {
    const page = await openGame(browser);
    const r = await page.evaluate(() => {
      const deadly = (t) => t === T.LAVA || t === T.SLIME || t === T.VOID;
      const why = (m) => {
        const lv = Game.level;
        if (!lv.boxFree(m.x, m.y, m.w, m.h)) return 'в стене';
        if (m.type === 'eel' || m.type === 'chthon') return null;
        if ([lv.liquidAt(m.cx, m.y + 2), lv.liquidAt(m.cx, m.y + m.h - 2)].some(deadly)) return 'в жидкости';
        if (m.def.fly || m.def.static) return null;
        return dropCheck(m.cx, m.y + m.h) === 'hazard' ? 'над лавой' : null;
      };
      const out = { static: [], live: { wall: [], liquid: [] }, minions: [] };
      // 1. точки появления
      for (const def of LEVELS) {
        for (const skill of [0, 2]) {
          Game.startFromSelect(def.id, skill);
          for (const m of Game.monsters) { if (m.state === 'dormant') continue; const w = why(m); if (w) out.static.push(`${def.id} ${m.type}: ${w}`); }
        }
        const extra = [];
        for (const t of def.traps || []) extra.push(...t.spawn.map((s) => ['засада', s]));
        for (const wv of def.waves ? def.waves.list : []) extra.push(...wv.spawn.map((s) => ['волна', s]));
        for (const [kind, [sx, sy, ch]] of extra) {
          const m = new Monster(MONSTER_CHARS[ch], sx * TILE + 8, (sy + 1) * TILE);
          const w = why(m);
          if (w) out.static.push(`${def.id} ${kind} ${m.type} @${sx},${sy}: ${w}`);
        }
      }
      // 2. расталкивание у стены и у края над лавой
      Game.startFromSelect('e1m5', 2); Game.god = true; Game.monsters = [];
      const lv5 = Game.level;
      let wallX = null, wy = null;
      for (let y = 5; y < lv5.h - 2 && wallX === null; y++) for (let x = 3; x < lv5.w - 3; x++) {
        if (lv5.tileSolid(x, y + 1) && !lv5.tileSolid(x, y) && !lv5.tileSolid(x, y - 1) && !lv5.tileSolid(x + 1, y) && lv5.tileSolid(x - 1, y) && lv5.tileSolid(x - 1, y - 1) && !lv5.liquidAt(x * 16 + 8, y * 16 + 8)) { wallX = x; wy = y; break; }
      }
      const a = new Monster('ogre', wallX * TILE + 12, (wy + 1) * TILE), b = new Monster('ogre', wallX * TILE + 16, (wy + 1) * TILE);
      a.x = wallX * TILE; b.x = a.x + 3;
      Game.monsters.push(a, b);
      for (let i = 0; i < 180; i++) { Game.player.x = 4 * 16; Game.separateMonsters(1 / 60); }
      out.pushWall = [a, b].filter((m) => !lv5.boxFree(m.x, m.y, m.w, m.h)).length;
      // в прыжке: порождение скачет над краем острова в лаве E2M3, огр вжимается в него —
      // раньше край проверялся только у стоящих, и порождение сталкивало в лаву
      Game.startFromSelect('e2m3', 2); Game.god = true; Game.monsters = [];
      const sp = new Monster('spawn', 0, 0), og = new Monster('ogre', 0, 0);
      sp.x = 60 * 16 + 1; sp.y = 46 * 16 - sp.h - 12; sp.onGround = false;
      og.y = 46 * 16 - og.h; og.onGround = true;
      Game.monsters.push(sp, og);
      for (let i = 0; i < 60; i++) { og.x = sp.x + 6; Game.separateMonsters(1 / 60); }
      out.pushAir = dropCheck(sp.cx, sp.y + sp.h);
      // 3. живая игра на уровнях с лавой и кислотой (отброс уроном — канон, его не считаем)
      let frame = 0;
      const takeDamage = Monster.prototype.takeDamage;
      Monster.prototype.takeDamage = function (...a) { this._hitF = frame; return takeDamage.apply(this, a); };
      for (const id of ['e1m1', 'e1m4', 'e1m5', 'e2m3', 'e3m3', 'e1m7']) {
        Game.startFromSelect(id, 2); Game.god = true;
        const lv = Game.level, p = Game.player;
        for (const m of Game.monsters) if (!m.def.static && !m.def.boss) m.alert(p, false);
        const flagged = new Set();
        for (let i = 0; i < 60 * 20; i++) {
          Input.down.clear();
          Input.down.add(Math.floor(i / 90) % 4 < 2 ? 'KeyD' : 'KeyA');
          if (i % 50 < 6) Input.down.add('Space');
          frame = i;
          Game.update(1 / 60);
          if (i % 15) continue;
          for (const m of Game.monsters) {
            if (!m.alive || m.def.boss || m.def.static || flagged.has(m)) continue;
            if (!lv.boxFree(m.x + 1, m.y + 1, m.w - 2, m.h - 2)) { flagged.add(m); out.live.wall.push(`${id} ${m.type}`); continue; }
            if (m.type === 'eel') continue;
            if (deadly(lv.liquidAt(m.cx, m.y + m.h - 3)) && !(m._hitF > i - 90)) { flagged.add(m); out.live.liquid.push(`${id} ${m.type} (${m.state})`); }
          }
        }
        Input.down.clear();
      }
      Monster.prototype.takeDamage = takeDamage;
      // 4. кочки над кислотой E1M1
      Game.startFromSelect('e1m1', 2); Game.god = true; Game.monsters = [];
      const p = Game.player;
      const g = new Monster('grunt', 123 * 16 + 8, 32 * 16);
      // дистанция стрелка без случайного разброса: с дальней (до 121 px) он законно
      // остаётся на крайней кочке и стреляет оттуда, не доходя до героя
      g.pref = g.def.keep;
      Game.monsters.push(g); g.alert(p, false);
      out.stones = 'не дошёл';
      for (let i = 0; i < 60 * 15; i++) {
        p.x = 100 * 16; p.y = 32 * 16 - p.h; p.vx = p.vy = 0;
        Game.update(1 / 60);
        if (Game.level.liquidAt(g.cx, g.y + g.h - 3)) { out.stones = 'упал в кислоту'; break; }
        if (g.cx < 104 * 16 && g.onGround) { out.stones = 'перешёл'; break; }
      }
      // 5. слуги боссов
      const watch = (id, setup, sec) => {
        Game.startFromSelect(id, 2); Game.god = true;
        setup();
        const seen = new Set(Game.monsters);
        let n = 0;
        for (let i = 0; i < sec * 60; i++) {
          Game.update(1 / 60);
          for (const m of Game.monsters) if (!seen.has(m)) {
            seen.add(m); n++;
            const w = why(m); if (w) out.minions.push(`${id} ${m.type}: ${w}`);
          }
          if (i % 120 === 0) for (const m of Game.monsters) if (m.minion && m.alive) applyDamage(m, 9999, Game.player, 'rocket');
        }
        return n;
      };
      const put = (tx, ty) => { const q = Game.player; q.x = tx * 16 + 8 - q.w / 2; q.y = (ty + 1) * 16 - q.h; q.vx = q.vy = 0; };
      out.minionCount = watch('e2m6', () => put(64, 40), 40) + watch('e3m6', () => { put(54, 50); for (const m of Game.monsters) if (m.type === 'pylon') applyDamage(m, 9999, Game.player, 'rocket'); }, 40);
      return out;
    });
    check(!r.static.length, 'плохие точки появления:\n' + r.static.join('\n'));
    check(r.pushWall === 0, 'расталкивание вдавило монстра в стену');
    check(r.pushAir === 'safe', 'расталкивание столкнуло порождение в прыжке в лаву');
    check(!r.live.wall.length, 'монстры в стенах:\n' + r.live.wall.join('\n'));
    check(r.live.liquid.length === 0, 'монстры сами зашли в лаву или слизь:\n' + r.live.liquid.join('\n'));
    check(r.stones === 'перешёл', 'кочки над кислотой: солдат ' + r.stones);
    check(r.minionCount > 10 && !r.minions.length, `слуги боссов (${r.minionCount}) появились плохо:\n` + r.minions.join('\n'));
    noPageErrors(page);
    await page.close();
    return `в стенах 0, в жидкостях ${r.live.liquid.length}${r.live.liquid.length ? " (" + r.live.liquid.join(", ") + ")" : ""}, слуг боссов ${r.minionCount}`;
  },
};
