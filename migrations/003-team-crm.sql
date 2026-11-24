-- CRM depth + a roster the work can be assigned to.
ALTER TABLE inquiries ADD COLUMN value INTEGER;
ALTER TABLE inquiries ADD COLUMN next_action_at TEXT;
ALTER TABLE inquiries ADD COLUMN lost_reason TEXT;

ALTER TABLE clients ADD COLUMN next_action_at TEXT;
ALTER TABLE clients ADD COLUMN source TEXT;

ALTER TABLE tasks ADD COLUMN estimate_minutes INTEGER;

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',      -- owner | manager | member | contractor
  email TEXT,
  phone TEXT,
  focus TEXT,
  capacity_hours INTEGER NOT NULL DEFAULT 32,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  entity TEXT NOT NULL,                     -- inquiry | client | project | member | task
  entity_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',        -- note | call | email | meeting | stage | system
  body TEXT NOT NULL,
  actor TEXT,
  minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity, entity_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee, status);

UPDATE inquiries SET status = 'proposal' WHERE status = 'quoted';
