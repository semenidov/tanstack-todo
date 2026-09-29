import { expect, test } from '@playwright/test';
import { CRUD_EMAIL } from './helpers/auth';
import { resetBoards } from './helpers/db';
import {
    addCard,
    addList,
    cardRow,
    gotoBoard,
    listColumn,
} from './helpers/board';

test.beforeEach(async ({ page }) => {
    await resetBoards();
    await gotoBoard(page, CRUD_EMAIL);
});

test('shows a board with its lists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
    await expect(listColumn(page, 'To do')).toBeVisible();
    await expect(listColumn(page, 'Done')).toBeVisible();
});

test('adds a card and shows it in the list', async ({ page }) => {
    await addCard(page, 'To do', 'Buy milk');
    await expect(cardRow(page, 'Buy milk')).toBeVisible();
});

test('renames a card through the card dialog', async ({ page }) => {
    await addCard(page, 'To do', 'Old name');
    await cardRow(page, 'Old name').getByRole('link').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Old name' }).click();
    await dialog.getByLabel('Card title').fill('New name');
    await dialog.getByLabel('Card title').press('Enter');
    await page.keyboard.press('Escape');

    await expect(cardRow(page, 'New name')).toBeVisible();
    await expect(cardRow(page, 'Old name')).toHaveCount(0);
});

test('moves a card to another list', async ({ page }) => {
    await addCard(page, 'To do', 'Ship it');
    const row = cardRow(page, 'Ship it');
    await row.getByRole('button', { name: 'Card actions' }).click();
    // Radix opens a submenu on pointer hover, not reliably on click.
    await page.getByRole('menuitem', { name: 'Move to…' }).hover();
    await page.getByRole('menuitem', { name: 'Done' }).click();

    await expect(listColumn(page, 'Done').getByText('Ship it')).toBeVisible();
    await expect(listColumn(page, 'To do').getByText('Ship it')).toHaveCount(0);
});

test('deletes a card and it stays gone after the undo window', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Temp card');
    const row = cardRow(page, 'Temp card');
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Card actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);

    await page.waitForTimeout(5500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(cardRow(page, 'Temp card')).toHaveCount(0);
});

test('undo keeps a deleted card', async ({ page }) => {
    await addCard(page, 'To do', 'Keep me');
    const row = cardRow(page, 'Keep me');

    await row.getByRole('button', { name: 'Card actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cardRow(page, 'Keep me')).toBeVisible();
});

test('adds a list', async ({ page }) => {
    await addList(page, 'Backlog');
    await expect(listColumn(page, 'Backlog')).toBeVisible();
});

test('renames a list', async ({ page }) => {
    const list = listColumn(page, 'To do');
    await list.getByRole('button', { name: 'List actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    // The list's own text (which `list` matches on) is replaced by the input
    // while editing, so target the input directly instead of through `list`.
    await page.getByLabel('List title').fill('Todo renamed');
    await page.getByLabel('List title').press('Enter');

    await expect(listColumn(page, 'Todo renamed')).toBeVisible();
});

test('deletes an empty list', async ({ page }) => {
    await addList(page, 'Scratch');
    const list = listColumn(page, 'Scratch');
    await list.getByRole('button', { name: 'List actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();

    await expect(listColumn(page, 'Scratch')).toHaveCount(0);
});

test('opens a card window from a direct link', async ({ page }) => {
    await addCard(page, 'To do', 'Direct link card');
    await cardRow(page, 'Direct link card').getByRole('link').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const cardUrl = page.url();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.goto(cardUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('dialog').getByText('Direct link card'),
    ).toBeVisible();
});
