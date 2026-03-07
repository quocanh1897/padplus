import db from './db';

export interface Image {
	id: number;
	pad_id: number;
	uuid: string;
	filename: string;
	mime_type: string;
	size_bytes: number;
	sort_order: number;
	created_at: string;
}

// Prepared statements for performance
const getByPadIdStmt = db.prepare<[number], Image>(
	'SELECT * FROM images WHERE pad_id = ? ORDER BY sort_order ASC'
);

const getByUuidStmt = db.prepare<[string], Image>(
	'SELECT * FROM images WHERE uuid = ?'
);

const insertStmt = db.prepare<[number, string, string, number, number]>(
	`INSERT INTO images (pad_id, uuid, filename, size_bytes, sort_order)
	 VALUES (?, ?, ?, ?, ?)`
);

const getInsertedStmt = db.prepare<[number], Image>(
	'SELECT * FROM images WHERE id = ?'
);

const deleteStmt = db.prepare<[string]>(
	'DELETE FROM images WHERE uuid = ?'
);

const updateOrderStmt = db.prepare<[number, string]>(
	'UPDATE images SET sort_order = ? WHERE uuid = ?'
);

const totalSizeStmt = db.prepare<[number], { total: number | null }>(
	'SELECT SUM(size_bytes) as total FROM images WHERE pad_id = ?'
);

const maxSortOrderStmt = db.prepare<[number], { max_order: number | null }>(
	'SELECT MAX(sort_order) as max_order FROM images WHERE pad_id = ?'
);

/**
 * Get all images for a pad, ordered by sort_order ascending.
 */
export function getImagesByPadId(padId: number): Image[] {
	return getByPadIdStmt.all(padId);
}

/**
 * Get a single image by its UUID.
 */
export function getImageByUuid(uuid: string): Image | undefined {
	return getByUuidStmt.get(uuid);
}

/**
 * Insert a new image and return the created row.
 */
export function insertImage(
	padId: number,
	uuid: string,
	filename: string,
	sizeBytes: number,
	sortOrder: number
): Image {
	const result = insertStmt.run(padId, uuid, filename, sizeBytes, sortOrder);
	return getInsertedStmt.get(Number(result.lastInsertRowid))!;
}

/**
 * Delete an image by UUID. Returns true if a row was deleted.
 */
export function deleteImage(uuid: string): boolean {
	const result = deleteStmt.run(uuid);
	return result.changes > 0;
}

/**
 * Update sort_order for multiple images in a single transaction.
 */
export const updateImageOrder = db.transaction(
	(orders: { uuid: string; sort_order: number }[]) => {
		for (const order of orders) {
			updateOrderStmt.run(order.sort_order, order.uuid);
		}
	}
);

/**
 * Get total size of all images for a pad (for quota checking).
 * Returns 0 if the pad has no images.
 */
export function getPadImageTotalSize(padId: number): number {
	const row = totalSizeStmt.get(padId);
	return row?.total ?? 0;
}

/**
 * Get the next sort_order value for a pad.
 * Returns 0 if the pad has no images.
 */
export function getNextSortOrder(padId: number): number {
	const row = maxSortOrderStmt.get(padId);
	return row?.max_order != null ? row.max_order + 1 : 0;
}
