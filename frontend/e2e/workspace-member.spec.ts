import { test, expect } from '@playwright/test';

test.describe('F15: Workspace Membership & Role Provisioning', () => {

  test('should allow Admin to view and manage roles on workspace members page', async ({ page }) => {
    // Login as Admin
    await page.goto('/auth/login');
    await page.fill('#email', 'admin@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/w\/\d+\/boards\/\d+/, { timeout: 10000 });

    // Click "Workspace Members" in preferences section
    const membersLink = page.locator('span:has-text("Workspace Members")');
    await membersLink.click();

    // Verify redirected to settings view
    await expect(page).toHaveURL(/\/w\/\d+\/members/, { timeout: 5000 });

    // Roster title should render
    const settingsHeader = page.locator('.settings-header h2');
    await expect(settingsHeader).toHaveText('Workspace Member Provisioning');

    // "Add Member" button should be visible to Admin
    const addMemberBtn = page.locator('button:has-text("Add Member")');
    await expect(addMemberBtn).toBeVisible();

    // Verify roster listing of default seeded users
    const userRowDev = page.locator('.roster-row', { hasText: 'dev@valeo.com' });
    await expect(userRowDev).toBeVisible();
    await expect(userRowDev.locator('.role-badge')).toContainText('DEVELOPER');

    const userRowPM = page.locator('.roster-row', { hasText: 'pm@valeo.com' });
    await expect(userRowPM).toBeVisible();
    await expect(userRowPM.locator('.role-badge')).toContainText('PROJECT_MANAGER');
  });

  test('should restrict role management for Developer role', async ({ page }) => {
    // Login as Developer
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/w\/\d+\/boards\/\d+/, { timeout: 10000 });

    // Click "Workspace Members" link
    await page.click('span:has-text("Workspace Members")');
    await expect(page).toHaveURL(/\/w\/\d+\/members/, { timeout: 5000 });

    // "Add Member" button should NOT be visible to Developer
    const addMemberBtn = page.locator('button:has-text("Add Member")');
    await expect(addMemberBtn).not.toBeVisible();

    // Edit actions should not be visible or disabled (actions column is completely hidden based on *ngIf="canManageRoles")
    const actionsHeader = page.locator('th:has-text("Actions")');
    await expect(actionsHeader).not.toBeVisible();
  });
});
