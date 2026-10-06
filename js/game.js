'use strict';
// Главный модуль: цикл, загрузка уровней, камера, свет, триггеры, смерть, антракт, финал.

// Табличка босса при его появлении: имя, титул, цвета букв и черты под ними.
const BOSS_CARDS = {
  // death — длина сцены гибели (игровые секунды): Хтона убивают разрядом издалека,
  // и без сцены герой слышал бы его гибель, но не видел
  chthon: { name: 'ХТОН', sub: 'Владыка Лавы', cols: ['#fff0c0', '#ff9a30', '#8a2a10'], line: '#ffb040', subCol: '#f0c090', dur: 4.4, death: 5.4, deathAt: 3.6 },
  shub: { name: 'ШУБ-НИГГУРАТ', sub: 'Мать Тысячи Отродий', cols: ['#ffe0f0', '#d070a0', '#5a1a3a'], line: '#e080b0', subCol: '#e0b0c8', dur: 4.2 },
  herald: { name: 'ВЕСТНИК БЕЗДНЫ', sub: 'Глас Нижнего мира', cols: ['#fff0ff', '#d080ff', '#5a2a8a'], line: '#d080ff', subCol: '#d8b8f0', dur: 4.2 },
  elder: { name: 'ДРЕВНИЙ', sub: 'Пожиратель Измерений', cols: ['#e8fbff', '#70d8ff', '#2a6a9a'], line: '#70d8ff', subCol: '#a8d8f0', dur: 4 },
};

const OBITS = {
  grunt: 'Вас застрелил солдат', dog: 'Вас загрыз пёс', enforcer: 'Вас поджарил каратель',
  knight: 'Вас зарубил рыцарь', hknight: 'Вас сжёг рыцарь смерти', ogre: 'Вас распилил огр',
  zombie: 'Вас закидал плотью зомби', fiend: 'Вас растерзал изверг', scrag: 'Вас оплевал скраг',
  vore: 'Вас уничтожил ворог', spawn: 'Вас сожрало порождение', shambler: 'Вас испепелил шамблер',
  chthon: 'Вас испепелил Хтон', gargoyle: 'Вас растерзала гаргулья', shub: 'Вас поглотила Шуб-Ниггурат',
  scorpion: 'Вас изрешетил скорпион', eel: 'Вас ударил током угорь', herald: 'Вас испепелил Вестник Бездны',
  phantom: 'Вас настиг фантом', guardian: 'Вас сокрушил страж', elder: 'Вас стёр из бытия Древний',
};
const FINALES = {
  e1: [
    'Туша Хтона погружается обратно в лаву,',
    'из которой он поднялся. Земля затихает.',
    '',
    'На остывающем камне лежит древняя руна.',
    'Вы сжимаете её — и чувствуете, как',
    'по жилам течёт чужая, первобытная сила.',
    '',
    'Руна раскрывает новый слипгейт. За ним —',
    'Царство Чёрной Магии, где ждёт та,',
    'что породила Хтона.',
    '',
    'Эпизод 1 пройден. Впереди — Эпизод 2.',
  ],
  e2: [
    'Телепорт вышвыривает вас прямо в её чрево,',
    'и Шуб-Ниггурат рвётся изнутри, как гнилой плод.',
    '',
    'Щупальца опадают. Глаза гаснут один за другим.',
    'Вторая руна тёплая, как живое сердце.',
    '',
    'Но руна раскрывает путь ещё глубже —',
    'в Нижний мир, откуда приходят все кошмары.',
    'Пока руны не собраны вместе,',
    'тьма лишь затаилась.',
    '',
    'Эпизод 2 пройден. Впереди — Эпизод 3.',
  ],
  e3: [
    'Вестник Бездны рассыпается пеплом,',
    'и эхо его крика ещё долго гуляет по сводам.',
    '',
    'Трон Бездны пуст. Кристаллы погасли.',
    'Третья руна холодна, как дно колодца,',
    'но в ней бьётся тот же древний пульс.',
    '',
    'Три руны из четырёх. Где-то за последним',
    'слипгейтом ждёт тот, кто их выковал.',
    '',
    'Эпизод 3 пройден. Впереди — Эпизод 4.',
  ],
  e4: [
    'Древний распадается на осколки звёзд,',
    'и Кузня Рун затихает впервые за вечность.',
    '',
    'Четвёртая руна ложится в ладонь рядом',
    'с тремя другими — и все четыре вспыхивают',
    'одним холодным белым светом.',
    '',
    'Слипгейты гаснут один за другим.',
    'Больше никто не придёт из-за них.',
    'Вы возвращаетесь домой — последним.',
    '',
    'Сага SLIPGATE завершена. Спасибо за игру!',
  ],
};

const Game = {
  state: 'boot',
  level: null,
  levelDef: null,
  player: null,
  monsters: [],
  items: [],
  projectiles: [],
  timers: [],
  skill: 1,
  time: 0,
  levelTime: 0,
  kills: 0, totalKills: 0, secrets: 0, totalSecrets: 0,
  cam: { x: 0, y: 0 },
  shakeAmt: 0, kickAmt: 0, kickX: 0, kickY: 0,
  shakeOn: Store.get('shake', true),
  fgOn: Store.get('fg', true),
  brightness: clamp(Store.get('brightness', 1), 0.5, 1.6),
  damageFlash: 0, bonusFlash: 0,
  bossFx: 0, bossHintShown: false,
  god: false,
  startInv: null,
  trail: [],               // след героя: точки, где он стоял (по ним монстры ищут обход)
  attract: false,
  deathMsg: '',
  interT: 0,
  finaleT: 0,
  showStats: false,
  acc: 0, last: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = makeCanvas(480, 270);
    this.wctx = this.world.getContext('2d');
    this.light = makeCanvas(480, 270);
    this.lctx = this.light.getContext('2d');
    Tex.initLiquids();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    const params = new URLSearchParams(location.search);
    if (params.has('god')) this.god = true;
    if (params.has('debug')) this.debugOn = true;
    const map = params.get('map');
    if (map && LEVELS.find((l) => l.id === map)) {
      this.startFromSelect(map, +(params.get('skill') || 1));
    } else this.toMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(200, rect.width || window.innerWidth), cssH = Math.max(150, rect.height || window.innerHeight);
    this.cssW = this.canvas.clientWidth; this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const s = Math.min(cssW / 560, cssH / 315);
    const vw = Math.min(Math.ceil(cssW / s), 820);
    const vh = Math.min(Math.ceil(cssH / s), 620);
    this.viewW = vw; this.viewH = vh;
    this.scale = s * dpr;
    this.offX = Math.round((this.canvas.width - vw * this.scale) / 2);
    this.offY = Math.round((this.canvas.height - vh * this.scale) / 2);
    this.world.width = vw; this.world.height = vh;
    this.light.width = vw; this.light.height = vh;
    this.u = Math.max(0.8, Math.min(this.canvas.width / 540, this.canvas.height / 300));
    this.safe = this.safeInsets(this.canvas.width / cssW);
    HUD.layoutTouch(this.canvas.width, this.canvas.height, this.u);
  },

  // Вырезы экрана — «чёлка», Dynamic Island, полоска «Домой» — в пикселях холста.
  // Картинка идёт на весь экран, а кнопки, стики и надписи держатся внутри безопасной зоны.
  safeInsets(k) {
    if (!this.safeProbe) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(d);
      this.safeProbe = d;
    }
    const cs = getComputedStyle(this.safeProbe);
    const v = (s) => Math.round((parseFloat(s) || 0) * k);
    return { t: v(cs.paddingTop), r: v(cs.paddingRight), b: v(cs.paddingBottom), l: v(cs.paddingLeft) };
  },

  // Яркость: выше 100% поднимает тени (как гамма в Quake), ниже — приглушает свет.
  setBrightness(v) {
    this.brightness = clamp(Math.round(v * 10) / 10, 0.5, 1.6);
    Store.set('brightness', this.brightness);
  },

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else {
        // на телефоне заодно фиксируем горизонтальную ориентацию
        document.documentElement.requestFullscreen()
          .then(() => (screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null))
          .catch(() => {});
      }
    } catch (e) { /* полноэкранный режим недоступен */ }
  },

  loop(now) {
    // размер холста сверяем каждый кадр: iPhone при повороте шлёт resize раньше, чем
    // пересчитает раскладку, — картинка оставалась сжатой, а касания попадали мимо кнопок
    if (this.canvas.clientWidth !== this.cssW || this.canvas.clientHeight !== this.cssH) this.resize();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 6) { this.update(step); this.acc -= step; n++; }
    if (n === 6) this.acc = 0;
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  },

  // --- смена состояний ---
  toMenu() {
    this.state = 'menu';
    Menu.reset('main');
    this.loadLevel(Store.get('done', {}).e1m6 && Math.random() < 0.5 ? 'e2m1' : 'e1m1', { attract: true });
    Music.start(41, 'menu');
  },

  newGame(episode = 1) {
    this.skill = 1;
    this.newEpisode = episode;
    this.loadLevel('start', { inv: null });
    this.state = 'playing';
  },

  levelUnlocked(def) {
    if (def.secret) return this.secretFound(def.id);
    const eps = LEVELS.filter((l) => l.episode === def.episode && !l.secret);
    const i = eps.indexOf(def);
    if (i <= 0) return true;
    if (Store.get('done', {})[eps[i - 1].id]) return true;
    return def.episode === 1 && i < Store.get('unlocked', 1);
  },

  // Секретный уровень открыт в меню, если в него хоть раз попали.
  secretFound(id) { return !!Store.get('found', {})[id] || !!Store.get('done', {})[id]; },

  // Снаряжение, которое герой уносит с уровня: на уровне «только топор» отнятое
  // оружие возвращается.
  carryInventory() {
    const inv = this.player.inventory();
    if (this.stash) inv.weapons = Object.assign({}, this.stash, inv.weapons);
    return inv;
  },

  // Стартовый набор уровня: с ним уровень начинают из меню и с него начинается эпизод.
  kitInventory(def) {
    const p = new Player(0, 0);
    if (def.kit) {
      for (const n of def.kit.weapons) p.weapons[n] = true;
      Object.assign(p.ammo, def.kit.ammo);
      p.weapon = p.bestWeapon();
      if (def.kit.armor) { p.armor = def.kit.armor; p.armorType = 0.3; }
    }
    return p.inventory();
  },

  // Сохранение «Продолжить»: уровень эпизода и снаряжение, с которым в него вошли.
  savedGame() {
    const s = Store.get('save', null);
    return s && LEVELS.find((l) => l.id === s.id && l.episode) && s.inv ? s : null;
  },

  saveProgress(id, inv) {
    Store.set('save', { id, skill: this.skill, inv });
  },

  continueGame() {
    const s = this.savedGame();
    if (!s) return;
    this.skill = clamp(s.skill | 0, 0, 3);
    this.newEpisode = LEVELS.find((l) => l.id === s.id).episode;
    this.loadLevel(s.id, { inv: s.inv });
    this.state = 'playing';
  },

  // Рекорды уровня для сложности: лучшее время, больше всего убитых и найденных тайников.
  records: null,
  levelRecord(id, skill) {
    if (!this.records) this.records = Store.get('records', {});
    const all = this.records;
    return (all[id] && all[id][skill]) || null;
  },

  bestRecord(id) {
    let best = null;
    for (let s = 0; s < 4; s++) {
      const r = this.levelRecord(id, s);
      if (r && (!best || r.time < best.time)) best = r;
    }
    return best;
  },

  saveRecord() {
    const id = this.levelDef.id;
    const old = this.levelRecord(id, this.skill);
    const all = this.records;
    const rec = {
      time: old ? Math.min(old.time, this.levelTime) : this.levelTime,
      kills: old ? Math.max(old.kills, this.kills) : this.kills,
      secrets: old ? Math.max(old.secrets, this.secrets) : this.secrets,
      totalKills: this.totalKills, totalSecrets: this.totalSecrets,
    };
    this.prevRecord = old;
    (all[id] = all[id] || {})[this.skill] = rec;
    Store.set('records', all);
  },

  startFromSelect(id, skill) {
    this.skill = clamp(skill, 0, 3);
    const def = LEVELS.find((l) => l.id === id);
    this.loadLevel(id, { inv: this.kitInventory(def) });
    this.state = 'playing';
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Menu.reset('pause');
  },
  resume() { this.state = 'playing'; Input.mouseDown = false; },

  restartLevel() {
    this.loadLevel(this.levelDef.id, { inv: this.startInv });
    this.state = 'playing';
  },

  loadLevel(id, opts = {}) {
    const def = LEVELS.find((l) => l.id === id);
    this.levelDef = def;
    this.level = new Level(def);
    this.level.bake();
    Ambient.setLevel(this.level);
    this.roomT = 0;
    this.monsters = []; this.items = []; this.projectiles = []; this.timers = [];
    FX.clear();
    HUD.reset();
    this.kills = 0; this.totalKills = 0; this.secrets = 0;
    this.totalSecrets = this.level.totalSecrets;
    this.levelTime = 0;
    this.damageFlash = 0; this.bonusFlash = 0; this.bossFx = 0; this.bossHintShown = false;
    this.checkpoint = null;
    this.traps = (def.traps || []).map((t) => ({ at: t.at, spawn: t.spawn, msg: t.msg, fired: false }));
    for (const t of this.traps) t.spawn.forEach(([,, ch], i) => { if (this.trapSpawns(ch, i)) this.totalKills++; });
    for (const w of def.waves ? def.waves.list : []) this.totalKills += w.spawn.length;
    this.mapOpen = false;
    this.revealT = 0;
    this.trail = [];
    this.exitHint = false;
    this.secretExit = false;
    GRAVITY = BASE_GRAVITY * (def.gravity || 1);
    // арена волн: волны идут одна за другой, выход появляется после последней
    this.waves = def.waves ? { i: -1, t: 0, started: false, done: false, cleared: -1 } : null;
    this.cine = null; this.introDone = false; this.slowT = 0; this.whiteFlash = 0; this.hitstop = 0;
    this.attract = !!opts.attract;
    let start = { cx: 40, bottom: 40 };
    for (const s of this.level.spawns) {
      const cx = s.tx * TILE + 8, bottom = (s.ty + 1) * TILE;
      if (s.ch === 'P') start = { cx, bottom };
      else if (MONSTER_CHARS[s.ch]) {
        const type = MONSTER_CHARS[s.ch];
        // на лёгком — около трети обычных монстров меньше; боссов и кристаллы щита не трогаем
        const md = MONSTER_DEFS[type];
        if (this.skill === 0 && !md.boss && !md.static && hash2(s.tx, s.ty, 7) < 0.3) continue;
        this.monsters.push(new Monster(type, cx, bottom));
        if (!MONSTER_DEFS[type].static) this.totalKills++;
      } else if (ITEM_CHARS.includes(s.ch)) this.items.push(new Item(s.ch, cx, bottom));
    }
    if (def.exitAfterBoss && !def.waves && !this.monsters.some((m) => m.def.boss)) {
      // такого быть не должно: без босса выход не откроется — открываем его сразу
      console.error(`${id}: на уровне нет босса, выход открыт без боя`);
      this.level.exits.forEach((e) => { e.hidden = false; });
    }
    if (def.bossIntro) for (const m of this.monsters) if (m.def.boss && BOSS_CARDS[m.type]) m.bossDormant();
    // лава, которая поднимается на арене Хтона
    this.flood = def.flood ? { x0: def.flood[0] * TILE, x1: (def.flood[1] + 1) * TILE, base: def.flood[2] * TILE, h: 0, max: 0, st: 'off', t: 0, hurtT: 0, on: false } : null;
    this.strikes = [];
    // телепорт в чрево Шуб-Ниггурат спит, пока его не напитает кровь её отродий
    this.shubGate = null;
    if (this.monsters.some((m) => m.type === 'shub')) {
      this.shubGate = { need: [4, 6, 7, 8][this.skill] || 6, have: 0, open: false };
      for (const tp of this.level.teleports) tp.sealed = true;
    }
    if (this.attract) {
      this.player = null;
      this.cam.x = 0;
      this.cam.y = clamp(start.bottom - this.viewH / 2, 0, Math.max(0, this.level.pxH - this.viewH));
      return;
    }
    const p = new Player(start.cx, start.bottom);
    // на уровне «только топор» остальное оружие убирается до выхода с уровня
    this.stash = null;
    if (opts.inv && def.axeOnly) {
      const inv = Object.assign({}, opts.inv);
      this.stash = Object.assign({}, inv.stash || inv.weapons);
      inv.weapons = { 1: true }; inv.weapon = 1;
      delete inv.stash;
      opts = Object.assign({}, opts, { inv });
    }
    if (opts.inv) p.applyInventory(opts.inv);
    this.player = p;
    if (opts.inv && def.kit && !def.axeOnly) this.spawnSupplyCache(def, p, start);
    this.startInv = p.inventory();
    if (this.stash) this.startInv.stash = this.stash;
    if (def.episode) this.saveProgress(id, this.startInv);
    if (def.secret) { const f = Store.get('found', {}); f[id] = true; Store.set('found', f); }
    this.snapCamera();
    if (def.secret) HUD.center('Секретный уровень!\n' + def.name + ': ' + def.title + (def.hint ? '\n' + def.hint : ''), 5);
    else if (def.episode) HUD.center(def.name + ': ' + def.title, 3);
    else if (def.intro) HUD.center(def.intro, 5);
    Music.start(def.music || 55, this.musicStyle());
  },

  // Тайник снабжения у входа — только оружие из стартового набора уровня, которое
  // герой где-то пропустил (без него дальше не пройти). Патроны у входа не кладём:
  // их хватает на карте, а если не осталось совсем — тихо пополняем до минимума.
  spawnSupplyCache(def, p, start) {
    p.ensureAmmoReserve();
    const want = [];
    for (const n of def.kit.weapons) if (n >= 3 && !p.weapons[n]) want.push(String(n));
    if (!want.length) return;
    const lv = this.level;
    const tx0 = Math.floor(start.cx / TILE), ty = Math.floor((start.bottom - 1) / TILE);
    const free = (tx, y) => !lv.tileSolid(tx, y) && !lv.liquidAt(tx * TILE + 8, y * TILE + 8) && !lv.tileSolid(tx, y - 1);
    const floor = (tx) => lv.tileSolid(tx, ty + 1) || lv.tile(tx, ty + 1) === T.PLAT;
    // по закрытому люку пройти можно, но класть на него припасы нельзя
    const walk = (tx) => free(tx, ty) && !lv.solidAt(tx * TILE + 8, ty * TILE + 8) && (floor(tx) || lv.solidAt(tx * TILE + 8, (ty + 1) * TILE + 4));
    const taken = (x) => this.items.some((it) => Math.abs(it.cx - x) < 12 && Math.abs(it.y + it.h - (ty + 1) * TILE) < 20);
    const spots = [];
    for (const dir of [1, -1]) {
      for (let tx = tx0 + dir; Math.abs(tx - tx0) <= 30 && walk(tx); tx += dir) {
        if (Math.abs(tx - tx0) >= 2 && floor(tx) && !taken(tx * TILE + 8) && !spots.some((s) => Math.abs(s - tx) < 2)) spots.push(tx);
      }
    }
    spots.sort((a, b) => Math.abs(a - tx0) - Math.abs(b - tx0) || b - a);
    if (!spots.length) spots.push(tx0);
    // не хватило места — по два предмета на клетку
    want.forEach((ch, i) => {
      const tx = spots[i % spots.length], shift = i >= spots.length ? 5 : 0;
      this.items.push(new Item(ch, tx * TILE + 8 + shift, (ty + 1) * TILE));
    });
    this.later(1.2, () => HUD.message('У входа тайник: оружие, которое вы пропустили раньше'));
  },

  nextLevel() {
    const def = this.levelDef;
    if (def.finale && !this.finaleDone) { this.startFinale(def.finale); return; }
    this.finaleDone = false;
    const next = this.secretExit ? def.secretNext : def.next;
    if (!next) { this.toMenu(); return; }
    const inv = this.carryInventory();
    inv.health = clamp(inv.health, 50, 100);
    this.loadLevel(next, { inv });
    this.state = 'playing';
  },

  startIntermission() {
    this.state = 'intermission';
    this.interT = 0;
    const done = Store.get('done', {});
    done[this.levelDef.id] = true;
    Store.set('done', done);
    this.prevRecord = null;
    if (!this.god) this.saveRecord();
    // «Продолжить» ведёт уже на следующий уровень; после последнего сохранять нечего
    const def = this.levelDef;
    const next = this.secretExit ? def.secretNext : def.next;
    if (next) {
      const inv = this.carryInventory();
      inv.health = clamp(inv.health, 50, 100);
      this.saveProgress(next, inv);
    } else Store.set('save', null);
    Sound.play('secret');
  },

  startFinale(key) {
    this.state = 'finale';
    this.finaleKey = key;
    this.finaleT = 0;
    Music.start(36, 'finale');
  },

  onPlayerDeath(attacker, kind) {
    let msg = 'Вы погибли';
    if (attacker && attacker.isMonster) msg = OBITS[attacker.type] || msg;
    else if (attacker && attacker.isPlayer) msg = kind === 'discharge' ? 'Вы разрядили молнию в воде' : 'Вы подорвали себя';
    else if (kind === 'lava') msg = 'Вы сгорели в лаве';
    else if (kind === 'slime') msg = 'Вы растворились в слизи';
    else if (kind === 'drown') msg = 'Вы утонули';
    else if (kind === 'fall') msg = 'Вы разбились';
    else if (kind === 'explosion') msg = 'Вас разорвало взрывом';
    else if (kind === 'crush') msg = 'Вас расплющило давилкой';
    else if (kind === 'void') msg = 'Вас поглотила пустота';
    this.deathMsg = msg;
    HUD.message(msg);
  },

  onPylonDestroyed() {
    const left = this.monsters.filter((m) => m.type === 'pylon' && m.alive).length;
    if (left > 0) HUD.center('Кристалл разбит! Осталось: ' + left, 2);
    else if (this.monsters.some((m) => m.type === 'herald' && m.alive)) {
      HUD.center('Щит Вестника пал!', 2.5);
      Sound.play('roar');
    }
  },

  // Засады: монстры телепортируются, когда герой входит в зону.
  // на лёгком каждый третий монстр засады не появляется
  trapSpawns(ch, i) { return !!MONSTER_CHARS[ch] && !(this.skill === 0 && i % 3 === 2); },

  updateTraps() {
    const p = this.player;
    if (!p || !p.alive) return;
    const tx = Math.floor(p.cx / TILE), ty = Math.floor((p.y + p.h - 1) / TILE);
    for (const t of this.traps) {
      if (t.fired) continue;
      const [x0, y0, x1, y1] = t.at;
      if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue;
      t.fired = true;
      t.spawn.forEach(([sx, sy, ch], i) => {
        if (!this.trapSpawns(ch, i)) return;
        this.later(i * 0.12, () => {
          const m = new Monster(MONSTER_CHARS[ch], sx * TILE + 8, (sy + 1) * TILE);
          this.monsters.push(m);
          m.alert(p, false);
          m.cd = Math.max(m.cd, 0.6);
          FX.teleport(m.cx, m.cy);
          Sound.play('teleport', m.cx, m.cy);
        });
      });
      if (t.msg) HUD.center(t.msg, 2);
    }
  },

  // Арена волн: вход на арену будит её; следующая волна — когда перебита прежняя,
  // после каждой волны телепортируются припасы, после последней открывается выход.
  updateWaves(dt) {
    const W = this.waves, p = this.player;
    if (!W || W.done || !p || !p.alive) return;
    const def = this.levelDef.waves;
    if (!W.started) {
      const tx = Math.floor(p.cx / TILE), ty = Math.floor((p.y + p.h - 1) / TILE);
      const [x0, y0, x1, y1] = def.at;
      if (tx < x0 || tx > x1 || ty < y0 || ty > y1) return;
      W.started = true; W.t = 2;
      HUD.center(def.msg || 'Арена пробудилась!', 3);
      Sound.play('roar');
      return;
    }
    if (W.i >= 0 && (W.pending > 0 || this.monsters.some((m) => m.wave === W.i && m.alive))) return;
    if (W.i >= 0 && W.cleared < W.i) {
      // волна отбита: припасы и передышка
      W.cleared = W.i; W.t = 3.5;
      const last = W.i + 1 >= def.list.length;
      if (!last) HUD.center(`Волна ${W.i + 1} отбита!`, 2);
      for (const [x, y, ch] of def.list[W.i].drop || []) {
        const it = new Item(ch, x * TILE + 8, (y + 1) * TILE);
        this.items.push(it);
        FX.teleport(it.cx, it.y);
      }
      if (def.list[W.i].drop) Sound.play('teleport', p.cx, p.cy, { vol: 0.5 });
      if (last) { W.done = true; this.onBossDefeated('Арена побеждена!\nСлипгейт открыт — он отмечен стрелкой'); return; }
    }
    W.t -= dt;
    if (W.t > 0) return;
    W.i++;
    const wave = def.list[W.i];
    // монстры волны «живы» с момента объявления, даже пока телепортируются
    W.pending = wave.spawn.length;
    wave.spawn.forEach(([sx, sy, ch], i) => {
      this.later(i * 0.15, () => {
        W.pending--;
        const m = new Monster(MONSTER_CHARS[ch], sx * TILE + 8, (sy + 1) * TILE);
        m.wave = W.i;
        this.monsters.push(m);
        m.alert(this.player, false);
        m.cd = Math.max(m.cd, 0.8);
        FX.teleport(m.cx, m.cy);
        Sound.play('teleport', m.cx, m.cy);
      });
    });
    HUD.center(`Волна ${W.i + 1} из ${def.list.length}` + (wave.msg ? '\n' + wave.msg : ''), 2.5);
  },

  onAltarLit(b) {
    const lit = this.level.buttons.filter((x) => x.lit).length;
    const total = this.level.buttons.length;
    FX.teleport(b.x + 6, b.y);
    Sound.play('secret', b.x, b.y);
    const boss = this.monsters.find((m) => m.type === 'elder' && m.alive);
    if (lit < total) {
      HUD.center('Руна зажжена: ' + lit + '/' + total + (boss ? '\nДревний призывает стражу!' : ''), 2.5);
      if (boss) boss.elderAltarLit(lit);
    } else {
      HUD.center('Барьер Древнего пал!\nТеперь его можно ранить — стреляйте!', 4);
      Sound.play('roar');
      this.shake(b.x, b.y, 10);
      this.whiteFlash = 0.7;
      if (boss) boss.elderBarrierDown();
    }
  },

  // Появление босса: камера уходит к нему, герой замирает, табличка с именем.
  startBossIntro() {
    this.introDone = true;
    const boss = this.monsters.find((m) => m.def.boss && m.alive && BOSS_CARDS[m.type]);
    if (!boss) return;
    this.cine = { t: 0, dur: BOSS_CARDS[boss.type].dur, boss };
    HUD.centerT = 0;
    boss.bossIntro();
  },

  // Гибель босса: время замедляется, вспышка, слуги рассыпаются.
  bossDeath(boss, attacker, text) {
    const card = BOSS_CARDS[boss.type];
    if (card && card.death) {
      // гибель как в кино: камера уходит к боссу, мир замирает, в конце — табличка
      this.cine = { t: 0, dur: card.death, boss, death: true, focus: { x: boss.cx, y: boss.cy } };
      HUD.centerT = 0;
      // снаряды босса гаснут — после сцены ничто не прилетит в героя
      this.projectiles = this.projectiles.filter((pr) => pr.owner !== boss);
    } else HUD.center(text, 3);
    Sound.play('roar');
    this.slowT = 2.4;
    this.whiteFlash = 0.5;
    this.shake(boss.cx, boss.cy, 14);
    this.strikes = [];
    if (this.flood) { this.flood.on = false; if (this.flood.st !== 'off') { this.flood.st = 'fall'; this.flood.t = 0; } }
    for (const m of this.monsters) if (m.minion && m.alive) applyDamage(m, 5000, attacker, 'telefrag');
  },

  // Последний миг босса: белая вспышка и кольцо искр.
  bossBurst(boss, col) {
    this.whiteFlash = 1;
    this.shake(boss.cx, boss.cy, 16);
    Sound.play('explode', boss.cx, boss.cy); Sound.play('roar');
    for (let i = 0; i < 40; i++) FX.add({ kind: 'spark', x: boss.cx, y: boss.cy, vx: Math.cos(i / 40 * TAU) * 320, vy: Math.sin(i / 40 * TAU) * 320, life: 1.2, max: 1.2, size: 2, col, grav: 0, bright: true });
  },

  // Слуга погиб: у Шуб-Ниггурат его кровь уходит в спящий телепорт.
  onMinionDeath(m) {
    const g = this.shubGate;
    if (!g || g.open) return;
    const tp = this.level.teleports[0];
    if (!tp) return;
    g.have++;
    for (let i = 0; i < 10; i++) {
      const k = i / 10;
      FX.add({ kind: 'spark', x: lerp(m.cx, tp.cx, k), y: lerp(m.cy, tp.bottom - 20, k) - Math.sin(k * Math.PI) * 60, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3 + k * 0.6, max: 0.9, size: 2, col: '#e04060', grav: 0, bright: true });
    }
    Sound.play('charge', tp.cx, tp.bottom, { p: 0.6 + g.have / g.need, vol: 0.5, gap: 0.05 });
    const shub = this.monsters.find((x) => x.type === 'shub' && x.alive);
    if (g.have >= g.need) {
      g.open = true;
      for (const t of this.level.teleports) { t.sealed = false; FX.teleport(t.cx, t.bottom - 16); }
      HUD.center('Телепорт пробуждён!\nВойдите в него — прямо в её чрево', 4);
      Sound.play('secret');
      this.exitHint = 'teleport';
      if (shub) shub.shubPanic();
    } else {
      HUD.message(`Кровь отродий питает телепорт: ${g.have}/${g.need}`);
      if (shub && g.have === Math.ceil(g.need / 2)) shub.shubPhase2();
    }
  },

  // --- поднимающаяся лава Хтона ---
  // Цикл: затишье → предупреждение (пузыри, гул) → подъём → стоит → спадает.
  startFlood(level) {
    const f = this.flood;
    if (!f) return;
    f.on = true; f.level = level;
    if (f.st === 'off') { f.st = 'calm'; f.t = level >= 2 ? 1.5 : 3; }
  },

  updateFlood(dt) {
    const f = this.flood;
    if (!f || f.st === 'off') return;
    const hard = f.level >= 2;
    f.t -= dt;
    switch (f.st) {
      case 'calm':
        if (f.t <= 0 && f.on) {
          f.st = 'warn'; f.t = 2;
          Sound.play('roar', (f.x0 + f.x1) / 2, f.base, { p: 0.6, vol: 0.7 });
          this.shake((f.x0 + f.x1) / 2, f.base, 5);
          if (!f.warned) { f.warned = true; HUD.center('Лава поднимается!\nНа уступы!', 2.5); }
        }
        break;
      case 'warn':
        if (Math.random() < dt * 40) FX.add({ kind: 'spark', x: rand(f.x0, f.x1), y: f.base - 1, vx: rand(-15, 15), vy: rand(-110, -50), life: 0.7, max: 0.7, size: 1, col: pick(['#ffb040', '#ff7020', '#ffe080']), grav: 120, bright: true });
        if (f.t <= 0) { f.st = 'rise'; f.t = 1; f.max = hard ? 30 : 22; Sound.play('burn', (f.x0 + f.x1) / 2, f.base, { vol: 0.9, p: 0.6 }); }
        break;
      case 'rise':
        f.h = f.max * (1 - Math.max(0, f.t));
        if (f.t <= 0) { f.st = 'hold'; f.t = hard ? 5 : 4; }
        break;
      case 'hold':
        f.h = f.max + Math.sin(this.time * 3) * 1.5;
        if (f.t <= 0) { f.st = 'fall'; f.t = 1.5; }
        break;
      case 'fall':
        f.h = Math.max(0, f.h - dt * f.max / 1.5);
        if (f.h <= 0) { f.h = 0; f.st = f.on ? 'calm' : 'off'; f.t = hard ? 6 : 9; }
        break;
      default: break;
    }
    // жжёт всех, кто стоит в поднявшейся лаве
    if (f.h > 2) {
      const top = f.base - f.h;
      f.hurtT -= dt;
      const p = this.player;
      if (p && p.alive && p.cx > f.x0 && p.cx < f.x1 && p.y + p.h > top + 2 && p.y + p.h <= f.base + 2 && f.hurtT <= 0) {
        f.hurtT = 0.25;
        p.takeDamage(p.suit > 0 ? 2 : 9, null, 'lava');
        FX.sparks(p.cx, top, 4, '#ff8030', 90);
      }
    }
  },

  drawFlood(ctx, cam, t) {
    const f = this.flood;
    if (!f || f.h <= 0.5) return;
    const top = f.base - f.h;
    const x0 = Math.max(f.x0, cam.x - 4), x1 = Math.min(f.x1, cam.x + this.viewW + 4);
    if (x1 <= x0) return;
    const lava = Tex.liquidAnim.lava;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 - cam.x, f.base - cam.y);
    for (let x = x0; x <= x1; x += 4) ctx.lineTo(x - cam.x, top - cam.y + Math.sin(t * 3 + x * 0.07) * 1.5 + Math.sin(t * 5.3 + x * 0.19));
    ctx.lineTo(x1 - cam.x, f.base - cam.y);
    ctx.closePath();
    ctx.clip();
    for (let x = Math.floor(x0 / 64) * 64; x < x1; x += 64) {
      for (let y = Math.floor((top - 4) / 64) * 64; y < f.base; y += 64) ctx.drawImage(lava, 0, 0, 64, 64, x - cam.x, y - cam.y, 64, 64);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,140,40,0.25)';
    ctx.fillRect(x0 - cam.x, top - cam.y - 3, x1 - x0, 5);
    ctx.restore();
  },

  // --- удары из-под земли и с неба: метка, затем удар ---
  addStrike(x, kind, warn) {
    const lv = this.level;
    const p = this.player;
    // пол под точкой удара
    let ty = Math.floor(((p ? p.y + p.h : 0) - 4) / TILE);
    const tx = Math.floor(x / TILE);
    if (lv.tileSolid(tx, ty)) return;
    let n = 0;
    while (n++ < 14 && !lv.tileSolid(tx, ty + 1) && lv.tile(tx, ty + 1) !== T.PLAT) ty++;
    if (n >= 14 || lv.liquidAt(x, ty * TILE + 8)) return;
    this.strikes.push({ x, y: (ty + 1) * TILE, kind, t: warn, warn, hit: false, life: 0.5 });
    Sound.play(kind === 'bolt' ? 'charge' : 'splat', x, (ty + 1) * TILE, { p: kind === 'bolt' ? 1.4 : 0.7, vol: 0.4, gap: 0.05 });
  },

  updateStrikes(dt) {
    const p = this.player;
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      if (!s.hit) {
        s.hit = true;
        const r = s.kind === 'bolt' ? 16 : 18;
        const tall = s.kind === 'bolt' ? 600 : 44;
        if (p && p.alive && Math.abs(p.cx - s.x) < r + p.w / 2 && p.y + p.h > s.y - tall && p.y < s.y) {
          const boss = this.monsters.find((m) => m.def.boss && m.alive);
          p.takeDamage(s.kind === 'bolt' ? 22 : 25, boss || null, s.kind === 'bolt' ? 'lightning' : 'melee', 0, -380);
          if (s.kind !== 'bolt') { p.vy = Math.min(p.vy, -330); p.onGround = false; }
        }
        if (s.kind === 'bolt') {
          FX.beam(s.x + rand(-10, 10), s.y - 420, s.x, s.y, '#e0b0ff', 0.35, 3);
          FX.sparks(s.x, s.y - 2, 14, '#e0c0ff', 200);
          FX.light(s.x, s.y - 30, 160, [0.8, 0.5, 1], 1.2, 0.25);
          Sound.play('lightning', s.x, s.y, { gap: 0.04 });
        } else {
          FX.blood(s.x, s.y - 10, 0, -1, 10, 1.5);
          for (let i = 0; i < 6; i++) FX.gib(s.x + rand(-6, 6), s.y - 4, rand(-80, 80), rand(-320, -160), pick(['#5a2a3a', '#7a3a4a', '#3a1a28']), randInt(2, 3), false);
          Sound.play('gib', s.x, s.y, { vol: 0.6, gap: 0.05 });
          this.shake(s.x, s.y, 4);
        }
      }
      s.life -= dt;
    }
    this.strikes = this.strikes.filter((s) => s.life > 0);
  },

  drawStrikes(ctx, cam, t) {
    for (const s of this.strikes) {
      const x = Math.round(s.x - cam.x), y = Math.round(s.y - cam.y);
      const bolt = s.kind === 'bolt';
      if (!s.hit) {
        const k = 1 - s.t / s.warn;
        ctx.globalAlpha = 0.35 + k * 0.5 + (Math.floor(t * 14) % 2 ? 0.1 : 0);
        ctx.fillStyle = bolt ? '#c080ff' : '#e04060';
        const w = Math.round(10 + k * 12);
        ctx.fillRect(x - w, y - 2, w * 2, 2);
        ctx.fillRect(x - Math.round(w * 0.6), y - 4, Math.round(w * 1.2), 2);
        if (bolt) { ctx.globalAlpha = 0.12 + k * 0.25; ctx.fillRect(x - 1, y - 400, 2, 398); }
        else if (k > 0.5) { ctx.fillStyle = '#ffd0e0'; ctx.fillRect(x - 1, y - 3 - Math.round((k - 0.5) * 8), 2, 2); }
      } else if (!bolt) {
        // щупальце вырывается из земли и опадает
        const k = clamp(s.life / 0.5, 0, 1), hgt = Math.round(40 * Math.sin(k * Math.PI * 0.5 + 0.4));
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#4a1a2a'; ctx.fillRect(x - 4, y - hgt, 8, hgt);
        ctx.fillStyle = '#8a3a50'; ctx.fillRect(x - 3, y - hgt, 3, hgt);
        ctx.fillStyle = '#c86080'; ctx.fillRect(x - 1, y - hgt - 4, 3, 5);
      }
    }
    ctx.globalAlpha = 1;
  },

  onBossDefeated(msg) {
    this.level.openAllGates();
    for (const e of this.level.exits) {
      if (!e.hidden) continue;
      e.hidden = false;
      FX.teleport(e.cx, e.bottom - 16);
    }
    const say = () => { HUD.center(msg || 'Путь к руне открыт —\nслипгейт отмечен стрелкой', 4); Sound.play('secret'); };
    // идёт сцена гибели — подсказка выйдет, когда камера вернётся к герою
    if (this.cine && this.cine.death) this.cine.after = say; else say();
    this.exitHint = true;
  },

  // Пульт на арене Хтона заряжает электрод на своей стороне; разряд — когда заряжены оба.
  bossStrike(button) {
    const boss = this.monsters.find((m) => m.type === 'chthon' && m.alive);
    if (!boss || !boss.chthonReady()) { Sound.play('zap', button.x, button.y, { gap: 1 }); HUD.center('Электроды молчат...', 1.5); return; }
    boss.chargeElectrode(button);
  },

  // Музыка: характер эпизода (у хаба и меню — свой) и накал боя для боевого слоя.
  musicStyle() { return this.levelDef && this.levelDef.episode ? 'e' + this.levelDef.episode : 'menu'; },

  musicIntensity() {
    const p = this.player;
    if (!p || !p.alive) return 0;
    let n = 0;
    for (const m of this.monsters) {
      if (!m.alive || m.def.static) continue;
      if (m.state === 'idle' || m.state === 'down' || m.state === 'dying' || m.state === 'dead' || m.state === 'dormant') continue;
      if (m.def.boss) return 1;
      if (Math.abs(m.cx - p.cx) < 520 && Math.abs(m.cy - p.cy) < 360) n += m.def.hp >= 250 ? 2 : 1;
    }
    return clamp(n / 4, 0, 1);
  },

  hitstop: 0,
  // Герой попал: звук попадания, отметка на прицеле; мощный удар — короткий стоп-кадр.
  onPlayerHit(m, dmg, killed) {
    HUD.hitMark = { t: killed ? 0.32 : 0.14, kill: killed };
    Sound.play(killed ? 'kill' : 'hit', null, null, { gap: 0.05, p: clamp(1.3 - dmg / 100, 0.6, 1.3), vol: killed ? 0.9 : 0.55 });
    if (dmg >= 55 || (killed && (dmg >= 30 || m.def.hp >= 200))) this.hitstop = Math.max(this.hitstop, dmg >= 100 || m.def.hp >= 300 ? 0.075 : 0.045);
  },

  // --- вспомогательное для сущностей ---
  later(delay, fn) { this.timers.push({ t: delay, fn }); },

  shake(x, y, amt) {
    if (!this.player) return;
    const d = dist(x, y, this.player.cx, this.player.cy);
    this.shakeAmt = Math.max(this.shakeAmt, amt * clamp(1 - d / 450, 0, 1));
  },

  kick(a) {
    if (!this.player) return;
    this.kickX = -Math.cos(this.player.aim) * a;
    this.kickY = -Math.sin(this.player.aim) * a;
  },

  // Шум выстрела или взрыва: его слышат спящие монстры, до которых звук доходит
  // по открытому пространству (не сквозь стены), и идут проверить, откуда он.
  noise(x, y, r) {
    const p = this.player;
    if (!p || !p.alive) return;
    let reach = null;
    const lv = this.level;
    for (const m of this.monsters) {
      if (!m.alive || m.state !== 'idle' || m.def.static || m.def.boss || dist(m.cx, m.cy, x, y) > r) continue;
      reach = reach || lv.soundReach(x, y, r * 1.15);
      const tx = clamp(Math.floor(m.cx / TILE), 0, lv.w - 1), ty = clamp(Math.floor(m.cy / TILE), 0, lv.h - 1);
      if (reach[ty * lv.w + tx] >= 0) m.alert(p, true, { x, y });
    }
  },

  damageables() {
    const list = [];
    if (this.player && this.player.alive) list.push(this.player);
    for (const m of this.monsters) if (!m.gibbed && (m.alive || !m.def.boss)) list.push(m);
    for (const s of this.level.solids) if (s.isBox && s.solid) list.push(s);
    return list;
  },

  shootTargets(attacker) {
    const list = [];
    for (const m of this.monsters) {
      if (!m.alive || m === attacker || m.state === 'down') continue;
      if (m.def.boss && (m.state === 'idle' || m.state === 'dying' || m.state === 'dormant' || m.state === 'intro')) continue;
      list.push(m);
    }
    if (this.player && this.player.alive && attacker !== this.player) list.push(this.player);
    return list;
  },

  dropBackpack(x, y, ammo) {
    this.items.push(new Item('backpack', x, y + 6, { dropped: true, ammo: Object.assign({}, ammo), vy: -140, vx: rand(-40, 40) }));
  },

  // Сложность. Ступени ровные: урон, который монстры наносят за секунду боя, на «Лёгком»
  // около 0,55 от «Нормального», на «Сложном» около 1,2, на «Кошмаре» около 1,4 — и так у
  // каждого монстра, без выбросов (замер дуэлями: node tools/dev/difficulty.js).
  // Главный рычаг — урон: он делает сильнее всех одинаково. Перезарядка и боль меняются
  // умеренно: от них солдаты и изверги раньше крепли втрое, а огры — в 1,3 раза.
  skillDamageScale() { return [0.6, 1, 1.12, 1.25][this.skill]; },
  skillCdScale() { return [1.3, 1, 0.9, 0.8][this.skill]; },
  // прыжки изверга, пса, порождения и пике гаргульи учащаются вдвое слабее атак
  skillLeapCd() { return [1.15, 1, 0.95, 0.9][this.skill]; },
  // Боль: доля атак, которые монстр доводит до конца, растёт со сложностью одинаково —
  // у пугливого солдата (боль 0,8) и у стойкого изверга (0,3). Кто боли не знает, не вздрагивает.
  skillPainChance(p) { return p > 0 ? clamp(1 - (1 - p) * [0.85, 1, 1.1, 1.2][this.skill], 0, 1) : 0; },
  // ИИ: насколько охотно монстры уворачиваются и переминаются, и точность упреждения
  skillAI() { return [0.3, 0.7, 0.9, 1.1][this.skill]; },
  skillLead() { return [0, 0.55, 0.75, 0.9][this.skill]; },
  // Боссы: залпы, щупальца, молнии и отродья чаще не так резко, как у обычных монстров, —
  // иначе вместе с запасом здоровья бой на «Кошмаре» стоил втрое больше крови
  skillBossCd() { return [1.25, 1, 0.92, 0.85][this.skill]; },
  skillBossHp() { return [0.75, 1, 1.1, 1.2][this.skill]; },
  // сколько секунд стоять на алтаре, чтобы его зажечь
  altarTime() { return [3, 4, 4.5, 5.5][this.skill]; },

  aimWorld() {
    const p = this.player;
    if (Input.touchMode) {
      // правый стик держат — целимся туда, куда его тянут (или прямо, если просто коснулись);
      // не держат — герой смотрит туда, куда бежит
      const s = p.shoulder();
      let a = p.aim;
      if (Input.aim.id !== null) a = Input.aimAngle !== null ? Input.aimAngle : p.aim;
      else { const mx = Input.stickVec().x; if (mx) a = mx > 0 ? 0 : Math.PI; }
      a = Input.aim.id !== null ? this.autoAim(s, a) : (this.autoTarget = null, a);
      return { x: s.x + Math.cos(a) * 100, y: s.y + Math.sin(a) * 100 };
    }
    if (Input.padMode) {
      const s = p.shoulder();
      return { x: s.x + Math.cos(Input.padAngle) * 90, y: s.y + Math.sin(Input.padAngle) * 90 };
    }
    return {
      x: this.cam.x + (Input.mouseX * this.dpr - this.offX) / this.scale,
      y: this.cam.y + (Input.mouseY * this.dpr - this.offY) / this.scale,
    };
  },

  // Автоприцел, как в Quake: стреляя с телефона, герой доворачивает на монстра,
  // который почти на линии прицела, виден и не слишком далеко.
  autoTarget: null,
  autoAim(s, a) {
    let best = null, bd = 0.26;
    for (const m of this.monsters) {
      if (!m.alive || m.state === 'dormant' || m.state === 'intro') continue;
      const d = dist(s.x, s.y, m.cx, m.cy);
      if (d > 480) continue;
      const ang = Math.atan2(m.cy - s.y, m.cx - s.x);
      const diff = Math.abs(angleDiff(a, ang)) + d / 5000;
      if (diff < bd && this.level.los(s.x, s.y, m.cx, m.cy)) { bd = diff; best = { m, ang }; }
    }
    this.autoTarget = best ? best.m : null;
    return best ? best.ang : a;
  },

  cameraTarget(plain = false) {
    const p = this.player;
    let tx = p.cx - this.viewW / 2, ty = p.cy - this.viewH * 0.58;
    if (Input.touchMode) tx += p.facing * 40;
    else if (p.alive) {
      const a = this.aimWorld();
      tx += clamp((a.x - p.cx) * 0.25, -this.viewW * 0.22, this.viewW * 0.22);
      ty += clamp((a.y - p.cy) * 0.25, -this.viewH * 0.2, this.viewH * 0.2);
    }
    // летающий босс: держим в кадре и героя, и его
    const b = !plain && p.alive && this.monsters.find((m) => (m.type === 'elder' || m.type === 'herald') && m.alive && m.state !== 'idle' && m.state !== 'dormant');
    if (b && Math.abs(b.cx - p.cx) < this.viewW * 0.8) {
      const want = b.y - 20;
      if (want < ty) ty = Math.max(want, p.cy - this.viewH * 0.84);
    }
    return this.clampCam(tx, ty);
  },

  clampCam(tx, ty) {
    const lv = this.level;
    const maxX = lv.pxW - this.viewW, maxY = lv.pxH - this.viewH + 42;   // пол не прячется под строкой состояния
    tx = maxX < 0 ? maxX / 2 : clamp(tx, 0, maxX);
    ty = maxY < 0 ? maxY / 2 : clamp(ty, 0, maxY);
    return { x: tx, y: ty };
  },

  snapCamera() {
    const p = this.player;
    const c = this.clampCam(p.cx - this.viewW / 2, p.cy - this.viewH * 0.58);
    this.cam.x = c.x; this.cam.y = c.y;
  },

  // --- обновление ---
  update(dt) {
    // стоп-кадр: мир замирает на долю секунды, ввод копится до следующего кадра
    if (this.hitstop > 0 && this.state === 'playing') { this.hitstop -= dt; return; }
    this.time += dt;
    Input.pollPad();
    HUD.update(dt);
    if (this.state !== 'playing') Music.setIntensity(0);
    switch (this.state) {
      case 'menu':
        this.updateAttract(dt);
        Menu.update(dt);
        break;
      case 'paused':
        Menu.update(dt);
        break;
      case 'playing':
        // замедление времени (гибель Древнего)
        if (this.slowT > 0) this.slowT -= dt;
        this.whiteFlash = Math.max(0, this.whiteFlash - dt * 0.8);
        this.updatePlay(this.slowT > 0 ? dt * 0.35 : dt);
        break;
      case 'intermission':
        this.interT += dt;
        if (this.interT > 1.2 && this.anyKey()) this.nextLevel();
        break;
      case 'finale':
        this.finaleT += dt;
        if (this.finaleT > 3 && this.anyKey()) { this.finaleDone = true; this.nextLevel(); }
        break;
      default: break;
    }
    this.soundscape(dt);
    Input.endFrame();
  },

  // Звуковая среда: каждые четверть секунды — эхо по размеру помещения, ветер под
  // открытым небом, глухой звук под водой и ближайшие фоновые источники.
  soundscape(dt) {
    this.roomT -= dt;
    if (this.roomT > 0) return;
    this.roomT = 0.25;
    const p = this.player;
    if (this.state !== 'playing' || !p || this.attract) {
      Sound.setUnderwater(false);
      Ambient.update(0, 0, true);
      return;
    }
    const r = this.measureRoom(p.cx, p.cy - 6);
    Sound.setRoom(r.size, r.outdoor);
    Sound.setUnderwater(p.alive && p.waterLevel === 3);
    Ambient.update(p.cx, p.cy, false);
  },

  // Двенадцать лучей во все стороны: средняя дальность — размер помещения,
  // доля лучей, ушедших в небо или Пустоту, — насколько вокруг открыто.
  measureRoom(x, y) {
    const lv = this.level, N = 12, R = 420;
    let sum = 0, open = 0;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * TAU, dx = Math.cos(a) * R, dy = Math.sin(a) * R;
      const h = lv.rayCast(x, y, x + dx, y + dy, true);
      sum += h.t * R;
      for (let s = 24; s < h.t * R; s += 24) {
        if (skyLike(lv.tile(Math.floor((x + dx * s / R) / TILE), Math.floor((y + dy * s / R) / TILE)))) { open++; break; }
      }
    }
    return { size: clamp((sum / N - 70) / 260, 0, 1), outdoor: clamp(open / N * 1.6, 0, 1) };
  },

  anyKey() {
    return Input.clicks.length > 0 || Input.wasPressed('Enter', 'Space', 'Escape', 'NumpadEnter', 'PadA', 'PadStart') || Input.actPressed('fire');
  },

  updateAttract(dt) {
    const lv = this.level;
    const k = Math.sin(this.time * 0.035) * 0.5 + 0.5;
    this.cam.x = k * Math.max(0, lv.pxW - this.viewW);
    const ky = Math.sin(this.time * 0.05) * 0.5 + 0.5;
    this.cam.y = ky * Math.max(0, lv.pxH - this.viewH);
    FX.update(dt);
    updateForeground(lv, dt, this.cam, this.viewW, this.viewH);
    for (const m of this.monsters) m.anim += dt;
  },

  updatePlay(dt) {
    const p = this.player;
    // появление босса: мир замирает, живёт только он, камера смотрит на него
    const bi = this.levelDef.bossIntro;
    if (bi && !this.introDone && p.alive) {
      const tx = Math.floor(p.cx / TILE), ty = Math.floor((p.y + p.h - 1) / TILE);
      if (tx >= bi[0] && tx <= bi[2] && ty >= bi[1] && ty <= bi[3]) this.startBossIntro();
    }
    if (this.cine) {
      const c = this.cine;
      c.t += dt;
      c.boss.update(dt);
      p.vx = approach(p.vx, 0, 900 * dt);
      p.vy = Math.min(p.vy + GRAVITY * dt, 800);
      moveBody(p, dt);
      FX.update(dt);
      const k = clamp(Math.min(c.t / 0.8, (c.dur - c.t) / 0.7), 0, 1);
      const f = c.focus || { x: c.boss.cx, y: c.boss.cy };
      const pc = this.cameraTarget(true), bc = this.clampCam(f.x - this.viewW / 2, f.y - this.viewH * 0.45);
      const tx = lerp(pc.x, bc.x, k * k * (3 - 2 * k)), ty = lerp(pc.y, bc.y, k * k * (3 - 2 * k));
      const kk = 1 - Math.exp(-dt * 6);
      this.cam.x = lerp(this.cam.x, tx, kk); this.cam.y = lerp(this.cam.y, ty, kk);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 10);
      Sound.listenerX = p.cx; Sound.listenerY = p.cy;
      if (c.t >= c.dur) { this.cine = null; if (c.after) c.after(); }
      Input.mouseDown = false;
      return;
    }
    if (Input.wasPressed('Escape', 'KeyP', 'PadStart') || Input.buttonPresses.has('pause')) { this.pause(); return; }
    // отладочная панель — по клавише ~, как консоль в Quake
    if (Input.wasPressed('Backquote')) this.debugOn = !this.debugOn;
    if (Input.actPressed('music')) {
      if (Music.playing) Music.stop(); else Music.start(this.levelDef.music || 55, this.musicStyle());
    }
    if (Input.buttonPresses.has('map') || Input.actPressed('mapPin')) this.mapOpen = !this.mapOpen;
    if (Input.buttonPresses.has('full')) this.toggleFullscreen();
    this.showStats = Input.act('map') || this.mapOpen;
    this.revealT -= dt;
    if (this.revealT <= 0) {
      this.revealT = 0.2;
      const c = this.cam;
      this.level.reveal(Math.floor(c.x / TILE), Math.floor(c.y / TILE), Math.ceil((c.x + this.viewW) / TILE), Math.ceil((c.y + this.viewH) / TILE));
    }
    if (p.alive) this.levelTime += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    this.level.update(dt);
    p.update(dt);
    if (p.alive) this.checkTriggers(p);
    this.recordTrail(this.player);
    for (const m of this.monsters) m.update(dt);
    Music.setIntensity(this.musicIntensity());
    this.jumpPads();
    this.updateTraps();
    this.updateWaves(dt);
    this.separateMonsters(dt);
    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const it of this.items) it.update(dt);
    if (this.items.some((it) => it.taken)) this.items = this.items.filter((it) => !it.taken);
    if (this.monsters.some((m) => m.gibbed && !m.def.boss)) this.monsters = this.monsters.filter((m) => !m.gibbed || m.def.boss);
    FX.update(dt);
    this.updateFlood(dt);
    this.updateStrikes(dt);
    updateAmbience(this.level, dt, this.cam, this.viewW, this.viewH);
    const c = this.cameraTarget();
    const k = 1 - Math.exp(-dt * 9);
    this.cam.x = lerp(this.cam.x, c.x, k);
    this.cam.y = lerp(this.cam.y, c.y, k);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 18);
    this.kickX *= Math.exp(-dt * 18); this.kickY *= Math.exp(-dt * 18);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.bonusFlash = Math.max(0, this.bonusFlash - dt * 1.5);
    this.bossFx = Math.max(0, this.bossFx - dt);
    Sound.listenerX = p.cx; Sound.listenerY = p.cy;
    if (!p.alive && p.deadT > 1 && (Input.clicks.length || Input.wasPressed('Enter') || Input.actPressed('jump') || Input.actPressed('fire') || Input.buttonPresses.has('jump'))) {
      if (this.checkpoint) this.respawnAtCheckpoint(); else this.restartLevel();
    }
  },

  recordTrail(p) {
    if (!p.alive || !p.onGround) return;
    const tr = this.trail, last = tr[tr.length - 1];
    const x = p.cx, y = p.y + p.h;
    if (last && Math.abs(last.x - x) + Math.abs(last.y - y) < 24) return;
    tr.push({ x, y });
    if (tr.length > 60) tr.shift();
  },

  // Возрождение у контрольной точки: мир остаётся как был, монстры теряют след.
  // Ключи, оружие и патроны, подобранные после точки, не теряются: предметов
  // на уровне уже нет, и без них можно застрять.
  respawnAtCheckpoint() {
    const cp = this.checkpoint;
    const dead = this.player;
    const p = new Player(cp.x, cp.y);
    p.applyInventory(cp.state);
    p.keys = { silver: cp.state.keys.silver || dead.keys.silver, gold: cp.state.keys.gold || dead.keys.gold };
    for (const n in dead.weapons) if (dead.weapons[n]) p.weapons[n] = true;
    for (const t in p.ammo) p.ammo[t] = Math.max(p.ammo[t], dead.ammo[t] || 0);
    p.ensureAmmoReserve();
    p.health = Math.max(p.health, 60);
    this.player = p;
    this.projectiles = [];
    this.trail = [];
    for (const m of this.monsters) {
      if (!m.alive || m.def.boss) continue;
      m.target = null;
      if (m.state !== 'down') m.state = 'idle';
    }
    this.damageFlash = 0;
    this.snapCamera();
    FX.teleport(p.cx, p.cy);
    Sound.play('teleport');
    HUD.center('Контрольная точка', 1.5);
  },

  checkTriggers(p) {
    const lv = this.level;
    for (const d of lv.decor) {
      if (d.kind !== 'checkpoint' || d.active) continue;
      if (Math.abs(p.cx - d.x) < 10 && p.y < d.y && p.y + p.h > d.y - 24) {
        for (const o of lv.decor) if (o.kind === 'checkpoint') o.active = false;
        d.active = true;
        this.checkpoint = { x: d.x, y: d.y, state: p.checkpointState() };
        HUD.center('Контрольная точка', 1.5);
        Sound.play('checkpoint');
        FX.teleport(d.x, d.y - 12);
      }
    }
    for (const tp of lv.teleports) {
      if (tp.sealed || !overlap(p, tp)) continue;
      FX.teleport(p.cx, p.cy);
      p.x = tp.dest.x - p.w / 2;
      p.y = tp.dest.y - p.h;
      p.vx = 0; p.vy = 0;
      this.trail = [];   // сквозь телепорт по следу не пройти
      FX.teleport(p.cx, p.cy);
      Sound.play('teleport');
      for (const m of this.monsters) if (m.alive && overlap(m, p)) applyDamage(m, 5000, p, 'telefrag');
      this.snapCamera();
      return;
    }
    for (const e of lv.exits) {
      if (e.hidden || !overlap(p, e)) continue;
      Sound.play('teleport');
      if (e.skill !== null && e.skill !== undefined) {
        this.skill = e.skill;
        HUD.center('Сложность: ' + SKILL_NAMES[e.skill], 2);
        const ep = EPISODES.find((x) => x.id === (this.newEpisode || 1)) || EPISODES[0];
        this.loadLevel(ep.first, { inv: this.kitInventory(LEVELS.find((l) => l.id === ep.first)) });
        return;
      }
      if (e.secret) this.secretExit = true;
      this.startIntermission();
      return;
    }
  },

  // Прыжковые площадки подбрасывают всех, кто на них стоит.
  jumpPads() {
    const pads = this.level.jumpPads;
    if (!pads.length) return;
    const bodies = [this.player, ...this.monsters];
    for (const e of bodies) {
      if (!e || !e.alive || !e.onGround || (e.def && (e.def.fly || e.def.boss || e.def.static))) continue;
      const feet = e.y + e.h;
      for (const pad of pads) {
        if (e.x + e.w > pad.x && e.x < pad.x + pad.w && Math.abs(feet - (pad.ty + 1) * TILE) < 3) {
          e.vy = -JUMP_PAD_VEL;
          e.onGround = false;
          e.lift = null;
          if (e.isPlayer) { e.jumping = false; e.coyote = 0; e.jumpBuf = 0; }
          Sound.play('jumppad', pad.x + 7, pad.y);
          for (let i = 0; i < 10; i++) FX.add({ kind: 'spark', x: pad.x + rand(0, 14), y: pad.y, vx: rand(-20, 20), vy: rand(-160, -60), life: 0.4, max: 0.4, size: 1, col: '#80ffe0', grav: 100, bright: true });
          break;
        }
      }
    }
  },

  separateMonsters(dt) {
    const ms = this.monsters;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      if (!a.alive || a.def.boss) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j];
        if (!b.alive || b.def.boss || !overlap(a, b)) continue;
        // расталкиваем только в свободное место и не с края — раньше так вдавливало в стены
        const push = (a.cx < b.cx ? -1 : 1) * 60 * dt;
        nudgeMonster(a, push);
        nudgeMonster(b, -push);
      }
    }
  },

  // --- отрисовка ---
  render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, u = this.u;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#050302';
    ctx.fillRect(0, 0, W, H);
    if (this.state === 'finale') { this.renderFinale(ctx, W, H, u); return; }
    if (this.level) {
      this.renderWorld();
      ctx.drawImage(this.world, 0, 0, this.viewW, this.viewH, this.offX, this.offY, this.viewW * this.scale, this.viewH * this.scale);
      this.drawLabels(ctx);
    }
    const t = this.time;
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'intermission') {
      const p = this.player;
      HUD.draw(ctx, W, H, u, t);
      if (this.state === 'playing') {
        if (!p.alive) {
          HUD.text(ctx, this.deathMsg, W / 2, H * 0.36, 9 * u, '#e05040', 'center');
          if (p.deadT > 1) {
            const what = this.checkpoint ? 'вернуться к контрольной точке' : 'начать заново';
            HUD.text(ctx, (Input.touchMode ? 'Коснитесь экрана, чтобы ' : 'Нажмите огонь, чтобы ') + what, W / 2, H * 0.36 + 20 * u, 6 * u, '#c8a878', 'center');
          }
        } else if (Input.padMode) {
          const a = this.aimWorld();
          HUD.crosshair(ctx, this.offX + (a.x - this.cam.x) * this.scale, this.offY + (a.y - this.cam.y) * this.scale, u);
        } else if (!Input.touchMode) {
          HUD.crosshair(ctx, Input.mouseX * this.dpr, Input.mouseY * this.dpr, u);
        }
        if (this.exitHint && p.alive && !this.cine) this.drawExitPointer(ctx, W, H, u);
        if (this.cine) this.drawBossCard(ctx, W, H, u);
        if (Input.touchMode) {
          const m = this.autoTarget;
          if (m && m.alive && Input.aim.id !== null) HUD.drawAutoTarget(ctx, m, (wx, wy) => ({ x: (wx - this.cam.x) * this.scale + this.offX, y: (wy - this.cam.y) * this.scale + this.offY }), u);
          HUD.drawTouch(ctx, W, H, u);
        }
        if (this.showStats) this.drawAutomap(ctx, W, H, u);
      }
      if (this.debugOn && p) this.drawDebug(ctx, W, H, u);
    }
    if (this.state === 'intermission') this.drawLevelStats(ctx, W, H, u, Input.touchMode ? 'Коснитесь, чтобы продолжить' : 'Нажмите огонь, чтобы продолжить');
    if (this.state === 'menu' || this.state === 'paused') Menu.draw(ctx, W, H, u, t);
    if (H > W * 1.15) HUD.text(ctx, 'Поверните устройство горизонтально', W / 2, this.offY - 16 * u, 6 * u, '#c8a060', 'center');
    if (this.state !== 'playing' && !Input.touchMode && !Input.padMode) HUD.crosshair(ctx, Input.mouseX * this.dpr, Input.mouseY * this.dpr, u * 0.8);
  },

  // Табличка с именем босса и киношные полосы во время его появления.
  drawBossCard(ctx, W, H, u) {
    const c = this.cine;
    const card = BOSS_CARDS[c.boss.type];
    const k = clamp(Math.min(c.t / 0.5, (c.dur - c.t) / 0.5), 0, 1);
    // в сцене гибели табличка «повержен» выходит, когда босс взрывается
    const sub = c.death ? 'повержен' : card.sub;
    const bar = H * 0.11 * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    const a = c.death ? clamp(Math.min((c.t - card.deathAt) / 0.5, (c.dur - 0.25 - c.t) / 0.4), 0, 1) : clamp(Math.min((c.t - 1) / 0.6, (c.dur - 0.3 - c.t) / 0.5), 0, 1);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    let size = Math.min(34 * u, W / 9);
    // тёмная полоса под табличкой, чтобы имя читалось на лаве и вспышках
    const band = ctx.createLinearGradient(0, H * 0.62 - size * 0.4, 0, H * 0.62 + size * 2);
    band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.35, 'rgba(0,0,0,0.55)'); band.addColorStop(0.75, 'rgba(0,0,0,0.55)'); band.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, H * 0.62 - size * 0.4, W, size * 2.4);
    ctx.font = `${Math.round(size)}px ${TITLE_FONT}`;
    const name = I18N.t(card.name);
    const wide = ctx.measureText(name).width;
    if (wide > W * 0.86) { size *= W * 0.86 / wide; ctx.font = `${Math.round(size)}px ${TITLE_FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const y = H * 0.62;
    ctx.fillStyle = '#05080c'; ctx.fillText(name, W / 2 + size * 0.05, y + size * 0.06);
    const g = ctx.createLinearGradient(0, y, 0, y + size);
    g.addColorStop(0, card.cols[0]); g.addColorStop(0.5, card.cols[1]); g.addColorStop(1, card.cols[2]);
    ctx.fillStyle = g; ctx.fillText(name, W / 2, y);
    HUD.text(ctx, sub, W / 2, y + size * 1.15, 7 * u, card.subCol, 'center');
    ctx.fillStyle = card.line;
    ctx.fillRect(W / 2 - 90 * u * a, y + size * 1.08, 180 * u * a, Math.max(1, u * 0.6));
    ctx.globalAlpha = 1;
  },

  // Отладочная панель: что происходит на уровне прямо сейчас — для проверки и отчётов об ошибках.
  debugOn: false,
  debugLines() {
    const def = this.levelDef, lv = this.level, p = this.player;
    const now = performance.now();
    if (this.dbgLast) this.dbgFps = lerp(this.dbgFps || 60, 1000 / Math.max(1, now - this.dbgLast), 0.1);
    this.dbgLast = now;
    const alive = this.monsters.filter((m) => m.alive && !m.def.static);
    const L = [
      `${def.id} «${def.title}» · ${SKILL_NAMES[this.skill]} · ${Math.round(this.dbgFps || 60)} кадр/с`,
      `герой: клетка ${Math.floor(p.cx / TILE)},${Math.floor((p.y + p.h - 1) / TILE)} · здоровье ${Math.ceil(p.health)} · броня ${Math.ceil(p.armor)}${this.god ? ' · бессмертие' : ''}`,
      `монстры: живых ${alive.length}, убито ${this.kills}/${this.totalKills} · тяжесть ×${(GRAVITY / BASE_GRAVITY).toFixed(2)}`,
    ];
    const boss = this.monsters.find((m) => m.def.boss);
    const needBoss = def.exitAfterBoss && !def.waves;
    if (boss) {
      const hp = boss.type === 'chthon' ? `раны ${boss.hits}/${boss.def.hp}` : boss.type === 'shub' ? 'неуязвима' : `здоровье ${Math.ceil(boss.health)}/${boss.maxHealth}`;
      L.push(`босс: ${boss.type} · ${boss.alive ? boss.state : 'повержен'} · ${hp}` + (def.bossIntro ? ` · появление: ${this.cine ? 'идёт' : this.introDone ? 'было' : 'ждёт героя'}` : ''));
    } else if (needBoss) L.push('ОШИБКА: на уровне должен быть босс, а его нет');
    if (def.altarButtons) L.push(`алтари: зажжено ${lv.buttons.filter((b) => b.lit).length}/${lv.buttons.length}`);
    const els = lv.decor.filter((d) => d.kind === 'electrode');
    if (els.length) L.push('электроды: ' + els.map((e) => e.est || 'off').join(', ') + (this.flood ? ` · лава ${this.flood.st} ${Math.round(this.flood.h)} px` : ''));
    if (this.shubGate) L.push(`кровь для телепорта: ${this.shubGate.have}/${this.shubGate.need}${this.shubGate.open ? ' · открыт' : ''}`);
    const pylons = this.monsters.filter((m) => m.type === 'pylon');
    if (pylons.length) L.push(`кристаллы щита: целы ${pylons.filter((m) => m.alive).length}/${pylons.length}`);
    if (this.waves) L.push(`волны: ${this.waves.started ? Math.max(0, this.waves.i + 1) : 0}/${def.waves.list.length}${this.waves.done ? ' · пройдено' : ''}`);
    const exits = lv.exits.filter((e) => !e.skill && e.skill !== 0);
    L.push(`выходы: открыто ${exits.filter((e) => !e.hidden).length}/${exits.length}` + (exits.some((e) => e.secret) ? ' (есть секретный)' : ''));
    return L;
  },

  drawDebug(ctx, W, H, u) {
    const L = this.debugLines();
    const size = 4.6 * u, lh = size * 1.45;
    const w = Math.min(W - 12 * u, 250 * u), x = W - w - 6 * u, y = 38 * u;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x - 3 * u, y - 3 * u, w + 6 * u, L.length * lh + 6 * u);
    L.forEach((s, i) => HUD.text(ctx, s, x, y + i * lh, size, /ОШИБКА/.test(s) ? '#ff6050' : i === 0 ? '#ffe0a0' : '#c8e0c0', 'left'));
  },

  // После победы над боссом: стрелка у края экрана к открывшемуся слипгейту,
  // а когда он в кадре — прыгающий маркер над ним.
  drawExitPointer(ctx, W, H, u) {
    const p = this.player;
    let best = null;
    const tele = this.exitHint === 'teleport';
    for (const e of tele ? this.level.teleports : this.level.exits) {
      if (e.hidden || e.sealed) continue;
      const d = dist(e.cx, e.bottom, p.cx, p.cy);
      if (!best || d < best.d) best = { e, d };
    }
    if (!best) return;
    const e = best.e;
    const sx = this.offX + (e.cx - this.cam.x) * this.scale;
    const sy = this.offY + (e.bottom - 30 - this.cam.y) * this.scale;
    const m = 26 * u, bottom = HUD.barTop(H, u) - 22 * u;
    const inside = sx > m && sx < W - m && sy > m && sy < bottom;
    const bob = Math.sin(this.time * 6) * 3 * u;
    ctx.save();
    if (inside) {
      ctx.translate(sx, sy - 14 * u + bob);
      ctx.rotate(Math.PI / 2);
    } else {
      const cx = W / 2, cy = (bottom + m) / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      // точка на краю прямоугольника экрана в сторону выхода
      const k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a))), ((bottom - m) / 2) / Math.max(1e-6, Math.abs(Math.sin(a))));
      ctx.translate(cx + Math.cos(a) * (k - bob), cy + Math.sin(a) * (k - bob));
      // подпись чуть ближе к центру экрана, стрелка смотрит на выход
      HUD.text(ctx, tele ? 'ТЕЛЕПОРТ' : 'ВЫХОД', -Math.cos(a) * 22 * u, -Math.sin(a) * 16 * u - 3 * u, 5 * u, '#c8b0ff', 'center');
      ctx.rotate(a);
    }
    const s = u * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.moveTo(8 * s, 0); ctx.lineTo(-5 * s, -6.5 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(-5 * s, 6.5 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = Math.floor(this.time * 4) % 2 ? '#d0b8ff' : '#9a7aff';
    ctx.beginPath(); ctx.moveTo(6.5 * s, 0); ctx.lineTo(-4 * s, -5 * s); ctx.lineTo(-1.5 * s, 0); ctx.lineTo(-4 * s, 5 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawLevelStats(ctx, W, H, u, footer) {
    const def = this.levelDef;
    const k = footer ? clamp(this.interT / 1.2, 0, 1) : 1;
    // рядом — прошлый рекорд на этой сложности или отметка, что он побит
    const old = this.prevRecord, done = k >= 1 && !this.god;
    const mark = (v, better, was) => (!done || !old ? v : better ? v + '  рекорд!' : v + '  (рекорд ' + was + ')');
    const rows = [
      ['Время', mark(fmtTime(this.levelTime * k), old && this.levelTime < old.time, old && fmtTime(old.time))],
      ['Убито', mark(Math.round(this.kills * k) + ' / ' + this.totalKills, old && this.kills > old.kills, old && old.kills)],
      ['Секреты', mark(Math.round(this.secrets * k) + ' / ' + this.totalSecrets, old && this.secrets > old.secrets, old && old.secrets)],
      ['Сложность', SKILL_NAMES[this.skill]],
    ];
    if (this.secretExit) rows.push(['', 'Найден секретный выход!']);
    HUD.stats(ctx, W, H, u, def.name + ' ' + def.title, rows, footer, this.time);
  },

  // Карта уровня с исследованными клетками и сводкой.
  drawAutomap(ctx, W, H, u) {
    const lv = this.level, p = this.player;
    ctx.fillStyle = 'rgba(6,4,2,0.95)';
    ctx.fillRect(0, 0, W, H);
    const def = this.levelDef;
    HUD.text(ctx, def.name + '  ' + def.title, W / 2, 8 * u, 8 * u, '#e0b060', 'center');
    const line = `Убито ${this.kills}/${this.totalKills}   Секреты ${this.secrets}/${this.totalSecrets}   Время ${fmtTime(this.levelTime)}   ${SKILL_NAMES[this.skill]}`;
    HUD.text(ctx, line, W / 2, 22 * u, 5.5 * u, '#c8a878', 'center');
    const top = 34 * u, bottom = H - 36 * u;
    const scale = Math.max(1, Math.min((W - 16 * u) / lv.w, (bottom - top) / lv.h));
    const mx = Math.round((W - lv.w * scale) / 2), my = Math.round(top + (bottom - top - lv.h * scale) / 2);
    ctx.strokeStyle = '#4a3622'; ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.strokeRect(mx - 2, my - 2, lv.w * scale + 4, lv.h * scale + 4);
    lv.drawMap(ctx, mx, my, scale);
    const seen = (x, y) => lv.explored[Math.floor(y / TILE) * lv.w + Math.floor(x / TILE)];
    const mark = (x, y, col, r) => { ctx.fillStyle = col; ctx.fillRect(mx + (x / TILE) * scale - r, my + (y / TILE) * scale - r, r * 2, r * 2); };
    const r = Math.max(2, scale * 0.8);
    for (const e of lv.exits) if (seen(e.cx, e.bottom - 8) && !e.hidden) mark(e.cx, e.bottom - 16, '#b090ff', r);
    for (const tp of lv.teleports) if (seen(tp.cx, tp.bottom - 8)) mark(tp.cx, tp.bottom - 16, '#8060d0', r);
    for (const d of lv.decor) if (d.kind === 'checkpoint' && seen(d.x, d.y - 8)) mark(d.x, d.y - 8, d.active ? '#60e0ff' : '#6a8a90', r);
    for (const lf of lv.lifts) if (seen(lf.x + 4, lf.y)) { ctx.fillStyle = '#d0a040'; ctx.fillRect(mx + (lf.x / TILE) * scale, my + (lf.y / TILE) * scale, (lf.w / TILE) * scale, Math.max(1, scale * 0.4)); }
    // ключи видны на карте всегда (даже в неисследованных местах), запертые двери — цветной рамкой
    for (const m of lv.movers) {
      if ((m.kind !== 'silver' && m.kind !== 'gold') || !m.locked) continue;
      ctx.strokeStyle = m.kind === 'gold' ? '#f0c040' : '#c8d0dc';
      ctx.lineWidth = Math.max(1, scale * 0.5);
      ctx.strokeRect(mx + (m.x / TILE) * scale - 1, my + (m.y / TILE) * scale - 1, (m.w / TILE) * scale + 2, (m.h / TILE) * scale + 2);
    }
    const pulse = 1 + Math.sin(this.time * 6) * 0.3;
    for (const it of this.items) {
      if (it.taken || (it.ch !== '(' && it.ch !== ')')) continue;
      mark(it.cx, it.cy, '#000000', r * 2 * pulse + 1);
      mark(it.cx, it.cy, it.ch === ')' ? '#f0c040' : '#c8d0dc', r * 2 * pulse);
    }
    if (p && Math.floor(this.time * 3) % 2 === 0) mark(p.cx, p.cy, '#ff4030', r * 1.2);
    HUD.text(ctx, 'Мигают ключи, цветной рамкой — запертые двери', W / 2, H - 22 * u, 5 * u, '#a08050', 'center');
    HUD.text(ctx, Input.touchMode ? 'Кнопка «карта» — закрыть' : Input.padMode ? 'Back — закрыть карту' : `${keyName(Input.binds.map[0])} — карта (${keyName(Input.binds.mapPin[0])} — закрепить)`, W / 2, H - 30 * u, 5 * u, '#806040', 'center');
  },

  drawLabels(ctx) {
    const labels = this.levelDef.labels;
    if (!labels) return;
    for (const l of labels) {
      const x = this.offX + ((l.x + 0.5) * TILE - this.cam.x) * this.scale;
      const y = this.offY + (l.y * TILE - this.cam.y) * this.scale;
      if (x < -200 || x > this.canvas.width + 200 || y < -50 || y > this.canvas.height + 50) continue;
      HUD.text(ctx, l.text, x, y, 6 * this.u, l.color || '#e0c080', 'center');
    }
  },

  collectLights() {
    const out = [];
    FX.collectLights(out);
    if (this.player && !this.player.gibbed) this.player.lights(out);
    for (const pr of this.projectiles) pr.light(out);
    for (const it of this.items) it.lights(out, this.time);
    for (const m of this.monsters) if (m.alive) m.lights(out);
    for (const d of this.level.decor) {
      if (d.kind !== 'torch' || this.level.isHiddenAt(d.x, d.y)) continue;
      if (d.x < this.cam.x - 80 || d.x > this.cam.x + this.viewW + 80 || d.y < this.cam.y - 80 || d.y > this.cam.y + this.viewH + 80) continue;
      const f = Math.sin(this.time * 11 + d.x) * 0.5 + Math.sin(this.time * 17.3 + d.y) * 0.5;
      out.push({ x: d.x, y: d.y - 6, r: 44, c: [1, 0.6, 0.25], i: 0.2 + f * 0.1 });
    }
    for (const d of this.level.decor) {
      if (d.kind === 'checkpoint') out.push({ x: d.x, y: d.y - 12, r: d.active ? 70 : 34, c: d.active ? [0.4, 0.85, 1] : [0.9, 0.3, 0.15], i: d.active ? 0.7 : 0.35 });
    }
    if (this.levelDef.altarButtons) {
      for (const b of this.level.buttons) out.push({ x: b.x + 6, y: b.y, r: b.lit ? 90 : 40, c: b.lit ? [0.4, 0.9, 1] : [0.6, 0.3, 0.9], i: b.lit ? 0.8 : 0.4 });
    }
    for (const d of this.level.decor) {
      if (d.kind !== 'electrode') continue;
      const i = Math.max(this.bossFx * 1.5, d.est === 'ready' ? 0.6 + Math.sin(this.time * 9) * 0.15 : d.est === 'charging' ? 0.2 + d.et * 0.25 : 0);
      if (i > 0.01) out.push({ x: d.x, y: d.y - 34, r: 160, c: [0.6, 0.7, 1], i });
    }
    const f = this.flood;
    if (f && f.h > 1) {
      for (let x = Math.max(f.x0, Math.floor(this.cam.x / 80) * 80); x < Math.min(f.x1, this.cam.x + this.viewW + 80); x += 80) out.push({ x, y: f.base - f.h, r: 90, c: [1, 0.5, 0.15], i: 0.25 + f.h / 60 });
    }
    for (const s of this.strikes) out.push({ x: s.x, y: s.y - 8, r: 50, c: s.kind === 'bolt' ? [0.7, 0.4, 1] : [0.9, 0.2, 0.35], i: s.hit ? 0.2 : 0.5 });
    return out;
  },

  renderWorld() {
    const lv = this.level;
    const ctx = this.wctx, lctx = this.lctx;
    const vw = this.viewW, vh = this.viewH;
    let sx = 0, sy = 0;
    if (this.shakeOn && this.shakeAmt > 0) { sx = rand(-1, 1) * this.shakeAmt; sy = rand(-1, 1) * this.shakeAmt; }
    const cam = { x: Math.round(this.cam.x + sx + this.kickX), y: Math.round(this.cam.y + sy + this.kickY) };
    const t = this.time;
    Tex.animateLiquids(t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    lv.drawSky(ctx, cam, vw, vh, t);
    lv.drawBaked(ctx, cam, vw, vh);
    lv.drawScorches(ctx, cam, vw, vh);
    lv.drawPortals(ctx, cam, t, false);
    lv.drawMovers(ctx, cam);
    if (lv.fans && lv.fans.length) drawFans(ctx, cam, lv.fans, t);
    for (const it of this.items) it.draw(ctx, cam, t);
    for (const m of this.monsters) if (!m.alive) m.draw(ctx, cam);
    for (const m of this.monsters) if (m.alive) m.draw(ctx, cam);
    if (this.player) this.player.draw(ctx, cam);
    for (const pr of this.projectiles) pr.draw(ctx, cam, false);
    FX.drawLit(ctx, cam);
    lv.drawLiquids(ctx, cam, vw, vh, t, 'water');
    lv.drawHidden(ctx, cam, vw, vh);

    // освещение: запечённая карта + динамические источники, затем умножение
    lv.drawLight(lctx, cam, vw, vh);
    lctx.globalCompositeOperation = 'lighter';
    for (const l of this.collectLights()) {
      const x = l.x - cam.x, y = l.y - cam.y;
      if (x < -l.r || y < -l.r || x > vw + l.r || y > vh + l.r || l.i <= 0.01) continue;
      const g = lctx.createRadialGradient(x, y, 0, x, y, l.r);
      const c = `${Math.round(l.c[0] * 255)},${Math.round(l.c[1] * 255)},${Math.round(l.c[2] * 255)}`;
      g.addColorStop(0, `rgba(${c},${Math.min(1, l.i)})`);
      g.addColorStop(1, `rgba(${c},0)`);
      lctx.fillStyle = g;
      lctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    const br = this.brightness;
    if (br > 1) {
      // «экран» поднимает тени сильнее, чем светлые места, и не пережигает их
      lctx.globalCompositeOperation = 'screen';
      const v = Math.round(255 * (br - 1) * 0.6);
      lctx.fillStyle = `rgb(${v},${v},${v})`;
      lctx.fillRect(0, 0, vw, vh);
    } else if (br < 1) {
      lctx.globalCompositeOperation = 'multiply';
      const v = Math.round(255 * br);
      lctx.fillStyle = `rgb(${v},${v},${v})`;
      lctx.fillRect(0, 0, vw, vh);
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // самосветящееся
    lv.drawLiquids(ctx, cam, vw, vh, t, 'lava');
    lv.drawVoid(ctx, cam, vw, vh, t);
    drawFog(ctx, lv, cam, vw, vh, t);
    drawShafts(ctx, lv, cam, vw, vh, t);
    lv.drawPortals(ctx, cam, t, true);
    lv.drawDecorBright(ctx, cam, t);
    for (const it of this.items) it.drawBright(ctx, cam, t);
    for (const pr of this.projectiles) pr.draw(ctx, cam, true);
    for (const m of this.monsters) m.drawBright(ctx, cam);
    this.drawFlood(ctx, cam, t);
    this.drawStrikes(ctx, cam, t);
    FX.drawBright(ctx, cam, t);
    drawForeground(ctx, lv, cam, vw, vh);

    // экранные оттенки
    const p = this.player;
    if (p) {
      const tint = (col, a) => { if (a <= 0) return; ctx.fillStyle = col; ctx.globalAlpha = Math.min(1, a); ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; };
      if (p.waterLevel === 3) tint(p.waterType === T.LAVA ? '#ff4000' : p.waterType === T.SLIME ? '#3a6a10' : '#1a4a7a', p.waterType === T.LAVA ? 0.6 : 0.3);
      if (p.quad > 0) tint('#2040ff', 0.12 + (p.quad < 3 ? Math.sin(t * 12) * 0.05 : 0));
      if (p.pent > 0) tint('#ff2010', 0.12);
      if (p.suit > 0) tint('#20a030', 0.08);
      tint('#c01000', this.damageFlash * 0.5);
      tint('#e0b040', this.bonusFlash * 0.35);
      tint('#ffffff', this.whiteFlash);
      if (!p.alive) tint('#400000', Math.min(0.45, p.deadT * 0.4));
    }
    drawVignette(ctx, vw, vh);
  },

  renderFinale(ctx, W, H, u) {
    const t = this.finaleT;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120806'); g.addColorStop(1, '#2a0c04');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawTitle(ctx, W / 2, H * 0.06, Math.min(34 * u, W / 9), this.time);
    const size = Math.min(7 * u, W / 48);
    const chars = Math.floor(t * 38);
    let used = 0;
    const text = (FINALES[this.finaleKey] || FINALES.e1).map((line) => I18N.t(line));
    text.forEach((line, i) => {
      const n = clamp(chars - used, 0, line.length);
      used += line.length + 4;
      if (n > 0) HUD.text(ctx, line.slice(0, n), W / 2, H * 0.26 + i * size * 2, size, i === text.length - 1 ? '#f8d070' : '#d8c098', 'center');
    });
    const cont = this.levelDef && this.levelDef.next ? 'Нажмите огонь, чтобы продолжить' : 'Нажмите огонь';
    if (t > 3 && Math.floor(t * 2) % 2 === 0) HUD.text(ctx, cont, W / 2, H - 20 * u, 6 * u, '#a08058', 'center');
  },
};
