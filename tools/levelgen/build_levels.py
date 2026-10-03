#!/usr/bin/env python3
"""Генератор карт уровней: собирает js/levels.js из описаний на Python.

    python3 tools/levelgen/build_levels.py            перезаписать js/levels.js
    python3 tools/levelgen/build_levels.py --check    сверить js/levels.js с генератором
    python3 tools/levelgen/build_levels.py --stdout   напечатать результат
    python3 tools/levelgen/build_levels.py ПУТЬ       записать в другой файл

Эпизод 1 и стартовый хаб описаны здесь, эпизоды 2–4 — в e2/e3/e4_levels.py,
общие приёмы (засады, тайники) — в ldtools.py.
"""
import json, os, sys
from ldtools import trap, floor_secret, wall_secret, add_near, secret_exit
from supply_moves import SUPPLY_MOVES

class M:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [['#'] * w for _ in range(h)]
    def fill(self, x0, y0, x1, y1, ch=' '):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                assert 0 < x < self.w - 1 and 0 < y < self.h - 1, (x, y)
                self.g[y][x] = ch
    def put(self, x, y, s):
        for i, ch in enumerate(s):
            assert 0 < x + i < self.w - 1 and 0 < y < self.h - 1, (x + i, y)
            self.g[y][x + i] = ch
    def plat(self, x0, x1, y):
        self.fill(x0, y, x1, y, '-')
    def lift(self, x, y, length, ex=None, ey=None):
        # лифт: '_' * length в (x, y), отметка ':' в (ex, ey) — тот же столбец или ряд
        self.put(x, y, '_' * length)
        self.put(x if ex is None else ex, y if ey is None else ey, ':')
    def stairs(self, x, floor, n, direction=1, width=2, ch='#'):
        # ступени высотой в клетку: ступень i стоит на уровне floor-1-i (строка стояния floor-2-i)
        for i in range(n):
            x0 = x + direction * i * width
            xa, xb = (x0, x0 + width - 1) if direction > 0 else (x0 - width + 1, x0)
            self.fill(xa, floor - 1 - i, xb, floor - 1, ch)
    def ladder(self, xl, xr, stand_bottom, stand_top, w=4):
        # зигзаг платформ каждые 3 клетки вверх, попеременно слева и справа
        y, left = stand_bottom - 3, True
        while y >= stand_top:
            x0 = xl if left else xr
            self.plat(x0, x0 + w - 1, y + 1)
            y -= 3
            left = not left
    def rows(self):
        return [''.join(r) for r in self.g]
    # --- детализация ---
    def deco(self, x0, y0, x1, y1, over=' '):
        # фоновая архитектура 'I' только поверх пустоты (или неба, over=' ,')
        for y in range(max(1, y0), min(self.h - 2, y1) + 1):
            for x in range(max(1, x0), min(self.w - 2, x1) + 1):
                if self.g[y][x] in over:
                    self.g[y][x] = 'I'
    def columns(self, x0, x1, top, bottom, step=10, w=2, over=' '):
        # ряд колонн на заднем плане с капителями и базами
        x = x0
        while x + w - 1 <= x1:
            self.deco(x, top, x + w - 1, bottom, over)
            self.deco(x - 1, top, x + w, top, over)
            self.deco(x - 1, bottom, x + w, bottom, over)
            x += step
    def arches(self, x0, x1, ceil, step=10, over=' '):
        # арки под потолком между колоннами: пояс и «плечи»
        self.deco(x0, ceil, x1, ceil, over)
        x = x0
        while x <= x1:
            self.deco(x - 2, ceil + 1, x + 3, ceil + 1, over)
            self.deco(x - 1, ceil + 2, x + 2, ceil + 2, over)
            x += step
    def solid(self, x0, y0, x1, y1, ch='#'):
        # как fill, но не даёт замуровать предмет, монстра или механизм
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                c = self.g[y][x]
                if c not in ' ,I#%.~!;':
                    raise ValueError(f'solid({x0},{y0},{x1},{y1}) закрывает {c!r} в ({x},{y})')
        self.fill(x0, y0, x1, y1, ch)
    def block(self, x0, x1, floor, h=1, ch='#'):
        # возвышение на полу: верх на строке floor - h
        self.solid(x0, floor - h, x1, floor - 1, ch)
    def ledge(self, x0, x1, y, ch='#'):
        self.solid(x0, y, x1, y, ch)
    def clear_ok(self, x, y):
        return self.g[y][x] in ' ,I'
    def roughen(self, x0, y0, x1, y1, seed=1, ceil=3, walls=2, floor_bumps=0.0, ch='#', keep=5):
        # «природные» неровности пещеры: сталактиты со свода и выступы стен.
        # Трогает только пустые клетки и оставляет над полом не меньше keep клеток.
        def rnd(x, y):
            v = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xffffffff
            v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
            return (v ^ (v >> 16)) / 0xffffffff
        def free_col(x, ya, yb):
            return all(self.g[y][x] == ' ' for y in range(ya, yb + 1))
        for x in range(x0, x1 + 1):
            # над проёмами (шахты, люки, лифты) свод не трогаем
            if any(self.g[y0 - 1][xx] not in '#%' for xx in range(max(0, x - 1), min(self.w, x + 2))):
                continue
            # свод: плавная кривая + редкие сталактиты
            d = int(rnd(x // 3, 1) * ceil + 0.5)
            if rnd(x, 2) < 0.12:
                d += 1 + int(rnd(x, 3) * 2)
            # глубина до ближайшего препятствия снизу (с соседями ±3 — там могут прыгать)
            def depth_at(xx):
                if xx < 1 or xx > self.w - 2:
                    return 99
                k = 0
                while y0 + k <= y1 and self.g[y0 + k][xx] in ' I':
                    k += 1
                return k
            depth = min(depth_at(xx) for xx in range(x - 3, x + 4))
            d = min(d, max(0, depth - keep))
            if d > 0 and free_col(x, y0, y0 + d - 1):
                for y in range(y0, y0 + d):
                    self.g[y][x] = ch
        for y in range(y0, y1 + 1):
            for (xe, dx) in ((x0, 1), (x1, -1)):
                # только там, где снаружи сплошная стена, а не проход в соседний зал
                ox = xe - dx
                if not all(0 <= yy < self.h and self.g[yy][ox] in '#%' for yy in range(y - 2, y + 4)):
                    continue
                w = int(rnd(y // 2, 5 + (dx > 0)) * walls + 0.3)
                for i in range(w):
                    x = xe + dx * i
                    if self.g[y][x] == ' ' and y < y1 - 2:
                        self.g[y][x] = ch
        if floor_bumps:
            for x in range(x0 + 2, x1 - 1):
                if rnd(x, 9) < floor_bumps and self.g[y1][x] == ' ' and self.g[y1 - 1][x] == ' ' and self.g[y1 + 1][x] in '#%':
                    if self.g[y1][x - 1] == ' ' and self.g[y1][x + 1] == ' ':
                        self.g[y1][x] = ch


LEVELS = []

def level(meta, m):
    meta = dict(meta)
    # припасы от старта — на маршрут (см. supply_moves.py)
    for fx, fy, ch, tx, ty, back in SUPPLY_MOVES.get(meta['id'], []):
        assert m.g[fy][fx] == ch, (meta['id'], fx, fy, ch, m.g[fy][fx])
        assert m.g[ty][tx] in ' ,', (meta['id'], tx, ty, m.g[ty][tx])
        m.g[fy][fx] = back
        m.g[ty][tx] = ch
    meta['map'] = m.rows()
    LEVELS.append(meta)

# ---------------------------------------------------------------- START
def start():
    # Зал выбора сложности — башня: «чем выше, тем сложнее». Герой появляется на первом
    # этаже, лёгкие врата — прямо по ходу, в конце этажа. Лестница площадок — во дворе
    # позади героя: с неё свои входы на второй (нормальный) и третий (сложный) этажи.
    # Так ни одни врата и ни одна площадка не стоят на пути к другим. «Кошмар», как в
    # Quake, спрятан под водой — колодец во дворе.
    m = M(80, 40)
    m.fill(1, 1, 24, 30, ',')
    m.fill(25, 28, 25, 30, 'D')
    m.fill(26, 8, 77, 30, ' ')
    m.put(29, 30, 'P')
    # этажи башни и входы на них со двора
    m.fill(26, 24, 77, 24, '#')
    m.fill(26, 17, 77, 17, '#')
    m.fill(25, 21, 25, 23, ' ')
    m.fill(25, 14, 25, 16, ' ')
    m.fill(18, 24, 24, 24, '#')
    m.fill(18, 17, 24, 17, '#')
    # лестница площадок во дворе
    m.ladder(6, 12, 30, 16, w=4)
    # врата вплотную к торцевой стене этажа — их не перепрыгнуть и не проскочить
    m.put(77, 30, 'E'); m.put(77, 23, 'E'); m.put(77, 16, 'E')
    for x in (32, 46, 60, 74):
        m.put(x, 8, '*'); m.put(x, 18, '*'); m.put(x, 25, '*')
    for (top, bottom) in ((9, 16), (18, 23), (25, 30)):
        m.columns(40, 72, top, bottom, step=14, w=1)
    # подводный ход к «Кошмару»: колодец во дворе, тоннель под залом и воздушный карман
    m.fill(2, 31, 3, 31, ',')
    m.fill(2, 32, 3, 34, '~')
    m.fill(2, 35, 29, 37, '~')
    m.fill(26, 32, 33, 34, ' ')
    m.fill(30, 35, 33, 35, '%')
    m.put(32, 34, 'E')
    m.put(28, 33, 'L')
    level({
        'id': 'start', 'name': 'START', 'title': 'Вступление', 'theme': 'base', 'next': 'e1m1', 'music': 55,
        # врата в порядке разбора карты (сверху вниз): сложный, нормальный, лёгкий, кошмар
        'skillPortals': [2, 1, 0, 3],
        'intro': 'Лёгкий — прямо, в конце зала.\nНормальный и сложный — выше:\nлестница во дворе позади вас',
        'labels': [
            {'x': 75, 'y': 26.6, 'text': 'ЛЁГКИЙ'},
            {'x': 74, 'y': 19.6, 'text': 'НОРМАЛЬНЫЙ'},
            {'x': 75, 'y': 12.6, 'text': 'СЛОЖНЫЙ'},
            {'x': 32, 'y': 31.3, 'text': 'КОШМАР', 'color': '#e05040'},
            {'x': 12, 'y': 13, 'text': 'ВЫШЕ — СЛОЖНЕЕ', 'color': '#a08060'},
            {'x': 12, 'y': 6, 'text': 'SLIPGATE', 'color': '#c89050'},
        ],
    }, m)

# ---------------------------------------------------------------- E1M1
def e1m1():
    m = M(160, 40)
    # A: улица, мост над водой, сторожевая вышка на дальнем берегу
    m.fill(1, 1, 36, 24, ',')
    m.fill(1, 25, 36, 31, '~')
    m.fill(1, 20, 7, 31, '#')
    m.fill(28, 20, 36, 31, '#')
    m.fill(2, 27, 6, 30, '~')
    m.fill(7, 29, 7, 30, '~')
    m.put(3, 30, 'A'); m.put(5, 30, '+')
    m.plat(8, 27, 20)
    for x in (13, 20):
        m.deco(x, 21, x, 24, over=',')
    m.ledge(31, 35, 14)
    m.deco(31, 15, 31, 19, over=','); m.deco(35, 15, 35, 19, over=',')
    m.plat(28, 30, 17)
    m.put(33, 13, 'g'); m.put(34, 13, 'U')
    m.put(4, 19, 'P')
    m.put(30, 19, 'N')
    # B: входной коридор — трубы под потолком, ящики и бетонный блок как укрытия
    m.fill(37, 17, 37, 19, 'D')
    m.fill(38, 14, 62, 19, ' ')
    m.deco(38, 14, 62, 14)
    for x in (44, 56):
        m.deco(x, 15, x, 19)
    for x in (42, 52, 61):
        m.put(x, 15, '*')
    m.block(49, 50, 20, 2)
    m.put(45, 19, 'U'); m.put(52, 19, 'g'); m.put(47, 19, 'x'); m.put(58, 19, 'g'); m.put(60, 19, 'x')
    # C: большой зал с платформами
    m.fill(63, 4, 96, 31, ' ')
    m.columns(66, 95, 5, 30, step=10, w=2)
    m.arches(64, 95, 4, step=10)
    m.fill(63, 20, 68, 20, '#')
    m.fill(63, 11, 71, 11, '#')
    m.plat(66, 71, 29)
    m.plat(74, 79, 26)
    m.plat(82, 87, 23)
    m.plat(90, 95, 20)
    m.plat(82, 87, 17)
    m.plat(74, 79, 14)
    for x in (70, 80, 90):
        m.put(x, 5, '*')
    for (x, y) in ((64, 21), (95, 24), (72, 19), (88, 11), (66, 28)):
        m.put(x, y, '*')
    m.put(65, 10, '3'); m.put(64, 9, 'b'); m.put(69, 10, 'U')
    m.fill(62, 9, 62, 10, '$')
    m.fill(58, 8, 61, 10, ' ')
    m.put(59, 10, 'Y'); m.put(60, 10, 'H')
    # укрытие у подножия и пара псов
    m.block(78, 80, 32, 1)
    m.put(74, 31, 'd'); m.put(92, 19, 'g'); m.put(76, 13, 'g')
    m.put(90, 31, 'H'); m.put(77, 25, 'U')
    m.fill(97, 28, 97, 31, '=')
    # D: слизневый зал, каратель на карнизе над дверью
    m.fill(98, 24, 128, 31, ' ')
    m.deco(98, 24, 128, 24)
    m.fill(104, 32, 121, 34, ';')
    m.plat(107, 109, 31)
    m.plat(113, 115, 31)
    m.plat(118, 119, 31)
    m.put(105, 25, '*'); m.put(118, 25, '*')
    m.put(100, 31, '+')
    m.ledge(123, 128, 27)
    m.put(126, 26, 'e')
    m.put(124, 31, 'x'); m.put(127, 31, 'g')
    m.fill(129, 29, 129, 31, 'D')
    # E: зал выхода — колонны, балкон и тайник над ним
    m.fill(130, 16, 158, 31, ' ')
    m.columns(134, 157, 17, 30, step=8, w=1)
    m.fill(147, 31, 149, 31, '#')
    m.fill(150, 30, 156, 31, '#')
    m.put(153, 29, 'E')
    for x in (135, 145, 155):
        m.put(x, 16, '*')
    m.plat(136, 146, 24)
    m.plat(144, 148, 27)
    m.plat(130, 133, 21)
    m.fill(125, 18, 128, 20, ' ')
    m.fill(129, 18, 129, 20, '$')
    m.put(126, 20, 'R'); m.put(127, 20, 'K')
    m.put(140, 23, 'g'); m.put(138, 31, 'd')
    m.put(132, 31, 'U'); m.put(148, 30, 'H')
    # ещё один тайник (место подобрано tools/dev/secret-spots.js)
    floor_secret(m, 84, 32, 'YU')
    level({
        'id': 'e1m1', 'name': 'E1M1', 'title': 'Шлюзовой комплекс', 'theme': 'base', 'episode': 1, 'next': 'e1m2', 'music': 49,
        'kit': {'weapons': [1, 2], 'ammo': {'shells': 25}},
        'traps': [
            trap(63, 8, 68, 10, [(86, 31, 'd'), (93, 31, 'd'), (84, 22, 'g')]),
            trap(144, 26, 152, 31, [(137, 23, 'g'), (135, 31, 'g'), (157, 29, 'd')]),
        ],
    }, m)

# ---------------------------------------------------------------- E1M2
def e1m2():
    m = M(170, 44)
    # A: двор замка, ров
    m.fill(1, 1, 34, 24, ',')
    m.fill(20, 26, 29, 32, '~')
    m.plat(20, 29, 25)
    m.fill(19, 31, 19, 32, '$')
    m.fill(14, 30, 18, 32, '~')
    m.put(16, 32, 'Y')
    m.put(3, 24, 'P'); m.put(8, 24, 'U'); m.put(14, 24, 'd'); m.put(32, 24, 'k')
    # башня у ворот: силуэт с зубцами и боевой ход с часовым
    m.deco(27, 6, 34, 18, over=',')
    for x in range(27, 35, 2):
        m.deco(x, 5, x, 5, over=',')
    m.ledge(27, 34, 19)
    m.plat(21, 24, 22)
    m.put(31, 18, 'g'); m.put(33, 18, 'U')
    # B: большой зал с балконом
    m.fill(35, 22, 35, 24, 'D')
    m.fill(36, 12, 80, 24, ' ')
    for x in (40, 48, 58, 68, 78):
        m.put(x, 21, 'L')
    m.put(62, 14, 'L'); m.put(74, 14, 'L')
    m.plat(50, 53, 22)
    m.plat(45, 48, 19)
    m.fill(52, 17, 80, 17, '#')
    # колонны под балконом, арки и тронное возвышение
    m.columns(56, 79, 18, 23, step=8, w=2)
    m.arches(40, 50, 12, step=10)
    m.deco(52, 18, 80, 18)
    m.block(61, 67, 25, 1)
    m.put(64, 23, 'k'); m.put(72, 24, 'k'); m.put(65, 16, 'g'); m.put(75, 16, 'g'); m.put(45, 14, 's')
    m.put(78, 16, '4'); m.put(44, 24, 'U'); m.put(72, 24, 'H'); m.put(56, 16, 'N')
    # коридор с балкона к башне
    m.fill(81, 13, 100, 16, ' ')
    m.put(90, 13, 'L')
    m.put(94, 16, 'g')
    floor_secret(m, 88, 17, 'AK')
    # дверь в подземелье и шахта вниз
    m.fill(81, 22, 81, 24, 'D')
    m.fill(82, 22, 86, 24, ' ')
    m.fill(84, 25, 86, 35, ' ')
    # D: подземелье
    m.fill(82, 36, 100, 41, ' ')
    m.put(88, 38, 'L'); m.put(97, 38, 'L')
    m.put(90, 41, 'z'); m.put(96, 41, 'z')
    m.put(93, 41, '(')
    # решётки камер на заднем плане
    for x in range(84, 100, 4):
        m.deco(x, 37, x, 40)
    m.deco(83, 36, 99, 36)
    m.fill(81, 40, 81, 41, '$')
    m.fill(76, 38, 80, 41, ' ')
    m.put(78, 41, 'Q'); m.put(77, 41, 'U')
    # C: башня
    m.fill(101, 3, 120, 41, ' ')
    m.fill(101, 17, 102, 17, '#')
    for i, y in enumerate((39, 36, 33, 30, 27, 24, 21, 18, 15, 12, 9)):
        if i % 2 == 0:
            m.plat(103, 108, y)
        else:
            m.plat(111, 120, y)
    for (x, y) in ((104, 30), (118, 22), (104, 12), (118, 36)):
        m.put(x, y, 'L')
    # бойницы в стене башни
    for y in (5, 21, 29):
        m.fill(100, y, 100, y + 1, ',')
    m.deco(110, 4, 110, 40)
    m.put(105, 8, '6'); m.put(107, 8, 'K')
    m.put(110, 6, 's'); m.put(115, 22, 's'); m.put(106, 30, 's')
    m.put(114, 17, 'H'); m.put(104, 38, '+')
    m.put(110, 41, 'z'); m.put(116, 41, 'z')
    m.fill(121, 15, 121, 17, '[')
    # E: зал выхода
    m.fill(122, 15, 140, 17, ' ')
    m.put(131, 15, 'L')
    m.fill(141, 8, 166, 24, ' ')
    m.fill(141, 18, 145, 18, '#')
    m.fill(158, 24, 159, 24, '#')
    m.fill(160, 23, 164, 24, '#')
    m.put(162, 22, 'E')
    m.put(148, 14, 'L'); m.put(158, 14, 'L'); m.put(152, 20, 'L')
    m.columns(147, 165, 9, 23, step=6, w=1)
    m.arches(146, 165, 8, step=6)
    m.plat(148, 153, 21)
    m.put(151, 20, 'g'); m.put(155, 24, 'k'); m.put(157, 23, 'g'); m.put(150, 12, 's')
    m.put(143, 17, 'H'); m.put(144, 17, 'U')
    # ещё один тайник (место подобрано tools/dev/secret-spots.js)
    wall_secret(m, 99, 30, 96, 98, '7K')
    # секретный выход на E1M7 — за тайной стеной в конце нижнего зала
    secret_exit(m, 121, 41)
    level({
        'id': 'e1m2', 'name': 'E1M2', 'title': 'Замок проклятых', 'theme': 'castle', 'episode': 1, 'next': 'e1m3', 'music': 46.25,
        'secretNext': 'e1m7',
        'kit': {'weapons': [1, 2, 3], 'ammo': {'shells': 40}},
        'traps': [
            trap(76, 14, 80, 16, [(44, 24, 'k'), (54, 24, 'k'), (70, 24, 'd')]),
            trap(92, 39, 94, 41, [(84, 41, 'z'), (99, 41, 'z'), (88, 41, 'z'), (98, 38, 'k')], 'Мёртвые встают!'),
            trap(103, 6, 108, 8, [(115, 6, 's'), (106, 14, 's')]),
            trap(158, 20, 164, 24, [(144, 17, 'k'), (160, 16, 's'), (146, 24, 'k')]),
        ],
    }, m)

# ---------------------------------------------------------------- E1M3
def e1m3():
    m = M(178, 48)
    # A: вход в склеп
    m.fill(1, 22, 28, 33, ' ')
    m.put(3, 33, 'P'); m.put(6, 27, 'L'); m.put(18, 27, 'L')
    m.put(9, 33, 'U'); m.put(12, 33, 'H')
    # ниши с гробами в стене, саркофаг и люк в полу
    for x in (8, 14, 22):
        m.deco(x, 24, x + 3, 26)
    m.arches(2, 27, 22, step=8)
    m.block(15, 17, 34, 1, '%')
    floor_secret(m, 21, 34, 'HN')
    m.put(24, 33, 'k'); m.put(16, 32, 'z')
    # B: катакомбы
    m.fill(29, 24, 80, 33, ' ')
    for x in (40, 58, 70):
        m.fill(x, 24, x + 1, 28, '#')
    for x in (46, 61, 76):
        m.fill(x, 32, x + 2, 33, '%')
    for x in (35, 50, 65, 79):
        m.put(x, 27, 'L')
    # погребальные полки под висячими опорами — с них кидаются зомби
    for x0 in (38, 56, 68):
        m.ledge(x0, x0 + 5, 29)
    for x in range(31, 80, 6):
        m.deco(x, 25, x + 2, 26)
    m.put(43, 28, 'z'); m.put(61, 28, 'z'); m.put(73, 28, 'z'); m.put(50, 33, 'z'); m.put(74, 33, 'o'); m.put(62, 25, 's')
    m.put(44, 33, 'N')
    m.fill(52, 34, 54, 37, ' ')
    m.fill(81, 32, 81, 33, '$')
    m.fill(82, 30, 86, 33, ' ')
    m.put(84, 33, 'Y'); m.put(85, 33, 'N')
    # C: затопленный склеп
    m.fill(29, 37, 105, 37, ' ')
    m.fill(29, 38, 105, 44, '~')
    m.fill(28, 42, 28, 43, '$')
    m.fill(24, 41, 27, 44, '~')
    m.put(25, 44, 'M')
    m.put(70, 44, 'U'); m.put(90, 44, 'K')
    m.fill(106, 41, 110, 44, '~')
    # лампы над затопленным склепом подсвечивают путь к подводному ходу
    for x in (38, 56, 74, 92, 104):
        m.put(x, 37, '*')
    # C2: зал с островом и золотым ключом
    m.fill(111, 28, 140, 40, ' ')
    m.fill(111, 41, 140, 44, '~')
    m.fill(120, 40, 135, 44, '#')
    m.put(130, 39, ')'); m.put(124, 39, '7'); m.put(126, 39, 'K')
    m.put(128, 39, 'o'); m.put(133, 39, 'z'); m.put(121, 39, 'z')
    m.columns(113, 139, 29, 38, step=9, w=1)
    m.arches(112, 139, 28, step=9)
    m.put(115, 32, 's'); m.put(137, 30, 's')
    m.put(118, 32, 'L'); m.put(128, 30, 'L'); m.put(138, 34, 'L')
    m.plat(136, 139, 37)
    m.plat(131, 134, 34)
    m.plat(136, 139, 31)
    # D: коридор к золотой двери
    m.fill(141, 26, 160, 29, ' ')
    m.put(150, 26, 'L')
    m.put(152, 29, 'f'); m.put(143, 29, 'H')
    m.fill(161, 27, 161, 29, ']')
    # E: выход
    m.fill(162, 20, 176, 29, ' ')
    m.put(172, 29, 'E'); m.put(165, 23, 'L'); m.put(175, 23, 'L')
    m.put(166, 29, 'k'); m.put(169, 29, 'o'); m.put(163, 29, 'U')
    m.columns(164, 175, 21, 28, step=5, w=1)
    m.deco(142, 26, 160, 26)
    # ещё один тайник (место подобрано tools/dev/secret-spots.js)
    floor_secret(m, 123, 40, 'MN')
    level({
        'id': 'e1m3', 'name': 'E1M3', 'title': 'Некрополь', 'theme': 'crypt', 'episode': 1, 'next': 'e1m4', 'music': 41.2,
        'kit': {'weapons': [1, 2, 3, 4, 6], 'ammo': {'shells': 40, 'nails': 60, 'rockets': 10}},
        'traps': [
            trap(72, 30, 78, 33, [(34, 33, 'z'), (37, 33, 'z'), (55, 33, 'z'), (64, 33, 'k')], 'Мёртвые встают!'),
            trap(129, 37, 131, 39, [(117, 39, 'z'), (124, 39, 'k'), (135, 39, 'z'), (137, 36, 'z')]),
            trap(142, 27, 150, 29, [(158, 29, 'z'), (155, 29, 'k')]),
        ],
    }, m)

# ---------------------------------------------------------------- E1M4
def e1m4():
    m = M(196, 50)
    # A: вход в пещеру под открытым небом
    m.fill(1, 1, 24, 22, ',')
    m.fill(25, 14, 45, 22, ' ')
    m.put(3, 22, 'P'); m.put(10, 22, 'U'); m.put(30, 22, 'N'); m.put(33, 16, 'L')
    m.put(36, 17, 's'); m.put(41, 22, 'o')
    # B: слизневое озеро
    m.fill(46, 10, 95, 26, ' ')
    m.fill(50, 27, 90, 34, ';')
    for (x0, x1, y) in ((52, 55, 24), (59, 61, 22), (65, 67, 24), (71, 73, 22), (77, 79, 24), (83, 85, 22), (88, 90, 24)):
        m.plat(x0, x1, y)
    for (x, y) in ((48, 18), (62, 14), (78, 14), (93, 18)):
        m.put(x, y, 'L')
    m.put(60, 14, 's'); m.put(75, 16, 's'); m.put(86, 12, 's')
    m.put(93, 26, 'z'); m.put(47, 26, '+')
    # C: проход, биокостюм, затопленный тоннель
    m.fill(96, 20, 110, 26, ' ')
    m.put(100, 26, 'W'); m.put(104, 26, 'H'); m.put(98, 21, 'L'); m.put(106, 26, 'o')
    m.fill(108, 27, 111, 31, ';')
    m.fill(108, 32, 150, 35, ';')
    m.fill(147, 27, 150, 31, ';')
    m.put(128, 35, 'U')
    # D: нижняя пещера
    m.fill(140, 14, 185, 26, ' ')
    m.fill(147, 27, 150, 27, ';')
    m.put(145, 20, 'L'); m.put(160, 18, 'L'); m.put(172, 20, 'L'); m.put(182, 18, 'L')
    m.put(170, 26, '5'); m.put(175, 26, '('); m.put(166, 26, 'N')
    m.put(160, 26, 't'); m.put(164, 26, 't'); m.put(156, 26, 'f'); m.put(178, 26, 't')
    m.fill(139, 25, 139, 26, '$')
    m.fill(134, 23, 138, 26, ' ')
    m.put(136, 26, 'Q'); m.put(137, 26, 'M')
    # лестница вверх
    m.plat(152, 155, 24)
    m.plat(141, 144, 21)
    m.plat(146, 149, 21)
    m.plat(152, 155, 18)
    m.plat(141, 149, 16)
    m.fill(140, 13, 144, 13, ' ')
    # E: верхняя пещера шамблера
    m.fill(140, 2, 185, 12, ' ')
    m.put(148, 6, 'L'); m.put(165, 5, 'L'); m.put(180, 6, 'L')
    m.put(168, 12, 'm'); m.put(158, 8, 's')
    m.put(150, 12, 'K'); m.put(152, 12, 'K'); m.put(176, 12, 'Y')
    m.fill(186, 10, 186, 12, '[')
    m.fill(187, 5, 194, 12, ' ')
    m.put(191, 12, 'E'); m.put(189, 7, 'L')
    # тайник за стеной у биокостюма
    wall_secret(m, 111, 26, 112, 116, 'RK')
    # в озере — островок-камень с ловушкой: гнездо скрагов
    m.block(69, 70, 27, 1, '#')
    # природные неровности сводов и стен
    m.roughen(25, 14, 45, 22, seed=11, ceil=2, walls=1)
    m.roughen(46, 10, 95, 26, seed=12, ceil=3, walls=2)
    m.roughen(140, 14, 185, 26, seed=13, ceil=3, walls=1, floor_bumps=0.08)
    m.roughen(140, 2, 185, 12, seed=14, ceil=2, walls=1, floor_bumps=0.06)
    # ещё один тайник (место подобрано tools/dev/secret-spots.js)
    wall_secret(m, 107, 35, 104, 106, 'VK')
    level({
        'id': 'e1m4', 'name': 'E1M4', 'title': 'Жуткий грот', 'theme': 'cave', 'episode': 1, 'next': 'e1m5', 'music': 43.65,
        'kit': {'weapons': [1, 2, 3, 4, 6, 7], 'ammo': {'shells': 50, 'nails': 80, 'rockets': 15}, 'armor': 100},
        'traps': [
            trap(98, 24, 102, 26, [(92, 26, 'z'), (107, 26, 'z'), (91, 20, 's')]),
            trap(173, 24, 177, 26, [(160, 26, 't'), (168, 26, 'f'), (182, 26, 't')]),
            trap(178, 10, 185, 12, [(160, 8, 's'), (172, 6, 's'), (150, 12, 'o')]),
        ],
    }, m)

# ---------------------------------------------------------------- E1M5
def e1m5():
    m = M(200, 60)
    # A: старт
    m.fill(1, 40, 26, 50, ' ')
    m.put(3, 50, 'P'); m.put(8, 44, 'L'); m.put(20, 44, 'L')
    m.put(10, 50, 'U'); m.put(12, 50, 'N'); m.put(14, 50, 'K')
    m.put(22, 50, 'k')
    m.fill(27, 48, 27, 50, 'D')
    # B: лавовая река
    m.fill(28, 36, 80, 50, ' ')
    m.fill(36, 51, 75, 54, '!')
    for (x0, x1, y) in ((38, 41, 49), (45, 48, 48), (52, 55, 49), (59, 62, 47), (66, 69, 49), (72, 74, 48)):
        m.plat(x0, x1, y)
    m.plat(55, 58, 42)
    m.plat(61, 64, 45)
    m.put(57, 41, 'X')
    # руины над рекой: обломанные колонны и карниз карателя
    for (x, top) in ((33, 39), (45, 43), (64, 37), (73, 41)):
        m.deco(x, top, x + 1, 50)
        m.deco(x - 1, top, x + 2, top)
    m.ledge(75, 80, 45)
    for (x, y) in ((33, 42), (50, 38), (70, 38), (78, 42)):
        m.put(x, y, 'L')
    m.put(78, 44, 'e'); m.put(79, 50, 'k'); m.put(50, 40, 's'); m.put(66, 40, 's')
    m.put(30, 50, 'H')
    m.fill(81, 48, 81, 50, 'D')
    # C: зиккурат
    m.fill(82, 10, 150, 50, ' ')
    m.fill(92, 48, 140, 50, '#')
    m.fill(97, 45, 135, 47, '#')
    m.fill(102, 42, 130, 44, '#')
    m.fill(107, 39, 125, 41, '#')
    m.fill(112, 36, 120, 38, '#')
    m.put(116, 35, '>'); m.put(113, 35, 'M'); m.put(119, 35, 'C')
    # колоннада храма по краям зала, арки и парящие обломки
    for x in (86, 146):
        m.deco(x, 11, x + 2, 49)
        m.deco(x - 1, 11, x + 3, 12)
    m.arches(90, 145, 10, step=11)
    for (x0, x1, y) in ((92, 97, 30), (136, 141, 30), (100, 104, 22), (128, 132, 22)):
        m.ledge(x0, x1, y, '%')
    wall_secret(m, 92, 50, 93, 98, 'QK', h=2)
    for (x, y) in ((85, 30), (100, 26), (132, 26), (148, 30), (116, 20), (88, 44), (145, 44)):
        m.put(x, y, 'L')
    m.put(100, 44, 'o'); m.put(133, 44, 'o'); m.put(110, 38, 'n'); m.put(122, 38, 'k')
    m.put(144, 50, 'm'); m.put(88, 50, 'k'); m.put(95, 47, 'e'); m.put(138, 47, 'e')
    m.put(84, 50, 'H'); m.put(104, 41, 'U'); m.put(128, 41, 'N')
    m.fill(151, 48, 151, 50, ']')
    # D: зал золотого ключа (попадаем телепортом)
    m.fill(155, 8, 197, 20, ' ')
    m.put(158, 20, '<')
    m.fill(176, 21, 183, 24, '!')
    m.plat(176, 183, 21)
    m.put(170, 20, '8'); m.put(172, 20, 'C'); m.put(174, 20, 'C'); m.put(192, 20, ')')
    m.put(180, 20, 'm'); m.put(188, 20, 'n'); m.put(165, 20, 'e')
    for (x, y) in ((160, 13), (172, 12), (186, 13), (195, 14)):
        m.put(x, y, 'L')
    m.put(162, 20, 'H')
    m.fill(154, 18, 154, 20, 'D')
    m.fill(152, 18, 153, 20, ' ')
    m.fill(151, 18, 151, 20, ' ')
    # E: выход за золотой дверью
    m.fill(152, 42, 175, 50, ' ')
    m.put(172, 50, 'E'); m.put(156, 45, 'L'); m.put(170, 45, 'L')
    m.put(160, 50, 'n'); m.put(166, 50, 'o'); m.put(154, 50, 'H')
    m.fill(176, 49, 176, 50, '$')
    m.fill(177, 47, 181, 50, ' ')
    m.put(179, 50, 'R'); m.put(180, 50, 'C')
    # снабжение: патронов и лечения не хватало на всех монстров
    add_near(m, 104, 41, 'K'); add_near(m, 154, 50, 'U')
    add_near(m, 84, 50, 'H'); add_near(m, 128, 41, 'H')
    # ещё один тайник (место подобрано tools/dev/secret-spots.js)
    floor_secret(m, 126, 42, 'MK')
    level({
        'id': 'e1m5', 'name': 'E1M5', 'title': 'Древний мир', 'theme': 'elder', 'episode': 1, 'next': 'e1m6', 'music': 38.9,
        'kit': {'weapons': [1, 2, 3, 4, 5, 6, 7], 'ammo': {'shells': 60, 'nails': 120, 'rockets': 20}, 'armor': 100},
        'traps': [
            trap(107, 36, 125, 38, [(90, 50, 'k'), (143, 50, 'k'), (94, 29, 's'), (138, 29, 's')]),
            trap(189, 18, 195, 20, [(160, 20, 'n'), (168, 20, 'e'), (184, 20, 'k')], 'Засада!'),
            trap(166, 48, 170, 50, [(156, 50, 'n'), (174, 47, 'o')]),
        ],
    }, m)

# ---------------------------------------------------------------- E1M6
def e1m6():
    m = M(150, 50)
    # A: подход
    m.fill(1, 26, 40, 35, ' ')
    m.put(3, 35, 'P')
    m.put(10, 30, 'L'); m.put(25, 30, 'L'); m.put(38, 30, 'L')
    m.put(30, 35, 'n'); m.put(34, 31, 'e')
    m.put(8, 35, 'H'); m.put(12, 35, 'U'); m.put(14, 35, 'N'); m.put(16, 35, 'K'); m.put(18, 35, 'C'); m.put(6, 35, 'Y')
    # преддверие: колонны, арки и помост карателя
    m.columns(4, 39, 27, 34, step=7, w=1)
    m.arches(2, 39, 26, step=7)
    m.ledge(31, 37, 32)
    m.plat(26, 29, 33)
    m.fill(41, 33, 41, 35, 'D')
    # B: арена Хтона
    m.fill(42, 8, 120, 35, ' ')
    m.fill(62, 36, 100, 40, '!')
    m.put(81, 36, 'c')
    m.put(60, 35, '@'); m.put(102, 35, '@')
    m.put(44, 35, 'b'); m.put(118, 35, 'b')
    m.fill(57, 25, 105, 25, '#')
    for (x0, x1, y) in ((52, 55, 33), (46, 49, 30), (52, 55, 27), (107, 110, 33), (113, 116, 30), (107, 110, 27)):
        m.plat(x0, x1, y)
    m.put(50, 35, 'H'); m.put(48, 35, 'K'); m.put(112, 35, 'H'); m.put(114, 35, 'C'); m.put(81, 24, 'M')
    m.put(70, 14, 's'); m.put(95, 14, 's')
    for (x, y) in ((45, 16), (60, 12), (81, 10), (102, 12), (117, 16)):
        m.put(x, y, 'L')
    # своды над лавовым озером: колонны по бокам и арки
    for x in (44, 118):
        m.deco(x, 9, x + 1, 24)
    m.arches(47, 116, 8, step=10)
    m.deco(57, 26, 58, 35); m.deco(104, 26, 105, 35)
    # C: зал руны (открывается после победы)
    m.fill(121, 33, 121, 35, '=')
    m.fill(122, 28, 140, 35, ' ')
    m.put(136, 35, 'E'); m.put(126, 31, 'L'); m.put(138, 31, 'L')
    m.columns(124, 139, 29, 34, step=5, w=1)
    level({
        'id': 'e1m6', 'name': 'E1M6', 'title': 'Дом Хтона', 'theme': 'elder', 'episode': 1, 'next': 'e2m1', 'finale': 'e1', 'music': 36.7,
        'bossButtons': True, 'skyTheme': 'elder',
        # за дверью арены — появление Хтона; лава поднимается по всей арене до решётки зала руны
        'bossIntro': [42, 26, 50, 35], 'flood': [42, 120, 36],
        'traps': [
            trap(24, 33, 28, 35, [(10, 35, 'k'), (4, 35, 'k'), (16, 35, 'd')]),
        ],
        'kit': {'weapons': [1, 2, 3, 4, 5, 6, 7, 8], 'ammo': {'shells': 60, 'nails': 120, 'rockets': 25, 'cells': 40}, 'armor': 150},
    }, m)

start()
e1m1()
e1m2()
e1m3()
e1m4()
e1m5()
e1m6()

import e2_levels
e2_levels.build(M, level)
import e3_levels
e3_levels.build(M, level)
import e4_levels
e4_levels.build(M, level)
import secret_levels
secret_levels.build(M, level)

if __name__ == '__main__':
    default = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'js', 'levels.js')
    arg = sys.argv[1] if len(sys.argv) > 1 else default
    body = []
    for lv in LEVELS:
        mp = lv.pop('map')
        meta = json.dumps(lv, ensure_ascii=False)
        rows = ',\n'.join('      ' + json.dumps(r, ensure_ascii=False) for r in mp)
        body.append('  Object.assign(' + meta + ', {\n    map: [\n' + rows + ',\n    ],\n  })')
    js = ("'use strict';\n"
          "// Карты уровней. Легенда символов — в README.md (раздел «Редактор уровней»).\n"
          "// Каждая строка — ряд тайлов 16×16 пикселей.\n\n"
          "const EPISODES = [\n"
          "  { id: 1, title: 'Измерение Доблести', first: 'e1m1' },\n"
          "  { id: 2, title: 'Царство Чёрной Магии', first: 'e2m1' },\n"
          "  { id: 3, title: 'Нижний мир', first: 'e3m1' },\n"
          "  { id: 4, title: 'Измерение Древних', first: 'e4m1' },\n"
          "];\n\n"
          "const LEVELS = [\n" + ',\n'.join(body) + ',\n];\n\n'
          "if (typeof module !== 'undefined') module.exports = { LEVELS, EPISODES };\n")
    if arg == '--stdout':
        print(js)
    elif arg == '--check':
        with open(default, encoding='utf-8') as f:
            same = f.read() == js
        print('js/levels.js совпадает с генератором' if same else
              'js/levels.js расходится с генератором: правьте tools/levelgen/*.py и перегенерируйте')
        sys.exit(0 if same else 1)
    else:
        with open(arg, 'w', encoding='utf-8') as f:
            f.write(js)
