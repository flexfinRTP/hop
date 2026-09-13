"""Crop/zoom the empty desk plate and key bunny+wheel into one alpha prop."""
from collections import deque
from pathlib import Path
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "desk"
ASSETS = Path(os.environ.get("HOP_DESK_ASSETS", str(ROOT)))


def lum(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def flood(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if mask[0, x]:
            q.append((0, x))
        if mask[h - 1, x]:
            q.append((h - 1, x))
    for y in range(h):
        if mask[y, 0]:
            q.append((y, 0))
        if mask[y, w - 1]:
            q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or y >= h or x < 0 or x >= w or out[y, x] or not mask[y, x]:
            continue
        out[y, x] = True
        q.append((y - 1, x))
        q.append((y + 1, x))
        q.append((y, x - 1))
        q.append((y, x + 1))
    return out


def crop_plate():
    wide = ROOT / "desk-wide.png"
    if not wide.exists():
        Image.open(ROOT / "desk-empty.png").save(wide)
    src = Image.open(wide).convert("RGB")
    w, h = src.size
    # Original OLED panel (inner bezel), measured on 1280x720 plate.
    sx0, sy0, sx1, sy1 = 400, 136, 957, 488
    cw, ch = 1016, 572  # 16:9, ~1.26x zoom
    left = 176
    top = 72
    box = (left, top, left + cw, top + ch)
    out = src.crop(box).resize((1280, 720), Image.Resampling.LANCZOS)
    out.save(ROOT / "desk-empty.png")
    # screen % in the resized plate
    scale_x = 1280 / cw
    scale_y = 720 / ch
    L = (sx0 - left) * scale_x
    T = (sy0 - top) * scale_y
    R = (sx1 - left) * scale_x
    B = (sy1 - top) * scale_y
    print("plate crop", box)
    print(
        "screen css",
        f"left: {100 * L / 1280:.2f}%;",
        f"top: {100 * T / 720:.2f}%;",
        f"width: {100 * (R - L) / 1280:.2f}%;",
        f"height: {100 * (B - T) / 720:.2f}%;",
    )
    return out


def key_prop(src: Path, dest: Path):
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    rgb = arr[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = lum(rgb)
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    sat = np.where(mx == 0, 0, (mx - mn) / np.maximum(mx, 1))
    black = y < 18
    wood = (r > g + 4) & (r - b > 14) & (y > 5) & (y < 95) & (sat > 0.14)
    # tungsten lamp: bright warm OR dark metal shade in the right 22%
    lamp = (r > 90) & (r > g) & (g > b) & (arr.shape[1] - np.arange(arr.shape[1])[None, :] < arr.shape[1] * 0.28)
    shade = (y < 40) & (sat < 0.22) & (np.arange(arr.shape[1])[None, :] > arr.shape[1] * 0.72)
    kill = black | wood | lamp | shade
    punched = flood(kill)
    a = arr[..., 3].copy()
    a[punched] = 0
    dead = a == 0
    near = (
        np.pad(dead, 1)[0:-2, 1:-1]
        | np.pad(dead, 1)[2:, 1:-1]
        | np.pad(dead, 1)[1:-1, 0:-2]
        | np.pad(dead, 1)[1:-1, 2:]
    )
    a[near & (a > 0)] = (a[near & (a > 0)] * 0.62).astype(np.uint8)
    arr[..., 3] = a
    out = Image.fromarray(arr, "RGBA")
    ch = list(out.split())
    ch[3] = ch[3].filter(ImageFilter.GaussianBlur(0.5))
    out = Image.merge("RGBA", ch)
    alpha = np.array(out.split()[-1])
    ys, xs = np.where(alpha > 12)
    if len(xs) == 0:
        raise SystemExit(f"empty key {src}")
    pad = 18
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(out.size[0], int(xs.max()) + pad)
    y1 = min(out.size[1], int(ys.max()) + pad)
    out = out.crop((x0, y0, x1, y1))
    out.save(dest)
    print("keyed", dest.name, out.size)


def main():
    crop_plate()
    key_prop(ASSETS / "prop-sit.png", ROOT / "prop-sit.png")
    key_prop(ASSETS / "prop-run.png", ROOT / "prop-run.png")


if __name__ == "__main__":
    main()
