/* Document → PDF, with the browser doing the print.

   node scripts/pdf.mjs <doc.json> [out.pdf]
   The HTML is built first (lib/doc.js), then Chromium prints it with the same contract the print
   button uses, so the PDF is the file you were looking at — no second layout engine. */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDocToFile, PAGE_PRESETS } from "../lib/doc.js";

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/pdf.mjs <doc.json> [out.pdf]");
  process.exit(1);
}
const doc = JSON.parse(readFileSync(input, "utf8"));
const out = output || `artifacts/${basename(input).replace(/\.json$/, "")}.pdf`;
const { file } = buildDocToFile(doc, basename(out).replace(/\.pdf$/, ".html"));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(file.path).href, { waitUntil: "load" });
await page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
const sheets = await page.$$eval(".pagedjs_page", (nodes) => nodes.length);
const preset = PAGE_PRESETS[doc.preset] || PAGE_PRESETS["a4-portrait"];
const [w, h] = preset.size === "A5" ? [148, 210] : preset.size === "Letter" ? [215.9, 279.4] : [210, 297];
await page.pdf({
  path: out,
  width: `${w}mm`,
  height: `${h}mm`,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log(`pdf: ${out} · ${sheets} pages · ${w}×${h}mm`);
