// Verify an exported reel really decodes: serve it over http (the way a page will load it) and
// let Chromium play it, then sample what pixels the decoder produced.
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const path = resolve(process.argv[2]);
// Playwright's Chromium has no H.264 decoder, so the MP4 is validated by a full ffmpeg decode
// and the browser pass runs on the VP9 sibling (same frames, same timing).
const mp4Check = path.endsWith(".mp4");
const webm = path.replace(/\.mp4$/, ".webm");
const playable = mp4Check && existsSync(webm) ? webm : path;
if (mp4Check) {
  execFileSync(ffmpeg.path, ["-v", "error", "-i", path, "-f", "null", "-"], { stdio: "pipe" });
}
const body = readFileSync(playable);
const mime = playable.endsWith(".mp4") ? "video/mp4" : "video/webm";

const server = createServer((request, response) => {
  if (request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<video id="v" muted playsinline></video>');
    return;
  }
  response.writeHead(200, { "content-type": mime, "content-length": body.length });
  response.end(body);
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
const info = await page.evaluate(async () => {
  const video = document.getElementById("v");
  const loaded = new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror = () => rej(new Error("decode error: " + (video.error?.message || video.error?.code)));
  });
  video.src = "/v";
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  const samples = [];
  for (const t of [0.4, 1.2, 2.2, 3.2]) {
    await new Promise((res) => { video.onseeked = res; video.currentTime = Math.min(t, video.duration - 0.05); });
    ctx.drawImage(video, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0, bright = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
      sum += l;
      if (l > 150) bright += 1;
    }
    samples.push({ t, meanLuma: Math.round(sum / (px.length / 4)), bright });
  }
  return { file: navigator.userAgent.length ? null : null, duration: video.duration, w: video.videoWidth, h: video.videoHeight, samples };
});
await browser.close();
server.close();
console.log(JSON.stringify({ ...info, mp4Decode: mp4Check ? "clean" : "skipped", browserSource: playable.split("/").pop() }, null, 1));
