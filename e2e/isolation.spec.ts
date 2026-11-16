import { expect, test } from '@playwright/test';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { addCard, cardRow, gotoBoard } from './helpers/board';

test('a stranger cannot open another user’s board', async ({
    browser,
    page: owner,
}) => {
    const email = uniqueEmail('owner');
    await signup(owner, email);
    const boardId = await gotoBoard(owner, email);
    const title = 'Private card';
    await addCard(owner, 'To do', title);

    const stranger = await browser.newPage();
    try {
        await signup(stranger, uniqueEmail('stranger'));
        await gotoHydrated(stranger, `/b/${boardId}`);
        const back = stranger.getByRole('link', { name: 'Back', exact: true });
        await expect(back).toBeVisible();
        await expect(cardRow(stranger, title)).toHaveCount(0);

        await back.click();
        await expect(stranger).toHaveURL('/boards');
    } finally {
        await stranger.close();
    }
});
