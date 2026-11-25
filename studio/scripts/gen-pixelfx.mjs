/* Renders the document artwork from the vendored PixelFx effects.

   No canvas, no browser: the effects paint into a Uint32 frame, composite() flattens it, and a
   small PNG writer stores the result. Deterministic — same seed, same bytes. */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFrame, clearFrame, createFx, composite } from "../vendor/pixelfx/core/index.js";
import * as aurora from "../vendor/pixelfx/fx/weather/aurora.js";
import * as campfire from "../vendor/pixelfx/fx/fire/campfire.js";
import * as crtOff from "../vendor/pixelfx/fx/transitions/crt-off.js";
import * as confetti from "../vendor/pixelfx/fx/ui/confetti.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/pixelfx");

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const byte of body) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function png(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y += 1) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * stride + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (value) => {
  const n = parseInt(value.replace("#", ""), 16);
  return (255 << 24) | (((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255));
};

/** Render one effect at `at` seconds on a `bg` colour. Steps are 1/30 s so the sim matches the gallery. */
function render(mod, { at = 0.6, bg = "#ffffff", seed = 7, options = {} } = {}) {
  const meta = { fps: 30, ...mod.meta };
  const [w, h] = meta.size;
  const fx = createFx(mod, { x: meta.origin?.[0] ?? w / 2, y: meta.origin?.[1] ?? h, seed, ...options });
  const frame = createFrame(w, h);
  const dt = 1 / (meta.fps || 30);
  const steps = Math.max(1, Math.round(at / dt));
  for (let i = 0; i < steps; i += 1) {
    clearFrame(frame);
    fx.update(dt);
    fx.draw(frame);
  }
  // Some effects draw in a back/front pass around a character; both passes are needed for a clean frame.
  if (mod.meta?.actor) {
    clearFrame(frame);
    fx.draw(frame, "back");
    fx.draw(frame, "front");
  }
  const out = new Uint8ClampedArray(w * h * 4);
  composite(frame, out, hex(bg), 1);
  return { w, h, buf: png(w, h, out) };
}

const ART = [
  { id: "aurora", mod: aurora, at: 2.4, bg: "#0b0d14", options: { seed: 11 } },
  { id: "campfire", mod: campfire, at: 1.2, bg: "#ffffff", options: { seed: 3 } },
  { id: "crt-off", mod: crtOff, at: 0.5, bg: "#111113", options: { seed: 5 } },
  { id: "confetti", mod: confetti, at: 1.1, bg: "#ffffff", options: { seed: 9 } },
];

await mkdir(OUT, { recursive: true });
const manifest = [];
for (const art of ART) {
  const { w, h, buf } = render(art.mod, art);
  const file = `${art.id}.png`;
  await writeFile(join(OUT, file), buf);
  manifest.push({
    id: art.id,
    file,
    effect: art.mod.meta.name,
    effectPath: art.mod.meta.name && art.id,
    size: [w, h],
    at: art.at,
    sha256: createHash("sha256").update(buf).digest("hex").slice(0, 16),
    bytes: buf.length,
    source: "patch-gg/pixelfx @ 5294518",
    license: "MIT (c) 2026 Patch, Hugo Duprez",
  });
  console.log(`art: ${file} ${w}x${h} ${(buf.length / 1024).toFixed(1)} KB`);
}
await writeFile(join(OUT, "manifest.json"), JSON.stringify({ generated: ART.length, art: manifest }, null, 2) + "\n");
console.log(`manifest: ${manifest.length} pieces → assets/pixelfx/manifest.json`);
