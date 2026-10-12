import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CRUD_EMAIL } from './helpers/auth';
import { resetBoards } from './helpers/db';
import { addCard, cardRow, gotoBoard } from './helpers/board';

test.beforeEach(async () => {
    await resetBoards();
});

/** Runs `action` and waits for the server fn call it makes to succeed. */
async function saved(page: Page, action: () => Promise<void>) {
    const response = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await action();
    expect((await response).ok()).toBe(true);
}

const cardWindow = (page: Page) =>
    page.getByRole('dialog', { name: 'Release' });
const items = (page: Page) =>
    cardWindow(page)
        .getByRole('list', { name: 'Checklist items' })
        .getByRole('checkbox');

const checkItem = (page: Page, name: string) =>
    items(page).and(page.getByRole('checkbox', { name, exact: true }));

async function openCard(page: Page) {
    await cardRow(page, 'Release').getByRole('link').click();
    await expect(cardWindow(page)).toBeVisible();
}

async function closeCard(page: Page) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function itemNames(page: Page) {
    return items(page).evaluateAll((boxes) =>
        boxes.map((b) => b.getAttribute('aria-label')),
    );
}

test('creates a checklist, adds, checks, moves, renames and deletes items, deletes the checklist', async ({
    page,
}) => {
    // One long scenario with a reload on the dev server.
    test.slow();
    await gotoBoard(page, CRUD_EMAIL);
    await addCard(page, 'To do', 'Release');
    await openCard(page);

    // Create: the popover with the default title, Enter = Add.
    await cardWindow(page)
        .getByRole('button', { name: 'Checklist', exact: true })
        .click();
    const popover = page.getByRole('dialog', { name: 'Add checklist' });
    const title = popover.getByLabel('Title');
    await expect(title).toHaveValue('Checklist');
    await title.fill('Steps');
    await saved(page, () => title.press('Enter'));
    await expect(popover).toHaveCount(0);
    await expect(
        cardWindow(page).getByRole('button', {
            name: 'Checklist',
            exact: true,
        }),
    ).toHaveCount(0);

    // The "Add an item" field is focused; Enter keeps it open for the next one.
    const addField = cardWindow(page).getByLabel('Add an item');
    await expect(addField).toBeFocused();
    for (const text of ['A', 'B', 'C', 'D', 'E']) {
        await addField.fill(text);
        await saved(page, () => addField.press('Enter'));
        await expect(addField).toHaveValue('');
    }
    // Esc closes the field, not the card window.
    await addField.press('Escape');
    await expect(addField).toHaveCount(0);
    await expect(cardWindow(page)).toBeVisible();
    expect(await itemNames(page)).toEqual(['A', 'B', 'C', 'D', 'E']);

    await saved(page, () => checkItem(page, 'A').click());
    await saved(page, () => checkItem(page, 'B').click());
    await expect(cardWindow(page)).toContainText('2/5');
    await closeCard(page);
    await expect(cardRow(page, 'Release')).toContainText('Checklist: 2/5');

    // Move A one down with the keyboard: B, A, C, D, E.
    await openCard(page);
    await cardWindow(page).getByRole('button', { name: 'Move item A' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await saved(page, () => page.keyboard.press('Space'));
    await expect.poll(() => itemNames(page)).toEqual(['B', 'A', 'C', 'D', 'E']);

    // Rename C by a click on its text.
    await cardWindow(page)
        .getByRole('button', { name: 'C', exact: true })
        .click();
    const itemText = cardWindow(page).getByLabel('Item text');
    await itemText.fill('C2');
    await saved(page, () => itemText.press('Enter'));

    // Delete D with ✕ on hover.
    await cardWindow(page)
        .getByRole('button', { name: 'D', exact: true })
        .hover();
    await saved(page, () =>
        cardWindow(page).getByRole('button', { name: 'Delete item D' }).click(),
    );
    await expect.poll(() => itemNames(page)).toEqual(['B', 'A', 'C2', 'E']);
    await closeCard(page);
    await expect(cardRow(page, 'Release')).toContainText('Checklist: 2/4');

    // Saved on the server: the same after a reload.
    await page.reload();
    await expect(cardRow(page, 'Release')).toContainText('Checklist: 2/4');
    await openCard(page);
    expect(await itemNames(page)).toEqual(['B', 'A', 'C2', 'E']);

    // All done: 4/4, and the card is not marked completed.
    await saved(page, () => checkItem(page, 'C2').click());
    await saved(page, () => checkItem(page, 'E').click());
    await expect(
        cardWindow(page).getByRole('checkbox', { name: 'Completed' }),
    ).toHaveAttribute('aria-checked', 'false');
    await closeCard(page);
    await expect(cardRow(page, 'Release')).toContainText('Checklist: 4/4');
    await expect(
        cardRow(page, 'Release').getByRole('img', { name: 'Completed' }),
    ).toHaveCount(0);

    // Delete the checklist: the confirmation names the items, starts on Cancel.
    await openCard(page);
    await cardWindow(page)
        .getByRole('button', { name: 'Checklist actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Delete checklist' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('The checklist and its 4 items');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await saved(page, () =>
        confirm.getByRole('button', { name: 'Delete' }).click(),
    );
    await expect(
        cardWindow(page).getByRole('button', {
            name: 'Checklist',
            exact: true,
        }),
    ).toBeVisible();
    await closeCard(page);
    await expect(cardRow(page, 'Release')).not.toContainText('Checklist:');
    await page.reload();
    await expect(cardRow(page, 'Release')).toBeVisible();
    await expect(cardRow(page, 'Release')).not.toContainText('Checklist:');
});
