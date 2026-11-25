import { buildHtml } from "./html.js";
import { writeArtifact } from "./artifacts.js";

export const PRESETS = {
  reel: { size: "1080x1920" },
  story: { size: "1080x1920" },
  square: { size: "1080x1080" },
  landscape: { size: "1920x1080" },
  youtube: { size: "1920x1080" },
  portrait: { size: "1080x1350" },
  trailer: { size: "2560x1080" },
  doc: { size: "1240x1754" },
};

export function normalize(spec = {}) {
  const preset = PRESETS[spec.preset] || {};
  const size = spec.size || preset.size || "1080x1920";
  const [width, height] = String(size).split("x").map(Number);
  const fps = Number(spec.fps || 60);
  const scenes = (spec.scenes || []).map((scene, index) => ({
    at: Number(scene.at ?? scene.startMs ?? 0),
    durationMs: Number(scene.durationMs ?? (scene.seconds ? Number(scene.seconds) * 1000 : 2500)),
    block: scene.block || scene.type || "type.headline",
    props: scene.props || {},
    enterMs: scene.enterMs,
    exitMs: scene.exitMs,
    easing: scene.easing,
    key: scene.key ?? `scene-${index}`,
  }));
  const explicit = Number(spec.durationMs ?? (spec.seconds ? spec.seconds * 1000 : 0));
  const durationMs = explicit || Math.max(...scenes.map((s) => s.at + s.durationMs), 2000);
  return {
    name: spec.name || "studio-render",
    lang: spec.lang || "ar",
    rtl: spec.rtl !== false,
    size: `${width}x${height}`,
    width,
    height,
    fps,
    durationMs,
    fontFamily: spec.fontFamily || spec.font || "Alexandria",
    theme: spec.theme || {},
    audio: spec.audio || [],
    scenes,
  };
}

export function renderHtml(spec) {
  return buildHtml(normalize(spec));
}

export function renderToFile(spec, outPath) {
  const comp = normalize(spec);
  const html = buildHtml(comp);
  const file = writeArtifact(html, outPath || `${comp.name}.html`);
  return { file, comp };
}
