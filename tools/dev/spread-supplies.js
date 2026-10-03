'use strict';
// Разносит припасы, сваленные у старта, по маршруту уровня: каждую коробку — на пол
// перед очередной стычкой (у монстров, равномерно по ходу уровня), не в тайники.
//   node tools/dev/spread-supplies.js            таблица переносов для tools/levelgen/supply_moves.py
//   node tools/dev/spread-supplies.js e4m6       только для одного уровня, с пояснениями
// Таблицу считают по картам без переносов: сначала очистите supply_moves.py и перегенерируйте.
const path = require('path');
const { analyze } = require(path.join(__dirname, '..', 'check-levels.js'));
const { LEVELS } = require(path.join(__dirname, '..', '..', 'js', 'levels.js'));

const AMMO = 'UNKC', HEAL = 'H+';
const ITEMS = '()+HMAYRUNKCQXVW3456789';
const MONSTERS = 'gdekozfsnvtmarupq';      // без боссов и кристаллов
const ZONE_X = 16, ZONE_Y = 4;             // «у старта»
const only = process.argv.slice(2);

function plan(def) {
  const g = def.map;
  const h = g.length, w = g[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : g[y][x]);
  let px = 0, py = 0;
  g.forEach((r, y) => { const x = r.indexOf('P'); if (x >= 0) { px = x; py = y; } });
  const inZone = (x, y) => Math.abs(x - px) <= ZONE_X && Math.abs(y - py) <= ZONE_Y;
  // что переносим: все патроны у старта и лишние аптечки (одна остаётся)
  const move = [];
  let heal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (!inZone(x, y)) continue;
      if (AMMO.includes(c)) move.push({ c, x, y });
      else if (HEAL.includes(c) && heal++ >= 1) move.push({ c, x, y });
    }
  }
  if (!move.length) return [];
  // достижимость без тайников: стены '$' считаем глухими
  const noSecret = Object.assign({}, def, { map: g.map((r) => r.replace(/\$/g, '#')) });
  const reach = analyze(noSecret).reach;
  const rank = new Map();
  let i = 0;
  for (const k of reach) rank.set(k, i++);
  const rankAt = (x, y) => {
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const r = rank.get((y + dy) * w + x + dx);
      if (r !== undefined) return r;
    }
    return undefined;
  };
  const monsters = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!MONSTERS.includes(at(x, y)) || inZone(x, y)) continue;
    const r = rankAt(x, y);
    if (r !== undefined) monsters.push({ x, y, r });
  }
  monsters.sort((a, b) => a.r - b.r);
  const taken = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ITEMS.includes(at(x, y)) || 'PE&^b'.includes(at(x, y))) taken.push([x, y]);
  const free = (x, y, gap) => !taken.some(([tx, ty]) => Math.abs(tx - x) <= gap && Math.abs(ty - y) <= 1);
  const standOk = (x, y) => ' ,'.includes(at(x, y)) && ' ,'.includes(at(x, y - 1)) && '#%-'.includes(at(x, y + 1)) && rank.has(y * w + x);
  const out = [];
  move.forEach((it, n) => {
    const target = monsters.length ? monsters[Math.min(monsters.length - 1, Math.floor((n + 0.5) * monsters.length / move.length))] : null;
    let best = null;
    // сначала рядом с монстром (строго, потом свободнее), иначе — просто дальше по ходу уровня
    for (const pass of [0, 1, 2]) {
      if (best) break;
      const relax = pass > 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!standOk(x, y) || inZone(x, y) || !free(x, y, 2)) continue;
          if (out.some((o) => Math.abs(o.tx - x) < 5 && Math.abs(o.ty - y) < 3)) continue;
          let score;
          if (target && pass < 2) {
            const d = Math.hypot(x - target.x, (y - target.y) * 1.5);
            if (Math.abs(y - target.y) > (relax ? 6 : 3) || d < (relax ? 3 : 4) || d > (relax ? 18 : 12)) continue;
            const before = rank.get(y * w + x) < target.r;
            if (!before && !relax) continue;
            score = Math.abs(d - 7) + (before ? 0 : 4);
          } else {
            score = Math.abs(rank.get(y * w + x) - ((n + 1) / (move.length + 1)) * rank.size) / 50;
          }
          if (!best || score < best.score) best = { x, y, score };
        }
      }
    }
    if (!best) return;
    // что было под предметом: как и игра, смотрим на соседей (небо, жидкость, колонны)
    const around = [at(it.x - 1, it.y), at(it.x + 1, it.y), at(it.x, it.y - 1), at(it.x, it.y + 1)];
    const counts = {};
    for (const c of around) if (',~;!I'.includes(c)) counts[c] = (counts[c] || 0) + 1;
    let back = ' ', bc = 1;
    for (const k in counts) if (counts[k] > bc) { bc = counts[k]; back = k; }
    out.push({ c: it.c, fx: it.x, fy: it.y, tx: best.x, ty: best.y, back, near: target });
    taken.push([best.x, best.y]);
  });
  return out;
}

const lines = [];
for (const def of LEVELS) {
  if (!def.episode || (only.length && !only.includes(def.id))) continue;
  const moves = plan(def);
  if (!moves.length) continue;
  if (only.length) {
    for (const m of moves) console.log(`${m.c} (${m.fx},${m.fy}) → (${m.tx},${m.ty})` + (m.near ? `  у монстра '${def.map[m.near.y][m.near.x]}' (${m.near.x},${m.near.y})` : ''));
  }
  lines.push(`    '${def.id}': [${moves.map((m) => `(${m.fx}, ${m.fy}, '${m.c}', ${m.tx}, ${m.ty}, '${m.back}')`).join(', ')}],`);
}
if (!only.length) console.log('SUPPLY_MOVES = {\n' + lines.join('\n') + '\n}');
