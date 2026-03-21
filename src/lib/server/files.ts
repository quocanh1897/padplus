import db from './db';

export interface FileRecord {
	id: number;
	pad_id: number;
	uuid: string;
	original_name: string;
	stored_name: string;
	mime_type: string;
	size_bytes: number;
	sort_order: number;
	created_at: string;
}

// Prepared statements
const getByPadIdStmt = db.prepare<[number], FileRecord>(
	'SELECT * FROM files WHERE pad_id = ? ORDER BY sort_order ASC'
);

const getByUuidStmt = db.prepare<[string], FileRecord>(
	'SELECT * FROM files WHERE uuid = ?'
);

const insertStmt = db.prepare<[number, string, string, string, string, number, number]>(
	`INSERT INTO files (pad_id, uuid, original_name, stored_name, mime_type, size_bytes, sort_order)
	 VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const getInsertedStmt = db.prepare<[number], FileRecord>(
	'SELECT * FROM files WHERE id = ?'
);

const deleteStmt = db.prepare<[string]>(
	'DELETE FROM files WHERE uuid = ?'
);

const totalSizeStmt = db.prepare<[number], { total: number | null }>(
	'SELECT SUM(size_bytes) as total FROM files WHERE pad_id = ?'
);

const maxSortOrderStmt = db.prepare<[number], { max_order: number | null }>(
	'SELECT MAX(sort_order) as max_order FROM files WHERE pad_id = ?'
);

/**
 * Get all files for a pad, ordered by sort_order ascending.
 */
export function getFilesByPadId(padId: number): FileRecord[] {
	return getByPadIdStmt.all(padId);
}

/**
 * Get a single file by its UUID.
 */
export function getFileByUuid(uuid: string): FileRecord | undefined {
	return getByUuidStmt.get(uuid);
}

/**
 * Insert a new file and return the created row.
 */
export function insertFile(
	padId: number,
	uuid: string,
	originalName: string,
	storedName: string,
	mimeType: string,
	sizeBytes: number,
	sortOrder: number
): FileRecord {
	const result = insertStmt.run(padId, uuid, originalName, storedName, mimeType, sizeBytes, sortOrder);
	return getInsertedStmt.get(Number(result.lastInsertRowid))!;
}

/**
 * Delete a file by UUID. Returns true if a row was deleted.
 */
export function deleteFile(uuid: string): boolean {
	const result = deleteStmt.run(uuid);
	return result.changes > 0;
}

/**
 * Get total size of all files for a pad (for quota checking).
 */
export function getPadFileTotalSize(padId: number): number {
	const row = totalSizeStmt.get(padId);
	return row?.total ?? 0;
}

/**
 * Get the next sort_order value for a pad's files.
 */
export function getFileNextSortOrder(padId: number): number {
	const row = maxSortOrderStmt.get(padId);
	return row?.max_order != null ? row.max_order + 1 : 0;
}
