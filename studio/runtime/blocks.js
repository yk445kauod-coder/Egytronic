import { paintBackground, roundRect, themeOf, hexAlpha, vis } from "./canvas.js";
import { layoutWords, placeLine, alignX, fontSpec, isRtl, canSplitLetters } from "./text.js";

const P = (x, y, w, h, t) => ({
  x, y, w, h, t,
  set(v) { x += v; y += v ? 0 : 0; return this; },
});

export const bgGradient = {
  id: "bg.gradient",
  label: "خلفية متحركة",
  props: { flat: false, blobs: 2, grain: 0.05 },
  draw(ctx, env) {
    paintBackground(ctx, env.theme, env.w, env.h, env.timeMs, env.props);
  },
};

export const typeHeadline = {
  id: "type.headline",
  label: "عنوان حركي (Kinetic)",
  props: {
    text: "",
    size: 0.085,
    weight: 800,
    color: null,
    align: "center",
    mode: "words",
    staggerMs: 55,
    easing: "outExpo",
    rise: 0.05,
    blur: 14,
    tracking: 0,
    maxWidth: 0.84,
    lineHeight: 1.35,
    accentWords: [],
    y: 0.5,
  },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const family = env.comp.fontFamily || "Alexandria";
    const sizePx = props.size * Math.min(w, h);
    const maxWidth = props.maxWidth * w;
    const lineHeight = sizePx * props.lineHeight;
    const font = fontSpec(props.weight, sizePx, family, props.tracking);
    const laid = layoutWords(ctx, props.text, { maxWidth, font, lineHeight, family, weight: props.weight, sizePx });
    const rtl = isRtl(props.text);
    const top = h * props.y - laid.totalHeight / 2;
    const alpha = (1 - env.out) * Math.min(1, env.in * 1.35);
    if (!vis(alpha)) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = "top";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "left";
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${props.tracking}px`;

    let wordIndex = 0;
    laid.lines.forEach((line, lineIndex) => {
      const x = alignX(props.align, w, line.width, (w - maxWidth) / 2);
      const boxes = placeLine(ctx, line, { x, y: top + lineIndex * lineHeight, rtl, family, weight: props.weight, sizePx, tracking: props.tracking });
      for (const box of boxes) {
        const progress = env.comp.reduce ? 1 : Math.min(1, Math.max(0, (env.t - wordIndex * props.staggerMs) / (props.easing === "outElastic" ? 900 : 620)));
        const eased = (env.comp.easingTable ? env.comp.easingTable : null) || null;
        const p = progress;
        const offset = (1 - p) * props.rise * h;
        const blur = (1 - p) * props.blur;
        const accent = props.accentWords.includes(box.text);
        ctx.save();
        ctx.globalAlpha = alpha * Math.min(1, p * 1.6);
        if (blur > 0.2 && ctx.filter !== undefined) ctx.filter = `blur(${blur.toFixed(2)}px)`;
        ctx.fillStyle = accent ? th.accent : props.color || th.fg;
        ctx.font = fontSpec(props.weight, sizePx, family, props.tracking);
        ctx.fillText(box.text, box.x, box.y + offset);
        ctx.restore();
        wordIndex += 1;
      }
    });
    ctx.restore();
  },
};

export const typeStack = {
  id: "type.stack",
  label: "سطرين: كبير + صغير",
  props: { big: "", small: "", size: 0.1, weight: 800, smallSize: 0.035, color: null, smallColor: null, align: "center", gap: 0.06, y: 0.5 },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const family = env.comp.fontFamily || "Alexandria";
    const alpha = (1 - env.out) * env.in;
    if (!vis(alpha)) return;
    const sizePx = props.size * Math.min(w, h);
    const smallPx = props.smallSize * Math.min(w, h);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = "middle";
    ctx.direction = isRtl(props.big) ? "rtl" : "ltr";
    ctx.fillStyle = props.color || th.fg;
    ctx.font = fontSpec(props.weight, sizePx, family, 0);
    ctx.fillText(props.big, w / 2, h * props.y - (smallPx + h * props.gap) / 2);
    ctx.fillStyle = props.smallColor || th.muted;
    ctx.font = fontSpec(500, smallPx, family, 0);
    ctx.fillText(props.small, w / 2, h * props.y + (sizePx + h * props.gap) / 2 - smallPx * 0.3);
    ctx.restore();
  },
};

export const captionsKaraoke = {
  id: "captions.karaoke",
  label: "كابشن كاريوكي",
  props: {
    words: [],
    size: 0.05,
    weight: 800,
    highlight: null,
    textColor: null,
    preset: "pill",
    maxChars: 22,
    y: 0.76,
    maxWidth: 0.86,
  },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const words = props.words || [];
    if (!words.length) return;
    const family = env.comp.fontFamily || "Alexandria";
    const rtl = isRtl(words.map((x) => x.text).join(" "));
    const sizePx = props.size * Math.min(w, h);
    const lineHeight = sizePx * 1.5;
    const maxWidth = props.maxWidth * w;
    const font = fontSpec(props.weight, sizePx, family, 0);

    // group words into screens by character budget
    const screens = [];
    let screen = [];
    let chars = 0;
    for (const word of words) {
      if (chars + word.text.length > props.maxChars && screen.length) {
        screens.push(screen);
        screen = [];
        chars = 0;
      }
      screen.push(word);
      chars += word.text.length + 1;
    }
    if (screen.length) screens.push(screen);

    const active = screens.find((rows) => env.t >= rows[0].start && env.t <= rows[rows.length - 1].end) || null;
    if (!active) return;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "left";
    ctx.font = font;
    const textWidth = active.reduce((sum, x, i) => sum + ctx.measureText(x.text).width + (i ? ctx.measureText(" ").width : 0), 0);
    const x0 = alignX("center", w, textWidth, 0);
    const cy = h * props.y;

    if (props.preset === "pill") {
      const padX = sizePx * 0.7;
      const padY = sizePx * 0.42;
      ctx.globalAlpha = (1 - env.out) * env.in;
      ctx.fillStyle = hexAlpha("#000000", 0.62);
      roundRect(ctx, x0 - padX, cy - lineHeight / 2 - padY * 0.2, textWidth + padX * 2, lineHeight + padY * 0.4, sizePx * 0.4);
      ctx.fill();
    }

    let cursor = rtl ? x0 + textWidth : x0;
    active.forEach((word) => {
      const width = ctx.measureText(word.text).width;
      const px = rtl ? cursor - width : cursor;
      const live = env.t >= word.start && env.t <= word.end;
      ctx.fillStyle = live ? props.highlight || th.accent : props.textColor || th.fg;
      ctx.globalAlpha = (1 - env.out) * env.in;
      ctx.fillText(word.text, px, cy);
      if (props.preset === "underline" && live) {
        ctx.fillRect(px, cy + sizePx * 0.7, width, Math.max(2, sizePx * 0.09));
      }
      cursor += rtl ? -(width + ctx.measureText(" ").width) : width + ctx.measureText(" ").width;
    });
    ctx.restore();
  },
};

const lengthCache = new Map();
function pathLength(d) {
  if (lengthCache.has(d)) return lengthCache.get(d);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const length = path.getTotalLength();
  document.body.removeChild(svg);
  lengthCache.set(d, length);
  return length;
}

export const logoReveal = {
  id: "logo.reveal",
  label: "لوجو متحرك (رسم المسار)",
  props: { paths: [], width: 0.5, color: null, strokeMs: 900, fillDelayMs: 350, shine: true, glow: false, y: 0.5, unit: 100 },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    if (!props.paths?.length) return;
    const boxW = props.width * w;
    const scale = boxW / props.unit;
    const color = props.color || th.accent;
    const alpha = (1 - env.out) * Math.min(1, env.in * 1.2);
    if (!vis(alpha)) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h * props.y);
    ctx.scale(scale, scale);
    ctx.translate(-props.unit / 2, -(props.unit * 0.35));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.2, 3 / scale);
    if (props.glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 / scale;
    }

    const total = Math.max(...props.paths.map((p) => pathLength(p.d)), 1);
    props.paths.forEach((entry, index) => {
      const length = pathLength(entry.d);
      const draw = Math.min(1, Math.max(0, (env.t - index * 90) / props.strokeMs));
      const path = new Path2D(entry.d);
      if (draw < 1) {
        ctx.save();
        ctx.setLineDash([length, length + 4]);
        ctx.lineDashOffset = length * (1 - draw);
        ctx.strokeStyle = color;
        ctx.stroke(path);
        ctx.restore();
      }
      if (draw >= 1) {
        ctx.fillStyle = entry.fill || color;
        ctx.fill(path);
      }
    });
    ctx.restore();
  },
};

export const quoteCard = {
  id: "quote.card",
  label: "اقتباس",
  props: { text: "", author: "", size: 0.045, y: 0.5, maxWidth: 0.8 },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const family = env.comp.fontFamily || "Alexandria";
    const sizePx = props.size * Math.min(w, h);
    const rtl = isRtl(props.text);
    const font = fontSpec(600, sizePx, family, 0);
    const laid = layoutWords(ctx, `“${props.text}”`, { maxWidth: props.maxWidth * w, font, lineHeight: sizePx * 1.6, family, weight: 600, sizePx });
    const top = h * props.y - laid.totalHeight / 2;
    ctx.save();
    ctx.globalAlpha = (1 - env.out) * env.in;
    ctx.textBaseline = "top";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = th.fg;
    laid.lines.forEach((line, i) => {
      const x = alignX("center", w, line.width, 0);
      for (const box of placeLine(ctx, line, { x, y: top + i * sizePx * 1.6, rtl, family, weight: 600, sizePx })) {
        ctx.fillText(box.text, box.x, box.y);
      }
    });
    if (props.author) {
      ctx.fillStyle = th.muted;
      ctx.font = fontSpec(500, sizePx * 0.5, family, 0);
      ctx.fillText(`— ${props.author}`, w / 2, top + laid.totalHeight + sizePx * 0.5);
    }
    ctx.restore();
  },
};

export const lowerThird = {
  id: "lowerThird",
  label: "شريط سفلي",
  props: { name: "", role: "", y: 0.82, accentBar: true },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const family = env.comp.fontFamily || "Alexandria";
    const slide = env.in;
    const alpha = (1 - env.out) * Math.min(1, env.in * 1.4);
    if (!vis(alpha)) return;
    const namePx = 0.038 * Math.min(w, h);
    const rolePx = 0.021 * Math.min(w, h);
    const padX = namePx * 0.9;
    const boxW = Math.max(namePx * 6, ctx.measureText(props.name).width + padX * 4);
    const boxH = namePx * 2.5;
    const x = (w - boxW) / 2 + (1 - slide) * -w * 0.06;
    const y = h * props.y;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hexAlpha("#000000", 0.66);
    roundRect(ctx, x, y, boxW, boxH, boxH * 0.22);
    ctx.fill();
    if (props.accentBar) {
      ctx.fillStyle = th.accent;
      roundRect(ctx, x, y, Math.max(4, boxW * 0.012), boxH, boxH * 0.2);
      ctx.fill();
    }
    ctx.textBaseline = "middle";
    ctx.direction = isRtl(props.name) ? "rtl" : "ltr";
    ctx.fillStyle = th.fg;
    ctx.font = fontSpec(700, namePx, family, 0);
    ctx.fillText(props.name, x + padX * 1.6, y + boxH * 0.38);
    ctx.fillStyle = th.muted;
    ctx.font = fontSpec(500, rolePx, family, 0);
    ctx.fillText(props.role, x + padX * 1.6, y + boxH * 0.74);
    ctx.restore();
  },
};

export const statBlock = {
  id: "stat",
  label: "رقم كبير",
  props: { value: "", label: "", size: 0.16, y: 0.48, color: null },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h } = env;
    const family = env.comp.fontFamily || "Alexandria";
    const sizePx = props.size * Math.min(w, h);
    const alpha = (1 - env.out) * env.in;
    if (!vis(alpha)) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = props.color || th.accent;
    ctx.font = fontSpec(900, sizePx, family, 0);
    ctx.fillText(props.value, w / 2, h * props.y);
    ctx.fillStyle = th.fg;
    ctx.font = fontSpec(600, sizePx * 0.2, family, 0);
    ctx.fillText(props.label, w / 2, h * props.y + sizePx * 0.72);
    ctx.restore();
  },
};

export const progressBar = {
  id: "progress.bar",
  label: "شريط تقدم",
  props: { color: null, height: 0.008, y: 0.985 },
  draw(ctx, env) {
    const th = themeOf(env.theme);
    const { props, w, h, comp, timeMs } = env;
    const total = comp.durationMs || 1;
    const p = Math.min(1, Math.max(0, timeMs / total));
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = hexAlpha("#ffffff", 0.08);
    ctx.fillRect(0, h * props.y, w, h * props.height);
    ctx.fillStyle = props.color || th.accent;
    ctx.fillRect(0, h * props.y, w * p, h * props.height);
    ctx.restore();
  },
};

export const BLOCKS = {
  "bg.gradient": bgGradient,
  "type.headline": typeHeadline,
  "type.stack": typeStack,
  "captions.karaoke": captionsKaraoke,
  "logo.reveal": logoReveal,
  "quote.card": quoteCard,
  lowerThird,
  stat: statBlock,
  "progress.bar": progressBar,
};
