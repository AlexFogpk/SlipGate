#!/usr/bin/env node
'use strict';
// Упаковывает звуки из sounds/*.mp3 в js/sounds.js (base64), чтобы игра со звуком
// работала и из index.html, открытого как файл, и в однофайловой сборке.
// Файлы называются <имя>_<номер>.mp3: варианты одного звука идут по номерам.
// Запуск: node tools/pack-sounds.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'sounds');
const groups = {};
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mp3')).sort()) {
  const m = f.match(/^(.+)_(\d+)\.mp3$/);
  if (!m) continue;
  (groups[m[1]] = groups[m[1]] || [])[+m[2]] = fs.readFileSync(path.join(dir, f)).toString('base64');
}
const lines = Object.keys(groups).sort().map((k) => `  ${k}: [\n${groups[k].map((b) => `    '${b}',`).join('\n')}\n  ],`);
const js = "'use strict';\n// Записанные звуки (MP3 в base64). Файл собирается командой node tools/pack-sounds.js\n" +
  '// из каталога sounds/ — правьте звуки там. Источники и лицензии: sounds/CREDITS.md.\n\n' +
  'const SOUND_FILES = {\n' + lines.join('\n') + '\n};\n';
fs.writeFileSync(path.join(root, 'js', 'sounds.js'), js);
const n = Object.values(groups).reduce((s, g) => s + g.length, 0);
console.log(`js/sounds.js: ${Object.keys(groups).length} звуков, ${n} файлов, ${(js.length / 1024).toFixed(0)} КБ`);
