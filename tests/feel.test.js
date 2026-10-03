'use strict';
// Отдача и звуковая среда: отметка попадания и стоп-кадр на мощном ударе, вспышка
// выстрела и гильзы, подготовка атаки монстра; фоновые источники уровня, эхо по
// размеру помещения, глухой звук под водой и тишина фона на паузе.
const { openGame, check, noPageErrors } = require('./lib');

module.exports = {
  name: 'отдача и звуковая среда',
  async run(browser) {
    const page = await openGame(browser);
    const feel = await page.evaluate(() => {
      const out = {};
      Game.startFromSelect('e1m1', 1); Game.god = true;
      const p = Game.player;
      Game.monsters = [];
      // обычное попадание: отметка на прицеле, без стоп-кадра
      const g = new Monster('grunt', p.cx + 80, p.y + p.h);
      Game.monsters.push(g);
      applyDamage(g, 10, p, 'bullet');
      out.mark = HUD.hitMark ? HUD.hitMark.t : 0;
      out.stopSmall = Game.hitstop;
      // мощный удар по огру — короткий стоп-кадр, мир замирает
      const o = new Monster('ogre', p.cx + 120, p.y + p.h);
      Game.monsters.push(o);
      applyDamage(o, 300, p, 'explosion');
      out.kill = HUD.hitMark.kill;
      out.stop = Game.hitstop;
      const t0 = Game.time;
      Game.update(1 / 60);
      out.frozen = Game.time === t0;
      for (let i = 0; i < 10; i++) Game.update(1 / 60);
      out.thawed = Game.time > t0 && Game.hitstop <= 0;
      // выстрел из двустволки: вспышка у ствола и две гильзы
      FX.clear();
      p.weapons[3] = true; p.ammo.shells = 20; p.weapon = 3; p.fireCd = 0;
      p.fire();
      out.flash = FX.parts.filter((f) => f.kind === 'flash').length;
      out.shells = FX.parts.filter((f) => f.kind === 'shell').length;
      // подготовка атаки: монстр в начале выстрела рисует метку
      const calls = [];
      const ctx = new Proxy({}, { get: (t, k) => (typeof k === 'string' && /^(arc|fill|fillRect|beginPath)$/.test(k) ? (...a) => calls.push(k) : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
      g.state = 'attack'; g.attackKind = 'ranged'; g.stateT = 0.3; g.fired = 0;
      g.drawTell(ctx, Game.cam);
      out.tell = calls.filter((c) => c === 'arc').length;
      calls.length = 0;
      g.fired = 1;
      g.drawTell(ctx, Game.cam);
      out.tellAfterShot = calls.length;
      for (let i = 0; i < 5; i++) { Game.update(1 / 60); Game.render(); }
      return out;
    });
    check(feel.mark > 0 && feel.stopSmall === 0, 'попадание без отметки или с лишним стоп-кадром: ' + JSON.stringify(feel));
    check(feel.kill && feel.stop >= 0.03 && feel.stop <= 0.08, 'мощный удар без стоп-кадра 30–80 мс: ' + feel.stop);
    check(feel.frozen && feel.thawed, 'стоп-кадр не замораживает мир или не отпускает его');
    check(feel.flash >= 1 && feel.shells === 2, `нет вспышки или гильз: вспышек ${feel.flash}, гильз ${feel.shells}`);
    check(feel.tell >= 2 && feel.tellAfterShot === 0, 'метка подготовки атаки рисуется неверно: ' + JSON.stringify(feel));

    // звуковая среда: нужен запущенный звук
    await page.mouse.click(480, 270);
    const snd = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      Sound.init();
      await sleep(200);
      const out = { state: Sound.ctx.state, kinds: {}, noSrc: [] };
      for (const d of LEVELS) {
        const lv = new Level(d); lv.bake();
        Ambient.setLevel(lv);
        if (!Ambient.srcs.length) out.noSrc.push(d.id);
        for (const s of Ambient.srcs) out.kinds[s.kind] = (out.kinds[s.kind] || 0) + 1;
      }
      // лавовое озеро Хтона слышно рядом
      Game.startFromSelect('e1m6', 1); Game.god = true; Game.monsters = [];
      const p = Game.player, lv = Game.level;
      const lava = Ambient.srcs.find((s) => s.kind === 'lava');
      p.x = lava.x - p.w / 2; p.y = 20 * TILE; p.vx = p.vy = 0;
      for (let i = 0; i < 30; i++) { p.x = lava.x - p.w / 2; p.y = 20 * TILE; p.vy = 0; Game.update(1 / 60); }
      await sleep(400);
      for (let i = 0; i < 20; i++) { p.x = lava.x - p.w / 2; p.y = 20 * TILE; p.vy = 0; Game.update(1 / 60); }
      out.nearLava = [...Ambient.active.keys()].some((s) => s.kind === 'lava');
      // эхо: тесный проход у входа против огромного зала над лавой
      out.small = Game.measureRoom(3 * TILE + 8, 34 * TILE).size;
      out.big = Game.measureRoom(lava.x, 20 * TILE).size;
      // под водой звук глухой
      Game.startFromSelect('e1m2', 1); Game.god = true; Game.monsters = [];
      const q = Game.player, wl = Game.level;
      let w = null;
      for (let y = 2; y < wl.h && !w; y++) for (let x = 0; x < wl.w - 1; x++) if ([0, 1, 2].every((k) => wl.tile(x, y + k) === T.WATER && wl.tile(x + 1, y + k) === T.WATER)) { w = { x, y }; break; }
      for (let i = 0; i < 30; i++) { q.x = w.x * TILE + 2; q.y = (w.y + 1) * TILE; q.vy = 0; Game.update(1 / 60); }
      out.under = Sound.underwater;
      await sleep(300);
      out.freq = Sound.water.frequency.value;
      // пауза: фон стихает, вода больше не глушит звук меню
      Game.pause();
      for (let i = 0; i < 30; i++) Game.update(1 / 60);
      out.pausedActive = Ambient.active.size;
      out.pausedUnder = Sound.underwater;
      Game.resume();
      return out;
    });
    check(snd.state === 'running', 'звук не запустился: ' + snd.state);
    check(!snd.noSrc.length, 'уровни без фоновых звуков: ' + snd.noSrc.join(', '));
    for (const k of ['crackle', 'lava', 'slime', 'water', 'hum', 'void']) check(snd.kinds[k] > 0, 'нет источников вида ' + k);
    check(snd.nearLava, 'у лавового озера не слышно лавы');
    check(snd.small < 0.35 && snd.big > 0.6, `эхо не различает помещения: тесно ${snd.small.toFixed(2)}, зал ${snd.big.toFixed(2)}`);
    check(snd.under && snd.freq < 2000, 'под водой звук не глохнет: ' + snd.freq);
    check(snd.pausedActive === 0 && !snd.pausedUnder, 'на паузе фон не стих');
    noPageErrors(page);
    return `стоп-кадр ${Math.round(feel.stop * 1000)} мс, источников ${Object.values(snd.kinds).reduce((a, b) => a + b, 0)}, эхо ${snd.small.toFixed(2)}→${snd.big.toFixed(2)}`;
  },
};
