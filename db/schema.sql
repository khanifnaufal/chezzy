-- Schema SQL for Chess Analyzer database
-- SQLite schema definition

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    white TEXT NOT NULL,
    black TEXT NOT NULL,
    date TEXT NOT NULL,
    result TEXT NOT NULL,
    pgn_raw TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    move_number INTEGER NOT NULL,
    move TEXT NOT NULL,
    label TEXT NOT NULL,
    score_before TEXT NOT NULL, -- Stored as serialized JSON string
    score_after TEXT NOT NULL,  -- Stored as serialized JSON string
    is_white INTEGER NOT NULL CHECK (is_white IN (0, 1)),
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);
