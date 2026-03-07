import { error } from '@sveltejs/kit';
import { getPadBySlug, createPad } from '$lib/server/pads';
import type { PageServerLoad } from './$types';

// File extensions to reject
const BLOCKED_EXTENSIONS = ['.ico', '.js', '.css', '.json', '.map', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf'];

function isInvalidSlug(slug: string): boolean {
	if (!slug || slug.trim() === '') return true;
	if (slug.startsWith('_') || slug.startsWith('api')) return true;

	const lowerSlug = slug.toLowerCase();
	for (const ext of BLOCKED_EXTENSIONS) {
		if (lowerSlug.endsWith(ext)) return true;
	}

	return false;
}

export const load: PageServerLoad = ({ params }) => {
	const slug = params.slug;

	if (!slug || isInvalidSlug(slug)) {
		error(400, 'Invalid pad name');
	}

	let pad = getPadBySlug(slug);
	if (!pad) {
		pad = createPad(slug);
	}

	return {
		slug: pad.slug,
		content: pad.content,
		version: pad.version
	};
};
