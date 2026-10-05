#!/usr/bin/env node
'use strict';
// Собирает игру в один HTML-файл со встроенными стилями и скриптами.
// node tools/build.js                 -> dist/slipgate.html
// node tools/build.js --fragment out  -> фрагмент без <html>/<head>/<body> (для хостингов, которые оборачивают страницу сами)
// node tools/build.js --app [папка]   -> dist/app: игра как приложение для телефона — страница,
//                                        манифест, иконки и сервис-воркер для игры без интернета.
//                                        Папку выкладывают на любой хостинг с HTTPS (GitHub Pages).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, file) =>
  `<style>\n${fs.readFileSync(path.join(root, file), 'utf8')}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, file) =>
  `<script>\n${fs.readFileSync(path.join(root, file), 'utf8')}</script>`);

const args = process.argv.slice(2);
const fragIdx = args.indexOf('--fragment');
const appIdx = args.indexOf('--app');
const size = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' КБ';

if (fragIdx >= 0) {
  const out = args[fragIdx + 1];
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta[^>]*>\n?/g, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  fs.writeFileSync(out, head.trim() + '\n' + body.trim() + '\n');
  console.log('фрагмент:', out, size(out));
} else if (appIdx >= 0) {
  const next = args[appIdx + 1];
  const out = next && !next.startsWith('--') ? path.resolve(next) : path.join(root, 'dist', 'app');
  const src = path.join(root, 'app');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
  // страница: манифест, значки и настройки полноэкранного запуска на iPhone
  const page = html.replace(/<title>[^<]*<\/title>/, `<title>SLIPGATE</title>
<meta name="description" content="Двумерный шутер в духе Quake: четыре эпизода, боссы, тайники">
<meta name="theme-color" content="#050302">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="SLIPGATE">`);
  fs.writeFileSync(path.join(out, 'index.html'), page);
  const files = ['./', 'index.html', 'manifest.webmanifest'];
  const hash = crypto.createHash('sha256').update(page);
  for (const f of ['manifest.webmanifest'].concat(fs.readdirSync(path.join(src, 'icons')).sort().map((n) => 'icons/' + n))) {
    const data = fs.readFileSync(path.join(src, f));
    fs.writeFileSync(path.join(out, f), data);
    hash.update(data);
    if (f.startsWith('icons/')) files.push(f);
  }
  // версия — отпечаток содержимого: изменилась игра — у телефона появится обновление
  const version = hash.digest('hex').slice(0, 12);
  const sw = fs.readFileSync(path.join(src, 'sw.js'), 'utf8')
    .replace('__VERSION__', version)
    .replace('__FILES__', JSON.stringify(files));
  fs.writeFileSync(path.join(out, 'sw.js'), sw);
  console.log('приложение:', path.relative(root, out) || out, '— страница', size(path.join(out, 'index.html')), '· версия', version);
} else {
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const out = path.join(dist, 'slipgate.html');
  fs.writeFileSync(out, html);
  console.log('готово:', path.relative(root, out), size(out));
}
