import { test, expect } from '@playwright/test';

/**
 * Helper: type text into the pad editor and wait for save to complete.
 * Returns the version from the save response.
 */
async function typeAndWaitForSave(
	page: import('@playwright/test').Page,
	text: string
): Promise<number> {
	const textarea = page.locator('textarea.editor');

	// Wait for network to settle (ensures JS bundles are loaded and hydration complete)
	await page.waitForLoadState('networkidle');

	const savePromise = page.waitForResponse(
		(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
		{ timeout: 10000 }
	);

	await page.keyboard.type(text);
	await expect(textarea).not.toHaveValue('', { timeout: 2000 });
	const response = await savePromise;
	const body = await response.json();

	await expect(page.locator('.save-status[data-status="saved"]')).toBeVisible({
		timeout: 5000
	});

	return body.version;
}

test.describe('Conflict Handling', () => {
	test('CORE-04/COLLAB-01: stale save shows conflict banner', async ({ page }) => {
		const slug = `test-conflict-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		const savedVersion = await typeAndWaitForSave(page, 'version A from user');

		// Simulate another user saving via API with the saved version
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: {
				content: 'version B from another user',
				version: savedVersion
			}
		});
		expect(apiResponse.ok()).toBe(true);

		// Now type again to trigger a stale save (our local version is stale, server has been bumped)
		await page.keyboard.type(' updated');

		// The save should fail with 409, triggering the conflict banner
		await expect(page.locator('.conflict-banner')).toBeVisible({
			timeout: 5000
		});
	});

	test('CORE-04: conflict banner shows overwrite and copy-reload buttons', async ({ page }) => {
		const slug = `test-conflict-btns-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		const savedVersion = await typeAndWaitForSave(page, 'original content');

		// Create conflict via API using the saved version
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: { content: 'server override', version: savedVersion }
		});
		expect(apiResponse.ok()).toBe(true);

		// Trigger stale save
		await page.keyboard.type(' edited');
		await expect(page.locator('.conflict-banner')).toBeVisible({ timeout: 5000 });

		// Verify both buttons are present
		await expect(page.locator('.btn-danger')).toContainText('Overwrite with my version');
		await expect(page.locator('.btn-secondary')).toContainText('Copy my version');
	});

	test('CORE-04: clicking overwrite resolves conflict and persists user content', async ({
		page
	}) => {
		const slug = `test-conflict-resolve-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		const savedVersion = await typeAndWaitForSave(page, 'my important text');

		// Create conflict via API using the saved version
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: { content: 'someone else wrote this', version: savedVersion }
		});
		expect(apiResponse.ok()).toBe(true);

		// Trigger stale save by typing more
		await page.keyboard.type(' final');
		await expect(page.locator('.conflict-banner')).toBeVisible({ timeout: 5000 });

		// Click overwrite -- this triggers a save with the server's version
		const overwriteSave = page.waitForResponse(
			(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT'
		);
		await page.locator('.btn-danger').click();
		await overwriteSave;

		// Banner should disappear
		await expect(page.locator('.conflict-banner')).not.toBeVisible({ timeout: 5000 });

		// Wait for save to complete
		await expect(page.locator('.save-status[data-status="saved"]')).toBeVisible({
			timeout: 5000
		});

		// Reload and verify our content persisted
		await page.reload();
		await expect(textarea).toHaveValue('my important text final');
	});
});
