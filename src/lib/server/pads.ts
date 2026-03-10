import db from './db';
import { mergeText } from './merge';

export interface Pad {
	id: number;
	slug: string;
	content: string;
	version: number;
	collaboration_mode: string;
	created_at: string;
	updated_at: string;
}

// File extensions to reject in slugs
const BLOCKED_EXTENSIONS = ['.ico', '.js', '.css', '.json', '.map', '.svg', '.png', '.jpg'];

/**
 * Validate a pad slug. Rejects slugs that start with '_' or 'api',
 * or contain common file extensions.
 */
function validateSlug(slug: string): void {
	if (!slug || slug.trim() === '') {
		throw new Error('Slug cannot be empty');
	}

	if (slug.startsWith('_') || slug.startsWith('api')) {
		throw new Error(`Invalid slug: "${slug}" -- slugs starting with "_" or "api" are reserved`);
	}

	const lowerSlug = slug.toLowerCase();
	for (const ext of BLOCKED_EXTENSIONS) {
		if (lowerSlug.endsWith(ext)) {
			throw new Error(`Invalid slug: "${slug}" -- file extension "${ext}" is not allowed`);
		}
	}
}

// Prepared statements for performance
const getBySlugStmt = db.prepare<[string], Pad>('SELECT * FROM pads WHERE slug = ?');

const insertStmt = db.prepare<[string]>(
	"INSERT INTO pads (slug, content, base_content) VALUES (?, '', '')"
);

const updateStmt = db.prepare<[string, string, number]>(
	`UPDATE pads
	 SET content = ?, version = version + 1, updated_at = datetime('now')
	 WHERE slug = ? AND version = ?`
);

// Extended statements for merge support
const getModeStmt = db.prepare<
	[string],
	{ collaboration_mode: string; content: string; base_content: string; version: number }
>('SELECT collaboration_mode, content, base_content, version FROM pads WHERE slug = ?');

const updateWithBaseStmt = db.prepare<[string, string, string, number]>(
	`UPDATE pads
	 SET content = ?, base_content = ?, version = version + 1, updated_at = datetime('now')
	 WHERE slug = ? AND version = ?`
);

const forceUpdateStmt = db.prepare<[string, string, number, string]>(
	`UPDATE pads
	 SET content = ?, base_content = ?, version = ?, updated_at = datetime('now')
	 WHERE slug = ?`
);

const updateModeStmt = db.prepare<[string, string]>(
	`UPDATE pads SET collaboration_mode = ? WHERE slug = ?`
);

/**
 * Get a pad by its slug.
 */
export function getPadBySlug(slug: string): Pad | undefined {
	return getBySlugStmt.get(slug);
}

/**
 * Create a new pad with empty content.
 */
export function createPad(slug: string): Pad {
	validateSlug(slug);
	insertStmt.run(slug);
	return getBySlugStmt.get(slug)!;
}

export type SaveResult =
	| { type: 'saved'; pad: Pad }
	| { type: 'merged'; pad: Pad; hadConflicts: boolean }
	| { type: 'conflict'; pad: Pad };

/**
 * Save pad content with optimistic concurrency check and auto-merge support.
 * For auto-merge pads, version mismatches trigger a three-way merge.
 * For last-save-wins pads, version mismatches return a conflict.
 */
export function savePad(
	slug: string,
	content: string,
	expectedVersion: number
): SaveResult {
	// Read current content to use as base for future merges
	const beforeSave = getBySlugStmt.get(slug);
	const previousContent = beforeSave?.content ?? '';

	// Try normal version-checked update (set base_content to previous content for future merges)
	const result = updateWithBaseStmt.run(content, previousContent, slug, expectedVersion);

	if (result.changes > 0) {
		return { type: 'saved', pad: getBySlugStmt.get(slug)! };
	}

	// Version mismatch -- check collaboration mode
	const current = getModeStmt.get(slug);
	if (!current) {
		throw new Error(`Pad not found: "${slug}"`);
	}

	if (current.collaboration_mode !== 'auto-merge') {
		// Last-save-wins: return conflict (unchanged behavior)
		return { type: 'conflict', pad: getBySlugStmt.get(slug)! };
	}

	// Auto-merge: attempt three-way merge inside a transaction
	// Wrap read + merge + write in transaction to prevent race conditions
	// better-sqlite3's transaction() uses BEGIN IMMEDIATE which acquires write lock before reading
	const mergeTransaction = db.transaction(() => {
		// Re-read inside transaction to ensure consistent state
		const latest = getModeStmt.get(slug);
		if (!latest) {
			throw new Error(`Pad not found: "${slug}"`);
		}

		const mergeResult = mergeText(latest.base_content, latest.content, content);

		// Save merged result with incremented version
		// base_content = server content before merge (the common ancestor for next merge)
		forceUpdateStmt.run(mergeResult.content, latest.content, latest.version + 1, slug);

		return {
			pad: getBySlugStmt.get(slug)!,
			hadConflicts: !mergeResult.success
		};
	});

	const mergeOutcome = mergeTransaction();
	return {
		type: 'merged',
		pad: mergeOutcome.pad,
		hadConflicts: mergeOutcome.hadConflicts
	};
}

/**
 * Update the collaboration mode for a pad.
 * @param slug - The pad slug
 * @param mode - Must be 'last-save-wins', 'auto-merge', or 'real-time'
 * @returns The updated pad
 */
export function updateCollaborationMode(
	slug: string,
	mode: 'last-save-wins' | 'auto-merge' | 'real-time'
): Pad {
	if (mode !== 'last-save-wins' && mode !== 'auto-merge' && mode !== 'real-time') {
		throw new Error(
			`Invalid mode: "${mode}". Must be "last-save-wins", "auto-merge", or "real-time".`
		);
	}

	const result = updateModeStmt.run(mode, slug);
	if (result.changes === 0) {
		throw new Error(`Pad not found: "${slug}"`);
	}

	return getBySlugStmt.get(slug)!;
}
