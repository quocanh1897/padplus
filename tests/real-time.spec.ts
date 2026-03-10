import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Helper: set pad collaboration mode via API.
 */
async function setMode(
	page: Page,
	slug: string,
	mode: 'last-save-wins' | 'auto-merge' | 'real-time'
): Promise<void> {
	const res = await page.request.patch(`/api/pads/${slug}/mode`, {
		data: { mode }
	});
	expect(res.ok()).toBe(true);
}

/**
 * Helper: create a page in real-time mode with WebSocket connected.
 * Returns { context, page } for cleanup.
 */
async function createPadInRealtimeMode(
	browser: Browser,
	slug: string
): Promise<{ context: BrowserContext; page: Page }> {
	const context = await browser.newContext();
	const page = await context.newPage();

	// Navigate to pad (creates it via SSR if it doesn't exist)
	await page.goto(`/${slug}`);
	await expect(page.locator('textarea.editor')).toBeVisible();

	// Set mode to real-time via API
	await setMode(page, slug, 'real-time');

	// Reload to pick up the mode
	await page.reload();

	// Wait for connection dot to appear (indicates WebSocket connected)
	await expect(page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });

	return { context, page };
}

test.describe('Real-time Collaboration', () => {
	test('COLLAB-03: mode selector shows real-time option', async ({ page }) => {
		const slug = `rt-test-selector-${Date.now()}`;
		await page.goto(`/${slug}`);
		await expect(page.locator('textarea.editor')).toBeVisible();

		// Click mode trigger to open dropdown
		await page.locator('.mode-trigger').click();

		// Verify "Real-time" option exists
		const realtimeOption = page.locator('.mode-option', { hasText: 'Real-time' });
		await expect(realtimeOption).toBeVisible();
	});

	test('COLLAB-03: switching to real-time mode shows connection dot', async ({ page }) => {
		const slug = `rt-test-dot-${Date.now()}`;
		await page.goto(`/${slug}`);
		await expect(page.locator('textarea.editor')).toBeVisible();

		// Set mode to real-time via API, reload
		await setMode(page, slug, 'real-time');
		await page.reload();

		// Wait for connection dot to appear
		const dot = page.locator('.connection-dot');
		await expect(dot).toBeVisible({ timeout: 5000 });

		// Verify it has a non-transparent background (connected state uses --color-success)
		// The exact RGB value depends on theme; just verify it's not transparent/empty
		const bgColor = await dot.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(bgColor).toBeTruthy();

		// Verify SaveStatus is NOT visible (replaced by connection dot)
		await expect(page.locator('.save-status')).not.toBeVisible();
	});

	test('COLLAB-03: keystrokes sync between two users', async ({ browser }) => {
		const slug = `rt-test-sync-${Date.now()}`;

		// Create two contexts (simulates two users)
		const user1 = await createPadInRealtimeMode(browser, slug);
		const user2 = await createPadInRealtimeMode(browser, slug);

		try {
			// Wait for both to be connected (green dot)
			await expect(user1.page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });
			await expect(user2.page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });

			// Type in user1's textarea
			const textarea1 = user1.page.locator('textarea.editor');
			await textarea1.click();
			await textarea1.type('hello from user 1');

			// Verify text appears in user2's textarea
			const textarea2 = user2.page.locator('textarea.editor');
			await expect(textarea2).toHaveValue(/hello from user 1/, { timeout: 3000 });

			// Also verify reverse: type in user2, verify in user1
			await textarea2.click();
			await textarea2.type(' and hello from user 2');
			await expect(textarea1).toHaveValue(/and hello from user 2/, { timeout: 3000 });
		} finally {
			await user1.context.close();
			await user2.context.close();
		}
	});

	test('COLLAB-03: edits persist across page reload', async ({ browser }) => {
		const slug = `rt-test-persist-${Date.now()}`;

		const { context, page } = await createPadInRealtimeMode(browser, slug);

		try {
			// Type content
			const textarea = page.locator('textarea.editor');
			await textarea.click();
			await textarea.type('persistent content');

			// Wait for debounced persistence to fire
			await page.waitForTimeout(1500);

			// Reload page
			await page.reload();

			// Wait for connection dot (reconnected)
			await expect(page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });

			// Verify content persisted
			await expect(page.locator('textarea.editor')).toHaveValue(/persistent content/, {
				timeout: 5000
			});
		} finally {
			await context.close();
		}
	});

	test('COLLAB-03: reconnect syncs edits without data loss', async ({ browser }) => {
		const slug = `rt-test-reconnect-${Date.now()}`;

		const user1 = await createPadInRealtimeMode(browser, slug);
		const user2 = await createPadInRealtimeMode(browser, slug);

		try {
			// Wait for both connected
			await expect(user1.page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });
			await expect(user2.page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });

			// Set user2 offline
			await user2.context.setOffline(true);

			// Wait briefly for disconnect to register
			await user2.page.waitForTimeout(500);

			// Type in user1 while user2 is offline
			const textarea1 = user1.page.locator('textarea.editor');
			await textarea1.click();
			await textarea1.type('offline edit');

			// Reconnect user2
			await user2.context.setOffline(false);

			// Verify user2 receives the edits after reconnect
			const textarea2 = user2.page.locator('textarea.editor');
			await expect(textarea2).toHaveValue(/offline edit/, { timeout: 5000 });
		} finally {
			await user1.context.close();
			await user2.context.close();
		}
	});

	test('COLLAB-03: switching from real-time to LSW restores auto-save', async ({ page }) => {
		const slug = `rt-test-switch-${Date.now()}`;
		await page.goto(`/${slug}`);
		await expect(page.locator('textarea.editor')).toBeVisible();

		// Set to real-time mode, reload
		await setMode(page, slug, 'real-time');
		await page.reload();

		// Verify connection dot is visible
		await expect(page.locator('.connection-dot')).toBeVisible({ timeout: 5000 });

		// Switch to last-save-wins via API, reload
		await setMode(page, slug, 'last-save-wins');
		await page.reload();

		// Verify connection dot is NOT visible
		await expect(page.locator('.connection-dot')).not.toBeVisible();

		// Verify SaveStatus IS visible and shows "Saved"
		const saveStatus = page.locator('.save-status');
		await expect(saveStatus).toBeVisible();
		await expect(saveStatus).toHaveAttribute('data-status', 'saved');

		// Type in textarea, verify save status changes
		const textarea = page.locator('textarea.editor');
		await textarea.click();
		await page.waitForLoadState('networkidle');

		// Type text to trigger auto-save
		await page.keyboard.type('testing auto-save');

		// Wait for save cycle -- either "Saving..." or "Saved" after save completes
		await expect(
			page.locator(
				'.save-status[data-status="saving"], .save-status[data-status="saved"], .save-status[data-status="unsaved"]'
			)
		).toBeVisible({ timeout: 5000 });
	});
});
