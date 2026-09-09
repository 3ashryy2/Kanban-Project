import { test, expect } from '@playwright/test';

async function dragCard(page, cardLocator, targetLocator) {
  const cardBoundingBox = await cardLocator.boundingBox();
  const targetBoundingBox = await targetLocator.boundingBox();
  if (cardBoundingBox && targetBoundingBox) {
    await page.mouse.move(cardBoundingBox.x + cardBoundingBox.width / 2, cardBoundingBox.y + cardBoundingBox.height / 2);
    await page.mouse.down();
    // Slow down movement to 15 frames so Angular CDK registers the transition hover
    await page.mouse.move(targetBoundingBox.x + targetBoundingBox.width / 2, targetBoundingBox.y + targetBoundingBox.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(500); // Wait a brief moment for transition updates to settle
  }
}

test.describe('F5, F14: Drag-and-Drop, Optimistic Sync and Transactional Rollback', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('should successfully drag and drop card through allowed transition path', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Create card in To-Do
    const toDoColumn = page.locator('.kanban-column').nth(0);
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Moveable Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Assign task first to satisfy backend assignee validation rule
    await taskCard.click();
    await page.click('#edit-assignee');
    await page.click('.p-select-option:has-text("dev@valeo.com")');
    await page.click('button:has-text("Save Changes")');

    // Wait for save & board reload to complete
    const dialog = page.locator('.p-dialog:visible');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const updatedTaskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(updatedTaskCard.locator('.user-avatar')).toBeVisible({ timeout: 5000 });

    // Drag to In Progress (column index 1)
    const inProgressColumn = page.locator('.kanban-column').nth(1);
    const inProgressColumnStack = inProgressColumn.locator('.column-card-stack');
    await dragCard(page, updatedTaskCard, inProgressColumnStack);

    // Verify it moved to In Progress and is visible there
    const movedCard = inProgressColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(movedCard).toBeVisible({ timeout: 5000 });
    await expect(taskCard).not.toBeVisible();

    // Clean up
    await movedCard.click();
    await page.click('button:has-text("Delete Card")');
  });

  test('should optimistically move card, show error toast, and rollback on invalid transition path', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Create card in To-Do
    const toDoColumn = page.locator('.kanban-column').nth(0);
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Rollback Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Assign task first to satisfy backend assignee validation rule
    await taskCard.click();
    await page.click('#edit-assignee');
    await page.click('.p-select-option:has-text("dev@valeo.com")');
    await page.click('button:has-text("Save Changes")');

    // Wait for save & board reload to complete
    const dialog = page.locator('.p-dialog:visible');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const updatedTaskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(updatedTaskCard.locator('.user-avatar')).toBeVisible({ timeout: 5000 });

    // Drag from To-Do (column index 0) directly to Done (column index 4)
    const doneColumn = page.locator('.kanban-column').nth(4);
    await doneColumn.scrollIntoViewIfNeeded();
    const doneColumnStack = doneColumn.locator('.column-card-stack');
    await dragCard(page, updatedTaskCard, doneColumnStack);

    // Verify error toast for invalid transition path
    // Target the toast-detail specifically by its text content to avoid strict mode violations from success toasts
    const toastMessage = page.locator('.p-toast-detail', { hasText: 'Invalid column transition path.' });
    await expect(toastMessage).toBeVisible({ timeout: 5000 });
    await expect(toastMessage).toContainText('Invalid column transition path.');

    // Verify the card is rolled back and is visible in To-Do again
    await expect(toDoColumn.locator('.task-card', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });
    
    await expect(doneColumn.locator('.task-card', { hasText: uniqueTitle })).not.toBeVisible();

    // Clean up
    const originalCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await originalCard.click();
    await page.click('button:has-text("Delete Card")');
  });
});
