import { diff3Merge } from 'node-diff3';

export interface MergeResult {
	success: boolean; // true = clean merge, false = had conflicts (best-effort concatenation)
	content: string; // merged text content
}

/**
 * Perform a three-way merge of text content.
 * @param base - Common ancestor content (base_content from DB)
 * @param server - Current server content (latest saved version)
 * @param client - Client's content (what the user is trying to save)
 * @returns Merged result with success indicator
 */
export function mergeText(base: string, server: string, client: string): MergeResult {
	// Split into lines for line-level merge
	const baseLines = base.split('\n');
	const serverLines = server.split('\n');
	const clientLines = client.split('\n');

	// diff3Merge(a, o, b) where a and b are independently derived from o (origin/base)
	// a = client (the version being merged in), o = base (common ancestor), b = server (current)
	const regions = diff3Merge(clientLines, baseLines, serverLines, {
		excludeFalseConflicts: true
	});

	let hasConflict = false;
	const merged: string[] = [];

	for (const region of regions) {
		if (region.ok) {
			merged.push(...region.ok);
		} else if (region.conflict) {
			hasConflict = true;
			// Best-effort: include both versions (client first, then server)
			// Per CONTEXT.md: "let the merge algorithm decide -- result may concatenate both"
			merged.push(...region.conflict.a); // client's version
			merged.push(...region.conflict.b); // server's version
		}
	}

	return {
		success: !hasConflict,
		content: merged.join('\n')
	};
}
