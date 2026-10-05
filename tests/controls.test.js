'use strict';
// Удобства: переназначение клавиш (с сохранением), геймпад (бег, прицел, прыжок, меню),
// «Продолжить» в главном меню и рекорды уровня.
const { openGame, check, noPageErrors } = require('./lib');

// Поддельный геймпад: тест меняет window.__pad, игра читает его через navigator.getGamepads.
const FAKE_PAD = () => {
  window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [Object.assign({ index: 0, connected: true, id: 'test', mapping: 'standard' }, window.__pad)];
};

async function frames(page, n = 3) {
  for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
}

async function press(page, key) {
  await page.keyboard.press(key);
  await frames(page);
}

module.exports = {
  name: 'клавиши, геймпад, «Продолжить» и рекорды',
  async run(browser) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.addInitScript(FAKE_PAD);
    let page = await openGame(browser, { context: ctx });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
    await frames(page);

    // --- клавиши: главное меню → Настройки → Клавиши → «Прыжок» = K ---
    check(!(await page.evaluate(() => Menu.items()[0].label.startsWith('Продолжить'))), 'без сохранения есть «Продолжить»');
    // след нажатий: экран, пункт и число шагов игры — чтобы провал было видно по логу
    await page.evaluate(() => { const u = Game.update; window.__steps = 0; Game.update = function (dt) { window.__steps++; return u.call(this, dt); };
      window.__ev = [];
      for (const t of ['keydown', 'keyup', 'pointermove', 'pointerdown']) window.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.code || `${e.pointerType} ${e.clientX},${e.clientY}`)), true); });
    const menuState = () => page.evaluate(() => `${Game.state}/${Menu.screen}/${Menu.sel} шагов ${window.__steps} события ${window.__ev.splice(0).join(' ') || '-'}`);
    const trail = [await menuState()];
    for (const key of ['ArrowDown', 'ArrowDown', 'Enter']) { await press(page, key); trail.push(key + ' → ' + await menuState()); }
    check(await page.evaluate(() => Menu.screen === 'options'), 'не открылись настройки:\n' + trail.join('\n'));
    const keysIdx = await page.evaluate(() => Menu.items().findIndex((it) => it.label === 'Клавиши'));
    check(keysIdx >= 0, 'в настройках нет пункта «Клавиши»');
    for (let i = 0; i < keysIdx; i++) await press(page, 'ArrowDown');
    await press(page, 'Enter');
    check(await page.evaluate(() => Menu.screen === 'keys'), 'не открылся экран «Клавиши»');
    const jumpIdx = await page.evaluate(() => KEY_ACTIONS.findIndex((a) => a.id === 'jump'));
    for (let i = 0; i < jumpIdx; i++) await press(page, 'ArrowDown');
    await press(page, 'Enter');
    check(await page.evaluate(() => Menu.capturing === 'jump'), 'не ждёт новую клавишу');
    await press(page, 'KeyP');
    check(await page.evaluate(() => !Input.binds.jump.includes('KeyP') && !Menu.capturing), 'занятую клавишу P удалось назначить');
    await press(page, 'Enter');
    await press(page, 'KeyK');
    let binds = await page.evaluate(() => Input.binds);
    check(binds.jump[0] === 'KeyK', 'прыжок не переназначен: ' + binds.jump.join(','));
    // клавиша отбирается у другого действия
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    await press(page, 'KeyK');
    binds = await page.evaluate(() => Input.binds);
    check(binds.down[0] === 'KeyK' && !binds.jump.includes('KeyK'), 'клавиша осталась у двух действий');
    await press(page, 'ArrowUp');
    await press(page, 'Enter');
    await press(page, 'KeyK');

    // привязки переживают перезагрузку, и K правда прыгает
    await page.goto(page.url().split('?')[0] + '?map=e1m1');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.player);
    check(await page.evaluate(() => Input.binds.jump[0] === 'KeyK'), 'привязки не сохранились');
    // повторное назначение той же клавиши не теряет запасные
    check(await page.evaluate(() => { Input.rebind('jump', 'KeyK'); return Input.binds.jump.join(); }) === 'KeyK,ArrowUp', 'повторное назначение потеряло запасную клавишу');
    await frames(page, 30);
    // скорость меряем на каждом шаге игры: на медленной машине за четыре кадра
    // проходит до 24 шагов, и прыжок успевает дойти до вершины
    await page.evaluate(() => {
      window.__minVy = 0;
      const update = Game.update;
      Game.update = function (dt) { update.call(this, dt); window.__minVy = Math.min(window.__minVy, Game.player.vy); };
    });
    await page.keyboard.down('KeyK');
    await frames(page, 4);
    const vy = await page.evaluate(() => window.__minVy);
    await page.keyboard.up('KeyK');
    check(vy < -50, 'K не прыгает, vy=' + vy);
    const help = await page.evaluate(() => helpLines().map((l) => l.join(' ')).join('\n'));
    check(help.includes('K, ↑ прыжок'), 'экран «Управление» не показывает новую клавишу:\n' + help);

    // --- геймпад: левый стик — бег, правый — прицел, A — прыжок, Start — пауза ---
    await frames(page, 30);
    const x0 = await page.evaluate(() => Game.player.x);
    await page.evaluate(() => { window.__pad.axes = [1, 0, 0, -1]; });
    await frames(page, 20);
    const pad = await page.evaluate(() => ({ x: Game.player.x, aim: Game.player.aim, mode: Input.padMode }));
    check(pad.mode, 'геймпад не включил режим геймпада');
    check(pad.x > x0 + 5, `стик не двигает героя: ${x0} → ${pad.x}`);
    check(Math.abs(pad.aim + Math.PI / 2) < 0.2, 'правый стик не целит вверх: ' + pad.aim);
    await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; });
    await frames(page, 30);
    await page.evaluate(() => { window.__minVy = 0; window.__pad.buttons[0].pressed = true; });
    await frames(page, 4);
    const vy2 = await page.evaluate(() => window.__minVy);
    await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
    check(vy2 < -50, 'кнопка A не прыгает, vy=' + vy2);
    await page.evaluate(() => { window.__pad.buttons[9].pressed = true; });
    await frames(page, 3);
    await page.evaluate(() => { window.__pad.buttons[9].pressed = false; });
    await frames(page, 3);
    check(await page.evaluate(() => Game.state === 'paused'), 'Start не ставит паузу');
    await page.evaluate(() => { window.__pad.buttons[9].pressed = true; });
    await frames(page, 3);
    await page.evaluate(() => { window.__pad.buttons[9].pressed = false; });
    await frames(page, 3);
    check(await page.evaluate(() => Game.state === 'playing'), 'Start не снимает паузу');

    // --- «Продолжить» и рекорды ---
    await page.goto(page.url().split('?')[0] + '?map=e1m2&skill=2');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.player);
    const save = await page.evaluate(() => Store.get('save'));
    check(save && save.id === 'e1m2' && save.skill === 2 && save.inv, 'нет сохранения при входе на уровень: ' + JSON.stringify(save));
    await page.evaluate(() => { Game.levelTime = 100; Game.kills = 3; Game.startIntermission(); });
    const after = await page.evaluate(() => ({ save: Store.get('save'), rec: Game.levelRecord('e1m2', 2) }));
    check(after.save.id === 'e1m3' && after.save.skill === 2, 'после уровня «Продолжить» не ведёт на следующий');
    check(after.rec && after.rec.time === 100 && after.rec.kills === 3, 'рекорд не записан: ' + JSON.stringify(after.rec));
    await page.evaluate(() => { Game.loadLevel('e1m2', { inv: Game.startInv }); Game.state = 'playing'; Game.levelTime = 80; Game.kills = 1; Game.startIntermission(); });
    const rec2 = await page.evaluate(() => Game.levelRecord('e1m2', 2));
    check(rec2.time === 80 && rec2.kills === 3, 'рекорд обновлён неверно: ' + JSON.stringify(rec2));
    await page.evaluate(() => { Game.interT = 2; });
    await frames(page, 2);
    await page.evaluate(() => Game.toMenu());
    await frames(page, 2);
    const first = await page.evaluate(() => Menu.items()[0].label);
    check(first.startsWith('Продолжить: E1M3'), 'в меню нет «Продолжить»: ' + first);
    await press(page, 'Enter');
    const cont = await page.evaluate(() => ({ state: Game.state, id: Game.levelDef.id, skill: Game.skill }));
    check(cont.state === 'playing' && cont.id === 'e1m3' && cont.skill === 2, '«Продолжить» загрузил не то: ' + JSON.stringify(cont));
    noPageErrors(page);
    await ctx.close();
    return 'K вместо пробела, стик, A, Start, сохранение и рекорды';
  },
};
