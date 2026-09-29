import { expect, test } from '@playwright/test';
import { CRUD_EMAIL, gotoHydrated } from './helpers/auth';
import { resetBoards, seedBoard } from './helpers/db';

test.beforeEach(async ({ page }) => {
    await resetBoards();
    await seedBoard(CRUD_EMAIL, 'Alpha');
    await gotoHydrated(page, '/boards');
});

test('creates a board and opens it', async ({ page }) => {
    await page.getByRole('button', { name: 'Create board' }).click();
    await page.getByLabel('New board title').fill('Fresh');
    await page.getByLabel('New board title').press('Enter');

    await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Fresh' })).toBeVisible();
});

test('renames a board', async ({ page }) => {
    await page.getByRole('button', { name: 'Board actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const input = page.getByLabel('Board title');
    await input.fill('Beta');
    await input.press('Enter');

    await expect(page.getByRole('link', { name: /Beta/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Alpha/ })).toHaveCount(0);
});

test('deletes the last board and shows the empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Board actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Delete board "Alpha"?');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('No boards yet')).toBeVisible();
    await expect(
        page.getByText('Create your first board to start.'),
    ).toBeVisible();
});
