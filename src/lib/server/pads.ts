import db from './db';

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
	"INSERT INTO pads (slug, content) VALUES (?, '')"
);

const updateStmt = db.prepare<[string, string, number]>(
	`UPDATE pads
	 SET content = ?, version = version + 1, updated_at = datetime('now')
	 WHERE slug = ? AND version = ?`
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

/**
 * Save pad content with optimistic concurrency check.
 * Returns { conflict: true, pad } if the version doesn't match,
 * or { conflict: false, pad } on success.
 */
export function savePad(
	slug: string,
	content: string,
	expectedVersion: number
): { conflict: boolean; pad: Pad } {
	const result = updateStmt.run(content, slug, expectedVersion);

	if (result.changes === 0) {
		// Version mismatch -- return current state for conflict resolution
		const current = getBySlugStmt.get(slug);
		if (!current) {
			throw new Error(`Pad not found: "${slug}"`);
		}
		return { conflict: true, pad: current };
	}

	const updated = getBySlugStmt.get(slug)!;
	return { conflict: false, pad: updated };
}
