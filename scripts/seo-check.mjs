/* SEO / AEO / GEO gate for the built site.

   Fails the build when a page loses its title, description, canonical, hreflang,
   single H1, valid JSON-LD graph or when the sitemap, feeds, llms.txt and the
   machine-readable catalogue disagree with what was actually rendered. */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BASE = "https://egytronic.pages.dev";
const ARABIC = /[\u0600-\u06FF]/;

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "admin" || entry.name === "assets") continue;
      out.push(...(await walk(full)));
    } else if (entry.name === "index.html") {
      out.push(full);
    }
  }
  return out;
}

const decode = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const urlFor = (file) => {
  const rel = relative(DIST, file).replace(/index\.html$/, "");
  return `${BASE}/${rel}`;
};

async function checkPage(file) {
  const html = await readFile(file, "utf8");
  const url = urlFor(file);
  const isEn = url.startsWith(`${BASE}/en/`);
  const label = relative(DIST, file);

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1];
  if (!title) fail(`${label}: missing <title>`);
  else if (decode(title).length > 70) fail(`${label}: title is ${decode(title).length} chars (max 70)`);

  const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)?.[1];
  if (!desc) fail(`${label}: missing meta description`);
  else {
    const len = decode(desc).length;
    if (len < 60 || len > 165) fail(`${label}: description is ${len} chars (60-165)`);
  }

  const canonicalHref = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  if (!canonicalHref) fail(`${label}: missing canonical`);
  else if (canonicalHref !== url) fail(`${label}: canonical does not point at ${url}`);
  for (const lang of ["ar", "en", "x-default"]) {
    if (!html.toLowerCase().includes(`hreflang="${lang}"`)) fail(`${label}: missing hreflang ${lang}`);
  }
  if (!/<meta[^>]*name="robots"[^>]*content="index/.test(html)) fail(`${label}: missing robots meta`);
  if (!/<meta[^>]*name="theme-color"/.test(html)) fail(`${label}: missing theme-color`);
  if (!/<meta[^>]*property="og:image"/.test(html)) fail(`${label}: missing og:image`);

  const h1s = html.match(/<h1[ >]/g) ?? [];
  if (h1s.length !== 1) fail(`${label}: ${h1s.length} h1 elements (expected 1)`);

  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) fail(`${label}: no JSON-LD`);
  let types = new Set();
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const nodes = parsed["@graph"] ?? [parsed];
      for (const node of nodes) {
        const t = node["@type"];
        for (const value of Array.isArray(t) ? t : [t]) types.add(value);
      }
    } catch (error) {
      fail(`${label}: JSON-LD does not parse (${error.message})`);
    }
  }
  for (const required of ["Organization", "WebSite"]) {
    if (!types.has(required)) fail(`${label}: JSON-LD missing ${required}`);
  }
  if (!types.has("WebPage") && !types.has("Article")) fail(`${label}: JSON-LD has neither WebPage nor Article`);
  if (isEn && ARABIC.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) {
    fail(`${label}: Arabic text leaked into the English page`);
  }
  if (!isEn && types.has("Article") === false && label.includes("blog/") === false) {
    // home and the three inner pages should not advertise themselves as articles
  }
  return { url, types: [...types] };
}

async function checkLinks(files) {
  const targets = new Set(files.map((f) => urlFor(f)));
  const externalOk = /^(https?:|mailto:|tel:|#)/;
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]));
    for (const href of hrefs) {
      if (externalOk.test(href)) continue;
      if (/^\/(assets|favicon|apple-touch)|\.(css|js|woff2|png|ico|svg|xml|json|txt)$/.test(href)) continue;
      const [path] = href.split("#");
      if (!path) continue;
      const normal = path.endsWith("/") ? path : `${path}/`;
      const target = `${BASE}${normal.startsWith("/") ? "" : "/"}${normal}`;
      if (!targets.has(target)) fail(`${relative(DIST, file)}: broken internal link ${href}`);
    }
  }
}

const files = await walk(DIST);
if (!files.length) fail("dist has no pages: run npm run build first");

const pages = [];
for (const file of files) pages.push(await checkPage(file));

// sitemap must list exactly the rendered pages
const sitemap = await readFile(join(DIST, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const { url } of pages) {
  if (!locs.includes(url)) fail(`sitemap is missing ${url}`);
}
for (const loc of locs) {
  if (!pages.some((p) => p.url === loc)) fail(`sitemap lists ${loc}, which was not built`);
}

// machine-readable surface
const read = async (name) => {
  const path = join(DIST, name);
  if (!existsSync(path)) {
    fail(`missing ${name}`);
    return null;
  }
  return readFile(path, "utf8");
};

const pricingRaw = await read("pricing.json");
const pricing = pricingRaw ? JSON.parse(pricingRaw) : null;
if (pricing) {
  if (pricing.currency !== "EGP") fail("pricing.json: currency is not EGP");
  if (pricing.packages.length !== 6) fail(`pricing.json: ${pricing.packages.length} packages (expected 6)`);
  for (const pkg of pricing.packages) {
    // A package either publishes a number or is explicitly quoted after the scope is agreed.
    if (pkg.quote) {
      if (pkg.price) fail(`pricing.json: ${pkg.id} is marked quote-only but still carries a price`);
      if (!pkg.quote_note) fail(`pricing.json: ${pkg.id} is quote-only with no explanation`);
    } else if (!Number.isFinite(pkg.price) || pkg.price <= 0) {
      fail(`pricing.json: ${pkg.id} has no price`);
    }
    if (!pkg.name_en) fail(`pricing.json: ${pkg.id} has no English name`);
  }
  if (!pricing.contact?.inquiry_endpoint) fail("pricing.json: no inquiry endpoint documented");
  notes.push(`pricing.json: ${pricing.packages.length} packages, ${pricing.posts.length} posts`);
}

const faqRaw = await read("faq.json");
const faq = faqRaw ? JSON.parse(faqRaw) : null;
if (faq) {
  if (faq.items.length < 8) fail(`faq.json: ${faq.items.length} items (expected at least 8)`);
  for (const item of faq.items) {
    if (!item.question || !item.answer) fail(`faq.json: ${item.id} is incomplete`);
    if (!item.question_en || !item.answer_en) fail(`faq.json: ${item.id} is not bilingual`);
  }
  notes.push(`faq.json: ${faq.items.length} bilingual answers`);
}

const llms = await read("llms.txt");
if (llms) {
  if (!llms.includes("pricing.json")) fail("llms.txt does not point at pricing.json");
  if (!llms.includes("/api/contact")) fail("llms.txt does not document the inquiry endpoint");
  if (llms.length > 12000) fail("llms.txt is too long to stay a summary");
  notes.push(`llms.txt: ${llms.length} chars`);
}

const llmsFull = await read("llms-full.txt");
if (llmsFull && llmsFull.length < 20000) fail("llms-full.txt looks truncated");

const feed = await read("feed.xml");
if (feed) {
  const items = (feed.match(/<item>/g) ?? []).length;
  if (items !== pricing?.posts.length) fail(`feed.xml has ${items} items, expected ${pricing?.posts.length}`);
  notes.push(`feed.xml: ${items} items`);
}
await read("en/feed.xml");
await read(".well-known/security.txt");

const robots = await read("robots.txt");
if (robots) {
  for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot"]) {
    if (!robots.includes(agent)) fail(`robots.txt does not address ${agent}`);
  }
  if (!robots.includes("Sitemap:")) fail("robots.txt has no sitemap line");
}

// FAQ schema on the home page must match the visible questions
const homeHtml = await readFile(join(DIST, "index.html"), "utf8");
if (!homeHtml.includes('"FAQPage"')) fail("home page has no FAQPage schema");
if (!homeHtml.includes('"OfferCatalog"')) fail("home page has no OfferCatalog schema");

await checkLinks(files);

console.log(`pages checked: ${pages.length}`);
for (const note of notes) console.log(`  ${note}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log("SEO/AEO gate passed");
