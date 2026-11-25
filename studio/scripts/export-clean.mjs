// Frame-accurate export: render every frame through the studio engine, then let ffmpeg assemble
// it. The browser encoder (VP9 via WebCodecs here) smears text on fast re-render; PNG frames do not.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { renderToFile } from "../lib/reel.js";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const specs = process.argv.slice(2);
const outDir = resolve("artifacts/reels");
const framesRoot = resolve("artifacts/frames");
mkdirSync(outDir, { recursive: true });
mkdirSync(framesRoot, { recursive: true });

const browser = await chromium.launch();
const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8").replace(/\n$/, "") || "[]");
const byName = new Map(manifest.map((m) => [m.name, m]));

for (const specPath of specs) {
  const spec = JSON.parse(readFileSync(resolve(specPath), "utf8"));
  const { file, comp } = renderToFile(spec, `${spec.name}.html`);
  const page = await browser.newPage({ viewport: { width: comp.width, height: comp.height } });
  await page.goto(pathToFileURL(file.path).href + "?bare=1");
  await page.waitForFunction(() => Boolean(window.__studio), { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  const total = Math.round((comp.durationMs / 1000) * comp.fps);
  const dir = join(framesRoot, spec.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const chunk = 24;
  for (let start = 0; start < total; start += chunk) {
    const frames = await page.evaluate(
      async ({ start, end, fps, w, h }) => {
        const { engine, canvas } = window.__studio;
        const off = new OffscreenCanvas(canvas.width, canvas.height);
        const ctx = off.getContext("2d", { alpha: false, willReadFrequently: true });
        const out = [];
        for (let frame = start; frame < end; frame++) {
          engine.renderFrame(ctx, (frame / fps) * 1000);
          const blob = await off.convertToBlob({ type: "image/png" });
          const buffer = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
          out.push(btoa(binary));
        }
        return out;
      },
      { start, end: Math.min(total, start + chunk), fps: comp.fps, w: comp.width, h: comp.height },
    );
    frames.forEach((base64, index) => {
      const n = String(start + index).padStart(5, "0");
      writeFileSync(join(dir, `${n}.png`), Buffer.from(base64, "base64"));
    });
  }
  await page.close();

  const mp4 = join(outDir, `${spec.name}.mp4`);
  const webm = join(outDir, `${spec.name}.webm`);
  const poster = join(outDir, `${spec.name}.jpg`);
  const input = ["-y", "-loglevel", "error", "-framerate", String(comp.fps), "-i", join(dir, "%05d.png")];
  execFileSync(ffmpeg.path, [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  execFileSync(ffmpeg.path, [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-pix_fmt", "yuv420p", webm]);
  execFileSync(ffmpeg.path, ["-y", "-loglevel", "error", "-i", mp4, "-vf", "select=eq(n\\,48)", "-frames:v", "1", "-q:v", "3", poster]);

  byName.set(spec.name, {
    name: spec.name,
    seconds: Number((comp.durationMs / 1000).toFixed(1)),
    size: `${comp.width}×${comp.height}`,
    fps: comp.fps,
    plan: "PNG frames → H.264",
    mp4: statSync(mp4).size,
    poster: statSync(poster).size,
    scenes: comp.scenes.length,
    frames: total,
    errors: [],
  });
  console.log(`${spec.name}: ${total} frames → mp4 ${(statSync(mp4).size / 1e6).toFixed(2)} MB, webm ${(statSync(webm).size / 1e6).toFixed(2)} MB`);
}
await browser.close();
writeFileSync(join(outDir, "manifest.json"), JSON.stringify([...byName.values()], null, 2));
