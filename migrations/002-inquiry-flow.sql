-- Brings the portal's first table up to the ops flow. Run once; ALTER is not idempotent.
ALTER TABLE inquiries ADD COLUMN status TEXT NOT NULL DEFAULT 'new';  -- new | contacted | quoted | won | lost
ALTER TABLE inquiries ADD COLUMN assigned_to TEXT;
ALTER TABLE inquiries ADD COLUMN notes TEXT;
ALTER TABLE inquiries ADD COLUMN updated_at TEXT;
