// Word-level layout. Arabic is shaped by the browser per run, so words are never
// split into letters — that would break the joins (ك ت ب instead of كتب).
export const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
export const isRtl = (text) => ARABIC.test(String(text || ""));
export const canSplitLetters = (text) => !isRtl(text);

export function fontSpec(weight, sizePx, family, tracking = 0) {
  return `${weight} ${Math.round(sizePx)}px "${family}"`;
}

export function layoutWords(ctx, text, { maxWidth, font, lineHeight, family, weight, sizePx }) {
  ctx.font = font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const space = ctx.measureText(" ").width;
  const lines = [];
  let current = [];
  let width = 0;

  for (const word of words) {
    const w = ctx.measureText(word).width;
    const next = current.length ? width + space + w : w;
    if (next > maxWidth && current.length) {
      lines.push({ words: current, width, space });
      current = [];
      width = 0;
    }
    width = current.length ? width + space + w : w;
    current.push({ text: word, width: w });
  }
  if (current.length) lines.push({ words: current, width, space });

  const totalHeight = lines.length * lineHeight;
  return { lines, space, lineHeight, totalHeight, sizePx, family, weight };
}

export function placeLine(ctx, line, { x, y, rtl, family, weight, sizePx, tracking = 0 }) {
  ctx.font = fontSpec(weight, sizePx, family, tracking);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking}px`;
  const boxes = [];
  if (rtl) {
    let cursor = x + line.width;
    for (const word of line.words) {
      boxes.push({ ...word, x: cursor - word.width, y });
      cursor -= word.width + line.space;
    }
  } else {
    let cursor = x;
    for (const word of line.words) {
      boxes.push({ ...word, x: cursor, y });
      cursor += word.width + line.space;
    }
  }
  return boxes;
}

export function alignX(align, w, innerWidth, gutter) {
  if (align === "start") return gutter;
  if (align === "end") return w - gutter - innerWidth;
  return (w - innerWidth) / 2;
}
