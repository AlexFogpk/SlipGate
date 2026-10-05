'use strict';
// Игра как приложение на телефоне: установка на главный экран и запуск без интернета.
// Манифест и сервис-воркер есть только в сборке приложения (node tools/build.js --app):
// там страница их подключает. В обычной сборке, с диска и в чужой песочнице всё это молчит.

const App = {
  offer: null,       // отложенное предложение установки от браузера (Chrome, Android)
  updated: false,    // новая версия скачана — включится после перезапуска

  // подключён ли манифест — то есть это сборка приложения
  get enabled() { return !!document.querySelector('link[rel="manifest"]'); },
  // запущено с главного экрана, а не во вкладке браузера
  get installed() {
    const mm = (q) => window.matchMedia && window.matchMedia(q).matches;
    return mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)') || navigator.standalone === true;
  },
  get ios() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  // пункт «Установить» в меню: браузер готов установить, или это iPhone (там — вручную через «Поделиться»)
  canInstall() { return this.enabled && !this.installed && (!!this.offer || this.ios); },

  init() {
    if (!this.enabled) return;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.offer = e; });
    window.addEventListener('appinstalled', () => { this.offer = null; Menu.flash('SLIPGATE установлен — значок на главном экране', 5); });
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    // обновление: новый воркер забирает страницу — значит, на сайте вышла новая версия
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) this.updated = true; });
    navigator.serviceWorker.register('sw.js').catch(() => { /* без воркера игра просто не работает офлайн */ });
  },

  install() {
    if (this.offer) {
      const e = this.offer;
      this.offer = null;
      e.prompt();
      return;
    }
    if (this.ios) Menu.flash('В Safari: кнопка «Поделиться» (квадрат со стрелкой)\n→ «На экран „Домой“» → «Добавить»', 12);
  },

  menuItems() {
    const list = [];
    if (this.updated) list.push({ label: 'Обновить игру', note: 'новая версия уже скачана', act: () => location.reload() });
    if (this.canInstall()) list.push({ label: 'Установить на телефон', note: 'значок на главном экране, игра без интернета', act: () => this.install() });
    return list;
  },
};
