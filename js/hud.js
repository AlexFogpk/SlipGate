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

const HUD = {
  msgs: [],
  centerText: '',
  centerT: 0,
  hitT: 0,
  hitSide: 0,

  reset() { this.msgs.length = 0; this.centerT = 0; this.hitT = 0; },

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
  },

  num(ctx, value, x, y, ps, red, align = 'left', minDigits = 1) {
    const s = String(Math.max(0, Math.floor(value))).padStart(minDigits, ' ');
    const cw = 6 * ps;
    let cx = align === 'right' ? x - s.length * cw : x;
    const pal = red ? DIGIT_RED : DIGIT_GOLD;
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

  draw(ctx, W, H, u, t) {
    const p = Game.player;
    if (!p) return;
    const VW = W / u;
    const barH = 32;
    const by = H - barH * u;
    // подложка
    const g = ctx.createLinearGradient(0, by, 0, H);
    g.addColorStop(0, 'rgba(46,32,20,0.92)');
    g.addColorStop(1, 'rgba(20,13,8,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, by, W, barH * u);
    ctx.fillStyle = '#7a5a34'; ctx.fillRect(0, by, W, Math.max(1, u));
    ctx.fillStyle = '#2a1a0c'; ctx.fillRect(0, by + u, W, Math.max(1, u));

    const cw = Math.min(VW - 8, 400);
    const x0 = (VW - cw) / 2;
    const X = (v) => (x0 + v) * u;
    const rowY = by + 3 * u;

    // слоты оружия
    const slotW = Math.min(20, cw * 0.4 / 8);
    for (let n = 1; n <= 8; n++) {
      const sx = X((n - 1) * slotW);
      const owned = p.weapons[n];
      const cur = p.weapon === n;
      ctx.fillStyle = cur ? '#8a6428' : owned ? '#3a2a18' : '#1e140c';
      ctx.fillRect(sx, rowY, (slotW - 2) * u, 9 * u);
      if (cur) { ctx.fillStyle = '#f0c870'; ctx.fillRect(sx, rowY, (slotW - 2) * u, u); }
      this.text(ctx, String(n), sx + (slotW - 2) * u / 2, rowY + 1.5 * u, 6 * u, owned ? (cur ? '#fff0c0' : '#c8a060') : '#4a3a28', 'center', false);
    }
    // счётчики патронов
    const ammoX = 8 * slotW + 6;
    const kinds = [['shells', '#c04020'], ['nails', '#9a9aa4'], ['rockets', '#b07030'], ['cells', '#e0c030']];
    const aw = (cw - ammoX) / 4;
    kinds.forEach(([k, col], i) => {
      const ax = X(ammoX + i * aw);
      const active = WEAPONS[p.weapon].ammo === k;
      ctx.fillStyle = col; ctx.fillRect(ax, rowY + 2 * u, 4 * u, 5 * u);
      this.text(ctx, String(p.ammo[k]), ax + 6 * u, rowY + 1.5 * u, 6 * u, active ? '#fff0c0' : '#a88858', 'left', false);
    });

    // броня / лицо+здоровье / патроны текущего оружия
    const my = by + 14 * u;
    const ps = 2 * u;
    const third = cw / 3;
    if (p.armor > 0) {
      const col = p.armorType >= 0.8 ? '#b02020' : p.armorType >= 0.6 ? '#c0a020' : '#3a8a2e';
      const ax = X(4), ay = my;
      ctx.fillStyle = col; ctx.fillRect(ax, ay, 12 * u, 13 * u);
      ctx.fillStyle = '#000'; ctx.fillRect(ax + 4 * u, ay, 4 * u, 2 * u);
      ctx.fillStyle = shade(col, 0.6); ctx.fillRect(ax + 5.5 * u, ay + 2 * u, u, 11 * u);
    } else {
      ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = u;
      ctx.strokeRect(X(4) + u / 2, my + u / 2, 11 * u, 12 * u);
    }
    this.num(ctx, p.armor, X(20), my - 0.5 * u, ps, false);

    drawFace(ctx, X(third + 4), my - 2 * u, u, p, t);
    this.num(ctx, p.health, X(third + 22), my - 0.5 * u, ps, p.health <= 25);

    const w = WEAPONS[p.weapon];
    if (w.ammo) {
      const col = { shells: '#c04020', nails: '#9a9aa4', rockets: '#b07030', cells: '#e0c030' }[w.ammo];
      ctx.fillStyle = col; ctx.fillRect(X(third * 2 + 4), my + u, 9 * u, 11 * u);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X(third * 2 + 4), my + 7 * u, 9 * u, 5 * u);
      this.num(ctx, p.ammo[w.ammo], X(third * 2 + 17), my - 0.5 * u, ps, p.ammo[w.ammo] === 0);
    } else this.text(ctx, 'ТОПОР', X(third * 2 + 4), my + 3 * u, 7 * u, '#c8a060', 'left', false);

    // ключи и усиления (правый край)
    let kx = W - 6 * u;
    const drawIco = (fn) => { kx -= 13 * u; fn(kx); };
    if (p.keys.gold) drawIco((x) => { ctx.save(); ctx.translate(x + 6 * u, my + 6 * u); ctx.scale(u * 1.4, u * 1.4); drawKeyIcon(ctx, 0, 0, '#e8b830'); ctx.restore(); });
    if (p.keys.silver) drawIco((x) => { ctx.save(); ctx.translate(x + 6 * u, my + 6 * u); ctx.scale(u * 1.4, u * 1.4); drawKeyIcon(ctx, 0, 0, '#c8d0dc'); ctx.restore(); });
    const pw = [['quad', '#4a68ff'], ['pent', '#ff3020'], ['ring', '#d0a030'], ['suit', '#3a9a4a']];
    let py = 6 * u;
    for (const [k, col] of pw) {
      if (p[k] > 0) {
        const blink = p[k] < 3 && Math.floor(t * 6) % 2;
        ctx.fillStyle = blink ? '#ffffff' : col;
        ctx.fillRect(W - 44 * u, py, 8 * u, 8 * u);
        this.text(ctx, String(Math.ceil(p[k])), W - 34 * u, py + u, 7 * u, '#fff0c0');
        py += 11 * u;
      }
    }
    // воздух под водой
    if (p.waterLevel === 3 && p.suit <= 0) {
      const bw = 60 * u, bx = (W - bw) / 2, byy = by - 10 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - u, byy - u, bw + 2 * u, 6 * u);
      ctx.fillStyle = p.air > 3 ? '#6ab0e0' : '#e05040';
      ctx.fillRect(bx, byy, bw * clamp(p.air / 12, 0, 1), 4 * u);
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
    const by = H - 32 * u;
    Input.touchButtons = [
      { name: 'pause', x: W - 18 * u, y: 18 * u, r: 13 * u, label: 'II' },
      { name: 'next', x: W - 22 * u, y: by - 58 * u, r: 16 * u, label: '⇄' },
      { name: 'jump', x: W - 58 * u, y: by - 26 * u, r: 20 * u, label: '▲' },
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
