'use strict';
// Меню: главное, пауза, настройки, выбор уровня и сложности, управление.

const SKILL_NAMES = ['Лёгкий', 'Нормальный', 'Сложный', 'Кошмар'];

const Menu = {
  screen: 'main',
  sel: 0,
  stack: [],
  pendingLevel: null,
  hitboxes: [],

  open(screen) {
    this.stack.push(this.screen);
    this.screen = screen;
    this.sel = 0;
  },
  reset(screen) { this.stack = []; this.screen = screen; this.sel = 0; },
  back() {
    Sound.play('menu');
    if (this.stack.length) { this.screen = this.stack.pop(); this.sel = 0; return; }
    if (this.screen === 'pause') Game.resume();
  },

  items() {
    switch (this.screen) {
      case 'main': return [
        { label: 'Новая игра', act: () => this.open('episodes') },
        { label: 'Выбор уровня', act: () => this.open('levelEp') },
        { label: 'Настройки', act: () => this.open('options') },
        { label: 'Управление', act: () => this.open('help') },
      ];
      case 'pause': return [
        { label: 'Продолжить', act: () => Game.resume() },
        { label: 'Начать уровень заново', act: () => Game.restartLevel() },
        { label: 'Настройки', act: () => this.open('options') },
        { label: 'Управление', act: () => this.open('help') },
        { label: 'Главное меню', act: () => Game.toMenu() },
      ];
      case 'options': return [
        { label: 'Звуки: ' + Math.round(Sound.volume * 100) + '%', adj: (d) => Sound.setVolume(Math.round((Sound.volume + d * 0.1) * 10) / 10) },
        { label: 'Музыка: ' + Math.round(Sound.musicVolume * 100) + '%', adj: (d) => Sound.setMusicVolume(Math.round((Sound.musicVolume + d * 0.1) * 10) / 10) },
        { label: 'Эффекты: ' + (Sound.useSamples ? 'записи' : 'синтез'), act: () => Sound.setSamples(!Sound.useSamples) },
        { label: 'Тряска экрана: ' + (Game.shakeOn ? 'вкл' : 'выкл'), act: () => { Game.shakeOn = !Game.shakeOn; Store.set('shake', Game.shakeOn); } },
        { label: 'Во весь экран', act: () => Game.toggleFullscreen() },
        { label: 'Назад', act: () => this.back() },
      ];
      case 'episodes':
      case 'levelEp': {
        const list = EPISODES.map((ep) => ({
          label: `Эпизод ${ep.id}: ${ep.title}`,
          act: () => {
            if (this.screen === 'episodes') Game.newGame(ep.id);
            else { this.pendingEpisode = ep.id; this.open('levels'); }
          },
        }));
        list.push({ label: 'Назад', act: () => this.back() });
        return list;
      }
      case 'levels': {
        const list = LEVELS.filter((l) => l.episode === this.pendingEpisode).map((l) => ({
          label: `${l.name}  ${l.title}`,
          disabled: !Game.levelUnlocked(l),
          act: () => { this.pendingLevel = l.id; this.open('skill'); },
        }));
        list.push({ label: 'Назад', act: () => this.back() });
        return list;
      }
      case 'skill': return SKILL_NAMES.map((n, i) => ({ label: n, act: () => Game.startFromSelect(this.pendingLevel, i) })).concat([{ label: 'Назад', act: () => this.back() }]);
      case 'help': return [{ label: 'Назад', act: () => this.back() }];
      default: return [];
    }
  },

  update() {
    const items = this.items();
    const n = items.length;
    if (Input.wasPressed('ArrowDown', 'KeyS')) { this.sel = (this.sel + 1) % n; Sound.play('menu'); }
    if (Input.wasPressed('ArrowUp', 'KeyW')) { this.sel = (this.sel - 1 + n) % n; Sound.play('menu'); }
    const it = items[this.sel];
    if (it && it.adj) {
      if (Input.wasPressed('ArrowLeft', 'KeyA')) { it.adj(-1); Sound.play('menu'); }
      if (Input.wasPressed('ArrowRight', 'KeyD')) { it.adj(1); Sound.play('menu'); }
    }
    if (Input.wasPressed('Enter', 'Space', 'NumpadEnter')) this.activate(items[this.sel]);
    if (Input.wasPressed('Escape', 'Backspace')) {
      if (this.screen === 'main') return;
      this.back();
      return;
    }
    if (Input.mouseMoved) {
      const hb = this.hitAt(Input.mouseX * Game.dpr, Input.mouseY * Game.dpr);
      if (hb !== null && hb !== this.sel) { this.sel = hb; Sound.play('menu'); }
    }
    for (const c of Input.clicks) {
      const hb = this.hitAt(c.x * Game.dpr, c.y * Game.dpr);
      if (hb !== null) {
        this.sel = hb;
        const item = items[hb];
        // клик по левой/правой половине строки регулирует значение
        if (item.adj) {
          item.adj(c.x * Game.dpr < Game.canvas.width / 2 ? -1 : 1);
          Sound.play('menu');
        } else this.activate(item);
        break;
      }
    }
  },

  hitAt(x, y) {
    for (const h of this.hitboxes) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.i;
    return null;
  },

  activate(item) {
    if (!item || item.disabled) { Sound.play('noammo'); return; }
    Sound.play('menuok');
    if (item.act) item.act();
    else if (item.adj) item.adj(1);
  },

  draw(ctx, W, H, u, t) {
    ctx.fillStyle = this.screen === 'pause' || Game.state === 'paused' ? 'rgba(8,5,3,0.72)' : 'rgba(8,5,3,0.55)';
    ctx.fillRect(0, 0, W, H);
    const titleSize = Math.min(46 * u, W / 7.5);
    let y = H * 0.1;
    if (this.screen === 'main' || this.screen === 'pause') {
      drawTitle(ctx, W / 2, y, titleSize, t);
      y += titleSize * 1.25;
      HUD.text(ctx, this.screen === 'pause' ? 'ПАУЗА' : 'двумерный шутер в духе Quake', W / 2, y, 6.5 * u, '#a88858', 'center');
      y += 26 * u;
    } else {
      const ep = EPISODES.find((e) => e.id === this.pendingEpisode) || EPISODES[0];
      const hdr = { options: 'НАСТРОЙКИ', episodes: 'НОВАЯ ИГРА', levelEp: 'ВЫБОР УРОВНЯ', levels: `ЭПИЗОД ${ep.id}: ${ep.title.toUpperCase()}`, skill: 'СЛОЖНОСТЬ', help: 'УПРАВЛЕНИЕ' }[this.screen];
      ctx.font = `${Math.round(Math.min(18 * u, W / 22))}px ${TITLE_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#1a0e06'; ctx.fillText(hdr, W / 2 + u, y + u);
      ctx.fillStyle = '#e0b060'; ctx.fillText(hdr, W / 2, y);
      y += 34 * u;
    }
    if (this.screen === 'help') {
      const lines = [
        ['A / D, ← / →', 'бег'],
        ['W, Пробел, ↑', 'прыжок, всплытие'],
        ['S, ↓', 'сквозь платформу, нырок'],
        ['Мышь', 'прицел'],
        ['ЛКМ', 'огонь'],
        ['1–8, колесо, Q/E', 'оружие'],
        ['Tab', 'статистика уровня'],
        ['Esc', 'пауза'],
        ['', ''],
        ['Совет', 'ракета под ноги = высокий прыжок'],
        ['Совет', 'прыжок сразу при приземлении — разгон'],
        ['Совет', 'стреляйте в подозрительные стены'],
        ['Сенсорный экран', 'слева стик, справа прицел и огонь'],
      ];
      const size = Math.min(6.5 * u, W / 70);
      lines.forEach(([a, b], i) => {
        HUD.text(ctx, a, W / 2 - 8 * u, y + i * size * 2.1, size, '#f0d898', 'right');
        HUD.text(ctx, b, W / 2 + 8 * u, y + i * size * 2.1, size, '#b09068', 'left');
      });
      y += lines.length * size * 2.1 + 10 * u;
    }
    const items = this.items();
    this.hitboxes = [];
    const size = Math.min(9 * u, W / 34);
    const lh = size * 2.2;
    items.forEach((it, i) => {
      const iy = y + i * lh;
      const selected = i === this.sel;
      const col = it.disabled ? '#4a3a2a' : selected ? '#fff0c0' : '#c8a060';
      HUD.text(ctx, it.label, W / 2, iy, size, col, 'center');
      ctx.font = `${Math.round(size)}px ${UI_FONT}`;
      const tw = ctx.measureText(it.label).width;
      this.hitboxes.push({ x: W / 2 - tw / 2 - 20 * u, y: iy - lh * 0.25, w: tw + 40 * u, h: lh, i });
      if (selected) {
        drawRune(ctx, W / 2 - tw / 2 - 14 * u, iy + size / 2, size * 0.7, t);
        drawRune(ctx, W / 2 + tw / 2 + 14 * u, iy + size / 2, size * 0.7, -t);
        if (it.adj) HUD.text(ctx, '◄ ►', W / 2, iy + size * 1.3, size * 0.6, '#806040', 'center', false);
      }
    });
    if (this.screen === 'main') {
      HUD.text(ctx, 'Фанатская игра. Все звуки и графика созданы кодом.', W / 2, H - 14 * u, 5 * u, '#6a5238', 'center');
    }
  },
};

function drawTitle(ctx, x, y, size, t) {
  ctx.save();
  ctx.font = `${Math.round(size)}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const text = 'SLIPGATE';
  ctx.fillStyle = '#0c0704';
  ctx.fillText(text, x + size * 0.05, y + size * 0.06);
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, '#f8e2a8');
  g.addColorStop(0.45, '#c8904a');
  g.addColorStop(0.55, '#8a5424');
  g.addColorStop(1, '#d09a58');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.12 + Math.sin(t * 1.3) * 0.05;
  ctx.fillStyle = '#ff9040';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Вращающаяся «руна» — курсор меню.
function drawRune(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.cos(t * 2.4), 1);
  ctx.strokeStyle = '#e0a050';
  ctx.lineWidth = Math.max(1, r / 5);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.6);
  ctx.moveTo(-r * 0.55, -r * 0.2); ctx.lineTo(0, r * 0.6); ctx.lineTo(r * 0.55, -r * 0.2);
  ctx.stroke();
  ctx.restore();
}
