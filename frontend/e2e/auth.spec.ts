import { test, expect } from '@playwright/test';

test.describe('F10: Authentication and Session Lifecycle', () => {

  test('should fail login with invalid credentials and show error toast', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'nonexistent@valeo.com');
    await page.fill('#password input', 'wrongpassword');
    await page.click('button[type="submit"]');

    const toastMessage = page.locator('.p-toast-detail');
    await expect(toastMessage).toBeVisible({ timeout: 5000 });
    await expect(toastMessage).toContainText('Invalid corporate email or password.');
  });

  test('should login successfully as ROLE_DEVELOPER, see role badge, and sign out', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    // Verification of redirect and board view
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Verify Active Tenant info and role badge
    const activeWsHeader = page.locator('.active-ws-details h4');
    await expect(activeWsHeader).toContainText('Driving Assistance Research');

    const roleChip = page.locator('.role-chip');
    await expect(roleChip).toContainText('ROLE_DEVELOPER');

    // Sign out flow using robust footer button selector
    await page.click('.sidebar-footer button');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test('should login successfully as ROLE_PROJECT_MANAGER and see role badge', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'pm@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    const roleChip = page.locator('.role-chip');
    await expect(roleChip).toContainText('ROLE_PROJECT_MANAGER');
  });

  test('should login successfully as global Admin (no workspace membership) and see ADMIN badge', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'admin@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    const roleChip = page.locator('.role-chip');
    await expect(roleChip).toContainText('ADMIN');

    // Admin-only navigation is available
    await expect(page.locator('span:has-text("User Onboarding")')).toBeVisible();
    await expect(page.locator('span:has-text("Global Audit Logs")')).toBeVisible();
  });
});
