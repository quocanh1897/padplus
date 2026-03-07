import { json, error } from '@sveltejs/kit';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getPadBySlug, createPad } from '$lib/server/pads';
import {
	insertImage,
	getImagesByPadId,
	getPadImageTotalSize,
	getNextSortOrder
} from '$lib/server/images';
import type { RequestHandler } from './$types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PAD_QUOTA = 100 * 1024 * 1024; // 100MB
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 80;

export const POST: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	if (!slug) {
		error(400, 'Slug is required');
	}

	// Check Content-Length header against 5MB limit
	const contentLength = parseInt(request.headers.get('content-length') || '0');
	if (contentLength > MAX_IMAGE_SIZE) {
		error(413, 'Image too large (5MB max)');
	}

	// Resolve pad (create if doesn't exist, consistent with page load behavior)
	let pad = getPadBySlug(slug);
	if (!pad) {
		pad = createPad(slug);
	}

	// Parse form data
	const formData = await request.formData();
	const file = formData.get('image') as File | null;

	if (!file || !file.type.startsWith('image/')) {
		error(400, 'No valid image provided');
	}

	// Double-check actual file size (Content-Length can be spoofed)
	if (file.size > MAX_IMAGE_SIZE) {
		error(413, 'Image too large (5MB max)');
	}

	// Check per-pad quota
	const currentTotal = getPadImageTotalSize(pad.id);
	if (currentTotal + file.size > MAX_PAD_QUOTA) {
		error(413, 'Pad image quota exceeded (100MB max)');
	}

	// Read file into buffer
	const buffer = Buffer.from(await file.arrayBuffer());

	// Optimize with sharp: auto-rotate EXIF, resize, convert to WebP
	const optimized = await sharp(buffer)
		.rotate() // Auto-apply EXIF orientation
		.resize(MAX_DIMENSION, MAX_DIMENSION, {
			fit: 'inside',
			withoutEnlargement: true
		})
		.webp({ quality: WEBP_QUALITY })
		.toBuffer();

	// Generate UUID and filename
	const uuid = randomUUID();
	const filename = `${uuid}.webp`;

	// Create upload directory and write file
	const uploadDir = path.join(process.cwd(), 'data', 'uploads', String(pad.id));
	await mkdir(uploadDir, { recursive: true });
	await writeFile(path.join(uploadDir, filename), optimized);

	// Get next sort order and insert into DB
	const sortOrder = getNextSortOrder(pad.id);
	const image = insertImage(pad.id, uuid, filename, optimized.length, sortOrder);

	return json(
		{
			id: image.uuid,
			filename: image.filename,
			size: image.size_bytes,
			sort_order: image.sort_order
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

	const images = getImagesByPadId(pad.id);
	return json(images);
};
