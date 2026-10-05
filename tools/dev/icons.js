'use strict';
// Иконки приложения: каменная арка слипгейта с вихрем портала, в пиксельном стиле игры.
// Рисуется на сетке 64×64 и увеличивается без сглаживания.
//   node tools/dev/icons.js            — app/icons/*.png
//   node tools/dev/icons.js preview.png — ещё и лист со всеми размерами для просмотра
const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('../../tests/lib');

const OUT = path.join(__dirname, '..', '..', 'app', 'icons');

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  const files = await page.evaluate(() => {
    // --- картинка 64×64 ---
    const art = document.createElement('canvas');
    art.width = art.height = 64;
    const g = art.getContext('2d');
    const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // фон: тёмный камень с тёплым отсветом снизу
    const bg = g.createRadialGradient(32, 44, 4, 32, 36, 46);
    bg.addColorStop(0, '#3a1c0c'); bg.addColorStop(0.55, '#1a0d07'); bg.addColorStop(1, '#070403');
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
    // арка: прямые стойки и полукруглый верх
    const arch = (ctx, x0, x1, top, bottom) => {
      const r = (x1 - x0) / 2, cx = x0 + r;
      ctx.beginPath();
      ctx.moveTo(x0, bottom); ctx.lineTo(x0, top + r);
      ctx.arc(cx, top + r, r, Math.PI, 0);
      ctx.lineTo(x1, bottom); ctx.closePath();
    };
    // камень рамы
    arch(g, 13, 51, 7, 56); g.fillStyle = '#4a3c30'; g.fill();
    // кладка: швы и светлые грани
    g.save(); arch(g, 13, 51, 7, 56); g.clip();
    for (let y = 8; y < 57; y += 6) px(13, y, 38, 1, '#2a2019');
    for (let y = 8; y < 57; y += 6) for (let x = 13 + ((y / 6) % 2) * 4; x < 51; x += 8) px(x, y, 1, 6, '#2a2019');
    for (let y = 9; y < 57; y += 6) px(13, y, 38, 1, '#6a5844');
    g.restore();
    // проём портала
    arch(g, 19, 45, 13, 56);
    const pg = g.createRadialGradient(32, 33, 1, 32, 34, 20);
    pg.addColorStop(0, '#f4ecff'); pg.addColorStop(0.18, '#c8a8ff'); pg.addColorStop(0.5, '#7040e0'); pg.addColorStop(1, '#1c0850');
    g.fillStyle = pg; g.fill();
    // вихрь: две спирали
    g.save(); arch(g, 19, 45, 13, 56); g.clip();
    for (const [col, ph] of [['rgba(255,240,255,0.75)', 0], ['rgba(150,110,255,0.8)', Math.PI]]) {
      g.strokeStyle = col; g.lineWidth = 1.6;
      g.beginPath();
      for (let a = 0; a < Math.PI * 3.2; a += 0.08) {
        const r = 1.5 + a * 2.1;
        const x = 32 + Math.cos(a + ph) * r, y = 34 + Math.sin(a + ph) * r * 1.15;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    // руны на раме и замковый камень
    for (const [x, y] of [[15, 22], [15, 32], [15, 42], [47, 22], [47, 32], [47, 42]]) { px(x, y, 2, 3, '#ff9a30'); px(x, y + 1, 2, 1, '#ffd070'); }
    px(30, 7, 4, 5, '#5e4c3a'); px(31, 8, 2, 3, '#ff9a30'); px(31, 9, 2, 1, '#ffe090');
    // пол и отсвет портала на нём
    px(6, 56, 52, 2, '#5a4836'); px(6, 58, 52, 6, '#2c2119');
    const fl = g.createRadialGradient(32, 57, 1, 32, 57, 16);
    fl.addColorStop(0, 'rgba(200,160,255,0.75)'); fl.addColorStop(1, 'rgba(200,160,255,0)');
    g.fillStyle = fl; g.fillRect(10, 54, 44, 8);
    // искры
    for (const [x, y] of [[24, 24], [40, 28], [27, 45], [37, 20], [42, 44]]) px(x, y, 1, 1, '#ffffff');
    // контур рамы
    g.strokeStyle = '#120a06'; g.lineWidth = 1; arch(g, 13.5, 50.5, 7.5, 56); g.stroke();

    // --- размеры ---
    const out = {};
    const make = (name, size, k = 1, full = true) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      if (full) { x.fillStyle = '#070403'; x.fillRect(0, 0, size, size); }
      // крупно — без сглаживания (пиксели), мелко — со сглаживанием
      x.imageSmoothingEnabled = size < 128;
      x.imageSmoothingQuality = 'high';
      const s = size * k, o = (size - s) / 2;
      if (k < 1) {
        // для маски фон тянется на весь квадрат, картинка — в безопасном круге
        x.imageSmoothingEnabled = false;
        x.drawImage(art, 0, 0, 64, 64, 0, 0, size, size);
        x.fillStyle = 'rgba(7,4,3,0.55)'; x.fillRect(0, 0, size, size);
      }
      x.drawImage(art, 0, 0, 64, 64, o, o, s, s);
      out[name] = c.toDataURL('image/png').split(',')[1];
    };
    make('icon-512.png', 512);
    make('icon-192.png', 192);
    make('icon-maskable-512.png', 512, 0.78);
    make('apple-touch-icon.png', 180);
    make('favicon-32.png', 32);
    return out;
  });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, b64] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64'));
  console.log('иконки:', Object.keys(files).map((n) => 'app/icons/' + n).join(', '));
  const preview = process.argv[2];
  if (preview) {
    const imgs = Object.entries(files).map(([n, b]) => `<figure><img src="data:image/png;base64,${b}"><figcaption>${n}</figcaption></figure>`).join('');
    await page.setContent(`<body style="margin:0;background:#888;display:flex;gap:16px;align-items:end;padding:16px;font:12px sans-serif">${imgs}<figure><img src="data:image/png;base64,${files['icon-maskable-512.png']}" style="width:192px;border-radius:50%"><figcaption>маска (круг)</figcaption></figure></body>`);
    await page.setViewportSize({ width: 1400, height: 600 });
    await page.screenshot({ path: preview, fullPage: true });
    console.log('просмотр:', preview);
  }
  await browser.close();
})();
