'use strict';
// Язык интерфейса: русский или английский. Тексты в коде русские; в английском режиме
// каждая строка переводится в момент отрисовки (HUD.text и заголовки) по словарю EN.
// Первый запуск берёт язык браузера, дальше — выбор в «Настройках»; ?lang=en|ru в адресе
// переключает и запоминает язык.

const CYRILLIC = /[А-Яа-яЁё]/;
// Разделители составных строк («Звуки: 50%», «Убито 3/10   Секреты 1/2», «ХТОН  ·  ЯРОСТЬ»).
const TR_SEPARATORS = ['\n', '  ·  ', ' · ', '   ', '  ', ': ', ' — ', ', ', ' / '];

const I18N = {
  lang: 'ru',
  cache: new Map(),
  lower: null,

  init() {
    let lang = null;
    try { lang = new URLSearchParams(location.search).get('lang'); } catch (e) { /* без адреса */ }
    if (lang === 'ru' || lang === 'en') Store.set('lang', lang);
    else lang = Store.get('lang');
    this.apply(lang === 'ru' || lang === 'en' ? lang : this.browserLang());
  },

  browserLang() {
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^ru\b/i.test(first) ? 'ru' : 'en';
  },

  set(lang) {
    Store.set('lang', lang);
    this.apply(lang);
  },

  apply(lang) {
    this.lang = lang;
    this.cache.clear();
    document.documentElement.lang = lang;
    const canvas = document.getElementById('game');
    if (canvas) canvas.setAttribute('aria-label', this.t('Slipgate — двумерный шутер в духе Quake'));
  },

  // Строка для экрана на текущем языке.
  t(s) {
    if (this.lang === 'ru' || typeof s !== 'string' || !CYRILLIC.test(s)) return s;
    let out = this.cache.get(s);
    if (out === undefined) {
      if (this.cache.size > 1000) this.cache.clear();   // в строках бывают таймеры и счётчики
      out = this.translate(s);
      this.cache.set(s, out);
    }
    return out;
  },

  translate(s) {
    if (!CYRILLIC.test(s)) return s;
    if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
    const lead = s.length - s.trimStart().length, tail = s.length - s.trimEnd().length;
    if (lead || tail) return s.slice(0, lead) + this.translate(s.slice(lead, s.length - tail)) + s.slice(s.length - tail);
    // тот же текст другими буквами: «ЭПИЗОД», «нормальный», «ДВУСТВОЛКА»
    if (!this.lower) {
      this.lower = new Map();
      for (const k of Object.keys(EN)) if (!this.lower.has(k.toLowerCase())) this.lower.set(k.toLowerCase(), EN[k]);
    }
    const same = this.lower.get(s.toLowerCase());
    if (same !== undefined) return matchCase(s, same);
    // составная строка: шаблоны фраз, разделители, слово с числом — первый вариант без
    // русских букв (иначе «барьер, руны 2/4» разобьётся по запятой раньше, чем по числу)
    const t = (x) => this.translate(x);
    const variants = function* () {
      for (const [re, fn] of EN_PATTERNS) {
        const m = s.match(re);
        if (m) yield fn(m, t);
      }
      for (const sep of TR_SEPARATORS) if (s.includes(sep)) yield s.split(sep).map(t).join(sep);
      // слово и число: «Убито 3/10», «Эпизод 2», «Лучшее время 1:05»
      let m = s.match(/^(.*\S) (\d[\d/:.%]*)$/);
      if (m) yield t(m[1]) + ' ' + m[2];
      // код или число и слово: «E1M2 Замок проклятых», «20 гвозди»
      m = s.match(/^([A-Z0-9][A-Za-z0-9]*) (.+)$/);
      if (m) yield m[1] + ' ' + t(m[2]);
    };
    let first = null;
    for (const out of variants()) {
      if (!CYRILLIC.test(out)) return out;
      if (first === null) first = out;
    }
    return first === null ? s : first;
  },
};

// Перевод в регистре оригинала: ВСЕ ЗАГЛАВНЫЕ, со строчной или с заглавной буквы.
function matchCase(src, en) {
  if (src === src.toUpperCase()) return en.toUpperCase();
  if (src[0] === src[0].toLowerCase()) return en[0].toLowerCase() + en.slice(1);
  return en[0].toUpperCase() + en.slice(1);
}
