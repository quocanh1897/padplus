import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
	test('CORE-06: mobile viewport shows usable pad editor without horizontal scroll', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 375, height: 667 } // iPhone SE
		});
		const page = await context.newPage();

		const slug = `test-responsive-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();

		// Verify no horizontal overflow
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

		await context.close();
	});

	test('CORE-06: mobile viewport shows usable landing page URL bar', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 375, height: 667 }
		});
		const page = await context.newPage();

		await page.goto('/');

		// URL bar should be visible and not clipped
		const urlInput = page.locator('.url-input');
		await expect(urlInput).toBeVisible();

		const urlBar = page.locator('.url-bar');
		await expect(urlBar).toBeVisible();

		// Verify no horizontal overflow
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

		await context.close();
	});

	test('CORE-06: tablet viewport adjusts layout appropriately', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 768, height: 1024 } // iPad
		});
		const page = await context.newPage();

		const slug = `test-responsive-tablet-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();

		// Verify header is visible with all elements
		await expect(page.locator('.header')).toBeVisible();
		await expect(page.locator('.pad-name')).toBeVisible();
		await expect(page.locator('.save-status')).toBeVisible();

		// No horizontal overflow
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

		await context.close();
	});
});
