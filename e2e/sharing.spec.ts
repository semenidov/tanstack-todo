import {
    addCard,
    addList,
    cardRow,
    listColumn,
    listTitles,
    moveCardTo,
    gotoSharedBoard,
} from './helpers/board';
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import {
    boardMembers,
    cardLabels,
    cards,
    checklistItems,
    checklists,
    labels,
    lists,
    user,
} from '../src/db/schema';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';
import { seedBoard, seedBoardMember } from './helpers/db';

test('a member reads shared content as text; a stranger has no access', async ({
    browser,
}) => {
    test.slow();
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const strangerContext = await browser.newContext();
    try {
        const ownerPage = await ownerContext.newPage();
        const memberPage = await memberContext.newPage();
        const strangerPage = await strangerContext.newPage();
        const ownerEmail = uniqueEmail('owner');
        const memberEmail = uniqueEmail('editor');
        await signup(ownerPage, ownerEmail);
        await signup(memberPage, memberEmail);
        await signup(strangerPage, uniqueEmail('stranger'));
        const payload = '<img src=x onerror="window.sharedXss=1">';
        const ownerName = `Owner ${payload}`;
        const boardTitle = `Board ${payload}`;
        await db
            .update(user)
            .set({ name: ownerName })
            .where(eq(user.email, ownerEmail));
        const boardId = await seedBoard(ownerEmail, boardTitle);
        await seedBoardMember(boardId, memberEmail);
        const [list] = await db
            .update(lists)
            .set({ title: `List ${payload}` })
            .where(eq(lists.boardId, boardId))
            .returning();
        const [card] = await db
            .insert(cards)
            .values({
                listId: list.id,
                title: `Card ${payload}`,
                description: `Description ${payload}`,
                position: 'a0',
            })
            .returning();
        const [label] = await db
            .insert(labels)
            .values({ boardId, title: `Label ${payload}`, color: 'red' })
            .returning();
        await db
            .insert(cardLabels)
            .values({ cardId: card.id, labelId: label.id });
        const [checklist] = await db
            .insert(checklists)
            .values({ cardId: card.id, title: `Checklist ${payload}` })
            .returning();
        await db.insert(checklistItems).values({
            checklistId: checklist.id,
            title: `Item ${payload}`,
            position: 'a0',
        });

        await gotoHydrated(memberPage, '/boards');
        const shared = memberPage
            .getByRole('heading', { name: 'Shared with me' })
            .locator('..');
        await expect(
            shared.getByRole('link', {
                name: `${boardTitle} by ${ownerName}`,
                exact: true,
            }),
        ).toBeVisible();
        await shared.getByRole('link').click();
        await expect(
            memberPage.getByRole('heading', { name: boardTitle, exact: true }),
        ).toBeVisible();
        await expect(
            memberPage.getByText(`List ${payload}`, { exact: true }).first(),
        ).toBeVisible();
        await expect(
            memberPage.getByText(`Card ${payload}`, { exact: true }),
        ).toBeVisible();
        await memberPage.reload();
        await expect(
            memberPage.getByText(`Card ${payload}`, { exact: true }),
        ).toBeVisible();
        await memberPage
            .getByRole('link', { name: `Card ${payload}`, exact: true })
            .click();
        const dialog = memberPage.getByRole('dialog');
        await expect(
            dialog.getByText(`Label ${payload}`, { exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByText(`Description ${payload}`, { exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByText(`Checklist ${payload}`, { exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('checkbox', {
                name: `Item ${payload}`,
                exact: true,
            }),
        ).toBeVisible();
        await expect(memberPage.locator('img')).toHaveCount(0);
        expect(
            await memberPage.evaluate(() => Reflect.get(window, 'sharedXss')),
        ).toBeUndefined();

        await gotoHydrated(strangerPage, '/boards');
        await expect(
            strangerPage.getByRole('heading', { name: 'Shared with me' }),
        ).toHaveCount(0);
        await gotoHydrated(strangerPage, `/b/${boardId}`);
        await expect(
            strangerPage.getByRole('heading', {
                name: "Board not found or you don't have access",
            }),
        ).toBeVisible();
        await expect(
            strangerPage.getByText(`Card ${payload}`, { exact: true }),
        ).toHaveCount(0);
    } finally {
        await ownerContext.close();
        await memberContext.close();
        await strangerContext.close();
    }
});

test('editor saves columns and cards, cannot move across boards, then loses access on the next write', async ({
    page,
}) => {
    test.slow();
    const email = uniqueEmail('writer');
    await signup(page, email);
    const boardId = await gotoSharedBoard(page, email);
    const ownBoard = await seedBoard(email, 'Editor private target');
    const fixtureOwner = await db.query.user.findFirst({
        where: eq(user.name, 'Board owner'),
    });
    if (!fixtureOwner) throw new Error('Missing fixture owner');
    const otherShared = await seedBoard(
        fixtureOwner.email,
        'Another shared target',
    );
    await seedBoardMember(otherShared, email);
    await addList(page, 'Backlog');
    await expect(listColumn(page, 'Backlog')).toBeVisible();
    await listColumn(page, 'Backlog')
        .getByRole('button', { name: 'List actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('List title').fill('Renamed');
    await page.getByLabel('List title').press('Enter');
    await addCard(page, 'Renamed', 'Editor task');
    await cardRow(page, 'Editor task').getByRole('link').click();
    const cardDialog = page.getByRole('dialog', { name: 'Editor task' });
    await cardDialog
        .getByRole('button', { name: 'Editor task', exact: true })
        .click();
    await cardDialog.getByLabel('Card title').fill('Edited task');
    await cardDialog.getByLabel('Card title').press('Enter');
    await page.keyboard.press('Escape');
    await moveCardTo(page, 'Edited task', 'Done', 1);
    await listColumn(page, 'Renamed')
        .getByRole('button', { name: 'List actions' })
        .click();
    await page.getByRole('menuitem', { name: /^Move/ }).click();
    const move = page.getByRole('dialog', { name: 'Move list' });
    await move.getByRole('combobox', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(
        page.getByRole('option', { name: 'Editor private target' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('option', { name: 'Another shared target' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Renamed is last, so moving to the default first position changes the order.
    const saved = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await move.getByRole('button', { name: 'Move', exact: true }).click();
    const response = await saved;
    expect(response.ok()).toBe(true);
    const request = response.request();
    const body = request.postData();
    if (!body) throw new Error('Missing move request');
    const denied = await page.request.post(request.url(), {
        headers: await request.allHeaders(),
        data: body.replaceAll(boardId, ownBoard),
    });
    expect(await denied.text()).toContain(
        "Board not found or you don't have access",
    );
    await expect
        .poll(() => listTitles(page))
        .toEqual(['Renamed', 'To do', 'Done']);
    await gotoHydrated(page, page.url());
    await expect(cardRow(page, 'Edited task')).toBeVisible();
    await cardRow(page, 'Edited task')
        .getByRole('button', { name: 'Card actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(cardRow(page, 'Edited task')).toBeVisible();
    await listColumn(page, 'Renamed')
        .getByRole('button', { name: 'List actions' })
        .click();
    await page.getByRole('menuitem', { name: /^Delete/ }).click();
    await expect(listColumn(page, 'Renamed')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(listColumn(page, 'Renamed')).toBeVisible();
    await db.delete(boardMembers).where(eq(boardMembers.boardId, boardId));
    await listColumn(page, 'To do')
        .getByRole('button', { name: 'Add card' })
        .click();
    await listColumn(page, 'To do')
        .getByLabel('New card title')
        .fill('Must fail');
    await listColumn(page, 'To do').getByLabel('New card title').press('Enter');
    await expect(
        page.locator('[data-sonner-toast]').filter({ hasText: "Couldn't" }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', {
            name: "Board not found or you don't have access",
        }),
    ).toBeVisible();
    expect(
        await db.query.cards.findFirst({ where: eq(cards.title, 'Must fail') }),
    ).toBeUndefined();
});

test('editor has a read-only board title and leaves with confirmation', async ({
    browser,
}) => {
    test.slow();
    const ownerContext = await browser.newContext();
    const editorContext = await browser.newContext();
    try {
        const ownerPage = await ownerContext.newPage();
        const editorPage = await editorContext.newPage();
        const ownerEmail = uniqueEmail('role-owner');
        const editorEmail = uniqueEmail('role-editor');
        await signup(ownerPage, ownerEmail);
        await signup(editorPage, editorEmail);
        const boardId = await seedBoard(ownerEmail, 'Team roadmap');
        await seedBoardMember(boardId, editorEmail);
        await gotoHydrated(editorPage, `/b/${boardId}`);
        await expect(
            editorPage.getByRole('heading', { name: 'Team roadmap' }),
        ).toBeVisible();
        await expect(
            editorPage.getByRole('button', {
                name: 'Team roadmap',
                exact: true,
            }),
        ).toHaveCount(0);
        await expect(editorPage.getByLabel('Board title')).toHaveCount(0);
        await editorPage.getByRole('link', { name: 'Back to boards' }).click();
        await editorPage.waitForURL('/boards');
        const shared = editorPage
            .getByRole('heading', { name: 'Shared with me' })
            .locator('..');
        await shared.getByRole('button', { name: 'Board actions' }).click();
        await expect(editorPage.getByRole('menuitem')).toHaveCount(1);
        await editorPage.getByRole('menuitem', { name: 'Leave' }).click();
        const dialog = editorPage.getByRole('alertdialog');
        await expect(dialog).toContainText('Leave board "Team roadmap"?');
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(
            shared.getByRole('link', { name: /Team roadmap/ }),
        ).toBeVisible();
        await shared.getByRole('button', { name: 'Board actions' }).click();
        await editorPage.getByRole('menuitem', { name: 'Leave' }).click();
        await editorPage
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Leave' })
            .click();
        await expect(editorPage.getByRole('alertdialog')).toHaveCount(0);
        await expect(
            editorPage.getByRole('heading', { name: 'Shared with me' }),
        ).toHaveCount(0);
        await editorPage.reload();
        await expect(
            editorPage.getByRole('link', { name: /Team roadmap/ }),
        ).toHaveCount(0);
        await gotoHydrated(editorPage, `/b/${boardId}`);
        await expect(
            editorPage.getByText("Board not found or you don't have access"),
        ).toBeVisible();
        await gotoHydrated(ownerPage, `/b/${boardId}`);
        await expect(
            ownerPage.getByRole('heading', { name: 'Team roadmap' }),
        ).toBeVisible();
    } finally {
        await ownerContext.close();
        await editorContext.close();
    }
});
