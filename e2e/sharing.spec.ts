import { expect, test } from '@playwright/test';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { seedBoard, seedBoardMember } from './helpers/db';

test('member sees and opens a shared board; outsider is denied', async ({
    browser,
}) => {
    const owner = await browser.newContext();
    const member = await browser.newContext();
    const outsider = await browser.newContext();
    try {
        const ownerPage = await owner.newPage();
        const ownerEmail = uniqueEmail('owner');
        await signup(ownerPage, ownerEmail);
        const title = '<img src=x onerror=alert(1)>';
        const boardId = await seedBoard(ownerEmail, title);
        const memberPage = await member.newPage();
        const memberEmail = uniqueEmail('member');
        await signup(memberPage, memberEmail);
        await seedBoardMember(boardId, memberEmail);
        await gotoHydrated(memberPage, '/boards');
        await expect(
            memberPage.getByRole('heading', { name: 'Shared with me' }),
        ).toBeVisible();
        const tile = memberPage.getByRole('link').filter({ hasText: title });
        await expect(tile).toContainText(`by ${ownerEmail.split('@')[0]}`);
        await expect(tile.locator('img')).toHaveCount(0);
        await tile.click();
        await expect(
            memberPage.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible();
        await expect(
            memberPage.getByText('To do', { exact: true }),
        ).toBeVisible();
        const outsiderPage = await outsider.newPage();
        await signup(outsiderPage, uniqueEmail('outsider'));
        await gotoHydrated(outsiderPage, `/b/${boardId}`);
        await expect(
            outsiderPage.getByRole('heading', {
                name: "Board not found or you don't have access",
            }),
        ).toBeVisible();
    } finally {
        await owner.close();
        await member.close();
        await outsider.close();
    }
});
