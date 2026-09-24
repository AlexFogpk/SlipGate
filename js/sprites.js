'use strict';
// Пиксельные спрайты, нарисованные кодом: герой, монстры, предметы, оружие.
// Все фигуры рисуются в локальных координатах: (0,0) — середина низа, взгляд вправо.

let SPR_FLASH = false;
const flashCache = {};
function C(hex) {
  if (!SPR_FLASH) return hex;
  return flashCache[hex] || (flashCache[hex] = mix(hex, '#ffffff', 0.55));
}
function R(ctx, x, y, w, h, hex) {
  ctx.fillStyle = C(hex);
  ctx.fillRect(x, y, w, h);
}

function drawLegs(ctx, L, phase, moving, air, legCol, bootCol, thick = 3) {
  if (air) {
    R(ctx, -3, -L, thick, L - 3, shade(legCol, 0.75));
    R(ctx, -4, -4, thick + 1, 2, shade(bootCol, 0.75));
    R(ctx, 0, -L, thick, L - 4, legCol);
    R(ctx, 0, -5, thick + 1, 2, bootCol);
    return;
  }
  const s = moving ? Math.sin(phase) : 0;
  const legs = [[Math.round(-s * 3), shade(legCol, 0.75), shade(bootCol, 0.75)], [Math.round(s * 3), legCol, bootCol]];
  for (const [off, col, boot] of legs) {
    const half = Math.floor(L / 2);
    R(ctx, -1 + Math.round(off / 2), -L, thick, half + 1, col);
    R(ctx, -1 + off, -L + half, thick, L - half - 2, col);
    R(ctx, -1 + off, -2, thick + 1, 2, boot);
  }
}

// Рука с оружием; ang — локальный угол (уже зеркальный для взгляда влево).
function drawWeapon(ctx, sx, sy, ang, kind, anim, sleeve, hand, t = 0) {
  ctx.save();
  ctx.translate(sx, sy);
  let a = ang;
  if (kind === 1 && anim > 0) a += lerp(0.9, -1.8, anim / 0.3);
  ctx.rotate(a);
  if (kind !== 1 && anim > 0) ctx.translate(-2 * anim / 0.12, 0);
  R(ctx, 0, -1, 5, 3, sleeve);
  R(ctx, 4, -1, 2, 2, hand);
  switch (kind) {
    case 1:
      R(ctx, 3, 0, 11, 1, '#6a4a2a');
      R(ctx, 11, -4, 3, 5, '#8a8a92');
      R(ctx, 13, -4, 1, 5, '#d0d0d8');
      break;
    case 2:
      R(ctx, 1, -1, 5, 3, '#6a4424');
      R(ctx, 6, -1, 7, 1, '#707078');
      R(ctx, 6, 0, 5, 1, '#4a4a50');
      break;
    case 3:
      R(ctx, 0, -1, 6, 3, '#6a4424');
      R(ctx, 6, -2, 8, 1, '#80808a');
      R(ctx, 6, -1, 8, 1, '#5a5a62');
      R(ctx, 6, 0, 3, 1, '#6a4424');
      break;
    case 4:
      R(ctx, 1, -2, 8, 4, '#4a4a52');
      R(ctx, 2, -2, 6, 1, '#6a6a74');
      R(ctx, 9, -1, 4, 2, '#8a8a94');
      R(ctx, 3, 2, 2, 2, '#3a3a40');
      break;
    case 5: {
      R(ctx, 0, -3, 8, 5, '#50505a');
      R(ctx, 1, -3, 6, 1, '#74747e');
      R(ctx, 8, -2, 6, 4, '#34343c');
      const k = Math.floor(t * 30) % 2;
      R(ctx, 8, -2 + k, 6, 1, '#9a9aa4');
      R(ctx, 8, k + 0, 6, 1, '#9a9aa4');
      R(ctx, 2, 2, 2, 2, '#3a3a40');
      break;
    }
    case 6:
      R(ctx, 0, -1, 6, 3, '#4a4034');
      R(ctx, 5, -2, 6, 5, '#3a4a2a');
      R(ctx, 5, -2, 6, 1, '#56683e');
      R(ctx, 10, -2, 1, 5, '#222a18');
      break;
    case 7:
      R(ctx, -3, -2, 17, 4, '#4a4a44');
      R(ctx, -3, -2, 17, 1, '#6e6e66');
      R(ctx, 12, -3, 2, 6, '#2a2a28');
      R(ctx, -4, -2, 1, 4, '#8a1a10');
      R(ctx, 3, 2, 2, 2, '#3a3a36');
      break;
    case 8:
      R(ctx, 0, -2, 9, 5, '#5a5040');
      R(ctx, 2, -2, 2, 5, '#c0a030');
      R(ctx, 5, -2, 2, 5, '#c0a030');
      R(ctx, 9, -2, 4, 1, '#8a8a94');
      R(ctx, 9, 2, 4, 1, '#8a8a94');
      R(ctx, 12, -1, 1, 3, '#a0c0ff');
      break;
    case 'laser':
      R(ctx, 0, -2, 10, 3, '#4a5058');
      R(ctx, 0, -2, 10, 1, '#6a7078');
      R(ctx, 10, -1, 2, 1, '#ff8030');
      break;
    default: break;
  }
  ctx.restore();
}

function drawSword(ctx, sx, sy, ang, len, blade, edge, hilt) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  R(ctx, 0, -1, 4, 3, hilt);
  R(ctx, 4, -3, 1, 6, '#8a7a50');
  R(ctx, 5, -1, len, 2, blade);
  R(ctx, 5, -1, len, 1, edge);
  R(ctx, 5 + len, 0, 1, 1, blade);
  ctx.restore();
}

function drawArm(ctx, sx, sy, ang, len, col, claw) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  R(ctx, 0, -1, len, 3, col);
  if (claw) { R(ctx, len, -2, 3, 1, claw); R(ctx, len, 1, 3, 1, claw); R(ctx, len, 0, 2, 1, claw); }
  ctx.restore();
}

// ---------------- игрок ----------------
function drawPlayerSprite(ctx, x, y, p) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing, 1);
  if (!p.alive) {
    const k = Math.min(1, p.deadT / 0.45);
    ctx.translate(0, -k * 3);
    ctx.rotate(-k * Math.PI / 2);
  }
  SPR_FLASH = p.hurtFlash > 0;
  const invis = p.ring > 0;
  if (invis) ctx.globalAlpha = 0.16;
  const moving = p.onGround && Math.abs(p.vx) > 10;
  const air = !p.onGround && p.waterLevel < 2 && p.alive;
  R(ctx, -6, -17, 3, 7, '#5a4a30');
  R(ctx, -6, -17, 3, 1, '#6e5c3c');
  drawLegs(ctx, 9, p.walkPhase, moving, air, '#5a4a36', '#2a2018');
  R(ctx, -4, -17, 8, 8, '#4a5836');
  R(ctx, -4, -17, 8, 1, '#5e6e46');
  R(ctx, 2, -16, 2, 7, '#3a4628');
  R(ctx, -1, -16, 1, 6, '#6a5028');
  R(ctx, -4, -10, 8, 1, '#6a5028');
  R(ctx, -3, -22, 6, 5, '#c09070');
  R(ctx, -3, -22, 6, 2, '#3a3020');
  R(ctx, -3, -21, 2, 3, '#3a3020');
  R(ctx, 1, -20, 1, 1, '#1a1010');
  R(ctx, 2, -18, 1, 1, '#9a6a50');
  if (p.alive) {
    const la = p.facing > 0 ? p.aim : Math.PI - p.aim;
    drawWeapon(ctx, 0, -13, la, p.weapon, p.attackAnim, '#4a5836', '#c09070', Game.time);
  }
  if (invis) {
    ctx.globalAlpha = 0.9;
    R(ctx, 1, -20, 1, 1, '#ffe080');
    R(ctx, -1, -20, 1, 1, '#ffe080');
  }
  ctx.globalAlpha = 1;
  SPR_FLASH = false;
  ctx.restore();
}

// ---------------- монстры ----------------
const MONSTER_ART = {
  grunt(ctx, m) {
    drawLegs(ctx, 9, m.walkPhase, m.moving, m.air, '#4a4030', '#2a2018');
    R(ctx, -4, -17, 8, 8, '#7a5a30');
    R(ctx, -4, -17, 8, 1, '#94703e');
    R(ctx, 2, -16, 2, 7, '#5e4424');
    R(ctx, -4, -10, 8, 1, '#3a2a18');
    R(ctx, -5, -17, 3, 3, '#5a5040');
    R(ctx, -3, -22, 6, 5, '#b08868');
    R(ctx, -4, -23, 8, 3, '#5a5040');
    R(ctx, -4, -23, 8, 1, '#6e6450');
    R(ctx, 1, -20, 1, 1, '#200000');
    drawWeapon(ctx, 0, -13, m.aimLocal, 2, m.fireAnim, '#7a5a30', '#b08868');
  },
  enforcer(ctx, m) {
    drawLegs(ctx, 10, m.walkPhase, m.moving, m.air, '#3a4046', '#1e2226', 4);
    R(ctx, -5, -19, 10, 9, '#5a646a');
    R(ctx, -5, -19, 10, 1, '#76828a');
    R(ctx, -3, -18, 6, 5, '#6e7a80');
    R(ctx, 3, -18, 2, 8, '#465056');
    R(ctx, -5, -11, 10, 1, '#2a3034');
    R(ctx, -6, -19, 3, 3, '#4a545a');
    R(ctx, -3, -24, 7, 5, '#6a7078');
    R(ctx, -3, -24, 7, 1, '#8a9098');
    R(ctx, 0, -22, 4, 2, '#e0c040');
    drawWeapon(ctx, 0, -15, m.aimLocal, 'laser', m.fireAnim, '#5a646a', '#3a4046');
  },
  knight(ctx, m) {
    drawLegs(ctx, 10, m.walkPhase, m.moving, m.air, '#4a3a2a', '#2a2018');
    R(ctx, -7, -19, 3, 8, '#5a4a2a');
    R(ctx, -7, -19, 3, 1, '#7a6a3a');
    R(ctx, -4, -19, 8, 9, '#7a6a44');
    for (let i = 0; i < 4; i++) R(ctx, -4 + (i % 2), -18 + i * 2, 8, 1, '#6a5a3a');
    R(ctx, -2, -18, 4, 8, '#6a2a1a');
    R(ctx, -3, -24, 6, 5, '#8a7a50');
    R(ctx, -3, -24, 6, 1, '#a89868');
    R(ctx, 0, -22, 3, 1, '#1a1410');
    R(ctx, -2, -26, 3, 2, '#a02020');
    let ang = -0.9;
    if (m.state === 'attack') ang = lerp(-2.4, 0.7, clamp(m.stateT / 0.3, 0, 1));
    drawSword(ctx, 1, -14, ang, 11, '#b8b8c0', '#e8e8f0', '#4a3a2a');
  },
  hknight(ctx, m) {
    drawLegs(ctx, 11, m.walkPhase, m.moving, m.air, '#3a1610', '#1a0a08', 4);
    R(ctx, -5, -21, 10, 10, '#4a1c14');
    R(ctx, -5, -21, 10, 1, '#6a2c20');
    R(ctx, 3, -20, 2, 9, '#341410');
    R(ctx, -2, -19, 4, 6, '#5a241a');
    R(ctx, -6, -22, 2, 2, '#9a9488');
    R(ctx, 4, -22, 2, 2, '#9a9488');
    R(ctx, -5, -12, 10, 1, '#2a0e0a');
    R(ctx, -3, -28, 7, 7, '#5a2018');
    R(ctx, -3, -28, 7, 1, '#7a3024');
    R(ctx, -4, -31, 1, 4, '#c8c0a0');
    R(ctx, 4, -31, 1, 4, '#c8c0a0');
    R(ctx, 1, -25, 3, 1, '#ff5020');
    let ang = -0.8;
    if (m.state === 'attack' && m.attackKind === 'melee') ang = lerp(-2.4, 0.7, clamp(m.stateT / 0.35, 0, 1));
    else if (m.state === 'attack') ang = lerp(-0.8, -1.6, clamp(m.stateT / 0.4, 0, 1));
    drawSword(ctx, 1, -16, ang, 13, '#8a8a94', '#ff6030', '#2a0e0a');
  },
  zombie(ctx, m) {
    drawLegs(ctx, 9, m.walkPhase * 0.7, m.moving, m.air, '#4a5040', '#2a2a22');
    R(ctx, -4, -17, 8, 8, '#6a7a60');
    R(ctx, -4, -17, 8, 1, '#7e8e72');
    R(ctx, -2, -15, 2, 2, '#7a2a1a');
    R(ctx, 1, -12, 3, 1, '#5a1a10');
    R(ctx, 2, -16, 2, 5, '#56644c');
    R(ctx, -2, -22, 6, 5, '#8a9a78');
    R(ctx, -2, -22, 6, 1, '#6a7a58');
    R(ctx, 2, -20, 1, 1, '#3a0000');
    R(ctx, 1, -18, 3, 1, '#5a2a20');
    let ang = 0.15;
    if (m.state === 'attack') ang = lerp(-2.6, 0.2, clamp((m.stateT - 0.2) / 0.3, 0, 1));
    drawArm(ctx, 0, -15, ang + 0.1, 7, '#6a7a60', null);
    if (m.state === 'attack' && m.stateT < 0.5) {
      ctx.save(); ctx.translate(0, -15); ctx.rotate(ang);
      R(ctx, 7, -2, 3, 3, '#7a2010'); ctx.restore();
    }
    drawArm(ctx, 1, -16, ang - 0.1, 7, '#7e8e72', null);
  },
  ogre(ctx, m) {
    drawLegs(ctx, 10, m.walkPhase, m.moving, m.air, '#4a3a2a', '#2a1e14', 4);
    R(ctx, -9, -24, 3, 11, '#3a4a2a');
    R(ctx, -9, -24, 3, 1, '#56683e');
    R(ctx, -7, -21, 14, 11, '#9a7a5a');
    R(ctx, -5, -17, 11, 6, '#a88868');
    R(ctx, 4, -20, 3, 10, '#7a5e42');
    R(ctx, -7, -21, 14, 1, '#b09070');
    R(ctx, -7, -11, 14, 2, '#3a2a1a');
    R(ctx, -5, -21, 2, 10, '#4a3a22');
    R(ctx, -3, -27, 7, 6, '#9a7a5a');
    R(ctx, -3, -27, 7, 1, '#b09070');
    R(ctx, 0, -25, 4, 1, '#5a4230');
    R(ctx, 2, -24, 1, 1, '#200000');
    R(ctx, 1, -22, 3, 1, '#4a2010');
    R(ctx, -3, -25, 1, 2, '#8a6a4a');
    // бензопила
    const saw = m.state === 'attack' && m.attackKind === 'melee';
    const j = saw ? randInt(-1, 1) : 0;
    R(ctx, 2, -17 + j, 7, 5, '#5a5a60');
    R(ctx, 2, -17 + j, 7, 1, '#7a7a80');
    R(ctx, 9, -16 + j, 11, 3, '#9a9aa0');
    const ph = Math.floor(Game.time * (saw ? 30 : 4)) % 2;
    for (let i = 0; i < 11; i += 2) {
      R(ctx, 9 + i + ph, -17 + j, 1, 1, '#5a5a60');
      R(ctx, 9 + i + (1 - ph), -13 + j, 1, 1, '#5a5a60');
    }
    R(ctx, 3, -18, 3, 3, '#9a7a5a');
  },
  shambler(ctx, m) {
    const charging = m.state === 'attack' && m.attackKind === 'ranged';
    const clawing = m.state === 'attack' && m.attackKind === 'melee';
    drawLegs(ctx, 12, m.walkPhase * 0.8, m.moving, m.air, '#b8b0a0', '#8a8478', 5);
    R(ctx, -11, -34, 22, 22, '#cfc8b8');
    R(ctx, -7, -37, 13, 3, '#cfc8b8');
    R(ctx, -11, -34, 22, 1, '#e0dace');
    for (const [a, b, c] of [[-9, -30, 6], [3, -32, 8], [-4, -22, 6], [7, -24, 7], [-1, -34, 4]]) R(ctx, a, b, 2, c, '#aaa294');
    R(ctx, 8, -33, 3, 20, '#b0a898');
    R(ctx, -2, -27, 10, 6, '#5a1010');
    for (let i = 0; i < 5; i++) { R(ctx, -1 + i * 2, -27, 1, 1, '#f0f0e0'); R(ctx, i * 2, -22, 1, 1, '#f0f0e0'); }
    if (charging) {
      drawArm(ctx, 6, -32, -1.9, 14, '#c0b8a8', '#e8e0d0');
      drawArm(ctx, -8, -32, -1.3, 14, '#aaa294', '#d0c8b8');
    } else {
      const sw = clawing ? lerp(-2.2, 0.9, clamp(m.stateT / 0.4, 0, 1)) : 1.35 + Math.sin(m.walkPhase) * 0.1;
      drawArm(ctx, -8, -31, 1.7, 17, '#aaa294', '#d0c8b8');
      drawArm(ctx, 8, -31, sw, 18, '#c0b8a8', '#e8e0d0');
    }
  },
  fiend(ctx, m) {
    const leap = m.state === 'leap';
    R(ctx, -9, -11, 4, 11, '#8a6a40');
    R(ctx, -5, -8, 3, 8, '#a88858');
    R(ctx, -6, -2, 5, 2, '#6a4a2a');
    R(ctx, -9, -21, 15, 11, '#a88858');
    R(ctx, -9, -21, 15, 1, '#c0a070');
    for (const x of [-7, -3, 1]) R(ctx, x, -21, 1, 9, '#8a6a40');
    R(ctx, 5, -20, 7, 7, '#b89868');
    R(ctx, 6, -14, 7, 2, '#8a6a40');
    R(ctx, 7, -15, 5, 1, '#f0e8d0');
    R(ctx, 8, -18, 2, 1, '#2a1008');
    const a = leap ? -0.3 : m.state === 'attack' ? lerp(-1.8, 0.8, clamp(m.stateT / 0.25, 0, 1)) : 1.1 + Math.sin(m.walkPhase) * 0.2;
    drawArm(ctx, 3, -17, a, 11, '#a88858', '#e8e0c8');
    drawArm(ctx, 1, -18, a + 0.25, 10, '#967648', '#d8d0b8');
    const s = m.moving ? Math.sin(m.walkPhase) * 2 : 0;
    R(ctx, 0 + Math.round(s), -10, 3, 10, '#967648');
    R(ctx, 0 + Math.round(s), -2, 5, 2, '#6a4a2a');
  },
  dog(ctx, m) {
    const s = m.moving || m.state === 'leap' ? Math.sin(m.walkPhase * 1.5) * 2 : 0;
    for (const [x, o] of [[-6, -s], [-4, s], [3, s], [5, -s]]) R(ctx, x + Math.round(o), -5, 2, 5, '#2e2014');
    R(ctx, -7, -10, 13, 5, '#4a3220');
    R(ctx, -7, -10, 13, 1, '#5e4430');
    R(ctx, -6, -6, 11, 1, '#3a2618');
    R(ctx, -9, -11, 2, 2, '#4a3220');
    R(ctx, 4, -12, 5, 5, '#4a3220');
    R(ctx, 5, -13, 2, 2, '#2a1a10');
    const bite = m.state === 'attack' && m.stateT < 0.25;
    R(ctx, 8, -10, 4, 2, '#3a2618');
    R(ctx, 8, bite ? -7 : -8, 4, 1, '#8a5a30');
    R(ctx, 11, -10, 1, 1, '#100000');
    R(ctx, 7, -11, 1, 1, '#ff3010');
  },
  scrag(ctx, m) {
    ctx.translate(0, Math.round(Math.sin(m.anim * 4) * 1.5));
    const tw = Math.sin(m.anim * 6) * 1.5;
    R(ctx, -1, -5, 3, 4, '#5a6030');
    R(ctx, -2 + Math.round(tw), -2, 3, 2, '#4a5028');
    R(ctx, -4 + Math.round(tw), 0, 3, 1, '#4a5028');
    R(ctx, -4, -12, 8, 8, '#6a7040');
    R(ctx, -4, -12, 8, 1, '#80884e');
    R(ctx, -2, -9, 4, 5, '#4a5030');
    R(ctx, -3, -16, 7, 5, '#7a8048');
    R(ctx, 1, -14, 2, 1, '#ff3020');
    R(ctx, 2, -12, 3, 1, '#2a0a0a');
    const a = m.state === 'attack' ? -0.4 : 0.5 + Math.sin(m.anim * 3) * 0.3;
    drawArm(ctx, 2, -10, a, 5, '#6a7040', '#b0b080');
    drawArm(ctx, -2, -10, a + 0.8, 4, '#5a6034', '#a0a070');
  },
  vore(ctx, m) {
    const s = m.moving ? Math.sin(m.walkPhase) : 0;
    for (const [x, o] of [[-9, s], [-1, -s], [7, s]]) {
      R(ctx, x + Math.round(o * 2), -10, 2, 6, '#7a5a50');
      R(ctx, x + Math.round(o * 3) - 1, -4, 2, 4, '#6a4a40');
    }
    R(ctx, -9, -24, 18, 13, '#b08080');
    R(ctx, -10, -22, 20, 9, '#b08080');
    R(ctx, -8, -25, 15, 1, '#c89898');
    for (const [a, b, c] of [[-6, -23, 5], [0, -21, 6], [-3, -17, 4], [4, -19, 3]]) R(ctx, a, b, c, 1, '#8a5a5a');
    const open = m.state === 'attack' && m.stateT > 0.3 && m.stateT < 0.8;
    R(ctx, 4, -14, 6, open ? 3 : 2, '#3a1010');
    if (open) R(ctx, 5, -13, 4, 1, '#d070ff');
  },
  spawn(ctx, m) {
    const p = Math.round(Math.sin(m.anim * 8));
    ctx.globalAlpha *= 0.9;
    R(ctx, -6, -8 - p, 12, 8 + p, '#2a4490');
    R(ctx, -5, -9 - p, 10, 1, '#4a6ac0');
    R(ctx, -7, -6, 14, 5, '#2a4490');
    R(ctx, -3, -7 - p, 3, 2, '#90b0ff');
    R(ctx, 2, -4, 2, 1, '#1a2a60');
    ctx.globalAlpha = 1;
  },
  gargoyle(ctx, m) {
    const dive = m.state === 'leap';
    const flap = Math.sin(m.anim * (dive ? 22 : 11));
    const wy = Math.round(flap * 4);
    R(ctx, -12, -15 + wy, 9, 2, '#44443e');
    R(ctx, -15, -13 + Math.round(wy * 1.4), 5, 2, '#3a3a34');
    R(ctx, -6, -8, 4, 1, '#56564e');
    R(ctx, -4, -13, 8, 9, '#6a6a62');
    R(ctx, -4, -13, 8, 1, '#8a8a80');
    R(ctx, -2, -10, 4, 5, '#56564e');
    R(ctx, 1, -17, 6, 5, '#727268');
    R(ctx, 1, -17, 6, 1, '#8e8e84');
    R(ctx, 1, -19, 1, 2, '#c8c0a8'); R(ctx, 5, -19, 1, 2, '#c8c0a8');
    R(ctx, 4, -13, 3, 1, '#2a1a14');
    R(ctx, -3, -4, 2, 3, '#56564e'); R(ctx, 2, -4, 2, 3, '#56564e');
    R(ctx, -4, -1, 3, 1, '#c8c0a8'); R(ctx, 2, -1, 3, 1, '#c8c0a8');
    R(ctx, -9, -17 - wy, 10, 2, '#5a5a54');
    R(ctx, -13, -19 - Math.round(wy * 1.4), 6, 2, '#4a4a44');
    R(ctx, -15, -17 - Math.round(wy * 1.6), 3, 3, '#3e3e38');
  },
  shub(ctx, m) {
    const t = m.anim;
    const dying = m.state === 'dying';
    if (dying) {
      const k = clamp(m.stateT / 3, 0, 1);
      ctx.translate(rand(-2, 2), 0);
      ctx.scale(1 - k * 0.35, 1 - k * 0.45);
    }
    // щупальца
    for (let i = 0; i < 9; i++) {
      let a = -Math.PI + 0.35 + i * (Math.PI - 0.7) / 8;
      let px = Math.cos(a) * 30, py = -44 + Math.sin(a) * 26;
      for (let k = 0; k < 8; k++) {
        a += Math.sin(t * 1.6 + i * 1.3 + k * 0.6) * 0.22;
        px += Math.cos(a) * 5; py += Math.sin(a) * 5;
        const r = 5 - k * 0.5;
        R(ctx, Math.round(px - r), Math.round(py - r), Math.ceil(r * 2), Math.ceil(r * 2), k % 2 ? '#4a2a3c' : '#5a3448');
      }
    }
    const pulse = Math.sin(t * 2.2) * 2;
    ctx.fillStyle = C('#2a1822');
    ctx.beginPath(); ctx.ellipse(0, -42, 44 + pulse, 42 - pulse * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C('#3e2432');
    ctx.beginPath(); ctx.ellipse(-2, -46, 40 + pulse, 36 - pulse * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C('#5a3448');
    for (const [fx, fy, fw] of [[-20, -70, 14], [6, -74, 18], [-28, -50, 10], [18, -52, 16], [-8, -30, 20]]) R(ctx, fx, fy, fw, 2, '#5a3448');
    // глазницы (сами глаза светятся в ярком проходе)
    for (const [ex, ey] of SHUB_EYES) R(ctx, ex - 2, ey - 2, 5, 4, '#1a0e14');
    // пасть
    const open = 3 + Math.round((Math.sin(t * 3) + 1) * 2);
    R(ctx, -12, -18, 24, open, '#4a0a10');
    for (let i = 0; i < 6; i++) { R(ctx, -11 + i * 4, -18, 2, 2, '#e8e0c8'); R(ctx, -9 + i * 4, -18 + open - 2, 2, 2, '#e8e0c8'); }
    // корни на полу
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 6; k++) R(ctx, sx * (30 + k * 5) - 3, -6 + Math.round(Math.sin(t * 2 + k) * 1), 6, 5 - (k >> 1), '#3a2230');
    }
  },
  chthon(ctx, m) {
    ctx.scale(1.25, 1.25);
    const throwing = m.throwT > 0;
    R(ctx, -22, -70, 44, 60, '#3a2418');
    R(ctx, -22, -70, 44, 2, '#5a3a24');
    R(ctx, 14, -68, 8, 58, '#2a1810');
    for (const [a, b, c, d] of [[-14, -60, 2, 18], [-4, -52, 14, 2], [8, -64, 2, 22], [-18, -40, 12, 2], [2, -34, 2, 16]]) R(ctx, a, b, c, d, '#ff7020');
    R(ctx, -12, -92, 24, 22, '#4a2c1c');
    R(ctx, -12, -92, 24, 2, '#6a4028');
    R(ctx, -17, -102, 5, 14, '#2a1810');
    R(ctx, 12, -102, 5, 14, '#2a1810');
    R(ctx, -8, -84, 6, 3, '#ffd040');
    R(ctx, 3, -84, 6, 3, '#ffd040');
    R(ctx, -7, -76, 14, 3, '#ff6020');
    for (let i = 0; i < 4; i++) R(ctx, -6 + i * 4, -76, 1, 1, '#ffffff');
    drawArm(ctx, -20, -64, 1.9, 34, '#3a2418', '#c0a080');
    const a = throwing ? lerp(-2.6, 0.2, 1 - m.throwT / 0.6) : 1.2 + Math.sin(m.anim * 2) * 0.2;
    ctx.save(); ctx.translate(20, -64); ctx.rotate(a);
    R(ctx, 0, -5, 34, 11, '#3a2418');
    R(ctx, 0, -5, 34, 2, '#5a3a24');
    R(ctx, 12, -1, 10, 2, '#ff7020');
    if (throwing && m.throwT > 0.3) R(ctx, 30, -6, 10, 10, '#ff8020');
    ctx.restore();
  },
};

// ---------------- предметы ----------------
function drawItem(ctx, x, y, it, t) {
  const ch = it.ch;
  const bob = it.dropped ? 0 : Math.round(Math.sin(t * 3 + it.phase) * 1.5) - 1;
  ctx.save();
  ctx.translate(x, y + bob);
  switch (ch) {
    case '+':
      R(ctx, -4, -6, 8, 6, '#b8b0a0'); R(ctx, -4, -6, 8, 1, '#e0d8c8'); R(ctx, -1, -5, 2, 4, '#c01010'); R(ctx, -3, -4, 6, 2, '#c01010');
      break;
    case 'H':
      R(ctx, -6, -9, 12, 9, '#9a9488'); R(ctx, -6, -9, 12, 1, '#d8d0c0'); R(ctx, -5, -8, 10, 7, '#c8c0b0');
      R(ctx, -1, -7, 2, 5, '#c01010'); R(ctx, -3, -5, 6, 2, '#c01010'); R(ctx, -6, -1, 12, 1, '#6a645a');
      break;
    case 'M': {
      const p = Math.sin(t * 5) * 0.5 + 0.5;
      ctx.fillStyle = '#3040c0'; ctx.beginPath(); ctx.arc(0, -6, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = mix('#6080ff', '#c0d0ff', p); ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, TAU); ctx.fill();
      R(ctx, -2, -9, 2, 2, '#ffffff');
      break;
    }
    case 'A': case 'Y': case 'R': {
      const col = ch === 'A' ? '#3a8a2e' : ch === 'Y' ? '#c0a020' : '#b02020';
      R(ctx, -6, -11, 12, 11, col);
      R(ctx, -2, -11, 4, 2, '#000000');
      R(ctx, -6, -11, 4, 1, mix(col, '#ffffff', 0.35));
      R(ctx, 2, -11, 4, 1, mix(col, '#ffffff', 0.35));
      R(ctx, -1, -9, 2, 9, shade(col, 0.6));
      R(ctx, 4, -10, 2, 10, shade(col, 0.7));
      R(ctx, -6, -1, 12, 1, shade(col, 0.5));
      break;
    }
    case 'U':
      R(ctx, -5, -7, 10, 7, '#8a2a1a'); R(ctx, -5, -7, 10, 1, '#aa4a2a');
      for (let i = 0; i < 4; i++) { R(ctx, -4 + i * 2, -9, 1, 2, '#a02010'); R(ctx, -4 + i * 2, -10, 1, 1, '#d0a040'); }
      break;
    case 'N':
      R(ctx, -5, -7, 10, 7, '#5a5a60'); R(ctx, -5, -7, 10, 1, '#7a7a82');
      for (let i = 0; i < 4; i++) R(ctx, -4 + i * 2, -9, 1, 2, '#b0b0b8');
      R(ctx, -3, -4, 6, 1, '#3a3a40');
      break;
    case 'K':
      R(ctx, -5, -6, 10, 6, '#6a4a2a'); R(ctx, -5, -6, 10, 1, '#8a6a3a');
      R(ctx, -3, -11, 2, 5, '#7a7a70'); R(ctx, 1, -11, 2, 5, '#7a7a70');
      R(ctx, -3, -12, 2, 1, '#b02010'); R(ctx, 1, -12, 2, 1, '#b02010');
      break;
    case 'C':
      R(ctx, -5, -8, 10, 8, '#4a5a3a'); R(ctx, -5, -8, 10, 1, '#6a7a52');
      R(ctx, 0, -7, 2, 3, '#e0c030'); R(ctx, -1, -4, 3, 1, '#e0c030'); R(ctx, -1, -3, 2, 2, '#e0c030');
      break;
    case 'Q': {
      const k = Math.sin(t * 2);
      const w = Math.max(2, Math.round(Math.abs(k) * 10));
      R(ctx, -w / 2, -12, w, 10, '#2038c0');
      R(ctx, -w / 2 + 1, -11, Math.max(1, w - 2), 8, '#4a68ff');
      if (w > 5) { R(ctx, -1, -10, 2, 6, '#c0d0ff'); R(ctx, -3, -8, 6, 1, '#c0d0ff'); }
      break;
    }
    case 'X': {
      ctx.strokeStyle = '#ff3020'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + i * (TAU * 2 / 5) + t * 0.8;
        const px = Math.cos(a) * 6, py = -7 + Math.sin(a) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -7, 6.5, 0, TAU); ctx.stroke();
      break;
    }
    case 'V':
      ctx.strokeStyle = '#d0a030'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -6, 5, 3.5, 0, 0, TAU); ctx.stroke();
      R(ctx, -1, -10, 2, 2, '#fff0a0');
      break;
    case 'W':
      R(ctx, -4, -12, 8, 5, '#2a7a3a'); R(ctx, -3, -14, 6, 3, '#3a8a4a'); R(ctx, -2, -13, 4, 1, '#a0e0ff');
      R(ctx, -4, -7, 3, 7, '#2a7a3a'); R(ctx, 1, -7, 3, 7, '#2a7a3a'); R(ctx, -6, -12, 2, 6, '#226a30'); R(ctx, 4, -12, 2, 6, '#226a30');
      break;
    case '(': case ')': {
      const col = ch === '(' ? '#c8d0dc' : '#e8b830';
      ctx.scale(1.5, 1.5);
      drawKeyIcon(ctx, 0, -6, col);
      break;
    }
    case 'backpack':
      R(ctx, -5, -9, 10, 9, '#6a5030'); R(ctx, -5, -9, 10, 1, '#8a6a40'); R(ctx, -4, -6, 8, 3, '#5a4028');
      R(ctx, -2, -10, 4, 1, '#4a3a20'); R(ctx, 3, -8, 1, 7, '#4a3a20');
      break;
    default:
      if (ch >= '3' && ch <= '8') {
        R(ctx, -9, -2, 18, 2, '#2a2420');
        drawWeapon(ctx, -6, -5, 0, +ch, 0, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', t);
      }
  }
  ctx.restore();
}

// ---------------- лицо героя для HUD ----------------
function drawFace(ctx, x, y, s, p, t) {
  const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a * s, y + b * s, w * s, h * s); };
  const hp = p.health;
  const tier = !p.alive ? 5 : hp >= 80 ? 0 : hp >= 60 ? 1 : hp >= 40 ? 2 : hp >= 20 ? 3 : 4;
  let skin = '#c09070', sh = '#96684e';
  if (p.pent > 0) { skin = '#d07060'; sh = '#a04a3a'; }
  if (tier === 5) { skin = '#8a7a6a'; sh = '#5a4a3a'; }
  r(3, 1, 10, 14, sh);
  r(3, 1, 9, 13, skin);
  r(2, 0, 12, 4, '#3a3020');
  r(2, 3, 2, 5, '#3a3020');
  r(12, 3, 2, 4, '#3a3020');
  r(2, 6, 1, 3, sh);
  r(13, 6, 1, 3, sh);
  const look = tier === 5 ? 0 : Math.round(Math.sin(t * 0.7) * 1.2);
  const pain = p.faceT > 0 || tier === 5;
  if (pain) {
    r(4, 7, 3, 1, '#2a1a10'); r(9, 7, 3, 1, '#2a1a10');
  } else {
    r(4, 6, 3, 2, p.quad > 0 ? '#80a0ff' : '#e8e0d0');
    r(9, 6, 3, 2, p.quad > 0 ? '#80a0ff' : '#e8e0d0');
    r(5 + look, 6, 1, 2, p.pent > 0 ? '#ff2010' : '#2a1a10');
    r(10 + look, 6, 1, 2, p.pent > 0 ? '#ff2010' : '#2a1a10');
  }
  r(4, 5, 3, 1, '#4a3a28'); r(9, 5, 3, 1, '#4a3a28');
  r(7, 8, 2, 3, sh);
  r(6, 12, 4, 1, pain ? '#3a1010' : '#6a3a2a');
  if (pain) r(6, 11, 4, 1, '#3a1010');
  if (tier >= 1) r(11, 9, 2, 3, '#8a0a08');
  if (tier >= 2) { r(3, 2, 2, 2, '#8a0a08'); r(10, 12, 3, 2, '#7a0a08'); }
  if (tier >= 3) { r(4, 9, 2, 4, '#7a0a08'); r(8, 1, 3, 2, '#9a1010'); }
  if (tier >= 4) { r(5, 3, 6, 1, '#6a0806'); r(3, 13, 9, 2, '#6a0806'); }
  if (p.ring > 0) { ctx.fillStyle = 'rgba(10,8,6,0.75)'; ctx.fillRect(x + 2 * s, y, 12 * s, 15 * s); r(5, 6, 1, 1, '#ffe080'); r(10, 6, 1, 1, '#ffe080'); }
}
