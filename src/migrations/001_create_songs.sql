CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  last_accessed INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_data ON songs(data);
