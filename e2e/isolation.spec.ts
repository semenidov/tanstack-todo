import { expect, test } from '@playwright/test';
import { signup, uniqueEmail } from './helpers/auth';
import { gotoBoard } from './helpers/board';

test('a user cannot see another user board', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    const emailA = uniqueEmail('a');
    await signup(pageA, emailA);
    await gotoBoard(pageA, emailA);
    await expect(
        pageA.getByRole('heading', { name: 'My tasks' }),
    ).toBeVisible();
    const boardUrlA = pageA.url();

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await signup(pageB, uniqueEmail('b'));

    await pageB.goto(boardUrlA);
    await expect(
        pageB.getByRole('heading', { name: 'Board not found' }),
    ).toBeVisible();

    await ctxA.close();
    await ctxB.close();
});
