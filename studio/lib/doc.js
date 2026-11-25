// Print documents: a content model + an editable template → one HTML file.
// Paged.js lays the pages out; the browser prints them with window.print().
// Structure lives in templates/doc/base.css, looks in templates/doc/<name>.css.
import { readFileSync, readdirSync } from "node:fs";
import { fontCss, resolveFamily } from "./fonts.js";
import { writeArtifact } from "./artifacts.js";

const TEMPLATES = new URL("../templates/doc/", import.meta.url);
const PAGED = new URL("../node_modules/pagedjs/dist/paged.polyfill.min.js", import.meta.url);

export const PAGE_SIZES = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A3: { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
  Tabloid: { w: 279.4, h: 431.8 },
};

export const PAGE_PRESETS = {
  "a4-portrait": { size: "A4", margin: "20mm 18mm 22mm", bleed: 3 },
  "a5-portrait": { size: "A5", margin: "14mm 13mm 16mm", bleed: 3 },
  "a4-two-column": { size: "A4", margin: "18mm 14mm 20mm", bleed: 3 },
  letter: { size: "Letter", margin: "19mm 19mm 21mm", bleed: 3 },
};

export const DEFAULT_TEMPLATE = "editorial";

export function listTemplates() {
  return readdirSync(TEMPLATES)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const id = name.replace(/\.json$/, "");
      const meta = JSON.parse(readFileSync(new URL(name, TEMPLATES), "utf8"));
      return { id, label: meta.label || id, fontFamily: meta.fontFamily, preset: meta.preset };
    });
}

function loadTemplate(name) {
  const id = String(name || DEFAULT_TEMPLATE).replace(/\.(json|css)$/, "");
  const read = (file, fallback = "") => {
    try { return readFileSync(new URL(file, TEMPLATES), "utf8"); } catch { return fallback; }
  };
  const meta = JSON.parse(read(`${id}.json`, "{}"));
  if (!meta.fontFamily && id !== DEFAULT_TEMPLATE) throw new Error(`unknown template: ${id} (have ${listTemplates().map((t) => t.id).join(", ")})`);
  return { id, meta, css: read(`${id}.css`) };
}

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value) => esc(value).replace(/"/g, "&quot;");
const slug = (text, index) =>
  `s-${index}-${String(text || "x").trim().slice(0, 18).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "x"}`;

function cssDecl(style) {
  const map = {
    size: "font-size", leading: "line-height", weight: "font-weight", color: "color", align: "text-align",
    tracking: "letter-spacing", transform: "text-transform", margin: "margin", width: "max-width",
    indent: "text-indent", border: "border-inline-start", padding: "padding", background: "background",
  };
  return Object.entries(style)
    .filter(([key, value]) => map[key] && value !== undefined && value !== null)
    .map(([key, value]) => `${map[key]}:${value}`)
    .join(";");
}

function blockHtml(block, index) {
  const id = block.id || slug(block.text || block.title || "", index);
  const cls = block.style ? ` class="${escAttr(block.style)}"` : "";
  switch (block.type) {
    case "h1": return `<h1 id="${id}"${cls}>${esc(block.text)}</h1>`;
    case "h2": return `<h2 id="${id}"${cls}>${esc(block.text)}</h2>`;
    case "h3": return `<h3 id="${id}"${cls}>${esc(block.text)}</h3>`;
    case "p": return `<p id="${id}"${cls}>${block.html ? block.text : esc(block.text)}</p>`;
    case "lead": return `<p class="lead">${esc(block.text)}</p>`;
    case "columns":
      return `<div class="columns" style="--cols:${block.count || 2};--gap:${block.gap || "8mm"}">${(block.text || [])
        .map((paragraph) => `<p>${esc(paragraph)}</p>`)
        .join("")}</div>`;
    case "quote": return `<blockquote>${esc(block.text)}${block.source ? `<cite>${esc(block.source)}</cite>` : ""}</blockquote>`;
    case "callout": return `<aside class="callout">${block.title ? `<strong>${esc(block.title)}</strong>` : ""}<p>${esc(block.text)}</p></aside>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${(block.items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</${tag}>`;
    }
    case "figure":
      return `<figure>${block.src ? `<img src="${escAttr(block.src)}" alt="${escAttr(block.alt || block.caption || "")}" style="object-fit:${block.fit || "cover"};aspect-ratio:${block.ratio || "16/9"}">` : ""}${
        block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""
      }</figure>`;
    case "table": {
      const head = block.head ? `<thead><tr>${block.head.map((cell) => `<th>${esc(cell)}</th>`).join("")}</tr></thead>` : "";
      const body = (block.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
      return `<table>${head}<tbody>${body}</tbody></table>${block.caption ? `<p class="caption">${esc(block.caption)}</p>` : ""}`;
    }
    case "toc": {
      const entries = (block.entries || []).map((entry) => `<li><a href="#${escAttr(entry.id)}">${esc(entry.text)}</a></li>`).join("");
      return `<nav class="toc"><h2>${esc(block.title || "المحتويات")}</h2><ul>${entries}</ul></nav>`;
    }
    case "break": return `<div class="page-break"></div>`;
    case "spacer": return `<div style="height:${esc(block.height || "10mm")}"></div>`;
    case "rule": return "<hr>";
    default: return `<p>${esc(block.text || "")}</p>`;
  }
}

export function buildDocHtml(doc = {}) {
  const template = loadTemplate(doc.template);
  const meta = template.meta;
  const preset = PAGE_PRESETS[doc.preset || meta.preset] || {};
  const pageName = doc.page || meta.page || preset.size || "A4";
  const dims = PAGE_SIZES[pageName] || PAGE_SIZES.A4;
  const pageSize = doc.pageSize || `${dims.w}mm ${dims.h}mm`;
  const margin = doc.margin || meta.margin || preset.margin || "20mm 18mm 22mm";
  const family = resolveFamily(doc.fontFamily || doc.font || meta.fontFamily);
  const rtl = doc.rtl !== false && doc.lang !== "en";

  const styles = { ...(meta.styles || {}) };
  for (const [name, overrides] of Object.entries(doc.styles || {})) {
    styles[name] = { ...(styles[name] || {}), ...overrides };
  }
  const styleOverrides = Object.entries(styles)
    .map(([name, style]) => {
      const decl = cssDecl(style);
      if (!decl) return "";
      const target = ["body", "lead", "caption"].includes(name) ? `p.${name}, .${name}` : name;
      return `${target}{${decl}}`;
    })
    .filter(Boolean)
    .join("\n");

  const content = doc.content || [];
  const tocEntries = content
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => ["h1", "h2"].includes(block.type))
    .map(({ block, index }) => ({ id: block.id || slug(block.text || "", index), text: block.text }));

  const html = content
    .map((block, index) => blockHtml(block.type === "toc" ? { ...block, entries: block.entries || tocEntries } : block, index))
    .join("\n");

  const header = doc.master?.header ?? doc.header ?? meta.header ?? "";
  const numbers = doc.master?.pageNumbers !== false;
  const furniture = [
    header ? `@top-center{content:"${String(header).replace(/"/g, '\\"')}"}` : "",
    numbers ? `@bottom-center{content:counter(page) " / " counter(pages)}` : "",
  ].filter(Boolean).join("\n  ");

  const css = (readFileSync(new URL("base.css", TEMPLATES), "utf8") + "\n" + template.css)
    .replaceAll("{{font}}", family.family)
    .replaceAll("{{pageSize}}", pageSize)
    .replaceAll("{{pageWidth}}", `${dims.w + 24}mm`)
    .replaceAll("{{margin}}", margin)
    .replaceAll("{{pageFurniture}}", furniture);

  return `<!doctype html>
<html lang="${doc.lang || "ar"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name || "document")}</title>
<meta name="generator" content="egytronic-studio doc">
<meta name="studio-template" content="${escAttr(template.id)}">
<style>${fontCss(family.family)}</style>
<style>${css}
/* document-level overrides */
${styleOverrides}
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" onclick="window.print()">طباعة / PDF</button>
  <span>${esc(doc.name || "")} · ${esc(template.meta.label || template.id)} · ${esc(pageName)} · ${esc(family.family)}</span>
</div>
<main class="document">
${html}
</main>
<script>${readFileSync(PAGED, "utf8")}</script>
<script>
/* Paged.js has laid the sheets out by now; window.print() is the only export. */
document.addEventListener("afterprint", () => {});
</script>
</body>
</html>`;
}

export function buildDocToFile(doc, outPath) {
  const html = buildDocHtml(doc);
  const file = writeArtifact(html, outPath || `${doc.name || "document"}.html`);
  return { file, doc };
}
