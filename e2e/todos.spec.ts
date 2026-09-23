import { expect, test } from '@playwright/test';
import { resetTodos } from './helpers/db';
import { createTodo, todoItem } from './helpers/todos';

test.beforeEach(async () => {
    await resetTodos();
});

test('creates a todo and shows it in the list', async ({ page }) => {
    await createTodo(page, 'Buy milk');
    await expect(todoItem(page, 'Buy milk')).toBeVisible();
});

test('toggling a todo updates the done badge', async ({ page }) => {
    await createTodo(page, 'Task one');
    await expect(todoItem(page, 'Task one')).toBeVisible();

    await page.getByRole('checkbox').click();

    await expect(page.getByText('1 / 1 done')).toBeVisible();
    await expect(todoItem(page, 'Task one')).toHaveClass(/line-through/);
});

test('edits a todo through the edit page', async ({ page }) => {
    await createTodo(page, 'Old name');

    await todoItem(page, 'Old name').click();
    await page.waitForURL(/\/edit\//);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Task name').fill('New name');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('/');

    await expect(todoItem(page, 'New name')).toBeVisible();
    await expect(todoItem(page, 'Old name')).toHaveCount(0);
});

test('deletes a todo and it stays gone after the undo window', async ({
    page,
}) => {
    await createTodo(page, 'Temp task');
    const item = todoItem(page, 'Temp task');
    await expect(item).toBeVisible();

    await page.getByLabel('Delete task').click();
    await expect(item).toHaveCount(0);

    await page.waitForTimeout(6000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(item).toHaveCount(0);
});

test('undo keeps a deleted todo', async ({ page }) => {
    await createTodo(page, 'Keep me');
    const item = todoItem(page, 'Keep me');

    await page.getByLabel('Delete task').click();
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect(item).toBeVisible();
});
