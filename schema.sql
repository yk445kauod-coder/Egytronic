-- Contact portal storage. One row per submission; no joins, no indexes beyond the
-- primary key, so a submit costs one COUNT + one INSERT.
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  package TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',     -- new | contacted | quoted | won | lost
  assigned_to TEXT,
  notes TEXT,
  updated_at TEXT
);

-- ── operations console ────────────────────────────────────────────────
-- The portal is the public side of the same database the console reads.

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'lead',   -- lead | active | paused | done
  value INTEGER,                          -- EGP, optional
  notes TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  package TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | building | review | shipped
  due_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  slug TEXT NOT NULL UNIQUE,
  topic TEXT,
  kind TEXT NOT NULL DEFAULT 'team'       -- team | client | agent
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author TEXT NOT NULL,                   -- 'yousef' | agent name | 'system'
  kind TEXT NOT NULL DEFAULT 'human',     -- human | agent | system
  body TEXT NOT NULL,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS messages_channel ON messages (channel_id, id);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'todo',    -- todo | doing | done
  priority INTEGER NOT NULL DEFAULT 2,    -- 1 high, 3 low
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE SET NULL,
  assignee TEXT,
  due_at TEXT,
  done_at TEXT,
  source TEXT                             -- human | agent:<id> | portal
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL,
  label TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  model TEXT,
  key_sha256 TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT 'read',    -- comma separated: read,write,admin
  active INTEGER NOT NULL DEFAULT 1,
  last_seen TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,                     -- inquiry.created | task.updated | message.posted …
  entity TEXT,
  entity_id INTEGER,
  actor TEXT,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS events_kind ON events (kind, id);

CREATE INDEX IF NOT EXISTS inquiries_status ON inquiries (status, id);

-- Key/value store for the owner token hash and other single-row settings.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Money engine: invoices and the payments recorded against them.
-- Amounts are whole EGP; the console never needs cents.

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | sent | partial | paid | void
  total INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',    -- cash | bank | wallet | instapay | other
  reference TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
-- Web Push subscriptions for the operations console.
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  member TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_ok TEXT,
  failures INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_active ON push_subs(active);
