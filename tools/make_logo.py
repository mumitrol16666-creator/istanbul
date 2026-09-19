#!/usr/bin/env python3
"""Вырезает эмблему из brand/logo-original.png (красный фон → прозрачный) и
кладёт brand/logo-cutout.png. Чистый Python, без сторонних библиотек.

Запуск:  python3 tools/make_logo.py   (дальше размеры для сайта делает sips — см. README)
"""
import struct
import zlib
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "logo-original.png"
OUT = ROOT / "brand" / "logo-cutout.png"
PAD = 12  # прозрачные поля вокруг эмблемы, px


def read_png(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    assert depth == 8 and interlace == 0 and color in (2, 6), "only 8-bit RGB/RGBA"
    bpp = 3 if color == 2 else 4
    raw, stride = zlib.decompress(idat), w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        if f == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, bpp, rows


def write_png(path, w, h, rows):
    def chunk(tag, body):
        return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
                     chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    w, h, bpp, rows = read_png(SRC)
    # цвет фона — среднее по углам
    corners = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]
    bg = [sum(rows[y][x * bpp + k] for x, y in corners) // 4 for k in range(3)]
    print("size:", w, "x", h, "| background:", "#%02x%02x%02x" % tuple(bg))

    def whiteness(x, y):
        """0 — чистый фон, 1 — белый контур (по зелёному каналу: у красного он низкий)."""
        r, g, b = rows[y][x * bpp:x * bpp + 3]
        if r < 170 or abs(g - b) > 60:        # тёмное / цветное — точно не фон
            return 2.0
        return (min(g, b) - bg[1]) / max(1, 255 - bg[1])

    # заливка от краёв по «красно-розовым» пикселям; белый контур останавливает её
    alpha = [bytearray([255]) * w for _ in range(h)]
    seen = [bytearray(w) for _ in range(h)]
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if seen[y][x]:
            continue
        seen[y][x] = 1
        t = whiteness(x, y)
        if t >= 0.97:
            continue                           # белый контур: дальше не идём
        alpha[y][x] = max(0, min(255, int(round(t * 255)))) if t > 0.06 else 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                queue.append((nx, ny))

    ys = [y for y in range(h) if any(a for a in alpha[y])]
    xs = [x for x in range(w) if any(alpha[y][x] for y in ys)]
    x0, x1 = max(0, min(xs) - PAD), min(w - 1, max(xs) + PAD)
    y0, y1 = max(0, min(ys) - PAD), min(h - 1, max(ys) + PAD)

    out = []
    for y in range(y0, y1 + 1):
        line = bytearray()
        for x in range(x0, x1 + 1):
            a = alpha[y][x]
            if a == 255:
                line += rows[y][x * bpp:x * bpp + 3] + b"\xff"
            else:                              # сглаженный край контура — белый с частичной прозрачностью
                line += bytes((255, 255, 255, a))
        out.append(line)
    write_png(OUT, x1 - x0 + 1, y1 - y0 + 1, out)
    print("cutout:", x1 - x0 + 1, "x", y1 - y0 + 1, "->", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
