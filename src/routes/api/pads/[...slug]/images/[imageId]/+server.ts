import { json, error } from '@sveltejs/kit';
import { readFile, unlink } from 'node:fs/promises';
import { getImageByUuid, deleteImage } from '$lib/server/images';
import { getUploadFilePath } from '$lib/server/upload-path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const uuid = params.imageId;
	if (!uuid) {
		error(400, 'Image ID is required');
	}

	const image = getImageByUuid(uuid);
	if (!image) {
		error(404, 'Image not found');
	}

	const filePath = getUploadFilePath(image.pad_id, image.filename);

	let data: Buffer;
	try {
		data = await readFile(filePath);
	} catch {
		error(404, 'Image file not found');
	}

	return new Response(new Uint8Array(data), {
		headers: {
			'Content-Type': 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Length': String(data.length)
		}
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	const uuid = params.imageId;
	if (!uuid) {
		error(400, 'Image ID is required');
	}

	const image = getImageByUuid(uuid);
	if (!image) {
		error(404, 'Image not found');
	}

	// Delete filesystem file first (safer order -- see research Pitfall 5)
	const filePath = getUploadFilePath(image.pad_id, image.filename);

	try {
		await unlink(filePath);
	} catch {
		// File may already be gone -- proceed with DB cleanup
	}

	// Delete DB row
	deleteImage(uuid);

	return json({ deleted: true });
};
