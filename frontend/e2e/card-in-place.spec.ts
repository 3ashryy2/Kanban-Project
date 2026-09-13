import { test, expect, Page, Locator } from '@playwright/test';

const BOARD_URL = /\/w\/\d+\/boards\/\d+/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password input', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
}

// A throwaway card in To-Do, so the seeded cards stay as they are
async function createCard(page: Page, title: string): Promise<Locator> {
  await page.locator('.kanban-column').nth(0).locator('.col-add-btn').click();
  await page.fill('#new-title', title);
  await page.click('button:has-text("Add Task")');
  const card = page.locator('.task-card', { hasText: title });
  await expect(card).toBeVisible({ timeout: 5000 });
  return card;
}

const patchTo = (page: Page, endpoint: string) =>
  page.waitForResponse(res => res.url().includes(endpoint) && res.request().method() === 'PATCH');

test.describe('Editing a card in place', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('a PM changes the assignee and priority on the card itself', async ({ page }) => {
    await signIn(page, 'pm@valeo.com');
    const title = `In-place ${Date.now()}`;
    const card = await createCard(page, title);

    // The assignee opens a small panel, not the Task Inspector
    const assigned = patchTo(page, '/assignee');
    await card.locator('.assignee-button').click();
    await page.locator('.p-popover .popover-option', { hasText: 'Mohanad Emad' }).click();
    expect((await assigned).ok()).toBeTruthy();
    await expect(card.locator('.assignee-name')).toHaveText('Mohanad');
    await expect(page.locator('.p-dialog', { hasText: 'Task Inspector' })).toHaveCount(0);

    const prioritised = patchTo(page, '/metadata');
    await expect(page.locator('.p-popover')).toHaveCount(0);
    await card.locator('button.priority-tag').click();
    await page.locator('.p-popover .popover-option', { hasText: 'URGENT' }).click();
    expect((await prioritised).ok()).toBeTruthy();
    await expect(card.locator('.priority-tag')).toHaveText('URGENT');

    // Both changes reached the server
    await page.reload();
    const reloaded = page.locator('.task-card', { hasText: title });
    await expect(reloaded.locator('.assignee-name')).toHaveText('Mohanad', { timeout: 10000 });
    await expect(reloaded.locator('.priority-tag')).toHaveText('URGENT');

    // A click on the rest of the card still opens the Task Inspector; delete the card from there
    await reloaded.locator('.card-title').click();
    await page.click('button:has-text("Delete Card")');
    await expect(reloaded).toHaveCount(0, { timeout: 5000 });
  });

  test('the assignee can be picked while creating a card', async ({ page }) => {
    await signIn(page, 'pm@valeo.com');
    const title = `Born assigned ${Date.now()}`;

    await page.locator('.kanban-column').nth(0).locator('.col-add-btn').click();
    await page.fill('#new-title', title);
    await page.locator('p-select#new-assignee').click();
    await page.locator('.p-select-option', { hasText: 'dev@valeo.com' }).click();
    await page.click('button:has-text("Add Task")');

    const card = page.locator('.task-card', { hasText: title });
    await expect(card.locator('.assignee-name')).toHaveText('Mohanad', { timeout: 5000 });

    await card.locator('.card-title').click();
    await page.click('button:has-text("Delete Card")');
    await expect(card).toHaveCount(0, { timeout: 5000 });
  });

  test('a developer is offered only themselves, and can hand the card back', async ({ page }) => {
    await signIn(page, 'dev@valeo.com');
    const title = `Take it ${Date.now()}`;
    const card = await createCard(page, title);

    await card.locator('.assignee-button').click();
    const options = page.locator('.p-popover .popover-option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('(you)');
    const taken = patchTo(page, '/assignee');
    await options.first().click();
    expect((await taken).ok()).toBeTruthy();
    await expect(card.locator('.assignee-name')).toHaveText('Mohanad');

    // Now that it's theirs, the panel offers Unassign. Reopen only once the first panel has finished closing:
    // PrimeNG ignores a click on the trigger while that animation runs
    await expect(page.locator('.p-popover')).toHaveCount(0);
    await card.locator('.assignee-button').click();
    const released = patchTo(page, '/assignee');
    await page.locator('.p-popover .popover-option', { hasText: 'Unassign' }).click();
    expect((await released).ok()).toBeTruthy();
    await expect(card.locator('.unassigned-badge')).toContainText('Unassigned');

    await card.locator('.card-title').click();
    await page.click('button:has-text("Delete Card")');
    await expect(card).toHaveCount(0, { timeout: 5000 });
  });
});
