#!/usr/bin/env node
'use strict';
// Собирает игру в один HTML-файл со встроенными стилями и скриптами.
// node tools/build.js                 -> dist/slipgate.html
// node tools/build.js --fragment out  -> фрагмент без <html>/<head>/<body> (для хостингов, которые оборачивают страницу сами)

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, file) =>
  `<style>\n${fs.readFileSync(path.join(root, file), 'utf8')}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, file) =>
  `<script>\n${fs.readFileSync(path.join(root, file), 'utf8')}</script>`);

const args = process.argv.slice(2);
const fragIdx = args.indexOf('--fragment');
if (fragIdx >= 0) {
  const out = args[fragIdx + 1];
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta[^>]*>\n?/g, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  fs.writeFileSync(out, head.trim() + '\n' + body.trim() + '\n');
  console.log('фрагмент:', out, (fs.statSync(out).size / 1024).toFixed(0) + ' КБ');
} else {
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const out = path.join(dist, 'slipgate.html');
  fs.writeFileSync(out, html);
  console.log('готово:', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(0) + ' КБ');
}
