// Shared painting helpers: theme, gradients, grain, text with RTL support.
export const DEFAULTS = {
  bg: "#0B0B0C",
  fg: "#F5F1E8",
  muted: "#A3A3A3",
  accent: "#FF6A00",
  accent2: "#12B886",
  surface: "#151517",
};

export function themeOf(theme = {}) {
  return { ...DEFAULTS, ...theme };
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

let grainCache = null;
export function grainTile(size = 256) {
  if (grainCache) return grainCache;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainCache = c;
  return c;
}

export function paintBackground(ctx, theme, w, h, t, props = {}) {
  const th = themeOf(theme);
  ctx.fillStyle = props.flat ? th.bg : th.bg;
  ctx.fillRect(0, 0, w, h);

  const blobs = props.blobs ?? 2;
  if (blobs > 0) {
    const seconds = t / 1000;
    for (let i = 0; i < blobs; i++) {
      const cx = w * (0.5 + 0.32 * Math.sin(seconds * (0.11 + i * 0.07) + i * 2.1));
      const cy = h * (0.42 + 0.28 * Math.cos(seconds * (0.09 + i * 0.05) + i * 1.7));
      const r = Math.max(w, h) * (0.55 - i * 0.12);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const color = i % 2 ? th.accent2 : th.accent;
      g.addColorStop(0, hexAlpha(color, 0.22));
      g.addColorStop(1, hexAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  const grain = props.grain ?? 0.05;
  if (grain > 0) {
    const tile = grainTile();
    ctx.save();
    ctx.globalAlpha = grain;
    const offset = Math.floor((t / 40) % 256);
    const pattern = ctx.createPattern(tile, "repeat");
    ctx.translate(-offset, -offset);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w + 256, h + 256);
    ctx.restore();
  }
}

export function hexAlpha(hex, alpha) {
  const clean = String(hex || "#000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function vis(alpha) {
  return alpha <= 0.001 ? false : true;
}
