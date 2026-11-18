import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CRUD_EMAIL, gotoHydrated } from './helpers/auth';
import { resetBoards, seedBoard, seedCards, seedChecklist } from './helpers/db';
import { cardRow, dndAnnouncement } from './helpers/board';

let boardId: string;
let cardId: string;

test.beforeEach(async () => {
    await resetBoards();
    boardId = await seedBoard(CRUD_EMAIL);
    const [card] = await seedCards(boardId, 'To do', ['Release']);
    cardId = card.id;
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

/** The card window has two drag contexts (board, checklist), each with its live region. */
async function announced(page: Page, text: string) {
    await expect(
        dndAnnouncement(page).filter({ hasText: new RegExp(`^${text}$`) }),
    ).toHaveCount(1);
}

async function itemNames(page: Page) {
    return items(page).evaluateAll((boxes) =>
        boxes.map((b) => b.getAttribute('aria-label')),
    );
}

test('creates a checklist and persists its progress on the card', async ({
    page,
}) => {
    await gotoHydrated(page, `/b/${boardId}`);
    await openCard(page);
    await cardWindow(page)
        .getByRole('button', { name: 'Checklist', exact: true })
        .click();
    const title = page
        .getByRole('dialog', { name: 'Add checklist' })
        .getByLabel('Title');
    await title.fill('Steps');
    await saved(page, () => title.press('Enter'));
    const addField = cardWindow(page).getByLabel('Add an item');
    await addField.fill('A');
    await saved(page, () => addField.press('Enter'));
    await expect(addField).toHaveValue('');
    await addField.press('Escape');
    await saved(page, () => checkItem(page, 'A').click());
    await expect(
        cardWindow(page).getByRole('checkbox', { name: 'Completed' }),
    ).toHaveAttribute('aria-checked', 'false');
    await closeCard(page);
    await gotoHydrated(page, `/b/${boardId}`);
    await expect(cardRow(page, 'Release')).toContainText('1/1');
    await openCard(page);
    await expect(checkItem(page, 'A')).toBeChecked();
});

test('reorders checklist items with the keyboard and persists the order', async ({
    page,
}) => {
    await seedChecklist(cardId, ['A', 'B', 'C']);
    await gotoHydrated(page, `/b/${boardId}`);
    await openCard(page);
    const handle = cardWindow(page).getByRole('button', {
        name: 'Move item A',
    });
    await handle.focus();
    await page.keyboard.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await announced(page, 'Item A is in position 1 of 3');
    await page.keyboard.press('ArrowDown');
    await announced(page, 'Item A is in position 2 of 3');
    await saved(page, () => page.keyboard.press('Space'));
    await expect.poll(() => itemNames(page)).toEqual(['B', 'A', 'C']);
    await gotoHydrated(page, `/b/${boardId}`);
    await openCard(page);
    await expect.poll(() => itemNames(page)).toEqual(['B', 'A', 'C']);
});

test('deletes a checklist after confirmation and removes the card progress', async ({
    page,
}) => {
    await seedChecklist(cardId, ['A', 'B']);
    await gotoHydrated(page, `/b/${boardId}`);
    await openCard(page);
    await cardWindow(page)
        .getByRole('button', { name: 'Checklist actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Delete checklist' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('2 items');
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
    await gotoHydrated(page, `/b/${boardId}`);
    await expect(cardRow(page, 'Release')).toBeVisible();
    await expect(cardRow(page, 'Release')).not.toContainText('Checklist:');
});
