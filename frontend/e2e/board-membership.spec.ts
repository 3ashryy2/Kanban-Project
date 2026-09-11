import { test, expect, Page } from '@playwright/test';

const BOARD_URL = /\/w\/\d+\/boards\/\d+/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password input', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
}

test.describe('Board membership', () => {

  test('a new board stays hidden from a developer until a PM adds them to it', async ({ browser }) => {
    // Two signed-in users and several full page loads: more than the default 30 s budget
    test.setTimeout(90_000);
    const title = `Private Board ${Date.now()}`;

    // 1. The PM creates a board and lands on its URL
    const pmContext = await browser.newContext();
    const pm = await pmContext.newPage();
    await signIn(pm, 'pm@valeo.com');
    await pm.click('button:has-text("New Board")');
    await pm.fill('#board-title', title);
    await pm.click('p-dialog button:has-text("Create Board")');
    await expect(pm.locator('.board-title')).toHaveText(title, { timeout: 10000 });
    const boardUrl = pm.url();

    // 2. The developer doesn't see it, and a direct link is refused with an explanation
    const devContext = await browser.newContext();
    const dev = await devContext.newPage();
    await signIn(dev, 'dev@valeo.com');
    await expect(dev.locator('.nav-list span', { hasText: 'Core Platform Roadmap' })).toBeVisible();
    await expect(dev.locator('.nav-list span', { hasText: title })).toHaveCount(0);

    await dev.goto(boardUrl);
    await expect(dev.locator('.p-toast-detail', { hasText: "You don't have access to that board." })).toBeVisible({ timeout: 10000 });
    await expect(dev).not.toHaveURL(boardUrl);

    // 3. The PM adds the developer to the board from the members page
    await pm.click('span:has-text("Workspace Members")');
    await expect(pm).toHaveURL(/\/w\/\d+\/members/, { timeout: 5000 });
    const devRow = pm.locator('.roster-row', { hasText: 'dev@valeo.com' });
    // The title sits on PrimeNG's <p-button> host element; click the real <button> inside it
    await devRow.locator('p-button[title="Manage boards"] button').click();
    // Open with the arrow: a click on the field's center would land on an existing board chip's remove icon
    await pm.locator('p-multiselect#member-boards .p-multiselect-dropdown').click();
    await pm.locator('.p-multiselect-option', { hasText: title }).click();
    await pm.locator('.p-dialog-header', { hasText: 'Board Access' }).click();   // close the options panel
    await pm.click('p-dialog button:has-text("Save Boards")');
    await expect(devRow.locator('p-tag', { hasText: title })).toBeVisible({ timeout: 5000 });

    // 4. The same link now opens for the developer
    await dev.goto(boardUrl);
    await expect(dev.locator('.board-title')).toHaveText(title, { timeout: 10000 });

    await pmContext.close();
    await devContext.close();
  });
});
