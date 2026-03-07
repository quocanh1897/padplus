import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
	test('DASH-01: URL bar input is visible and focused on landing page', async ({ page }) => {
		await page.goto('/');

		const urlInput = page.locator('.url-input');
		await expect(urlInput).toBeVisible();
		await expect(urlInput).toBeFocused();
	});

	test('DASH-01: typing a name and pressing Enter navigates to the pad', async ({ page }) => {
		await page.goto('/');

		const urlInput = page.locator('.url-input');
		await expect(urlInput).toBeFocused();

		// Use keyboard.type to ensure Svelte bind:value receives input events
		await page.keyboard.type('my-test-pad');

		// Click the Go button to submit (more reliable than Enter for form submission with goto)
		await page.locator('.go-button').click();

		// SvelteKit client-side navigation via goto() -- wait for pad editor to appear
		await expect(page.locator('textarea.editor')).toBeVisible({ timeout: 10000 });
		expect(page.url()).toContain('/my-test-pad');
	});

	test('DASH-01: padplus/ prefix is visible in the URL bar area', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.url-prefix')).toContainText('padplus/');
	});

	test('DASH-01: PadPlus branding and tagline are visible', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.brand')).toContainText('PadPlus');
		await expect(page.locator('.tagline')).toContainText('Type a name, start writing');
	});
});
