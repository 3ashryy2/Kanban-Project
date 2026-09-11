import { test, expect } from '@playwright/test';

test.describe('F15: Onboarding newly registered users', () => {

  test('new user waits on onboarding until an admin grants workspace access', async ({ page, browser }) => {
    const email = `joiner.${Date.now()}@valeo.com`;

    // 1. Register: with no workspace the user lands on the onboarding page
    await page.goto('/auth/login');
    await page.click('text=Create an account');
    await page.fill('#firstName', 'New');
    await page.fill('#lastName', 'Joiner');
    await page.fill('#regEmail', email);
    await page.fill('#regPassword input', 'password123');
    // The password-strength overlay covers the submit button, so submit from the field instead
    await page.press('#regPassword input', 'Enter');

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
    await expect(page.locator('.onboarding-card h1')).toContainText('Welcome, New');
    await expect(page.locator('.account-box code')).toHaveText(email);

    // 2. The admin grants access from a separate session
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await admin.goto('/auth/login');
    await admin.fill('#email', 'admin@valeo.com');
    await admin.fill('#password input', 'password123');
    await admin.click('button[type="submit"]');
    await expect(admin).toHaveURL(/\/dashboard/, { timeout: 10000 });

    await admin.goto('/admin/users');
    const row = admin.locator('.user-row', { hasText: email });
    await expect(row).toBeVisible({ timeout: 5000 });

    await row.locator('p-select[id^="grant-workspace-"]').click();
    await admin.locator('.p-select-option', { hasText: 'Driving Assistance Research' }).click();
    await row.locator('button:has-text("Grant Access")').click();

    await expect(row).not.toBeVisible({ timeout: 5000 });
    await adminContext.close();

    // 3. The new user checks again and enters the workspace as a Developer (the default role)
    await page.click('button:has-text("Check again")');
    await expect(page).toHaveURL(/\/(dashboard|settings)/, { timeout: 10000 });
    await expect(page.locator('.role-chip')).toContainText('ROLE_DEVELOPER');
  });

  test('a user with a workspace is sent away from the onboarding page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
