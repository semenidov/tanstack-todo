import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoHydrated } from './helpers/auth';
import { cardRow, cardTitles, moveCardTo } from './helpers/board';

const TRY_ME = '👋 Try me: drag this card to Done';

async function tryAsGuest(page: Page) {
    await gotoHydrated(page, '/login');
    await page.getByRole('button', { name: 'Try as guest' }).click();
    await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
}

test('a guest gets the demo board with a hint and a banner, and a move is saved', async ({
    page,
}) => {
    await tryAsGuest(page);

    await expect(
        page.getByRole('heading', { name: 'Todo app roadmap' }),
    ).toBeVisible();
    await expect
        .poll(async () => (await cardTitles(page, 'In progress'))[0])
        .toBe(TRY_ME);
    await expect(page.getByRole('note')).toContainText(
        'Guest mode: boards are deleted after 7 days.',
    );
    // The demo shows card enrichment (#120): one completed card.
    await expect(
        cardRow(page, 'Boards, lists and cards').getByRole('img', {
            name: 'Completed',
        }),
    ).toBeVisible();
    // Due dates: today by the time zone cookie, and an overdue one.
    await expect(cardRow(page, 'Card due dates and labels')).toContainText(
        'Due today: Today',
    );
    await expect(cardRow(page, 'Drag-and-drop lists')).toContainText('Overdue');

    await moveCardTo(page, TRY_ME, 'Done', 1);
    await page.reload();
    await expect
        .poll(async () => (await cardTitles(page, 'Done'))[0])
        .toBe(TRY_ME);
});

test('signing out deletes the guest; the next guest gets a fresh demo board', async ({
    page,
}) => {
    // Two guest sign-ins, each seeding a board over the network.
    test.slow();
    await tryAsGuest(page);
    const firstBoardUrl = page.url();
    await moveCardTo(page, TRY_ME, 'Done', 1);

    await page.getByLabel('Sign out').click();
    await expect(page).toHaveURL(/\/login$/);

    // The old guest is gone with its board.
    await page.goto(firstBoardUrl);
    await expect(page).toHaveURL(/\/login$/);

    await tryAsGuest(page);
    expect(page.url()).not.toBe(firstBoardUrl);
    await expect(cardRow(page, TRY_ME)).toBeVisible();
    await expect
        .poll(async () => (await cardTitles(page, 'In progress'))[0])
        .toBe(TRY_ME);
});
