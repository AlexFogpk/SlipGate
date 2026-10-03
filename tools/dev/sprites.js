'use strict';
// Галерея спрайтов: герой и монстры в разных позах, крупно.
// node tools/dev/sprites.js out.png [масштаб] [типы через запятую|player] [позы, напр. 0-5]
const { launchBrowser, GAME_URL } = require('../../tests/lib');
(async () => {
  const out = process.argv[2] || 'gallery.png';
  const S = +(process.argv[3] || 4);
  const filter = process.argv[4] || '';
  const range = (process.argv[5] || '0-99').split('-').map(Number);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
  await page.goto(GAME_URL + '?map=e1m1');
  await page.waitForTimeout(600);
  const size = await page.evaluate(({ S, filter, range }) => {
    Game.state = 'menu';
    const rows = [];
    const set = (m, o) => { Object.assign(m, o); return m; };
    const types = Object.keys(MONSTER_DEFS).filter((t) => !filter || filter.split(',').includes(t));
    const P = (o) => ({ kind: 'player', o });
    // герой
    if (!filter || filter.includes('player')) {
      const poses = [];
      for (let w = 1; w <= 9; w++) poses.push(P({ weapon: w, aim: -0.2 }));
      poses.push(P({ weapon: 4, onGround: true, vx: 100, walkPhase: 0.6 }), P({ weapon: 4, onGround: true, vx: 100, walkPhase: 2.2 }), P({ weapon: 4, onGround: true, vx: 100, walkPhase: 3.8 }), P({ weapon: 4, onGround: true, vx: 100, walkPhase: 5.4 }));
      poses.push(P({ weapon: 7, onGround: false, vy: -100 }), P({ weapon: 2, aim: -1.2 }), P({ weapon: 2, aim: 1.0 }), P({ weapon: 1, attackAnim: 0.15 }), P({ weapon: 3, alive: false, deadT: 1 }), P({ weapon: 5, hurtFlash: 0.1 }));
      rows.push({ name: 'player', poses, h: 34 });
    }
    for (const t of types) {
      const d = MONSTER_DEFS[t];
      const M = (o) => ({ kind: t, o });
      const poses = [M({ state: 'idle', onGround: true }), M({ onGround: true, vx: 50, walkPhase: 0.6 }), M({ onGround: true, vx: 50, walkPhase: 2.2 }), M({ onGround: true, vx: 50, walkPhase: 3.8 }), M({ onGround: true, vx: 50, walkPhase: 5.4 }),
        M({ onGround: true, state: 'attack', attackKind: 'melee', stateT: 0.05 }), M({ state: 'attack', attackKind: 'melee', stateT: 0.25 }), M({ state: 'attack', attackKind: 'melee', stateT: 0.5 }),
        M({ state: 'attack', attackKind: 'ranged', stateT: 0.3, fireAnim: 0.1, castT: 0.5, throwT: 0.5, aimLocal: -0.3 }),
        M({ state: 'leap', onGround: false }), M({ alive: false, deathT: 1, state: 'dead' }), M({ onGround: true, hurtFlash: 0.1 })];
      rows.push({ name: t, poses, h: Math.min(130, d.h + 22) });
    }
    for (const r of rows) r.poses = r.poses.slice(range[0], range[1] + 1);
    const colW = (r) => Math.max(36, ...r.poses.map((p) => p.kind === 'player' ? 30 : Math.min(140, MONSTER_DEFS[p.kind].w + 30)));
    const W = Math.max(...rows.map((r) => colW(r) * r.poses.length)) + 60;
    const H = rows.reduce((s, r) => s + r.h + 8, 0);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    // фон: тёмная стена с полосами, светлая половина
    ctx.fillStyle = '#2a2622'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) { ctx.fillStyle = ((x + y) / 16) % 2 ? '#302a26' : '#28241f'; ctx.fillRect(x, y, 16, 16); }
    let y0 = 0;
    for (const r of rows) {
      const cw = colW(r);
      ctx.fillStyle = '#c8a060'; ctx.font = '7px monospace'; ctx.fillText(r.name, 2, y0 + 8);
      r.poses.forEach((p, i) => {
        const bx = 60 + i * cw + cw / 2, by = y0 + r.h;
        ctx.fillStyle = '#181410'; ctx.fillRect(bx - cw / 2 + 1, by, cw - 2, 3);
        if (p.kind === 'player') {
          const pl = new Player(0, 0);
          Object.assign(pl, { onGround: true, alive: true, facing: 1, aim: 0, attackAnim: 0 }, p.o);
          drawPlayerSprite(ctx, bx, by, pl);
        } else {
          const m = new Monster(p.kind, 0, 0);
          m.facing = 1; m.anim = 1.3;
          Object.assign(m, p.o);
          m.x = bx - m.w / 2; m.y = by - m.h;
          if (p.kind === 'chthon') m.y += 0;
          if (m.state === 'idle' && p.kind === 'chthon') m.state = 'active';
          ctx.save(); m.draw(ctx, { x: 0, y: 0 }); ctx.restore();
          if (m.alive) { ctx.save(); m.drawBright(ctx, { x: 0, y: 0 }); ctx.restore(); }
        }
      });
      y0 += r.h + 8;
    }
    const big = document.createElement('canvas'); big.width = W * S; big.height = H * S;
    const b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.drawImage(c, 0, 0, W * S, H * S);
    document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(big);
    return [W * S, H * S];
  }, { S, filter, range });
  await page.setViewportSize({ width: Math.min(size[0], 4000), height: Math.min(size[1], 8000) });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: Math.min(size[0], 4000), height: Math.min(size[1], 8000) } });
  console.log(errors.length ? errors.join('\n') : 'ok', size);
  await browser.close();
})();
