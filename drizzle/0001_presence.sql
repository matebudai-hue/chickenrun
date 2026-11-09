CREATE TABLE presence (
  code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (code, player)
);