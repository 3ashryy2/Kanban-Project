import { test, expect, Page } from '@playwright/test';

const BOARD_URL = /\/w\/\d+\/boards\/\d+/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password input', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
}

function idAfter(url: string, segment: string): number {
  return Number(url.match(new RegExp(`/${segment}/(\\d+)`))![1]);
}

test.describe('Board members and deleting boards and workspaces', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('a PM takes a developer off a board, then deletes the board', async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, 'pm@valeo.com');

    // A throwaway board, so the seeded board and its members stay as they are
    const title = `Temp Board ${Date.now()}`;
    await page.click('button:has-text("New Board")');
    await page.fill('#board-title', title);
    await page.click('p-dialog button:has-text("Create Board")');
    await expect(page.locator('.board-title')).toHaveText(title, { timeout: 10000 });
    const workspaceId = idAfter(page.url(), 'w');
    const boardId = idAfter(page.url(), 'boards');

    // Give the developer access through the API, keeping the boards they already have
    const token = await page.evaluate(() => localStorage.getItem('jwt_token'));
    const headers = { Authorization: `Bearer ${token}` };
    const members = await (await page.request.get(`/api/workspaces/${workspaceId}/members`, { headers })).json();
    const dev = members.find((m: { email: string }) => m.email === 'dev@valeo.com');
    const boardIds = [...dev.boards.map((b: { id: number }) => b.id), boardId];
    const granted = await page.request.put(`/api/workspaces/${workspaceId}/members/${dev.userId}/boards`, { headers, data: { boardIds } });
    expect(granted.ok()).toBeTruthy();

    // The page loaded the member list before that change
    await page.reload();
    await expect(page.locator('.board-title')).toHaveText(title, { timeout: 10000 });

    await page.locator('.bar-right button', { hasText: 'Members' }).click();
    const membersDialog = page.locator('.p-dialog', { hasText: 'Board Members' });
    const devRow = membersDialog.locator('.person-row', { hasText: 'dev@valeo.com' });
    await expect(devRow).toBeVisible({ timeout: 5000 });
    // PMs open every board by role, so there is nothing to take them off
    await expect(membersDialog.locator('.person-row', { hasText: 'pm@valeo.com' }).locator('button')).toHaveCount(0);

    await devRow.locator('button', { hasText: 'Remove' }).click();
    await page.locator('.p-dialog button', { hasText: 'Remove from board' }).click();
    await expect(devRow).toHaveCount(0, { timeout: 5000 });

    // Close the Members dialog with its ✕ (Escape doesn't reach it once the confirmation has taken focus), then delete the board
    await membersDialog.locator('.p-dialog-header button').click();
    await expect(membersDialog).toBeHidden();
    await page.locator('.bar-right button', { hasText: 'Delete Board' }).click();
    await page.locator('.p-dialog button', { hasText: 'Delete board' }).click();

    await expect(page.locator('.p-toast-detail', { hasText: title })).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL(new RegExp(`/boards/${boardId}$`), { timeout: 5000 });
    await expect(page.locator('.nav-list span', { hasText: title })).toHaveCount(0);
  });

  test('the admin deletes a workspace after typing its name', async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, 'admin@valeo.com');

    const name = `Temp Workspace ${Date.now()}`;
    await page.click('button:has-text("New Workspace")');
    await page.fill('#ws-name', name);
    await page.click('p-dialog button:has-text("Create Workspace")');
    await expect(page).toHaveURL(/\/w\/\d+$/, { timeout: 10000 });
    const workspaceId = idAfter(page.url(), 'w');

    await page.click('span:has-text("Workspace Members")');
    await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/members`), { timeout: 5000 });
    await page.locator('.danger-zone button', { hasText: 'Delete Workspace' }).click();

    // The delete button stays disabled until the name is typed exactly
    const confirmButton = page.locator('.p-dialog button', { hasText: 'Delete Workspace' });
    await expect(confirmButton).toBeDisabled();
    await page.fill('#confirm-workspace-name', name);
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.locator('.p-toast-detail', { hasText: name })).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL(new RegExp(`/w/${workspaceId}(/|$)`), { timeout: 10000 });

    // Gone for good: the server no longer knows it
    const token = await page.evaluate(() => localStorage.getItem('jwt_token'));
    const lookup = await page.request.get(`/api/workspaces/${workspaceId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(lookup.ok()).toBeFalsy();
  });
});
