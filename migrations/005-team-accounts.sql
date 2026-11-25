-- Team accounts: one login per person, explicit permissions, chat membership,
-- and tasks that can point at a member row instead of a free-text name.

ALTER TABLE members ADD COLUMN handle TEXT;
ALTER TABLE members ADD COLUMN password_hash TEXT;
ALTER TABLE members ADD COLUMN permissions TEXT;
ALTER TABLE members ADD COLUMN last_login_at TEXT;

ALTER TABLE tasks ADD COLUMN assignee_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS member_sessions (
  id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen TEXT,
  ua TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_sessions_member ON member_sessions(member_id, expires_at);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_member ON channel_members(member_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email ON members(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_member ON tasks(assignee_member_id, status);

-- Key/value store for the owner token hash and other single-row settings.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
