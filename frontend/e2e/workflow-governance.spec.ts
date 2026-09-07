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

test.describe('F2, F6, F7, F13: Workflow Governance & Approval Gates', () => {

  test('should allow PM to view and configure workflow transitions', async ({ page }) => {
    // Login as PM
    await page.goto('/auth/login');
    await page.fill('#email', 'pm@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Ensure the board is fully loaded and data is bound to state before performing actions
    const boardTitle = page.locator('.board-title');
    await expect(boardTitle).toBeVisible({ timeout: 10000 });
    await expect(boardTitle).toHaveText('Core Platform Roadmap');

    // Click "Configure Workflow" using text-based button locator
    // This verifies PM role permissions are checked and elevated administrative features are rendered
    const configBtn = page.locator('button:has-text("Configure Workflow")');
    await expect(configBtn).toBeVisible({ timeout: 10000 });
    await expect(configBtn).toBeEnabled();

    // Verify clicking dispatches the transitions HTTP GET call (capturing the request)
    const requestPromise = page.waitForRequest(req => 
      req.url().includes('/api/boards/1/transitions') && req.method() === 'GET'
    );
    await configBtn.click({ force: true });
    
    // Assert the transitions request is sent on click (verifying correct state engine integration)
    const request = await requestPromise;
    expect(request).toBeDefined();
  });

  test('should enforce gating, lock task, restrict developer edits, and allow PM to approve', async ({ page }) => {
    // 1. Login as Dev
    await page.goto('/auth/login');
    await page.fill('#email', 'dev@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Ensure board is fully loaded
    const boardTitle = page.locator('.board-title');
    await expect(boardTitle).toBeVisible({ timeout: 10000 });
    await expect(boardTitle).toHaveText('Core Platform Roadmap');

    // Create a task in Code Review (column index 2) to prepare for moving to Ready for QA (column index 3)
    const codeReviewColumn = page.locator('.kanban-column').nth(2);
    const addCardBtn = codeReviewColumn.locator('.col-add-btn');
    await addCardBtn.click();

    const uniqueTitle = `Gated Task - ${Date.now()}`;
    await page.fill('#new-title', uniqueTitle);
    await page.click('button:has-text("Add Task")');

    // Verify task is added to "Code Review"
    const taskCard = codeReviewColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Drag from Code Review (column index 2) to Ready for QA (column index 3)
    await dragAndDrop(page, 2, 3, uniqueTitle);

    // Since this transition is gated (requires_approval = true), it should show the LOCKED banner
    const readyForQaColumn = page.locator('.kanban-column').nth(3);
    const gatedCardInQa = readyForQaColumn.locator('.task-card', { hasText: uniqueTitle });
    const lockBanner = gatedCardInQa.locator('.lock-indicator-banner');
    await expect(lockBanner).toBeVisible({ timeout: 10000 });
    await expect(lockBanner).toContainText('LOCKED PENDING APPROVAL');

    // 2. Try to inspect the card as Developer - inputs should be disabled
    await gatedCardInQa.click();

    const inspectorHeader = page.locator('.p-dialog:visible .p-dialog-title');
    await expect(inspectorHeader).toBeVisible();

    const lockedWarning = page.locator('.locked-inspector-banner');
    await expect(lockedWarning).toBeVisible();
    await expect(lockedWarning).toContainText('Approval Gate Gated: Edits are suspended pending PM review.');

    // Inputs should be disabled for Developer
    const editTitle = page.locator('#edit-title');
    await expect(editTitle).toBeDisabled();

    const editDesc = page.locator('#edit-desc');
    await expect(editDesc).toBeDisabled();

    // Close Details as Developer
    await page.click('button:has-text("Close Details")');
    await expect(inspectorHeader).not.toBeVisible();

    // Sign out Developer
    await page.click('.sidebar-footer button');

    // 3. Login as PM to Approve
    await page.goto('/auth/login');
    await page.fill('#email', 'pm@valeo.com');
    await page.fill('#password input', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces\/1\/boards\/1/, { timeout: 10000 });

    // Ensure board is fully loaded
    await expect(boardTitle).toBeVisible({ timeout: 10000 });
    await expect(boardTitle).toHaveText('Core Platform Roadmap');

    // Locate the gated card in Ready for QA
    const pmGatedCard = readyForQaColumn.locator('.task-card', { hasText: uniqueTitle });
    await expect(pmGatedCard).toBeVisible({ timeout: 5000 });
    await pmGatedCard.click();

    // Verify approval controls are visible to PM
    const approveBtn = page.locator('button:has-text("Approve & Unlock")');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify locked warning inside dialog goes away
    await expect(lockedWarning).not.toBeVisible({ timeout: 5000 });

    // PM deletes the task directly from the inspector
    const deleteBtn = page.locator('button:has-text("Delete Card")');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Inspector should close, and card should no longer be visible on board
    await expect(inspectorHeader).not.toBeVisible();
    await expect(pmGatedCard).not.toBeVisible();
  });
});
