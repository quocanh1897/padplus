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

	await expect(
		page.locator('.save-status[data-status="saved"], .save-status[data-status="merged"]')
	).toBeVisible({
		timeout: 5000
	});

	return body.version;
}

/**
 * Helper: change collaboration mode via API.
 */
async function setMode(
	page: import('@playwright/test').Page,
	slug: string,
	mode: 'last-save-wins' | 'auto-merge'
): Promise<void> {
	const res = await page.request.patch(`/api/pads/${slug}/mode`, {
		data: { mode }
	});
	expect(res.ok()).toBe(true);
}

test.describe('Auto-Merge Collaboration', () => {
	test('COLLAB-04: mode selector shows current mode and allows switching', async ({ page }) => {
		const slug = `test-mode-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();

		// Verify the mode trigger shows "Last-save-wins" (default)
		const modeTrigger = page.locator('.mode-trigger');
		await expect(modeTrigger).toContainText('Last-save-wins');

		// Click the mode trigger to open dropdown
		await modeTrigger.click();

		// Click "Auto-merge" option
		const autoMergeOption = page.locator('.mode-option', { hasText: 'Auto-merge' });
		await expect(autoMergeOption).toBeVisible();

		// Wait for the PATCH response when selecting
		const patchPromise = page.waitForResponse(
			(res) => res.url().includes('/mode') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		);
		await autoMergeOption.click();
		const patchRes = await patchPromise;
		expect(patchRes.ok()).toBe(true);

		// Verify the mode trigger now shows "Auto-merge"
		await expect(modeTrigger).toContainText('Auto-merge');

		// Reload the page
		await page.reload();
		await expect(textarea).toBeVisible();

		// Verify the mode trigger still shows "Auto-merge" (persists)
		await expect(page.locator('.mode-trigger')).toContainText('Auto-merge');
	});

	test('COLLAB-02: concurrent edits on auto-merge pad produce merged result instead of conflict', async ({
		page
	}) => {
		const slug = `test-merge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		// Set mode to auto-merge via API
		await setMode(page, slug, 'auto-merge');
		// Reload to get fresh mode state
		await page.reload();
		await expect(textarea).toBeVisible();
		await textarea.click();
		await page.waitForLoadState('networkidle');

		// Type initial content and save
		const savedVersion = await typeAndWaitForSave(page, 'Line 1\nLine 2\nLine 3');

		// Simulate another user saving via API (creates version mismatch)
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: {
				content: 'Line 1\nLine 2 modified\nLine 3',
				version: savedVersion
			}
		});
		expect(apiResponse.ok()).toBe(true);

		// Now type more locally -- triggers a stale save which should auto-merge (not 409)
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
			{ timeout: 10000 }
		);
		await page.keyboard.type('\nLine 4');
		const saveRes = await savePromise;

		// Verify the response is 200 with merged:true (not 409 conflict)
		expect(saveRes.status()).toBe(200);
		const saveBody = await saveRes.json();
		expect(saveBody.merged).toBe(true);
		expect(saveBody.content).toBeDefined();
		expect(saveBody.version).toBeGreaterThan(savedVersion);

		// Verify save status shows "Merged" briefly
		await expect(page.locator('.save-status[data-status="merged"]')).toBeVisible({
			timeout: 5000
		});

		// Verify no conflict banner appeared (unlike last-save-wins mode)
		await expect(page.locator('.conflict-banner')).not.toBeVisible({ timeout: 1000 });
	});

	test('COLLAB-02: last-save-wins pad still returns conflict on version mismatch', async ({
		page
	}) => {
		const slug = `test-lsw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		// Type and save (default mode is last-save-wins)
		const savedVersion = await typeAndWaitForSave(page, 'original content');

		// Simulate another user saving via API
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: {
				content: 'another user content',
				version: savedVersion
			}
		});
		expect(apiResponse.ok()).toBe(true);

		// Type more (triggers stale save)
		await page.keyboard.type(' updated');

		// Verify conflict banner appears (409 behavior unchanged)
		await expect(page.locator('.conflict-banner')).toBeVisible({
			timeout: 5000
		});
	});

	test('COLLAB-04: mode change persists and affects merge behavior', async ({ page }) => {
		const slug = `test-mode-merge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		// Type content and save
		const savedVersion = await typeAndWaitForSave(page, 'line A\nline B');

		// Switch mode to auto-merge via the UI dropdown
		const modeTrigger = page.locator('.mode-trigger');
		await modeTrigger.click();
		const autoMergeOption = page.locator('.mode-option', { hasText: 'Auto-merge' });
		const patchPromise = page.waitForResponse(
			(res) => res.url().includes('/mode') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		);
		await autoMergeOption.click();
		await patchPromise;

		// Re-focus the textarea after clicking the dropdown
		await textarea.click();

		// Simulate another user saving via API with the saved version
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: {
				content: 'line A modified\nline B',
				version: savedVersion
			}
		});
		expect(apiResponse.ok()).toBe(true);

		// Type more (triggers merge on stale save)
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
			{ timeout: 10000 }
		);
		await page.keyboard.type('\nline C');
		const saveRes = await savePromise;

		// Verify merge happened (200 with merged:true, not 409 conflict)
		expect(saveRes.status()).toBe(200);
		const saveBody = await saveRes.json();
		expect(saveBody.merged).toBe(true);

		// Ensure conflict banner did NOT appear
		await expect(page.locator('.conflict-banner')).not.toBeVisible({ timeout: 2000 });

		// Verify save status shows "Merged" or transitions to "Saved"
		await expect(
			page.locator('.save-status[data-status="merged"], .save-status[data-status="saved"]')
		).toBeVisible({ timeout: 5000 });
	});

	test('COLLAB-02: auto-merge handles completely different content without conflict banner', async ({
		page
	}) => {
		const slug = `test-diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		// Set mode to auto-merge via API
		await setMode(page, slug, 'auto-merge');
		await page.reload();
		await expect(textarea).toBeVisible();
		await textarea.click();
		await page.waitForLoadState('networkidle');

		// Type initial content and save
		const savedVersion = await typeAndWaitForSave(page, 'Hello World');

		// Simulate another user saving completely different content
		const apiResponse = await page.request.put(`/api/pads/${slug}`, {
			data: {
				content: 'Goodbye Earth',
				version: savedVersion
			}
		});
		expect(apiResponse.ok()).toBe(true);

		// Clear and type different content locally
		await textarea.fill('');
		// Need to type at least one character for the debounce to trigger
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
			{ timeout: 10000 }
		);
		await page.keyboard.type('Different content entirely');
		const saveRes = await savePromise;

		// Verify auto-merge succeeds (200, not 409) -- key difference from last-save-wins
		expect(saveRes.status()).toBe(200);
		const saveBody = await saveRes.json();
		expect(saveBody.merged).toBe(true);

		// On auto-merge, even radically different content succeeds without conflict banner
		// The merge produces a best-effort result
		await expect(
			page.locator('.save-status[data-status="merged"], .save-status[data-status="saved"]')
		).toBeVisible({ timeout: 5000 });
	});
});
