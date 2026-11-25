// Caption writers: SRT, VTT, ASS. Times are seconds unless values look like ms.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ARTIFACT_DIR } from "./artifacts.js";

const toSeconds = (value, unitHint) => {
  const n = Number(value) || 0;
  return unitHint === "ms" ? n / 1000 : n > 1000 ? n / 1000 : n;
};

const stamp = (seconds, sep = ",") => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

const assStamp = (seconds) => {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360_000);
  const m = String(Math.floor((cs % 360_000) / 6000)).padStart(2, "0");
  const s = String(Math.floor((cs % 6000) / 100)).padStart(2, "0");
  return `${h}:${m}:${s}.${String(cs % 100).padStart(2, "0")}`;
};

export function groupLines(words, { maxChars = 42, maxGap = 0.6 } = {}) {
  const lines = [];
  let current = { words: [], start: null, end: null, chars: 0 };
  for (const word of words) {
    const start = toSeconds(word.start, word.unit);
    const end = toSeconds(word.end ?? word.start, word.unit);
    const text = String(word.text || "").trim();
    if (!text) continue;
    if (current.words.length && (current.chars + text.length > maxChars || start - current.end > maxGap)) {
      lines.push(current);
      current = { words: [], start: null, end: null, chars: 0 };
    }
    if (current.start === null) current.start = start;
    current.words.push({ text, start, end });
    current.end = end;
    current.chars += text.length + 1;
  }
  if (current.words.length) lines.push(current);
  return lines.map((line) => ({ start: line.start, end: line.end, text: line.words.map((w) => w.text).join(" ") }));
}

export function srt(lines) {
  return lines.map((line, i) => `${i + 1}\n${stamp(line.start)} --> ${stamp(line.end)}\n${line.text}\n`).join("\n");
}

export function vtt(lines) {
  return `WEBVTT\n\n${lines.map((line) => `${stamp(line.start, ".")} --> ${stamp(line.end, ".")}\n${line.text}\n`).join("\n")}`;
}

export function ass(lines, { font = "Alexandria", size = 64, primary = "&H00E8F1F5", highlight = "&H00006AFF" } = {}) {
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Studio,${font},${size},${primary},&H00000000,&H64000000,1,1,3,0,2,180

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
  const body = lines.map((line) => `Dialogue: 0,${assStamp(line.start)},${assStamp(line.end)},Studio,,0,0,0,,{\\c${highlight}}${line.text.replace(/\n/g, "\\N")}`);
  return `${head}\n${body.join("\n")}\n`;
}

export function writeCaptions(words, outBase = "captions") {
  const lines = Array.isArray(words) && words[0]?.start !== undefined && words[0]?.end === undefined ? [] : groupLines(words);
  const base = outBase.replace(/\.(srt|vtt|ass)$/i, "");
  const target = base.startsWith("/") ? base : join(ARTIFACT_DIR, base);
  mkdirSync(dirname(target), { recursive: true });
  const files = { srt: `${target}.srt`, vtt: `${target}.vtt`, ass: `${target}.ass` };
  writeFileSync(files.srt, srt(lines), "utf8");
  writeFileSync(files.vtt, vtt(lines), "utf8");
  writeFileSync(files.ass, ass(lines), "utf8");
  return { files, lines: lines.length, words: words.length };
}

export function karaokeWords(words, offsetMs = 0) {
  return words.map((word) => ({
    text: word.text,
    start: Math.round(toSeconds(word.start, word.unit) * 1000 + offsetMs),
    end: Math.round(toSeconds(word.end ?? word.start, word.unit) * 1000 + offsetMs),
  }));
}
