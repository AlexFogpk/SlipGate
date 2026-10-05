#!/usr/bin/env node
'use strict';
// Простой сервер для проверки сборки приложения на компьютере:
//   node tools/build.js --app && node tools/serve.js dist/app 8080
// Откройте http://localhost:8080 — на localhost сервис-воркер и установка работают и без HTTPS.
// Телефону в той же сети этого мало: ему нужен адрес с HTTPS (см. README, «Установка на телефон»).
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serve(dir, port = 0) {
  const base = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(base, p);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('нет такого файла'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (require.main === module) {
  const dir = process.argv[2] || 'dist/app';
  serve(dir, +(process.argv[3] || 8080)).then((s) => console.log(`${dir}: http://localhost:${s.address().port}`));
}

module.exports = { serve };
