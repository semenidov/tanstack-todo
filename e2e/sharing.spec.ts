import {
    addCard,
    addList,
    cardRow,
    moveCardTo,
    cardTitles,
} from './helpers/board';
import { expect, test } from '@playwright/test';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { seedBoard, seedBoardMember, removeBoardMembers } from './helpers/db';

test('member has a read-only board title and leaves through confirmation', async ({
    browser,
}) => {
    const owner = await browser.newContext();
    const member = await browser.newContext();
    try {
        const ownerPage = await owner.newPage();
        const ownerEmail = uniqueEmail('leave-owner');
        await signup(ownerPage, ownerEmail);
        const title = 'Leave this team';
        const boardId = await seedBoard(ownerEmail, title);
        const page = await member.newPage();
        const memberEmail = uniqueEmail('leave-member');
        await signup(page, memberEmail);
        await seedBoardMember(boardId, memberEmail);
        await gotoHydrated(page, `/b/${boardId}`);
        await expect(
            page.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: title, exact: true }),
        ).toHaveCount(0);
        await page.getByRole('link', { name: 'Back to boards' }).click();
        await expect(page).toHaveURL('/boards');
        const tile = page
            .getByRole('link')
            .filter({ hasText: title })
            .locator('..');
        await tile.getByRole('button', { name: 'Board actions' }).click();
        await expect(page.getByRole('menuitem')).toHaveText(['Leave']);
        await page
            .getByRole('menuitem', { name: 'Leave', exact: true })
            .click();
        await expect(page.getByRole('alertdialog')).toContainText(
            `Leave board "${title}"?`,
        );
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(tile).toBeVisible();
        await tile.getByRole('button', { name: 'Board actions' }).click();
        await page
            .getByRole('menuitem', { name: 'Leave', exact: true })
            .click();
        await page.getByRole('button', { name: 'Leave', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Shared with me' }),
        ).toHaveCount(0);
        await page.reload();
        await expect(
            page.getByRole('link').filter({ hasText: title }),
        ).toHaveCount(0);
        await gotoHydrated(page, `/b/${boardId}`);
        await expect(
            page.getByRole('heading', {
                name: "Board not found or you don't have access",
            }),
        ).toBeVisible();
        await gotoHydrated(ownerPage, `/b/${boardId}`);
        await expect(
            ownerPage.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible();
    } finally {
        await owner.close();
        await member.close();
    }
});

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

test('member content persists and the next write after removal opens access denied', async ({
    browser,
}) => {
    const owner = await browser.newContext();
    const member = await browser.newContext();
    try {
        const ownerPage = await owner.newPage();
        const ownerEmail = uniqueEmail('write-owner');
        await signup(ownerPage, ownerEmail);
        const boardId = await seedBoard(ownerEmail, 'Team');
        const page = await member.newPage();
        const email = uniqueEmail('write-member');
        await signup(page, email);
        await seedBoardMember(boardId, email);
        await gotoHydrated(page, `/b/${boardId}`);
        await addList(page, 'Member list');
        await addCard(page, 'To do', 'Member card');
        await moveCardTo(page, 'Member card', 'Done', 1);
        await expect
            .poll(() => cardTitles(page, 'Done'))
            .toEqual(['Member card']);
        await page.reload();
        await expect(cardRow(page, 'Member card')).toBeVisible();
        await expect(
            page.getByText('Member list', { exact: true }),
        ).toBeVisible();
        await cardRow(page, 'Member card').getByRole('link').click();
        const dialog = page.getByRole('dialog');
        await dialog
            .getByRole('button', { name: 'Member card', exact: true })
            .click();
        await removeBoardMembers(boardId);
        await dialog.getByLabel('Card title').fill('Revoked edit');
        await dialog.getByLabel('Card title').press('Enter');
        await expect(
            page.getByRole('heading', {
                name: "Board not found or you don't have access",
            }),
        ).toBeVisible();
        await expect(cardRow(page, 'Revoked edit')).toHaveCount(0);
    } finally {
        await owner.close();
        await member.close();
    }
});
