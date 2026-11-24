/* Machine-readable surface for search engines and AI agents.
   Writes pricing.json, faq.json, llms.txt, llms-full.txt, feed.xml and security.txt
   into dist/ from the same catalogue the site renders, so nothing can drift. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POSTS } from "../src/data/posts.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const today = new Date().toISOString().slice(0, 10);

const catalog = JSON.parse(await readFile(join(ROOT, "src/data/catalog.json"), "utf8"));
const BASE = catalog.site;

const write = async (target, body) => {
  const file = join(DIST, target);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
};

const postUrl = (locale, slug) => `${BASE}${locale === "en" ? "/en/blog" : "/blog"}/${slug}/`;

const packages = [
  ...catalog.packages.map((pkg) => ({
    id: pkg.id,
    order: pkg.order,
    name: pkg.ar.name,
    name_en: pkg.en.name,
    price: pkg.price,
    price_from: pkg.priceFrom,
    currency: catalog.currency,
    delivery: pkg.ar.delivery ?? pkg.delivery.ar,
    delivery_en: pkg.en.delivery ?? pkg.delivery.en,
    summary: pkg.ar.summary,
    summary_en: pkg.en.summary,
    for: pkg.ar.for,
    includes: pkg.ar.includes,
    includes_en: pkg.en.includes,
    url: `${BASE}/pricing/#${pkg.id}`,
  })),
  {
    id: catalog.bundle.id,
    order: 6,
    name: catalog.bundle.ar.name,
    name_en: catalog.bundle.en.name,
    price: catalog.bundle.price,
    price_from: true,
    currency: catalog.currency,
    summary: catalog.bundle.ar.summary,
    summary_en: catalog.bundle.en.summary,
    includes: catalog.bundle.ar.includes,
    includes_en: catalog.bundle.en.includes,
    url: `${BASE}/pricing/#transformation`,
  },
];

const pricing = {
  brand: catalog.brand,
  site: BASE,
  updated: today,
  currency: catalog.currency,
  languages: catalog.languages,
  payment: { split: "50/50", stages: ["at kick-off", "before delivery"], terms: catalog.terms.en },
  packages,
  systems: catalog.systems,
  contact: {
    email: catalog.email,
    inquiry_endpoint: `${BASE}/api/contact`,
    inquiry_method: "POST",
    inquiry_fields: { name: "string, 2-80 chars", email: "valid email", phone: "optional", package: "optional package id", message: "string, 10-2000 chars" },
    response: "reply by email or WhatsApp",
  },
  faq: `${BASE}/faq.json`,
  posts: POSTS.map((post) => ({
    slug: post.slug,
    date: post.date,
    title: post.title.ar,
    title_en: post.title.en,
    url: postUrl("ar", post.slug),
    url_en: postUrl("en", post.slug),
    summary: post.excerpt.ar,
    summary_en: post.excerpt.en,
    tag: post.tag.ar,
    tag_en: post.tag.en,
  })),
};

const faq = {
  brand: catalog.brand,
  site: BASE,
  updated: today,
  items: catalog.faq.map((item) => ({
    id: item.id,
    question: item.ar.q,
    answer: item.ar.a,
    question_en: item.en.q,
    answer_en: item.en.a,
    url: `${BASE}/#faq`,
  })),
};

const llms = `# ${catalog.brand}

> ${catalog.facts.ar}

- الموقع: ${BASE}
- البريد: ${catalog.email}
- اللغات: العربية (الأساسية) والإنجليزية. كل صفحة لها نسخة إنجليزية تحت /en/.
- المؤسس: ${catalog.founder.ar} (${catalog.founder.en}).
- النشاط: شركة برمجيات مصرية: مواقع، هويات بصرية، أنظمة إدارية، وأنظمة ذكاء اصطناعي، تُسلَّم جاهزة للتشغيل.

## ما نبنيه
${catalog.systems.map((s) => `- ${s.ar} (${s.en})`).join("\n")}

## الأسعار المعلنة (${catalog.currency})
${packages
  .map((p) => `- ${p.name} (${p.name_en}): ${p.price_from ? "من " : ""}${p.price.toLocaleString("en-US")} جنيه · ${p.delivery ?? "يُحدَّد بعد التواصل"} · ${p.url}`)
  .join("\n")}

الشروط: ${catalog.terms.ar.join(" · ")}.

## الصفحات
- [الرئيسية](${BASE}/): العرض والباقات والأسئلة.
- [الأسعار](${BASE}/pricing/): جدول الأسعار والنطاق الكامل لكل باقة.
- [البرمجيات](${BASE}/software/): الأنظمة والأدوات المفتوحة.
- [المدونة](${BASE}/blog/): مقالات عن التحول الرقمي والذكاء الاصطناعي.
- [تواصل](${BASE}/contact/): نموذج بدء المشروع.

## ملفات للأنظمة الآلية
- [pricing.json](${BASE}/pricing.json): كتالوج الباقات والأسعار والشروط وبوابة الطلبات، قابل للقراءة آليًا.
- [faq.json](${BASE}/faq.json): الأسئلة والأجوبة بالعربية والإنجليزية.
- [llms-full.txt](${BASE}/llms-full.txt): النص الكامل للموقع والمقالات.
- [feed.xml](${BASE}/feed.xml): تغذية المقالات.
- طلب مشروع آليًا: POST ${BASE}/api/contact بالحقول name و email و phone (اختياري) و package (اختياري) و message. الاستجابة: {"ok":true,"id":"..."}. لا يوجد حساب دفع آلي؛ التسعير معلن والاتفاق يتم بالبريد.

## ما لا نفعله
- لا ننشر شهادات عملاء أو أرقام مستخدمين أو تقييمات لم نتحقق منها.
- لا نقدّم أسعارًا مخفية: السعر المعلن هو السعر، وأي إضافة تُقدَّر قبل تنفيذها.
- لا نبيع موقعًا بلا تسليم جاهز للتشغيل.
`;

const faqBlock = (locale) =>
  catalog.faq.map((item, i) => `${i + 1}. ${item[locale].q}\n   ${item[locale].a}`).join("\n\n");

const full = `# ${catalog.brand} — النص الكامل

${catalog.facts.ar}

${catalog.facts.en}

## الباقات (${catalog.currency})
${packages
  .map(
    (p) =>
      `### ${p.name} — ${p.price_from ? "من " : ""}${p.price.toLocaleString("en-US")} ${catalog.currency}\n` +
      `${p.summary}\n` +
      `مناسب لـ: ${p.for ?? "—"}\n` +
      `يشمل: ${(p.includes ?? []).join("، ")}\n` +
      `التسليم: ${p.delivery ?? "يُحدَّد بعد التواصل"}\n` +
      `English: ${p.name_en}, ${p.price_from ? "from " : ""}${p.price} ${catalog.currency}, ${p.summary_en}`
  )
  .join("\n\n")}

## الأسئلة الشائعة
${faqBlock("ar")}

## FAQ (English)
${faqBlock("en")}

## المقالات
${POSTS.map(
  (post) =>
    `### ${post.title.ar}\n${post.date} · ${post.excerpt.ar}\n${post.body.ar.join("\n")}\n\nEnglish: ${post.title.en}\n${post.body.en.join("\n")}\n`
).join("\n")}
`;

const rss = (locale) => {
  const items = POSTS.map((post) => {
    const link = postUrl(locale, post.slug);
    return `    <item>
      <title>${escapeXml(post.title[locale])}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt[locale])}</description>
    </item>`;
  }).join("\n");
  const title = locale === "en" ? "Egytronic — Journal" : "Egytronic — المدونة";
  const link = locale === "en" ? `${BASE}/en/blog/` : `${BASE}/blog/`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${link}</link>
    <atom:link href="${link}feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(catalog.facts[locale])}</description>
    <language>${locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (!existsSync(DIST)) {
  console.error("dist/ is missing: run npm run build");
  process.exit(1);
}

await write("pricing.json", JSON.stringify(pricing, null, 2) + "\n");
await write("faq.json", JSON.stringify(faq, null, 2) + "\n");
await write("llms.txt", llms);
await write("llms-full.txt", full);
await write("feed.xml", rss("ar"));
await write("en/feed.xml", rss("en"));
await write(".well-known/security.txt", `Contact: mailto:${catalog.email}
Expires: ${new Date(Date.now() + 365 * 864e5).toISOString()}
Preferred-Languages: ar, en
Canonical: ${BASE}/.well-known/security.txt
`);

console.log(`agent files ok: ${packages.length} packages, ${catalog.faq.length} faq, ${POSTS.length} posts`);
