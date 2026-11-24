// Egytronic backend: the public contact portal, the internal operations console and
// an MCP endpoint any agent can drive. Every handler is a handful of D1 statements
// and there are no outbound calls, so it stays inside the Workers free allowance.
//
// Auth: one admin token (sha256 in settings) plus per-agent keys (agents table).
// Agents carry scopes — read, write, admin — and only get what they need.

const PACKAGES = new Set(["logo", "landing", "static", "identity", "dynamic", "transform", "unsure"]);
const INQUIRY_STATUS = new Set(["new", "contacted", "quoted", "won", "lost"]);
const TASK_STATUS = new Set(["todo", "doing", "done"]);
const CLIENT_STATUS = new Set(["lead", "active", "paused", "done"]);
const PROJECT_STATUS = new Set(["planned", "building", "review", "shipped"]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization, x-admin-token",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
  if (!token) return null;

  const digest = await sha256(token);
  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (stored && stored.value === digest) {
    return { role: "admin", name: "yousef", scopes: ["read", "write", "admin"] };
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

// ── events: the feed an external agent polls ─────────────────────────

async function emit(env, kind, entity, entityId, actor, payload) {
  await env.DB
    .prepare("INSERT INTO events (kind, entity, entity_id, actor, payload) VALUES (?, ?, ?, ?, ?)")
    .bind(kind, entity, entityId ?? null, actor || "system", payload ? JSON.stringify(payload) : null)
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

  const channel = await env.DB.prepare("SELECT id FROM channels WHERE slug = 'inbox'").first();
  if (channel && inserted?.id) {
    await env.DB
      .prepare("INSERT INTO messages (channel_id, author, kind, body, meta) VALUES (?, 'portal', 'system', ?, ?)")
      .bind(
        channel.id,
        `${name} — ${message.slice(0, 400)}`,
        JSON.stringify({ inquiry_id: inserted.id, email, package: wanted })
      )
      .run();
  }

  await emit(env, "inquiry.created", "inquiry", inserted?.id, "portal", { name, email, package: wanted });
  return json({ ok: true, id: inserted?.id ?? null });
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
  if (!sets.length) return json({ ok: false, code: "nothing" }, 400);

  sets.push("updated_at = datetime('now')");
  await env.DB.prepare(`UPDATE inquiries SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  await emit(env, "inquiry.updated", "inquiry", id, who.name, payload);
  return json({ ok: true, row: await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(id).first() });
}

async function convertInquiry(env, id, payload, who) {
  const inquiry = await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(id).first();
  if (!inquiry) return json({ ok: false, code: "missing" }, 404);

  const client = await env.DB
    .prepare("INSERT INTO clients (name, email, phone, status, value) VALUES (?, ?, ?, 'active', ?) RETURNING id")
    .bind(inquiry.name, inquiry.email, inquiry.phone, int(payload.value, null))
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

async function listChannels(env) {
  const { results } = await env.DB
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messages,
              (SELECT MAX(id) FROM messages m WHERE m.channel_id = c.id) AS last_message
       FROM channels c ORDER BY c.id`
    )
    .all();
  return json({ ok: true, rows: results });
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

async function listMessages(env, channel, url) {
  const after = int(url.searchParams.get("after"), 0);
  const limit = Math.min(int(url.searchParams.get("limit"), 100), 200);
  const { results } = await env.DB
    .prepare("SELECT * FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?")
    .bind(channel.id, after, limit)
    .all();
  return json({ ok: true, channel: { id: channel.id, slug: channel.slug, topic: channel.topic }, rows: results });
}

async function postMessage(env, channel, payload, who) {
  const message = text(payload.body, 4000).trim();
  if (!message) return json({ ok: false, code: "body" }, 400);
  const author = clean(payload.author, 60) || who.name || "yousef";
  const kind = who.role === "agent" ? "agent" : payload.kind === "system" ? "system" : "human";
  const row = await env.DB
    .prepare("INSERT INTO messages (channel_id, author, kind, body, meta) VALUES (?, ?, ?, ?, ?) RETURNING *")
    .bind(channel.id, author, kind, message, payload.meta ? JSON.stringify(payload.meta) : null)
    .first();
  await emit(env, "message.posted", "channel", channel.id, author, { message_id: row.id });
  return json({ ok: true, row });
}

// ── console: tasks & pomodoro ────────────────────────────────────────

async function listTasks(env, url) {
  const status = clean(url.searchParams.get("status"), 12);
  const stmt =
    status && TASK_STATUS.has(status)
      ? env.DB.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY priority ASC, id DESC").bind(status)
      : env.DB.prepare("SELECT * FROM tasks ORDER BY status = 'done', priority ASC, id DESC");
  const { results } = await stmt.all();
  return json({ ok: true, rows: results });
}

async function createTask(env, payload, who) {
  const title = clean(payload.title, 160);
  if (title.length < 2) return json({ ok: false, code: "title" }, 400);
  const row = await env.DB
    .prepare(
      "INSERT INTO tasks (title, detail, status, priority, client_id, project_id, channel_id, inquiry_id, assignee, due_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
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
      who.role === "agent" ? `agent:${who.id}` : "human"
    )
    .first();
  await emit(env, "task.created", "task", row.id, who.name, { title: row.title });
  return json({ ok: true, row });
}

async function patchTask(env, id, payload, who) {
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
      const { results } = await env.DB
        .prepare("SELECT id, created_at, author, kind, body FROM messages WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT ?")
        .bind(channel.id, int(args.after, 0), Math.min(int(args.limit, 50), 200))
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

async function mcp(request, env, url) {
  const who = await identify(request, env, url);
  if (!who) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } }, 401);
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
            "Operations server for Egytronic. Prices: logo 5,000 · landing 6,000 · static 8,000 · identity 10,000 · dynamic from 18,000 EGP; 50% upfront, 50% before delivery.",
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
  if (next.length < 16) return json({ ok: false, code: "short" }, 400);

  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_token_sha256'").first();
  if (!stored || (await sha256(current)) !== stored.value) return json({ ok: false }, 404);

  await env.DB
    .prepare("INSERT INTO settings (key, value) VALUES ('admin_token_sha256', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(await sha256(next))
    .run();

  return json({ ok: true });
}

// ── router ───────────────────────────────────────────────────────────

async function api(request, env, url, who) {
  const parts = url.pathname.split("/").filter(Boolean); // api | resource | id | action
  const resource = parts[1];
  const id = parts[2];
  const action = parts[3];
  const method = request.method;

  if (!who) return json({ ok: false, code: "unauthorized" }, 401);
  if (!can(who, method === "GET" ? "read" : "write")) return json({ ok: false, code: "forbidden" }, 403);

  if (resource === "overview" && method === "GET") {
    const [inquiries, tasks, minutes, agents, clients] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(minutes),0) AS n FROM time_entries WHERE created_at >= datetime('now','start of day')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").first(),
    ]);
    return json({
      ok: true,
      new_inquiries: inquiries?.n ?? 0,
      open_tasks: tasks?.n ?? 0,
      minutes_today: minutes?.n ?? 0,
      agents: agents?.n ?? 0,
      active_clients: clients?.n ?? 0,
      who: { role: who.role, name: who.name, scopes: who.scopes },
    });
  }

  if (resource === "inquiries") {
    if (!id && method === "GET") return listInquiries(env, url);
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
    if (!id && method === "GET") return listChannels(env);
    if (!id && method === "POST") return createChannel(env, await body(request), who);
    const channel = await channelByAny(env, decodeURIComponent(id || ""));
    if (!channel) return json({ ok: false, code: "missing" }, 404);
    if (action === "messages" && method === "GET") return listMessages(env, channel, url);
    if (action === "messages" && method === "POST") return postMessage(env, channel, await body(request), who);
  }

  if (resource === "tasks") {
    if (!id && method === "GET") return listTasks(env, url);
    if (!id && method === "POST") return createTask(env, await body(request), who);
    if (id && !action && method === "PATCH") return patchTask(env, int(id), await body(request), who);
    if (id && action === "pomodoro" && method === "POST") return logPomodoro(env, await body(request), who);
  }

  if (resource === "time") {
    if (method === "GET") return todayStats(env);
    if (method === "POST") return logPomodoro(env, await body(request), who);
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

    if (url.pathname === "/api/health") return health(env);
    if (url.pathname === "/api/contact" && request.method === "POST") return contact(request, env);
    if (url.pathname === "/api/admin/token" && request.method === "POST") return rotateToken(request, env);
    if (url.pathname === "/mcp") return mcp(request, env, url);

    if (url.pathname.startsWith("/api/")) {
      const who = await identify(request, env, url);
      return api(request, env, url, who);
    }

    return env.ASSETS.fetch(request);
  },
};


