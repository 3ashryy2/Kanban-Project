import { test, expect } from '@playwright/test';

test.describe('F1: Workspace & Board Administration', () => {

  test('should allow Project Manager to create a new board', async ({ page }) => {
    // Login as PM
    await page.goto('/auth/login');
    await page.fill('#email', 'pm@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Click "New Board" button in sidebar
    const newBoardBtn = page.locator('button:has-text("New Board")');
    await expect(newBoardBtn).toBeVisible();
    await newBoardBtn.click();

    // Verify dialog is visible
    const dialogHeader = page.locator('.p-dialog-title');
    await expect(dialogHeader).toBeVisible();
    await expect(dialogHeader).toHaveText('Create New Board');

    // Fill in board details
    const uniqueTitle = `Sprint Roadmap - ${Date.now()}`;
    await page.fill('#board-title', uniqueTitle);
    await page.fill('#board-desc', 'Automated E2E board creation testing.');

    // Click "Create Board" button in dialog footer
    await page.click('p-dialog button:has-text("Create Board")');

    // Verification: dialog should close and redirect to new board
    await expect(dialogHeader).not.toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Board title should match the new title
    const boardTitle = page.locator('.board-title');
    await expect(boardTitle).toHaveText(uniqueTitle);

    // Verify it is listed in the sidebar list
    const sidebarBoardLink = page.locator(`.nav-list span:has-text("${uniqueTitle}")`);
    await expect(sidebarBoardLink).toBeVisible();
  });

  test('should disable board creation for Developer role', async ({ page }) => {
    // Login as Developer
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // "New Board" button should be disabled for non-PMs
    const newBoardBtn = page.locator('button:has-text("New Board")');
    await expect(newBoardBtn).toBeDisabled();
  });
});
