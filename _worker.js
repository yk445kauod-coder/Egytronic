// Egytronic backend: the public contact portal, the internal operations console and
// an MCP endpoint any agent can drive. Every handler is a handful of D1 statements
// and there are no outbound calls, so it stays inside the Workers free allowance.
//
// Auth: one admin token (sha256 in settings) plus per-agent keys (agents table).
// Agents carry scopes — read, write, admin — and only get what they need.

// Discovery documents that must not be served as text/plain: Pages derives the type from the
// extension and _headers only appends a second value, so the worker sets it outright.
const AGENT_DOCS = {
  "/.well-known/api-catalog": "application/linkset+json",
  "/.well-known/ai-catalog.json": "application/json",
  "/.well-known/mcp/server-card.json": "application/json",
  "/.well-known/agent-skills/index.json": "application/json",
  "/.well-known/poppy.json": "application/json",
};


// Markdown for agents: an HTML page answered as markdown when the client asks for it.
// Deliberately crude — headings, lists, links, emphasis, paragraphs — because the alternative is
// shipping a full HTML parser into every request.
const mdText = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const htmlToMarkdown = (html) => {
  const start = html.indexOf("<body");
  let out = start === -1 ? html : html.slice(start);
  out = out
    .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|footer)[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${"#".repeat(+n)} ${mdText(t)}\n`);
  out = out.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${mdText(t)}\n`);
  out = out.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const label = mdText(t) || href;
    return href.startsWith("http") ? `[${label}](${href})` : `[${label}](${href})`;
  });
  out = out.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${mdText(t)}**`);
  out = out.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${mdText(t)}*`);
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${t}\n`);
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<[^>]+>/g, " ");
  return out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .concat("\n");
};

// Search for agents: grep the public pages, answer as markdown so a model can read it directly.
const SEARCH_INDEX = [
  ["/", "Egytronic — برمجيات تُسلَّم جاهزة بأسعار معلنة", "شركة برمجيات مصرية: مواقع، هوية، أنظمة إدارية، ذكاء اصطناعي. خمس باقات بأسعار معلنة."],
  ["/pricing/", "الأسعار والباقات", "logo 5,000 · landing 6,000 · static 8,000 · identity 10,000 · dynamic from 18,000 EGP، 50% مقدمًا."],
  ["/software/", "البرمجيات والأنظمة", "ERP وCRM وPOS وHMS وLMS وإدارة عيادات، وتخصيص على طريقة عمل الفريق."],
  ["/contact/", "تواصل وابدأ مشروعك", "نموذج تواصل وواتساب. اذكر النطاق والميزانية والموعد."],
  ["/blog/", "المدونة", "مقالات عن التحول الرقمي والأنظمة والذكاء الاصطناعي للشركات المصرية."],
  ["/en/", "Egytronic in English", "Egyptian software studio with published prices."],
];

async function agentSearch(url) {
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const hits = SEARCH_INDEX.filter(([path, title, body]) =>
    !q || `${path} ${title} ${body}`.toLowerCase().includes(q));
  const md = [
    `# Search results for: ${q || "(everything)"}`,
    "",
    ...hits.map(([path, title, body]) => `## [${title}](https://egytronic.pages.dev${path})\n${body}\n`),
    hits.length ? "" : "No page matched. Try /pricing/, /software/, /contact/.",
  ].join("\n");
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "accept-query": 'q="query"',
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });
}

const PACKAGES = new Set(["logo", "landing", "static", "identity", "dynamic", "transform", "unsure"]);
const INQUIRY_STATUS = new Set(["new", "contacted", "qualified", "proposal", "won", "lost"]);
const TASK_STATUS = new Set(["todo", "doing", "done"]);
const CLIENT_STATUS = new Set(["lead", "active", "paused", "done"]);
const PROJECT_STATUS = new Set(["planned", "building", "review", "shipped"]);

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization, x-admin-token",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      ...extra,
    },
  });

const clean = (value, max) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

const int = (value, fallback = null) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashIp = async (ip, salt) => (await sha256(`${salt}:${ip}`)).slice(0, 24);

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ── auth ─────────────────────────────────────────────────────────────
// "Authorization: Bearer <token>", "x-admin-token", or ?token= — the query form
// exists because some MCP clients can only be given a URL.

function bearer(request, url) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] || request.headers.get("x-admin-token") || url.searchParams.get("token") || "").trim();
}

async function identify(request, env, url) {
  if (!env.DB) return null;
  const token = bearer(request, url);
  if (token) {
    const who = await tokenWho(request, env, token);
    if (who) return who;
  }
  return sessionWho(request, env);
}

async function tokenWho(request, env, token) {
  const digest = await sha256(token);
  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (stored && stored.value === digest) {
    return { role: "admin", name: "yousef", scopes: ["read", "write", "admin"] };
  }

  if (token.startsWith("egx_at_")) {
    const grant = await env.DB
      .prepare(
        `SELECT t.scope, c.name AS client FROM oauth_tokens t
         LEFT JOIN oauth_clients c ON c.id = t.client_id
         WHERE t.token_sha256 = ? AND t.kind = 'access' AND t.revoked = 0 AND t.expires_at > datetime('now')`
      )
      .bind(digest)
      .first();
    if (!grant) return null;
    const scopes = String(grant.scope || "read").split(/\s+/).filter(Boolean);
    return { role: "agent", name: grant.client || "oauth client", scopes };
  }

  const agent = await env.DB
    .prepare("SELECT id, name, scopes, active FROM agents WHERE key_sha256 = ?")
    .bind(digest)
    .first();
  if (!agent || !agent.active) return null;

  await env.DB.prepare("UPDATE agents SET last_seen = datetime('now') WHERE id = ?").bind(agent.id).run();
  const scopes = String(agent.scopes || "read")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { role: "agent", id: agent.id, name: agent.name, scopes };
}

const can = (who, scope) => Boolean(who?.scopes?.includes(scope) || who?.scopes?.includes("admin"));

// ── team accounts ───────────────────────────────────────────────────
// Each person gets a row in members, a password hash and an explicit permission
// list. The static owner token keeps working as break-glass access.

const SESSION_COOKIE = "egx_session";
const SESSION_DAYS = 14;
// Workers' WebCrypto throws NotSupportedError above 100k PBKDF2 iterations, so
// this is both the hash cost and the ceiling checkPassword will accept.
const PBKDF2_ROUNDS = 100000;

const PERMISSIONS = [
  "tasks.all",
  "tasks.manage",
  "inquiries.view",
  "inquiries.manage",
  "clients.view",
  "clients.manage",
  "projects.view",
  "projects.manage",
  "finance.view",
  "team.manage",
  "channels.manage",
  "channels.post",
  "code.view",
  "code.manage",
  "integrations.view",
  "integrations.manage",
  "agents.manage",
  "settings.manage",
];

// What each role can do before anyone edits the checkboxes.
const ROLE_PERMISSIONS = {
  owner: PERMISSIONS,
  manager: PERMISSIONS.filter((p) => !["settings.manage", "agents.manage"].includes(p)),
  member: ["tasks.manage", "inquiries.view", "clients.view", "projects.view", "channels.manage", "code.view"],
  contractor: ["tasks.manage", "projects.view", "channels.manage", "code.view"],
};

// Only these stay out of reach for agent keys that hold the write scope.
const OWNER_ONLY = ["team.manage", "settings.manage", "agents.manage"];

const permList = (value, role) => {
  // an owner always holds the full set, even if the row predates a permission
  if (role === "owner") return PERMISSIONS;
  if (value === undefined || value === null || value === "") return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.member;
  const asked = String(value).split(",").map((p) => p.trim()).filter((p) => PERMISSIONS.includes(p));
  return [...new Set(asked)];
};

const memberWho = (row) => ({
  role: row.role === "owner" ? "admin" : "member",
  member_role: row.role,
  id: row.id,
  name: row.name,
  email: row.email,
  permissions: permList(row.permissions, row.role),
  scopes: row.role === "owner" ? ["read", "write", "admin"] : ["read", "write"],
});

const allow = (who, permission) => {
  if (!who) return false;
  if (who.member_role) return who.permissions.includes(permission);
  if (who.role === "agent") return can(who, "admin") || !OWNER_ONLY.includes(permission);
  return true;
};

const publicMember = (row) => {
  if (!row) return row;
  const { password_hash: _hash, ...rest } = row;
  return rest;
};

const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return "";
};

async function sessionWho(request, env) {
  const id = readCookie(request, SESSION_COOKIE);
  if (!id) return null;
  const row = await env.DB
    .prepare(
      `SELECT m.* FROM member_sessions s JOIN members m ON m.id = s.member_id
        WHERE s.id = ? AND s.expires_at > datetime('now') AND m.active = 1`
    )
    .bind(id)
    .first();
  if (!row) return null;
  await env.DB.prepare("UPDATE member_sessions SET last_seen = datetime('now') WHERE id = ?").bind(id).run();
  return memberWho(row);
}

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value) => Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ROUNDS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

async function checkPassword(password, stored) {
  const [scheme, rounds, salt, expected] = String(stored || "").split("$");
  if (scheme !== "pbkdf2" || !salt || !expected) return false;
  const cost = Number(rounds) || PBKDF2_ROUNDS;
  if (cost > PBKDF2_ROUNDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: fromB64(salt), iterations: cost, hash: "SHA-256" },
      key,
      256
    )
  );
  const want = fromB64(expected);
  if (bits.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ want[i];
  return diff === 0;
}

const tempPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

const sessionCookie = (id, maxAge) =>
  `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/* Members see the channels they were added to; owners and managers see everything. */
async function joinTeamChannels(env, memberId) {
  await env.DB
    .prepare(
      `INSERT OR IGNORE INTO channel_members (channel_id, member_id)
       SELECT id, ? FROM channels WHERE kind = 'team'`
    )
    .bind(memberId)
    .run();
}

// ── OAuth 2.1: authorization code + PKCE ─────────────────────────────
// Any MCP client can authorise itself: discover, register, ask the owner on a page,
// then trade a one-time code for a short-lived bearer token. Static admin tokens and
// agent keys keep working, so nothing that already talks to us has to change.

const OAUTH_SCOPES = ["read", "write", "admin"];
const ACCESS_TTL = 3600;
const REFRESH_TTL = 2592000;
const CODE_TTL = 300;
// a per-isolate speed bump on credential guessing; D1 would be stronger but slower
const authFails = new Map();

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomToken = (prefix) => prefix + b64url(crypto.getRandomValues(new Uint8Array(32)));

const s256 = async (verifier) =>
  b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

const normalizeScopes = (raw) => {
  const asked = String(raw || "").split(/[\s,]+/).filter(Boolean);
  const kept = asked.filter((scope) => OAUTH_SCOPES.includes(scope));
  return (kept.length ? kept : ["read", "write"]).join(" ");
};

async function requestParams(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const data = (await body(request)) || {};
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
  }
  const form = await request.formData().catch(() => null);
  return form ? Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])) : {};
}

const challengeHeader = (request) => {
  const origin = new URL(request.url).origin;
  return { "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` };
};

const protectedResource = (request) => {
  const origin = new URL(request.url).origin;
  return json({
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Egytronic ops",
  });
};

const authorizationServer = (request) => {
  const origin = new URL(request.url).origin;
  return json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    resource_indicators_supported: true,
  });
};

async function registerClient(request, env) {
  if (!env.DB) return json({ error: "server_error" }, 500);
  const data = (await body(request)) || {};
  const uris = Array.isArray(data.redirect_uris) ? data.redirect_uris.filter((u) => typeof u === "string") : [];
  if (!uris.length || uris.length > 5) return json({ error: "invalid_redirect_uri" }, 400);
  for (const uri of uris) {
    let parsed;
    try {
      parsed = new URL(uri);
    } catch {
      return json({ error: "invalid_redirect_uri", error_description: uri }, 400);
    }
    const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
      return json({ error: "invalid_redirect_uri", error_description: uri }, 400);
    }
  }

  const clientId = randomToken("egxc_");
  const name = clean(data.client_name, 60) || "MCP client";
  await env.DB
    .prepare("INSERT INTO oauth_clients (id, name, redirect_uris) VALUES (?, ?, ?)")
    .bind(clientId, name, JSON.stringify(uris))
    .run();

  return json(
    {
      client_id: clientId,
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: OAUTH_SCOPES.join(" "),
    },
    201
  );
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function authorizePage(params, client, error) {
  const host = (() => {
    try {
      return new URL(params.redirect_uri).host || params.redirect_uri;
    } catch {
      return params.redirect_uri || "";
    }
  })();
  const hidden = Object.entries({
    response_type: params.response_type || "code",
    client_id: params.client_id || "",
    redirect_uri: params.redirect_uri || "",
    state: params.state || "",
    code_challenge: params.code_challenge || "",
    code_challenge_method: params.code_challenge_method || "S256",
    scope: params.scope || "",
    resource: params.resource || "",
  })
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}">`)
    .join("");

  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تفويض وكيل · Egytronic</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0a0a0a;
    color:#f4f4f4; font-family:"Cairo","Segoe UI",system-ui,sans-serif; padding:24px }
  .card { width:min(560px,100%); border:2px solid #262626; background:#101010; padding:28px }
  .brand { font-family:ui-monospace,monospace; letter-spacing:.18em; color:#ff6b1a; font-size:13px; margin-bottom:18px }
  h1 { font-size:20px; margin:0 0 10px }
  p { color:#9a9a9a; font-size:14px; line-height:1.9; margin:0 0 16px }
  dl { display:grid; grid-template-columns:auto 1fr; gap:8px 14px; font-size:13px; margin:0 0 18px;
    border:1px solid #232323; padding:14px; background:#0d0d0d }
  dt { color:#7d7d7d } dd { margin:0; color:#e8e8e8; word-break:break-all }
  label { display:block; font-size:13px; color:#9a9a9a; margin-bottom:8px }
  input[type=password] { width:100%; box-sizing:border-box; background:#0a0a0a; border:2px solid #2b2b2b;
    color:#f4f4f4; padding:12px 14px; font-family:ui-monospace,monospace; font-size:13px; direction:ltr }
  input[type=password]:focus { outline:2px solid #ff6b1a; outline-offset:1px }
  .row { display:flex; gap:10px; margin-top:18px }
  button { flex:1; padding:13px 16px; font-family:inherit; font-size:14px; cursor:pointer; border:2px solid }
  .ok { background:#ff6b1a; border-color:#ff6b1a; color:#0a0a0a; font-weight:700 }
  .no { background:transparent; border-color:#333; color:#bdbdbd }
  .err { border-color:#7f2a2a; background:#1a0d0d; color:#ff9b9b; padding:10px 12px; font-size:13px; margin-bottom:14px }
  .note { font-size:12px; color:#6f6f6f; margin-top:16px; line-height:1.8 }
</style>
<div class="card">
  <div class="brand">EGYTRONIC · AUTHORIZE</div>
  <h1>وكيل بيطلب يدخل على غرفة العمليات</h1>
  <p>لو انت اللي فتحت ده من برنامج بتثق فيه، ادخل رمز المالك ووافق. الرمز مش بيتخزن عند الوكيل — بياخد توكن مؤقت بدلًا منه.</p>
  ${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
  <dl>
    <dt>الوكيل</dt><dd>${escapeHtml(client?.name || params.client_id || "—")}</dd>
    <dt>هيرجع لـ</dt><dd dir="ltr">${escapeHtml(host)}</dd>
    <dt>الصلاحيات</dt><dd dir="ltr">${escapeHtml(normalizeScopes(params.scope))}</dd>
  </dl>
  <form method="post" action="/authorize">
    ${hidden}
    <label for="owner_token">رمز المالك (المفتاح اللي بتدخل بيه الكونسول)</label>
    <input id="owner_token" name="owner_token" type="password" autocomplete="current-password" required autofocus>
    <div class="row">
      <button class="ok" type="submit" name="decision" value="allow">موافق، ادخّله</button>
      <button class="no" type="submit" name="decision" value="deny">لأ، ارجعه</button>
    </div>
  </form>
  <p class="note">التوكن بيخلص بعد ساعة، والتجديد بيتم بتوكن تحديث لمدة ٣٠ يوم. تقدر تلغي أي جلسة من الكونسول.</p>
</div></html>`;
}

async function authorize(request, env, url) {
  if (!env.DB) return json({ error: "server_error" }, 500);
  const params = request.method === "POST" ? await requestParams(request) : Object.fromEntries(url.searchParams);
  const client = params.client_id
    ? await env.DB.prepare("SELECT * FROM oauth_clients WHERE id = ?").bind(params.client_id).first()
    : null;
  const page = (error, status = 200) =>
    new Response(authorizePage(params, client, error), {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });

  if (!client) return page("العميل ده مش مسجل عندنا — لازم يعمل register الأول.", 400);
  let redirects = [];
  try {
    redirects = JSON.parse(client.redirect_uris || "[]");
  } catch {
    redirects = [];
  }
  if (!redirects.includes(params.redirect_uri)) return page("عنوان الرجوع مش مطابق للمسجل.", 400);
  if (params.response_type && params.response_type !== "code") return page("نوع الاستجابة لازم يكون code.", 400);
  if (!params.code_challenge || (params.code_challenge_method || "S256") !== "S256")
    return page("PKCE مطلوب بـ S256.", 400);

  const back = (extra) => {
    const target = new URL(params.redirect_uri);
    for (const [key, value] of Object.entries(extra)) if (value) target.searchParams.set(key, value);
    if (params.state) target.searchParams.set("state", params.state);
    return Response.redirect(target.toString(), 302);
  };

  if (request.method !== "POST") return page("");
  if (params.decision !== "allow") return back({ error: "access_denied" });

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const attempt = authFails.get(ip);
  if (attempt && attempt.count >= 8 && Date.now() - attempt.at < 15 * 60 * 1000) {
    return page("محاولات كتير غلط. استنى ربع ساعة وجرب تاني.", 429);
  }

  const digest = await sha256(String(params.owner_token || "").trim());
  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (!stored || stored.value !== digest) {
    authFails.set(ip, { count: (attempt?.count || 0) + 1, at: Date.now() });
    return page("رمز المالك غلط.", 403);
  }
  authFails.delete(ip);

  const code = randomToken("egxcode_");
  await env.DB
    .prepare(
      `INSERT INTO oauth_codes (code_sha256, client_id, redirect_uri, code_challenge, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+${CODE_TTL} seconds'))`
    )
    .bind(
      await sha256(code),
      client.id,
      params.redirect_uri,
      params.code_challenge,
      normalizeScopes(params.scope),
      params.resource || ""
    )
    .run();
  await emit(env, "oauth.authorized", "client", client.id, client.name, { scope: normalizeScopes(params.scope) });

  return back({ code });
}

async function issueTokens(env, clientId, scope) {
  const access = randomToken("egx_at_");
  const refresh = randomToken("egx_rt_");
  await env.DB
    .prepare(
      `INSERT INTO oauth_tokens (token_sha256, kind, client_id, scope, expires_at)
       VALUES (?, 'access', ?, ?, datetime('now', '+${ACCESS_TTL} seconds')),
              (?, 'refresh', ?, ?, datetime('now', '+${REFRESH_TTL} seconds'))`
    )
    .bind(await sha256(access), clientId, scope, await sha256(refresh), clientId, scope)
    .run();
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refresh,
    scope,
  };
}

async function token(request, env) {
  if (!env.DB) return json({ error: "server_error" }, 500);
  if (request.method !== "POST") return json({ error: "invalid_request" }, 405);
  const params = await requestParams(request);
  const fail = (error, description) => json({ error, error_description: description }, 400);

  if (params.grant_type === "authorization_code") {
    if (!params.code || !params.code_verifier) return fail("invalid_request", "code and code_verifier are required");
    if (params.client_id && !String(params.client_id).startsWith("egxc_")) return fail("invalid_client", "unknown client");

    const row = await env.DB
      .prepare("SELECT * FROM oauth_codes WHERE code_sha256 = ?")
      .bind(await sha256(params.code))
      .first();
    if (!row || row.used) return fail("invalid_grant", "code is unknown or already used");
    if (row.client_id !== params.client_id) return fail("invalid_grant", "code belongs to another client");
    if (params.redirect_uri && row.redirect_uri !== params.redirect_uri) return fail("invalid_grant", "redirect_uri mismatch");

    const expired = await env.DB
      .prepare("SELECT 1 AS gone FROM oauth_codes WHERE code_sha256 = ? AND expires_at <= datetime('now')")
      .bind(await sha256(params.code))
      .first();
    if (expired) return fail("invalid_grant", "code expired");

    if ((await s256(params.code_verifier)) !== row.code_challenge) return fail("invalid_grant", "PKCE verification failed");

    await env.DB.prepare("UPDATE oauth_codes SET used = 1 WHERE code_sha256 = ?").bind(row.code_sha256).run();
    return json(await issueTokens(env, row.client_id, row.scope || "read write"));
  }

  if (params.grant_type === "refresh_token") {
    if (!params.refresh_token) return fail("invalid_request", "refresh_token is required");
    const row = await env.DB
      .prepare(
        "SELECT * FROM oauth_tokens WHERE token_sha256 = ? AND kind = 'refresh' AND revoked = 0 AND expires_at > datetime('now')"
      )
      .bind(await sha256(params.refresh_token))
      .first();
    if (!row) return fail("invalid_grant", "refresh token is unknown, revoked or expired");

    await env.DB.prepare("UPDATE oauth_tokens SET revoked = 1 WHERE token_sha256 = ?").bind(row.token_sha256).run();
    // refresh keeps the original grant; asking for more scope than you have is refused, not widened
    const asked = normalizeScopes(params.scope).split(" ");
    const held = String(row.scope || "read").split(" ");
    const scope = asked.every((s) => held.includes(s)) ? asked.join(" ") : held.join(" ");
    return json(await issueTokens(env, row.client_id, scope));
  }

  return fail("unsupported_grant_type", "use authorization_code or refresh_token");
}

// a session is one client's grant: cutting it kills every access and refresh token it holds
async function revokeSession(env, clientId, who) {
  const client = await env.DB.prepare("SELECT id, name FROM oauth_clients WHERE id = ?").bind(clientId).first();
  if (!client) return json({ ok: false, code: "missing" }, 404);
  const res = await env.DB.prepare("UPDATE oauth_tokens SET revoked = 1 WHERE client_id = ? AND revoked = 0")
    .bind(clientId)
    .run();
  await emit(env, "oauth.revoked", "client", clientId, who?.name || "yousef", { tokens: res.meta?.changes ?? 0 });
  return json({ ok: true, revoked: res.meta?.changes ?? 0 });
}


// ── events: the feed an external agent polls ─────────────────────────

async function emit(env, kind, entity, entityId, actor, payload) {
  await env.DB
    .prepare("INSERT INTO events (kind, entity, entity_id, actor, payload) VALUES (?, ?, ?, ?, ?)")
    .bind(kind, entity, entityId ?? null, actor || "system", payload ? JSON.stringify(payload) : null)
    .run();
  // event automations subscribe to this bus; the query returns nothing when none match
  await dispatchEvent(env, kind, payload || {}, actor || "system");
}

// every lead should land somewhere a human reads; the channel is created on demand
async function inboxChannel(env) {
  await ensureChannels(env);
  return (await env.DB.prepare("SELECT id FROM channels WHERE slug = 'inbox'").first())?.id ?? null;
}

async function noteInbox(env, inquiry) {
  const channelId = await inboxChannel(env);
  if (!channelId || !inquiry?.id) return;
  await env.DB
    .prepare("INSERT INTO messages (channel_id, author, kind, body, meta) VALUES (?, 'portal', 'system', ?, ?)")
    .bind(
      channelId,
      `${inquiry.name || "زائر"} — ${String(inquiry.message || inquiry.phone || "بدون تفاصيل").slice(0, 400)}`,
      JSON.stringify({ inquiry_id: inquiry.id, email: inquiry.email, phone: inquiry.phone, package: inquiry.package }),
    )
    .run();
}

// ── public: contact portal ───────────────────────────────────────────

async function contact(request, env) {
  if (!env.DB) return json({ ok: false, code: "no-store" }, 503);
  const payload = await body(request);

  if (clean(payload.website, 40)) return json({ ok: true }); // honeypot

  const name = clean(payload.name, 80);
  const email = clean(payload.email, 120);
  const phone = clean(payload.phone, 32);
  const message = text(payload.message, 2000).trim();
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

  const inserted = await env.DB
    .prepare(
      "INSERT INTO inquiries (name, email, phone, package, message, ip_hash, source) VALUES (?, ?, ?, ?, ?, ?, 'portal') RETURNING id"
    )
    .bind(name, email, phone || null, PACKAGES.has(wanted) ? wanted : null, message, ipHash)
    .first();

  await noteInbox(env, { id: inserted?.id, name, email, phone, message, package: wanted });

  await emit(env, "inquiry.created", "inquiry", inserted?.id, "portal", { name, email, package: wanted });
  return json({ ok: true, id: inserted?.id ?? null });
}

/* Public, read-only package catalogue for agents and integrations. */
async function catalog(request, env, url) {
  const asset = await env.ASSETS.fetch(new Request(new URL("/pricing.json", url), { method: "GET" }));
  if (!asset.ok) return json({ ok: false, code: "catalog-missing" }, 503);
  const body = await asset.text();
  const res = new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
  return res;
}

async function health(env) {
  if (!env.DB) return json({ ok: false, db: false });
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries").first();
  return json({ ok: true, db: true, inquiries: row?.n ?? 0 });
}

// ── console: inquiries ───────────────────────────────────────────────

async function listInquiries(env, url) {
  const status = clean(url.searchParams.get("status"), 16);
  const q = clean(url.searchParams.get("q"), 60);
  const limit = Math.min(int(url.searchParams.get("limit"), 100), 300);

  if (status && INQUIRY_STATUS.has(status)) {
    const { results } = await env.DB
      .prepare("SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC LIMIT ?")
      .bind(status, limit)
      .all();
    return json({ ok: true, rows: results });
  }
  if (q) {
    const like = `%${q}%`;
    const { results } = await env.DB
      .prepare("SELECT * FROM inquiries WHERE name LIKE ? OR email LIKE ? OR message LIKE ? ORDER BY id DESC LIMIT ?")
      .bind(like, like, like, limit)
      .all();
    return json({ ok: true, rows: results });
  }
  const { results } = await env.DB.prepare("SELECT * FROM inquiries ORDER BY id DESC LIMIT ?").bind(limit).all();
  return json({ ok: true, rows: results });
}

async function createInquiry(env, payload, who) {
  const name = clean(payload.name, 80);
  const email = clean(payload.email, 120);
  const phone = clean(payload.phone, 40);
  const message = clean(payload.message, 4000);
  if (!name) return json({ ok: false, code: "name" }, 400);
  if (!email && !phone && !message) return json({ ok: false, code: "detail" }, 400);

  const row = await env.DB
    .prepare("INSERT INTO inquiries (name, email, phone, package, message, source, status) VALUES (?, ?, ?, ?, ?, 'manual', 'new') RETURNING *")
    .bind(name, email, phone, clean(payload.package, 24), message)
    .first();
  await emit(env, "inquiry.created", "inquiry", row.id, who?.name || "manual", { name });
  await noteInbox(env, row);
  return json({ ok: true, row });
}

async function patchInquiry(env, id, payload, who) {
  const sets = [];
  const values = [];
  if (payload.status && INQUIRY_STATUS.has(payload.status)) {
    sets.push("status = ?");
    values.push(payload.status);
  }
  if (payload.notes !== undefined) {
    sets.push("notes = ?");
    values.push(text(payload.notes, 4000));
  }
  if (payload.assigned_to !== undefined) {
    sets.push("assigned_to = ?");
    values.push(clean(payload.assigned_to, 60) || null);
  }
  if (payload.value !== undefined) {
    sets.push("value = ?");
    values.push(int(payload.value, null));
  }
  if (payload.next_action_at !== undefined) {
    sets.push("next_action_at = ?");
    values.push(clean(payload.next_action_at, 32) || null);
  }
  if (payload.lost_reason !== undefined) {
    sets.push("lost_reason = ?");
    values.push(clean(payload.lost_reason, 200) || null);
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);

  sets.push("updated_at = datetime('now')");
  await env.DB.prepare(`UPDATE inquiries SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  if (payload.status) {
    await act(env, "inquiry", id, "stage", `نُقل الطلب إلى مرحلة «${STAGE_AR[payload.status] || payload.status}».`, who.name);
  }
  await emit(env, "inquiry.updated", "inquiry", id, who.name, payload);
  return json({ ok: true, row: await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(id).first() });
}

async function convertInquiry(env, id, payload, who) {
  const inquiry = await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(id).first();
  if (!inquiry) return json({ ok: false, code: "missing" }, 404);

  const client = await env.DB
    .prepare("INSERT INTO clients (name, email, phone, status, value, source) VALUES (?, ?, ?, 'active', ?, ?) RETURNING id")
    .bind(
      inquiry.name,
      inquiry.email,
      inquiry.phone,
      int(payload.value, null) ?? inquiry.value ?? null,
      inquiry.source ? `lead:${inquiry.source}` : "lead"
    )
    .first();

  const project = await env.DB
    .prepare("INSERT INTO projects (client_id, title, package, status) VALUES (?, ?, ?, 'planned') RETURNING id")
    .bind(client.id, clean(payload.title, 120) || `مشروع ${inquiry.name}`, inquiry.package)
    .first();

  const task = await env.DB
    .prepare(
      "INSERT INTO tasks (title, detail, status, priority, client_id, project_id, inquiry_id, source) VALUES (?, ?, 'todo', 1, ?, ?, ?, ?) RETURNING id"
    )
    .bind(`رد على ${inquiry.name}`, inquiry.message.slice(0, 500), client.id, project.id, inquiry.id, `inquiry:${inquiry.id}`)
    .first();

  await env.DB.prepare("UPDATE inquiries SET status = 'won', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  await emit(env, "inquiry.won", "inquiry", id, who.name, {
    client_id: client.id,
    project_id: project.id,
    task_id: task.id,
  });
  return json({ ok: true, client_id: client.id, project_id: project.id, task_id: task.id });
}

// ── console: clients & projects ──────────────────────────────────────

async function listClients(env, url) {
  const status = clean(url.searchParams.get("status"), 16);
  const stmt =
    status && CLIENT_STATUS.has(status)
      ? env.DB.prepare("SELECT * FROM clients WHERE status = ? ORDER BY id DESC").bind(status)
      : env.DB.prepare("SELECT * FROM clients ORDER BY id DESC");
  const { results } = await stmt.all();
  return json({ ok: true, rows: results });
}

async function createClient(env, payload, who) {
  const name = clean(payload.name, 80);
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  const row = await env.DB
    .prepare("INSERT INTO clients (name, email, phone, company, status, value, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *")
    .bind(
      name,
      clean(payload.email, 120) || null,
      clean(payload.phone, 32) || null,
      clean(payload.company, 80) || null,
      CLIENT_STATUS.has(payload.status) ? payload.status : "lead",
      int(payload.value, null),
      text(payload.notes, 2000) || null
    )
    .first();
  await emit(env, "client.created", "client", row.id, who.name, { name });
  return json({ ok: true, row });
}

async function patchClient(env, id, payload, who) {
  const sets = [];
  const values = [];
  if (payload.status && CLIENT_STATUS.has(payload.status)) {
    sets.push("status = ?");
    values.push(payload.status);
  }
  for (const key of ["name", "email", "phone", "company", "notes"]) {
    if (payload[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(clean(payload[key], key === "notes" ? 2000 : 120) || null);
    }
  }
  if (payload.value !== undefined) {
    sets.push("value = ?");
    values.push(int(payload.value, null));
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  await emit(env, "client.updated", "client", id, who.name, payload);
  return json({ ok: true, row: await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first() });
}

async function listProjects(env, url) {
  const clientId = int(url.searchParams.get("client_id"), null);
  const stmt = clientId
    ? env.DB.prepare("SELECT * FROM projects WHERE client_id = ? ORDER BY id DESC").bind(clientId)
    : env.DB.prepare("SELECT * FROM projects ORDER BY id DESC");
  const { results } = await stmt.all();
  return json({ ok: true, rows: results });
}

async function createProject(env, payload, who) {
  const title = clean(payload.title, 120);
  if (!title) return json({ ok: false, code: "title" }, 400);
  const row = await env.DB
    .prepare("INSERT INTO projects (client_id, title, package, status, due_at, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *")
    .bind(
      int(payload.client_id, null),
      title,
      PACKAGES.has(payload.package) ? payload.package : null,
      PROJECT_STATUS.has(payload.status) ? payload.status : "planned",
      clean(payload.due_at, 32) || null,
      text(payload.notes, 2000) || null
    )
    .first();
  await emit(env, "project.created", "project", row.id, who.name, { title });
  return json({ ok: true, row });
}

async function patchProject(env, id, payload, who) {
  const sets = [];

  const values = [];
  if (payload.status && PROJECT_STATUS.has(payload.status)) {
    sets.push("status = ?");
    values.push(payload.status);
  }
  for (const key of ["title", "notes", "due_at"]) {
    if (payload[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(key === "notes" ? text(payload[key], 2000) : clean(payload[key], 120) || null);
    }
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  await emit(env, "project.updated", "project", id, who.name, payload);
  return json({ ok: true, row: await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first() });
}

// ── console: channels & messages ─────────────────────────────────────

async function ensureChannels(env) {
  await env.DB
    .prepare("INSERT OR IGNORE INTO channels (slug, topic, kind) VALUES ('inbox', 'طلبات الموقع والرسائل', 'team'), ('agents', 'شغل الوكلاء', 'agent')")
    .run();
}

const CHANNEL_COLUMNS = `c.*, (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messages,
       (SELECT MAX(id) FROM messages m WHERE m.channel_id = c.id) AS last_message,
       (SELECT body FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
       (SELECT author FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_author`;

const channelOpen = (who) => !who?.member_role || allow(who, "channels.post");

async function listChannels(env, who) {
  await ensureChannels(env);
  const memberId = who?.member_role ? who.id : null;
  const scope = channelOpen(who) ? "" : "WHERE cm.member_id IS NOT NULL OR c.kind = 'team'";
  const { results } = await env.DB
    .prepare(
      `SELECT ${CHANNEL_COLUMNS}, cm.last_read_id,
              (SELECT COUNT(*) FROM messages m
                WHERE m.channel_id = c.id AND m.id > COALESCE(cm.last_read_id, 0)
                  AND (m.member_id IS NULL OR m.member_id != ?)) AS unread
         FROM channels c
         LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.member_id = ?
        ${scope}
        ORDER BY c.id`
    )
    .bind(memberId ?? -1, memberId ?? -1)
    .all();
  return json({ ok: true, rows: results });
}

async function channelAccess(env, channel, who) {
  if (channelOpen(who)) return true;
  if (channel.kind === "team") return true;
  const row = await env.DB
    .prepare("SELECT 1 AS ok FROM channel_members WHERE channel_id = ? AND member_id = ?")
    .bind(channel.id, who.id)
    .first();
  return Boolean(row);
}

async function createChannel(env, payload, who) {
  const slug = clean(payload.slug, 40)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length < 2) return json({ ok: false, code: "slug" }, 400);
  const exists = await env.DB.prepare("SELECT id FROM channels WHERE slug = ?").bind(slug).first();
  if (exists) return json({ ok: false, code: "exists" }, 409);
  const row = await env.DB
    .prepare("INSERT INTO channels (slug, topic, kind) VALUES (?, ?, ?) RETURNING *")
    .bind(slug, clean(payload.topic, 160) || null, ["team", "client", "agent"].includes(payload.kind) ? payload.kind : "team")
    .first();
  await emit(env, "channel.created", "channel", row.id, who.name, { slug });
  return json({ ok: true, row });
}

async function channelByAny(env, key) {
  if (!key) return null;
  return env.DB
    .prepare("SELECT * FROM channels WHERE slug = ? OR id = ?")
    .bind(String(key), int(key, -1))
    .first();
}

async function listMessages(env, channel, url, who) {
  if (who && !(await channelAccess(env, channel, who))) return json({ ok: false, code: "forbidden" }, 403);
  const after = int(url.searchParams.get("after"), 0);
  const limit = Math.min(int(url.searchParams.get("limit"), 100), 200);
  // no cursor = open the channel at its newest messages; a cursor = poll what came after
  const { results } = after
    ? await env.DB
        .prepare("SELECT * FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?")
        .bind(channel.id, after, limit)
        .all()
    : await env.DB
        .prepare("SELECT * FROM (SELECT * FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC")
        .bind(channel.id, limit)
        .all();
  return json({ ok: true, channel: { id: channel.id, slug: channel.slug, topic: channel.topic }, rows: results });
}

async function postMessage(env, channel, payload, who) {
  const message = text(payload.body, 4000).trim();
  if (!message) return json({ ok: false, code: "body" }, 400);
  if (!(await channelAccess(env, channel, who))) return json({ ok: false, code: "forbidden" }, 403);
  const author = who.member_role ? who.name : clean(payload.author, 60) || who.name || "yousef";
  const kind = who.role === "agent" ? "agent" : payload.kind === "system" ? "system" : "human";
  const row = await env.DB
    .prepare("INSERT INTO messages (channel_id, author, kind, body, meta, member_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *")
    .bind(channel.id, author, kind, message, payload.meta ? JSON.stringify(payload.meta) : null, who.member_role ? who.id : null)
    .first();
  await emit(env, "message.posted", "channel", channel.id, author, { message_id: row.id });
  return json({ ok: true, row });
}

// ── console: tasks & pomodoro ────────────────────────────────────────

async function listTasks(env, url, who) {
  const status = clean(url.searchParams.get("status"), 12);
  const mine = who?.member_role && !allow(who, "tasks.all");
  const filters = [];
  const values = [];
  if (status && TASK_STATUS.has(status)) {
    filters.push("status = ?");
    values.push(status);
  }
  if (mine) {
    filters.push("(assignee_member_id = ? OR (assignee_member_id IS NULL AND assignee = ?))");
    values.push(who.id, who.name);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const { results } = await env.DB
    .prepare(`SELECT * FROM tasks ${where} ORDER BY status = 'done', priority ASC, id DESC`)
    .bind(...values)
    .all();
  return json({ ok: true, rows: results, scope: mine ? "mine" : "all" });
}

async function createTask(env, payload, who) {
  const title = clean(payload.title, 160);
  if (title.length < 2) return json({ ok: false, code: "title" }, 400);
  // members without tasks.all can only put work on their own plate
  const selfOnly = who?.member_role && !allow(who, "tasks.all");
  if (selfOnly) {
    payload.assignee_member_id = who.id;
    payload.assignee = who.name;
  }
  const row = await env.DB
    .prepare(
      "INSERT INTO tasks (title, detail, status, priority, client_id, project_id, channel_id, inquiry_id, assignee, due_at, estimate_minutes, source, assignee_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(
      title,
      text(payload.detail, 4000) || null,
      TASK_STATUS.has(payload.status) ? payload.status : "todo",
      Math.min(Math.max(int(payload.priority, 2), 1), 3),
      int(payload.client_id, null),
      int(payload.project_id, null),
      int(payload.channel_id, null),
      int(payload.inquiry_id, null),
      clean(payload.assignee, 60) || null,
      clean(payload.due_at, 32) || null,
      int(payload.estimate_minutes, null),
      who.role === "agent" ? `agent:${who.id}` : "human",
      int(payload.assignee_member_id, null)
    )
    .first();
  await emit(env, "task.created", "task", row.id, who.name, { title: row.title });
  return json({ ok: true, row });
}

async function patchTask(env, id, payload, who) {
  const existing = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, code: "missing" }, 404);
  const assignedToMe =
    existing.assignee_member_id === who?.id || (!existing.assignee_member_id && existing.assignee === who?.name);
  const unassigned = !existing.assignee_member_id && !existing.assignee;

  if (payload.claim === true && unassigned) {
    await env.DB
      .prepare("UPDATE tasks SET assignee_member_id = ?, assignee = ? WHERE id = ?")
      .bind(who.id, who.name, id)
      .run();
    return json({ ok: true, row: await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first() });
  }

  // "tasks.manage" means manage your own work; only "tasks.all" reaches across the board.
  if (who?.member_role && !allow(who, "tasks.all") && !assignedToMe) {
    return json({ ok: false, code: "forbidden" }, 403);
  }
  const sets = [];
  const values = [];
  if (payload.status && TASK_STATUS.has(payload.status)) {
    sets.push("status = ?");
    values.push(payload.status);
    if (payload.status === "done") sets.push("done_at = datetime('now')");
  }
  if (payload.title !== undefined) {
    sets.push("title = ?");
    values.push(clean(payload.title, 160));
  }
  if (payload.detail !== undefined) {
    sets.push("detail = ?");
    values.push(text(payload.detail, 4000) || null);
  }
  if (payload.priority !== undefined) {
    sets.push("priority = ?");
    values.push(Math.min(Math.max(int(payload.priority, 2), 1), 3));
  }
  if (payload.assignee !== undefined) {
    sets.push("assignee = ?");
    values.push(clean(payload.assignee, 60) || null);
  }
  if (payload.assignee_member_id !== undefined) {
    const target = int(payload.assignee_member_id, null);
    const member = target ? await env.DB.prepare("SELECT id, name FROM members WHERE id = ?").bind(target).first() : null;
    sets.push("assignee_member_id = ?", "assignee = ?");
    values.push(member?.id ?? null, member?.name ?? null);
  }
  if (payload.due_at !== undefined) {
    sets.push("due_at = ?");
    values.push(clean(payload.due_at, 32) || null);
  }
  if (payload.estimate_minutes !== undefined) {
    sets.push("estimate_minutes = ?");
    values.push(int(payload.estimate_minutes, null));
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  await emit(env, "task.updated", "task", id, who.name, payload);
  return json({ ok: true, row: await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first() });
}

async function logPomodoro(env, payload, who) {
  const minutes = Math.min(Math.max(int(payload.minutes, 25), 1), 180);
  const taskId = int(payload.task_id, null);
  const row = await env.DB
    .prepare("INSERT INTO time_entries (task_id, minutes, label, source) VALUES (?, ?, ?, ?) RETURNING *")
    .bind(taskId, minutes, clean(payload.label, 120) || null, who.role === "agent" ? `agent:${who.id}` : "human")
    .first();
  await emit(env, "time.logged", "task", taskId, who.name, { minutes });
  return json({ ok: true, row });
}

async function todayStats(env) {
  const row = await env.DB
    .prepare(
      `SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions FROM time_entries
       WHERE created_at >= datetime('now', 'start of day')`
    )
    .first();
  return json({ ok: true, minutes: row?.minutes ?? 0, sessions: row?.sessions ?? 0 });
}

// ── console: agents ──────────────────────────────────────────────────

async function listAgents(env) {
  const { results } = await env.DB
    .prepare("SELECT id, created_at, name, model, scopes, active, last_seen, notes FROM agents ORDER BY id")
    .all();
  return json({ ok: true, rows: results });
}

async function createAgent(env, payload, who) {
  if (who.role !== "admin" && !can(who, "admin")) return json({ ok: false, code: "forbidden" }, 403);
  const name = clean(payload.name, 60);
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);

  const scopes = String(payload.scopes || "read")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ["read", "write", "admin"].includes(s));
  if (!scopes.length) scopes.push("read");

  const key = `egx_agent_${crypto.randomUUID().replace(/-/g, "")}`;
  const row = await env.DB
    .prepare("INSERT INTO agents (name, model, key_sha256, scopes, notes) VALUES (?, ?, ?, ?, ?) RETURNING id, name, scopes")
    .bind(name, clean(payload.model, 60) || null, await sha256(key), scopes.join(","), text(payload.notes, 1000) || null)
    .first();

  await emit(env, "agent.created", "agent", row.id, who.name, { name, scopes: scopes.join(",") });
  // the key is returned once, never stored in clear text
  return json({ ok: true, row: { ...row, key } });
}

async function patchAgent(env, id, payload, who) {
  if (who.role !== "admin" && !can(who, "admin")) return json({ ok: false, code: "forbidden" }, 403);
  const sets = [];
  const values = [];
  if (payload.active !== undefined) {
    sets.push("active = ?");
    values.push(payload.active ? 1 : 0);
  }
  if (payload.name !== undefined) {
    sets.push("name = ?");
    values.push(clean(payload.name, 60));
  }
  if (payload.model !== undefined) {
    sets.push("model = ?");
    values.push(clean(payload.model, 60) || null);
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  return json({ ok: true });
}

// ── events & context ─────────────────────────────────────────────────

async function listEvents(env, url) {
  const after = int(url.searchParams.get("after"), 0);
  const limit = Math.min(int(url.searchParams.get("limit"), 50), 200);
  const { results } = await env.DB
    .prepare("SELECT * FROM events WHERE id > ? ORDER BY id DESC LIMIT ?")
    .bind(after, limit)
    .all();
  return json({ ok: true, rows: results });
}

// Everything a model needs to act, in one call: fresh leads, open work, recent talk.
async function agentContext(env, url) {
  const since = int(url.searchParams.get("after_event"), 0);
  const [inquiries, tasks, channels, events, messages, stats] = await Promise.all([
    env.DB
      .prepare("SELECT id, created_at, name, email, phone, package, message, status FROM inquiries WHERE status = 'new' ORDER BY id DESC LIMIT 20")
      .all(),
    env.DB
      .prepare("SELECT id, title, detail, status, priority, due_at FROM tasks WHERE status != 'done' ORDER BY priority ASC, id DESC LIMIT 20")
      .all(),
    env.DB.prepare("SELECT id, slug, topic FROM channels ORDER BY id").all(),
    env.DB
      .prepare("SELECT id, created_at, kind, entity, entity_id, actor, payload FROM events WHERE id > ? ORDER BY id DESC LIMIT 30")
      .bind(since)
      .all(),
    env.DB
      .prepare("SELECT m.id, m.created_at, c.slug, m.author, m.kind, m.body FROM messages m JOIN channels c ON c.id = m.channel_id ORDER BY m.id DESC LIMIT 25")
      .all(),
    env.DB.prepare("SELECT COALESCE(SUM(minutes),0) AS minutes FROM time_entries WHERE created_at >= datetime('now','start of day')").first(),
  ]);

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    instructions:
      "You are an operations agent for Egytronic. Read the queues below, then act through the API " +
      "(/api/tasks, /api/inquiries/:id, /api/channels/:slug/messages) or the MCP endpoint /mcp. " +
      "Never invent prices: logo 5,000 · landing 6,000 · static 8,000 · identity 10,000 · dynamic from 18,000 EGP, 50% upfront.",
    new_inquiries: inquiries.results,
    open_tasks: tasks.results,
    channels: channels.results,
    recent_messages: messages.results,
    events_since_last_run: events.results,
    minutes_today: stats?.minutes ?? 0,
  });
}

// ── MCP over HTTP (JSON-RPC 2.0) ─────────────────────────────────────
// Stateless streamable-HTTP subset: POST one JSON-RPC message, get JSON back.
// The tools are the same operations the console uses, so an agent sees exactly
// what the owner sees — no second, drifting API.

const MCP_TOOLS = [
  {
    name: "overview",
    description: "Dashboard counts: new leads, open tasks, minutes focused today, active agents.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_inquiries",
    description: "List contact-form submissions. status: new | contacted | quoted | won | lost.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" }, q: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "update_inquiry",
    description: "Set an inquiry's status, notes or assignee.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, status: { type: "string" }, notes: { type: "string" }, assigned_to: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "create_inquiry",
    description: "Log a lead that arrived by phone or WhatsApp, so it is not lost.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        package: { type: "string" },
        message: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "convert_inquiry",
    description: "Turn a lead into client + project + first task, and mark the inquiry won.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, title: { type: "string" }, value: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "list_tasks",
    description: "List tasks. status: todo | doing | done.",
    inputSchema: { type: "object", properties: { status: { type: "string" } } },
  },
  {
    name: "create_task",
    description: "Create a task. priority 1 is high, 2 normal, 3 low.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, detail: { type: "string" }, priority: { type: "number" }, due_at: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Move a task between todo/doing/done, or edit its title.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, status: { type: "string" }, title: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "log_focus",
    description: "Log a pomodoro session in minutes, optionally against a task.",
    inputSchema: { type: "object", properties: { task_id: { type: "number" }, minutes: { type: "number" }, label: { type: "string" } } },
  },
  {
    name: "list_channels",
    description: "List workspace channels with message counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "read_channel",
    description: "Read messages from a channel by slug (or id).",
    inputSchema: {
      type: "object",
      properties: { channel: { type: "string" }, after: { type: "number" }, limit: { type: "number" } },
      required: ["channel"],
    },
  },
  {
    name: "post_message",
    description: "Post a message into a channel.",
    inputSchema: {
      type: "object",
      properties: { channel: { type: "string" }, body: { type: "string" }, author: { type: "string" } },
      required: ["channel", "body"],
    },
  },
  {
    name: "list_events",
    description: "Poll the activity feed: new leads, task changes, messages, time logged.",
    inputSchema: { type: "object", properties: { after: { type: "number" }, limit: { type: "number" } } },
  },
];

async function mcpCall(env, who, name, args = {}) {
  const read = () => {
    if (!can(who, "read")) throw new Error("scope");
  };
  const write = () => {
    if (!can(who, "write")) throw new Error("scope");
  };

  switch (name) {
    case "overview": {
      read();
      const [inquiries, tasks, minutes, agents] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'").first(),
        env.DB.prepare("SELECT COALESCE(SUM(minutes),0) AS n FROM time_entries WHERE created_at >= datetime('now','start of day')").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first(),
      ]);
      return {
        new_inquiries: inquiries?.n ?? 0,
        open_tasks: tasks?.n ?? 0,
        minutes_today: minutes?.n ?? 0,
        active_agents: agents?.n ?? 0,
      };
    }
    case "list_inquiries": {
      read();
      const status = clean(args.status, 16);
      const q = clean(args.q, 60);
      const limit = Math.min(int(args.limit, 50), 200);
      let rows;
      if (status && INQUIRY_STATUS.has(status)) {
        rows = await env.DB.prepare("SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC LIMIT ?").bind(status, limit).all();
      } else if (q) {
        const like = `%${q}%`;
        rows = await env.DB
          .prepare("SELECT * FROM inquiries WHERE name LIKE ? OR email LIKE ? OR message LIKE ? ORDER BY id DESC LIMIT ?")
          .bind(like, like, like, limit)
          .all();
      } else {
        rows = await env.DB.prepare("SELECT * FROM inquiries ORDER BY id DESC LIMIT ?").bind(limit).all();
      }
      return { rows: rows.results };
    }
    case "update_inquiry": {
      write();
      return (await patchInquiry(env, int(args.id), args, who)).json();
    }
    case "create_inquiry": {
      write();
      return (await createInquiry(env, args, who)).json();
    }
    case "convert_inquiry": {
      write();
      return (await convertInquiry(env, int(args.id), args, who)).json();
    }
    case "list_tasks": {
      read();
      const status = clean(args.status, 12);
      const stmt =
        status && TASK_STATUS.has(status)
          ? env.DB.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY priority ASC, id DESC").bind(status)
          : env.DB.prepare("SELECT * FROM tasks ORDER BY status = 'done', priority ASC, id DESC");
      return { rows: (await stmt.all()).results };
    }
    case "create_task": {
      write();
      return (await createTask(env, args, who)).json();
    }
    case "update_task": {
      write();
      return (await patchTask(env, int(args.id), args, who)).json();
    }
    case "log_focus": {
      write();
      return (await logPomodoro(env, args, who)).json();
    }
    case "list_channels": {
      read();
      const { results } = await env.DB
        .prepare(
          "SELECT c.id, c.slug, c.topic, c.kind, (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messages FROM channels c ORDER BY c.id"
        )
        .all();
      return { rows: results };
    }
    case "read_channel": {
      read();
      const channel = await channelByAny(env, args.channel);
      if (!channel) throw new Error("channel not found");
      const after = int(args.after, 0);
      const take = Math.min(int(args.limit, 50), 200);
      const { results } = after
        ? await env.DB
            .prepare("SELECT id, created_at, author, kind, body FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?")
            .bind(channel.id, after, take)
            .all()
        : await env.DB
            .prepare("SELECT * FROM (SELECT id, created_at, author, kind, body FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC")
            .bind(channel.id, take)
            .all();
      return { channel: channel.slug, rows: results };
    }
    case "post_message": {
      write();
      const channel = await channelByAny(env, args.channel);
      if (!channel) throw new Error("channel not found");
      return (await postMessage(env, channel, args, who)).json();
    }
    case "list_events": {
      read();
      const { results } = await env.DB
        .prepare("SELECT * FROM events WHERE id > ? ORDER BY id DESC LIMIT ?")
        .bind(int(args.after, 0), Math.min(int(args.limit, 30), 200))
        .all();
      return { rows: results };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

const mcpBrowserPage = (origin) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>نقطة MCP · Egytronic</title>
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08080A;color:#F5F1E8;
font-family:"Alexandria","Cairo",system-ui,sans-serif;padding:24px}
main{max-width:56ch;border:1px solid #22222A;border-radius:16px;padding:28px 26px;background:#111116}
h1{font-size:22px;margin:0 0 10px}
p{color:#A3A3A3;line-height:1.85;margin:0 0 14px;font-size:14.5px}
code{background:#15151b;padding:2px 6px;border-radius:6px;font-size:13px;color:#F5F1E8}
a{color:#FF6A00}
</style></head><body><main>
<h1>نقطة MCP محمية</h1>
<p>العنوان اللي فتحته هو نقطة JSON-RPC لأدوات التشغيل الداخلية، مش صفحة. الطلب من غير مفتاح وكيل بيرجع
<code>401 unauthorized</code> زي ما شفت — ده الشكل الطبيعي للرفض، ومفيش أي حاجة اتكسرت.</p>
<p>لو إنت بتبني وكيل: اعمل تسجيل عبر <a href="${origin}/.well-known/oauth-protected-resource">بيانات OAuth</a>،
وبعدها ابعت الطلبات بـ <code>Authorization: Bearer &lt;agent key&gt;</code> على نفس العنوان.</p>
<p>للعملاء: <code>POST ${origin}/mcp</code> بـ <code>Accept: application/json</code>.</p>
</main></body></html>`;

async function mcp(request, env, url) {
  const who = await identify(request, env, url);
  if (!who) {
    const accept = (request.headers.get("accept") || "").toLowerCase();
    if (request.method === "GET" && accept.includes("text/html") && !accept.includes("text/event-stream")) {
      return new Response(mcpBrowserPage(new URL(request.url).origin), {
        status: 401,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "www-authenticate": challengeHeader(request)["www-authenticate"],
        },
      });
    }
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } }, 401, challengeHeader(request));
  }

  if (request.method === "GET") {
    return json({
      name: "egytronic-ops",
      protocolVersion: "2025-06-18",
      transport: "POST JSON-RPC 2.0 to this URL with an Authorization: Bearer <agent key> header",
      tools: MCP_TOOLS.map((tool) => tool.name),
    });
  }

  const payload = await body(request);
  const batch = Array.isArray(payload) ? payload : [payload];
  const replies = [];

  for (const message of batch) {
    const id = message?.id ?? null;
    const method = message?.method;

    if (method === "initialize") {
      replies.push({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "egytronic-ops", version: "1.0.0" },
          instructions:
            "Egytronic operations server — run by Yousef Khamis, an Egyptian software studio. " +
            "What we sell: logo 5,000 · landing 6,000 · static site 8,000 · identity 10,000 · dynamic site from 18,000 EGP; " +
            "full digital transformation is quoted only after the scope is agreed, so it has no published price. " +
            "50% upfront and 50% before delivery. Management systems (ERP, CRM, POS, hotel, clinic, LMS) are installed, " +
            "customised and trained on — never claim Egytronic wrote them. " +
            "Never invent testimonials, client counts, ratings or certifications, and never publish a price that is not on this list. " +
            "Leads arrive as inquiries: create_inquiry for phone/WhatsApp leads, update_inquiry to move status, " +
            "convert_inquiry to turn a won lead into client + project + first task. Use log_focus/list_channels to keep the board honest.",
        },
      });
      continue;
    }

    if (method === "notifications/initialized" || method === "notifications/cancelled") continue;

    if (method === "ping") {
      replies.push({ jsonrpc: "2.0", id, result: {} });
      continue;
    }

    if (method === "tools/list") {
      replies.push({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
      continue;
    }

    if (method === "tools/call") {
      const name = message?.params?.name;
      const args = message?.params?.arguments || {};
      try {
        const result = await mcpCall(env, who, name, args);
        replies.push({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false },
        });
      } catch (error) {
        const reason =
          error?.message === "scope" ? "This agent key lacks the required scope." : String(error?.message || "tool failed");
        replies.push({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: reason }], isError: true } });
      }
      continue;
    }

    replies.push({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
  }

  return json(Array.isArray(payload) ? replies : replies[0] ?? { jsonrpc: "2.0", id: null, result: {} });
}

// ── token rotation ───────────────────────────────────────────────────

async function rotateToken(request, env) {
  if (!env.DB) return json({ ok: false, code: "no-store" }, 503);
  const payload = await body(request);
  const current = typeof payload.current === "string" ? payload.current : "";
  const next = typeof payload.next === "string" ? payload.next : "";
  if (next.length < 12) return json({ ok: false, code: "short" }, 400);

  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (!stored || (await sha256(current)) !== stored.value) return json({ ok: false }, 404);

  await env.DB
    .prepare("INSERT INTO settings (key, value) VALUES ('admin_token_sha256', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(await sha256(next))
    .run();

  return json({ ok: true });
}


// ── team roster ──────────────────────────────────────────────────────

const MEMBER_ROLES = new Set(["owner", "manager", "member", "contractor"]);

const STAGE_AR = { new: "جديد", contacted: "تم التواصل", qualified: "مؤهّل", proposal: "عرض سعر", won: "تم التعاقد", lost: "مفقود" };

async function act(env, entity, entityId, kind, body, actor, minutes = null) {
  await env.DB
    .prepare("INSERT INTO activities (entity, entity_id, kind, body, actor, minutes) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(entity, entityId, kind, body, actor || "system", minutes)
    .run();
}

async function listMembers(env, who) {
  const full = allow(who, "team.manage");
  const { results } = await env.DB
    .prepare(
      `SELECT m.*,
              (SELECT COUNT(*) FROM tasks t WHERE (t.assignee_member_id = m.id OR t.assignee = m.name) AND t.status != 'done') AS open_tasks,
              (SELECT COUNT(*) FROM tasks t WHERE (t.assignee_member_id = m.id OR t.assignee = m.name) AND t.status != 'done'
                 AND t.due_at IS NOT NULL AND t.due_at < datetime('now')) AS late_tasks,
              (SELECT COUNT(*) FROM inquiries i WHERE i.assigned_to = m.name
                 AND i.status NOT IN ('won','lost')) AS open_leads,
              (SELECT COALESCE(SUM(te.minutes), 0) FROM time_entries te
                 JOIN tasks t2 ON t2.id = te.task_id
                WHERE t2.assignee_member_id = m.id AND te.created_at >= datetime('now','-7 days')) AS minutes_7d
         FROM members m
        ORDER BY m.active DESC, m.id`
    )
    .all();
  const rows = results.map((row) => {
    const clean = { ...publicMember(row), has_password: Boolean(row.password_hash) };
    if (!full) {
      delete clean.email;
      delete clean.phone;
      delete clean.notes;
      delete clean.permissions;
    }
    return clean;
  });
  return json({ ok: true, rows });
}

async function memberPassword(env, id, payload, who) {
  if (!allow(who, "team.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const password = String(payload.password || "");
  if (password.length < 8) return json({ ok: false, code: "password-short" }, 400);
  const row = await env.DB.prepare("SELECT id, name FROM members WHERE id = ?").bind(id).first();
  if (!row) return json({ ok: false, code: "missing" }, 404);
  await env.DB.prepare("UPDATE members SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), id).run();
  await env.DB.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(id).run();
  await emit(env, "member.password", "member", id, who.name, { name: row.name });
  return json({ ok: true });
}

async function createMember(env, payload, who) {
  if (!allow(who, "team.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const name = clean(payload.name, 80);
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  const role = MEMBER_ROLES.has(payload.role) ? payload.role : "member";
  const email = clean(payload.email, 120).toLowerCase() || null;
  if (email) {
    const taken = await env.DB.prepare("SELECT id FROM members WHERE lower(email) = ?").bind(email).first();
    if (taken) return json({ ok: false, code: "email-taken" }, 409);
  }
  const given = String(payload.password || "");
  const password = given.length >= 8 ? given : email ? tempPassword() : "";
  const row = await env.DB
    .prepare(
      `INSERT INTO members (name, role, email, phone, focus, capacity_hours, active, notes, handle, permissions, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      name,
      role,
      email,
      clean(payload.phone, 32) || null,
      clean(payload.focus, 120) || null,
      Math.min(Math.max(int(payload.capacity_hours, 32), 1), 80),
      payload.active === 0 ? 0 : 1,
      text(payload.notes, 2000) || null,
      clean(payload.handle, 40) || email?.split("@")[0] || null,
      permList(payload.permissions, role).join(","),
      password ? await hashPassword(password) : null
    )
    .first();
  await joinTeamChannels(env, row.id);
  await emit(env, "member.created", "member", row.id, who.name, { name, role });
  return json({
    ok: true,
    row: publicMember(row),
    ...(email && given.length < 8 ? { temp_password: password } : {}),
  });
}

async function patchMember(env, id, payload, who) {
  if (!allow(who, "team.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const sets = [];
  const values = [];
  for (const key of ["name", "email", "phone", "focus", "notes"]) {
    if (payload[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(clean(payload[key], key === "notes" ? 2000 : 120) || null);
    }
  }
  if (payload.role && MEMBER_ROLES.has(payload.role)) {
    sets.push("role = ?");
    values.push(payload.role);
  }
  if (payload.permissions !== undefined) {
    sets.push("permissions = ?");
    values.push(permList(payload.permissions, "member").join(","));
  }
  if (payload.password) {
    if (String(payload.password).length < 8) return json({ ok: false, code: "password-short" }, 400);
    sets.push("password_hash = ?");
    values.push(await hashPassword(String(payload.password)));
  }
  if (payload.capacity_hours !== undefined) {
    sets.push("capacity_hours = ?");
    values.push(Math.min(Math.max(int(payload.capacity_hours, 32), 1), 80));
  }
  if (payload.active !== undefined) {
    sets.push("active = ?");
    values.push(payload.active ? 1 : 0);
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);

  await env.DB.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  if (payload.password) await env.DB.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(id).run();
  await emit(env, "member.updated", "member", id, who.name, payload);
  return json({ ok: true, row: publicMember(await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first()) });
}

async function removeMember(env, id, who) {
  if (!allow(who, "team.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const row = await env.DB.prepare("SELECT name FROM members WHERE id = ?").bind(id).first();
  if (!row) return json({ ok: false, code: "missing" }, 404);
  await env.DB.prepare("UPDATE members SET active = 0 WHERE id = ?").bind(id).run();
  await emit(env, "member.archived", "member", id, who.name, { name: row.name });
  return json({ ok: true });
}

// ── activity log (calls, notes, meetings per record) ─────────────────

async function listActivities(env, url) {
  const entity = clean(url.searchParams.get("entity"), 20);
  const entityId = int(url.searchParams.get("entity_id"), null);
  const limit = Math.min(int(url.searchParams.get("limit"), 60), 200);
  const stmt =
    entity && entityId
      ? env.DB
          .prepare("SELECT * FROM activities WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?")
          .bind(entity, entityId, limit)
      : env.DB.prepare("SELECT * FROM activities ORDER BY id DESC LIMIT ?").bind(limit);
  const { results } = await stmt.all();
  return json({ ok: true, rows: results });
}

async function createActivity(env, payload, who) {
  const entity = clean(payload.entity, 20);
  const entityId = int(payload.entity_id, null);
  const bodyText = text(payload.body, 2000).trim();
  if (!entity || !entityId || bodyText.length < 1) return json({ ok: false, code: "invalid" }, 400);
  await act(env, entity, entityId, clean(payload.kind, 16) || "note", bodyText, who.name, int(payload.minutes, null));
  await emit(env, "activity.logged", entity, entityId, who.name, { kind: payload.kind });
  return json({ ok: true });
}

// ── dashboard metrics ────────────────────────────────────────────────

async function metrics(env, who) {
  const [pipeline, clients, tasks, focus, leads7, won, total, team] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) AS n, COALESCE(SUM(value),0) AS value FROM inquiries GROUP BY status").all(),
    env.DB.prepare("SELECT status, COUNT(*) AS n, COALESCE(SUM(value),0) AS value FROM clients GROUP BY status").all(),
    env.DB
      .prepare(
        `SELECT
           SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) AS open,
           SUM(CASE WHEN status != 'done' AND due_at IS NOT NULL AND due_at < datetime('now') THEN 1 ELSE 0 END) AS late,
           SUM(CASE WHEN status != 'done' AND due_at IS NOT NULL AND date(due_at) = date('now') THEN 1 ELSE 0 END) AS today,
           SUM(CASE WHEN status = 'done' AND done_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS done_7d
         FROM tasks`
      )
      .first(),
    env.DB
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN created_at >= datetime('now','start of day') THEN minutes END), 0) AS today,
                COALESCE(SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN minutes END), 0) AS week
           FROM time_entries`
      )
      .first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE created_at >= datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(value),0) AS value FROM inquiries WHERE status = 'won'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE active = 1").first(),
  ]);

  const finance = allow(who, "finance.view");
  return json({
    ok: true,
    finance,
    pipeline: (pipeline.results || []).map((row) => (finance ? row : { ...row, value: null })),
    clients: (clients.results || []).map((row) => (finance ? row : { ...row, value: null })),
    tasks: tasks ?? {},
    focus: focus ?? {},
    leads_7d: leads7?.n ?? 0,
    won: finance ? won ?? { n: 0, value: 0 } : { n: won?.n ?? 0, value: null },
    conversion: total?.n ? Math.round(((won?.n ?? 0) / total.n) * 100) : 0,
    team: team?.n ?? 0,
  });
}

// ── accounts: login, session, personal space ────────────────────────

async function loginRequest(request, env) {
  if (!env.DB) return json({ ok: false, code: "no-store" }, 503);
  const payload = await body(request);
  const email = clean(payload.email, 160).toLowerCase();
  const password = String(payload.password || "");
  if (!email || password.length < 8) return json({ ok: false, code: "invalid" }, 400);

  const throttleKey = `login:${email}`;
  const attempt = authFails.get(throttleKey);
  if (attempt && attempt.count >= 8 && Date.now() - attempt.at < 15 * 60 * 1000) {
    return json({ ok: false, code: "throttled" }, 429);
  }

  const row = await env.DB
    .prepare("SELECT * FROM members WHERE lower(email) = ? AND active = 1")
    .bind(email)
    .first();
  const valid = row ? await checkPassword(password, row.password_hash) : false;
  if (!valid) {
    authFails.set(throttleKey, { count: (attempt?.count || 0) + 1, at: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, 350));
    return json({ ok: false, code: "invalid" }, 401);
  }
  authFails.delete(throttleKey);

  const id = randomToken("egs_");
  const maxAge = SESSION_DAYS * 86400;
  const expires = new Date(Date.now() + maxAge * 1000).toISOString().slice(0, 19).replace("T", " ");
  await env.DB
    .prepare("INSERT INTO member_sessions (id, member_id, expires_at, ua) VALUES (?, ?, ?, ?)")
    .bind(id, row.id, expires, clean(request.headers.get("user-agent"), 180) || null)
    .run();
  await env.DB.prepare("UPDATE members SET last_login_at = datetime('now') WHERE id = ?").bind(row.id).run();
  await joinTeamChannels(env, row.id);

  const who = memberWho(row);
  return json(
    { ok: true, member: { id: who.id, name: who.name, role: who.member_role, permissions: who.permissions } },
    200,
    { "set-cookie": sessionCookie(id, maxAge) }
  );
}

async function logoutRequest(request, env) {
  const id = readCookie(request, SESSION_COOKIE);
  if (id && env.DB) await env.DB.prepare("DELETE FROM member_sessions WHERE id = ?").bind(id).run();
  return json({ ok: true }, 200, { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

/* First run: the owner token sets the e-mail and password the owner will log in with. */
async function setupOwner(request, env, url) {
  const who = await identify(request, env, url);
  if (!who) return json({ ok: false, code: "unauthorized" }, 401);
  const owner = await env.DB.prepare("SELECT id FROM members WHERE role = 'owner' LIMIT 1").first();
  if (owner && !allow(who, "settings.manage")) return json({ ok: false, code: "forbidden" }, 403);

  const payload = await body(request);
  const email = clean(payload.email, 160).toLowerCase();
  const password = String(payload.password || "");
  const name = clean(payload.name, 80) || "Yousef Khamis";
  if (!email || password.length < 8) return json({ ok: false, code: "invalid" }, 400);

  const hash = await hashPassword(password);
  if (owner) {
    await env.DB
      .prepare("UPDATE members SET email = ?, password_hash = ?, name = ?, role = 'owner', active = 1, permissions = ? WHERE id = ?")
      .bind(email, hash, name, PERMISSIONS.join(","), owner.id)
      .run();
    await joinTeamChannels(env, owner.id);
    return json({ ok: true, member_id: owner.id });
  }
  const row = await env.DB
    .prepare(
      `INSERT INTO members (name, role, email, password_hash, permissions, active, capacity_hours)
       VALUES (?, 'owner', ?, ?, ?, 1, 40) RETURNING id`
    )
    .bind(name, email, hash, PERMISSIONS.join(","))
    .first();
  await joinTeamChannels(env, row.id);
  return json({ ok: true, member_id: row.id });
}

async function changePassword(env, who, payload) {
  if (!who?.member_role) return json({ ok: false, code: "not-a-member" }, 400);
  const row = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(who.id).first();
  if (!row) return json({ ok: false, code: "missing" }, 404);
  if (!(await checkPassword(String(payload.current || ""), row.password_hash))) {
    return json({ ok: false, code: "current" }, 403);
  }
  const next = String(payload.next || "");
  if (next.length < 8) return json({ ok: false, code: "password-short" }, 400);
  await env.DB.prepare("UPDATE members SET password_hash = ? WHERE id = ?").bind(await hashPassword(next), who.id).run();
  await env.DB.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(who.id).run();
  return json({ ok: true }, 200, { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

/* One call that fills the person's own screen: their tasks, their channels, unread counts. */
async function mySpace(env, who) {
  const memberId = who.member_role ? who.id : null;
  const openTasks = memberId
    ? await env.DB
        .prepare(
          `SELECT * FROM tasks
            WHERE status != 'done' AND (assignee_member_id = ? OR (assignee_member_id IS NULL AND assignee = ?))
            ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, priority ASC`
        )
        .bind(memberId, who.name)
        .all()
    : await env.DB.prepare("SELECT * FROM tasks WHERE status != 'done' ORDER BY priority ASC, id DESC LIMIT 50").all();

  const doneWeek = memberId
    ? await env.DB
        .prepare(
          `SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'
             AND (assignee_member_id = ? OR (assignee_member_id IS NULL AND assignee = ?))
             AND done_at >= datetime('now','-7 days')`
        )
        .bind(memberId, who.name)
        .first()
    : await env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND done_at >= datetime('now','-7 days')").first();

  const channels = await listChannels(env, who).then((res) => res.json());
  const rows = channels.rows || [];
  return json({
    ok: true,
    member: memberId
      ? { id: who.id, name: who.name, role: who.member_role, permissions: who.permissions }
      : { id: null, name: who.name, role: "owner", permissions: PERMISSIONS },
    tasks: openTasks.results || [],
    channels: rows,
    unread: rows.reduce((sum, row) => sum + Number(row.unread || 0), 0),
    done_7d: doneWeek?.n ?? 0,
  });
}

async function openDm(env, memberId, who) {
  if (!who?.member_role) return json({ ok: false, code: "forbidden" }, 403);
  const other = await env.DB.prepare("SELECT id, name FROM members WHERE id = ? AND active = 1").bind(memberId).first();
  if (!other) return json({ ok: false, code: "missing" }, 404);
  const low = Math.min(who.id, other.id);
  const high = Math.max(who.id, other.id);
  const slug = `dm-${low}-${high}`;
  let channel = await env.DB.prepare("SELECT * FROM channels WHERE slug = ?").bind(slug).first();
  if (!channel) {
    channel = await env.DB
      .prepare("INSERT INTO channels (slug, topic, kind) VALUES (?, ?, 'dm') RETURNING *")
      .bind(slug, `محادثة خاصة: ${who.name} / ${other.name}`)
      .first();
  }
  await env.DB
    .prepare("INSERT OR IGNORE INTO channel_members (channel_id, member_id) VALUES (?, ?), (?, ?)")
    .bind(channel.id, low, channel.id, high)
    .run();
  return json({ ok: true, channel });
}

async function markRead(env, channel, who) {
  if (!who?.member_role) return json({ ok: true });
  const last = await env.DB.prepare("SELECT MAX(id) AS id FROM messages WHERE channel_id = ?").bind(channel.id).first();
  await env.DB
    .prepare(
      `INSERT INTO channel_members (channel_id, member_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT(channel_id, member_id) DO UPDATE SET last_read_id = excluded.last_read_id`
    )
    .bind(channel.id, who.id, last?.id ?? 0)
    .run();
  return json({ ok: true, last_read_id: last?.id ?? 0 });
}

// ── code: GitHub as the source of truth ──────────────────────────────
// Repositories stay on GitHub; the console stores no code, only an
// optional token row in settings when the GITHUB_TOKEN secret is absent.

const GH = "https://api.github.com";

const b64 = {
  encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    return btoa(bin);
  },
  decode(value) {
    const bin = atob(String(value || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },
};

async function githubCreds(env) {
  const secret = env.GITHUB_TOKEN ? String(env.GITHUB_TOKEN).trim() : "";
  let stored = {};
  if (!secret) {
    const rows = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('github_token', 'github_owner')"
    ).all();
    stored = Object.fromEntries((rows.results ?? []).map((row) => [row.key, row.value]));
  }
  const token = secret || stored.github_token || "";
  const owner = (env.GITHUB_OWNER ? String(env.GITHUB_OWNER).trim() : "") || stored.github_owner || "";
  return { token, owner, source: secret ? "env" : token ? "settings" : "none" };
}

async function gh(env, creds, path, { method = "GET", payload } = {}) {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${creds.token}`,
      "user-agent": "egytronic-console",
      "x-github-api-version": "2022-11-28",
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const ghFail = (res) => {
  const message = res.data?.message || "";
  if (res.status === 401 || (res.status === 403 && /bad credentials/i.test(message))) return ["bad-token", 503];
  if (res.status === 403 && /rate limit/i.test(message)) return ["rate-limit", 429];
  if (res.status === 404) return ["not-found", 404];
  if (res.status === 409) return ["conflict", 409];
  if (res.status === 422) return ["invalid", 400];
  return [message || `github-${res.status}`, res.status >= 500 ? 502 : 400];
};

const repoPath = (id) => {
  const [owner, name] = String(id || "").split("/");
  if (!owner || !name) return null;
  if (!/^[\w.-]{1,80}$/.test(owner) || !/^[\w.-]{1,100}$/.test(name)) return null;
  return `${owner}/${name}`;
};

const slimRepo = (row) => ({
  full_name: row.full_name,
  name: row.name,
  owner: row.owner?.login,
  private: Boolean(row.private),
  description: row.description,
  language: row.language,
  pushed_at: row.pushed_at,
  stars: row.stargazers_count,
  default_branch: row.default_branch,
  html_url: row.html_url,
});

const slimCommit = (row) => ({
  sha: row.sha,
  short: String(row.sha || "").slice(0, 7),
  message: String(row.commit?.message || "").split("\n")[0],
  author: row.commit?.author?.name || row.author?.login || "",
  date: row.commit?.author?.date || null,
  html_url: row.html_url,
});

async function codeStatus(env, who) {
  const creds = await githubCreds(env);
  let login = null;
  let error = null;
  if (creds.token) {
    const res = await gh(env, creds, "/user");
    if (res.status === 200) login = res.data.login;
    else error = ghFail(res)[0];
  }
  return json({
    ok: true,
    configured: Boolean(creds.token),
    source: creds.source,
    login,
    owner: creds.owner || login || "",
    error,
    can_manage: allow(who, "code.manage"),
    can_store: allow(who, "settings.manage"),
  });
}

async function codeSaveToken(env, who, payload) {
  if (!allow(who, "settings.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const token = String(payload.token || "").trim();
  const owner = clean(payload.owner, 80);
  if (token && !/^(gh[pousr]_|github_pat_)/.test(token)) return json({ ok: false, code: "token-shape" }, 400);
  if (token) {
    const probe = await gh(env, { token }, "/user");
    if (probe.status !== 200) return json({ ok: false, code: ghFail(probe)[0] }, 400);
    await env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES ('github_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(token).run();
  }
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('github_owner', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(owner).run();
  return json({ ok: true });
}

async function codeClearToken(env, who) {
  if (!allow(who, "settings.manage")) return json({ ok: false, code: "forbidden" }, 403);
  await env.DB.prepare("DELETE FROM settings WHERE key = 'github_token'").run();
  return json({ ok: true });
}

async function codeRepos(env, creds, url) {
  const query = (url.searchParams.get("q") || "").toLowerCase();
  const res = await gh(env, creds, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  const owner = creds.owner.toLowerCase();
  const rows = (res.data || [])
    .filter((row) => !owner || String(row.owner?.login || "").toLowerCase() === owner)
    .filter((row) => !query || String(row.full_name).toLowerCase().includes(query))
    .map(slimRepo);
  return json({ ok: true, rows, owner: creds.owner });
}

async function codeRepo(env, creds, url) {
  const full = repoPath(url.searchParams.get("id"));
  if (!full) return json({ ok: false, code: "bad-repo" }, 400);
  const [repo, branches, commits] = await Promise.all([
    gh(env, creds, `/repos/${full}`),
    gh(env, creds, `/repos/${full}/branches?per_page=100`),
    gh(env, creds, `/repos/${full}/commits?per_page=20`),
  ]);
  if (repo.status !== 200) {
    const [code, status] = ghFail(repo);
    return json({ ok: false, code }, status);
  }
  return json({
    ok: true,
    repo: slimRepo(repo.data),
    branches: (branches.data || []).map((branch) => branch.name),
    commits: (commits.data || []).map(slimCommit),
  });
}

async function codeTree(env, creds, url) {
  const full = repoPath(url.searchParams.get("id"));
  if (!full) return json({ ok: false, code: "bad-repo" }, 400);
  const ref = clean(url.searchParams.get("ref"), 120);
  const path = (url.searchParams.get("path") || "").replace(/^\/+|\/+$/g, "");
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}${suffix}`);
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  const rows = (Array.isArray(res.data) ? res.data : [res.data])
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type === "dir" ? "dir" : "file",
      size: entry.size ?? 0,
      sha: entry.sha,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  return json({ ok: true, path, rows });
}

async function codeFile(env, creds, url) {
  const full = repoPath(url.searchParams.get("id"));
  if (!full) return json({ ok: false, code: "bad-repo" }, 400);
  const path = clean(url.searchParams.get("path"), 400);
  if (!path) return json({ ok: false, code: "bad-path" }, 400);
  const ref = clean(url.searchParams.get("ref"), 120);
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}${suffix}`);
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  if (Array.isArray(res.data)) return json({ ok: false, code: "is-dir" }, 400);
  if ((res.data.size ?? 0) > 512000) return json({ ok: false, code: "too-big" }, 413);
  const content = b64.decode(res.data.content);
  if (content.includes("\u0000")) return json({ ok: false, code: "binary" }, 415);
  return json({
    ok: true,
    path: res.data.path,
    sha: res.data.sha,
    size: res.data.size,
    html_url: res.data.html_url,
    content,
  });
}

async function codeSaveFile(env, creds, who, payload) {
  if (!allow(who, "code.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const full = repoPath(payload.id);
  const path = clean(payload.path, 400);
  if (!full || !path) return json({ ok: false, code: "bad-path" }, 400);
  const message = clean(payload.message, 200) || `تحديث ${path}`;
  const branch = clean(payload.branch, 120);

  const current = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`);
  const sha = current.status === 200 && !Array.isArray(current.data) ? current.data.sha : undefined;

  const res = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}`, {
    method: "PUT",
    payload: { message, content: b64.encode(String(payload.content ?? "")), branch: branch || undefined, sha },
  });
  if (res.status !== 200 && res.status !== 201) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  return json({
    ok: true,
    created: !sha,
    path,
    commit: {
      sha: res.data.commit.sha,
      short: String(res.data.commit.sha).slice(0, 7),
      html_url: res.data.commit.html_url,
      message,
    },
  });
}

async function codeDeleteFile(env, creds, who, url) {
  if (!allow(who, "code.manage")) return json({ ok: false, code: "forbidden" }, 403);
  const full = repoPath(url.searchParams.get("id"));
  const path = clean(url.searchParams.get("path"), 400);
  if (!full || !path) return json({ ok: false, code: "bad-path" }, 400);
  const branch = clean(url.searchParams.get("ref"), 120);
  const message = clean(url.searchParams.get("message"), 200) || `حذف ${path}`;

  const current = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`);
  if (current.status !== 200 || Array.isArray(current.data)) return json({ ok: false, code: "not-found" }, 404);

  const res = await gh(env, creds, `/repos/${full}/contents/${encodeURI(path)}`, {
    method: "DELETE",
    payload: { message, sha: current.data.sha, branch: branch || undefined },
  });
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  return json({ ok: true, path, commit: { sha: res.data.commit.sha, html_url: res.data.commit.html_url } });
}

async function codeCommits(env, creds, url) {
  const full = repoPath(url.searchParams.get("id"));
  if (!full) return json({ ok: false, code: "bad-repo" }, 400);
  const ref = clean(url.searchParams.get("ref"), 120);
  const page = Math.max(1, int(url.searchParams.get("page"), 1));
  const res = await gh(env, creds, `/repos/${full}/commits?per_page=25&page=${page}${ref ? `&sha=${encodeURIComponent(ref)}` : ""}`);
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  return json({ ok: true, page, rows: (res.data || []).map(slimCommit) });
}

async function codeCommit(env, creds, url) {
  const full = repoPath(url.searchParams.get("id"));
  const sha = clean(url.searchParams.get("sha"), 64);
  if (!full || !sha) return json({ ok: false, code: "bad-repo" }, 400);
  const res = await gh(env, creds, `/repos/${full}/commits/${sha}`);
  if (res.status !== 200) {
    const [code, status] = ghFail(res);
    return json({ ok: false, code }, status);
  }
  return json({
    ok: true,
    sha: res.data.sha,
    short: String(res.data.sha).slice(0, 7),
    message: res.data.commit?.message || "",
    author: res.data.commit?.author?.name || "",
    date: res.data.commit?.author?.date || null,
    html_url: res.data.html_url,
    stats: res.data.stats || {},
    files: (res.data.files || []).map((file) => ({
      path: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: String(file.patch || "").slice(0, 4000),
    })),
  });
}

// ── router ───────────────────────────────────────────────────────────

// ── integrations ─────────────────────────────────────────────────────
// Keys in, connectors and automations out. An automation is one row: a trigger
// (cron, event or manual), a connector and a message template. The event bus is
// the existing `events` table, so anything the console records can fan out.

const INTEGRATION_SCOPES = ["events:read", "events:write", "automations:run"];
const CONNECTOR_KINDS = new Set(["http", "slack", "discord"]);
const TRIGGER_TYPES = new Set(["cron", "event", "manual"]);
const RUN_LIMIT = 3;
const FETCH_TIMEOUT = 5000;

const sqlNow = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const slugOk = (value) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(String(value || ""));
const publicBase = (request) => (request?.url ? new URL(request.url).origin : "https://egytronic.pages.dev");

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

// https everywhere, plus plain http for services on the local network (an internal
// ERP or a machine on the office LAN is a legitimate connector target).
function connectorUrlOk(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    const host = url.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

async function integrationWho(env, request) {
  const token = bearer(request, new URL(request.url));
  if (!token || !token.startsWith("egx_int_")) return null;
  const row = await env.DB
    .prepare("SELECT id, name, scopes, active FROM integration_keys WHERE key_sha256 = ?")
    .bind(await sha256(token))
    .first();
  if (!row || !row.active) return null;
  await env.DB.prepare("UPDATE integration_keys SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run();
  const scopes = String(row.scopes || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { role: "integration", id: row.id, name: row.name, scopes };
}

const integrationCan = (who, scope) => Boolean(who?.scopes?.includes(scope) || who?.scopes?.includes("admin"));

// ── cron (5 fields, UTC) ────────────────────────────────────────────

function cronField(part, min, max) {
  const values = new Set();
  for (const piece of String(part ?? "").split(",")) {
    const [span, stepRaw] = piece.split("/");
    const step = Math.max(1, int(stepRaw, 1) || 1);
    let start = min;
    let end = max;
    if (span !== "*") {
      const [a, b] = span.split("-");
      start = int(a, min);
      end = b === undefined ? (stepRaw ? max : start) : int(b, max);
    }
    if (start === null || end === null || start > end) return null;
    for (let v = start; v <= end; v += step) if (v >= min && v <= max) values.add(v);
  }
  return values.size ? values : null;
}

const CRON_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

function parseCron(expr) {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const fields = parts.map((part, index) => cronField(part, CRON_RANGES[index][0], CRON_RANGES[index][1]));
  if (fields.some((field) => !field)) return null;
  const [mi, ho, dom, mo, dow] = fields;
  return { mi, ho, dom, mo, dow };
}

const cronMatches = (sets, date) =>
  sets.mi.has(date.getUTCMinutes()) &&
  sets.ho.has(date.getUTCHours()) &&
  sets.mo.has(date.getUTCMonth() + 1) &&
  sets.dom.has(date.getUTCDate()) &&
  sets.dow.has(date.getUTCDay());

function nextCron(expr, from = new Date()) {
  const sets = parseCron(expr);
  if (!sets) return null;
  const cursor = new Date(Math.floor(from.getTime() / 60000) * 60000 + 60000);
  for (let i = 0; i < 60 * 24 * 40; i += 1) {
    if (cronMatches(sets, cursor)) return cursor.toISOString().slice(0, 19).replace("T", " ");
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

// ── templates ───────────────────────────────────────────────────────

function pickPath(source, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => {
      if (value === null || value === undefined) return undefined;
      if (Array.isArray(value)) return value[int(key, 0)];
      return typeof value === "object" ? value[key] : undefined;
    }, source);
}

function renderTemplate(template, ctx) {
  return String(template ?? "").replace(/\{\{\s*(json\s+)?([a-zA-Z0-9_.]+)\s*\}\}/g, (_, asJson, path) => {
    const value = pickPath(ctx, path);
    if (value === undefined || value === null) return "";
    if (asJson) return JSON.stringify(value);
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

const matchEvent = (pattern, kind) => {
  if (!pattern) return false;
  if (pattern === "*") return true;
  const body = String(pattern)
    .split("*")
    .map((chunk) => chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}$`).test(String(kind || ""));
};

// ── running an automation ───────────────────────────────────────────

async function runAutomation(env, automation, trigger, ctx) {
  const started = Date.now();
  // id 0 is the connector test: it reports the result without writing a run row
  const persist = Boolean(automation.id);
  const finish = async (status, detail) => {
    if (persist) {
      await env.DB
        .prepare("INSERT INTO automation_runs (automation_id, trigger, status, detail, duration_ms) VALUES (?, ?, ?, ?, ?)")
        .bind(automation.id, trigger, status, String(detail || "").slice(0, 400), Date.now() - started)
        .run();
      await env.DB
        .prepare("UPDATE automations SET runs = runs + 1, last_run_at = datetime('now'), last_status = ? WHERE id = ?")
        .bind(status, automation.id)
        .run();
    }
    return { id: automation.id, name: automation.name, status, detail: String(detail || "").slice(0, 200) };
  };

  const connector = automation.connector_id
    ? await env.DB.prepare("SELECT * FROM connectors WHERE id = ?").bind(automation.connector_id).first()
    : null;
  if (!connector) return finish("no-connector", "الأتمتة مش مربوطة بموصّل");
  if (!connector.active) return finish("paused", "الموصّل متوقف");

  const text = renderTemplate(automation.template || "{{event.kind}}", ctx).slice(0, 4000);
  const body =
    connector.kind === "slack"
      ? { text }
      : connector.kind === "discord"
        ? { content: text }
        : { text, automation: automation.name, event: ctx.event, payload: ctx.payload ?? null };

  const headers = { "content-type": "application/json" };
  if (connector.headers) {
    try {
      Object.assign(headers, JSON.parse(connector.headers));
    } catch {
      /* a broken headers blob must not stop the run */
    }
  }
  if (connector.secret) headers.authorization = `Bearer ${connector.secret}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(connector.url, {
      method: connector.method || "POST",
      headers,
      body: connector.method === "GET" ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    await env.DB
      .prepare("UPDATE connectors SET last_status = ?, last_at = datetime('now') WHERE id = ?")
      .bind(String(res.status), connector.id)
      .run();
    return finish(res.ok ? "sent" : `http-${res.status}`, `${connector.name} → HTTP ${res.status}`);
  } catch (err) {
    await env.DB.prepare("UPDATE connectors SET last_status = 'error', last_at = datetime('now') WHERE id = ?").bind(connector.id).run();
    return finish("error", String(err?.message || err));
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchEvent(env, kind, payload, source) {
  const { results } = await env.DB.prepare("SELECT * FROM automations WHERE enabled = 1 AND trigger_type = 'event'").all();
  const matched = (results || []).filter((row) => matchEvent(row.event_key, kind)).slice(0, RUN_LIMIT);
  if (!matched.length) return { matched: 0, ran: [] };

  const ctx = { event: { kind, source: source || "system" }, payload: payload ?? null, now: new Date().toISOString() };
  const ran = [];
  for (const automation of matched) ran.push(await runAutomation(env, automation, `event:${kind}`, ctx));
  return { matched: matched.length, ran };
}

async function runDueAutomations(env) {
  const now = sqlNow();
  const { results } = await env.DB.prepare("SELECT * FROM automations WHERE enabled = 1 AND trigger_type = 'cron'").all();
  const ran = [];
  for (const automation of results || []) {
    if (automation.next_run_at && automation.next_run_at > now) continue;
    const ctx = { event: { kind: "schedule", schedule: automation.schedule }, payload: null, now: new Date().toISOString() };
    ran.push(await runAutomation(env, automation, "cron", ctx));
    await env.DB
      .prepare("UPDATE automations SET next_run_at = ? WHERE id = ?")
      .bind(nextCron(automation.schedule, new Date()), automation.id)
      .run();
  }
  return ran;
}

// ── console endpoints ───────────────────────────────────────────────

const slimConnector = (row) => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  url: row.url,
  method: row.method,
  has_secret: Boolean(row.secret),
  active: Boolean(row.active),
  last_status: row.last_status,
  last_at: row.last_at,
});

const slimAutomation = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  trigger_type: row.trigger_type,
  schedule: row.schedule,
  event_key: row.event_key,
  connector_id: row.connector_id,
  template: row.template,
  enabled: Boolean(row.enabled),
  runs: row.runs,
  last_run_at: row.last_run_at,
  last_status: row.last_status,
  next_run_at: row.next_run_at,
});

const slimWebhook = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  has_secret: Boolean(row.secret),
  active: Boolean(row.active),
  deliveries: row.deliveries,
  last_at: row.last_at,
});

async function integrationsOverview(env, request) {
  const count = async (sql) => (await env.DB.prepare(sql).first())?.n ?? 0;
  const [connectors, automations, hooks, keys, events] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM connectors"),
    count("SELECT COUNT(*) AS n FROM automations WHERE enabled = 1"),
    count("SELECT COUNT(*) AS n FROM webhooks WHERE active = 1"),
    count("SELECT COUNT(*) AS n FROM integration_keys WHERE active = 1"),
    count("SELECT COUNT(*) AS n FROM events"),
  ]);
  const runs = await env.DB
    .prepare(
      `SELECT r.id, r.created_at, r.trigger, r.status, r.detail, r.duration_ms, a.name
       FROM automation_runs r LEFT JOIN automations a ON a.id = r.automation_id
       ORDER BY r.id DESC LIMIT 10`
    )
    .all();
  return json({
    ok: true,
    base: publicBase(request),
    counts: { connectors, automations, hooks, keys, events },
    runs: runs.results || [],
    kinds: [...CONNECTOR_KINDS],
    scopes: INTEGRATION_SCOPES,
  });
}

async function listIntegrationKeys(env) {
  const { results } = await env.DB
    .prepare("SELECT id, created_at, name, scopes, active, last_used_at, created_by FROM integration_keys ORDER BY id DESC")
    .all();
  return json({ ok: true, rows: results });
}

async function createIntegrationKey(env, payload, who) {
  const name = clean(payload.name, 60);
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  const scopes = String(payload.scopes || "events:write")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => INTEGRATION_SCOPES.includes(s));
  if (!scopes.length) scopes.push("events:write");
  const key = `egx_int_${crypto.randomUUID().replace(/-/g, "")}`;
  const row = await env.DB
    .prepare("INSERT INTO integration_keys (name, key_sha256, scopes, created_by) VALUES (?, ?, ?, ?) RETURNING id, name, scopes, created_at")
    .bind(name, await sha256(key), scopes.join(","), who?.name || null)
    .first();
  await emit(env, "integration.key_created", "integration_key", row.id, who?.name || "system", { name, scopes: scopes.join(",") });
  return json({ ok: true, row: { ...row, key } });
}

async function patchIntegrationKey(env, id, payload) {
  const sets = [];
  const values = [];
  if (payload.active !== undefined) {
    sets.push("active = ?");
    values.push(payload.active ? 1 : 0);
  }
  if (payload.name !== undefined) {
    sets.push("name = ?");
    values.push(clean(payload.name, 60));
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE integration_keys SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  return json({ ok: true });
}

async function deleteIntegrationKey(env, id) {
  await env.DB.prepare("DELETE FROM integration_keys WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function listConnectors(env) {
  const { results } = await env.DB.prepare("SELECT * FROM connectors ORDER BY id DESC").all();
  return json({ ok: true, rows: (results || []).map(slimConnector) });
}

async function createConnector(env, payload) {
  const name = clean(payload.name, 60);
  const url = clean(payload.url, 500);
  const kind = CONNECTOR_KINDS.has(String(payload.kind)) ? String(payload.kind) : "http";
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  if (!connectorUrlOk(url)) return json({ ok: false, code: "url" }, 400);
  const headers = payload.headers ? JSON.stringify(payload.headers).slice(0, 2000) : null;
  const row = await env.DB
    .prepare("INSERT INTO connectors (name, kind, url, method, headers, secret) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(name, kind, url, clean(payload.method, 8) || "POST", headers, clean(payload.secret, 500) || null)
    .first();
  await emit(env, "integration.connector_created", "connector", row.id, "console", { name, kind });
  return json({ ok: true, id: row.id });
}

async function patchConnector(env, id, payload) {
  const sets = [];
  const values = [];
  if (payload.name !== undefined) {
    sets.push("name = ?");
    values.push(clean(payload.name, 60));
  }
  if (payload.url !== undefined) {
    const url = clean(payload.url, 500);
    if (!connectorUrlOk(url)) return json({ ok: false, code: "url" }, 400);
    sets.push("url = ?");
    values.push(url);
  }
  if (payload.kind !== undefined && CONNECTOR_KINDS.has(String(payload.kind))) {
    sets.push("kind = ?");
    values.push(String(payload.kind));
  }
  if (payload.method !== undefined) {
    sets.push("method = ?");
    values.push(clean(payload.method, 8) || "POST");
  }
  if (payload.active !== undefined) {
    sets.push("active = ?");
    values.push(payload.active ? 1 : 0);
  }
  if (payload.secret !== undefined) {
    sets.push("secret = ?");
    values.push(clean(payload.secret, 500) || null);
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE connectors SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  return json({ ok: true });
}

async function deleteConnector(env, id) {
  await env.DB.prepare("DELETE FROM connectors WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function testConnector(env, id) {
  const connector = await env.DB.prepare("SELECT * FROM connectors WHERE id = ?").bind(id).first();
  if (!connector) return json({ ok: false, code: "missing" }, 404);
  const automation = { id: 0, name: "اختبار الموصّل", connector_id: connector.id, template: "اختبار من لوحة Egytronic — {{now}}" };
  const started = Date.now();
  const result = await runAutomation(env, { ...automation, id: 0 }, "test", { event: { kind: "test" }, payload: null, now: sqlNow() });
  return json({ ok: result.status === "sent", result, ms: Date.now() - started });
}

async function listAutomations(env) {
  const { results } = await env.DB.prepare("SELECT * FROM automations ORDER BY id DESC").all();
  return json({ ok: true, rows: (results || []).map(slimAutomation) });
}

async function saveAutomation(env, payload, who, id = null) {
  const name = clean(payload.name, 80);
  if (name.length < 2) return json({ ok: false, code: "name" }, 400);
  const triggerType = TRIGGER_TYPES.has(String(payload.trigger_type)) ? String(payload.trigger_type) : "cron";
  const schedule = triggerType === "cron" ? clean(payload.schedule, 120) || "0 9 * * *" : null;
  if (schedule && !parseCron(schedule)) return json({ ok: false, code: "schedule" }, 400);
  const eventKey = triggerType === "event" ? clean(payload.event_key, 120) : null;
  if (triggerType === "event" && !eventKey) return json({ ok: false, code: "event-key" }, 400);
  const connectorId = int(payload.connector_id, null);
  const template = text(payload.template, 4000) || "{{event.kind}}";
  const enabled = payload.enabled === undefined ? 1 : payload.enabled ? 1 : 0;
  const next = triggerType === "cron" ? nextCron(schedule, new Date()) : null;

  if (id) {
    await env.DB
      .prepare(
        `UPDATE automations SET name = ?, description = ?, trigger_type = ?, schedule = ?, event_key = ?,
         connector_id = ?, template = ?, enabled = ?, next_run_at = ? WHERE id = ?`
      )
      .bind(name, clean(payload.description, 300) || null, triggerType, schedule, eventKey, connectorId, template, enabled, next, id)
      .run();
    return json({ ok: true, id, next_run_at: next });
  }

  const row = await env.DB
    .prepare(
      `INSERT INTO automations (name, description, trigger_type, schedule, event_key, connector_id, template, enabled, next_run_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(name, clean(payload.description, 300) || null, triggerType, schedule, eventKey, connectorId, template, enabled, next, who?.name || null)
    .first();
  await emit(env, "integration.automation_created", "automation", row.id, who?.name || "console", { name, trigger: triggerType });
  return json({ ok: true, id: row.id, next_run_at: next });
}

async function patchAutomation(env, id, payload) {
  const sets = [];
  const values = [];
  if (payload.enabled !== undefined) {
    sets.push("enabled = ?");
    values.push(payload.enabled ? 1 : 0);
  }
  if (payload.name !== undefined) {
    sets.push("name = ?");
    values.push(clean(payload.name, 80));
  }
  if (payload.template !== undefined) {
    sets.push("template = ?");
    values.push(text(payload.template, 4000));
  }
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);
  await env.DB.prepare(`UPDATE automations SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  return json({ ok: true });
}

async function deleteAutomation(env, id) {
  await env.DB.prepare("DELETE FROM automations WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function runAutomationById(env, id, trigger, payload) {
  const automation = await env.DB.prepare("SELECT * FROM automations WHERE id = ?").bind(id).first();
  if (!automation) return json({ ok: false, code: "missing" }, 404);
  const result = await runAutomation(env, automation, trigger, {
    event: { kind: trigger, automation: automation.name },
    payload: payload ?? null,
    now: sqlNow(),
  });
  return json({ ok: result.status === "sent", result });
}

async function automationRuns(env, id) {
  const { results } = await env.DB
    .prepare("SELECT id, created_at, trigger, status, detail, duration_ms FROM automation_runs WHERE automation_id = ? ORDER BY id DESC LIMIT 20")
    .bind(id)
    .all();
  return json({ ok: true, rows: results || [] });
}

async function listWebhooks(env, request) {
  const { results } = await env.DB.prepare("SELECT * FROM webhooks ORDER BY id DESC").all();
  return json({ ok: true, base: publicBase(request), rows: (results || []).map(slimWebhook) });
}

async function createWebhook(env, payload, who, request) {
  const name = clean(payload.name, 60);
  let slug = String(payload.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  if (!slug) slug = `hook-${crypto.randomUUID().slice(0, 8)}`;
  if (!slugOk(slug)) return json({ ok: false, code: "slug" }, 400);
  const exists = await env.DB.prepare("SELECT id FROM webhooks WHERE slug = ?").bind(slug).first();
  if (exists) return json({ ok: false, code: "slug-taken" }, 409);
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
  const row = await env.DB
    .prepare("INSERT INTO webhooks (slug, name, secret, created_by) VALUES (?, ?, ?, ?) RETURNING id, slug")
    .bind(slug, name || slug, secret, who?.name || null)
    .first();
  return json({ ok: true, row, secret, url: `${publicBase(request)}/hooks/${row.slug}` });
}

async function rotateWebhook(env, id) {
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
  await env.DB.prepare("UPDATE webhooks SET secret = ? WHERE id = ?").bind(secret, id).run();
  return json({ ok: true, secret });
}

async function patchWebhook(env, id, payload) {
  await env.DB.prepare("UPDATE webhooks SET active = ? WHERE id = ?").bind(payload.active ? 1 : 0, id).run();
  return json({ ok: true });
}

async function deleteWebhook(env, id) {
  await env.DB.prepare("DELETE FROM webhooks WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function webhookDeliveries(env, id) {
  const { results } = await env.DB
    .prepare("SELECT id, created_at, event_key, ok, summary FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 20")
    .bind(id)
    .all();
  return json({ ok: true, rows: results || [] });
}

async function integrationEvents(env, url) {
  const limit = Math.min(int(url.searchParams.get("limit"), 25), 100);
  const { results } = await env.DB
    .prepare("SELECT id, created_at, kind, entity, entity_id, actor FROM events ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all();
  return json({ ok: true, rows: results || [] });
}

// ── inbound webhook ─────────────────────────────────────────────────

async function handleHook(request, env, slug) {
  if (request.method !== "POST") return json({ ok: false, code: "method" }, 405);
  const hook = await env.DB.prepare("SELECT * FROM webhooks WHERE slug = ? AND active = 1").bind(slug).first();
  if (!hook) return json({ ok: false, code: "unknown-hook" }, 404);

  const raw = await request.text();
  if (hook.secret) {
    const given = String(request.headers.get("x-egytronic-signature") || "").trim();
    const expected = `sha256=${await hmacHex(hook.secret, raw)}`;
    if (given !== expected) return json({ ok: false, code: "bad-signature" }, 401);
  }

  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw: raw.slice(0, 2000) };
  }
  const kind = clean(payload?.event || payload?.type || `hook.${hook.slug}`, 80) || `hook.${hook.slug}`;

  await env.DB
    .prepare("UPDATE webhooks SET deliveries = deliveries + 1, last_at = datetime('now') WHERE id = ?")
    .bind(hook.id)
    .run();
  const result = await dispatchEvent(env, kind, payload, `webhook:${hook.slug}`);
  await env.DB
    .prepare("INSERT INTO webhook_deliveries (webhook_id, event_key, ok, summary) VALUES (?, ?, ?, ?)")
    .bind(hook.id, kind, result.ran.every((run) => run.status === "sent") ? 1 : 0, `${result.matched} أتمتة`)
    .run();
  return json({ ok: true, event: kind, matched: result.matched, ran: result.ran });
}

// ── public integration API (/api/v1) ────────────────────────────────

const API_SCOPES = ["events:read", "events:write", "automations:run"];

function openApiDoc(request) {
  return {
    openapi: "3.1.0",
    info: { title: "Egytronic Integration API", version: "1.0.0" },
    servers: [{ url: `${publicBase(request)}/api/v1` }],
    security: [{ bearer: [] }],
    paths: {
      "/whoami": { get: { summary: "هوية المفتاح وصلاحياته" } },
      "/events": {
        get: { summary: "آخر الأحداث" },
        post: {
          summary: "إطلاق حدث يستهلكه أي أتمتة مشتركة عليه",
          requestBody: { content: { "application/json": { example: { kind: "invoice.paid", payload: { amount: 1200 } } } } },
        },
      },
      "/automations/{id}/run": { post: { summary: "تشغيل أتمتة يدويًا" } },
    },
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
  };
}

async function integrationApi(request, env, url, who) {
  const parts = url.pathname.split("/").filter(Boolean); // api | v1 | resource | id | action
  const resource = parts[2];
  const id = parts[3];
  const action = parts[4];
  const method = request.method;

  if (resource === "openapi.json" && method === "GET") return json(openApiDoc(request));

  if (!who) return json({ ok: false, code: "unauthorized" }, 401);
  if (resource === "whoami" && method === "GET") {
    return json({ ok: true, id: who.id, name: who.name, scopes: who.scopes, available: API_SCOPES });
  }

  if (resource === "events") {
    if (method === "GET") {
      if (!integrationCan(who, "events:read")) return json({ ok: false, code: "forbidden" }, 403);
      const limit = Math.min(int(url.searchParams.get("limit"), 50), 200);
      const { results } = await env.DB
        .prepare("SELECT id, created_at, kind, entity, entity_id, actor, payload FROM events ORDER BY id DESC LIMIT ?")
        .bind(limit)
        .all();
      return json({ ok: true, rows: results || [] });
    }
    if (method === "POST") {
      if (!integrationCan(who, "events:write")) return json({ ok: false, code: "forbidden" }, 403);
      const payload = await body(request);
      const kind = clean(payload.kind, 80);
      if (!kind) return json({ ok: false, code: "kind" }, 400);
      await emit(env, kind, clean(payload.entity, 40) || "external", int(payload.entity_id, null), who.name, payload.payload ?? payload);
      return json({ ok: true, kind });
    }
  }

  if (resource === "automations" && id && action === "run" && method === "POST") {
    if (!integrationCan(who, "automations:run")) return json({ ok: false, code: "forbidden" }, 403);
    const payload = await body(request).catch(() => ({}));
    return runAutomationById(env, int(id), "api", payload?.payload ?? payload ?? null);
  }

  return json({ ok: false, code: "not-found" }, 404);
}

async function api(request, env, url, who) {
  const parts = url.pathname.split("/").filter(Boolean); // api | resource | id | action
  const resource = parts[1];
  const id = parts[2];
  const action = parts[3];
  const method = request.method;

  if (resource === "auth" && id === "login" && method === "POST") return loginRequest(request, env);
  if (resource === "auth" && id === "logout" && method === "POST") return logoutRequest(request, env);
  if (resource === "auth" && id === "setup" && method === "POST") return setupOwner(request, env, url);

  if (!who) return json({ ok: false, code: "unauthorized" }, 401, challengeHeader(request));
  if (!can(who, method === "GET" ? "read" : "write")) return json({ ok: false, code: "forbidden" }, 403);

  if (resource === "auth" && id === "me" && method === "GET") {
    return json({
      ok: true,
      member: who.member_role
        ? { id: who.id, name: who.name, role: who.member_role, permissions: who.permissions }
        : { id: null, name: who.name, role: who.role === "agent" ? "agent" : "owner", permissions: PERMISSIONS },
    });
  }
  if (resource === "auth" && id === "password" && method === "POST") return changePassword(env, who, await body(request));
  if (resource === "me" && !id && method === "GET") return mySpace(env, who);
  if (resource === "dm" && id && method === "POST") return openDm(env, int(id), who);

  if (resource === "sessions" && method === "GET") {
    const { results } = await env.DB
      .prepare(
        `SELECT c.id AS client_id, c.name AS client,
                MIN(t.created_at) AS first_seen,
                MAX(CASE WHEN t.kind = 'access' THEN t.expires_at END) AS access_until,
                MAX(CASE WHEN t.kind = 'refresh' THEN t.expires_at END) AS refresh_until,
                SUM(CASE WHEN t.revoked = 0 AND t.expires_at > datetime('now') THEN 1 ELSE 0 END) AS live,
                GROUP_CONCAT(DISTINCT t.scope) AS scopes
         FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client_id
         GROUP BY c.id ORDER BY first_seen DESC LIMIT 50`
      )
      .all();
    return json({ ok: true, rows: results });
  }

  if (resource === "sessions" && method === "DELETE" && id) {
    if (!can(who, "admin")) return json({ ok: false, code: "forbidden" }, 403);
    return revokeSession(env, id, who);
  }

  if (resource === "overview" && method === "GET") {
    const [inquiries, tasks, minutes, agents, clients, pipelineValue, openLeads, memberCount] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(minutes),0) AS n FROM time_entries WHERE created_at >= datetime('now','start of day')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(value),0) AS n FROM inquiries WHERE status NOT IN ('won','lost')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status NOT IN ('won','lost')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE active = 1").first(),
    ]);
    return json({
      ok: true,
      new_inquiries: inquiries?.n ?? 0,
      open_tasks: tasks?.n ?? 0,
      minutes_today: minutes?.n ?? 0,
      agents: agents?.n ?? 0,
      active_clients: clients?.n ?? 0,
      pipeline_value: pipelineValue?.n ?? 0,
      open_leads: openLeads?.n ?? 0,
      members: memberCount?.n ?? 0,
      who: { role: who.role, name: who.name, scopes: who.scopes },
    });
  }

  if (resource === "inquiries") {
    if (!id && method === "GET") return listInquiries(env, url);
    if (!id && method === "POST") return createInquiry(env, await body(request), who);
    if (id && !action && method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(int(id)).first();
      return row ? json({ ok: true, row }) : json({ ok: false, code: "missing" }, 404);
    }
    if (id && !action && method === "PATCH") return patchInquiry(env, int(id), await body(request), who);
    if (id && action === "convert" && method === "POST") return convertInquiry(env, int(id), await body(request), who);
  }

  if (resource === "clients") {
    if (!id && method === "GET") return listClients(env, url);
    if (!id && method === "POST") return createClient(env, await body(request), who);
    if (id && method === "PATCH") return patchClient(env, int(id), await body(request), who);
  }

  if (resource === "projects") {
    if (!id && method === "GET") return listProjects(env, url);
    if (!id && method === "POST") return createProject(env, await body(request), who);
    if (id && method === "PATCH") return patchProject(env, int(id), await body(request), who);
  }

  if (resource === "channels") {
    if (!id && method === "GET") return listChannels(env, who);
    if (!id && method === "POST") return createChannel(env, await body(request), who);
    const channel = await channelByAny(env, decodeURIComponent(id || ""));
    if (!channel) return json({ ok: false, code: "missing" }, 404);
    if (action === "read" && method === "POST") return markRead(env, channel, who);
    if (action === "messages" && method === "GET") return listMessages(env, channel, url, who);
    if (action === "messages" && method === "POST") return postMessage(env, channel, await body(request), who);
  }

  if (resource === "tasks") {
    if (!id && method === "GET") return listTasks(env, url, who);
    if (!id && method === "POST") return createTask(env, await body(request), who);
    if (id && !action && method === "PATCH") return patchTask(env, int(id), await body(request), who);
    if (id && action === "pomodoro" && method === "POST") return logPomodoro(env, await body(request), who);
  }

  if (resource === "time") {
    if (method === "GET") return todayStats(env);
    if (method === "POST") return logPomodoro(env, await body(request), who);
  }

  if (resource === "members") {
    if (!id && method === "GET") return listMembers(env, who);
    if (!id && method === "POST") return createMember(env, await body(request), who);
    if (id && method === "PATCH") return patchMember(env, int(id), await body(request), who);
    if (id && method === "DELETE") return removeMember(env, int(id), who);
    if (id && action === "password" && method === "POST") return memberPassword(env, int(id), await body(request), who);
  }

  if (resource === "activities") {
    if (!id && method === "GET") return listActivities(env, url);
    if (!id && method === "POST") return createActivity(env, await body(request), who);
  }

  if (resource === "metrics" && method === "GET") return metrics(env, who);

  if (resource === "code") {
    if (!allow(who, "code.view")) return json({ ok: false, code: "forbidden" }, 403);
    if (id === "status" && method === "GET") return codeStatus(env, who);
    if (id === "token" && method === "POST") return codeSaveToken(env, who, await body(request));
    if (id === "token" && method === "DELETE") return codeClearToken(env, who);

    const creds = await githubCreds(env);
    if (!creds.token) return json({ ok: false, code: "no-token" }, 503);

    if (id === "repos" && method === "GET") return codeRepos(env, creds, url);
    if (id === "repo" && method === "GET") return codeRepo(env, creds, url);
    if (id === "tree" && method === "GET") return codeTree(env, creds, url);
    if (id === "file" && method === "GET") return codeFile(env, creds, url);
    if (id === "file" && method === "PUT") return codeSaveFile(env, creds, who, await body(request));
    if (id === "file" && method === "DELETE") return codeDeleteFile(env, creds, who, url);
    if (id === "commits" && method === "GET") return codeCommits(env, creds, url);
    if (id === "commit" && method === "GET") return codeCommit(env, creds, url);
    return json({ ok: false, code: "not-found" }, 404);
  }

  if (resource === "integrations") {
    const sub = parts[2];
    const subId = parts[3];
    const subAction = parts[4];
    if (!allow(who, method === "GET" ? "integrations.view" : "integrations.manage")) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    if (!sub) return integrationsOverview(env, request);

    if (sub === "keys") {
      if (!subId && method === "GET") return listIntegrationKeys(env);
      if (!subId && method === "POST") return createIntegrationKey(env, await body(request), who);
      if (subId && method === "PATCH") return patchIntegrationKey(env, int(subId), await body(request));
      if (subId && method === "DELETE") return deleteIntegrationKey(env, int(subId));
    }

    if (sub === "connectors") {
      if (!subId && method === "GET") return listConnectors(env);
      if (!subId && method === "POST") return createConnector(env, await body(request));
      if (subId && subAction === "test" && method === "POST") return testConnector(env, int(subId));
      if (subId && !subAction && method === "PATCH") return patchConnector(env, int(subId), await body(request));
      if (subId && !subAction && method === "DELETE") return deleteConnector(env, int(subId));
    }

    if (sub === "automations") {
      if (!subId && method === "GET") return listAutomations(env);
      if (!subId && method === "POST") return saveAutomation(env, await body(request), who);
      if (subId && subAction === "run" && method === "POST") return runAutomationById(env, int(subId), "manual", null);
      if (subId && subAction === "runs" && method === "GET") return automationRuns(env, int(subId));
      if (subId && !subAction && method === "PATCH") {
        const payload = await body(request);
        if (payload.name !== undefined || payload.trigger_type !== undefined) {
          const row = await env.DB.prepare("SELECT * FROM automations WHERE id = ?").bind(int(subId)).first();
          if (!row) return json({ ok: false, code: "missing" }, 404);
          const merged = { ...slimAutomation(row), ...payload };
          return saveAutomation(env, merged, who, int(subId));
        }
        return patchAutomation(env, int(subId), payload);
      }
      if (subId && !subAction && method === "DELETE") return deleteAutomation(env, int(subId));
    }

    if (sub === "webhooks") {
      if (!subId && method === "GET") return listWebhooks(env, request);
      if (!subId && method === "POST") return createWebhook(env, await body(request), who, request);
      if (subId && subAction === "rotate" && method === "POST") return rotateWebhook(env, int(subId));
      if (subId && subAction === "deliveries" && method === "GET") return webhookDeliveries(env, int(subId));
      if (subId && !subAction && method === "PATCH") return patchWebhook(env, int(subId), await body(request));
      if (subId && !subAction && method === "DELETE") return deleteWebhook(env, int(subId));
    }

    if (sub === "events" && method === "GET") return integrationEvents(env, url);
    if (sub === "tick" && method === "POST") return json({ ok: true, ran: await runDueAutomations(env) });
    return json({ ok: false, code: "not-found" }, 404);
  }

  if (resource === "agents") {
    if (!id && method === "GET") return listAgents(env);
    if (!id && method === "POST") return createAgent(env, await body(request), who);
    if (id && method === "PATCH") return patchAgent(env, int(id), await body(request), who);
  }

  if (resource === "events" && method === "GET") return listEvents(env, url);
  if (resource === "context" && method === "GET") return agentContext(env, url);

  return json({ ok: false, code: "not-found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });

    if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) return protectedResource(request);
    if (url.pathname.startsWith("/.well-known/oauth-authorization-server")) return authorizationServer(request);
    if (url.pathname === "/register" && request.method === "POST") return registerClient(request, env);
    if (url.pathname === "/authorize") return authorize(request, env, url);
    if (url.pathname === "/token") return token(request, env);

    if (url.pathname === "/api/health") return health(env);
    if (url.pathname === "/api/catalog" && (request.method === "GET" || request.method === "HEAD")) {
      return catalog(request, env, url);
    }
    if (url.pathname === "/api/contact" && request.method === "POST") return contact(request, env);
    if (url.pathname === "/api/admin/token" && request.method === "POST") return rotateToken(request, env);
    if (url.pathname === "/mcp") return mcp(request, env, url);

    if (url.pathname.startsWith("/hooks/")) {
      return handleHook(request, env, decodeURIComponent(url.pathname.slice(7).replace(/\/+$/, "")));
    }

    // integration keys drive the public API and the cron tick; sessions still work on the console routes
    if (url.pathname === "/api/integrations/tick" && request.method === "POST") {
      const key = await integrationWho(env, request);
      if (key) {
        if (!integrationCan(key, "automations:run")) return json({ ok: false, code: "forbidden" }, 403);
        return json({ ok: true, ran: await runDueAutomations(env) });
      }
    }
    if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
      return integrationApi(request, env, url, await integrationWho(env, request));
    }

    if (url.pathname.startsWith("/api/")) {
      const who = await identify(request, env, url);
      return api(request, env, url, who);
    }

    const accept = request.headers.get("accept") || "";
    if (
      request.method === "GET" &&
      accept.includes("text/markdown") &&
      !url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/.well-known/") &&
      !url.pathname.startsWith("/mcp")
    ) {
      const asset = await env.ASSETS.fetch(request);
      if ((asset.headers.get("content-type") || "").includes("text/html")) {
        const md = htmlToMarkdown(await asset.text());
        return new Response(md, {
          status: asset.status,
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "x-markdown-tokens": String(Math.ceil(md.length / 4)),
            vary: "accept",
            "cache-control": "public, max-age=300",
          },
        });
      }
      return asset;
    }

    if (url.pathname === "/.well-known/search" && request.method === "GET") return agentSearch(url);

    const agentType = AGENT_DOCS[url.pathname];
    if (agentType) {
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      headers.set("content-type", agentType);
      headers.set("access-control-allow-origin", "*");
      return new Response(asset.body, { status: asset.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};


