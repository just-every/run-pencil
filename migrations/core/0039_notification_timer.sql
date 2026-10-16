CREATE TABLE notification_timer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_started_at TEXT NOT NULL
);
