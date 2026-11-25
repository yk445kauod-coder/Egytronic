import { createEngine } from "./engine.js";
import { BLOCKS } from "./blocks.js";
import { themeOf } from "./canvas.js";
import * as exporter from "./export.js";

const params = new URLSearchParams(location.search);
const bare = params.get("bare") === "1";
const comp = JSON.parse(document.getElementById("studio-data").textContent);
const width = Number(comp.width || comp.size?.split("x")[0] || 1080);
const height = Number(comp.height || comp.size?.split("x")[1] || 1920);
const engine = createEngine(comp, BLOCKS, themeOf(comp.theme));

const canvas = document.getElementById("stage");
canvas.width = width;
canvas.height = height;
const ctx2d = canvas.getContext("2d", { alpha: false });

let timeMs = Number(params.get("frame") || 0);
let playing = false;
let raf = 0;
let startedAt = 0;
let recording = null;

function fit() {
  const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
  canvas.style.width = `${Math.round(width * scale)}px`;
  canvas.style.height = `${Math.round(height * scale)}px`;
}

function paint() {
  engine.renderFrame(ctx2d, Math.min(timeMs, engine.durationMs));
  if (scrub) scrub.value = String(Math.round((timeMs / engine.durationMs) * 1000));
  if (clock) clock.textContent = `${(timeMs / 1000).toFixed(2)} / ${(engine.durationMs / 1000).toFixed(2)}s`;
}

function play() {
  if (playing) return;
  if (timeMs >= engine.durationMs) timeMs = 0;
  playing = true;
  startedAt = performance.now() - timeMs;
  cancelAnimationFrame(raf);
  const step = () => {
    timeMs = performance.now() - startedAt;
    paint();
    if (timeMs >= engine.durationMs) {
      playing = false;
      timeMs = engine.durationMs;
      paint();
      return;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  setState("يعرض");
}

function pause() {
  playing = false;
  cancelAnimationFrame(raf);
  setState("متوقف");
}

function seek(ms) {
  pause();
  timeMs = Math.max(0, Math.min(engine.durationMs, Number(ms) || 0));
  paint();
}

function download(result, name) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.${result.ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return result.blob.size;
}

async function exportVideo() {
  if (recording) return;
  const controller = new AbortController();
  recording = controller;
  setBusy(true, "بجهّز الصوت…");
  try {
    const audioBuffer = await exporter.decodeAudio(comp.audio, engine.durationMs / 1000);
    setBusy(true, "جاري الترميز…");
    const result = await exporter.record({
      canvas,
      engine,
      ctx2d,
      fps: engine.fps,
      durationMs: engine.durationMs,
      audioBuffer,
      signal: controller.signal,
      onProgress: (p) => setProgress(p),
    });
    const size = download(result, comp.name || "studio-render");
    setBusy(false, `تم · ${result.ext.toUpperCase()} · ${(size / 1e6).toFixed(1)}MB · ${engine.w}×${engine.h}@${engine.fps}`);
  } catch (error) {
    console.error(error);
    setBusy(false, `فشل الترميز: ${error.message}`);
  } finally {
    recording = null;
  }
}

async function exportStill() {
  const result = await exporter.still(canvas);
  download(result, `${comp.name || "studio"}-${Math.round(timeMs)}ms`);
  setBusy(false, `لقطة PNG · ${(result.blob.size / 1e3).toFixed(0)}KB`);
}

let scrub, clock, stateChip, statusBar, recordBtn;

function setState(text) {
  if (stateChip) stateChip.textContent = text;
}

function setBusy(busy, text) {
  if (statusBar) statusBar.textContent = text;
  if (recordBtn) recordBtn.disabled = busy;
  document.body.dataset.busy = busy ? "1" : "";
}

function setProgress(p) {
  if (statusBar) statusBar.textContent = `جاري الترميز… ${Math.round(p * 100)}%`;
}

function buildOverlay() {
  const plan = exporter.encoderPlan();
  const bar = document.createElement("div");
  bar.className = "studio-bar";
  bar.innerHTML = `
    <div class="studio-bar__row">
      <button class="studio-btn studio-btn--primary" data-act="play" type="button">تشغيل</button>
      <button class="studio-btn" data-act="record" type="button">تسجيل الفيديو</button>
      <button class="studio-btn" data-act="still" type="button">لقطة</button>
      <button class="studio-btn" data-act="frames" type="button">إطارات ZIP</button>
      <span class="studio-state" data-state>متوقف</span>
      <span class="studio-clock" data-clock>0.00 / 0.00s</span>
      <span class="studio-plan">${plan.label}</span>
    </div>
    <input class="studio-scrub" type="range" min="0" max="1000" value="0" aria-label="شريط التقدم">
    <div class="studio-status" data-status>${comp.name || "render"} · ${engine.w}×${engine.h} · ${engine.fps}fps · ${(engine.durationMs / 1000).toFixed(1)}s</div>`;
  document.body.appendChild(bar);
  scrub = bar.querySelector("[data-action-scrub], .studio-scrub");
  clock = bar.querySelector("[data-clock]");
  stateChip = bar.querySelector("[data-state]");
  statusBar = bar.querySelector("[data-status]");
  recordBtn = bar.querySelector('[data-act="record"]');

  bar.addEventListener("click", async (event) => {
    const act = event.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "play") (playing ? pause() : play());
    if (act === "record") await exportVideo();
    if (act === "still") await exportStill();
    if (act === "frames") {
      setBusy(true, "بجمع الإطارات…");
      try {
        const result = await exporter.frameZip({ canvas, engine, ctx2d, fps: engine.fps, durationMs: engine.durationMs, onProgress: setProgress });
        const size = download(result, `${comp.name || "studio"}-frames`);
        setBusy(false, `تم · ZIP · ${(size / 1e6).toFixed(1)}MB`);
      } catch (error) {
        setBusy(false, `فشل: ${error.message}`);
      }
    }
  });

  scrub.addEventListener("input", () => seek((Number(scrub.value) / 1000) * engine.durationMs));

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") { event.preventDefault(); playing ? pause() : play(); }
    if (event.key === "r" || event.key === "R") exportVideo();
    if (event.key === "s" || event.key === "S") exportStill();
    if (event.key === "ArrowRight") seek(timeMs + 1000 / engine.fps);
    if (event.key === "ArrowLeft") seek(timeMs - 1000 / engine.fps);
    if (event.key === "Home") seek(0);
  });
}

async function boot() {
  await document.fonts.ready;
  fit();
  window.addEventListener("resize", fit);
  paint();
  if (!bare) buildOverlay();

  // Compatibility with playbooks that drive a render through `window.seek(seconds)`.
  window.seek = (seconds) => seek(Number(seconds) * 1000);
  window.duration = engine.durationMs / 1000;
  window.__studio = {
    engine,
    canvas,
    ctx2d,
    seek,
    play,
    pause,
    plan: exporter.encoderPlan(),
    async recordNow() { await exportVideo(); },
    async stillNow() { await exportStill(); },
  };

  if (params.has("record")) {
    setTimeout(() => exportVideo(), 250);
  }
  if (params.has("still")) {
    setTimeout(() => exportStill(), 400);
  }
}

boot();
