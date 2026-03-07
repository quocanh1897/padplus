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

// Enable foreign key enforcement
db.pragma('foreign_keys = ON');

// Schema migrations using built-in user_version pragma
let currentVersion = db.pragma('user_version', { simple: true }) as number;

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

currentVersion = db.pragma('user_version', { simple: true }) as number;

if (currentVersion < 2) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS images (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pad_id INTEGER NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
			uuid TEXT NOT NULL UNIQUE,
			filename TEXT NOT NULL,
			mime_type TEXT NOT NULL DEFAULT 'image/webp',
			size_bytes INTEGER NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_images_pad_id ON images(pad_id);
		CREATE INDEX IF NOT EXISTS idx_images_uuid ON images(uuid);
	`);
	db.pragma('user_version = 2');
}

currentVersion = db.pragma('user_version', { simple: true }) as number;

if (currentVersion < 3) {
	db.exec(`
		ALTER TABLE pads ADD COLUMN base_content TEXT NOT NULL DEFAULT '';
		UPDATE pads SET base_content = content;
	`);
	db.pragma('user_version = 3');
}

export default db;
