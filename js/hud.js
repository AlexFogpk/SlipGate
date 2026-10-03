'use strict';
// Интерфейс поверх игры: строка состояния, сообщения, прицел, сенсорные кнопки.

const UI_FONT = '"Press Start 2P", "Courier New", monospace';
const TITLE_FONT = '"Ruslan Display", "Press Start 2P", serif';

const DIGITS = {
  0: ['#####', '##.##', '##.##', '##.##', '##.##', '##.##', '#####'],
  1: ['.##..', '###..', '.##..', '.##..', '.##..', '.##..', '#####'],
  2: ['#####', '...##', '...##', '#####', '##...', '##...', '#####'],
  3: ['#####', '...##', '...##', '.####', '...##', '...##', '#####'],
  4: ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##'],
  5: ['#####', '##...', '##...', '#####', '...##', '...##', '#####'],
  6: ['#####', '##...', '##...', '#####', '##.##', '##.##', '#####'],
  7: ['#####', '...##', '...##', '..##.', '..##.', '.##..', '.##..'],
  8: ['#####', '##.##', '##.##', '#####', '##.##', '##.##', '#####'],
  9: ['#####', '##.##', '##.##', '#####', '...##', '...##', '#####'],
};
const DIGIT_GOLD = ['#f8e0a0', '#f0cc78', '#e0b060', '#cc9848', '#b88038', '#a06a2a', '#88561e'];
const DIGIT_RED = ['#ffb0a0', '#ff8070', '#f05848', '#d84030', '#c02818', '#a01810', '#801008'];
const DIGIT_WHITE = ['#ffffff', '#fff8e0', '#fff0c8', '#ffe8b0', '#f8dc98', '#f0d088', '#e0c078'];
const HUD_BAR = 40;   // высота строки состояния в единицах интерфейса

const HUD = {
  msgs: [],
  centerText: '',
  centerT: 0,
  hitT: 0,
  hitSide: 0,
  flash: {},
  prev: null,
  weaponT: 0,
  barTex: null,

  reset() { this.msgs.length = 0; this.centerT = 0; this.hitT = 0; this.weaponT = 0; this.flash = {}; this.prev = null; },

  message(text) {
    this.msgs.push({ text, t: 3.5 });
    if (this.msgs.length > 4) this.msgs.shift();
  },

  center(text, dur = 2) {
    if (this.centerText === text && this.centerT > 0.3) { this.centerT = Math.max(this.centerT, dur * 0.6); return; }
    this.centerText = text;
    this.centerT = dur;
  },

  hitFrom(x, y) {
    const p = Game.player;
    if (!p) return;
    this.hitSide = x < p.cx - 4 ? -1 : x > p.cx + 4 ? 1 : 0;
    this.hitT = 0.6;
  },

  update(dt) {
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      this.msgs[i].t -= dt;
      if (this.msgs[i].t <= 0) this.msgs.splice(i, 1);
    }
    this.centerT -= dt;
    this.hitT -= dt;
    this.weaponT -= dt;
    for (const k in this.flash) this.flash[k].t -= dt;
  },

  num(ctx, value, x, y, ps, red, align = 'left', minDigits = 1) {
    const s = String(Math.max(0, Math.floor(value))).padStart(minDigits, ' ');
    const cw = 6 * ps;
    let cx = align === 'right' ? x - s.length * cw : x;
    const pal = Array.isArray(red) ? red : red ? DIGIT_RED : DIGIT_GOLD;
    for (const ch of s) {
      const g = DIGITS[ch];
      if (g) {
        ctx.fillStyle = '#1a0e06';
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') ctx.fillRect(cx + c * ps + ps * 0.5, y + r * ps + ps * 0.5, ps, ps);
        for (let r = 0; r < 7; r++) {
          ctx.fillStyle = pal[r];
          for (let c = 0; c < 5; c++) if (g[r][c] === '#') ctx.fillRect(cx + c * ps, y + r * ps, ps, ps);
        }
      }
      cx += cw;
    }
  },

  text(ctx, str, x, y, size, color = '#e8d8b0', align = 'left', shadow = true) {
    ctx.font = `${Math.round(size)}px ${UI_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillText(str, x + Math.max(1, size / 8), y + Math.max(1, size / 8));
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  // --- строка состояния ---
  // Металлическая панель (текстура строится один раз под ширину экрана): полоса
  // инвентаря сверху — оружие с картинками и все патроны, ниже три утопленные
  // секции: броня, лицо и здоровье, патроны текущего оружия.
  barTexture(w) {
    if (this.barTex && this.barTex.width === w) return this.barTex;
    const h = HUD_BAR;
    const c = makeCanvas(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) {
      const k = 1 - (j / h) * 0.35;
      for (let i = 0; i < w; i++) {
        const n = (hash2(i >> 1, j, 3) - 0.5) * 16 + (hash2(i >> 3, j >> 2, 5) - 0.5) * 14 + ((i * 7 + j * 3) % 23 === 0 ? -10 : 0);
        const o = (j * w + i) * 4;
        d[o] = (64 + n) * k; d[o + 1] = (47 + n * 0.8) * k; d[o + 2] = (31 + n * 0.6) * k; d[o + 3] = 245;
      }
    }
    x.putImageData(img, 0, 0);
    const line = (y, col) => { x.fillStyle = col; x.fillRect(0, y, w, 1); };
    line(0, '#a07c4a'); line(1, '#64482a'); line(2, '#1a1008');
    line(14, '#1e140a'); line(15, '#6e5232');
    for (let i = 10; i < w - 4; i += 64) {
      x.fillStyle = '#2a1c0e'; x.fillRect(i, 38, 2, 2); x.fillStyle = '#c8a070'; x.fillRect(i, 38, 1, 1);
    }
    this.barTex = c;
    return c;
  },

  inset(ctx, x, y, w, h, u, glow) {
    ctx.fillStyle = glow || 'rgba(10,6,3,0.62)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#120a04';
    ctx.fillRect(x, y, w, u); ctx.fillRect(x, y, u, h);
    ctx.fillStyle = 'rgba(170,130,80,0.45)';
    ctx.fillRect(x, y + h - u, w, u); ctx.fillRect(x + w - u, y, u, h);
  },

  bar(ctx, x, y, w, h, k, col, u) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    const fw = Math.round(w * clamp(k, 0, 1));
    ctx.fillStyle = col; ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, fw, Math.max(1, u * 0.6));
  },

  // Картинка, вписанная в прямоугольник, пиксели без сглаживания.
  icon(ctx, img, cx, cy, maxW, maxH, scale, alpha = 1) {
    if (!img) return;
    const k = Math.min(scale, maxW / img.width, maxH / img.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, Math.round(cx - img.width * k / 2), Math.round(cy - img.height * k / 2), Math.round(img.width * k), Math.round(img.height * k));
    ctx.globalAlpha = 1;
  },

  // Числа вспыхивают: золотом при подборе, красным при потере. Смена оружия — подпись.
  trackValues(p) {
    const w = WEAPONS[p.weapon];
    const v = { health: p.health, armor: p.armor, ammo: w.ammo ? p.ammo[w.ammo] : -1, weapon: p.weapon, p };
    const prev = this.prev;
    if (prev && prev.p === p) {
      for (const k of ['health', 'armor']) if (v[k] !== prev[k]) this.flash[k] = { t: 0.45, up: v[k] > prev[k] };
      if (v.weapon === prev.weapon && v.ammo > prev.ammo) this.flash.ammo = { t: 0.45, up: true };
      if (v.weapon !== prev.weapon) this.weaponT = 1.6;
    }
    this.prev = v;
  },

  digitPal(key, low) {
    const f = this.flash[key];
    if (f && f.t > 0 && Math.floor(f.t * 16) % 2 === 0) return f.up ? DIGIT_WHITE : DIGIT_RED;
    return low ? DIGIT_RED : DIGIT_GOLD;
  },

  draw(ctx, W, H, u, t) {
    const p = Game.player;
    if (!p) return;
    this.trackValues(p);
    const VW = W / u;
    const by = H - HUD_BAR * u;

    // мало здоровья — по краям экрана пульсирует красное
    if (p.alive && p.health <= 25) {
      const a = 0.16 + Math.sin(t * 6) * 0.08;
      const g = ctx.createRadialGradient(W / 2, by / 2, Math.min(W, by) * 0.35, W / 2, by / 2, Math.max(W, by) * 0.75);
      g.addColorStop(0, 'rgba(150,0,0,0)');
      g.addColorStop(1, `rgba(150,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, by);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.barTexture(Math.ceil(VW)), 0, by, Math.ceil(VW) * u, HUD_BAR * u);

    const cw = Math.min(VW - 8, 440);
    const x0 = (VW - cw) / 2;
    const X = (v) => Math.round((x0 + v) * u);
    const rowY = Math.round(by + 3.5 * u), rowH = Math.round(10 * u);

    // оружие: картинки в ячейках, номер в углу, выбранное — в золотой рамке
    const slotW = Math.min(26, (cw * 0.6) / 9);
    for (let n = 1; n <= 9; n++) {
      const sx = X((n - 1) * slotW), sw = Math.round((slotW - 1.5) * u);
      const owned = p.weapons[n], cur = p.weapon === n;
      const empty = owned && !p.hasAmmoFor(n);
      this.inset(ctx, sx, rowY, sw, rowH, u, cur ? 'rgba(150,100,30,0.55)' : null);
      if (owned) this.icon(ctx, gunImg(n, t), sx + sw / 2 + u, rowY + rowH / 2 + 0.5 * u, sw - 4 * u, rowH - 3 * u, u, empty ? 0.35 : cur ? 1 : 0.8);
      if (cur) {
        ctx.fillStyle = '#f0c870';
        ctx.fillRect(sx, rowY, sw, u); ctx.fillRect(sx, rowY + rowH - u, sw, u);
        ctx.fillRect(sx, rowY, u, rowH); ctx.fillRect(sx + sw - u, rowY, u, rowH);
      }
      this.text(ctx, String(n), sx + 1.5 * u, rowY + 1.3 * u, Math.max(3.6 * u, 6), cur ? '#fff0c0' : empty ? '#c05040' : owned ? '#c8a060' : '#4a3a28', 'left', false);
    }
    // все патроны: значок и число, патроны текущего оружия подсвечены
    const ammoX = 9 * slotW + 3;
    const aw = (cw - ammoX) / 4;
    const curAmmo = WEAPONS[p.weapon].ammo;
    ['shells', 'nails', 'rockets', 'cells'].forEach((k, i) => {
      const ax = X(ammoX + i * aw), axw = Math.round((aw - 2) * u);
      const active = curAmmo === k;
      this.inset(ctx, ax, rowY, axw, rowH, u, active ? 'rgba(150,100,30,0.55)' : null);
      this.icon(ctx, ammoIcon(k), ax + 5 * u, rowY + rowH / 2, 8 * u, rowH - 2 * u, u * 0.95);
      const v = p.ammo[k];
      this.text(ctx, String(v), ax + 10 * u, rowY + 2.7 * u, Math.max(5 * u, 7), v === 0 ? '#7a4a30' : active ? '#fff0c0' : '#c8a060', 'left', false);
      if (active) { ctx.fillStyle = '#f0c870'; ctx.fillRect(ax, rowY + rowH - u, axw, u); }
    });

    // три секции: броня, здоровье, патроны
    const py = Math.round(by + 16.5 * u), ph = Math.round(21 * u);
    const third = cw / 3;
    const ps = 2 * u;
    const panel = (i) => ({ x: X(i * third), w: Math.round((third - 3) * u) });
    // броня
    {
      const { x, w } = panel(0);
      this.inset(ctx, x, py, w, ph, u);
      const kind = p.armorType >= 0.8 ? 'R' : p.armorType >= 0.6 ? 'Y' : 'A';
      this.icon(ctx, itemImg(kind), x + 11 * u, py + ph / 2 - u, 16 * u, 15 * u, u * 1.15, p.armor > 0 ? 1 : 0.22);
      const jx = this.flash.armor && this.flash.armor.t > 0 && !this.flash.armor.up ? Math.round(Math.sin(t * 90) * u) : 0;
      this.num(ctx, p.armor, x + 22 * u + jx, py + 2.5 * u, ps, this.digitPal('armor', false));
      const col = { A: '#4aa03a', Y: '#d8b030', R: '#c83028' }[kind];
      this.bar(ctx, x + 22 * u, py + ph - 4.5 * u, w - 26 * u, 2 * u, p.armor / 200, col, u);
    }
    // лицо и здоровье
    {
      const { x, w } = panel(1);
      const low = p.health <= 25;
      this.inset(ctx, x, py, w, ph, u, low && Math.floor(t * 4) % 2 ? 'rgba(90,10,6,0.6)' : null);
      drawFace(ctx, x + 3 * u, py + 3 * u, u, p, t);
      const jx = this.flash.health && this.flash.health.t > 0 && !this.flash.health.up ? Math.round(Math.sin(t * 90) * u) : 0;
      this.num(ctx, p.health, x + 22 * u + jx, py + 2.5 * u, ps, this.digitPal('health', low));
      const bx = x + 22 * u, bw = w - 26 * u;
      this.bar(ctx, bx, py + ph - 4.5 * u, bw, 2 * u, p.health / 100, low ? '#e03020' : '#c84030', u);
      if (p.health > 100) { ctx.fillStyle = '#6a8cff'; ctx.fillRect(bx, py + ph - 4.5 * u, Math.round(bw * clamp((p.health - 100) / 100, 0, 1)), 2 * u); }
    }
    // патроны текущего оружия
    {
      const { x, w } = panel(2);
      this.inset(ctx, x, py, w, ph, u);
      const wd = WEAPONS[p.weapon];
      if (wd.ammo) {
        const v = p.ammo[wd.ammo];
        this.icon(ctx, itemImg(AMMO_ITEM[wd.ammo]), x + 11 * u, py + ph / 2 - u, 16 * u, 15 * u, u * 1.1);
        this.num(ctx, v, x + 22 * u, py + 2.5 * u, ps, this.digitPal('ammo', v === 0));
        this.bar(ctx, x + 22 * u, py + ph - 4.5 * u, w - 26 * u, 2 * u, v / AMMO_MAX[wd.ammo], '#d8a040', u);
      } else {
        this.icon(ctx, gunImg(1), x + 11 * u, py + ph / 2, 16 * u, 14 * u, u * 1.2);
        this.text(ctx, 'ТОПОР', x + 22 * u, py + 6 * u, 6 * u, '#c8a060', 'left', false);
      }
    }
    // ключи: в правом поле строки, а если его нет — над секцией патронов
    const keys = [p.keys.silver && '#c8d0dc', p.keys.gold && '#e8b830'].filter(Boolean);
    if (keys.length) {
      const margin = (VW - cw) / 2;
      const kx0 = margin >= 30 ? W - 15 * u : X(cw) - 13 * u;
      const ky = margin >= 30 ? py + 3 * u : by - 15 * u;
      keys.forEach((col, i) => {
        const kx = kx0 - i * 14 * u;
        this.inset(ctx, kx - 6 * u, ky - 1 * u, 12 * u, 14 * u, u);
        ctx.save(); ctx.translate(kx, ky + 6 * u); ctx.scale(u * 1.4, u * 1.4); drawKeyIcon(ctx, 0, 0, col); ctx.restore();
      });
    }

    // название оружия при смене
    if (this.weaponT > 0) {
      ctx.globalAlpha = clamp(this.weaponT * 2, 0, 1);
      this.text(ctx, WEAPONS[p.weapon].name.toUpperCase(), W / 2, by - 12 * u, 6 * u, '#f0d080', 'center');
      ctx.globalAlpha = 1;
    }

    // усиления: значок в круге, кольцо — сколько осталось
    const pw = [['quad', 'Q', '#4a68ff'], ['pent', 'X', '#ff3020'], ['ring', 'V', '#d0a030'], ['suit', 'W', '#3a9a4a']];
    let pi = 0;
    for (const [k, ch, col] of pw) {
      if (!(p[k] > 0)) continue;
      const cx = W - 16 * u, cy = 16 * u + pi * 24 * u;
      const blink = p[k] < 3 && Math.floor(t * 6) % 2;
      ctx.fillStyle = 'rgba(10,6,3,0.7)';
      ctx.beginPath(); ctx.arc(cx, cy, 10 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.arc(cx, cy, 10 * u, 0, TAU); ctx.stroke();
      ctx.strokeStyle = blink ? '#ffffff' : col;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.arc(cx, cy, 10 * u, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p[k] / 30, 0, 1)); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy + 6.5 * u); ctx.scale(u * 0.9, u * 0.9);
      drawItem(ctx, 0, 0, { ch, dropped: true, phase: 0 }, t);
      ctx.restore();
      this.text(ctx, String(Math.ceil(p[k])), cx - 13 * u, cy - 3 * u, 6 * u, blink ? '#ffffff' : '#fff0c0', 'right');
      pi++;
    }

    // воздух под водой
    if (p.waterLevel === 3 && p.suit <= 0) {
      const bw = 70 * u, bx = Math.round((W - bw) / 2), byy = Math.round(by - 24 * u);
      this.inset(ctx, bx - 2 * u, byy - 2 * u, bw + 4 * u, 8 * u, u);
      this.bar(ctx, bx, byy, bw, 4 * u, p.air / 12, p.air > 3 ? '#6ab0e0' : '#e05040', u);
      this.text(ctx, 'ВОЗДУХ', bx - 4 * u, byy - 0.5 * u, 4.5 * u, '#a8d0f0', 'right');
    }

    // полоска здоровья Вестника и Древнего
    const boss = Game.monsters.find((m) => (m.type === 'herald' || m.type === 'elder') && m.alive && m.state !== 'idle');
    if (boss) {
      const bw = Math.min(W * 0.5, 220 * u), bx = (W - bw) / 2, byy = 8 * u;
      const elder = boss.type === 'elder';
      const shielded = elder ? boss.elderShielded() : boss.heraldShielded();
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 2 * u, byy - 2 * u, bw + 4 * u, 9 * u);
      ctx.fillStyle = shielded ? (elder ? '#2a5a7a' : '#5a3a7a') : '#b02a20';
      ctx.fillRect(bx, byy, bw * clamp(boss.health / boss.maxHealth, 0, 1), 5 * u);
      let label;
      if (elder) {
        const lit = Game.level.buttons.filter((b) => b.lit).length;
        label = 'ДРЕВНИЙ' + (shielded ? '  ·  барьер, рун: ' + lit + '/' + Game.level.buttons.length : '');
      } else {
        const pylons = Game.monsters.filter((m) => m.type === 'pylon' && m.alive).length;
        label = 'ВЕСТНИК БЕЗДНЫ' + (shielded ? '  ·  щит, кристаллов: ' + pylons : '');
      }
      this.text(ctx, label, W / 2, byy + 8 * u, 5 * u, shielded ? (elder ? '#a0e8ff' : '#d0a0ff') : '#f0c0a0', 'center');
    }
    // сообщения
    let myy = 6 * u;
    for (const m of this.msgs) {
      ctx.globalAlpha = clamp(m.t, 0, 1);
      this.text(ctx, m.text, 6 * u, myy, 6.5 * u, '#e8d8b0');
      myy += 10 * u;
    }
    ctx.globalAlpha = 1;
    if (this.centerT > 0 && Game.state === 'playing') {
      ctx.globalAlpha = clamp(this.centerT * 2, 0, 1);
      const lines = this.centerText.split('\n');
      const size = Math.min(9 * u, (W * 0.9) / Math.max(...lines.map((l) => l.length)));
      lines.forEach((l, i) => this.text(ctx, l, W / 2, H * 0.3 + i * size * 1.5, size, '#f0d898', 'center'));
      ctx.globalAlpha = 1;
    }
    if (this.hitT > 0 && this.hitSide !== 0) {
      const gw = W * 0.12;
      const gx = this.hitSide < 0 ? 0 : W - gw;
      const gr = ctx.createLinearGradient(this.hitSide < 0 ? 0 : W, 0, this.hitSide < 0 ? gw : W - gw, 0);
      gr.addColorStop(0, `rgba(200,20,10,${0.5 * this.hitT})`);
      gr.addColorStop(1, 'rgba(200,20,10,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(gx, 0, gw, by);
    }
  },

  crosshair(ctx, x, y, u) {
    const s = Math.max(1, Math.round(u));
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 5 * s, y - s, 4 * s, 3 * s); ctx.fillRect(x + 2 * s, y - s, 4 * s, 3 * s);
    ctx.fillRect(x - s, y - 5 * s, 3 * s, 4 * s); ctx.fillRect(x - s, y + 2 * s, 3 * s, 4 * s);
    ctx.fillStyle = '#f0e0b0';
    ctx.fillRect(x - 4 * s, y, 3 * s, s); ctx.fillRect(x + 2 * s, y, 3 * s, s);
    ctx.fillRect(x, y - 4 * s, s, 3 * s); ctx.fillRect(x, y + 2 * s, s, 3 * s);
    ctx.fillStyle = '#ff5030';
    ctx.fillRect(x, y, s, s);
  },

  layoutTouch(W, H, u) {
    const by = H - HUD_BAR * u;
    Input.touchButtons = [
      { name: 'pause', x: W - 18 * u, y: 18 * u, r: 13 * u, label: 'II' },
      { name: 'next', x: W - 22 * u, y: by - 58 * u, r: 16 * u, label: '⇄' },
      { name: 'jump', x: W - 58 * u, y: by - 26 * u, r: 20 * u, label: '▲' },
      { name: 'map', x: W - 48 * u, y: 18 * u, r: 11 * u, label: '▦' },
    ];
  },

  drawTouch(ctx, W, H, u) {
    ctx.save();
    for (const b of Input.touchButtons) {
      const held = Input.buttonHeld(b.name);
      ctx.fillStyle = held ? 'rgba(240,200,120,0.35)' : 'rgba(30,20,12,0.45)';
      ctx.strokeStyle = 'rgba(240,200,120,0.6)';
      ctx.lineWidth = u;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0d898';
      ctx.font = `${Math.round(b.r * 0.9)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y + 1);
    }
    const st = Input.stick;
    const bx = st.id !== null ? st.ox : W * 0.14, byy = st.id !== null ? st.oy : H * 0.62;
    ctx.globalAlpha = st.id !== null ? 0.8 : 0.35;
    ctx.strokeStyle = 'rgba(240,200,120,0.7)';
    ctx.lineWidth = u;
    ctx.beginPath(); ctx.arc(bx, byy, 40, 0, TAU); ctx.stroke();
    const v = Input.stickVec();
    ctx.fillStyle = 'rgba(240,200,120,0.5)';
    ctx.beginPath(); ctx.arc(bx + v.x * 30, byy + v.y * 30, 16, 0, TAU); ctx.fill();
    ctx.restore();
  },

  // Таблица уровня (Tab) и итоги (антракт).
  stats(ctx, W, H, u, title, rows, footer, t) {
    ctx.fillStyle = 'rgba(12,8,5,0.82)';
    const pw = Math.min(W - 16 * u, 300 * u), ph = (46 + rows.length * 18) * u + (footer ? 16 * u : 0);
    const px = (W - pw) / 2, py = (H - ph) / 2 - 10 * u;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = u;
    ctx.strokeRect(px + u / 2, py + u / 2, pw - u, ph - u);
    ctx.font = `${Math.round(14 * u)}px ${TITLE_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#1a0e06'; ctx.fillText(title, W / 2 + u, py + 11 * u);
    ctx.fillStyle = '#e0b060'; ctx.fillText(title, W / 2, py + 10 * u);
    rows.forEach(([label, value], i) => {
      const ry = py + (38 + i * 18) * u;
      this.text(ctx, label, px + 16 * u, ry, 7 * u, '#c8a878');
      this.text(ctx, value, px + pw - 16 * u, ry, 7 * u, '#f8e0a0', 'right');
    });
    if (footer && Math.floor(t * 2) % 2 === 0) this.text(ctx, footer, W / 2, py + ph - 16 * u, 6 * u, '#a08058', 'center');
  },
};
