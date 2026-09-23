'use strict';
// Главный модуль: цикл, загрузка уровней, камера, свет, триггеры, смерть, антракт, финал.

const OBITS = {
  grunt: 'Вас застрелил солдат', dog: 'Вас загрыз пёс', enforcer: 'Вас поджарил каратель',
  knight: 'Вас зарубил рыцарь', hknight: 'Вас сжёг рыцарь смерти', ogre: 'Вас распилил огр',
  zombie: 'Вас закидал плотью зомби', fiend: 'Вас растерзал изверг', scrag: 'Вас оплевал скраг',
  vore: 'Вас уничтожил ворог', spawn: 'Вас сожрало порождение', shambler: 'Вас испепелил шамблер',
  chthon: 'Вас испепелил Хтон',
};
const FINALE_TEXT = [
  'Туша Хтона погружается обратно в лаву,',
  'из которой он поднялся. Земля затихает.',
  '',
  'На остывающем камне лежит древняя руна.',
  'Вы сжимаете её — и чувствуете, как',
  'по жилам течёт чужая, первобытная сила.',
  '',
  'Но это лишь первая из четырёх рун.',
  'За слипгейтами ждут иные измерения,',
  'и нечто древнее уже знает ваше имя.',
  '',
  'Эпизод 1 пройден.',
];

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
  damageFlash: 0, bonusFlash: 0,
  bossFx: 0, bossHintShown: false,
  god: false,
  startInv: null,
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
    this.loadLevel('e1m1', { attract: true });
    Music.start(41);
  },

  newGame() {
    this.skill = 1;
    this.loadLevel('start', { inv: null });
    this.state = 'playing';
  },

  startFromSelect(id, skill) {
    this.skill = clamp(skill, 0, 3);
    const def = LEVELS.find((l) => l.id === id);
    const p = new Player(0, 0);
    if (def.kit) {
      for (const n of def.kit.weapons) p.weapons[n] = true;
      Object.assign(p.ammo, def.kit.ammo);
      p.weapon = p.bestWeapon();
      if (def.kit.armor) { p.armor = def.kit.armor; p.armorType = 0.3; }
    }
    this.loadLevel(id, { inv: p.inventory() });
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
    this.attract = !!opts.attract;
    let start = { cx: 40, bottom: 40 };
    for (const s of this.level.spawns) {
      const cx = s.tx * TILE + 8, bottom = (s.ty + 1) * TILE;
      if (s.ch === 'P') start = { cx, bottom };
      else if (MONSTER_CHARS[s.ch]) {
        const type = MONSTER_CHARS[s.ch];
        if (this.skill === 0 && type !== 'chthon' && hash2(s.tx, s.ty, 7) < 0.3) continue;
        this.monsters.push(new Monster(type, cx, bottom));
        this.totalKills++;
      } else if (ITEM_CHARS.includes(s.ch)) this.items.push(new Item(s.ch, cx, bottom));
    }
    if (this.attract) {
      this.player = null;
      this.cam.x = 0;
      this.cam.y = clamp(start.bottom - this.viewH / 2, 0, Math.max(0, this.level.pxH - this.viewH));
      return;
    }
    const p = new Player(start.cx, start.bottom);
    if (opts.inv) p.applyInventory(opts.inv);
    this.player = p;
    this.startInv = p.inventory();
    this.snapCamera();
    if (def.episode) HUD.center(def.name + ': ' + def.title, 3);
    else if (def.intro) HUD.center(def.intro, 5);
    Music.start(def.music || 55);
  },

  nextLevel() {
    const def = this.levelDef;
    if (!def.next) { this.startFinale(); return; }
    const inv = this.player.inventory();
    inv.health = clamp(inv.health, 50, 100);
    this.loadLevel(def.next, { inv });
    this.state = 'playing';
  },

  startIntermission() {
    this.state = 'intermission';
    this.interT = 0;
    const idx = LEVELS.filter((l) => l.episode).findIndex((l) => l.id === this.levelDef.next);
    if (idx >= 0) Store.set('unlocked', Math.max(Store.get('unlocked', 1), idx + 1));
    Sound.play('secret');
  },

  startFinale() {
    this.state = 'finale';
    this.finaleT = 0;
    Music.start(36);
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
    this.deathMsg = msg;
    HUD.message(msg);
  },

  onBossDefeated() {
    this.level.openAllGates();
    HUD.center('Путь к руне открыт', 3);
    Sound.play('secret');
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

  noise(x, y, r) {
    const p = this.player;
    if (!p || !p.alive) return;
    for (const m of this.monsters) {
      if (m.alive && m.state === 'idle' && dist(m.cx, m.cy, x, y) < r) m.alert(p);
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
      if (m.def.boss && (m.state === 'idle' || m.state === 'dying')) continue;
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

  aimWorld() {
    const p = this.player;
    if (Input.touchMode && Input.aim.id === null) {
      const s = p.shoulder();
      return { x: s.x + Math.cos(p.aim) * 100, y: s.y + Math.sin(p.aim) * 100 };
    }
    return {
      x: this.cam.x + (Input.mouseX * this.dpr - this.offX) / this.scale,
      y: this.cam.y + (Input.mouseY * this.dpr - this.offY) / this.scale,
    };
  },

  cameraTarget() {
    const p = this.player;
    let tx = p.cx - this.viewW / 2, ty = p.cy - this.viewH / 2 + 14;
    if (Input.touchMode) tx += p.facing * 40;
    else if (p.alive) {
      const a = this.aimWorld();
      tx += clamp((a.x - p.cx) * 0.25, -this.viewW * 0.22, this.viewW * 0.22);
      ty += clamp((a.y - p.cy) * 0.25, -this.viewH * 0.2, this.viewH * 0.2);
    }
    return this.clampCam(tx, ty);
  },

  clampCam(tx, ty) {
    const lv = this.level;
    const maxX = lv.pxW - this.viewW, maxY = lv.pxH - this.viewH + 34;
    tx = maxX < 0 ? maxX / 2 : clamp(tx, 0, maxX);
    ty = maxY < 0 ? maxY / 2 : clamp(ty, 0, maxY);
    return { x: tx, y: ty };
  },

  snapCamera() {
    const p = this.player;
    const c = this.clampCam(p.cx - this.viewW / 2, p.cy - this.viewH / 2 + 14);
    this.cam.x = c.x; this.cam.y = c.y;
  },

  // --- обновление ---
  update(dt) {
    this.time += dt;
    HUD.update(dt);
    switch (this.state) {
      case 'menu':
        this.updateAttract(dt);
        Menu.update(dt);
        break;
      case 'paused':
        Menu.update(dt);
        break;
      case 'playing':
        this.updatePlay(dt);
        break;
      case 'intermission':
        this.interT += dt;
        if (this.interT > 1.2 && this.anyKey()) this.nextLevel();
        break;
      case 'finale':
        this.finaleT += dt;
        if (this.finaleT > 3 && this.anyKey()) { Store.set('unlocked', LEVELS.filter((l) => l.episode).length); this.toMenu(); }
        break;
      default: break;
    }
    Input.endFrame();
  },

  anyKey() {
    return Input.clicks.length > 0 || Input.wasPressed('Enter', 'Space', 'Escape', 'NumpadEnter') || (Input.mouseDown && Input.clicks.length > 0);
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
    if (Input.wasPressed('Escape', 'KeyP') || Input.buttonPresses.has('pause')) { this.pause(); return; }
    if (Input.wasPressed('KeyM')) {
      if (Music.playing) Music.stop(); else Music.start(this.levelDef.music || 55);
    }
    this.showStats = Input.isDown('Tab');
    if (p.alive) this.levelTime += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    this.level.update(dt);
    p.update(dt);
    if (p.alive) this.checkTriggers(p);
    for (const m of this.monsters) m.update(dt);
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
    if (!p.alive && p.deadT > 1 && (Input.clicks.length || Input.wasPressed('Space', 'Enter', 'KeyW', 'ArrowUp') || Input.buttonPresses.has('jump'))) this.restartLevel();
  },

  checkTriggers(p) {
    const lv = this.level;
    for (const tp of lv.teleports) {
      if (!overlap(p, tp)) continue;
      FX.teleport(p.cx, p.cy);
      p.x = tp.dest.x - p.w / 2;
      p.y = tp.dest.y - p.h;
      p.vx = 0; p.vy = 0;
      FX.teleport(p.cx, p.cy);
      Sound.play('teleport');
      for (const m of this.monsters) if (m.alive && overlap(m, p)) applyDamage(m, 5000, p, 'telefrag');
      this.snapCamera();
      return;
    }
    for (const e of lv.exits) {
      if (!overlap(p, e)) continue;
      Sound.play('teleport');
      if (e.skill !== null && e.skill !== undefined) {
        this.skill = e.skill;
        HUD.center('Сложность: ' + SKILL_NAMES[e.skill], 2);
        this.loadLevel(this.levelDef.next, { inv: null });
        return;
      }
      this.startIntermission();
      return;
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
          if (p.deadT > 1) HUD.text(ctx, Input.touchMode ? 'Коснитесь экрана, чтобы начать заново' : 'Нажмите огонь, чтобы начать заново', W / 2, H * 0.36 + 20 * u, 6 * u, '#c8a878', 'center');
        } else if (!Input.touchMode) {
          HUD.crosshair(ctx, Input.mouseX * this.dpr, Input.mouseY * this.dpr, u);
        }
        if (Input.touchMode) HUD.drawTouch(ctx, W, H, u);
        if (this.showStats) this.drawLevelStats(ctx, W, H, u, null);
      }
    }
    if (this.state === 'intermission') this.drawLevelStats(ctx, W, H, u, Input.touchMode ? 'Коснитесь, чтобы продолжить' : 'Нажмите огонь, чтобы продолжить');
    if (this.state === 'menu' || this.state === 'paused') Menu.draw(ctx, W, H, u, t);
    if (H > W * 1.15) HUD.text(ctx, 'Поверните устройство горизонтально', W / 2, this.offY - 16 * u, 6 * u, '#c8a060', 'center');
    if (this.state !== 'playing' && !Input.touchMode) HUD.crosshair(ctx, Input.mouseX * this.dpr, Input.mouseY * this.dpr, u * 0.8);
  },

  drawLevelStats(ctx, W, H, u, footer) {
    const def = this.levelDef;
    const k = footer ? clamp(this.interT / 1.2, 0, 1) : 1;
    const rows = [
      ['Время', fmtTime(this.levelTime * k)],
      ['Убито', Math.round(this.kills * k) + ' / ' + this.totalKills],
      ['Секреты', Math.round(this.secrets * k) + ' / ' + this.totalSecrets],
      ['Сложность', SKILL_NAMES[this.skill]],
    ];
    HUD.stats(ctx, W, H, u, def.name + ' ' + def.title, rows, footer, this.time);
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
    lctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // самосветящееся
    lv.drawLiquids(ctx, cam, vw, vh, t, 'lava');
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
    FINALE_TEXT.forEach((line, i) => {
      const n = clamp(chars - used, 0, line.length);
      used += line.length + 4;
      if (n > 0) HUD.text(ctx, line.slice(0, n), W / 2, H * 0.28 + i * size * 2, size, i === FINALE_TEXT.length - 1 ? '#f8d070' : '#d8c098', 'center');
    });
    if (t > 3 && Math.floor(t * 2) % 2 === 0) HUD.text(ctx, 'Нажмите огонь', W / 2, H - 20 * u, 6 * u, '#a08058', 'center');
  },
};
