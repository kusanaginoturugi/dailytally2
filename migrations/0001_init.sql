-- dailytally2 initial schema

CREATE TABLE fellowships (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  tendo_code   TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ceremonies (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL UNIQUE,
  next_number       INTEGER NOT NULL DEFAULT 1,
  begin_at          TEXT,
  end_at            TEXT,
  seekers_start_at  TEXT,
  date_preset_key   TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tally_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ceremony_id   INTEGER NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,
  name          TEXT NOT NULL,
  summary_name  TEXT,
  unit          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(ceremony_id, item_key)
);

CREATE TABLE tallies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ceremony_id    INTEGER NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  tally_item_id  INTEGER NOT NULL REFERENCES tally_items(id) ON DELETE CASCADE,
  fellowship_id  INTEGER NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  tally_date     TEXT NOT NULL,
  value          INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     TEXT,
  UNIQUE(ceremony_id, tally_item_id, fellowship_id, tally_date)
);
CREATE INDEX idx_tallies_lookup ON tallies(ceremony_id, fellowship_id, tally_date);

CREATE TABLE fellowship_targets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ceremony_id    INTEGER NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  tally_item_id  INTEGER NOT NULL REFERENCES tally_items(id) ON DELETE CASCADE,
  fellowship_id  INTEGER NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  value          INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ceremony_id, tally_item_id, fellowship_id)
);

CREATE TABLE summary_target_overrides (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ceremony_id    INTEGER NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  tally_item_id  INTEGER NOT NULL REFERENCES tally_items(id) ON DELETE CASCADE,
  value          INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ceremony_id, tally_item_id)
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id       TEXT NOT NULL UNIQUE,
  fellowship_id  INTEGER REFERENCES fellowships(id) ON DELETE SET NULL,
  name           TEXT,
  email          TEXT,
  role           TEXT,
  last_login_at  TEXT
);

CREATE TABLE report_settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  enabled           INTEGER NOT NULL DEFAULT 0,
  send_time         TEXT NOT NULL DEFAULT '22:00',
  sender_name       TEXT,
  branch_name       TEXT,
  branch_code       TEXT,
  notify_email      TEXT,
  last_attempt_at   TEXT,
  last_attempt_key  TEXT,
  last_success_at   TEXT,
  last_sent_key     TEXT,
  last_error        TEXT,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at      TEXT NOT NULL,
  send_key     TEXT,
  status       TEXT,
  message      TEXT,
  ceremony_id  INTEGER REFERENCES ceremonies(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_report_history_sent_at ON report_history(sent_at DESC);

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
