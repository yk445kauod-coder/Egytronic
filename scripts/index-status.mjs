/* Is the site in the index yet? Prints what a crawler can see and what the engines have.

   npm run index-status            all sitemap URLs + engine checks
   npm run index-status -- quick   one URL + engine checks                                  */

const SITE = "https://egytronic.pages.dev";
const UA = "Mozilla/5.0 (compatible; EgytronicIndexCheck/1.0)";

const get = async (url, ua = UA) => {
  const res = await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow" });
  return { status: res.status, body: await res.text() };
};

const sitemap = await get(`${SITE}/sitemap.xml`);
const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const quick = process.argv.includes("quick");
const targets = quick ? [urls[0] ?? SITE + "/"] : urls;

let bad = 0;
for (const url of targets) {
  const { status } = await get(url);
  if (status !== 200) {
    bad += 1;
    console.log(`  ✗ ${status} ${url}`);
  }
}
console.log(`sitemap: ${sitemap.status} · ${urls.length} urls · ${targets.length} checked · ${bad} not 200`);

const robots = await get(`${SITE}/robots.txt`);
const blocked = /^\s*Disallow:\s*\/\s*$/m.test(robots.body);
console.log(`robots.txt: ${robots.status} · root blocked: ${blocked ? "YES" : "no"}`);

const home = await get(SITE, "Googlebot/2.1 (+http://www.google.com/bot.html)");
const head = home.body.slice(0, home.body.indexOf("</head>"));
const inHead = (needle) => head.includes(needle);
console.log(`googlebot view: ${home.status} · title ${inHead("<title") ? "✓" : "✗"} · description ${inHead('name="description"') ? "✓" : "✗"} · canonical ${inHead('rel="canonical"') ? "✓" : "✗"} · json-ld ${inHead("application/ld+json") ? "✓" : "✗"}`);

for (const [engine, url] of [
  ["Bing", `https://www.bing.com/search?q=site%3A${new URL(SITE).hostname}`],
  ["DuckDuckGo", `https://html.duckduckgo.com/html/?q=site%3A${new URL(SITE).hostname}`],
]) {
  try {
    const { status, body } = await get(url, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
    // A result link, not the echoed query: the query itself contains the hostname.
    const hit = new RegExp(`class="result__a"[^>]*href="[^"]*${new URL(SITE).hostname.replace(/\./g, "\\.")}`, "i").test(body)
      || new RegExp(`<h2><a href="https?://${new URL(SITE).hostname.replace(/\./g, "\\.")}`, "i").test(body);
    console.log(`${engine}: ${status} · ${hit ? "found in index" : "not indexed yet"}`);
  } catch (error) {
    console.log(`${engine}: ${error.message}`);
  }
}
