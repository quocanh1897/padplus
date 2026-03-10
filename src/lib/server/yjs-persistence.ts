import db from './db';

// Prepared statements for Yjs state persistence
const getStateStmt = db.prepare<[string], { yjs_state: Buffer | null }>(
	'SELECT yjs_state FROM pads WHERE slug = ?'
);

const saveStateStmt = db.prepare<[Buffer, string, string]>(
	`UPDATE pads SET yjs_state = ?, content = ?, updated_at = datetime('now') WHERE slug = ?`
);

/**
 * Load persisted Yjs binary state for a pad.
 * Returns null if no state has been saved yet.
 */
export function getYjsState(slug: string): Uint8Array | null {
	const row = getStateStmt.get(slug);
	if (!row || !row.yjs_state) return null;
	return new Uint8Array(row.yjs_state);
}

/**
 * Save Yjs binary state and corresponding plain text content for a pad.
 * Saves both in a single UPDATE to prevent content column drift from Yjs state.
 */
export function saveYjsState(slug: string, state: Uint8Array, plainText: string): void {
	saveStateStmt.run(Buffer.from(state), plainText, slug);
}
