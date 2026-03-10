import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const BASE_URL = process.env.DOCKER_TEST_URL || 'http://localhost:3198';
const CONTAINER_NAME = 'padplus-e2e-test';

test.use({ baseURL: BASE_URL });

/**
 * Wait for the container health check to pass after a restart.
 * Polls the /health endpoint up to `maxWaitSec` seconds.
 */
function waitForHealth(maxWaitSec = 30): void {
	const deadline = Date.now() + maxWaitSec * 1000;
	while (Date.now() < deadline) {
		try {
			const result = execSync(`curl -sf ${BASE_URL}/health`, { timeout: 3000 });
			if (result.toString().includes('ok')) return;
		} catch {
			// Not ready yet
		}
		execSync('sleep 1');
	}
	throw new Error(`Health check did not pass within ${maxWaitSec}s after restart`);
}

test.describe.serial('Docker Deployment', () => {
	// Shared slug for persistence tests (c) and (d)
	const persistSlug = `docker-persist-${Date.now()}`;
	const persistContent = `Docker persistence test content ${Date.now()}`;

	test('app is accessible after docker run', async ({ page }) => {
		const response = await page.goto('/');
		expect(response).not.toBeNull();
		expect(response!.status()).toBe(200);

		// Verify landing page contains the URL input bar
		await expect(page.locator('input[type="text"], input[placeholder]')).toBeVisible({
			timeout: 10000
		});
	});

	test('health check endpoint responds', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/health`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body).toEqual({ status: 'ok' });
	});

	test('can create and save a pad', async ({ page, request }) => {
		// Set pad to last-save-wins mode so auto-save uses the PUT API
		// (default mode is real-time which saves via WebSocket/Yjs)
		await page.goto(`/${persistSlug}`);
		await expect(page.locator('textarea.editor')).toBeVisible({ timeout: 10000 });

		const patchRes = await request.patch(`${BASE_URL}/api/pads/${persistSlug}/mode`, {
			data: { mode: 'last-save-wins' }
		});
		expect(patchRes.ok()).toBe(true);

		// Reload to pick up last-save-wins mode
		await page.reload();

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible({ timeout: 10000 });

		// Wait for hydration
		await page.waitForLoadState('networkidle');
		await textarea.click();

		// Set up save response listener before typing
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
			{ timeout: 15000 }
		);

		await page.keyboard.type(persistContent);
		await savePromise;

		// Reload and verify content persisted
		await page.reload();
		await expect(textarea).toHaveValue(persistContent, { timeout: 10000 });
	});

	test('data persists across container restart', async ({ page }) => {
		// Restart the Docker container
		execSync(`docker restart ${CONTAINER_NAME}`, { timeout: 30000 });

		// Wait for health check to pass after restart
		waitForHealth(30);

		// Navigate to the same pad
		await page.goto(`/${persistSlug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible({ timeout: 10000 });

		// Verify the content survived the restart
		await expect(textarea).toHaveValue(persistContent, { timeout: 10000 });
	});

	test('websocket connects for real-time mode', async ({ page, request }) => {
		const wsSlug = `docker-ws-${Date.now()}`;

		// Create the pad by navigating to it
		await page.goto(`/${wsSlug}`);
		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible({ timeout: 10000 });

		// Set mode to real-time via API
		const patchResponse = await request.patch(`${BASE_URL}/api/pads/${wsSlug}/mode`, {
			data: { mode: 'real-time' }
		});
		expect(patchResponse.ok()).toBe(true);

		// Reload to pick up real-time mode
		await page.reload();

		// Wait for the connection dot to appear (proves WebSocket connected through Docker port mapping)
		const dot = page.locator('.connection-dot');
		await expect(dot).toBeVisible({ timeout: 10000 });
	});
});
