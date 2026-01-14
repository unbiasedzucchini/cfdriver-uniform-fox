CREATE TABLE IF NOT EXISTS requests (
	id TEXT PRIMARY KEY,
	model TEXT NOT NULL,
	system_prompt TEXT,
	prompt TEXT NOT NULL,
	created_at TEXT DEFAULT (datetime('now'))
);
