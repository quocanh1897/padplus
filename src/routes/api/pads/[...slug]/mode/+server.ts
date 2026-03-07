import { json, error } from '@sveltejs/kit';
import { updateCollaborationMode } from '$lib/server/pads';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
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

	const { mode } = body as { mode: unknown };

	if (mode !== 'last-save-wins' && mode !== 'auto-merge') {
		error(400, 'Mode must be "last-save-wins" or "auto-merge"');
	}

	try {
		const pad = updateCollaborationMode(slug, mode);
		return json({ mode: pad.collaboration_mode });
	} catch (e) {
		if (e instanceof Error && e.message.includes('not found')) {
			error(404, 'Pad not found');
		}
		throw e;
	}
};
