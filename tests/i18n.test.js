'use strict';
// Английский язык:
// • первый запуск берёт язык браузера, ?lang= в адресе и пункт «Язык» в настройках
//   переключают его и запоминают выбор;
// • у каждой русской строки кода есть перевод, составные строки (счётчики, клавиши,
//   рекорды) переводятся целиком;
// • в английском режиме на экране нет ни одной русской буквы: все меню, каждый уровень
//   с подсказками и табличками боссов, карта, пауза, гибель, итоги уровня и финалы;
// • английский текст не вылезает за край экрана.
const { openGame, check, noPageErrors, ROOT, fs, path } = require('./lib');

// Русские строки кода, которые на экран сами не выходят: куски составных фраз
// (их целиком проверяют SAMPLES и обход экранов) и отладочная панель (` в игре).
const PARTS = new Set([
  'Кристалл разбит! Осталось: ', 'Руна зажжена: ', '\nДревний призывает стражу!', 'Сложность: ',
  'вернуться к контрольной точке', 'начать заново', 'Коснитесь экрана, чтобы ', 'Нажмите огонь, чтобы ',
  '  рекорд!', '  (рекорд ', 'Секретный уровень!\n',
  'барьер, руны ', 'щит, кристаллов: ', 'электроды ', 'кровь для телепорта ',
  'Рюкзак: ', 'Вы получили ', ' ед. здоровья', ' броню', 'зелёную', 'жёлтую', 'красную',
  'Он отмечен на карте (',
  'Звуки: ', 'Музыка: ', 'Яркость: ', 'Тряска экрана: ', 'Передний план: ', 'Язык: ', 'Русский',
  '  (секрет)', 'Лучшее время ', 'Нажмите новую клавишу для «', '» (Esc — отмена)', 'Клавиша ',
  ' занята: пауза и выбор оружия', 'ЛКМ, ', '1–8, колесо, ',
  // отладка и сообщения разработчику
  'неуязвима', 'ОШИБКА: на уровне должен быть босс, а его нет', 'электроды: ', ' (есть секретный)', ': нет цвета для «',
]);

// Строковые литералы с кириллицей в js/ (без словаря и комментариев).
function literals() {
  const out = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (!f.endsWith('.js') || f === 'lang-en.js' || f === 'i18n.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    for (let i = 0; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
      if (c !== "'" && c !== '"' && c !== '`') continue;
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const raw = src.slice(i + 1, j);
      i = j;
      if (!/[А-Яа-яЁё]/.test(raw) || raw.includes('${')) continue;
      const s = c === '`' ? raw : JSON.parse('"' + raw.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
      if (!PARTS.has(s)) out.add(s);
    }
  }
  return [...out];
}

// Составные строки в том виде, в каком их собирает игра, и что должно получиться.
const SAMPLES = [
  ['Кристалл разбит! Осталось: 2', 'Crystal shattered! 2 left'],
  ['Руна зажжена: 3/4', 'Rune lit: 3/4'],
  ['Сложность: Кошмар', 'Difficulty: Nightmare'],
  ['Нажмите огонь, чтобы вернуться к контрольной точке', 'Press fire to return to the checkpoint'],
  ['Коснитесь экрана, чтобы начать заново', 'Tap the screen to start over'],
  ['1:05  рекорд!', '1:05  record!'],
  ['3 / 10  (рекорд 5)', '3 / 10  (record 5)'],
  ['Волна 2 отбита!', 'Wave 2 repelled!'],
  ['Волна 3 из 5', 'Wave 3 of 5'],
  ['Кровь отродий питает телепорт: 4/12', 'Spawn blood feeds the teleporter: 4/12'],
  ['E1M8: Тёмная сторона', 'E1M8: The Dark Side'],
  ['Убито 3/10   Секреты 1/2   Время 1:05   Нормальный', 'Kills 3/10   Secrets 1/2   Time 1:05   Normal'],
  ['Tab — карта (N — закрепить)', 'Tab — map (N — pin)'],
  ['ХТОН, ВЛАДЫКА ЛАВЫ  ·  электроды 1/2', 'CHTHON, LORD OF LAVA  ·  electrodes 1/2'],
  ['ДРЕВНИЙ  ·  барьер, руны 2/4', 'THE ELDER  ·  barrier, runes 2/4'],
  ['ВЕСТНИК БЕЗДНЫ  ·  щит, кристаллов: 3', 'HERALD OF THE ABYSS  ·  shield, crystals: 3'],
  ['ШУБ-НИГГУРАТ  ·  кровь для телепорта 2/9', 'SHUB-NIGGURATH  ·  blood for the teleporter 2/9'],
  ['ДВУСТВОЛКА', 'SUPER SHOTGUN'],
  ['Рюкзак: 20 патроны, 5 ракеты', 'Backpack: 20 shells, 5 rockets'],
  ['Вы получили 25 ед. здоровья', 'You got 25 health'],
  ['Вы получили жёлтую броню', 'You got the Yellow Armor'],
  ['Вы получили гвозди', 'You got nails'],
  ['Нужен золотой ключ', 'You need the gold key'],
  ['Он отмечен на карте (Tab)', 'It’s marked on the map (Tab)'],
  ['Звуки: 70%', 'Sound: 70%'],
  ['Тряска экрана: выкл', 'Screen shake: off'],
  ['Язык: English', 'Language: English'],
  ['Продолжить: E2M3, кошмар', 'Continue: E2M3, nightmare'],
  ['Эпизод 4: Измерение Древних', 'Episode 4: Dimension of the Elders'],
  ['ЭПИЗОД 2: ЦАРСТВО ЧЁРНОЙ МАГИИ', 'EPISODE 2: REALM OF BLACK MAGIC'],
  ['E1M8  Тёмная сторона  (секрет)', 'E1M8  The Dark Side  (secret)'],
  ['Лучшее время 2:41', 'Best time 2:41'],
  ['Рекорд: 2:41 · убито 30/31 · тайники 2/3', 'Record: 2:41 · kills 30/31 · secrets 2/3'],
  ['Нажмите новую клавишу для «Прыжок, всплытие» (Esc — отмена)', 'Press a new key for “Jump, swim up” (Esc to cancel)'],
  ['Клавиша 3 занята: пауза и выбор оружия', 'Key 3 is reserved: pause and weapon select'],
  ['Прыжок, всплытие: Пробел, W, ↑', 'Jump, swim up: Space, W, ↑'],
  ['ЛКМ, Ctrl, J', 'LMB, Ctrl, J'],
  ['1–8, колесо, Q / E', '1–8, wheel, Q / E'],
  ['E3M2 Затонувший храм', 'E3M2 Sunken Temple'],
];

module.exports = {
  name: 'английский язык',
  async run(browser) {
    // 1. язык браузера и выбор в адресе
    const ruCtx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const ru = await openGame(browser, { context: ruCtx, query: '' });
    const ruLang = await ru.evaluate(() => I18N.lang);
    await ruCtx.close();
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 960, height: 540 } });
    let page = await openGame(browser, { context: ctx });
    const enLang = await page.evaluate(() => [I18N.lang, document.documentElement.lang, document.getElementById('game').getAttribute('aria-label')]);
    check(ruLang === 'ru', 'русский браузер — игра не на русском: ' + ruLang);
    check(enLang[0] === 'en' && enLang[1] === 'en' && !/[А-Яа-яЁё]/.test(enLang[2]), 'английский браузер — игра не на английском: ' + enLang.join(' | '));

    // 2. переключатель в настройках запоминает выбор и перебивает язык браузера
    const toggle = async () => page.evaluate(() => {
      Menu.reset('main');
      Menu.open('options');
      const items = Menu.items();
      const i = items.findIndex((it) => it.label.startsWith('Язык: '));
      Menu.activate(items[i]);
      return [i, items.length, I18N.lang, Store.get('lang'), Menu.items()[i].label];
    });
    const t1 = await toggle();
    check(t1[0] === t1[1] - 2, 'пункт «Язык» должен стоять перед «Назад»: ' + t1.join(' | '));
    check(t1[2] === 'ru' && t1[3] === 'ru' && t1[4] === 'Язык: Русский', 'переключатель не включил русский: ' + t1.join(' | '));
    await page.reload();
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
    const kept = await page.evaluate(() => I18N.lang);
    check(kept === 'ru', 'выбранный язык не сохранился после перезагрузки: ' + kept);
    const t2 = await toggle();
    check(t2[2] === 'en' && t2[3] === 'en' && t2[4] === 'Язык: English', 'переключатель не вернул английский: ' + t2.join(' | '));
    await page.goto(page.url().split('?')[0] + '?lang=ru');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
    const byUrl = await page.evaluate(() => [I18N.lang, Store.get('lang')]);
    check(byUrl[0] === 'ru' && byUrl[1] === 'ru', '?lang=ru не включил русский: ' + byUrl.join(' | '));
    await page.close();
    page = await openGame(browser, { context: ctx, query: '?lang=en' });

    // 3. перевод каждой строки кода и составных строк
    const strings = literals();
    const tr = await page.evaluate(([strings, samples]) => {
      const cyr = /[А-Яа-яЁё]/;
      return {
        missing: strings.filter((s) => cyr.test(I18N.t(s))),
        wrong: samples.filter(([ru, en]) => I18N.t(ru) !== en).map(([ru, en]) => `${ru} → ${I18N.t(ru)} (ждали ${en})`),
      };
    }, [strings, SAMPLES]);
    check(!tr.missing.length, `нет перевода у ${tr.missing.length} строк:\n` + tr.missing.slice(0, 20).join('\n'));
    check(!tr.wrong.length, 'составные строки переведены не так:\n' + tr.wrong.join('\n'));

    // 4. обход экранов: русских букв нет, текст в пределах экрана
    const r = await page.evaluate(() => {
      const seen = new Map(), wide = new Map();
      let where = '';
      const P = CanvasRenderingContext2D.prototype;
      for (const fn of ['fillText', 'strokeText']) {
        const orig = P[fn];
        P[fn] = function (text, x, y, ...rest) {
          const s = String(text);
          if (/[А-Яа-яЁё]/.test(s) && !seen.has(s)) seen.set(s, where);
          // ширину считаем для шрифта интерфейса: у Press Start 2P каждая буква шириной в кегль,
          // даже если сам шрифт в тестах не загрузился (заголовки Ruslan Display сами ужимаются)
          if (this.canvas === Game.canvas && this.font.includes('px "Press Start 2P"')) {
            const m = this.getTransform();
            const w = [...s].length * parseFloat(this.font);
            const left = this.textAlign === 'center' ? x - w / 2 : this.textAlign === 'right' || this.textAlign === 'end' ? x - w : x;
            const W = this.canvas.width;
            // надписи в мире (таблички стартового зала) могут уходить за край вместе с камерой
            if (m.isIdentity && x >= 0 && x <= W && (left < -1 || left + w > W + 1) && !wide.has(s)) wide.set(s, `${where}: ${Math.round(w)} из ${W}`);
          }
          return orig.call(this, text, x, y, ...rest);
        };
      }
      const frame = (name, n = 1) => { where = name; for (let i = 0; i < n; i++) Game.render(); };
      const menu = (screen, name) => {
        Menu.reset(screen);
        const n = Menu.items().length;
        for (let i = 0; i < n; i++) { Menu.sel = i; frame(name || screen); }
      };

      // меню со всеми пометками: сохранение, рекорды, секретные уровни, обновление приложения
      const saved = {};
      const stub = { savedGame: () => ({ id: 'e2m3', skill: 3 }), bestRecord: () => ({ time: 161 }), levelRecord: () => ({ time: 161, kills: 30, totalKills: 31, secrets: 2, totalSecrets: 3 }), secretFound: () => true, levelUnlocked: () => true };
      for (const k in stub) { saved[k] = Game[k]; Game[k] = stub[k]; }
      const appSaved = [App.updated, App.canInstall];
      App.updated = true; App.canInstall = () => true;
      Game.state = 'menu';
      for (const s of ['main', 'options', 'keys', 'episodes', 'levelEp', 'help']) menu(s);
      for (const ep of EPISODES) { Menu.pendingEpisode = ep.id; menu('levels', 'levels ' + ep.id); }
      Menu.pendingLevel = 'e1m1'; menu('skill');
      // клавиши: ожидание, отмена, занятая клавиша, новая клавиша, сброс
      Menu.reset('keys');
      Menu.startCapture(KEY_ACTIONS[2]); frame('keys capture');
      Input.capture(null); frame('keys cancel');
      Menu.startCapture(KEY_ACTIONS[2]); Input.capture('Digit3'); frame('keys reserved');
      Menu.startCapture(KEY_ACTIONS[2]); Input.capture('ControlRight'); frame('keys rebind');
      Input.resetBinds(); Menu.flash('Клавиши сброшены'); frame('keys reset');
      for (const k in saved) Game[k] = saved[k];
      [App.updated, App.canInstall] = appSaved;

      // каждый уровень: вступление и подсказки, строка состояния, карта, пауза, табличка босса
      for (const def of LEVELS) {
        Game.startFromSelect(def.id, 1);
        Game.god = true;
        const p = Game.player;
        for (let w = 1; w <= 9; w++) p.weapons[w] = true;
        for (let i = 0; i < 40; i++) { Game.update(1 / 60); if (i % 8 === 0) frame(def.id); }
        HUD.message('Вы получили ' + 25 + ' ед. здоровья');
        HUD.center('Нужен серебряный ключ\nОн отмечен на карте (Tab)', 2);
        frame(def.id + ' hud');
        Game.showStats = true; frame(def.id + ' map'); Game.showStats = false;
        if (Game.monsters.some((m) => m.def.boss && BOSS_CARDS[m.type])) {
          Game.startBossIntro();
          for (let i = 0; i < 150 && Game.cine; i++) { Game.update(1 / 60); if (i % 10 === 0) frame(def.id + ' boss'); }
          for (let i = 0; i < 30; i++) { Game.update(1 / 60); if (i % 10 === 0) frame(def.id + ' boss bar'); }
        }
      }
      Game.pause(); for (const s of ['pause', 'options', 'help']) menu(s, 'pause ' + s); Menu.reset('pause'); Game.resume();
      // сенсорное управление и подсказки на телефоне
      Input.touchMode = true; frame('touch'); Input.touchMode = false;

      // гибель от каждого монстра и от всего остального
      const p = Game.player;
      const deaths = Object.keys(OBITS).map((type) => [{ isMonster: true, type }, '']);
      deaths.push([null, ''], [p, 'discharge'], [p, ''], [null, 'lava'], [null, 'slime'], [null, 'drown'], [null, 'fall'], [null, 'explosion'], [null, 'crush'], [null, 'void']);
      for (const [att, kind] of deaths) {
        Game.onPlayerDeath(att, kind);
        p.alive = false; p.deadT = 2;
        Game.checkpoint = null; frame('death ' + kind);
        Input.touchMode = true; frame('death touch'); Input.touchMode = false;
      }
      p.alive = true;

      // итоги уровня с рекордами и секретным выходом
      Game.startIntermission();
      Game.god = false; Game.interT = 5; Game.secretExit = true;
      Game.prevRecord = { time: 9999, kills: 0, secrets: 0 }; frame('intermission record');
      Game.prevRecord = { time: 1, kills: 99, secrets: 99 }; frame('intermission old');
      Input.touchMode = true; frame('intermission touch'); Input.touchMode = false;

      // финалы эпизодов целиком
      for (const key of Object.keys(FINALES)) { Game.startFinale(key); Game.finaleT = 120; frame('finale ' + key, 2); }
      return { cyr: [...seen].map(([s, w]) => `${w}: ${s}`), wide: [...wide].map(([s, w]) => `${w}: ${s}`), levels: LEVELS.length };
    });
    check(!r.cyr.length, `на экране русский текст (${r.cyr.length}):\n` + r.cyr.slice(0, 25).join('\n'));
    check(!r.wide.length, `текст шире экрана (${r.wide.length}):\n` + r.wide.slice(0, 25).join('\n'));
    noPageErrors(page);
    await ctx.close();
    return `строк кода: ${strings.length}, составных: ${SAMPLES.length}, уровней: ${r.levels}`;
  },
};
