'use strict';
// Общие константы и математические помощники.

const TILE = 16;
const TAU = Math.PI * 2;
const BASE_GRAVITY = 1100;
// тяжесть уровня: на секретном уровне E1 она вдвое меньше (см. поле gravity)
let GRAVITY = BASE_GRAVITY;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function chance(p) { return Math.random() < p; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function approach(v, target, delta) {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Детерминированный хэш для раскладки текстур и сложности.
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Пересечение луча (o + d*t) с прямоугольником. Возвращает t >= 0 или -1.
function rayBox(ox, oy, dx, dy, bx, by, bw, bh) {
  let tmin = -Infinity, tmax = Infinity;
  if (dx !== 0) {
    const t1 = (bx - ox) / dx, t2 = (bx + bw - ox) / dx;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  } else if (ox < bx || ox > bx + bw) return -1;
  if (dy !== 0) {
    const t1 = (by - oy) / dy, t2 = (by + bh - oy) / dy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  } else if (oy < by || oy > by + bh) return -1;
  if (tmax < 0 || tmax < tmin) return -1;
  return Math.max(tmin, 0);
}

function pointBoxDist(px, py, b) {
  const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
  const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
  return Math.hypot(dx, dy);
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1);
}

function shade(hex, f) {
  const c = hexToRgb(hex);
  return rgbToHex(c[0] * f, c[1] * f, c[2] * f);
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

const Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('slipgate.' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('slipgate.' + key, JSON.stringify(val)); } catch (e) { /* хранилище недоступно */ }
  },
};
