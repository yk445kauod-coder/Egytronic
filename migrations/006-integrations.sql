-- Integration layer: API keys, outbound connectors, automations, inbound webhooks.
-- Nothing here stores repository or customer payloads beyond the audit rows the
-- console already shows; automations only keep their last status.

CREATE TABLE IF NOT EXISTS integration_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  key_sha256 TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT 'events:write',   -- comma separated
  active INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS connectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'http',             -- http | slack | discord
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers TEXT,                                  -- json object, optional
  secret TEXT,                                   -- sent as Authorization: Bearer, never returned
  active INTEGER NOT NULL DEFAULT 1,
  last_status TEXT,
  last_at TEXT
);

CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'cron',     -- cron | event | manual
  schedule TEXT,                                 -- 5-field cron for trigger_type = cron
  event_key TEXT,                                -- e.g. inquiry.created or hook.*
  connector_id INTEGER REFERENCES connectors(id) ON DELETE SET NULL,
  template TEXT,                                 -- {{event.kind}}, {{payload.name}}, {{json payload}}
  enabled INTEGER NOT NULL DEFAULT 1,
  runs INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  last_status TEXT,
  next_run_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  trigger TEXT,
  status TEXT,
  detail TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_automation_runs ON automation_runs (automation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations (trigger_type, enabled, next_run_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  deliveries INTEGER NOT NULL DEFAULT 0,
  last_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  event_key TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries (webhook_id, id DESC);
