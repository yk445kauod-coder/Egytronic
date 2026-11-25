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

// Named colour themes: tokens map onto the CSS custom properties in base.css.
export const DOC_THEMES = {
  egytronic: {
    label: "Egytronic — برتقالي على أبيض",
    use: "الافتراضي: ملفات الشركة والعروض.",
    tokens: { accent: "#FF6A00", ink: "#0B0B0C", muted: "#6B6B6B", rule: "#D8D4CC", paper: "#FFFFFF", screen: "#EDEAE4", callout: "#F6F3EC" },
  },
  press: {
    label: "Press — أسود وحبر",
    use: "تقارير ودراسات؛ لا لون غير الحبر.",
    tokens: { accent: "#111111", ink: "#111111", muted: "#5A5A5A", rule: "#D5D5D5", paper: "#FFFFFF", screen: "#F0F0F0", callout: "#F5F5F4" },
  },
  desert: {
    label: "Desert — طيني ورملي",
    use: "عروض ومقترحات دافئة.",
    tokens: { accent: "#B4532A", ink: "#2A211C", muted: "#7A6A5F", rule: "#E0D3C6", paper: "#FDF9F3", screen: "#F1E9DE", callout: "#F7EFE4" },
  },
  sea: {
    label: "Sea — أزرق هادئ",
    use: "ملفات تقنية وأبحاث.",
    tokens: { accent: "#0F6E8C", ink: "#0C1C22", muted: "#516A73", rule: "#CBDCE1", paper: "#FFFFFF", screen: "#EAF1F3", callout: "#F0F6F8" },
  },
  ink: {
    label: "Ink — ليلي",
    use: "نسخة شاشة، أو ملف يُقرأ في الإضاءة المنخفضة.",
    tokens: { accent: "#FFB454", ink: "#F4EFE7", muted: "#A7A29A", rule: "#2E2E32", paper: "#111113", screen: "#0A0A0B", callout: "#1A1A1D" },
  },
};

export const DOC_BLOCKS = [
  { type: "cover", fields: "kicker, title, subtitle, meta[]", note: "صفحة غلاف تنتهي بفاصل صفحات وبخط برتقالي." },
  { type: "h1", fields: "text", note: "عنوان رئيسي؛ يُدرج تلقائيًا في فهرس المحتويات." },
  { type: "h2", fields: "text", note: "عنوان قسم؛ يُدرج تلقائيًا في الفهرس." },
  { type: "h3", fields: "text" },
  { type: "p", fields: "text, html?", note: "html:true يمرّر الوسم كما هو." },
  { type: "lead", fields: "text", note: "فقرة تمهيدية أكبر." },
  { type: "columns", fields: "text[], count?, gap?", note: "أعمدة نصية بارتفاع متوازن." },
  { type: "quote", fields: "text, source?" },
  { type: "callout", fields: "title?, text", note: "صندوق ملاحظة بحدود وخلفية خفيفة." },
  { type: "list", fields: "items[], ordered?" },
  { type: "figure", fields: "src, alt?, caption?, fit?, ratio?" },
  { type: "table", fields: "head[], rows[][], caption?" },
  { type: "toc", fields: "title?", note: "فهرس بأرقام صفحات حقيقية عبر Paged.js." },
  { type: "break", note: "فاصل صفحات يدوي." },
  { type: "spacer", fields: "height?" },
  { type: "rule", note: "خط فاصل." },
];

// Theme tokens are interpolated into CSS, so only shapes we can validate get through.
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;
const LEN = /^[0-9.]+(pt|px|mm|cm|em|rem|%)$/;
const TOKEN_VARS = {
  accent: "--accent", ink: "--ink", muted: "--muted", rule: "--rule",
  paper: "--paper", screen: "--screen", callout: "--callout",
  bodySize: "--body-size", h1Size: "--h1-size",
};

function themeCss(theme) {
  const tokens = typeof theme === "string" ? DOC_THEMES[theme]?.tokens : theme;
  if (!tokens || typeof tokens !== "object") return "";
  const decls = Object.entries(tokens)
    .filter(([key, value]) => TOKEN_VARS[key] && (typeof value === "string" && (COLOR.test(value) || LEN.test(value))))
    .map(([key, value]) => `${TOKEN_VARS[key]}:${value}`);
  return decls.length ? `:root{${decls.join(";")}}` : "";
}

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
    case "cover":
      return `<section class="cover">${
        block.kicker ? `<p class="cover__kicker">${esc(block.kicker)}</p>` : ""
      }<h1>${esc(block.title)}</h1>${
        block.subtitle ? `<p class="cover__sub">${esc(block.subtitle)}</p>` : ""
      }${
        (block.meta || []).length ? `<ul class="cover__meta">${block.meta.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""
      }</section><div class="page-break"></div>`;
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
  // Paged.js resolves `size` by NAME (pageSizes table); raw dimensions are ignored and it
  // falls back to Letter. Always hand it the keyword, custom sizes only reach the printer.
  const pageSize = doc.pageSize || (PAGE_SIZES[pageName] ? pageName : `${dims.w}mm ${dims.h}mm`);
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

  // The cover closes its own page; a break directly after it would open a blank sheet.
  const flow = content.filter((block, index) => !(block.type === "break" && content[index - 1]?.type === "cover"));
  const html = flow
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

  const output = `<!doctype html>
<html lang="${doc.lang || "ar"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name || "document")}</title>
<meta name="generator" content="egytronic-studio doc">
<meta name="studio-template" content="${escAttr(template.id)}">
<style>${fontCss(family.family)}</style>
<style>${css}
/* theme */
${themeCss(doc.theme)}
/* document-level overrides */
${styleOverrides}
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" onclick="window.studioDoc.print()">طباعة / PDF</button>
  <span>${esc(doc.name || "")} · ${esc(template.meta.label || template.id)} · ${esc(pageName)} · ${esc(family.family)}</span>
</div>
<main class="document">
${html}
</main>
<script>
/* One pagination only: the polyfill auto-runs, so we hook its "after" instead of calling
   preview() a second time (a second pass re-chunks the flow and the page counter resets to 0). */
window.PagedConfig = { auto: true, after: function () { if (window.__studioDocSettle) window.__studioDocSettle(); } };
</script>
<script>${readFileSync(PAGED, "utf8")}</script>
<script>
/* Print contract: wait for pagination, then append the page rule LAST so Paged.js's own
   print sheet (which forces .pagedjs_page to height:100%) cannot win. window.print() only. */
(function () {
  var PRINT_CSS =
    "@page{size:{{pageSize}};margin:0}" +
    "@media print{" +
      "html,body{background:#fff!important;display:block!important;min-height:0!important}" +
      ".toolbar{display:none!important}" +
      /* height:auto matters: the screen rule pins the stack to the viewport height, so in print the
     three sheets overflow that box and Chrome spills two extra pages. */".pagedjs_pages{display:block!important;gap:0!important;padding:0!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}" +
      /* A hair under the page box: a sheet that measures exactly A4 can round past the paper and
     Chrome spills a blank page after it. */".pagedjs_page{width:var(--pagedjs-pagebox-width)!important;height:calc(var(--pagedjs-pagebox-height) - 1px)!important;min-height:0!important;max-height:none!important;margin:0!important;box-shadow:none!important;break-after:page;page-break-after:always}" +
      ".pagedjs_page:last-child{break-after:auto!important;page-break-after:auto!important}" +
      /* The inner sheet is a millimetre taller than the trimmed page and spills a sliver, which
         is a blank page per sheet. Make the stack fill the page exactly. */
      ".pagedjs_sheet,.pagedjs_pagebox{height:100%!important;width:100%!important;min-height:0!important;max-height:100%!important}" +
      ".pagedjs_page{overflow:hidden!important}" +
      "*{-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "}";
  var ready = false;
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });
  /* TOC folios: target-counter() is uneven across browsers and silently yields 0 here, so the
     page number of every anchor is written onto the link after pagination. */
  function folios() {
    var pageOf = Object.create(null);
    var pages = document.querySelectorAll(".pagedjs_page");
    for (var i = 0; i < pages.length; i += 1) {
      var ids = pages[i].querySelectorAll("[id]");
      for (var j = 0; j < ids.length; j += 1) if (!pageOf[ids[j].id]) pageOf[ids[j].id] = i + 1;
    }
    var links = document.querySelectorAll(".toc a[href^='#']");
    for (var k = 0; k < links.length; k += 1) {
      var page = pageOf[links[k].getAttribute("href").slice(1)];
      if (page) links[k].setAttribute("data-page", String(page));
    }
  }
  window.__studioDocSettle = function () {
    if (ready) return;
    ready = true;
    folios();
    var sheet = document.createElement("style");
    sheet.setAttribute("data-studio", "print");
    sheet.textContent = PRINT_CSS;
    document.head.appendChild(sheet);
    document.documentElement.setAttribute("data-ready", "1");
    resolveReady();
  };
  window.studioDoc = {
    print: function () { return readyPromise.then(function () { window.print(); }); },
    isReady: function () { return ready; },
    whenReady: function () { return readyPromise; }
  };
  document.addEventListener("beforeprint", function () { if (!ready) window.__studioDocSettle(); });
  if (document.readyState === "complete") window.__studioDocSettle();
})();
</script>
</body>
</html>`;
  return output
    .replaceAll("{{pageSize}}", pageSize)
    .replaceAll("{{margin}}", margin)
    .replaceAll("{{pageWidth}}", `${dims.w + 24}mm`)
    .replaceAll("{{font}}", family.family);
}

export function buildDocToFile(doc, outPath) {
  const html = buildDocHtml(doc);
  const file = writeArtifact(html, outPath || `${doc.name || "document"}.html`);
  return { file, doc };
}
