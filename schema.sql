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
  source TEXT
);
