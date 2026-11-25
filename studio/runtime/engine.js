// Deterministic timeline: every frame is a pure function of time, never of the wall clock.
export const EASE = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const ease = (name, t) => (EASE[name] || EASE.outCubic)(clamp01(t));

export function createEngine(comp, blocks, theme) {
  const scenes = (comp.scenes || []).map((scene, index) => {
    const block = blocks[scene.block];
    if (!block) throw new Error(`unknown block: ${scene.block}`);
    const props = { ...block.props, ...(scene.props || {}) };
    return { ...scene, index, block, props, at: scene.at || 0, durationMs: scene.durationMs || 2000 };
  });

  const durationMs = comp.durationMs || Math.max(...scenes.map((s) => s.at + s.durationMs), 0);
  const fps = comp.fps || 60;
  const [w, h] = (comp.size || "1080x1920").split("x").map(Number);

  function renderFrame(ctx, timeMs) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const bg = blocks["bg.gradient"];
    if (bg) bg.draw(ctx, { t: timeMs, lt: 0, in: 1, out: 0, props: {}, theme, w, h, comp, timeMs });
    for (const scene of scenes) {
      const local = timeMs - scene.at;
      if (local < 0 || local > scene.durationMs) continue;
      const lt = clamp01(local / scene.durationMs);
      const enterMs = Math.min(scene.enterMs ?? 700, scene.durationMs);
      const exitMs = Math.min(scene.exitMs ?? 450, scene.durationMs);
      const env = {
        t: local,
        lt,
        in: ease(scene.easing || "outExpo", clamp01(local / enterMs)),
        out: ease("inOutCubic", clamp01((local - (scene.durationMs - exitMs)) / exitMs)),
        props: scene.props,
        theme,
        w,
        h,
        comp,
        timeMs,
        audio: comp.audio || [],
        durationMs: scene.durationMs,
      };
      ctx.save();
      scene.block.draw(ctx, env);
      ctx.restore();
    }
    ctx.restore();
  }

  return { w, h, fps, durationMs, theme, scenes, renderFrame };
}
