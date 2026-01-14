CREATE TABLE IF NOT EXISTS requests (
	id TEXT PRIMARY KEY,
	model TEXT NOT NULL,
	system_prompt TEXT,
	prompt TEXT NOT NULL,
	created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS responses (
	id TEXT PRIMARY KEY,
	request_id TEXT NOT NULL REFERENCES requests(id),
	response_id TEXT,
	provider TEXT,
	model TEXT,
	content TEXT,
	finish_reason TEXT,
	prompt_tokens INTEGER,
	completion_tokens INTEGER,
	total_tokens INTEGER,
	cost REAL,
	created_at TEXT DEFAULT (datetime('now')),
	raw_response TEXT
);
