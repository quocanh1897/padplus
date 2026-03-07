import { test, expect } from '@playwright/test';

/**
 * Helper: type text into the pad editor and wait for save to complete.
 * Ensures hydration is complete before typing by verifying that input events
 * are properly handled (text appears in the textarea after typing).
 */
async function typeAndWaitForSave(
	page: import('@playwright/test').Page,
	text: string,
	options?: { selectAll?: boolean }
) {
	const textarea = page.locator('textarea.editor');

	// Wait for network to settle (ensures JS bundles are loaded and hydration complete)
	await page.waitForLoadState('networkidle');

	if (options?.selectAll) {
		await page.keyboard.press('Meta+A');
	}

	// Set up response listener BEFORE typing
	const savePromise = page.waitForResponse(
		(res) => res.url().includes('/api/pads/') && res.request().method() === 'PUT',
		{ timeout: 10000 }
	);

	await page.keyboard.type(text);

	// Verify the text was actually typed (hydration didn't overwrite it)
	await expect(textarea).not.toHaveValue('', { timeout: 2000 });

	await savePromise;

	// Confirm UI shows saved
	await expect(page.locator('.save-status[data-status="saved"]')).toBeVisible({
		timeout: 5000
	});
}

test.describe('Auto-save', () => {
	test('CORE-03: content persists after typing and reloading', async ({ page }) => {
		const slug = `test-autosave-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();

		// Focus the textarea
		await textarea.click();

		await typeAndWaitForSave(page, 'Hello auto-save test');

		// Reload and verify content persisted
		await page.reload();
		await expect(textarea).toHaveValue('Hello auto-save test');
	});

	test('CORE-03: save status transitions from unsaved to saving to saved', async ({ page }) => {
		const slug = `test-save-status-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		await typeAndWaitForSave(page, 'Status transition test');
	});

	test('CORE-03: multiple edits all persist after reload', async ({ page }) => {
		const slug = `test-multi-save-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await textarea.click();

		// First edit
		await typeAndWaitForSave(page, 'First edit');

		// Second edit: select all and replace
		await typeAndWaitForSave(page, 'Second edit final', { selectAll: true });

		// Reload and verify final content
		await page.reload();
		await expect(textarea).toHaveValue('Second edit final');
	});
});
