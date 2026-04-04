import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getPadBySlug, createPad } from '$lib/server/pads';
import { getUploadDir } from '$lib/server/upload-path';
import {
	insertFile,
	getFilesByPadId,
	getPadFileTotalSize,
	getFileNextSortOrder
} from '$lib/server/files';
import { MAX_FILE_SIZE, MAX_PAD_FILE_QUOTA, formatBytes } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	if (!slug) {
		error(400, 'Slug is required');
	}

	// Check Content-Length header early
	const contentLength = parseInt(request.headers.get('content-length') || '0');
	if (contentLength > MAX_FILE_SIZE) {
		error(413, `File too large (${formatBytes(MAX_FILE_SIZE)} max)`);
	}

	// Resolve pad (create if doesn't exist)
	let pad = getPadBySlug(slug);
	if (!pad) {
		pad = createPad(slug);
	}

	// Parse form data
	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		error(400, 'No file provided');
	}

	// Double-check actual file size
	if (file.size > MAX_FILE_SIZE) {
		error(413, `File too large (${formatBytes(MAX_FILE_SIZE)} max)`);
	}

	// Check per-pad file quota
	const currentTotal = getPadFileTotalSize(pad.id);
	if (currentTotal + file.size > MAX_PAD_FILE_QUOTA) {
		error(413, `Pad file quota exceeded (${formatBytes(MAX_PAD_FILE_QUOTA)} max)`);
	}

	// Read file into buffer
	const buffer = Buffer.from(await file.arrayBuffer());

	// Generate UUID and stored filename (preserve extension)
	const uuid = randomUUID();
	const ext = path.extname(file.name) || '';
	const storedName = `${uuid}${ext}`;

	// Create upload directory (reuse image upload dir structure: data/uploads/<padId>/files/)
	const uploadDir = path.join(getUploadDir(pad.id), 'files');
	await mkdir(uploadDir, { recursive: true });
	await writeFile(path.join(uploadDir, storedName), buffer);

	// Get next sort order and insert into DB
	const sortOrder = getFileNextSortOrder(pad.id);
	const record = insertFile(
		pad.id,
		uuid,
		file.name,
		storedName,
		file.type || 'application/octet-stream',
		buffer.length,
		sortOrder
	);

	return json(
		{
			id: record.uuid,
			original_name: record.original_name,
			size: record.size_bytes,
			mime_type: record.mime_type,
			sort_order: record.sort_order
		},
		{ status: 201 }
	);
};

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug;
	if (!slug) {
		error(400, 'Slug is required');
	}

	const pad = getPadBySlug(slug);
	if (!pad) {
		return json([]);
	}

	const files = getFilesByPadId(pad.id);
	return json(files);
};
