const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '') || DEFAULT_MAX_FILE_SIZE;
export const MAX_PAD_FILE_QUOTA = parseInt(process.env.MAX_PAD_FILE_QUOTA || '') || 1024 * 1024 * 1024; // 1GB

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
	if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
	return `${Math.round(bytes / 1024)}KB`;
}
