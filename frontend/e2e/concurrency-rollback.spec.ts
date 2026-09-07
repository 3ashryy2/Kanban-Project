import { test, expect } from '@playwright/test';

// Programmatic HTML5 Drag-and-Drop simulation with DataTransfer injection
async function dragAndDrop(page, srcIndex: number, targetIndex: number, uniqueTitle: string) {
  await page.evaluate(({ srcIdx, targetIdx, title }) => {
    const cols = document.querySelectorAll('.kanban-column');
    const sourceCol = cols[srcIdx];
    const targetCol = cols[targetIdx];
    if (!sourceCol || !targetCol) return;

    const cards = sourceCol.querySelectorAll('.task-card');
    let sourceCard: Element | null = null;
    for (const card of Array.from(cards)) {
      if (card.textContent?.includes(title)) {
        sourceCard = card;
        break;
      }
    }
    if (!sourceCard) return;

    const dataTransfer = new DataTransfer();

    const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer });
    sourceCard.dispatchEvent(dragStartEvent);

    const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
    targetCol.dispatchEvent(dragOverEvent);

    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
    targetCol.dispatchEvent(dropEvent);

    const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer });
    sourceCard.dispatchEvent(dragEndEvent);
  }, { srcIdx: srcIndex, targetIdx: targetIndex, title: uniqueTitle });
}

test.describe('F5, F14: Drag-and-Drop, Optimistic Sync and Transactional Rollback', () => {

  test('should successfully drag and drop card through allowed transition path', async ({ page }) => {
    // Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Create card in To-Do
    const toDoColumn = page.locator('.kanban-column').nth(0);
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Moveable Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Drag to In Progress (column index 1)
    await dragAndDrop(page, 0, 1, uniqueTitle);

    // Verify it moved to In Progress and is visible there
    const inProgressColumn = page.locator('.kanban-column').nth(1);
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

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Create card in To-Do
    const toDoColumn = page.locator('.kanban-column').nth(0);
    await toDoColumn.locator('.col-add-btn').click();

    const uniqueTitle = `Rollback Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    const taskCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Drag from To-Do (column index 0) directly to Done (column index 4)
    await dragAndDrop(page, 0, 4, uniqueTitle);

    // Verify error toast for invalid transition path
    // Target the toast-detail specifically within error container to avoid success toast match
    const toastMessage = page.locator('[data-p="error"] .p-toast-detail');
    await expect(toastMessage).toBeVisible({ timeout: 5000 });
    await expect(toastMessage).toContainText('Invalid column transition path.');

    // Verify the card is rolled back and is visible in To-Do again
    await expect(toDoColumn.locator('.task-card', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });
    
    const doneColumn = page.locator('.kanban-column').nth(4);
    await expect(doneColumn.locator('.task-card', { hasText: uniqueTitle })).not.toBeVisible();

    // Clean up
    const originalCard = toDoColumn.locator('.task-card', { hasText: uniqueTitle });
    await originalCard.click();
    await page.click('button:has-text("Delete Card")');
  });
});
