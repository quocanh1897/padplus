import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'padplus.db');

// Ensure data directory exists
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Synchronous NORMAL is safe with WAL and faster than FULL
db.pragma('synchronous = NORMAL');

// Schema migrations using built-in user_version pragma
const currentVersion = db.pragma('user_version', { simple: true }) as number;

if (currentVersion < 1) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS pads (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			slug TEXT NOT NULL UNIQUE,
			content TEXT NOT NULL DEFAULT '',
			version INTEGER NOT NULL DEFAULT 1,
			collaboration_mode TEXT NOT NULL DEFAULT 'last-save-wins',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_pads_slug ON pads(slug);
	`);
	db.pragma('user_version = 1');
}

export default db;
