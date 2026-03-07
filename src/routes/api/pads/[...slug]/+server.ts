import { json, error } from '@sveltejs/kit';
import { savePad } from '$lib/server/pads';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	if (!slug) {
		error(400, 'Slug is required');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { content, version } = body as { content: unknown; version: unknown };

	if (typeof content !== 'string') {
		error(400, 'Content must be a string');
	}
	if (typeof version !== 'number' || !Number.isFinite(version)) {
		error(400, 'Version must be a number');
	}

	const result = savePad(slug, content, version);

	if (result.conflict) {
		return json(
			{
				error: 'conflict',
				message: 'Pad was modified since your last load',
				content: result.pad.content,
				version: result.pad.version
			},
			{ status: 409 }
		);
	}

	return json({
		version: result.pad.version,
		updatedAt: result.pad.updated_at
	});
};
