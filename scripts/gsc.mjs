/* Google Search Console from the command line, no dependencies.

   Auth: a service-account JSON key with the Search Console API and the
   Site Verification API enabled. Pass it as a path or through GSC_SA_JSON
   (raw JSON or base64). The key is read, never written.

     node scripts/gsc.mjs token                 # print the meta tag to add
     node scripts/gsc.mjs verify                # verify the URL-prefix property
     node scripts/gsc.mjs sites                 # list properties the key can see
     node scripts/gsc.mjs sitemap               # submit the sitemap
     node scripts/gsc.mjs sitemap-status        # show submitted sitemaps
     node scripts/gsc.mjs query                 # 28-day search performance
*/

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const SITE = process.env.GSC_SITE ?? "https://egytronic.pages.dev/";
const SITEMAP = process.env.GSC_SITEMAP ?? "https://egytronic.pages.dev/sitemap.xml";
const KEY_PATH = process.env.GSC_SA_FILE;
const KEY_ENV = process.env.GSC_SA_JSON;

const SCOPE = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
].join(" ");

async function serviceAccount() {
  let raw = KEY_ENV;
  if (!raw && KEY_PATH) raw = await readFile(KEY_PATH, "utf8");
  if (!raw) {
    console.error(
      "No service-account key. Set GSC_SA_FILE=/path/key.json or GSC_SA_JSON=<json|base64>.\n" +
        "Create one in Google Cloud: APIs & Services > Credentials > Create credentials > Service account key."
    );
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

const b64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function accessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(credentials.private_key);
  const assertion = `${header}.${claim}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("Token exchange failed:", body.error_description ?? body.error ?? res.status);
    console.error("Check that the Search Console API and Site Verification API are enabled for the project.");
    process.exit(1);
  }
  return body.access_token;
}

async function api(token, method, url, payload) {
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message = body?.error?.message ?? `${res.status} ${res.statusText}`;
    const reason = body?.error?.errors?.[0]?.reason;
    throw new Error(`${method} ${url} -> ${message}${reason ? ` (${reason})` : ""}`);
  }
  return body;
}

async function tokenTag(token) {
  return api(token, "POST", "https://www.googleapis.com/siteverification/v1/token", {
    site: { type: "SITE", identifier: SITE },
    verificationMethod: "META",
  });
}

async function main() {
  const [command = "help"] = process.argv.slice(2);
  if (command === "help") {
    console.log("commands: token | verify | sites | sitemap | sitemap-status | query");
    return;
  }
  const credentials = await serviceAccount();
  const token = await accessToken(credentials);

  if (command === "token") {
    const result = await tokenTag(token);
    console.log(`Add this to the <head> of the site, then deploy:\n\n${result.token}\n`);
    return;
  }

  if (command === "verify") {
    const page = await fetch(SITE).then((r) => r.text());
    if (!/google-site-verification/.test(page)) {
      console.error(`The meta tag is not on ${SITE} yet. Run "token", add it, deploy, then verify again.`);
      process.exit(1);
    }
    const result = await api(
      token,
      "POST",
      "https://www.googleapis.com/siteverification/v1/webResource?verificationMethod=META",
      { site: { type: "SITE", identifier: SITE } }
    );
    console.log("verified:", result.id);
    return;
  }

  if (command === "sites") {
    const result = await api(token, "GET", "https://www.googleapis.com/webmasters/v3/sites");
    const sites = result.siteEntry ?? [];
    if (!sites.length) console.log("no properties visible to this key");
    for (const site of sites) console.log(`${site.permissionLevel.padEnd(15)} ${site.siteUrl}`);
    return;
  }

  if (command === "sitemap") {
    const feed = encodeURIComponent(SITEMAP);
    await api(token, "PUT", `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps/${feed}`);
    console.log(`submitted: ${SITEMAP} for ${SITE}`);
    return;
  }

  if (command === "sitemap-status") {
    const result = await api(
      token,
      "GET",
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps`
    );
    for (const row of result.sitemap ?? []) {
      console.log(`${row.path}`);
      console.log(`  last downloaded: ${row.lastDownloaded ?? "never"} · warnings: ${row.warnings ?? 0} · errors: ${row.errors ?? 0}`);
    }
    return;
  }

  if (command === "query") {
    const end = new Date();
    const start = new Date(end.getTime() - 28 * 864e5);
    const iso = (d) => d.toISOString().slice(0, 10);
    const result = await api(
      token,
      "POST",
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
      { startDate: iso(start), endDate: iso(end), dimensions: ["query"], rowLimit: 25 }
    );
    const rows = result.rows ?? [];
    if (!rows.length) console.log("no search data yet for the last 28 days");
    for (const row of rows) {
      console.log(`${row.clicks.toString().padStart(4)} clicks · ${row.impressions.toString().padStart(6)} impressions · pos ${row.position.toFixed(1)} · ${row.keys[0]}`);
    }
    return;
  }

  console.error(`unknown command: ${command}`);
  process.exit(2);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
