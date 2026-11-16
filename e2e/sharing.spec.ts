import {
    addCard,
    cardRow,
    cardTitles,
    listColumn,
    moveCardTo,
    gotoSharedBoard,
    seedSharedBoard,
} from './helpers/board';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { seedBoard, seedBoardMember } from './helpers/db';

test('a member can open a board from their shared boards list', async ({
    page,
}) => {
    const email = uniqueEmail('editor');
    await signup(page, email);
    const boardId = await seedSharedBoard(email);

    await gotoHydrated(page, '/boards');
    const shared = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Shared with me' }),
    });
    await shared.locator(`a[href="/b/${boardId}"]`).click();
    await expect(page).toHaveURL(`/b/${boardId}`);
    await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
});

test('an editor can create and move a card', async ({ page }) => {
    test.slow();
    const email = uniqueEmail('writer');
    await signup(page, email);
    const boardId = await gotoSharedBoard(page, email);

    await addCard(page, 'To do', 'Editor task');
    await moveCardTo(page, 'Editor task', 'Done', 1);
    await gotoHydrated(page, `/b/${boardId}`);
    await expect.poll(() => cardTitles(page, 'Done')).toContain('Editor task');
});

async function shareBoard(owner: Page) {
    await owner.getByRole('button', { name: 'Share', exact: true }).click();
    await owner
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Share' })
        .click();
    const dialog = owner.getByRole('dialog');
    await expect(dialog.getByLabel('Invite link')).toBeVisible();
    return dialog;
}

test('a user returns to the invitation after signing in and can join', async ({
    browser,
    page: owner,
}) => {
    test.slow();
    const ownerEmail = uniqueEmail('owner');
    await signup(owner, ownerEmail);
    const boardId = await seedBoard(ownerEmail);
    await gotoHydrated(owner, `/b/${boardId}`);
    const sharing = await shareBoard(owner);
    const invite = await sharing.getByLabel('Invite link').inputValue();

    const member = await browser.newPage();
    try {
        const email = uniqueEmail('member');
        await signup(member, email);
        await member.context().clearCookies();
        await gotoHydrated(member, invite);
        await member.getByLabel('Email').fill(email);
        await member.getByLabel('Password').fill('password123');
        await member.getByRole('button', { name: 'Sign in' }).click();
        await expect(member).toHaveURL(invite);

        await member.getByRole('button', { name: 'Join board' }).click();
        await member.waitForURL(`**/b/${boardId}`);
        await expect(
            member.getByRole('heading', { name: 'My tasks' }),
        ).toBeVisible();
    } finally {
        await member.close();
    }
});

test('resetting the invitation prevents joining through the old link', async ({
    browser,
    page: owner,
}) => {
    test.slow();
    const ownerEmail = uniqueEmail('owner');
    await signup(owner, ownerEmail);
    const boardId = await seedBoard(ownerEmail);
    await gotoHydrated(owner, `/b/${boardId}`);
    const sharing = await shareBoard(owner);
    const link = sharing.getByLabel('Invite link');
    const oldInvite = await link.inputValue();

    await sharing.getByRole('button', { name: 'Reset link' }).click();
    await expect(link).not.toHaveValue(oldInvite);

    const visitor = await browser.newPage();
    try {
        await signup(visitor, uniqueEmail('visitor'));
        await gotoHydrated(visitor, oldInvite);
        await expect(
            visitor.getByRole('heading', { name: /invalid/i }),
        ).toBeVisible();
    } finally {
        await visitor.close();
    }
});

test('removing an editor blocks the next write from their open board', async ({
    browser,
    page: owner,
}) => {
    test.slow();
    const ownerEmail = uniqueEmail('owner');
    await signup(owner, ownerEmail);
    const boardId = await seedBoard(ownerEmail);
    await gotoHydrated(owner, `/b/${boardId}`);
    const sharing = await shareBoard(owner);

    const editor = await browser.newPage();
    try {
        const editorEmail = uniqueEmail('editor');
        await signup(editor, editorEmail);
        await seedBoardMember(boardId, editorEmail);
        await gotoHydrated(editor, `/b/${boardId}`);
        const list = listColumn(editor, 'To do');
        await list.getByRole('button', { name: 'Add card' }).click();
        const title = list.getByLabel('New card title');
        await title.fill('Blocked card');

        await gotoHydrated(owner, `/b/${boardId}`);
        await owner.getByRole('button', { name: 'Share', exact: true }).click();
        await sharing.getByRole('button', { name: 'Remove' }).click();
        const confirm = owner.getByRole('alertdialog');
        await confirm.getByRole('button', { name: 'Remove' }).click();
        await expect(confirm).toBeHidden();

        await title.press('Enter');
        await expect(
            editor.getByRole('heading', { name: /don't have access/i }),
        ).toBeVisible();
        await gotoHydrated(owner, `/b/${boardId}`);
        await expect(cardRow(owner, 'Blocked card')).toHaveCount(0);
    } finally {
        await editor.close();
    }
});

test('a member loses access by direct link after leaving the board', async ({
    page,
}) => {
    const email = uniqueEmail('editor');
    await signup(page, email);
    const boardId = await seedSharedBoard(email);
    await gotoHydrated(page, '/boards');

    await page
        .getByRole('heading', { name: 'Shared with me' })
        .locator('..')
        .getByRole('button', { name: 'Board actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Leave' }).click();
    const confirm = page.getByRole('alertdialog');
    const left = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('_serverFn'),
    );
    await confirm.getByRole('button', { name: 'Leave' }).click();
    await left;
    await expect(confirm).toBeHidden();

    await gotoHydrated(page, `/b/${boardId}`);
    await expect(
        page.getByRole('heading', { name: /don't have access/i }),
    ).toBeVisible();
});

test('the open board shows the card in its original list after a rejected move', async ({
    browser,
    page: owner,
}) => {
    test.slow();
    const ownerEmail = uniqueEmail('owner');
    await signup(owner, ownerEmail);
    const boardId = await seedBoard(ownerEmail);
    await gotoHydrated(owner, `/b/${boardId}`);
    const cardTitle = 'Keep this card';
    await addCard(owner, 'To do', cardTitle);

    const editor = await browser.newPage();
    try {
        const editorEmail = uniqueEmail('editor');
        await signup(editor, editorEmail);
        await seedBoardMember(boardId, editorEmail);
        await gotoHydrated(editor, `/b/${boardId}`);
        await cardRow(editor, cardTitle)
            .getByRole('button', { name: 'Card actions' })
            .click();
        await editor.getByRole('menuitem', { name: 'Move…' }).click();
        const move = editor.getByRole('dialog', { name: 'Move card' });
        await move.getByRole('combobox', { name: 'List' }).click();
        await editor.getByRole('option', { name: 'Done', exact: true }).click();

        await listColumn(owner, 'Done')
            .getByRole('button', { name: 'List actions' })
            .click();
        await owner.getByRole('menuitem', { name: 'Delete…' }).click();
        // Undo appears after the server saves the deletion.
        await expect(owner.getByRole('button', { name: 'Undo' })).toBeVisible();

        await move.getByRole('button', { name: 'Move', exact: true }).click();
        await expect(editor.getByText(/couldn't move the card/i)).toBeVisible();
        await expect
            .poll(() => cardTitles(editor, 'To do'))
            .toContain(cardTitle);
    } finally {
        await editor.close();
    }
});
