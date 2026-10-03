'use strict';
// Главный модуль: цикл, загрузка уровней, камера, свет, триггеры, смерть, антракт, финал.

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
    HUD.layoutTouch(this.canvas.width, this.canvas.height, this.u);
  },

  // Яркость: выше 100% поднимает тени (как гамма в Quake), ниже — приглушает свет.
  setBrightness(v) {
    this.brightness = clamp(Math.round(v * 10) / 10, 0.5, 1.6);
    Store.set('brightness', this.brightness);
  },

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    } catch (e) { /* полноэкранный режим недоступен */ }
  },

  loop(now) {
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
    const eps = LEVELS.filter((l) => l.episode === def.episode);
    const i = eps.indexOf(def);
    if (i <= 0) return true;
    if (Store.get('done', {})[eps[i - 1].id]) return true;
    return def.episode === 1 && i < Store.get('unlocked', 1);
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
    this.mapOpen = false;
    this.revealT = 0;
    this.trail = [];
    this.exitHint = false;
    this.cine = null; this.introDone = false; this.slowT = 0; this.whiteFlash = 0;
    this.attract = !!opts.attract;
    let start = { cx: 40, bottom: 40 };
    for (const s of this.level.spawns) {
      const cx = s.tx * TILE + 8, bottom = (s.ty + 1) * TILE;
      if (s.ch === 'P') start = { cx, bottom };
      else if (MONSTER_CHARS[s.ch]) {
        const type = MONSTER_CHARS[s.ch];
        if (this.skill === 0 && type !== 'chthon' && hash2(s.tx, s.ty, 7) < 0.3) continue;
        this.monsters.push(new Monster(type, cx, bottom));
        if (!MONSTER_DEFS[type].static) this.totalKills++;
      } else if (ITEM_CHARS.includes(s.ch)) this.items.push(new Item(s.ch, cx, bottom));
    }
    if (def.bossIntro) for (const m of this.monsters) if (m.type === 'elder') m.elderDormant();
    if (this.attract) {
      this.player = null;
      this.cam.x = 0;
      this.cam.y = clamp(start.bottom - this.viewH / 2, 0, Math.max(0, this.level.pxH - this.viewH));
      return;
    }
    const p = new Player(start.cx, start.bottom);
    if (opts.inv) p.applyInventory(opts.inv);
    this.player = p;
    if (opts.inv && def.kit) this.spawnSupplyCache(def, p, start);
    this.startInv = p.inventory();
    if (def.episode) this.saveProgress(id, this.startInv);
    this.snapCamera();
    if (def.episode) HUD.center(def.name + ': ' + def.title, 3);
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
    if (!def.next) { this.toMenu(); return; }
    const inv = this.player.inventory();
    inv.health = clamp(inv.health, 50, 100);
    this.loadLevel(def.next, { inv });
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
    if (def.next) {
      const inv = this.player.inventory();
      inv.health = clamp(inv.health, 50, 100);
      this.saveProgress(def.next, inv);
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
    const boss = this.monsters.find((m) => m.type === 'elder' && m.alive);
    if (!boss) return;
    this.cine = { t: 0, dur: 4, boss };
    boss.elderIntro();
  },

  onBossDefeated() {
    this.level.openAllGates();
    for (const e of this.level.exits) {
      if (!e.hidden) continue;
      e.hidden = false;
      FX.teleport(e.cx, e.bottom - 16);
    }
    HUD.center('Путь к руне открыт —\nслипгейт отмечен стрелкой', 4);
    Sound.play('secret');
    this.exitHint = true;
  },

  bossStrike(button) {
    const boss = this.monsters.find((m) => m.def.boss && m.alive);
    const electrodes = this.level.decor.filter((d) => d.kind === 'electrode');
    this.bossFx = 0.6;
    Sound.play('zap', button.x, button.y);
    if (!boss) return;
    const ok = boss.bossHit();
    for (const e of electrodes) {
      FX.beam(e.x, e.y - 34, ok ? boss.cx + rand(-10, 10) : e.x + rand(-40, 40), ok ? boss.y + rand(20, 60) : e.y - 80, '#d0e0ff', 0.6, 3);
      FX.sparks(e.x, e.y - 34, 12, '#c8d8ff', 160);
    }
    if (!ok) HUD.center('Электроды разряжаются впустую...', 1.5);
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

  skillCdScale() { return [1.35, 1, 0.8, 0.55][this.skill]; },
  skillPainScale() { return [1, 1, 0.8, 0.4][this.skill]; },
  skillDamageScale() { return [0.7, 1, 1, 1.1][this.skill]; },
  // ИИ: насколько охотно монстры уворачиваются и переминаются, и точность упреждения
  skillAI() { return [0.3, 0.7, 1, 1.25][this.skill]; },
  // сколько секунд стоять на алтаре, чтобы его зажечь
  altarTime() { return [3, 4, 4.5, 5.5][this.skill]; },
  skillLead() { return [0, 0.55, 0.85, 1][this.skill]; },

  aimWorld() {
    const p = this.player;
    if (Input.touchMode && Input.aim.id === null) {
      const s = p.shoulder();
      return { x: s.x + Math.cos(p.aim) * 100, y: s.y + Math.sin(p.aim) * 100 };
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
    Input.endFrame();
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
      const pc = this.cameraTarget(true), bc = this.clampCam(c.boss.cx - this.viewW / 2, c.boss.cy - this.viewH * 0.45);
      const tx = lerp(pc.x, bc.x, k * k * (3 - 2 * k)), ty = lerp(pc.y, bc.y, k * k * (3 - 2 * k));
      const kk = 1 - Math.exp(-dt * 6);
      this.cam.x = lerp(this.cam.x, tx, kk); this.cam.y = lerp(this.cam.y, ty, kk);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 10);
      Sound.listenerX = p.cx; Sound.listenerY = p.cy;
      if (c.t >= c.dur) this.cine = null;
      Input.mouseDown = false;
      return;
    }
    if (Input.wasPressed('Escape', 'KeyP', 'PadStart') || Input.buttonPresses.has('pause')) { this.pause(); return; }
    if (Input.actPressed('music')) {
      if (Music.playing) Music.stop(); else Music.start(this.levelDef.music || 55, this.musicStyle());
    }
    if (Input.buttonPresses.has('map') || Input.actPressed('mapPin')) this.mapOpen = !this.mapOpen;
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
    this.separateMonsters(dt);
    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const it of this.items) it.update(dt);
    if (this.items.some((it) => it.taken)) this.items = this.items.filter((it) => !it.taken);
    if (this.monsters.some((m) => m.gibbed && !m.def.boss)) this.monsters = this.monsters.filter((m) => !m.gibbed || m.def.boss);
    FX.update(dt);
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
      if (!overlap(p, tp)) continue;
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
        const push = (a.cx < b.cx ? -1 : 1) * 60 * dt;
        if (!a.blockedX) a.x += push;
        if (!b.blockedX) b.x -= push;
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
        if (this.exitHint && p.alive) this.drawExitPointer(ctx, W, H, u);
        if (this.cine) this.drawBossCard(ctx, W, H, u);
        if (Input.touchMode) HUD.drawTouch(ctx, W, H, u);
        if (this.showStats) this.drawAutomap(ctx, W, H, u);
      }
    }
    if (this.state === 'intermission') this.drawLevelStats(ctx, W, H, u, Input.touchMode ? 'Коснитесь, чтобы продолжить' : 'Нажмите огонь, чтобы продолжить');
    if (this.state === 'menu' || this.state === 'paused') Menu.draw(ctx, W, H, u, t);
    if (H > W * 1.15) HUD.text(ctx, 'Поверните устройство горизонтально', W / 2, this.offY - 16 * u, 6 * u, '#c8a060', 'center');
    if (this.state !== 'playing' && !Input.touchMode && !Input.padMode) HUD.crosshair(ctx, Input.mouseX * this.dpr, Input.mouseY * this.dpr, u * 0.8);
  },

  // Табличка с именем босса и киношные полосы во время его появления.
  drawBossCard(ctx, W, H, u) {
    const c = this.cine;
    const k = clamp(Math.min(c.t / 0.5, (c.dur - c.t) / 0.5), 0, 1);
    const bar = H * 0.11 * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    const a = clamp(Math.min((c.t - 1) / 0.6, (c.dur - 0.3 - c.t) / 0.5), 0, 1);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const size = Math.min(34 * u, W / 9);
    ctx.font = `${Math.round(size)}px ${TITLE_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const y = H * 0.62;
    ctx.fillStyle = '#05080c'; ctx.fillText('ДРЕВНИЙ', W / 2 + size * 0.05, y + size * 0.06);
    const g = ctx.createLinearGradient(0, y, 0, y + size);
    g.addColorStop(0, '#e8fbff'); g.addColorStop(0.5, '#70d8ff'); g.addColorStop(1, '#2a6a9a');
    ctx.fillStyle = g; ctx.fillText('ДРЕВНИЙ', W / 2, y);
    HUD.text(ctx, 'Пожиратель Измерений', W / 2, y + size * 1.15, 7 * u, '#a8d8f0', 'center');
    ctx.fillStyle = '#70d8ff';
    ctx.fillRect(W / 2 - 90 * u * a, y + size * 1.08, 180 * u * a, Math.max(1, u * 0.6));
    ctx.globalAlpha = 1;
  },

  // После победы над боссом: стрелка у края экрана к открывшемуся слипгейту,
  // а когда он в кадре — прыгающий маркер над ним.
  drawExitPointer(ctx, W, H, u) {
    const p = this.player;
    let best = null;
    for (const e of this.level.exits) {
      if (e.hidden) continue;
      const d = dist(e.cx, e.bottom, p.cx, p.cy);
      if (!best || d < best.d) best = { e, d };
    }
    if (!best) return;
    const e = best.e;
    const sx = this.offX + (e.cx - this.cam.x) * this.scale;
    const sy = this.offY + (e.bottom - 30 - this.cam.y) * this.scale;
    const m = 26 * u, bottom = H - HUD_BAR * u - 22 * u;
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
      HUD.text(ctx, 'ВЫХОД', -Math.cos(a) * 22 * u, -Math.sin(a) * 16 * u - 3 * u, 5 * u, '#c8b0ff', 'center');
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
      if (d.kind !== 'torch') continue;
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
    if (this.bossFx > 0) {
      for (const d of this.level.decor) if (d.kind === 'electrode') out.push({ x: d.x, y: d.y - 34, r: 160, c: [0.6, 0.7, 1], i: this.bossFx * 1.5 });
    }
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
    lv.drawPortals(ctx, cam, t, false);
    lv.drawMovers(ctx, cam);
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
    lv.drawPortals(ctx, cam, t, true);
    lv.drawDecorBright(ctx, cam, t);
    for (const pr of this.projectiles) pr.draw(ctx, cam, true);
    for (const m of this.monsters) m.drawBright(ctx, cam);
    FX.drawBright(ctx, cam, t);

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
    const text = FINALES[this.finaleKey] || FINALES.e1;
    text.forEach((line, i) => {
      const n = clamp(chars - used, 0, line.length);
      used += line.length + 4;
      if (n > 0) HUD.text(ctx, line.slice(0, n), W / 2, H * 0.26 + i * size * 2, size, i === text.length - 1 ? '#f8d070' : '#d8c098', 'center');
    });
    const cont = this.levelDef && this.levelDef.next ? 'Нажмите огонь, чтобы продолжить' : 'Нажмите огонь';
    if (t > 3 && Math.floor(t * 2) % 2 === 0) HUD.text(ctx, cont, W / 2, H - 20 * u, 6 * u, '#a08058', 'center');
  },
};
