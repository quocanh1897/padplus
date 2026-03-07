// Import database module to trigger initialization on server start
import '$lib/server/db';

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
