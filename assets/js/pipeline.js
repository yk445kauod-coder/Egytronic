/**
 * The build-pipeline panel: four chips on a bus with data pulses running between them.
 * Drawn by hand at 320x220 and scaled up by CSS, so every edge stays on the pixel grid.
 */
const W = 320;
const H = 220;

export function mountPipeline(canvas) {
  const ctx = canvas.getContext("2d");
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

  canvas.width = W;
  canvas.height = H;

  const ink = "#161616";
  const panel = "#202020";
  const line = "#3d3d3d";
  const soft = "#262626";
  const gold = "#ff6a00";
  const goldHi = "#ffa45c";
  const mint = "#ff8a3d";
  const muted = "#c4c4c4";

  const chips = [
    { x: 26, label: 0 },
    { x: 100, label: 1 },
    { x: 174, label: 2 },
    { x: 248, label: 3 },
  ];
  const chipW = 46;
  const chipY = 86;
  const chipH = 48;

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function text(str, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = "12px monospace";
    ctx.fillText(str, x | 0, y | 0);
  }

  function chip(c, active, glow) {
    const x = c.x;
    px(x + 4, chipY, chipW, chipH, active ? gold : panel);
    px(x + 4, chipY, chipW, 2, active ? goldHi : line);
    px(x + 8, chipY + 8, chipW - 8, chipH - 12, ink);
    // pins
    for (let i = 0; i < 4; i++) {
      px(x + 10 + i * 10, chipY - 4, 4, 4, active ? gold : line);
      px(x + 10 + i * 10, chipY + chipH, 4, 4, active ? gold : line);
    }
    // core
    px(x + 17, chipY + 22, 12, 12, active ? (glow ? "#ffffff" : goldHi) : line);
    px(x + 21, chipY + 26, 4, 4, ink);
    // id plate
    text(String(c.label + 1), x + 32, chipY + 32, active ? ink : muted);
  }

  function bus(progress) {
    const y = chipY + chipH / 2;
    px(0, y, W, 2, soft);
    for (const c of chips) px(c.x + 4, y, chipW, 2, line);
    // the travelled portion
    px(0, y, W * progress, 2, "#8a3a00");
  }

  function pulse(t) {
    const y = chipY + chipH / 2 - 4;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.22 + i / 3) % 1;
      const x = 20 + p * (W - 48);
      const lead = i === 0 ? goldHi : gold;
      px(x, y, 6, 10, lead);
      px(x + 6, y + 2, 2, 6, "#8a3a00");
      px(x - 2, y + 2, 2, 6, mint);
    }
  }

  function sparks(t, activeIndex) {
    const c = chips[activeIndex];
    if (activeIndex < 0) return;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.8 + i * 0.33) % 1;
      const sx = c.x + 10 + i * 12;
      const sy = chipY - 6 - phase * 18;
      if (phase < 0.85) px(sx, sy, 2, 2, phase < 0.4 ? goldHi : "#8a3a00");
    }
  }

  let raf = 0;
  let running = false;
  let visible = true;
  let elapsed = 0.9;

  function draw() {
    px(0, 0, W, H, ink);
    // dotted measurement grid
    for (let x = 8; x < W; x += 16) {
      for (let y = 8; y < H; y += 16) px(x, y, 1, 1, "#242424");
    }
    // header rails
    px(0, 28, W, 2, soft);
    px(0, H - 34, W, 2, soft);

    const progress = Math.min(0.999, (elapsed * 0.16) % 1);
    bus(progress);
    pulse(elapsed);

    chips.forEach((c, i) => {
      const win = 0.16;
      const at = i / chips.length;
      const active = ((elapsed * 0.16) % 1) > at - 0.04 && ((elapsed * 0.16) % 1) < at + win;
      const glow = active && ((elapsed * 0.16) % 1) < at + 0.05;
      chip(c, active, glow);
      if (active) sparks(elapsed, i);
    });

    // output port
    const portOn = progress > 0.92;
    px(130, H - 26, 60, 12, portOn ? gold : panel);
    px(132, H - 24, 56, 8, portOn ? goldHi : ink);
    for (let i = 0; i < 6; i++) px(132 + i * 9.5, H - 20, 6, 2, portOn ? ink : line);
  }

  function tick(now) {
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    draw();
    if (running) raf = requestAnimationFrame(tick);
  }
  let last = 0;

  function start() {
    if (running || motionQuery.matches) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  draw();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      }
    },
    { rootMargin: "140px 0px" },
  );
  observer.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !visible) stop();
    else start();
  });

  return { start, stop };
}
