import path from 'node:path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');

export function getUploadDir(padId: number | string): string {
	return path.join(UPLOAD_DIR, String(padId));
}

export function getUploadFilePath(padId: number | string, filename: string): string {
	return path.join(UPLOAD_DIR, String(padId), filename);
}
