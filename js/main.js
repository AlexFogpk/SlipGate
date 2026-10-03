'use strict';
// Точка входа.

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  Input.init(canvas);
  try {
    if (document.fonts) {
      document.fonts.load('16px "Press Start 2P"');
      document.fonts.load('16px "Ruslan Display"');
    }
  } catch (e) { /* шрифты подгрузятся позже или останутся запасные */ }
  Game.init(canvas);
  window.__game = Game;
});
