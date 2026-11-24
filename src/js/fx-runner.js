import {
  createFrame,
  clearFrame,
  createFx,
  composite,
} from "../vendor/pixelfx/core/index.js";

const motionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const reduced = () => Boolean(motionQuery?.matches);

/**
 * Plays one pixelfx effect on a canvas at its native pixel size; CSS scales it up with
 * nearest-neighbour. Stops when the canvas leaves the viewport or the tab is hidden.
 */
export function mountFx(canvas, mod, options = {}) {
  const { speed = 1, paused = false, ...fxOptions } = options;
  const ctx = canvas.getContext("2d");
  const meta = mod.meta;
  const [w, h] = meta.size;
  const step = 1 / (meta.fps || 30);

  canvas.width = w;
  canvas.height = h;

  const frame = createFrame(w, h);
  const image = ctx.createImageData(w, h);
  const originX = meta.origin?.[0] ?? w / 2;
  const originY = meta.origin?.[1] ?? h / 2;

  let inst = null;
  let acc = 0;
  let hold = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  let visible = true;

  function build() {
    inst = createFx(mod, { x: originX, y: originY, ...fxOptions });
    acc = 0;
    hold = 0;
  }

  function render() {
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
    composite(frame, image.data, null);
    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(image, 0, 0);
  }

  function tick(now) {
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1) * speed;
    last = now;
    acc += dt;

    while (acc >= step) {
      acc -= step;
      if (!meta.loop && inst.t >= (meta.duration ?? 1)) {
        hold += step;
        if (hold > 1.1) build();
      } else {
        inst.update(step);
      }
    }

    render();

    if (running) raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduced()) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function play() {
    build();
    render();
    if (reduced()) return;
    stop();
    start();
  }

  build();
  render();

  if (reduced()) {
    return { play, restart: play, start() {}, stop() {} };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      }
    },
    { rootMargin: "160px 0px" },
  );
  observer.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !visible) stop();
    else start();
  });

  if (!paused) start();

  return { play, restart: play, start, stop };
}

export { reduced };
