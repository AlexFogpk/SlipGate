#!/usr/bin/env node
'use strict';
// Проверка карт: ширина строк, известные символы, достижимость выхода с учётом
// прыжков (до 3 клеток вверх, до 4 в сторону), падений, плавания, ключей, кнопок, алтарей и телепортов.
// Запуск: node tools/check-levels.js [--map e1m2] [--show]

const path = require('path');
const { LEVELS } = require(path.join(__dirname, '..', 'js', 'levels.js'));

const SOLID = new Set(['#', '%']);
const LIQUID = new Set(['~', '!', ';', '.']);
const TILE_CH = new Set([' ', '#', '%', '-', '~', '!', ';', ',', '.', 'I']);
const MOVER_CH = new Set(['D', '[', ']', '=', '$']);
const ENTITY_CH = new Set('PEZ><L*b@x&_:^|()+HMAYRUNKCQXVW3456789gdekozfsnvtmcawruyhpqj'.split(''));
const MONSTER_CH_FLY = new Set(['s', 'a', 'h', 'j']);
const MONSTER_H = { g: 2, d: 1, e: 2, k: 2, o: 2, z: 2, f: 2, s: 1, n: 2, v: 2, t: 1, m: 3, c: 1, a: 1, w: 6, r: 1, u: 1, y: 2, h: 4, p: 2, q: 2, j: 5 };

function analyze(def, show) {
  const errors = [], warnings = [];
  const rows = def.map;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  rows.forEach((r, i) => { if (r.length !== w) errors.push(`строка ${i}: длина ${r.length}, ожидается ${w}`); });
  const g = rows.map((r) => r.padEnd(w, '#'));
  const raw = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : g[y][x]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (!TILE_CH.has(c) && !MOVER_CH.has(c) && !ENTITY_CH.has(c)) errors.push(`неизвестный символ '${c}' в (${x},${y})`);
    }
  }
  // базовый тип клетки (как в Level.inheritTile)
  const base = (x, y) => {
    const c = raw(x, y);
    if (TILE_CH.has(c) || MOVER_CH.has(c)) return c;
    const counts = {};
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const n = raw(nx, ny);
      if (LIQUID.has(n) || n === ',' || n === 'I') counts[n] = (counts[n] || 0) + 1;
    }
    let best = ' ', bc = 1;
    for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = k; }
    return best;
  };

  const spawns = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ENTITY_CH.has(g[y][x])) spawns.push({ c: g[y][x], x, y });
  const starts = spawns.filter((s) => s.c === 'P');
  if (starts.length !== 1) errors.push(`стартовых точек P: ${starts.length}`);
  const exits = spawns.filter((s) => s.c === 'E');
  if (!exits.length) errors.push('нет выхода E');
  const srcs = spawns.filter((s) => s.c === '>'), dsts = spawns.filter((s) => s.c === '<');
  if (srcs.length !== dsts.length) errors.push(`телепорты: входов ${srcs.length}, выходов ${dsts.length}`);

  // лифты: путь лифта считается опорой на каждой высоте (герой может на нём доехать)
  const liftSupport = new Set();
  const runs = spawns.filter((s) => s.c === '_');
  const marks = spawns.filter((s) => s.c === ':');
  for (let i = 0; i < runs.length;) {
    let j = i;
    while (j + 1 < runs.length && runs[j + 1].y === runs[i].y && runs[j + 1].x === runs[j].x + 1) j++;
    const r = runs[i], len = j - i + 1;
    let best = null, bd = Infinity;
    for (const m of marks) {
      if (m.used || (m.x !== r.x && m.y !== r.y)) continue;
      const d = Math.abs(m.x - r.x) + Math.abs(m.y - r.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) best.used = true;
    if (!best) warnings.push(`лифт в (${r.x},${r.y}) без отметки ':'`);
    const ex = best ? best.x : r.x, ey = best ? best.y : r.y;
    for (let y = Math.min(r.y, ey); y <= Math.max(r.y, ey); y++) {
      for (let x = Math.min(r.x, ex); x <= Math.max(r.x, ex) + len - 1; x++) {
        if (SOLID.has(raw(x, y))) warnings.push(`путь лифта (${r.x},${r.y}) упирается в стену в (${x},${y})`);
        liftSupport.add(y * w + x);
      }
    }
    i = j + 1;
  }

  for (const s of spawns) {
    if (s.c === 'u' && !LIQUID.has(base(s.x, s.y))) warnings.push(`угорь в (${s.x},${s.y}) не в воде`);
    const hh = MONSTER_H[s.c];
    if (hh) for (let k = 1; k < hh; k++) if (SOLID.has(base(s.x, s.y - k))) warnings.push(`монстру '${s.c}' в (${s.x},${s.y}) тесно`);
  }
  if (!starts.length) return { errors, warnings };

  const state = { silver: false, gold: false, gates: false, suit: false };
  const passable = (x, y) => {
    const c = base(x, y);
    if (SOLID.has(c)) return false;
    if (c === '[') return state.silver;
    if (c === ']') return state.gold;
    if (c === '=') return state.gates;
    return true;
  };
  const deadly = (x, y) => { const c = base(x, y); return c === '!' || c === '.' || (c === ';' && !state.suit); };
  const water = (x, y) => LIQUID.has(base(x, y)) && !deadly(x, y);
  const support = (x, y) => SOLID.has(base(x, y)) || base(x, y) === '-' || liftSupport.has(y * w + x) || (!passable(x, y) && MOVER_CH.has(base(x, y)));
  const fits = (x, y) => passable(x, y) && passable(x, y - 1);
  const stand = (x, y) => fits(x, y) && !deadly(x, y) && (support(x, y + 1) || water(x, y));

  const jumpK = 1 / (def.gravity || 1), jumpUp = Math.floor(3 * jumpK);
  let reach, edges, cur = -1;
  const bfs = () => {
    reach = new Set();
    edges = new Map();   // переходы между клетками — для поиска ловушек
    const q = [];
    const push = (x, y) => {
      const k = y * w + x;
      if (cur >= 0 && cur !== k) { let e = edges.get(cur); if (!e) edges.set(cur, e = []); e.push(k); }
      if (reach.has(k)) return;
      reach.add(k);
      q.push([x, y]);
    };
    const fall = (x, y) => {
      for (let yy = y; yy < h; yy++) {
        if (!fits(x, yy)) return null;
        if (deadly(x, yy)) return null;
        if (water(x, yy) || support(x, yy + 1)) return [x, yy];
      }
      return null;
    };
    cur = -1;
    push(starts[0].x, starts[0].y);
    while (q.length) {
      const [x, y] = q.shift();
      cur = y * w + x;
      const inWater = water(x, y);
      // телепорт
      const si = srcs.findIndex((s) => s.x === x && (s.y === y || s.y === y + 1 || s.y === y - 1));
      if (si >= 0 && dsts[si]) { const d = fall(dsts[si].x, dsts[si].y); if (d) push(d[0], d[1]); }
      if (inWater) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!fits(nx, ny) || deadly(nx, ny)) continue;
          if (water(nx, ny)) push(nx, ny);
          else { const f = fall(nx, ny); if (f) push(f[0], f[1]); }
        }
      }
      // ходьба и сход с края
      for (const dx of [-1, 1]) {
        const f = fits(x + dx, y) ? fall(x + dx, y) : null;
        if (f) push(f[0], f[1]);
      }
      // спрыгнуть сквозь платформу
      if (base(x, y + 1) === '-') { const f = fall(x, y + 2); if (f) push(f[0], f[1]); }
      // съехать на лифте вниз по его пути
      if (liftSupport.has((y + 1) * w + x) && fits(x, y + 1)) {
        if (liftSupport.has((y + 2) * w + x)) push(x, y + 1);
        else { const f = fall(x, y + 1); if (f) push(f[0], f[1]); }
      }
      // прыжковая площадка: подброс до 11 клеток
      if (raw(x, y) === '^') {
        for (let dy = -1; dy >= -11; dy--) {
          if (!fits(x, y + dy)) break;
          for (const dir of [-1, 1]) {
            for (let dx = 0; dx <= 6; dx++) {
              const nx = x + dir * dx;
              if (!fits(nx, y + dy)) break;
              const f = fall(nx, y + dy);
              if (f) push(f[0], f[1]);
            }
          }
        }
      }
      // прыжки (при слабой тяжести выше и дальше во столько же раз)
      if (!support(x, y + 1) && !inWater) continue;
      for (let dy = -jumpUp; dy <= 0; dy++) {
        const py = y + dy;
        let ok = true;
        for (let r = y; r >= py; r--) if (!fits(x, r)) { ok = false; break; }
        if (!ok) continue;
        const ndy = Math.ceil(dy / jumpK);
        const maxDx = Math.floor((ndy <= -3 ? 3 : ndy === -2 ? 4 : 5) * jumpK);
        for (const dir of [-1, 1]) {
          for (let dx = 1; dx <= maxDx; dx++) {
            const nx = x + dir * dx;
            if (!fits(nx, py)) break;
            const f = fall(nx, py);
            if (f) push(f[0], f[1]);
          }
        }
      }
    }
  };

  // повторяем, пока открываются новые ключи/кнопки
  for (let iter = 0; iter < 6; iter++) {
    bfs();
    const near = (s) => reach.has(s.y * w + s.x) || reach.has((s.y + 1) * w + s.x) || reach.has((s.y - 1) * w + s.x);
    let changed = false;
    for (const s of spawns) {
      if (!near(s)) continue;
      if (s.c === '(' && !state.silver) { state.silver = true; changed = true; }
      if (s.c === ')' && !state.gold) { state.gold = true; changed = true; }
      if (s.c === 'b' && !state.gates) { state.gates = true; changed = true; }
      if (s.c === 'W' && !state.suit) { state.suit = true; changed = true; }
    }
    if (def.bossButtons && !state.gates && spawns.some((s) => s.c === 'b' && near(s))) { state.gates = true; changed = true; }
    if (!changed) break;
  }
  const near = (s) => reach.has(s.y * w + s.x) || reach.has((s.y + 1) * w + s.x) || reach.has((s.y - 1) * w + s.x) || reach.has(s.y * w + s.x + 1) || reach.has(s.y * w + s.x - 1);
  const reachedExits = exits.filter(near);
  if (def.exitAfterBoss && spawns.some((s) => s.c === 'w') && !srcs.some(near)) errors.push('телепорт к боссу недостижим');
  if (def.altarButtons) {
    const altars = spawns.filter((s) => s.c === 'b');
    const lostAltars = altars.filter((s) => !near(s));
    if (!altars.length) errors.push('на уровне с алтарями нет алтарей b');
    if (lostAltars.length) errors.push('недостижимые алтари: ' + lostAltars.map((s) => `(${s.x},${s.y})`).join(' '));
  }
  // засады: зона должна быть достижима, монстры — помещаться
  const traps = def.traps || [];
  let trapMonsters = 0;
  traps.forEach((t, i) => {
    const [x0, y0, x1, y1] = t.at;
    let hit = false;
    for (let y = y0; y <= y1 && !hit; y++) for (let x = x0; x <= x1; x++) if (reach.has(y * w + x)) { hit = true; break; }
    if (!hit) warnings.push(`засада #${i + 1}: зона (${x0},${y0})-(${x1},${y1}) недостижима`);
    for (const [sx, sy, ch] of t.spawn) {
      const hh = MONSTER_H[ch];
      if (!hh) { errors.push(`засада #${i + 1}: неизвестный монстр '${ch}'`); continue; }
      trapMonsters++;
      if (sx >= x0 - 3 && sx <= x1 + 3 && sy >= y0 - 3 && sy <= y1 + 3) warnings.push(`засада #${i + 1}: монстр '${ch}' в (${sx},${sy}) появляется вплотную к зоне`);
      for (let k = 0; k < hh; k++) if (SOLID.has(base(sx, sy - k)) || sx < 1 || sx >= w - 1) { warnings.push(`засада #${i + 1}: монстру '${ch}' тесно в (${sx},${sy})`); break; }
      if (!MONSTER_CH_FLY.has(ch) && ch !== 'u' && !SOLID.has(base(sx, sy + 1)) && base(sx, sy + 1) !== '-' && !LIQUID.has(base(sx, sy))) {
        let d = 1;
        while (sy + d < h && !SOLID.has(base(sx, sy + d)) && base(sx, sy + d) !== '-') d++;
        if (d > 6) warnings.push(`засада #${i + 1}: монстр '${ch}' в (${sx},${sy}) висит над пропастью`);
      }
    }
  });
  const cps = spawns.filter((s) => s.c === '&');
  const lostCp = cps.filter((s) => !near(s));
  if (lostCp.length) warnings.push('недостижимые контрольные точки: ' + lostCp.map((s) => `(${s.x},${s.y})`).join(' '));
  if (exits.length && !reachedExits.length) errors.push('выход E недостижим');
  // секретный выход: есть, достижим и ведёт на существующий секретный уровень
  const zs = spawns.filter((s) => s.c === 'Z');
  if (def.secretNext) {
    const to = LEVELS.find((l) => l.id === def.secretNext);
    if (!to || !to.secret) errors.push(`секретный выход ведёт на ${def.secretNext}, но такого секретного уровня нет`);
    if (!zs.length) errors.push('у уровня есть secretNext, но нет секретного выхода Z');
    else if (!zs.some(near)) errors.push('секретный выход Z недостижим');
  } else if (zs.length) errors.push('секретный выход Z без поля secretNext');
  // арена волн: монстры волн помещаются и стоят на опоре
  if (def.waves) {
    const [x0, y0, x1, y1] = def.waves.at;
    let hit = false;
    for (let y = y0; y <= y1 && !hit; y++) for (let x = x0; x <= x1; x++) if (reach.has(y * w + x)) { hit = true; break; }
    if (!hit) errors.push('зона арены волн недостижима');
    def.waves.list.forEach((wv, i) => {
      for (const [sx, sy, ch] of wv.spawn) {
        const hh = MONSTER_H[ch];
        if (!hh) { errors.push(`волна ${i + 1}: неизвестный монстр '${ch}'`); continue; }
        trapMonsters++;
        for (let k = 0; k < hh; k++) if (SOLID.has(base(sx, sy - k))) { warnings.push(`волна ${i + 1}: монстру '${ch}' тесно в (${sx},${sy})`); break; }
        if (!MONSTER_CH_FLY.has(ch) && !SOLID.has(base(sx, sy + 1)) && base(sx, sy + 1) !== '-') warnings.push(`волна ${i + 1}: монстр '${ch}' в (${sx},${sy}) не стоит на опоре`);
      }
      for (const [sx, sy] of wv.drop || []) if (!reach.has(sy * w + sx)) warnings.push(`волна ${i + 1}: припасы в (${sx},${sy}) недостижимы`);
    });
  }
  // ловушки: место, куда можно попасть, но откуда уже не дойти ни до выхода, ни до
  // секретного выхода (яма за выходом, бассейн без ступеней, трамплин в одну сторону)
  const back = new Map();
  for (const [a, list] of edges) for (const b of list) { let e = back.get(b); if (!e) back.set(b, e = []); e.push(a); }
  const free = new Set(), fq = [];
  for (const s of [...exits, ...zs]) {
    for (const k of [s.y * w + s.x, (s.y + 1) * w + s.x, (s.y - 1) * w + s.x, s.y * w + s.x + 1, s.y * w + s.x - 1]) {
      if (reach.has(k) && !free.has(k)) { free.add(k); fq.push(k); }
    }
  }
  while (fq.length) {
    const k = fq.pop();
    for (const a of back.get(k) || []) if (!free.has(a)) { free.add(a); fq.push(a); }
  }
  const stuck = [...reach].filter((k) => !free.has(k));
  if (reachedExits.length && stuck.length) {
    const left = new Set(stuck), groups = [];
    for (const k0 of stuck) {
      if (!left.has(k0)) continue;
      left.delete(k0);
      const st = [k0], gr = [];
      while (st.length) {
        const k = st.pop(); gr.push(k);
        const x = k % w, y = (k - x) / w;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const n = (y + dy) * w + x + dx; if (left.has(n)) { left.delete(n); st.push(n); } }
      }
      const xs = gr.map((k) => k % w), ys = gr.map((k) => Math.floor(k / w));
      groups.push(`(${Math.min(...xs)},${Math.min(...ys)})-(${Math.max(...xs)},${Math.max(...ys)})`);
    }
    errors.push('ловушки — попав сюда, не выбраться к выходу: ' + groups.join(' '));
  }
  if (def.skillPortals && reachedExits.length < exits.length) errors.push(`достижимо порталов сложности: ${reachedExits.length}/${exits.length}`);
  const items = spawns.filter((s) => '()+HMAYRUNKCQXVW3456789'.includes(s.c));
  const lost = items.filter((s) => !near(s));
  if (lost.length) warnings.push('недостижимые предметы: ' + lost.map((s) => `${s.c}(${s.x},${s.y})`).join(' '));
  const monsters = spawns.filter((s) => MONSTER_H[s.c]);
  const stats = `${w}x${h}, монстров ${monsters.length}+${trapMonsters}, засад ${traps.length}, предметов ${items.length}, секретов ${countGroups(g, '$')}, лифтов ${new Set([...liftSupport]).size ? runs.length && countRuns(runs) : 0}, точек ${cps.length}`;
  if (show) {
    const out = g.map((r, y) => r.split('').map((c, x) => (reach.has(y * w + x) && (c === ' ' || c === ',') ? '·' : c)).join(''));
    console.log(out.join('\n'));
  }
  return { errors, warnings, stats, reach, grid: g, w, h };
}

function countRuns(runs) {
  let n = 0;
  runs.forEach((r, i) => { if (i === 0 || runs[i - 1].y !== r.y || runs[i - 1].x !== r.x - 1) n++; });
  return n;
}

function countGroups(g, ch) {
  const h = g.length, w = g[0].length;
  const seen = new Set();
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== ch || seen.has(y * w + x)) continue;
      n++;
      const st = [[x, y]];
      seen.add(y * w + x);
      while (st.length) {
        const [cx, cy] = st.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (g[ny][nx] === ch && !seen.has(ny * w + nx)) { seen.add(ny * w + nx); st.push([nx, ny]); }
        }
      }
    }
  }
  return n;
}

// Снабжение: оружие из стартового набора уровня должно встречаться раньше в эпизоде —
// в наборе или на карте предыдущего уровня (иначе его выдаст только тайник у входа).
function supplyWarnings() {
  const out = {};
  const eps = [...new Set(LEVELS.filter((l) => l.episode).map((l) => l.episode))];
  for (const ep of eps) {
    const lv = LEVELS.filter((l) => l.episode === ep && !l.secret);
    for (let i = 1; i < lv.length; i++) {
      const prev = lv[i - 1];
      const have = new Set(prev.kit ? prev.kit.weapons : [1, 2]);
      prev.map.forEach((r) => [...r].forEach((c) => { if (/[3-9]/.test(c)) have.add(+c); }));
      const extra = (lv[i].kit ? lv[i].kit.weapons : []).filter((w) => !have.has(w));
      if (extra.length) out[lv[i].id] = `оружие ${extra.join(', ')} есть в наборе, но раньше в эпизоде не встречается`;
    }
  }
  return out;
}
module.exports = { analyze };
if (require.main !== module) return;

const SUPPLY = supplyWarnings();

const args = process.argv.slice(2);
const only = args.includes('--map') ? args[args.indexOf('--map') + 1] : null;
const show = args.includes('--show');
let bad = 0;
for (const def of LEVELS) {
  if (only && def.id !== only) continue;
  const r = analyze(def, show);
  const status = r.errors.length ? 'ОШИБКА' : 'ok';
  console.log(`${def.id.padEnd(6)} ${status.padEnd(7)} ${r.stats || ''}`);
  for (const e of r.errors) console.log('   ✗ ' + e);
  for (const e of r.warnings) console.log('   ! ' + e);
  if (SUPPLY[def.id]) console.log('   ! ' + SUPPLY[def.id]);
  if (r.errors.length) bad++;
}
process.exit(bad ? 1 : 0);
