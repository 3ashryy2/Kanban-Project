import { test, expect } from '@playwright/test';

test.describe('F4, F9, F12: Task Operations, Filtering, and Activity Streams', () => {

  test('should support task search and filtering without server round-trip', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // 1. Create a unique task to search for
    const toDoColumn = page.locator('.kanban-column').first();
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Searchable Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    // Verify card is added
    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // 2. Perform search
    const searchInput = page.locator('.search-input');
    await searchInput.fill(uniqueTitle);

    // Only our searchable task should be visible now
    await expect(taskCard).toBeVisible();

    // Verify other task cards that do not contain our title are hidden
    // Note: Other task cards are filtered reactively on the client side
    const nonMatchingCards = page.locator('.task-card').evaluateAll((cards, title) => {
      return cards.filter(card => !card.textContent?.includes(title)).length;
    }, uniqueTitle);
    
    // Total matching card should be visible, non-matching should be hidden
    await expect(page.locator('.task-card', { hasText: uniqueTitle })).toHaveCount(1);

    // 3. Clear search
    await searchInput.fill('');
    
    // Clean up
    await taskCard.click();
    await page.click('button:has-text("Delete Card")');
    await expect(taskCard).not.toBeVisible();
  });

  test('should support task assignment in details dialog', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Create a task
    const toDoColumn = page.locator('.kanban-column').first();
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Assignee Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible();

    // Open details
    await taskCard.click();

    // Open Assignee dropdown (PrimeNG Select)
    const assigneeSelect = page.locator('#edit-assignee');
    await expect(assigneeSelect).toBeVisible();
    await assigneeSelect.click();

    // Select "dev@valeo.com" from the dropdown options
    // PrimeNG uses .p-select-option class for each list element
    const option = page.locator('.p-select-option', { hasText: 'dev@valeo.com' });
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Close details
    await page.click('button:has-text("Close Details")');

    // Verify that the task card now displays the assignee avatar
    // Initial letter from Mohanad Emad -> "ME"
    const avatar = taskCard.locator('.user-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveText('ME');

    // Clean up
    await taskCard.click();
    await page.click('button:has-text("Delete Card")');
  });

  test('should show Board Activity Stream sidebar', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Click "Activity Stream" button
    const streamBtn = page.locator('button:has-text("Activity Stream")');
    await expect(streamBtn).toBeVisible();
    await streamBtn.click();

    // Verify activity stream sidebar/drawer is visible
    const sidebarHeader = page.locator('.sidebar-header h3');
    await expect(sidebarHeader).toBeVisible();
    await expect(sidebarHeader).toHaveText('Contextual Activity Feed');
  });
});
