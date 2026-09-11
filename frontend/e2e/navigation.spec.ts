import { test, expect, Page } from '@playwright/test';

const BOARD_URL = /\/w\/\d+\/boards\/\d+/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password input', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
}

// An unsigned token whose "exp" is in 1970: the browser can tell it has expired without asking the server
function expiredToken(): string {
  const payload = Buffer.from(JSON.stringify({ sub: 'dev@valeo.com', userId: 3, exp: 1 })).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
}

test.describe('Navigation and session guards', () => {

  test('a signed-in user opening the sign-in page is sent into the app', async ({ page }) => {
    await signIn(page, 'dev@valeo.com');

    await page.goto('/auth/login');
    await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
  });

  test('an expired session goes to sign-in and comes back to the same page', async ({ page }) => {
    // Simulate a browser that still holds yesterday's session
    await page.addInitScript(token => {
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('current_user', JSON.stringify({
        id: 3, email: 'dev@valeo.com', firstName: 'Mohanad', lastName: 'Emad', isAdmin: false
      }));
    }, expiredToken());

    await page.goto('/w/1/boards/1');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/, { timeout: 10000 });

    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/w\/1\/boards\/1$/, { timeout: 10000 });
  });

  test('an unknown address shows the not-found page with a way back', async ({ page }) => {
    await signIn(page, 'dev@valeo.com');

    await page.goto('/no/such/page');
    await expect(page.locator('.error-card h1')).toHaveText('Page not found');
    await expect(page.locator('.error-path')).toHaveText('/no/such/page');

    await page.click('text=Go to your workspace');
    await expect(page).toHaveURL(BOARD_URL, { timeout: 10000 });
  });

  test('a non-admin opening an admin page sees the forbidden page', async ({ page }) => {
    await signIn(page, 'dev@valeo.com');

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/forbidden$/, { timeout: 10000 });
    await expect(page.locator('.error-code')).toHaveText('403');
  });

  test('the profile page shows the account and its workspace role', async ({ page }) => {
    await signIn(page, 'dev@valeo.com');

    await page.click('.header-right button');
    await page.locator('.p-menu').getByText('My Profile').click();
    await expect(page).toHaveURL(/\/profile$/, { timeout: 5000 });
    await expect(page.locator('.identity .email')).toHaveText('dev@valeo.com');
    await expect(page.locator('.membership-row', { hasText: 'Driving Assistance Research' })).toContainText('Developer');
  });
});
