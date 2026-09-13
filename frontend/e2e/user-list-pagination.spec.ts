import { test, expect, Page } from '@playwright/test';

const BOARD_URL = /\/w\/\d+\/boards\/\d+/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password input', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
}

// The pages are real, but the lists are made up: each test answers the list's request itself (page.route),
// so the dev database doesn't need two dozen extra accounts
const waiting = Array.from({ length: 23 }, (_, i) => ({
  id: 9000 + i,
  email: `waiting${i + 1}@example.com`,
  firstName: 'Waiting',
  lastName: `Person ${i + 1}`,
  createdAt: '2026-09-01T09:00:00Z'
}));

const roster = Array.from({ length: 23 }, (_, i) => ({
  membershipId: 9000 + i,
  workspaceId: 1,
  userId: 9000 + i,
  email: `member${i + 1}@example.com`,
  firstName: 'Team',
  lastName: `Member ${i + 1}`,
  role: 'ROLE_DEVELOPER',
  joinedAt: '2026-09-01T09:00:00Z',
  allBoards: false,
  // Every other person is on a board, so the "Without boards" filter keeps 12 of the 23
  boards: i % 2 === 1 ? [{ id: 1, title: 'Core Platform Roadmap' }] : []
}));

test.describe('Paging through user lists', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('User Onboarding shows ten people a page, and picks survive paging', async ({ page }) => {
    await page.route('**/api/admin/users/unassigned', route => route.fulfill({ json: waiting }));
    await signIn(page, 'admin@valeo.com');
    await page.goto('/admin/users');

    const rows = page.locator('.user-row');
    const pager = page.locator('.list-pager');
    await expect(rows).toHaveCount(10, { timeout: 10000 });
    await expect(pager.locator('.p-paginator-current')).toHaveText('1–10 of 23');

    // A workspace picked on page 1 is still picked after a visit to page 2
    await rows.first().locator('p-select').first().click();
    await page.locator('.p-select-overlay .p-select-option').first().click();
    await pager.locator('.p-paginator-next').click();
    await expect(rows.first()).toContainText('Waiting Person 11');
    await pager.locator('.p-paginator-prev').click();
    await expect(rows.first().getByRole('button', { name: 'Grant Access' })).toBeEnabled();

    // The last page holds the remaining three
    await pager.locator('.p-paginator-last').click();
    await expect(rows).toHaveCount(3);
    await expect(pager.locator('.p-paginator-current')).toHaveText('21–23 of 23');

    // 25 a page: everyone fits, back on the first page
    await pager.locator('.p-paginator-rpp-dropdown').click();
    await page.locator('.p-select-overlay .p-select-option', { hasText: '25' }).click();
    await expect(rows).toHaveCount(23);
    await expect(pager.locator('.p-paginator-current')).toHaveText('1–23 of 23');
  });

  test('the workspace roster pages, and the filter starts again from page 1', async ({ page }) => {
    // Only the roster's GET is made up; anything else about members goes to the real server
    await page.route('**/api/workspaces/*/members', route =>
      route.request().method() === 'GET' ? route.fulfill({ json: roster }) : route.continue());
    await signIn(page, 'pm@valeo.com');
    const workspaceId = page.url().match(/\/w\/(\d+)/)![1];
    await page.goto(`/w/${workspaceId}/members`);

    const rows = page.locator('.roster-row');
    const pager = page.locator('.list-pager');
    await expect(rows).toHaveCount(10, { timeout: 10000 });
    await expect(pager.locator('.p-paginator-current')).toHaveText('1–10 of 23');

    await pager.locator('.p-paginator-next').click();
    await expect(rows.first()).toContainText('Team Member 11');

    // Filtering from page 2 goes back to page 1 of the filtered list
    await page.locator('label[for="unassigned-only"]').click();
    await expect(pager.locator('.p-paginator-current')).toHaveText('1–10 of 12');
    await expect(rows.first()).toContainText('Team Member 1');

    await pager.locator('.p-paginator-last').click();
    await expect(rows).toHaveCount(2);
    await expect(pager.locator('.p-paginator-current')).toHaveText('11–12 of 12');
  });
});
