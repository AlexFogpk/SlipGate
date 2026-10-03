'use strict';
// Клавиатура, мышь, геймпад и сенсорное управление (виртуальный стик + прицел пальцем).
// Игра спрашивает не клавиши, а действия (act/actPressed): клавиши действий можно
// переназначить в настройках, кнопки геймпада приходят как виртуальные коды Pad*.

// Действия и их клавиши по умолчанию. Первая клавиша — основная, её меняет экран «Клавиши».
const KEY_ACTIONS = [
  { id: 'left', name: 'Влево', keys: ['KeyA', 'ArrowLeft'], pad: ['PadLeft'] },
  { id: 'right', name: 'Вправо', keys: ['KeyD', 'ArrowRight'], pad: ['PadRight'] },
  { id: 'jump', name: 'Прыжок, всплытие', keys: ['Space', 'KeyW', 'ArrowUp'], pad: ['PadA', 'PadLT'] },
  { id: 'down', name: 'Вниз, нырок', keys: ['KeyS', 'ArrowDown'], pad: ['PadDown'] },
  { id: 'fire', name: 'Огонь (и левая кнопка мыши)', keys: ['ControlLeft', 'KeyJ'], pad: ['PadRT', 'PadX'] },
  { id: 'next', name: 'Следующее оружие', keys: ['KeyE'], pad: ['PadRB', 'PadY'] },
  { id: 'prev', name: 'Предыдущее оружие', keys: ['KeyQ'], pad: ['PadLB'] },
  { id: 'map', name: 'Карта (пока держите)', keys: ['Tab'], pad: [] },
  { id: 'mapPin', name: 'Карта вкл/выкл', keys: ['KeyN'], pad: ['PadBack'] },
  { id: 'music', name: 'Музыка вкл/выкл', keys: ['KeyM'], pad: [] },
];
// Кнопки геймпада в стандартной раскладке → виртуальные коды
const PAD_BUTTONS = ['PadA', 'PadB', 'PadX', 'PadY', 'PadLB', 'PadRB', 'PadLT', 'PadRT', 'PadBack', 'PadStart', 'PadL3', 'PadR3', 'PadUp', 'PadDown', 'PadLeft', 'PadRight'];
const KEY_NAMES = {
  Space: 'Пробел', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ControlLeft: 'Ctrl', ControlRight: 'Правый Ctrl',
  ShiftLeft: 'Shift', ShiftRight: 'Правый Shift', AltLeft: 'Alt', AltRight: 'Правый Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace',
  Escape: 'Esc', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
  Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', NumpadEnter: 'Num Enter', Insert: 'Insert', Delete: 'Delete',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
};
function keyName(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

const Input = {
  down: new Set(),
  pressed: new Set(),
  mouseX: 0, mouseY: 0,
  mouseDown: false,
  mouseMoved: false,
  wheel: 0,
  clicks: [],
  touchMode: false,
  stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  aim: { id: null, x: 0, y: 0 },
  touchButtons: [],        // заполняется HUD: {name, x, y, r}
  heldButtons: new Map(),  // pointerId -> name
  buttonPresses: new Set(),
  canvas: null,
  binds: {},               // действие -> клавиши клавиатуры
  capture: null,           // ожидание новой клавиши для действия (экран «Клавиши»)
  padMode: false,          // играем с геймпада: прицел правым стиком
  padIndex: null,
  padPrev: [],
  padMove: 0, padY: 0,
  padAngle: 0,

  init(canvas) {
    this.canvas = canvas;
    this.loadBinds();
    const block = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (this.capture) {
        // экран «Клавиши» ждёт новую клавишу: Esc отменяет
        e.preventDefault();
        if (e.repeat) return;
        const cb = this.capture;
        this.capture = null;
        cb(e.code === 'Escape' ? null : e.code);
        return;
      }
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.touchMode = false;
      Sound.init();
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouseDown = false; });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  },

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  },

  onPointerDown(e) {
    Sound.init();
    const p = this.pos(e);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault();
      this.touchMode = true;
      this.clicks.push({ x: p.x, y: p.y });
      for (const b of this.touchButtons) {
        if (dist(p.x, p.y, b.x, b.y) <= b.r) {
          this.heldButtons.set(e.pointerId, b.name);
          this.buttonPresses.add(b.name);
          return;
        }
      }
      if (p.x < p.w * 0.4) {
        if (this.stick.id === null) {
          this.stick.id = e.pointerId;
          this.stick.ox = p.x; this.stick.oy = p.y;
          this.stick.x = p.x; this.stick.y = p.y;
        }
      } else if (this.aim.id === null) {
        this.aim.id = e.pointerId;
        this.aim.x = p.x; this.aim.y = p.y;
        this.mouseX = p.x; this.mouseY = p.y;
      }
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      return;
    }
    this.touchMode = false;
    this.padMode = false;
    this.mouseX = p.x; this.mouseY = p.y;
    if (e.button === 0) {
      this.mouseDown = true;
      this.clicks.push({ x: p.x, y: p.y });
    } else if (e.button === 2) {
      this.pressed.add('Mouse2');
    }
  },

  onPointerMove(e) {
    const p = this.pos(e);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (e.pointerId === this.stick.id) { this.stick.x = p.x; this.stick.y = p.y; }
      if (e.pointerId === this.aim.id) {
        this.aim.x = p.x; this.aim.y = p.y;
        this.mouseX = p.x; this.mouseY = p.y;
      }
      return;
    }
    if (Math.abs(p.x - this.mouseX) + Math.abs(p.y - this.mouseY) > 3) this.padMode = false;
    this.mouseX = p.x; this.mouseY = p.y;
    this.mouseMoved = true;
  },

  onPointerUp(e) {
    if (e.pointerId === this.stick.id) this.stick.id = null;
    if (e.pointerId === this.aim.id) this.aim.id = null;
    this.heldButtons.delete(e.pointerId);
    if (e.pointerType === 'mouse' && e.button === 0) this.mouseDown = false;
  },

  stickVec() {
    if (this.stick.id === null) return { x: 0, y: 0 };
    const r = 40;
    const dx = clamp((this.stick.x - this.stick.ox) / r, -1, 1);
    const dy = clamp((this.stick.y - this.stick.oy) / r, -1, 1);
    return { x: Math.abs(dx) < 0.25 ? 0 : dx, y: Math.abs(dy) < 0.25 ? 0 : dy };
  },

  buttonHeld(name) {
    for (const v of this.heldButtons.values()) if (v === name) return true;
    return false;
  },

  isDown(...codes) { return codes.some((c) => this.down.has(c)); },
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); },

  // --- действия и привязки ---
  loadBinds() {
    const saved = Store.get('keys', {});
    for (const a of KEY_ACTIONS) this.binds[a.id] = Array.isArray(saved[a.id]) ? saved[a.id].slice() : a.keys.slice();
  },
  codes(id) {
    const a = KEY_ACTIONS.find((x) => x.id === id);
    return (this.binds[id] || []).concat(a ? a.pad : []);
  },
  act(id) { return this.isDown(...this.codes(id)); },
  actPressed(id) { return this.wasPressed(...this.codes(id)); },
  // Новая основная клавиша действия; у других действий она отбирается.
  rebind(id, code) {
    for (const a of KEY_ACTIONS) if (a.id !== id) this.binds[a.id] = this.binds[a.id].filter((c) => c !== code);
    // прежняя основная клавиша уступает место, запасные остаются
    this.binds[id] = [code].concat(this.binds[id].slice(1).filter((c) => c !== code));
    Store.set('keys', this.binds);
  },
  resetBinds() {
    for (const a of KEY_ACTIONS) this.binds[a.id] = a.keys.slice();
    Store.set('keys', this.binds);
  },

  // --- геймпад (стандартная раскладка браузера) ---
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = this.padIndex !== null ? pads[this.padIndex] : null;
    if (!pad) {
      pad = null; this.padIndex = null;
      for (const g of pads) if (g && g.connected) { pad = g; this.padIndex = g.index; break; }
    }
    if (!pad) { this.padMove = 0; this.padY = 0; return; }
    const dz = (v) => (Math.abs(v) < 0.25 ? 0 : v);
    const ax = pad.axes || [];
    const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = ax[2] || 0, ry = ax[3] || 0;
    let active = false;
    PAD_BUTTONS.forEach((code, i) => {
      const b = pad.buttons[i];
      let on = !!b && (b.pressed || b.value > 0.4);
      // стик тоже нажимает «стрелки» — для меню
      if (code === 'PadUp' && ly < -0.6) on = true;
      if (code === 'PadDown' && ly > 0.6) on = true;
      if (code === 'PadLeft' && lx < -0.6) on = true;
      if (code === 'PadRight' && lx > 0.6) on = true;
      if (on) { active = true; if (!this.padPrev[i]) this.pressed.add(code); this.down.add(code); }
      else this.down.delete(code);
      this.padPrev[i] = on;
    });
    this.padMove = lx;
    this.padY = ly;
    if (Math.hypot(rx, ry) > 0.35) { this.padAngle = Math.atan2(ry, rx); active = true; }
    // правый стик отпущен: бег в другую сторону разворачивает прицел, сохраняя наклон
    else if (Math.abs(lx) > 0.5 && Math.cos(this.padAngle) * lx < 0) this.padAngle = Math.PI - this.padAngle;
    if (lx || ly) active = true;
    if (active) { this.padMode = true; this.touchMode = false; Sound.init(); }
  },

  moveAxis() {
    let x = 0;
    if (this.act('left')) x -= 1;
    if (this.act('right')) x += 1;
    if (this.padMove) x = this.padMove;
    const s = this.stickVec();
    if (s.x) x = s.x;
    return clamp(x, -1, 1);
  },
  jumpHeld() {
    return this.act('jump') || this.stickVec().y < -0.55 || this.buttonHeld('jump');
  },
  downHeld() {
    return this.act('down') || this.stickVec().y > 0.6 || this.padY > 0.6;
  },
  fireHeld() {
    return this.mouseDown || this.aim.id !== null || this.act('fire');
  },

  endFrame() {
    this.pressed.clear();
    this.buttonPresses.clear();
    this.wheel = 0;
    this.clicks.length = 0;
    this.mouseMoved = false;
  },
};
