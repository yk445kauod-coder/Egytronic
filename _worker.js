// Contact portal backend, served by Cloudflare Pages advanced mode.
// Budget per submit: one COUNT + one INSERT (D1) and no network calls, so it
// stays far below the Workers free CPU allowance and the D1 daily limits.

const PACKAGES = new Set([
  "logo", "landing", "static", "identity", "dynamic", "transform", "unsure",
]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (value, max) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function contact(request, env) {
  if (!env.DB) return json({ ok: false, code: "no-store" }, 503);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: "bad-json" }, 400);
  }

  if (clean(payload.website, 40)) return json({ ok: true }); // honeypot

  const name = clean(payload.name, 80);
  const email = clean(payload.email, 120);
  const phone = clean(payload.phone, 32);
  const message = clean(payload.message, 2000);
  const wanted = clean(payload.package, 24);

  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, code: "email" }, 400);
  if (message.length < 10) return json({ ok: false, code: "message" }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await hashIp(ip, env.CONTACT_SALT || "egytronic") : null;

  if (ipHash) {
    const recent = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash = ? AND created_at > datetime('now','-10 minutes')")
      .bind(ipHash)
      .first();
    if ((recent?.n ?? 0) >= 5) return json({ ok: false, code: "rate" }, 429);
  }

  await env.DB
    .prepare("INSERT INTO inquiries (name, email, phone, package, message, ip_hash, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(name, email, phone || null, PACKAGES.has(wanted) ? wanted : null, message, ipHash, "site")
    .run();

  return json({ ok: true });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The read token lives in D1 (as a hash), not in the repo or in project env,
// so a stale deployment can never leak it.
async function listInquiries(request, env, url) {
  if (!env.DB) return json({ ok: false, code: "no-store" }, 503);

  const token = url.searchParams.get("token") || "";
  if (!token) return json({ ok: false }, 404);

  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (!stored || (await sha256(token)) !== stored.value) return json({ ok: false }, 404);

  const { results } = await env.DB
    .prepare("SELECT id, created_at, name, email, phone, package, message FROM inquiries ORDER BY id DESC LIMIT 50")
    .all();
  return json({ ok: true, count: results.length, rows: results });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") return json({ ok: false }, 405);
      return contact(request, env);
    }
    if (url.pathname === "/api/inquiries" && request.method === "GET") {
      return listInquiries(request, env, url);
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, db: Boolean(env.DB) });
    }

    return env.ASSETS.fetch(request);
  },
};
