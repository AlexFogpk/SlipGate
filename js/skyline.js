'use strict';
// Силуэты на горизонте для уровней под открытым небом: дальний и ближний слои
// с параллаксом, у каждой темы свой пейзаж. Слой рисуется один раз белым, затем
// альфа обрезается до пикселей и красится: дымка книзу, светлая кромка сверху,
// окна и руны. Слои бесшовные по горизонтали.

function periodic(rng, w, terms) {
  const t = terms.map(([f, a]) => [f, a, rng() * TAU]);
  return (x) => {
    let v = 0;
    for (const [f, a, p] of t) v += Math.sin((x / w) * TAU * f + p) * a;
    return v;
  };
}

class SkyPainter {
  constructor(w, h, seed) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = '#fff';
    this.ctx.strokeStyle = '#fff';
    this.rng = mulberry32(seed);
    this.lights = [];
    this.beacons = [];
  }

  r(a, b) { return a + this.rng() * (b - a); }
  ri(a, b) { return Math.floor(this.r(a, b + 1)); }

  // каждая фигура рисуется трижды со сдвигом на ширину слоя — так стык не виден
  wrap(fn) { for (const o of [-this.w, 0, this.w]) fn(o); }
  rect(x, y, w, h) { this.wrap((o) => this.ctx.fillRect(Math.round(x + o), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))); }
  poly(pts) {
    this.wrap((o) => {
      const c = this.ctx;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x + o, y) : c.moveTo(x + o, y)));
      c.closePath();
      c.fill();
    });
  }
  line(x0, y0, x1, y1, lw) {
    this.wrap((o) => {
      const c = this.ctx;
      c.lineWidth = lw;
      c.beginPath(); c.moveTo(x0 + o, y0); c.lineTo(x1 + o, y1); c.stroke();
    });
  }
  ellipse(x, y, rx, ry) { this.wrap((o) => { const c = this.ctx; c.beginPath(); c.ellipse(x + o, y, rx, ry, 0, 0, TAU); c.fill(); }); }

  // Гряда холмов или гор от низа слоя: высота от minH до maxH, terms — [частота, вес].
  ridge(minH, maxH, terms) {
    const f = periodic(this.rng, this.w, terms);
    const norm = terms.reduce((s, [, a]) => s + a, 0);
    const c = this.ctx;
    for (const o of [0]) {
      c.beginPath();
      c.moveTo(o, this.h);
      for (let x = 0; x <= this.w; x += 2) c.lineTo(x + o, this.h - (minH + (maxH - minH) * (0.5 + 0.5 * f(x) / norm)));
      c.lineTo(this.w + o, this.h);
      c.closePath();
      c.fill();
    }
    return (x) => this.h - (minH + (maxH - minH) * (0.5 + 0.5 * f(((x % this.w) + this.w) % this.w) / norm));
  }

  light(x, y, w = 1, h = 1) { this.lights.push([Math.round(x), Math.round(y), w, h]); }
  beacon(x, y, r = 1) { this.beacons.push({ x: Math.round(x), y: Math.round(y), r, ph: this.rng() * TAU }); }

  // Пиксельная обрезка и раскраска. col — цвет силуэта, haze — цвет дымки внизу,
  // rim — кромка по верхнему краю, glow — окна и прочие огоньки.
  finish({ col, haze, hazeK, rim, glow, fill = true }) {
    const { w, h } = this;
    const img = this.ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    const C = hexToRgb(col), Hz = hexToRgb(haze), R = hexToRgb(rim);
    for (let y = 0; y < h; y++) {
      const k = clamp((y / h) * hazeK, 0, 1);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!solid[i]) { d[i * 4 + 3] = 0; continue; }
        let c = mixc(C, Hz, k);
        const above = y > 0 ? solid[i - w] : 0;
        if (!above) c = mixc(c, R, 0.55);
        else if (y > 1 && !solid[i - 2 * w]) c = mixc(c, R, 0.2);
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      }
    }
    // огоньки только на самом силуэте
    if (glow) {
      const G = hexToRgb(glow);
      for (const [lx, ly, lw, lh] of this.lights) {
        for (let y = ly; y < ly + lh; y++) {
          for (let x = lx; x < lx + lw; x++) {
            const xx = ((x % w) + w) % w;
            if (y < 0 || y >= h || !solid[y * w + xx]) continue;
            const c = mixc(G, [255, 255, 255], this.rng() * 0.25);
            const i = (y * w + xx) * 4;
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
          }
        }
      }
    }
    this.ctx.putImageData(img, 0, 0);
    const bottom = mixc(C, Hz, clamp(hazeK, 0, 1));
    return { canvas: this.canvas, w, h, fill: fill ? rgbToHex(bottom[0], bottom[1], bottom[2]) : null, beacons: this.beacons };
  }
}

// --- детали пейзажей ---
function slTower(p, x, base, tw, th, roof) {
  p.rect(x, base - th, tw, th);
  const top = base - th;
  if (roof === 'cone') {
    p.poly([[x - 2, top], [x + tw + 2, top], [x + tw / 2, top - tw * 1.3]]);
    p.rect(x + tw / 2, top - tw * 1.3 - 5, 1, 5);
    p.poly([[x + tw / 2 + 1, top - tw * 1.3 - 5], [x + tw / 2 + 5, top - tw * 1.3 - 4], [x + tw / 2 + 1, top - tw * 1.3 - 3]]);
  } else if (roof === 'spire') {
    p.poly([[x, top], [x + tw, top], [x + tw / 2, top - tw * 2.4]]);
  } else {
    p.rect(x - 2, top - 3, tw + 4, 4);
    for (let cx = x - 2; cx < x + tw + 2; cx += 4) p.rect(cx, top - 6, 2, 3);
  }
  for (let wy = top + 6; wy < base - 8; wy += p.ri(8, 14)) if (p.rng() < 0.6) p.light(x + p.ri(2, tw - 3), wy, 1, 2);
}

function slWall(p, x0, x1, base, wh) {
  p.rect(x0, base - wh, x1 - x0, wh);
  for (let cx = x0; cx < x1 - 1; cx += 4) p.rect(cx, base - wh - 3, 2, 3);
}

function slMast(p, x, base, mh) {
  p.rect(x, base - mh, 1, mh);
  p.poly([[x - 4, base], [x + 5, base], [x + 1, base - mh * 0.4]]);
  for (let y = base - mh + 4; y < base - mh * 0.4; y += 7) p.rect(x - 2, y, 5, 1);
  p.beacon(x, base - mh - 1);
}

function slChimney(p, x, base, cw, ch) {
  p.poly([[x, base], [x + cw, base], [x + cw - 1, base - ch], [x + 1, base - ch]]);
  p.rect(x, base - ch - 2, cw, 2);
  p.beacon(x + cw / 2, base - ch - 3);
}

function slCoolingTower(p, x, base, cw, ch) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, y = base - ch * t;
    const half = cw / 2 * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.72) / 0.72, 1.6));
    pts.push([x + cw / 2 - half, y]);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10, y = base - ch * t;
    const half = cw / 2 * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.72) / 0.72, 1.6));
    pts.push([x + cw / 2 + half, y]);
  }
  p.poly(pts);
}

function slBuilding(p, x, base, bw, bh) {
  p.rect(x, base - bh, bw, bh);
  if (p.rng() < 0.7) p.rect(x + p.ri(2, bw - 8), base - bh - p.ri(3, 7), p.ri(4, 8), 8);
  if (p.rng() < 0.4) p.rect(x + p.ri(1, bw - 3), base - bh - p.ri(8, 14), 2, 14);
  for (let wy = base - bh + 4; wy < base - 4; wy += 5) {
    for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (p.rng() < 0.16) p.light(wx, wy, 2, 1);
  }
}

function slSpike(p, x, base, sw, sh, bend = 0) {
  p.poly([[x, base], [x + sw, base], [x + sw / 2 + bend, base - sh]]);
}

// Изогнутый «рог»: от основания к острию, толщина убывает.
function slHorn(p, x, base, hw, hh, bend) {
  const L = [], R = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const cx = x + bend * t * t, cy = base - hh * t, half = hw / 2 * (1 - t) + 0.4;
    L.push([cx - half, cy]); R.push([cx + half, cy]);
  }
  p.poly(L.concat(R.reverse()));
  if (p.rng() < 0.7) for (let i = 2; i < 9; i += 2) if (p.rng() < 0.5) p.light(x + bend * (i / 12) ** 2, base - hh * i / 12, 1, 2);
}

function slPillar(p, x, base, pw, ph) {
  const pts = [[x, base]];
  for (let i = 1; i <= 5; i++) pts.push([x + p.r(-2, 2) + (i / 5) * pw * 0.12, base - ph * i / 5]);
  for (let i = 0; i <= 3; i++) pts.push([x + pw * i / 3, base - ph - p.r(0, 4)]);
  for (let i = 5; i >= 1; i--) pts.push([x + pw + p.r(-2, 2) - (i / 5) * pw * 0.12, base - ph * i / 5]);
  pts.push([x + pw, base]);
  p.poly(pts);
}

function slObelisk(p, x, base, ow, oh) {
  p.poly([[x, base], [x + ow, base], [x + ow - 1, base - oh], [x + ow / 2, base - oh - ow], [x + 1, base - oh]]);
  for (let y = base - oh + 4; y < base - 6; y += 5) if (p.rng() < 0.7) p.light(x + ow / 2 - 0.5, y, 1, 2);
}

function slTrilithon(p, x, base, th) {
  p.rect(x, base - th, 5, th);
  p.rect(x + 13, base - th, 5, th);
  p.rect(x - 2, base - th - 4, 22, 4);
}

function slIsland(p, x, y, iw) {
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) pts.push([x + iw * i / n, y - p.r(0, 2)]);
  const tip = [x + iw * p.r(0.35, 0.65), y + iw * p.r(0.45, 0.75)];
  pts.push([x + iw * 0.85, y + iw * 0.18], [x + iw * 0.68, y + iw * 0.36], tip, [x + iw * 0.3, y + iw * 0.3], [x + iw * 0.12, y + iw * 0.14]);
  p.poly(pts);
  return tip;
}

function slVolcano(p, x, base, vw, vh) {
  const cw = vw * 0.14;
  p.poly([[x, base], [x + vw * 0.3, base - vh * 0.55], [x + vw / 2 - cw, base - vh], [x + vw / 2 - cw * 0.4, base - vh + 4],
    [x + vw / 2 + cw * 0.4, base - vh + 4], [x + vw / 2 + cw, base - vh], [x + vw * 0.72, base - vh * 0.5], [x + vw, base]]);
  // лавовые ручьи по склонам
  for (let s = 0; s < 3; s++) {
    let lx = x + vw / 2 + p.r(-cw, cw) * 0.6, ly = base - vh + 3;
    const dir = p.rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < 30 && ly < base - 3; i++) {
      p.light(lx, ly, 1, 2);
      lx += dir * p.r(0.2, 1.2); ly += 2;
    }
  }
  p.beacon(x + vw / 2, base - vh + 2, 3);
}

// Пейзажи тем: far — дальний слой (дымка), near — ближний (темнее, с деталями).
const SKYLINE_THEMES = {
  base: {
    glow: '#f0c870',
    far(p) {
      p.ridge(10, 30, [[1, 0.6], [3, 0.3], [7, 0.12]]);
      slCoolingTower(p, p.r(20, 90), p.h - 14, 34, 50);
      slChimney(p, p.r(140, 200), p.h - 16, 6, p.r(60, 80));
      slChimney(p, p.r(230, 300), p.h - 16, 5, p.r(50, 70));
      slMast(p, p.r(320, 370), p.h - 18, 70);
    },
    near(p) {
      p.rect(0, p.h - 10, p.w, 10);
      let x = 0;
      while (x < p.w - 30) {
        const bw = p.ri(18, 46), bh = p.ri(18, 58);
        slBuilding(p, x, p.h - 8, bw, bh);
        if (p.rng() < 0.35) { p.rect(x + bw, p.h - bh * 0.6, p.ri(10, 26), 3); }
        x += bw + p.ri(4, 30);
      }
      for (let i = 0; i < 2; i++) slMast(p, p.r(i * p.w / 2 + 20, i * p.w / 2 + p.w / 2 - 20), p.h - 8, p.r(80, 110));
      // портальный кран
      const cx = p.r(60, p.w - 120);
      p.rect(cx, p.h - 90, 3, 82); p.rect(cx + 50, p.h - 90, 3, 82); p.rect(cx - 10, p.h - 92, 74, 4);
    },
  },
  castle: {
    glow: '#ffa040',
    far(p) {
      const g = p.ridge(14, 40, [[1, 0.5], [2, 0.35], [5, 0.15]]);
      for (const cx of [p.r(40, 120), p.r(220, 320)]) {
        const base = g(cx + 12) + 4;
        slWall(p, cx - 6, cx + 34, base, 10);
        slTower(p, cx, base, 6, 26, 'cone');
        slTower(p, cx + 18, base, 7, 34, 'cone');
        slTower(p, cx + 30, base, 5, 20, 'flat');
      }
    },
    near(p) {
      p.rect(0, p.h - 8, p.w, 8);
      let x = p.r(0, 30);
      while (x < p.w - 40) {
        const seg = p.ri(40, 90);
        slWall(p, x, x + seg, p.h - 6, p.ri(20, 30));
        const tw = p.ri(12, 18);
        slTower(p, x + seg - tw / 2, p.h - 6, tw, p.ri(48, 85), p.rng() < 0.5 ? 'cone' : 'flat');
        x += seg + p.ri(10, 40);
      }
      // главная башня
      const kx = p.r(100, p.w - 160);
      p.rect(kx, p.h - 100, 46, 94);
      slTower(p, kx - 8, p.h - 6, 12, 112, 'cone');
      slTower(p, kx + 42, p.h - 6, 12, 104, 'cone');
      for (let cx = kx; cx < kx + 46; cx += 4) p.rect(cx, p.h - 103, 2, 3);
      for (let wy = p.h - 92; wy < p.h - 20; wy += 12) p.light(kx + 8 + p.ri(0, 28), wy, 2, 3);
    },
  },
  crypt: {
    glow: '#a0e080',
    far(p) {
      p.ridge(12, 34, [[1, 0.5], [3, 0.3], [6, 0.2]]);
      for (let i = 0; i < 3; i++) slTower(p, p.r(i * 128, i * 128 + 100), p.h - 20, 6, p.r(26, 40), 'spire');
    },
    near(p) {
      p.rect(0, p.h - 8, p.w, 8);
      const cx = p.r(80, p.w - 200);
      p.rect(cx, p.h - 50, 90, 44);
      p.poly([[cx - 4, p.h - 50], [cx + 94, p.h - 50], [cx + 45, p.h - 74]]);
      slTower(p, cx + 70, p.h - 6, 16, 80, 'spire');
      for (let i = 0; i < 4; i++) p.light(cx + 10 + i * 18, p.h - 36, 2, 6);
      // мёртвые деревья
      for (let i = 0; i < 7; i++) {
        const tx = p.r(0, p.w), th = p.r(26, 50);
        p.line(tx, p.h - 6, tx + p.r(-3, 3), p.h - th, 2);
        for (let b = 0; b < 4; b++) {
          const by = p.h - th * p.r(0.4, 0.95), dir = p.rng() < 0.5 ? -1 : 1;
          p.line(tx, by, tx + dir * p.r(6, 14), by - p.r(4, 12), 1.2);
        }
      }
    },
  },
  cave: {
    far(p) { p.ridge(24, 86, [[1, 0.5], [2, 0.3], [5, 0.22], [11, 0.12], [23, 0.06]]); },
    near(p) {
      p.ridge(6, 22, [[2, 0.5], [5, 0.3], [13, 0.2]]);
      for (let i = 0; i < 6; i++) slPillar(p, p.r(0, p.w), p.h, p.r(14, 30), p.r(36, 100));
      for (let i = 0; i < 10; i++) slSpike(p, p.r(0, p.w), p.h, p.r(5, 12), p.r(20, 60), p.r(-4, 4));
      const ax = p.r(40, p.w - 120);
      slPillar(p, ax, p.h, 16, 70); slPillar(p, ax + 60, p.h, 18, 64);
      p.poly([[ax + 4, p.h - 62], [ax + 74, p.h - 58], [ax + 72, p.h - 74], [ax + 40, p.h - 84], [ax + 6, p.h - 76]]);
    },
  },
  rune: {
    glow: '#80b8ff',
    far(p) {
      p.ridge(16, 56, [[1, 0.5], [3, 0.3], [8, 0.15], [17, 0.06]]);
      const zx = p.r(60, 300);
      for (let i = 0; i < 5; i++) p.rect(zx + i * 5, p.h - 30 - i * 9, 60 - i * 10, 10);
      p.beacon(zx + 30, p.h - 30 - 5 * 9, 2);
    },
    near(p) {
      p.ridge(6, 16, [[2, 0.5], [5, 0.3], [11, 0.2]]);
      for (let i = 0; i < 3; i++) slTrilithon(p, p.r(i * 170, i * 170 + 140), p.h - 8, p.r(20, 30));
      let tallest = null;
      for (let i = 0; i < 5; i++) {
        const ox = p.r(0, p.w), oh = p.r(40, 80);
        slObelisk(p, ox, p.h - 6, p.r(6, 9), oh);
        if (!tallest || oh > tallest[1]) tallest = [ox, oh];
      }
      for (let i = 0; i < 8; i++) {
        const mx = p.r(0, p.w), mh = p.r(14, 34);
        p.poly([[mx, p.h - 6], [mx + 8, p.h - 6], [mx + 8, p.h - mh + 3], [mx, p.h - mh]]);
      }
      p.beacon(tallest[0] + 4, p.h - 6 - tallest[1] - 9, 2);
    },
  },
  nether: {
    glow: '#ff60e0',
    far(p) {
      p.ridge(20, 64, [[1, 0.4], [3, 0.3], [9, 0.2], [21, 0.12]]);
      for (let i = 0; i < 8; i++) slSpike(p, p.r(0, p.w), p.h - 24, p.r(4, 8), p.r(30, 60), p.r(-6, 6));
    },
    near(p) {
      p.ridge(8, 24, [[2, 0.5], [6, 0.3], [15, 0.2]]);
      for (let i = 0; i < 9; i++) {
        const hw = p.r(8, 18), hh = p.r(50, 120);
        slHorn(p, p.r(0, p.w), p.h - 4, hw, hh, p.r(-30, 30));
      }
      // парящие глыбы
      for (let i = 0; i < 3; i++) {
        const fx = p.r(0, p.w), fy = p.r(14, 40), fw = p.r(20, 36);
        const tip = slIsland(p, fx, fy, fw);
        p.light(tip[0], tip[1] - 3, 1, 2);
      }
    },
  },
  elder: {
    glow: '#ff8a30',
    far(p) {
      p.ridge(10, 26, [[1, 0.5], [4, 0.3], [9, 0.2]]);
      slVolcano(p, p.r(10, 60), p.h, p.r(130, 170), p.r(70, 92));
      slVolcano(p, p.r(220, 260), p.h, p.r(90, 120), p.r(46, 60));
    },
    near(p) {
      p.ridge(10, 40, [[2, 0.4], [5, 0.3], [12, 0.2], [27, 0.1]]);
      for (let i = 0; i < 12; i++) slSpike(p, p.r(0, p.w), p.h - 6, p.r(6, 16), p.r(26, 70), p.r(-8, 8));
      for (let i = 0; i < 14; i++) p.light(p.r(0, p.w), p.h - p.r(2, 10), p.ri(2, 5), 1);
    },
  },
  void: {
    glow: '#70f0ff',
    fill: false,
    far(p) {
      for (let i = 0; i < 12; i++) slIsland(p, p.r(i * p.w / 12, (i + 1) * p.w / 12), p.r(12, p.h - 40), p.r(14, 34));
    },
    near(p) {
      for (let i = 0; i < 5; i++) {
        const ix = p.r(i * p.w / 5, (i + 1) * p.w / 5 - 40), iy = p.r(30, p.h - 60), iw = p.r(36, 80);
        slIsland(p, ix, iy, iw);
        // руины на острове
        for (let c = 0; c < 3; c++) if (p.rng() < 0.7) p.rect(ix + 6 + c * (iw - 14) / 2, iy - p.r(8, 16), 3, 16);
        if (p.rng() < 0.5) p.rect(ix + 4, iy - 18, iw * 0.5, 3);
        const cx = ix + iw * p.r(0.3, 0.7);
        p.poly([[cx - 2, iy], [cx + 2, iy], [cx, iy - 7]]);
        p.light(cx - 1, iy - 5, 2, 4);
        p.beacon(cx, iy - 7, 1);
      }
    },
  },
};

const Skyline = {
  cache: {},
  get(theme) {
    if (this.cache[theme]) return this.cache[theme];
    const def = SKYLINE_THEMES[theme] || SKYLINE_THEMES.base;
    const sky = (THEMES[theme] || THEMES.base).sky;
    const seed = [...theme].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) >>> 0;
    const mk = (layer, w, h, par, opts) => {
      const p = new SkyPainter(w, h, seed + (layer === 'far' ? 1 : 2));
      def[layer](p);
      return Object.assign(p.finish(Object.assign({ glow: def.glow, fill: def.fill !== false }, opts)), { par, float: def.fill === false });
    };
    const [dark, mid, light] = sky;
    this.cache[theme] = {
      // дальний слой чуть светлее ближнего и тонет в дымке книзу, оба темнее неба
      far: mk('far', 384, 120, 0.1, { col: shade(dark, 0.95), haze: mix(dark, mid, 0.5), hazeK: 0.7, rim: mix(mid, light, 0.35) }),
      near: mk('near', 512, 150, 0.22, { col: shade(dark, 0.45), haze: mix(dark, mid, 0.2), hazeK: 0.5, rim: mix(dark, light, 0.3) }),
      glow: def.glow,
    };
    return this.cache[theme];
  },
};
