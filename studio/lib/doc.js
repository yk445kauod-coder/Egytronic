// Print documents: a document model → Paged.js HTML → the browser's print → PDF.
// The model borrows InDesign terms: page + margins + bleed, master pages (running
// head, folio), paragraph styles, frames with columns, cross-references (TOC).
import { readFileSync, existsSync } from "node:fs";
import { fontCss, resolveFamily, FALLBACK_STACK } from "./fonts.js";
import { writeArtifact } from "./artifacts.js";

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
  "a4-portrait": { size: "A4", margin: "20mm 18mm 22mm", bleed: 3, columns: 1 },
  "a5-portrait": { size: "A5", margin: "14mm 13mm 16mm", bleed: 3, columns: 1 },
  "a4-two-column": { size: "A4", margin: "18mm 14mm 20mm", bleed: 3, columns: 2 },
  letter: { size: "Letter", margin: "19mm 19mm 21mm", bleed: 3, columns: 1 },
};

const DEFAULT_STYLES = {
  body: { font: "{font}", size: "10.5pt", leading: "1.65", color: "#1A1A1A", align: "justify" },
  h1: { font: "{font}", size: "30pt", leading: "1.1", weight: 800, color: "#0B0B0C", margin: "0 0 6mm", space: "0 0 6mm" },
  h2: { font: "{font}", size: "17pt", leading: "1.25", weight: 700, color: "#0B0B0C", margin: "8mm 0 3mm" },
  h3: { font: "{font}", size: "12.5pt", leading: "1.3", weight: 700, color: "#0B0B0C", margin: "6mm 0 2mm" },
  lead: { font: "{font}", size: "13.5pt", leading: "1.55", weight: 500, color: "#333" },
  caption: { size: "8.5pt", leading: "1.45", color: "#6B6B6B" },
  quote: { font: "{font}", size: "15pt", leading: "1.5", weight: 500, color: "#FF6A00" },
  runhead: { size: "8pt", color: "#6B6B6B", tracking: "0.06em", transform: "uppercase" },
};

function cssDecl(style, { font }) {
  const decl = [];
  if (style.font) decl.push(`font-family: ${style.font.replace("{font}", `"${font}"`)}`);
  if (style.size) decl.push(`font-size: ${style.size}`);
  if (style.leading) decl.push(`line-height: ${style.leading}`);
  if (style.weight) decl.push(`font-weight: ${style.weight}`);
  if (style.color) decl.push(`color: ${style.color}`);
  if (style.align) decl.push(`text-align: ${style.align}`);
  if (style.tracking) decl.push(`letter-spacing: ${style.tracking}`);
  if (style.transform) decl.push(`text-transform: ${style.transform}`);
  if (style.margin) decl.push(`margin: ${style.margin}`);
  if (style.border) decl.push(`border-inline-start: ${style.border}`);
  if (style.padding) decl.push(`padding: ${style.padding}`);
  if (style.background) decl.push(`background: ${style.background}`);
  if (style.blockquote) decl.push("quotes: none");
  return decl.join(";");
}

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value) => esc(value).replace(/"/g, "&quot;");
const slug = (text, index) => `s-${index}-${String(text || "x").trim().slice(0, 18).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "x"}`;

function blockHtml(block, index, font) {
  const id = block.id || slug(block.text || block.title || "", index);
  const cls = block.style ? ` class="${escAttr(block.style)}"` : "";
  switch (block.type) {
    case "h1":
      return `<h1 id="${id}"${cls} data-num="${block.num ?? ""}">${esc(block.text)}</h1>`;
    case "h2":
      return `<h2 id="${id}"${cls}>${esc(block.text)}</h2>`;
    case "h3":
      return `<h3 id="${id}"${cls}>${esc(block.text)}</h3>`;
    case "p":
      return `<p id="${id}"${cls}>${block.html ? block.text : esc(block.text)}</p>`;
    case "lead":
      return `<p class="lead">${esc(block.text)}</p>`;
    case "columns": {
      const inner = (block.text || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
      return `<div class="columns" style="--cols:${block.count || 2};--gap:${block.gap || "8mm"}">${inner}</div>`;
    }
    case "quote":
      return `<blockquote>${esc(block.text)}${block.source ? `<cite>${esc(block.source)}</cite>` : ""}</blockquote>`;
    case "callout":
      return `<aside class="callout">${block.title ? `<strong>${esc(block.title)}</strong>` : ""}<p>${esc(block.text)}</p></aside>`;
    case "list":
      return `<${block.ordered ? "ol" : "ul"}>${(block.items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>`;
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
    case "break":
      return `<div class="page-break"></div>`;
    case "spacer":
      return `<div style="height:${esc(block.height || "10mm")}"></div>`;
    case "rule":
      return "<hr>";
    default:
      return `<p>${esc(block.text || "")}</p>`;
  }
}

export function buildDocHtml(doc = {}) {
  const preset = PAGE_PRESETS[doc.preset] || {};
  const pageName = doc.page || preset.size || "A4";
  const dims = PAGE_SIZES[pageName] || PAGE_SIZES.A4;
  const size = doc.pageSize || `${dims.w}mm ${dims.h}mm`;
  const margin = doc.margin || preset.margin || "20mm 18mm 22mm";
  const bleed = doc.bleed ?? preset.bleed ?? 0;
  const marks = doc.marks === true;
  const family = resolveFamily(doc.fontFamily || doc.font || (doc.lang === "en" ? "Inter" : "Alexandria"));
  const rtl = doc.rtl !== false && doc.lang !== "en";
  const styles = { ...DEFAULT_STYLES };
  for (const [name, overrides] of Object.entries(doc.styles || {})) {
    styles[name] = { ...(styles[name] || {}), ...overrides };
  }
  const styleCss = Object.entries(styles)
    .map(([name, style]) => {
      const target = name === "body" || name === "lead" || name === "caption" ? `p.${name}, .${name}` : name === "runhead" ? ".folio, .runhead" : name;
      const decl = cssDecl(style, { font: family.family });
      return decl ? `${target}{${decl}}` : "";
    })
    .join("\n");

  const content = doc.content || [];
  const tocEntries = content
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => ["h1", "h2"].includes(block.type))
    .map(({ block, index }) => ({ id: block.id || slug(block.text || "", index), text: block.text }));

  const html = content
    .map((block, index) => blockHtml(block.type === "toc" ? { ...block, entries: block.entries || tocEntries } : block, index, family.family))
    .join("\n");

  const header = doc.master?.header ?? doc.header ?? "";
  const footer = doc.master?.footer ?? doc.footer ?? "";
  const numbers = doc.master?.pageNumbers !== false;
  const paged = readFileSync(PAGED, "utf8");

  return `<!doctype html>
<html lang="${doc.lang || "ar"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name || "document")}</title>
<meta name="generator" content="egytronic-studio doc">
<style>${fontCss(family.family)}</style>
<style>
:root{--ink:#0B0B0C;--rule:#D8D4CC;--accent:#FF6A00}
*{box-sizing:border-box}
html,body{margin:0;background:#EDEAE4;color:var(--ink);font-family:${FALLBACK_STACK};font-feature-settings:"kern" 1,"liga" 1}
${styleCss}
h1{string-set:runhead content();break-after:avoid}
h2,h3{break-after:avoid}
p{margin:0 0 3.2mm;orphans:3;widows:3}
.columns{columns:var(--cols);column-gap:var(--gap);column-rule:1px solid var(--rule)}
blockquote{margin:6mm 0;padding-inline-start:5mm;border-inline-start:3px solid var(--accent)}
blockquote cite{display:block;margin-top:2mm;font-style:normal;font-size:9pt;color:#6B6B6B}
.callout{background:#F6F3EC;border:1px solid var(--rule);padding:5mm;margin:5mm 0;break-inside:avoid}
.callout p{margin:2mm 0 0}
figure{margin:6mm 0;break-inside:avoid}
figure img{width:100%;display:block;background:#DDD9D1}
figcaption{margin-top:2mm;font-size:8.5pt;color:#6B6B6B}
table{width:100%;border-collapse:collapse;margin:5mm 0;font-size:9pt;break-inside:avoid}
th,td{padding:2mm 2.5mm;border-bottom:1px solid var(--rule);text-align:start}
thead th{background:#F1EEE7;font-weight:700}
hr{border:0;border-top:1px solid var(--rule);margin:6mm 0}
.toc ul{list-style:none;padding:0;margin:4mm 0}
.toc li{margin:0 0 2mm;display:flex;gap:2mm}
.toc a{color:inherit;text-decoration:none;display:flex;flex:1;gap:2mm;align-items:baseline}
.toc a::after{content:"";flex:1;border-bottom:1px dotted #B9B4AA;transform:translateY(-1.2mm)}
.toc a::before{content:target-counter(attr(href), page);order:3;font-variant-numeric:tabular-nums;color:#6B6B6B}
.page-break{break-after:page}
.pagedjs_pages{display:flex!important;flex-direction:column!important;align-items:center!important;gap:8mm}
.pagedjs_page{margin-inline:auto!important}
img{max-width:100%}
@page{size:${size};margin:${margin};${bleed && marks ? `bleed:${bleed}mm;marks:crop cross;` : ""}
  ${header ? `@top-center{content:"${header.replace(/"/g, '\\"')}";font-size:8pt;color:#6B6B6B}` : ""}
  ${numbers ? "@bottom-center{content:counter(page) \" / \" counter(pages);font-size:8.5pt;color:#6B6B6B}" : ""}
}
@page:first{${numbers ? "@bottom-center{content:none}" : ""}}
.pagedjs_page{background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.12);margin:8mm auto}
.toolbar{position:fixed;inset-block-start:0;inset-inline:0;display:flex;gap:8px;justify-content:center;padding:10px;background:#0B0B0C;color:#F5F1E8;z-index:9;font-size:13px}
.toolbar button{font:600 13px ${FALLBACK_STACK};background:#FF6A00;border:0;color:#120A02;padding:8px 14px;border-radius:8px;cursor:pointer}
.toolbar span{opacity:.75;align-self:center}
@media print{
  html,body{background:#fff}
  .toolbar{display:none}
  .pagedjs_page{box-shadow:none;margin:0}
  @page{size:${size};margin:${margin}}
}
</style>
</head>
<body>
<div class="toolbar"><button type="button" onclick="window.print()">طباعة / PDF</button><span>${esc(doc.name || "")} · ${esc(pageName)} · ${esc(family.family)}</span></div>
<main class="document">
${html}
</main>
<script>${paged}</script>
</body>
</html>`;
}

export function buildDocToFile(doc, outPath) {
  const html = buildDocHtml(doc);
  const file = writeArtifact(html, outPath || `${doc.name || "document"}.html`);
  return { file, doc };
}
