'use strict';
// Места под новые тайники у достижимого пола, где кругом сплошная порода:
//   wall  — тайная стена и комната 3×3 за ней (wall_secret);
//   floor — люк в полу и погреб под ним (floor_secret).
// node tools/dev/secret-spots.js [id уровня ...] — печатает готовые вызовы для генератора.
const path = require('path');
const { LEVELS } = require(path.join(__dirname, '..', '..', 'js', 'levels.js'));
const { analyze } = require(path.join(__dirname, '..', 'check-levels.js'));

const SOLID = new Set(['#', '%']);
const AVOID = new Set(['$', 'P', 'E', '>', '<', '_', ':', '^', 'D', '[', ']', '=', 'b', '&']);
const W = 3;

function spots(def) {
  const r = analyze(def, false);
  if (!r.reach) return [];
  const { grid: g, w, h, reach } = r;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : g[y][x]);
  const solid = (x, y) => SOLID.has(at(x, y));
  // сплошная порода внутри карты: за краем строить нельзя
  const block = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < 1 || y < 1 || x > w - 2 || y > h - 2 || !solid(x, y)) return false; return true; };
  const avoid = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (AVOID.has(g[y][x])) avoid.push([x, y]);
  const start = avoid.find(([x, y]) => g[y][x] === 'P');
  const near = (x, y) => avoid.some(([ax, ay]) => Math.abs(ax - x) < 8 && Math.abs(ay - y) < 6);
  const out = [];
  for (const k of reach) {
    const x = k % w, y = Math.floor(k / w);
    if (!solid(x, y + 1) || solid(x, y) || solid(x, y - 1) || near(x, y)) continue;
    const d = start ? Math.abs(x - start[0]) + Math.abs(y - start[1]) : 0;
    for (const dir of [1, -1]) {
      const wx = x + dir, far = wx + dir * (W + 1);
      if (far < 1 || far > w - 2) continue;
      if (!block(Math.min(wx, far), y - 3, Math.max(wx, far), y + 1)) continue;
      const x0 = dir > 0 ? wx + 1 : wx - W, x1 = x0 + W - 1;
      out.push({ kind: 'wall', x, y, d, call: `wall_secret(m, ${wx}, ${y}, ${x0}, ${x1}, '...')`, where: dir > 0 ? 'стена справа' : 'стена слева' });
    }
    // люк: герой стоит на (x..x+1, y), под полом погреб 6×4 с запасом
    if (reach.has(y * w + x + 1) && solid(x + 1, y + 1) && !solid(x + 1, y) && block(x - 3, y + 1, x + 4, y + 6)) {
      out.push({ kind: 'floor', x, y, d, call: `floor_secret(m, ${x}, ${y + 1}, '...')`, where: 'люк в полу' });
    }
  }
  return out;
}

const only = process.argv.slice(2);
for (const def of LEVELS) {
  if (only.length && !only.includes(def.id)) continue;
  const list = spots(def);
  // ближе к середине пути от старта: тайник находят по дороге, а не у порога или у выхода
  const maxD = list.reduce((m, c) => Math.max(m, c.d), 0);
  const picks = [];
  for (const q of [0.6, 0.45, 0.75]) {
    const c = list.filter((s) => !picks.includes(s)).sort((a, b) => Math.abs(a.d - maxD * q) - Math.abs(b.d - maxD * q))[0];
    if (c) picks.push(c);
  }
  console.log(`${def.id}: кандидатов ${list.length}`);
  for (const c of picks) console.log(`   ${c.call.padEnd(42)} # ${c.where}, пол (${c.x},${c.y}), от старта ${c.d}`);
}
