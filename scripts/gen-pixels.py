"""Pixel art for Egytronic.

Every icon is drawn on an integer grid and emitted as axis-aligned rects, so the
art stays crisp at any size, animates with plain CSS, and ships as a few KB of text.
Run `python3 scripts/gen-pixels.py` after changing a shape.
"""
from pathlib import Path
import random

OUT = Path("assets/img/pixel")
OUT.mkdir(parents=True, exist_ok=True)

PALETTE = {
    "1": "#3d3d3d",  # outline
    "2": "#202020",  # panel
    "3": "#ffffff",  # text
    "4": "#ff6a00",  # gold
    "5": "#ffa45c",  # amber
    ".": None,
}


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.cells = [["." for _ in range(w)] for _ in range(h)]

    def put(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.cells[y][x] = ch

    def rect(self, x, y, w, h, ch):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, ch)

    def frame(self, x, y, w, h, ch="1"):
        for xx in range(x, x + w):
            self.put(xx, y, ch)
            self.put(xx, y + h - 1, ch)
        for yy in range(y, y + h):
            self.put(x, yy, ch)
            self.put(x + w - 1, yy, ch)

    def line(self, x1, y1, x2, y2, ch, thick=1):
        dx, dy = abs(x2 - x1), abs(y2 - y1)
        sx, sy = (1 if x1 < x2 else -1), (1 if y1 < y2 else -1)
        err = dx - dy
        while True:
            for t in range(thick):
                self.put(x1 + t, y1, ch)
            if x1 == x2 and y1 == y2:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x1 += sx
            if e2 < dx:
                err += dx
                y1 += sy

    def svg(self, name, cell=4):
        out = []
        for y, row in enumerate(self.cells):
            x = 0
            while x < len(row):
                ch = row[x]
                fill = PALETTE.get(ch)
                if fill is None:
                    x += 1
                    continue
                run = 1
                while x + run < len(row) and row[x + run] == ch:
                    run += 1
                out.append(
                    f'<rect x="{x * cell}" y="{y * cell}" width="{run * cell}" height="{cell}" fill="{fill}"/>'
                )
                x += run
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w * cell} {self.h * cell}" '
            f'shape-rendering="crispEdges" aria-hidden="true">\n  ' + "\n  ".join(out) + "\n</svg>\n"
        )
        (OUT / name).write_text(svg, encoding="utf-8")
        print(name, len(svg), "bytes")


def logo():
    g = Grid(16, 16)
    g.rect(2, 2, 12, 2, "4")   # top arm
    g.rect(2, 7, 9, 2, "4")    # middle arm
    g.rect(2, 12, 12, 2, "4")  # bottom arm
    g.rect(2, 2, 2, 12, "4")   # spine
    g.rect(11, 4, 2, 3, "5")   # a lighter glint
    g.svg("g-logo.svg")


def landing():
    g = Grid(16, 16)
    g.frame(1, 2, 14, 12)
    g.rect(3, 4, 1, 1, "5")
    g.rect(5, 4, 1, 1, "5")
    g.rect(7, 4, 1, 1, "5")
    g.rect(2, 6, 12, 1, "1")
    g.rect(3, 8, 10, 3, "4")   # hero band
    g.rect(3, 12, 6, 1, "3")   # headline
    g.rect(10, 12, 3, 1, "4")  # button
    g.svg("g-landing.svg")


def static():
    g = Grid(16, 16)
    g.frame(1, 1, 14, 14)
    for i, y in enumerate((4, 7, 10)):
        g.rect(3, y, 2, 2, "4" if i == 0 else "5")  # page dot
        g.rect(6, y, 7, 1, "1")                    # page line
    g.svg("g-static.svg")


def identity():
    g = Grid(16, 16)
    g.frame(1, 1, 14, 14)
    g.rect(3, 3, 4, 4, "4")
    g.rect(9, 3, 4, 4, "5")
    g.rect(3, 9, 4, 4, "1")
    g.rect(9, 9, 4, 4, "4")
    g.svg("g-identity.svg")


def dynamic():
    g = Grid(16, 16)
    g.frame(2, 1, 12, 4)
    g.frame(2, 6, 12, 4)
    g.frame(2, 11, 12, 4)
    g.rect(4, 2, 1, 2, "4")
    g.rect(4, 7, 1, 2, "5")
    g.rect(4, 12, 1, 2, "4")
    g.rect(7, 2, 5, 1, "1")
    g.rect(7, 7, 5, 1, "1")
    g.rect(7, 12, 5, 1, "1")
    g.svg("g-dynamic.svg")


def check():
    g = Grid(16, 16)
    g.frame(1, 1, 14, 14)
    g.line(4, 8, 7, 11, "4", thick=2)
    g.line(7, 11, 12, 4, "4", thick=2)
    g.svg("g-check.svg")


logo()
landing()
static()
identity()
dynamic()
check()


def erp():
    g = Grid(16, 16)
    for x, y in ((1, 1), (9, 1), (1, 9)):
        g.frame(x, y, 6, 6)
    g.rect(3, 3, 2, 2, "4")
    g.rect(11, 3, 2, 2, "5")
    g.rect(3, 11, 2, 2, "4")
    g.rect(9, 9, 6, 6, "4")
    g.frame(9, 9, 6, 6)
    g.svg("g-erp.svg")


def crm():
    g = Grid(16, 16)
    g.frame(2, 2, 9, 9)
    g.rect(4, 4, 5, 4, "5")   # head
    g.rect(3, 9, 7, 1, "4")   # shoulders
    g.frame(9, 8, 5, 5, "4")  # second card
    g.rect(11, 10, 1, 2, "4")
    g.svg("g-crm.svg")


def pos():
    g = Grid(16, 16)
    g.frame(3, 1, 10, 11)
    for x in range(4, 12, 2):
        g.rect(x, 12, 1, 2, "1")
    g.rect(5, 3, 6, 1, "5")
    g.rect(5, 6, 4, 1, "1")
    g.rect(5, 8, 5, 1, "1")
    g.rect(5, 10, 3, 1, "4")
    g.svg("g-pos.svg")


def lms():
    g = Grid(16, 16)
    g.frame(1, 4, 6, 9, "4")      # left page
    g.frame(9, 4, 6, 9, "4")      # right page
    g.rect(7, 4, 2, 9, "5")       # spine
    g.rect(2, 6, 3, 1, "1")
    g.rect(2, 8, 4, 1, "1")
    g.rect(10, 6, 3, 1, "1")
    g.rect(10, 8, 4, 1, "1")
    g.rect(2, 11, 2, 1, "4")
    g.rect(10, 11, 2, 1, "4")
    g.svg("g-lms.svg")


def hms():
    g = Grid(16, 16)
    g.frame(2, 1, 12, 14)
    g.rect(6, 4, 4, 8, "4")
    g.rect(4, 6, 8, 4, "4")
    g.rect(7, 12, 2, 2, "5")
    g.svg("g-hms.svg")


erp()
crm()
pos()
lms()
hms()


def skyline(width=1200, height=200, seed=16):
    """A city strip: buildings, lit windows that flicker, antenna beacons."""
    rnd = random.Random(seed)
    parts, x, floor = [], 0, height - 10
    while x < width:
        w = rnd.choice([44, 52, 60, 72, 88, 104])
        h = rnd.choice([46, 58, 70, 86, 104, 128, 150])
        top = floor - h
        parts.append(f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="{rnd.choice(["#262626", "#2b2b2b", "#222222"])}"/>')
        parts.append(f'<rect x="{x}" y="{top}" width="{w}" height="3" fill="#4d4d4d"/>')
        parts.append(f'<rect x="{x}" y="{top}" width="2" height="{h}" fill="#333333"/>')
        for c in range(max(1, (w - 12) // 12)):
            for r in range(max(1, (h - 14) // 14)):
                roll = rnd.random()
                if roll > 0.62:
                    fill, cls = ("#ff6a00" if roll > 0.9 else "#ffa45c"), "w"
                elif roll > 0.5:
                    fill, cls = "#565656", ""
                else:
                    continue
                parts.append(
                    f'<rect x="{x + 8 + c * 12}" y="{top + 10 + r * 14}" width="4" height="5" fill="{fill}"'
                    f' class="{cls}" style="animation-delay:{round(rnd.uniform(0, 9), 2)}s"/>'
                )
        if h > 120 and rnd.random() > 0.4:
            ax = x + w // 2
            parts.append(f'<rect x="{ax}" y="{top - 24}" width="2" height="24" fill="#3d3d3d"/>')
            parts.append(
                f'<rect x="{ax - 2}" y="{top - 30}" width="6" height="6" fill="#ff6a00" class="b"'
                f' style="animation-delay:{round(rnd.uniform(0, 2), 2)}s"/>'
            )
        x += w + rnd.choice([0, 0, 4, 8])

    body = "\n  ".join(parts)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" aria-hidden="true">
  <style>
    .w {{ opacity: .8; animation: dim 7s steps(1, end) infinite; }}
    .b {{ animation: beacon 2.4s steps(1, end) infinite; }}
    @keyframes dim {{ 0%, 88% {{ opacity: .8 }} 90%, 94% {{ opacity: .18 }} 96%, 100% {{ opacity: .8 }} }}
    @keyframes beacon {{ 0%, 55% {{ opacity: 1 }} 60%, 100% {{ opacity: .15 }} }}
    @media (prefers-reduced-motion: reduce) {{ .w, .b {{ animation: none }} }}
  </style>
  <defs>
    <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff6a00" stop-opacity="0"/>
      <stop offset="1" stop-color="#ff6a00" stop-opacity=".22"/>
    </linearGradient>
  </defs>
  <rect x="0" y="{floor - 90}" width="{width}" height="90" fill="url(#horizon)"/>
  <rect x="0" y="{floor}" width="{width}" height="{height - floor}" fill="#2f2f2f"/>
  <rect x="0" y="{floor}" width="{width}" height="2" fill="#ff6a00" opacity=".45"/>
  <g>
  {body}
  </g>
</svg>
'''
    (OUT / "skyline.svg").write_text(svg, encoding="utf-8")
    print("skyline.svg", len(svg), "bytes")


skyline()
