import { json, error } from '@sveltejs/kit';
import { updateImageOrder } from '$lib/server/images';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { orders } = body as { orders: unknown };

	if (!Array.isArray(orders) || orders.length === 0) {
		error(400, 'Orders must be a non-empty array');
	}

	// Validate each order entry
	for (const order of orders) {
		if (
			typeof order !== 'object' ||
			order === null ||
			typeof (order as { uuid: unknown }).uuid !== 'string' ||
			typeof (order as { sort_order: unknown }).sort_order !== 'number'
		) {
			error(400, 'Each order must have uuid (string) and sort_order (number)');
		}
	}

	updateImageOrder(orders as { uuid: string; sort_order: number }[]);

	return json({ updated: true });
};
