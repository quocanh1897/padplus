import { test, expect } from '@playwright/test';

test.describe('Pad Creation', () => {
	test('CORE-01: navigating to any URL path creates a working pad', async ({ page }) => {
		const slug = `test-pad-creation-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await expect(textarea).toBeEditable();
	});

	test('CORE-02: SSR delivers content before JavaScript hydration', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		const slug = `test-ssr-${Date.now()}`;
		await page.goto(`/${slug}`);

		// Textarea should be rendered by SSR even without JS
		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();

		await context.close();
	});

	test('INFRA-01/02: nested slug creates a working pad', async ({ page }) => {
		const slug = `test/nested/pad-${Date.now()}`;
		await page.goto(`/${slug}`);

		const textarea = page.locator('textarea.editor');
		await expect(textarea).toBeVisible();
		await expect(textarea).toBeEditable();

		// Verify pad name appears in header
		await expect(page.locator('.pad-name')).toContainText(slug);
	});
});
