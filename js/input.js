'use strict';
// Клавиатура, мышь и сенсорное управление (виртуальный стик + прицел пальцем).

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

  init(canvas) {
    this.canvas = canvas;
    const block = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
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

  moveAxis() {
    let x = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    const s = this.stickVec();
    if (s.x) x = s.x;
    return clamp(x, -1, 1);
  },
  jumpHeld() {
    return this.isDown('Space', 'KeyW', 'ArrowUp') || this.stickVec().y < -0.55 || this.buttonHeld('jump');
  },
  downHeld() {
    return this.isDown('KeyS', 'ArrowDown') || this.stickVec().y > 0.6;
  },
  fireHeld() {
    return this.mouseDown || this.aim.id !== null || this.isDown('ControlLeft', 'KeyJ');
  },

  endFrame() {
    this.pressed.clear();
    this.buttonPresses.clear();
    this.wheel = 0;
    this.clicks.length = 0;
    this.mouseMoved = false;
  },
};
