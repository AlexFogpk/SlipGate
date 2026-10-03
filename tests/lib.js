'use strict';
// Общие помощники браузерных тестов: запуск Chromium через Playwright и загрузка игры.

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const GAME_URL = 'file://' + path.join(ROOT, 'index.html');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* нет локальной установки — пробуем глобальную */ }
  const { execSync } = require('child_process');
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

// Браузер: путь можно задать через CHROMIUM_PATH, иначе Playwright берёт свой.
async function launchBrowser() {
  const { chromium } = loadPlaywright();
  const opts = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

// Открывает игру в новой вкладке и собирает ошибки страницы в page.errors.
async function openGame(browser, { query = '', viewport = { width: 960, height: 540 }, context } = {}) {
  const page = context ? await context.newPage() : await browser.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
  await page.goto(GAME_URL + query);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.canvas);
  return page;
}

class CheckError extends Error {}
function check(cond, msg) { if (!cond) throw new CheckError(msg); }
function noPageErrors(page) { check(page.errors.length === 0, 'ошибки на странице:\n' + page.errors.join('\n')); }

module.exports = { ROOT, GAME_URL, loadPlaywright, launchBrowser, openGame, check, noPageErrors, CheckError, fs, path };
