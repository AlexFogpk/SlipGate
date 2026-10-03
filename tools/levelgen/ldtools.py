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
