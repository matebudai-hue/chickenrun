CREATE TABLE rooms (
  code TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  state TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX rooms_expiry ON rooms (expires_at);

