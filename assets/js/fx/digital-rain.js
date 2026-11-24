import { fit } from "../../vendor/pixelfx/core/index.js";

// Pixel code-rain: columns of glyphs falling with a bright head and a fading trail.
// Written for the Egytronic site against the vendored pixelfx core (/assets/vendor/pixelfx/core).

export const meta = {
  name: "Digital rain",
  desc: "Columns of code glyphs falling behind the contact panel: bright head, fading trail.",
  tags: ["code", "rain", "matrix", "digital", "ambient", "loop"],
  size: [320, 150],
  origin: [0, 0],
  duration: 1,
  loop: true,
  fps: 24,
  options: {
    palette: ["#05090c", "#06201c", "#0b3a31", "#10604f", "#1fa88b", "#58f0cf", "#e6fff8"],
    seed: 11,
  },
};

const PX = 10;
const PY = 7;
const COLS = Math.ceil(320 / PX);
const ROWS = Math.ceil(150 / PY);

// 4x5 glyphs, one bitmask per row.
const GLYPHS = [
  [0b1111, 0b1001, 0b1111, 0b1001, 0b1001],
  [0b1110, 0b1001, 0b1001, 0b1001, 0b1110],
  [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
  [0b1100, 0b0010, 0b0100, 0b1000, 0b1110],
  [0b1110, 0b0001, 0b0110, 0b0001, 0b1110],
  [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
  [0b1111, 0b1000, 0b1110, 0b0001, 0b1110],
  [0b0110, 0b1001, 0b1001, 0b1001, 0b0110],
];

const head = new Float32Array(COLS);
const speed = new Float32Array(COLS);
const trail = new Uint8Array(COLS);

const rand = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

const spawn = (c, salt) => {
  head[c] = -rand(c + salt, 131) * 8;
  speed[c] = 4 + rand(c + salt, 19) * 9;
  trail[c] = 5 + Math.floor(rand(c + salt, 41) * 7);
};

let seeded = 0;
function seedOnce(seedValue) {
  if (seeded === seedValue) return;
  seeded = seedValue;
  for (let c = 0; c < COLS; c++) {
    spawn(c, seedValue);
    head[c] -= rand(c + seedValue, 7) * ROWS * 2;
  }
}

export function update(dt, o) {
  seedOnce(o.seed ?? 11);
  const salt = Math.floor((o.seed ?? 11) + head[0] * 0.001);
  for (let c = 0; c < COLS; c++) {
    head[c] += speed[c] * dt;
    if (head[c] - trail[c] > ROWS) spawn(c, salt);
  }
}

export function draw(p, o) {
  seedOnce(o.seed ?? 11);
  const C = fit(o.palette ?? meta.options.palette, 7);
  for (let c = 0; c < COLS; c++) {
    const top = Math.floor(head[c]);
    for (let k = 0; k < trail[c]; k++) {
      const r = top - k;
      if (r < 0 || r >= ROWS) continue;

      let level = 2;
      if (k === 0) level = 6;
      else if (k === 1) level = 5;
      else if (k === 2) level = 4;
      else if (k < 5) level = 3;
      else if (rand(c * 17 + r * 23, 149) < 0.5) level = 1;
      const color = C[level];

      const g = GLYPHS[Math.floor(rand(c * 31 + r * 7, 97) * GLYPHS.length)];
      const x0 = c * PX + 1;
      const y0 = r * PY;
      for (let gy = 0; gy < 5; gy++) {
        const bits = g[gy];
        for (let gx = 0; gx < 4; gx++) {
          if ((bits >> (3 - gx)) & 1) p.px(x0 + gx, y0 + gy, color);
        }
      }
      if (k === 0) p.light(x0 + 1, y0 + 2, C[5], 0.55);
    }
  }
}
