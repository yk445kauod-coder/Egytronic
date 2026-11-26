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
