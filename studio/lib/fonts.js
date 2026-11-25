import { readFileSync } from "node:fs";

const DIR = new URL("../assets/fonts/", import.meta.url);
export const MANIFEST = JSON.parse(readFileSync(new URL("fonts.json", DIR), "utf8"));

export const DEFAULT_FAMILY = "Alexandria";
export const FALLBACK_STACK = '"Alexandria", "Cairo", "Noto Naskh Arabic", system-ui, sans-serif';

export function listFonts() {
  return MANIFEST.map((entry) => ({
    family: entry.family,
    slug: entry.slug,
    role: entry.role,
    weights: [...new Set(entry.files.map((f) => f.weight))].sort((a, b) => a - b),
  }));
}

export function resolveFamily(name) {
  if (!name) return MANIFEST.find((entry) => entry.family === DEFAULT_FAMILY);
  const needle = String(name).trim().toLowerCase();
  return (
    MANIFEST.find((entry) => entry.family.toLowerCase() === needle) ||
    MANIFEST.find((entry) => entry.slug === needle.replace(/\s+/g, "")) ||
    MANIFEST.find((entry) => entry.family.toLowerCase().includes(needle) || entry.slug.includes(needle)) ||
    MANIFEST.find((entry) => entry.family === DEFAULT_FAMILY)
  );
}

const cache = new Map();

export function fontCss(familyName) {
  const entry = resolveFamily(familyName);
  if (cache.has(entry.slug)) return cache.get(entry.slug);
  const rules = entry.files.map((face) => {
    const base64 = readFileSync(new URL(face.file, DIR)).toString("base64");
    return `@font-face{font-family:"${entry.family}";font-style:normal;font-weight:${face.weight};font-display:block;src:url(data:font/woff2;base64,${base64}) format("woff2");${
      face.unicodeRange ? `unicode-range:${face.unicodeRange};` : ""
    }}`;
  });
  const css = rules.join("\n");
  cache.set(entry.slug, css);
  return css;
}

export function fontBytes(familyName) {
  const entry = resolveFamily(familyName);
  return entry.files.reduce((sum, face) => sum + readFileSync(new URL(face.file, DIR)).length, 0);
}
