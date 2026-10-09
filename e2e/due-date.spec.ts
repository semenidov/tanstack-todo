import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CRUD_EMAIL, gotoHydrated } from './helpers/auth';
import { resetBoards } from './helpers/db';
import { addCard, cardRow, gotoBoard } from './helpers/board';

// The page clock is fixed in the time zone of playwright.config.ts
// (`timezoneId`, UTC+14); the server keeps the real clock.
const AT_10 = new Date('2026-03-10T10:00:00+14:00');
const AT_16 = new Date('2026-03-10T16:00:00+14:00');

test.beforeEach(async ({ page }) => {
    await resetBoards();
    await page.clock.setFixedTime(AT_10);
    await gotoBoard(page, CRUD_EMAIL);
});

/** Runs `action` and waits for the server fn call it makes to succeed. */
async function saved(page: Page, action: () => Promise<void>) {
    const response = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await action();
    expect((await response).ok()).toBe(true);
}

test('sets a due date with a time, clears the time and removes it; the status follows the clock', async ({
    page,
}) => {
    // One long scenario with two reloads on the dev server.
    test.slow();
    await addCard(page, 'To do', 'Ship it');
    const badge = cardRow(page, 'Ship it');
    const window = page.getByRole('dialog', { name: 'Ship it' });
    const picker = page.getByRole('dialog', { name: 'Due date' });
    const chip = window.getByRole('button', {
        name: /^(Due|Overdue)[a-z ]*: /,
    });

    await cardRow(page, 'Ship it').getByRole('link').click();
    await window.getByRole('button', { name: 'Due date' }).click();

    // A day in the calendar is saved right away; the popover stays open.
    await saved(page, () =>
        picker.getByRole('button', { name: /March 20th/ }).click(),
    );
    await expect(chip).toHaveText('Due: Mar 20');

    await saved(page, () =>
        picker.getByRole('button', { name: 'Today', exact: true }).click(),
    );
    await expect(chip).toHaveText('Due today: Today');

    const time = picker.getByRole('textbox', { name: 'Time' });
    await time.fill('15:00');
    await saved(page, () => time.press('Enter'));
    await expect(chip).toHaveText('Due today: Today 15:00');

    // Another day keeps the time.
    await saved(page, () =>
        picker.getByRole('button', { name: 'Tomorrow' }).click(),
    );
    await expect(chip).toHaveText('Due tomorrow: Tomorrow 15:00');
    await saved(page, () =>
        picker.getByRole('button', { name: 'Today', exact: true }).click(),
    );

    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(badge).toContainText('Due today: Today 15:00');

    // Past 15:00 the same due date is overdue. The server renders with its
    // real clock; after hydration the page re-renders with the fixed one.
    await page.clock.setFixedTime(AT_16);
    await gotoHydrated(page, page.url());
    await expect(badge).toContainText('Overdue: Today 15:00');

    // Clearing the time makes it a whole-day due date: not overdue until the day ends.
    await cardRow(page, 'Ship it').getByRole('link').click();
    await chip.click();
    await saved(page, () =>
        picker.getByRole('button', { name: 'Clear time' }).click(),
    );
    await expect(chip).toHaveText('Due today: Today');
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);

    await saved(page, () =>
        window.getByRole('button', { name: 'Remove due date' }).click(),
    );
    await expect(chip).toHaveCount(0);
    await expect(
        window.getByRole('button', { name: 'Due date' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(badge).not.toContainText('Today');

    await gotoHydrated(page, page.url());
    await expect(cardRow(page, 'Ship it')).toBeVisible();
    await expect(badge).not.toContainText('Today');
});
