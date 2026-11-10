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
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { cards, lists } from '../src/db/schema';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { seedBoard, seedBoardMember } from './helpers/db';

test('a member can open a shared board; a stranger has no access', async ({
    browser,
    page,
}) => {
    test.slow();
    const memberEmail = uniqueEmail('editor');
    await signup(page, memberEmail);
    const boardId = await seedSharedBoard(memberEmail);

    await gotoHydrated(page, '/boards');
    await page
        .getByRole('heading', { name: 'Shared with me' })
        .locator('..')
        .getByRole('link')
        .click();
    await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();

    const stranger = await browser.newPage();
    try {
        await signup(stranger, uniqueEmail('stranger'));
        await gotoHydrated(stranger, `/b/${boardId}`);
        await expect(
            stranger.getByRole('heading', {
                name: "Board not found or you don't have access",
            }),
        ).toBeVisible();
    } finally {
        await stranger.close();
    }
});

test('shared card titles render HTML as text', async ({ page }) => {
    test.slow();
    const memberEmail = uniqueEmail('editor');
    await signup(page, memberEmail);
    const boardId = await seedSharedBoard(memberEmail);
    const [list] = await db
        .select()
        .from(lists)
        .where(eq(lists.boardId, boardId));
    const cardTitle = 'Card <img src=x onerror="window.sharedXss=1">';
    await db.insert(cards).values({
        listId: list.id,
        title: cardTitle,
        position: 'a0',
    });

    await gotoHydrated(page, `/b/${boardId}`);
    await expect(page.getByText(cardTitle, { exact: true })).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
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

test('a card stays in its original list when another member deletes the move target', async ({
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
