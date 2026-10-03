"""Общие помощники дизайна уровней."""


def trap(x0, y0, x1, y1, spawn, msg=None):
    """Засада: когда герой входит в прямоугольник (x0,y0)-(x1,y1), монстры телепортируются."""
    t = {'at': [x0, y0, x1, y1], 'spawn': [list(s) for s in spawn]}
    if msg:
        t['msg'] = msg
    return t


def floor_secret(m, x, floor_row, items):
    """Люк в полу (2 клетки) и погреб под ним с платформой, чтобы выбраться."""
    m.fill(x, floor_row, x + 1, floor_row, '$')
    m.fill(x - 2, floor_row + 1, x + 3, floor_row + 4, ' ')
    m.plat(x, x + 1, floor_row + 3)
    for i, c in enumerate(items):
        m.put(x - 2 + i * 2, floor_row + 4, c)


def wall_secret(m, wall_x, y_floor, x0, x1, items, h=3):
    """Тайник за стеной: секретная стена в столбце wall_x высотой h и комната x0..x1."""
    m.fill(wall_x, y_floor - h + 1, wall_x, y_floor, '$')
    m.fill(x0, y_floor - h + 1, x1, y_floor, ' ')
    for i, c in enumerate(items):
        m.put(x0 + 1 + i, y_floor, c)


def secret_exit(m, wall_x, y_floor, direction=1, width=7):
    """Секретный выход: тайная стена в столбце wall_x и за ней комната со слипгейтом Z
    (в сторону direction), четыре клетки высотой, с факелами."""
    m.fill(wall_x, y_floor - 2, wall_x, y_floor, '$')
    xa, xb = (wall_x + 1, wall_x + width) if direction > 0 else (wall_x - width, wall_x - 1)
    for x in range(xa, xb + 1):
        for y in range(y_floor - 3, y_floor + 1):
            assert m.g[y][x] == '#', ('secret_exit: не камень', x, y, m.g[y][x])
        assert m.g[y_floor + 1][x] in '#%', ('secret_exit: нет пола', x)
    m.fill(xa, y_floor - 3, xb, y_floor, ' ')
    far = xb - 1 if direction > 0 else xa + 1
    m.put(far, y_floor, 'Z')
    m.put(xa + 1, y_floor - 2, 'L')
    m.put(xb - 1, y_floor - 3, 'L')


BLOCKING = set('#%D[]=$')   # стены, двери, решётки, тайные стены
SUPPORT = set('#%-')         # на чём можно стоять


def add_near(m, x, y, items, span=10):
    """Положить предметы на тот же пол рядом с (x, y): в пустые клетки (в том числе под небом) над опорой,
    по очереди справа и слева от точки, не проходя сквозь стены и не перепрыгивая ям.
    Так добавка к снабжению всегда лежит там, куда герой и так приходит."""
    order = [x]
    for d in range(1, span + 1):
        order += [x + d, x - d]
    for c in items:
        for cx in order:
            if not (0 <= cx < m.w) or m.g[y][cx] not in ' ,' or m.g[y + 1][cx] not in SUPPORT:
                continue
            lo, hi = sorted((x, cx))
            if any(m.g[y][xx] in BLOCKING or m.g[y + 1][xx] not in SUPPORT for xx in range(lo, hi + 1)):
                continue
            m.g[y][cx] = c
            break
        else:
            raise ValueError(f'add_near({x},{y}): нет места для {c!r}')
