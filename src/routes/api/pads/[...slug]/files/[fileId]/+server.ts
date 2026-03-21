import { json, error } from '@sveltejs/kit';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getFileByUuid, deleteFile } from '$lib/server/files';
import { getUploadDir } from '$lib/server/upload-path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const fileId = params.fileId;
	if (!fileId) {
		error(400, 'File ID is required');
	}

	const file = getFileByUuid(fileId);
	if (!file) {
		error(404, 'File not found');
	}

	const filePath = path.join(getUploadDir(file.pad_id), 'files', file.stored_name);

	let data: Buffer;
	try {
		data = await readFile(filePath);
	} catch {
		error(404, 'File not found on disk');
	}

	return new Response(new Uint8Array(data), {
		headers: {
			'Content-Type': file.mime_type,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_name)}"`,
			'Content-Length': String(data.length),
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	const fileId = params.fileId;
	if (!fileId) {
		error(400, 'File ID is required');
	}

	const file = getFileByUuid(fileId);
	if (!file) {
		error(404, 'File not found');
	}

	// Delete filesystem file first
	const filePath = path.join(getUploadDir(file.pad_id), 'files', file.stored_name);

	try {
		await unlink(filePath);
	} catch {
		// File may already be gone -- proceed with DB cleanup
	}

	// Delete DB row
	deleteFile(fileId);

	return json({ deleted: true });
};
