'use strict';
// Физика тел (AABB против тайлов и подвижных препятствий), жидкости, урон и взрывы.

function moveAxisX(e, dx) {
  const lv = Game.level;
  e.x += dx;
  const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
  if (dx > 0) {
    const tx = Math.floor((e.x + e.w - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (lv.tileSolid(tx, ty)) { e.x = tx * TILE - e.w; return true; }
  } else {
    const tx = Math.floor(e.x / TILE);
    for (let ty = y0; ty <= y1; ty++) if (lv.tileSolid(tx, ty)) { e.x = (tx + 1) * TILE; return true; }
  }
  for (const s of lv.solids) {
    if (!s.solid) continue;
    const r = s.rect();
    if (r.h <= 0.5) continue;
    if (e.x < r.x + r.w && e.x + e.w > r.x && e.y < r.y + r.h && e.y + e.h > r.y) {
      e.x = dx > 0 ? r.x - e.w : r.x + r.w;
      return s;
    }
  }
  return false;
}

function moveAxisY(e, dy) {
  const lv = Game.level;
  const oldBottom = e.y + e.h;
  e.y += dy;
  const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
  if (dy > 0 && !e.dropThrough && !e.noPlatforms) {
    for (const lf of lv.lifts) {
      if (e.x + e.w > lf.x && e.x < lf.x + lf.w && oldBottom <= lf.y + 2.5 && e.y + e.h >= lf.y) {
        e.y = lf.y - e.h;
        e.lift = lf;
        return true;
      }
    }
  }
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const t = lv.tile(tx, ty);
      if (isSolidType(t) || (t === T.PLAT && !e.dropThrough && !e.noPlatforms && oldBottom <= ty * TILE + 0.5)) {
        e.y = ty * TILE - e.h;
        return true;
      }
    }
  } else {
    const ty = Math.floor(e.y / TILE);
    for (let tx = x0; tx <= x1; tx++) if (lv.tileSolid(tx, ty)) { e.y = (ty + 1) * TILE; return true; }
  }
  for (const s of lv.solids) {
    if (!s.solid) continue;
    const r = s.rect();
    if (r.h <= 0.5) continue;
    if (e.x < r.x + r.w && e.x + e.w > r.x && e.y < r.y + r.h && e.y + e.h > r.y) {
      e.y = dy > 0 ? r.y - e.h : r.y + r.h;
      return s;
    }
  }
  return false;
}

// Перемещение с подшагами; возвращает сведения о столкновениях.
function moveBody(e, dt) {
  // стоящего на лифте везём вместе с ним
  const lf = e.lift;
  e.lift = null;
  if (lf && (lf.dx || lf.dy)) {
    if (lf.dx) moveAxisX(e, lf.dx);
    const y0 = e.y;
    e.y = lf.y - e.h;
    if (lf.dy < 0 && !Game.level.boxFree(e.x, e.y, e.w, e.h)) e.y = y0;
  }
  let dx = e.vx * dt, dy = e.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
  dx /= steps; dy /= steps;
  const res = { hitX: false, hitY: false, ceil: false, landed: false, solidX: null, impactVy: 0 };
  e.onGround = false;
  for (let i = 0; i < steps; i++) {
    if (dx) {
      const s = moveAxisX(e, dx);
      if (s) { res.hitX = true; if (s !== true) res.solidX = s; dx = 0; }
    }
    if (dy) {
      const s = moveAxisY(e, dy);
      if (s) {
        res.hitY = true;
        if (dy > 0) { e.onGround = true; res.landed = true; res.impactVy = e.vy; } else res.ceil = true;
        dy = 0;
      }
    }
  }
  if (res.hitX) e.vx = 0;
  if (res.hitY) e.vy = 0;
  return res;
}

// Есть ли опора под точкой (для ИИ, чтобы не прыгать в пропасть).
// Возвращает номер строки опоры, -1 для лавы/слизи или null, если опоры нет.
function groundBelow(x, y, maxDepth) {
  const lv = Game.level;
  const tx = Math.floor(x / TILE);
  const ty0 = Math.floor(y / TILE);
  for (let ty = ty0; ty <= ty0 + maxDepth; ty++) {
    const t = lv.tile(tx, ty);
    if (t === T.LAVA || t === T.SLIME || t === T.VOID) return -1;
    if (isSolidType(t) || t === T.PLAT || t === T.WATER) return ty;
  }
  for (const s of lv.solids) {
    if (!s.solid) continue;
    const r = s.rect();
    if (x >= r.x && x < r.x + r.w && r.y >= y - 1 && r.y <= y + maxDepth * TILE) return Math.floor(r.y / TILE);
  }
  return null;
}

// Что внизу под точкой до первой опоры (для ИИ): 'safe' — пол, платформа, вода или лифт,
// 'hazard' — лава, слизь или пустота, 'none' — до самого низа ничего.
function dropCheck(x, y, maxDepth = 48) {
  const lv = Game.level;
  const tx = Math.floor(x / TILE), ty0 = Math.floor(y / TILE);
  for (let ty = ty0; ty < Math.min(lv.h, ty0 + maxDepth); ty++) {
    const t = lv.tile(tx, ty);
    if (t === T.LAVA || t === T.SLIME || t === T.VOID) return 'hazard';
    if (isSolidType(t) || t === T.PLAT || t === T.WATER) return 'safe';
    for (const s of lv.solids) {
      if (!s.solid) continue;
      const r = s.rect();
      if (x >= r.x && x < r.x + r.w && r.y >= ty * TILE && r.y < (ty + 1) * TILE) return 'safe';
    }
  }
  return 'none';
}

// Сдвиг монстра, когда двое стоят вплотную: только в свободное место и не с края.
function nudgeMonster(m, dx) {
  if (m.blockedX || !dx) return;
  const lv = Game.level, nx = m.x + dx;
  if (!lv.boxFree(nx, m.y, m.w, m.h)) return;
  if (m.onGround && !m.def.fly) {
    // ведущий край после сдвига должен стоять на опоре, а не над провалом или лавой
    const ex = dx > 0 ? nx + m.w - 2 : nx + 2;
    const g = groundBelow(ex, m.y + m.h + 1, 1);
    if (g === null || g === -1) return;
  }
  m.x = nx;
}

function computeWaterLevel(e) {
  const lv = Game.level;
  const cx = e.x + e.w / 2;
  const feet = lv.liquidAt(cx, e.y + e.h - 2);
  if (!feet) return { level: 0, type: 0 };
  if (!lv.liquidAt(cx, e.y + e.h / 2)) return { level: 1, type: feet };
  if (!lv.liquidAt(cx, e.y + 3)) return { level: 2, type: feet };
  return { level: 3, type: feet };
}

function applyDamage(target, dmg, attacker, kind, kx = 0, ky = 0) {
  if (!target || !target.takeDamage || dmg <= 0) return;
  const alive = target.alive, hp = target.health, st = target.state;
  target.takeDamage(dmg, attacker, kind, kx, ky);
  // отдача попадания герою: звук, отметка на прицеле, стоп-кадр на мощном ударе
  if (attacker && attacker.isPlayer && target.isMonster && alive && (hp !== target.health || !target.alive)) {
    const killed = !target.alive || (target.state !== st && (target.state === 'down' || target.state === 'dying'));
    Game.onPlayerHit(target, dmg, killed);
  }
}

function explode(x, y, dmg, radius, attacker, ignore, opts = {}) {
  const lv = Game.level;
  FX.explosion(x, y, radius / 64);
  Sound.play('explode', x, y);
  lv.paintScorch(x, y, radius * 0.45);
  Game.shake(x, y, 7 * radius / 64);
  for (const t of Game.damageables()) {
    if (t === ignore) continue;
    const r = t.rect ? t.rect() : t;
    const d = pointBoxDist(x, y, r);
    if (d >= radius) continue;
    const tcx = r.x + r.w / 2, tcy = r.y + r.h / 2;
    if (!lv.los(x, y, tcx, tcy) && !lv.los(x, y, tcx, r.y + 2) && !lv.los(x, y, tcx, r.y + r.h - 2)) continue;
    const base = dmg * (1 - d / radius);
    const pts = t === attacker ? base * 0.5 : base;
    let dx = tcx - x, dy = tcy - y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const kb = base * 4.4;
    applyDamage(t, pts, attacker, opts.kind || 'explosion', dx * kb, dy * kb);
  }
  for (const s of lv.solids) {
    if (s instanceof Mover && s.kind === 'secret' && s.solid && pointBoxDist(x, y, s.rect()) < radius * 0.6) lv.openSecret(s);
  }
  for (const b of lv.buttons) if (!b.pressed && pointBoxDist(x, y, b) < radius * 0.5) lv.pressButton(b);
  Game.noise(x, y, 420);
}
