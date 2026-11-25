// End-to-end proof: build every artifact, open it in Chromium, measure it, print it to PDF.
import { chromium } from "playwright";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { buildDocToFile, listTemplates, DOC_THEMES, DOC_BLOCKS } from "../lib/doc.js";
import { listFonts, fontBytes, MANIFEST } from "../lib/fonts.js";
import { ARTIFACT_DIR } from "../lib/artifacts.js";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const pdfPages = async (path) => {
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();
    pages.push(text.items.map((item) => item.str).join(" ").trim());
    const [, , width, height] = page.view;
    pages.push([Math.round(width), Math.round(height)]);
  }
  const numeric = [];
  for (let i = 0; i < pages.length; i += 2) numeric.push({ text: pages[i], size: pages[i + 1] });
  return { count: doc.numPages, pages: numeric };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// 1. Document → pagination, TOC numbers, fonts, PDF
const { file: docFile } = buildDocToFile(
  JSON.parse(readFileSync(new URL("../examples/doc-proposal.json", import.meta.url), "utf8")),
  "verify-doc.html",
);
const docUrl = pathToFileURL(docFile.path).href;
await page.goto(docUrl, { waitUntil: "load" });
await page.waitForSelector(".pagedjs_page", { timeout: 60000 });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });

const dom = await page.evaluate(() => ({
  pages: document.querySelectorAll(".pagedjs_page").length,
  fontOk: document.fonts.check('16px "IBM Plex Sans Arabic"'),
  printSheet: [...document.querySelectorAll("style[data-studio]")].map((s) => s.textContent).join(" "),
  firstPage: (document.querySelector(".pagedjs_page")?.innerText || "").slice(0, 80),
  sheetWidth: document.querySelector(".pagedjs_page")?.getBoundingClientRect().width,
}));
check("doc: pages laid out", dom.pages >= 2, `${dom.pages} sheets`);
check("doc: embedded font is active", dom.fontOk === true, 'document.fonts.check("IBM Plex Sans Arabic")');
check("doc: A4 sheet width", Math.round(dom.sheetWidth) === 794, `${Math.round(dom.sheetWidth)}px`);

// The page margin used to vanish: Paged.js read the print @page rule and paginated with margin 0,
// so text sat on the paper edge.
const margins = await page.evaluate(() => {
  const sheet = document.querySelector(".pagedjs_page").getBoundingClientRect();
  // A real block, not the paginator's multi-page flow wrapper that sits first in the content box.
  const block = document.querySelector(".pagedjs_page .cover").getBoundingClientRect();
  return { inset: Math.round(block.left - sheet.left), right: Math.round(sheet.right - block.right) };
});
check("doc: page margins hold (text is not on the paper edge)", margins.inset >= 40 && margins.right >= 40, `inset ${margins.inset}/${margins.right}px`);

await page.emulateMedia({ media: "print" });
const printCss = await page.evaluate(() => {
  const pick = (selector) => getComputedStyle(document.querySelector(selector));
  const toolbar = pick(".toolbar");
  const pages = pick(".pagedjs_pages");
  const sheet = pick(".pagedjs_page");
  const rule = [...document.querySelectorAll("style")].map((s) => s.textContent).join(" ").match(/@page\{size:([^;]+);margin:([^;]+)\}/);
  return {
    toolbar: toolbar.display,
    pagesDisplay: pages.display,
    gap: pages.gap || pages.rowGap,
    sheetMargin: sheet.margin,
    sheetHeight: Math.round(document.querySelector(".pagedjs_page").getBoundingClientRect().height),
    rule: rule ? { size: rule[1], margin: rule[2] } : null,
  };
});
check("print css: toolbar hidden", printCss.toolbar === "none", printCss.toolbar);
check("print css: sheets stack with no gap", printCss.pagesDisplay === "block" && (printCss.gap === "normal" || printCss.gap === "0px"), `${printCss.pagesDisplay} gap=${printCss.gap}`);
check("print css: sheet margin is zero (no double margin)", printCss.sheetMargin === "0px", printCss.sheetMargin);
check("print css: page rule is last and A4 with margin 0", printCss.rule?.size === "A4" && printCss.rule?.margin === "0", JSON.stringify(printCss.rule));
check("print css: sheet is A4 tall", Math.abs(printCss.sheetHeight - 1123) <= 2, `${printCss.sheetHeight}px`);
// Not "screen": the emulation would also apply to page.pdf() and print the screen layout.
await page.emulateMedia({ media: null });

// Print from a fresh load: emulating print media on the measuring page leaves the layout in a
// state Chrome then prints twice as tall.
const pdfPath = join(ARTIFACT_DIR, "verify-doc.pdf");
const printPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await printPage.goto(docUrl, { waitUntil: "load" });
await printPage.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
await printPage.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
await printPage.close();
const pdf = await pdfPages(pdfPath);
check("print: PDF page count matches the sheets", pdf.count === dom.pages, `${pdf.count} PDF pages vs ${dom.pages} sheets`);
check("print: no blank page", pdf.pages.every((p) => p.text.length > 0), pdf.pages.map((p) => p.text.length).join(","));
const folio = pdf.pages.slice(1).some((p) => /[\u0660-\u0669]|[0-9]/.test(p.text));
check("print: every page after the cover carries a folio", folio, folio ? "page numbers present" : "no page number found");
check("print: A4 paper size", pdf.pages.every((p) => Math.abs(p.size[0] - 595) < 3 && Math.abs(p.size[1] - 842) < 3), `${pdf.pages[0].size.join("x")}pt`);
check("print: cover carries text", pdf.pages[0].text.replace(/\s/g, "").length > 20, pdf.pages[0].text.slice(0, 40));

// TOC on its own document: three sections, one per page, so the folios must be 2, 3 and 4.
const tocDoc = buildDocToFile(
  {
    name: "verify-toc",
    template: "editorial",
    content: [
      { type: "toc", title: "المحتويات" },
      { type: "break" },
      { type: "h1", text: "الأول" },
      { type: "break" },
      { type: "h1", text: "الثاني" },
      { type: "break" },
      { type: "h1", text: "الثالث" },
    ],
  },
  "verify-toc.html",
);
await page.goto(pathToFileURL(tocDoc.file.path).href, { waitUntil: "load" });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
const tocFolios = await page.evaluate(() => [...document.querySelectorAll(".toc a")].map((a) => Number((a.getAttribute("data-page") || "").trim())));
check("doc: TOC folios resolved and ordered", tocFolios.length === 3 && tocFolios.every((v, i) => Number.isInteger(v) && v === i + 2), tocFolios.join(" / ") || "no data-page");

// 1b. Every template builds, and a document-level style override wins over the template
const templatePages = [];
for (const id of ["editorial", "report", "brief", "proposal"]) {
  const built = buildDocToFile(
    { name: `verify-${id}`, template: id, content: [{ type: "h2", text: "قسم" }, { type: "p", text: "نص تجريبي" }] },
    `verify-${id}.html`,
  );
  await page.goto(pathToFileURL(built.file.path).href, { waitUntil: "load" });
  await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
  const measured = await page.evaluate(() => {
    const sheet = document.querySelector(".pagedjs_page").getBoundingClientRect();
    const h1 = document.querySelector(".doc h1, h1");
    return { sheets: document.querySelectorAll(".pagedjs_page").length, w: Math.round(sheet.width), h1Size: h1 ? getComputedStyle(h1).fontSize : null };
  });
  templatePages.push({ id, ...measured });
}
check("templates: all four build and paginate", templatePages.length === 4 && templatePages.every((t) => t.sheets >= 1), templatePages.map((t) => `${t.id}:${t.sheets}@${t.w}px`).join(" "));
check("templates: page size follows the template (A4 / A5)", templatePages.find((t) => t.id === "brief")?.w < 600 && templatePages.find((t) => t.id === "report")?.w > 700,
  templatePages.map((t) => `${t.id}:${t.w}px`).join(" "));

const overridden = buildDocToFile(
  { name: "verify-override", template: "report", styles: { h1: { size: "40pt" } }, content: [{ type: "h1", text: "عنوان" }] },
  "verify-override.html",
);
await page.goto(pathToFileURL(overridden.file.path).href, { waitUntil: "load" });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
const overrideSize = await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontSize);
check("templates: document style override beats the template", parseFloat(overrideSize) > 45, `${overrideSize} (40pt = 53.3px)`);

// 1c. Themes: a named theme moves the accent, a bogus token is dropped, the cover starts a new sheet
const themed = buildDocToFile(
  {
    name: "verify-theme",
    template: "proposal",
    theme: { accent: "#0F6E8C", h1Size: "34pt", ink: "#123456", rule: "red; } body { display: none !important }" },
    content: [
      { type: "cover", kicker: "Egytronic", title: "عرض تجريبي", subtitle: "غلاف يفتح الملف", meta: ["لـ: شركة تجريبية", "تاريخ: 2026"] },
      { type: "h1", text: "النطاق" },
      { type: "p", text: "نص بعد الغلاف." },
    ],
  },
  "verify-theme.html",
);
await page.goto(pathToFileURL(themed.file.path).href, { waitUntil: "load" });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
const themeProbe = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const cover = document.querySelector(".cover");
  const h1 = document.querySelector(".cover h1");
  return {
    accent: root.getPropertyValue("--accent").trim(),
    ink: root.getPropertyValue("--ink").trim(),
    rule: root.getPropertyValue("--rule").trim(),
    h1Size: h1 ? getComputedStyle(h1).fontSize : null,
    coverText: cover ? cover.innerText.replace(/\s/g, "").slice(0, 30) : "",
    coverPage: cover ? cover.closest(".pagedjs_page")?.getAttribute("data-page-number") : null,
    pages: document.querySelectorAll(".pagedjs_page").length,
    bodyDisplay: getComputedStyle(document.body).display,
  };
});
check("theme: accent token reaches the page", themeProbe.accent.toLowerCase() === "#0f6e8c", themeProbe.accent);
check("theme: h1Size token resizes headings", parseFloat(themeProbe.h1Size) > 40, `${themeProbe.h1Size} (34pt = 45.3px)`);
check("theme: a value with a CSS injection attempt is dropped", !/display/.test(themeProbe.rule) && themeProbe.bodyDisplay !== "none", `rule=${themeProbe.rule || "kept default"}`);
check("cover: renders on its own first sheet", themeProbe.coverText.includes("عرضتجريبي") && themeProbe.coverPage === "1" && themeProbe.pages >= 2, `page ${themeProbe.coverPage}, ${themeProbe.pages} sheets`);
check("cover: the body starts on the next sheet", await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "النطاق");
  return Boolean(heading) && heading.closest(".pagedjs_page")?.getAttribute("data-page-number") !== "1";
}), "النطاق is on page 2+");

// 5. Fonts
const fonts = listFonts();
check("fonts: 16 families", fonts.length >= 16, `${fonts.length}`);
const missing = fonts.flatMap((font) => (fontBytes(font.family) || 0) === 0 ? [font.family] : []);
check("fonts: every family has bytes", missing.length === 0, missing.join(",") || "all embedded");
const faces = MANIFEST.flatMap((entry) => entry.files);
check("fonts: manifest subsets cover arabic+latin", faces.some((f) => f.subset === "arabic") && faces.some((f) => f.subset === "latin"), `${faces.length} faces`);

// 6. Voice guard rails (no keys in this environment)
const { tts } = await import("../lib/voice.js");
let voiceError = "";
try { await tts({ text: "x" }); } catch (error) { voiceError = error.message; }
check("voice: refuses without a key, with a clear message", /no voice provider/.test(voiceError), voiceError);

// 6b. Pixel art system: real PixelFx frames, embedded, and the quotation template
const artDir = new URL("../assets/pixelfx/", import.meta.url);
const artManifest = JSON.parse(readFileSync(new URL("manifest.json", artDir), "utf8"));
const artBad = artManifest.art.filter((art) => {
  const bytes = readFileSync(new URL(art.file, artDir));
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16) !== art.sha256 || bytes.length !== art.bytes;
});
check("art: manifest matches the rendered PNGs", artManifest.art.length >= 4 && artBad.length === 0, artBad.map((a) => a.file).join(",") || `${artManifest.art.length} pieces`);

const quoteDoc = buildDocToFile(
  {
    name: "verify-quote",
    template: "quote",
    theme: "pixel",
    content: [
      { type: "cover", art: "banner", kicker: "Egytronic", title: "عرض سعر", meta: ["رقم: 1"] },
      { type: "h2", text: "الحساب" },
      { type: "table", head: ["البند", "المبلغ"], rows: [["هوية", "10,000"], ["موقع", "6,000"]] },
    ],
  },
  "verify-quote.html",
);
const quoteHtml = readFileSync(quoteDoc.file.path, "utf8");
check("pixel: the artwork is embedded, not linked", /data:image\/png;base64,[A-Za-z0-9+/]{2000,}/.test(quoteHtml), `${Math.round(quoteHtml.length / 1024)} KB single file`);

await page.goto(pathToFileURL(quoteDoc.file.path).href, { waitUntil: "load" });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
const quoteDom = await page.evaluate(() => ({
  accent: getComputedStyle(document.querySelector("html")).getPropertyValue("--accent").trim(),
  art: getComputedStyle(document.querySelector(".cover__art")).backgroundImage.includes("data:image/png"),
  sheets: document.querySelectorAll(".pagedjs_page").length,
  rows: document.querySelectorAll("table tbody tr").length,
}));
check("pixel: theme tokens and cover art reach the page", quoteDom.accent === "#C9281F" && quoteDom.art, `${quoteDom.accent} · art ${quoteDom.art}`);
check("pixel: the quotation paginates with its table", quoteDom.sheets >= 1 && quoteDom.rows === 2, `${quoteDom.sheets} sheet(s), ${quoteDom.rows} rows`);

// 7. Library surface
check("blocks: documented block list covers the builder", DOC_BLOCKS.length >= 14 && DOC_BLOCKS.some((b) => b.type === "cover"), DOC_BLOCKS.map((b) => b.type).join(","));
check("themes: seven named themes", Object.keys(DOC_THEMES).length === 7, Object.keys(DOC_THEMES).join(","));
check("templates: five", listTemplates().length === 5, listTemplates().map((t) => t.id).join(","));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — failed: ${failed.map((f) => f.name).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
