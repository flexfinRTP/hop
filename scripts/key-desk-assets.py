"""One-shot: punch studio backdrops to alpha. Run from this folder."""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "desk"


def lum(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sat(rgb):
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    return np.where(mx == 0, 0, (mx - mn) / np.maximum(mx, 1))


def is_backdrop(rgb, mode: str) -> np.ndarray:
    r, g, b = rgb[..., 0].astype(np.float32), rgb[..., 1].astype(np.float32), rgb[..., 2].astype(np.float32)
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    s = sat(rgb.astype(np.float32))
    black = y < 28
    white = (y > 232) & (s < 0.14)
    warm = (r > g) & (g > b) & ((r - b) > 38) & (y < 178) & (s > 0.22)
    if mode == "black":
        return black
    if mode == "white":
        return white
    if mode == "auto":
        return black | white | warm
    raise ValueError(mode)


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


def key_file(path: Path, mode: str) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb, a = arr[..., :3], arr[..., 3]
    kill = flood(is_backdrop(rgb, mode))
    a = a.copy()
    a[kill] = 0
    # Feather: pixels next to punched holes
    dead = a == 0
    near = (
        np.pad(dead, 1)[0:-2, 1:-1]
        | np.pad(dead, 1)[2:, 1:-1]
        | np.pad(dead, 1)[1:-1, 0:-2]
        | np.pad(dead, 1)[1:-1, 2:]
    )
    a[near & (a > 0)] = (a[near & (a > 0)] * 0.55).astype(np.uint8)
    arr[..., 3] = a
    out = Image.fromarray(arr, "RGBA")
    r, g, b, alpha = out.split()
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    return Image.merge("RGBA", (r, g, b, alpha))


def rain_alpha(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    y = lum(arr[..., :3])
    a = np.clip(y * 1.55, 0, 255).astype(np.uint8)
    arr = arr.astype(np.uint8)
    arr[..., 3] = a
    return Image.fromarray(arr, "RGBA")


def wheel_disc(im: Image.Image) -> Image.Image:
    arr = np.array(im)
    a = arr[..., 3]
    ys, xs = np.where(a > 24)
    if len(xs) == 0:
        return im
    left, right = int(xs.min()), int(xs.max())
    top = int(ys.min())
    d = right - left
    cx = (left + right) / 2
    cy = top + d / 2
    radius = d / 2 * 0.99
    yy, xx = np.ogrid[: arr.shape[0], : arr.shape[1]]
    circle = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius ** 2
    arr[..., 3] = np.where(circle, arr[..., 3], 0)
    # crop to circle bbox
    pad = 4
    x0 = max(0, int(cx - radius) - pad)
    y0 = max(0, int(cy - radius) - pad)
    x1 = min(arr.shape[1], int(cx + radius) + pad)
    y1 = min(arr.shape[0], int(cy + radius) + pad)
    return Image.fromarray(arr[y0:y1, x0:x1], "RGBA")


def main():
    jobs = [
        ("bunny-sit.png", "black"),
        ("bunny-sit-cut.png", "black"),
        ("bunny-run.png", "auto"),
        ("bunny-run-cut.png", "auto"),
        ("wheel.png", "auto"),
        ("wheel-cut.png", "white"),
        ("wheel-spin.png", "black"),
    ]
    for name, mode in jobs:
        src = ROOT / name
        out = key_file(src, mode)
        out.save(src)
        print("keyed", name, out.size)

    rain = rain_alpha(ROOT / "rain-glass.png")
    rain.save(ROOT / "rain-glass.png")
    print("rain-glass alpha", rain.size)

    disc = wheel_disc(key_file(ROOT / "wheel-cut.png", "white"))
    disc.save(ROOT / "wheel-disc.png")
    print("wheel-disc", disc.size)


if __name__ == "__main__":
    main()
