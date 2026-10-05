'use strict';
// Частицы, ошмётки, взрывы, молнии и кратковременные источники света.

const FX = {
  parts: [],
  gibs: [],
  blasts: [],
  beams: [],
  lights: [],
  MAX_PARTS: 1800,

  clear() {
    this.parts.length = 0; this.gibs.length = 0; this.blasts.length = 0;
    this.beams.length = 0; this.lights.length = 0;
  },

  add(p) {
    if (this.parts.length >= this.MAX_PARTS) this.parts[Math.floor(Math.random() * this.parts.length)] = p;
    else this.parts.push(p);
    return p;
  },

  light(x, y, r, c, i, life) {
    this.lights.push({ x, y, r, c, i, life, max: life });
  },

  blood(x, y, dirX, dirY, n = 8, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dirY, dirX) + rand(-1.2, 1.2) * spread;
      const sp = rand(40, 190);
      this.add({
        kind: 'blood', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(20, 80),
        life: rand(0.4, 1.0), max: 1, size: Math.random() < 0.3 ? 2 : 1,
        col: pick(['#7a0a08', '#9a1410', '#5a0604']), grav: 600, collide: true,
      });
    }
  },

  puff(x, y, nx = 0, ny = 0) {
    for (let i = 0; i < 3; i++) {
      this.add({ kind: 'smoke', x, y, vx: nx * 20 + rand(-15, 15), vy: ny * 20 + rand(-25, 5), life: rand(0.3, 0.6), max: 0.6, size: 2, col: '#8a847a', grav: -20 });
    }
    for (let i = 0; i < 3; i++) {
      this.add({ kind: 'spark', x, y, vx: nx * 80 + rand(-90, 90), vy: ny * 80 + rand(-100, 40), life: rand(0.1, 0.3), max: 0.3, size: 1, col: '#ffd070', grav: 500, bright: true, collide: true });
    }
  },

  sparks(x, y, n, col = '#ffd070', speed = 150) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(20, speed);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rand(0.15, 0.45), max: 0.45, size: 1, col, grav: 350, bright: true, collide: true });
    }
  },

  explosion(x, y, scale = 1) {
    this.blasts.push({ x, y, t: 0, max: 0.5, r: 26 * scale });
    foregroundJolt(x, y, scale);
    this.light(x, y, 150 * scale, [1.0, 0.6, 0.25], 1.3, 0.45);
    const n = Math.round(30 * scale);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 260) * scale;
      this.add({ kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.25, 0.7), max: 0.7, size: pick([1, 2, 2, 3]), grav: 250, drag: 2.5, bright: true, collide: true });
    }
    for (let i = 0; i < 10 * scale; i++) {
      this.add({ kind: 'smoke', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-50, -10), life: rand(0.8, 1.6), max: 1.6, size: pick([3, 4, 5]), col: '#3a3430', grav: -30, drag: 1 });
    }
  },

  smokeTrail(x, y) {
    this.add({ kind: 'smoke', x: x + rand(-1, 1), y: y + rand(-1, 1), vx: rand(-8, 8), vy: rand(-15, 0), life: rand(0.4, 0.8), max: 0.8, size: 2, col: '#6a645c', grav: -10 });
  },

  bubbles(x, y, n = 1) {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'bubble', x: x + rand(-3, 3), y, vx: rand(-5, 5), vy: rand(-40, -20), life: rand(1, 3), max: 3, size: 1, col: '#b8d8f0', grav: -30 });
    }
  },

  teleport(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), r = rand(4, 18);
      this.add({ kind: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 1.6, vx: rand(-15, 15), vy: rand(-80, -20), life: rand(0.4, 0.9), max: 0.9, size: 1, col: pick(['#b8a0ff', '#e0d8ff', '#7a60ff']), grav: -40, bright: true });
    }
    this.light(x, y, 100, [0.7, 0.55, 1.0], 1.0, 0.6);
  },

  debris(x, y, col) {
    this.gib(x, y, rand(-160, 160), rand(-280, -80), col, 2, false);
  },

  gib(x, y, vx, vy, col = '#6a1a10', size = 3, bloody = true, head = null) {
    if (this.gibs.length > 80) this.gibs.shift();
    this.gibs.push({ x, y, vx, vy, rot: rand(0, TAU), vr: rand(-12, 12), size, col, bloody, head, life: rand(12, 20), rest: false });
  },

  beam(x0, y0, x1, y1, col = '#c8d8ff', life = 0.1, width = 2) {
    this.beams.push({ x0, y0, x1, y1, col, life, max: life, width, seed: Math.random() * 1000 });
  },

  update(dt) {
    const lv = Game.level;
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.kind === 'blood' && Math.random() < 0.35) lv.paintDecal(p.x, p.y, p.col, p.size);
        P[i] = P[P.length - 1]; P.pop();
        continue;
      }
      p.vy += (p.grav || 0) * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (p.collide && lv.tileSolid(Math.floor(nx / TILE), Math.floor(ny / TILE))) {
        if (p.kind === 'blood') {
          lv.paintDecal(nx, ny, p.col, p.size + (Math.random() < 0.4 ? 1 : 0));
          P[i] = P[P.length - 1]; P.pop();
          continue;
        }
        if (lv.tileSolid(Math.floor(nx / TILE), Math.floor(p.y / TILE))) p.vx *= -0.4; else p.vy *= -0.4;
        continue;
      }
      p.x = nx; p.y = ny;
      if (p.kind === 'bubble' && lv.liquidAt(p.x, p.y) !== T.WATER) p.life = 0;
    }
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i];
      g.life -= dt;
      if (g.life <= 0) { this.gibs.splice(i, 1); continue; }
      if (g.rest) continue;
      const liq = lv.liquidAt(g.x, g.y);
      g.vy += (liq ? 200 : 900) * dt;
      if (liq) { g.vx *= 0.95; g.vy *= 0.95; }
      let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
      if (lv.solidAt(nx, g.y)) { g.vx *= -0.45; nx = g.x; g.vr *= -0.5; }
      if (lv.solidAt(nx, ny) || (g.vy > 0 && lv.tileAtPx(nx, ny + 1) === T.PLAT && Math.floor(ny) % TILE < 3)) {
        if (g.vy > 120 && g.bloody) { Sound.play('splat', g.x, g.y, { vol: 0.5, gap: 0.08 }); lv.paintDecal(nx, g.y, '#5a0604', 2); }
        g.vy *= -0.35; g.vx *= 0.7; g.vr *= 0.6; ny = g.y;
        if (Math.abs(g.vy) < 40 && Math.abs(g.vx) < 12) { g.rest = true; g.vy = 0; }
      }
      g.x = nx; g.y = ny; g.rot += g.vr * dt;
      if (g.bloody && Math.abs(g.vx) + Math.abs(g.vy) > 120 && Math.random() < 0.5) {
        this.add({ kind: 'blood', x: g.x, y: g.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.5, max: 0.5, size: 1, col: '#7a0a08', grav: 400, collide: true });
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      if (b.t >= b.max) this.blasts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.life -= dt;
      if (l.life <= 0) this.lights.splice(i, 1);
    }
  },

  collectLights(out) {
    for (const l of this.lights) out.push({ x: l.x, y: l.y, r: l.r, c: l.c, i: l.i * (l.life / l.max) });
    for (const b of this.beams) {
      const n = 3;
      for (let k = 0; k <= n; k++) out.push({ x: lerp(b.x0, b.x1, k / n), y: lerp(b.y0, b.y1, k / n), r: 60, c: [0.6, 0.7, 1.0], i: 0.5 });
    }
  },

  drawLit(ctx, cam) {
    for (const g of this.gibs) {
      const x = g.x - cam.x, y = g.y - cam.y;
      if (x < -20 || y < -20 || x > 2000 || y > 2000) continue;
      const fade = Math.min(1, g.life / 2);
      ctx.globalAlpha = fade;
      if (g.head) {
        drawHeadGib(ctx, x, y, g.head, g.rot);
      } else {
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(g.rot);
        ctx.fillStyle = g.col;
        ctx.fillRect(-g.size / 2, -g.size / 2, g.size, g.size);
        if (g.bloody) { ctx.fillStyle = '#9a2a1a'; ctx.fillRect(-g.size / 2, -g.size / 2, 1, 1); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.parts) {
      if (p.bright) continue;
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.kind === 'smoke') {
        const k = p.life / p.max;
        ctx.globalAlpha = k * 0.5;
        const s = p.size * (1.8 - k);
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.ceil(s), Math.ceil(s));
      } else if (p.kind === 'shell') {
        // гильза: кувыркается, то вдоль, то поперёк
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.col;
        const a = Math.floor((p.life * 20) % 2);
        ctx.fillRect(Math.round(x), Math.round(y), a ? 2 : 1, a ? 1 : 2);
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  },

  // Вспышка выстрела: ядро и лучи по направлению ствола.
  flash(x, y, ang, col, size) {
    this.add({ kind: 'flash', x, y, ang, col, size, life: 0.06, max: 0.06, vx: 0, vy: 0, grav: 0, bright: true });
  },

  drawBright(ctx, cam, t) {
    for (const p of this.parts) {
      if (!p.bright) continue;
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      const k = p.life / p.max;
      if (p.kind === 'flash') {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(p.ang);
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.col;
        const L = p.size * (0.7 + k * 0.5);
        ctx.fillRect(0, -1, L * 1.6, 2);
        ctx.fillRect(0, -L * 0.45, 2, L * 0.9);
        for (const a of [-0.55, 0.55]) { ctx.save(); ctx.rotate(a); ctx.fillRect(0, -0.5, L, 1); ctx.restore(); }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1.5, 3, 3);
        ctx.restore();
        continue;
      }
      if (p.kind === 'fire') {
        ctx.fillStyle = k > 0.7 ? '#fff0b0' : k > 0.45 ? '#ffb040' : k > 0.25 ? '#e05a10' : '#6a2008';
      } else ctx.fillStyle = p.col;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const b of this.blasts) {
      const k = b.t / b.max;
      const x = b.x - cam.x, y = b.y - cam.y;
      const r = b.r * (0.5 + k * 0.7);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#8a2a08';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f07018';
      ctx.beginPath(); ctx.arc(x + rand(-2, 2), y + rand(-2, 2), r * (0.75 - k * 0.3), 0, TAU); ctx.fill();
      ctx.fillStyle = k < 0.4 ? '#fff4c0' : '#ffc050';
      ctx.beginPath(); ctx.arc(x, y, r * Math.max(0, 0.45 - k * 0.4), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of this.beams) drawLightning(ctx, b.x0 - cam.x, b.y0 - cam.y, b.x1 - cam.x, b.y1 - cam.y, b.col, b.width, b.life / b.max);
  },
};

function drawLightning(ctx, x0, y0, x1, y1, col, width, alpha = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.floor(len / 10));
  const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const t = i / n, o = rand(-5, 5);
    pts.push([lerp(x0, x1, t) + nx * o, lerp(y0, y1, t) + ny * o]);
  }
  pts.push([x1, y1]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(90,110,255,0.5)';
  ctx.lineWidth = width + 3;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHeadGib(ctx, x, y, type, rot) {
  const def = MONSTER_DEFS[type];
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(rot);
  const skin = def ? def.headCol : '#b08060';
  ctx.fillStyle = shade(skin, 0.7); ctx.fillRect(-3, -3, 6, 6);
  ctx.fillStyle = skin; ctx.fillRect(-3, -3, 6, 4);
  ctx.fillStyle = '#7a0a08'; ctx.fillRect(-3, 2, 6, 1);
  ctx.fillStyle = '#1a0a0a'; ctx.fillRect(0, -1, 1, 1); ctx.fillRect(2, -1, 1, 1);
  ctx.restore();
}
