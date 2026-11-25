// Encoding happens in the browser: WebCodecs (MP4) → MediaRecorder (WebM) → PNG zip.
import { Muxer } from "./mux-shim.js";

const MP4_TYPES = [
  'video/mp4;codecs="avc1.640028,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
];

export function encoderPlan() {
  const has = (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t);
  if (typeof window.VideoEncoder !== "undefined" && typeof window.AudioEncoder !== "undefined" && has(MP4_TYPES[0])) {
    return { kind: "mp4", label: "MP4 · H.264/AAC" };
  }
  if (has('video/webm;codecs="vp9,opus"')) return { kind: "webm", label: "WebM · VP9/Opus" };
  if (has('video/webm;codecs="vp8,opus"')) return { kind: "webm", label: "WebM · VP8/Opus" };
  return { kind: "none", label: "غير مدعوم" };
}

export async function decodeAudio(sources, totalSeconds, sampleRate = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);
  const loaded = [];
  for (const source of sources || []) {
    const res = await fetch(source.src);
    const buf = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    loaded.push({ buffer: decoded, at: (source.at || 0) / 1000, gain: source.gain ?? 1 });
  }
  if (!loaded.length) return null;
  for (const item of loaded) {
    const gain = ctx.createGain();
    gain.gain.value = item.gain;
    const node = ctx.createBufferSource();
    node.buffer = item.buffer;
    node.connect(gain).connect(ctx.destination);
    node.start(item.at);
  }
  return ctx.startRendering();
}

export async function record({ canvas, engine, ctx2d, fps, durationMs, audioBuffer, mime, onProgress, signal }) {
  const plan = encoderPlan();
  if (plan.kind === "mp4" || plan.kind === "webm") {
    try {
      return await encodeWithCodecs({ canvas, engine, ctx2d, fps, durationMs, audioBuffer, kind: plan.kind, onProgress, signal });
    } catch (error) {
      console.warn("codec encode failed, falling back", error);
    }
  }
  return recordRealtime({ canvas, engine, ctx2d, fps, durationMs, audioBuffer, onProgress, signal });
}

async function encodeWithCodecs({ canvas, engine, ctx2d, fps, durationMs, audioBuffer, kind, onProgress, signal }) {
  const muxer = await Muxer.create({ kind, canvas, fps, durationMs, audioBuffer, signal });
  const total = Math.max(1, Math.round((durationMs / 1000) * fps));
  for (let frame = 0; frame < total; frame++) {
    if (signal?.aborted) throw new Error("aborted");
    const timeMs = (frame / fps) * 1000;
    engine.renderFrame(ctx2d, timeMs);
    await muxer.addVideoFrame(timeMs / 1000, 1 / fps);
    if (frame % 6 === 0) onProgress?.(frame / total);
  }
  const blob = await muxer.finish();
  onProgress?.(1);
  return { blob, mime: kind === "mp4" ? "video/mp4" : "video/webm", ext: kind, measuredFps: fps };
}

function recordRealtime({ canvas, engine, ctx2d, fps, durationMs, audioBuffer, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const mime = MP4_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) && typeof window.VideoEncoder !== "undefined"
      ? MP4_TYPES[0]
      : MediaRecorder.isTypeSupported('video/webm;codecs="vp9,opus"')
        ? 'video/webm;codecs="vp9,opus"'
        : "video/webm";
    const stream = canvas.captureStream(fps);
    let audioCtx = null;
    let node = null;
    if (audioBuffer) {
      audioCtx = new AudioContext();
      node = audioCtx.createBufferSource();
      node.buffer = audioBuffer;
      const dest = audioCtx.createMediaStreamDestination();
      node.connect(dest);
      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
    }
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onerror = (event) => reject(event.error || new Error("recorder failed"));
    recorder.onstop = () => {
      audioCtx?.close();
      resolve({ blob: new Blob(chunks, { type: mime.split(";")[0] }), mime: mime.split(";")[0], ext: mime.includes("mp4") ? "mp4" : "webm", measuredFps: fps });
    };
    recorder.start(1000);
    node?.start();
    const started = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started;
      engine.renderFrame(ctx2d, Math.min(durationMs, elapsed));
      onProgress?.(Math.min(1, elapsed / durationMs));
      if (signal?.aborted) {
        recorder.stop();
        reject(new Error("aborted"));
        return;
      }
      if (elapsed >= durationMs) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function frameZip({ canvas, engine, ctx2d, fps, durationMs, onProgress, signal }) {
  const { zipSync } = await import("fflate");
  const files = {};
  const total = Math.max(1, Math.round((durationMs / 1000) * fps));
  for (let frame = 0; frame < total; frame++) {
    if (signal?.aborted) throw new Error("aborted");
    engine.renderFrame(ctx2d, (frame / fps) * 1000);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    files[`frame-${String(frame).padStart(5, "0")}.png`] = new Uint8Array(await blob.arrayBuffer());
    if (frame % 4 === 0) onProgress?.(frame / total);
  }
  const zipped = zipSync(files, { level: 0 });
  onProgress?.(1);
  return { blob: new Blob([zipped], { type: "application/zip" }), mime: "application/zip", ext: "zip", measuredFps: fps };
}

export async function still(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, mime: "image/png", ext: "png" };
}
