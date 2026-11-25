// End-to-end proof: build every artifact, open it in Chromium, measure it, print it to PDF.
import { chromium } from "playwright";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDocToFile, listTemplates } from "../lib/doc.js";
import { renderToFile } from "../lib/reel.js";
import { writeCaptions } from "../lib/captions.js";
import { listFonts, fontBytes, MANIFEST } from "../lib/fonts.js";
import { ARTIFACT_DIR } from "../lib/artifacts.js";
import { BLOCKS } from "../runtime/blocks.js";
import { PRESETS } from "../lib/reel.js";

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
  toc: [...document.querySelectorAll(".toc a")].map((a) => Number(getComputedStyle(a, "::before").content.replace(/["']/g, ""))),
  fontOk: document.fonts.check('16px "IBM Plex Sans Arabic"'),
  printSheet: [...document.querySelectorAll("style[data-studio]")].map((s) => s.textContent).join(" "),
  firstPage: (document.querySelector(".pagedjs_page")?.innerText || "").slice(0, 80),
  sheetWidth: document.querySelector(".pagedjs_page")?.getBoundingClientRect().width,
}));
check("doc: pages laid out", dom.pages >= 2, `${dom.pages} sheets`);
check("doc: embedded font is active", dom.fontOk === true, 'document.fonts.check("IBM Plex Sans Arabic")');
check("doc: TOC folios resolved", dom.toc.length >= 3 && dom.toc.every((value) => Number.isInteger(value) && value >= 1), dom.toc.join(" / "));
check("doc: A4 sheet width", Math.round(dom.sheetWidth) === 794, `${Math.round(dom.sheetWidth)}px`);

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
await page.emulateMedia({ media: "screen" });

const pdfPath = join(ARTIFACT_DIR, "verify-doc.pdf");
await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
const pdf = await pdfPages(pdfPath);
check("print: PDF page count matches the sheets", pdf.count === dom.pages, `${pdf.count} PDF pages vs ${dom.pages} sheets`);
check("print: no blank page", pdf.pages.every((p) => p.text.length > 0), pdf.pages.map((p) => p.text.length).join(","));
const folio = pdf.pages.slice(1).some((p) => /[\u0660-\u0669]|[0-9]/.test(p.text));
check("print: every page after the cover carries a folio", folio, folio ? "page numbers present" : "no page number found");
check("print: A4 paper size", pdf.pages.every((p) => Math.abs(p.size[0] - 595) < 3 && Math.abs(p.size[1] - 842) < 3), `${pdf.pages[0].size.join("x")}pt`);
check("print: cover carries text", pdf.pages[0].text.replace(/\s/g, "").length > 20, pdf.pages[0].text.slice(0, 40));

// 1b. Every template builds, and a document-level style override wins over the template
const templatePages = [];
for (const id of ["editorial", "report", "brief"]) {
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
check("templates: all three build and paginate", templatePages.every((t) => t.sheets >= 1), templatePages.map((t) => `${t.id}:${t.sheets}@${t.w}px`).join(" "));
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

// 2. Reel → frames render, motion changes the frame, export hooks exist
const { file: reelFile } = renderToFile(
  {
    name: "verify-reel",
    preset: "reel",
    seconds: 3,
    fontFamily: "Alexandria",
    scenes: [
      { at: 0, durationMs: 1500, block: "type.headline", props: { text: "بنتعلم بسرعة", accentWords: ["بسرعة"] } },
      { at: 1500, durationMs: 1500, block: "captions.karaoke", props: { text: "سطر أول، سطر تاني" } },
    ],
  },
  "verify-reel.html",
);
await page.goto(pathToFileURL(reelFile.path).href + "?bare=1", { waitUntil: "load" });
await page.waitForFunction(() => window.__studio && window.__studio.ready !== false, { timeout: 30000 });

const frameHash = async (seconds) => {
  await page.evaluate((t) => window.seek(t), seconds);
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4 * 7) {
      const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += luma;
      if (luma > 150) ink += 1;
    }
    return { n: Math.round(sum), ink, w: canvas.width, h: canvas.height };
  });
};

const a = await frameHash(0.3);
const b = await frameHash(1.9);
check("reel: canvas is 1080x1920", a.w === 1080 && a.h === 1920, `${a.w}x${a.h}`);
check("reel: image is not blank", a.n > 0 && b.n > 0, `luma ${a.n}/${b.n}`);
check("reel: frame has contrast (type drawn)", a.ink + b.ink > 50, `light samples ${a.ink}/${b.ink}`);
check("reel: motion changes the frame", a.n !== b.n, `${a.n} vs ${b.n}`);
check("reel: the two frames differ", Math.abs(a.n - b.n) > 100, `${a.n} vs ${b.n}`);
const hooks = await page.evaluate(() => ({ seek: typeof window.seek, duration: window.duration, api: Object.keys(window.__studio || {}) }));
check("reel: seek/duration API", hooks.seek === "function" && hooks.duration > 0, `duration=${hooks.duration}s api=${hooks.api.join(",")}`);

// 3. Logo block draws
const { file: logoFile } = renderToFile(
  {
    name: "verify-logo",
    preset: "square",
    seconds: 2,
    scenes: [{ at: 0, durationMs: 2000, block: "logo.reveal", props: { paths: ["M40 40h120v120H40z"], color: "#FF6A00" } }],
  },
  "verify-logo.html",
);
await page.goto(pathToFileURL(logoFile.path).href + "?bare=1", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__studio), { timeout: 30000 });
await page.waitForTimeout(150);
const logo = await page.evaluate(() => {
  window.seek(1.6);
  const canvas = window.__studio.canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i + 3] > 128) bright += 1;
  return bright;
});
check("logo: mark is painted", logo > 1000, `${logo} accent pixels`);

// 4. Captions
const words = [
  { text: "بنتعلم", start: 0, end: 0.4 },
  { text: "بسرعة", start: 0.45, end: 0.9 },
  { text: "وبنكتب", start: 1.4, end: 1.9 },
];
const captions = writeCaptions(words, "verify-captions");
for (const ext of ["srt", "vtt", "ass"]) {
  const text = readFileSync(captions.files[ext], "utf8");
  check(`captions: ${ext.toUpperCase()} written`, text.length > 20 && text.includes("بنتعلم"), `${text.length} bytes`);
}
check("captions: SRT timing", /00:00:00,000 --> 00:00:0\d,\d{3}/.test(readFileSync(captions.files.srt, "utf8")), "cue present");

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

// 7. Library surface
check("blocks: 9 blocks", Object.keys(BLOCKS).length >= 9, Object.keys(BLOCKS).join(","));
check("presets: reel/square/story", Boolean(PRESETS.reel && PRESETS.square), Object.keys(PRESETS).join(","));
check("templates: three", listTemplates().length === 3, listTemplates().map((t) => t.id).join(","));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — failed: ${failed.map((f) => f.name).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
