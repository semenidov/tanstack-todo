import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import {
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
