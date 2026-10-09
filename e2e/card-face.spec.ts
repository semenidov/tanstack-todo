import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CRUD_EMAIL } from './helpers/auth';
import { resetBoards } from './helpers/db';
import { addCard, cardRow, gotoBoard } from './helpers/board';

test.beforeEach(async ({ page }) => {
    await resetBoards();
    await gotoBoard(page, CRUD_EMAIL);
});

/** Clicks the completed toggle in the open card window and waits for the save. */
async function toggleCompleted(page: Page) {
    const saved = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await page
        .getByRole('dialog')
        .getByRole('checkbox', { name: 'Completed' })
        .click();
    expect((await saved).ok()).toBe(true);
}

test('marks a card completed in its window: a check on the board, kept after reload', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Ship it');
    const completed = cardRow(page, 'Ship it').getByRole('img', {
        name: 'Completed',
    });
    await expect(completed).toHaveCount(0);

    await cardRow(page, 'Ship it').getByRole('link').click();
    const checkbox = page
        .getByRole('dialog')
        .getByRole('checkbox', { name: 'Completed' });
    await expect(checkbox).not.toBeChecked();
    await toggleCompleted(page);
    await expect(checkbox).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(completed).toBeVisible();

    await page.reload();
    await expect(completed).toBeVisible();

    await cardRow(page, 'Ship it').getByRole('link').click();
    await expect(checkbox).toBeChecked();
    await toggleCompleted(page);
    await page.keyboard.press('Escape');
    await expect(completed).toHaveCount(0);

    await page.reload();
    await expect(cardRow(page, 'Ship it')).toBeVisible();
    await expect(completed).toHaveCount(0);
});
