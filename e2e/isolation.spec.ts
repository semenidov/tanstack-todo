import { expect, test } from '@playwright/test';
import { gotoHydrated, signup, uniqueEmail } from './helpers/auth';

test('a user cannot see another user tasks', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await signup(pageA, uniqueEmail('a'));
    await gotoHydrated(pageA, '/new');
    await pageA.getByLabel('Task name').fill('A secret task');
    await pageA.getByRole('button', { name: 'Add' }).click();
    await pageA.waitForURL('/');
    await expect(pageA.getByText('A secret task')).toBeVisible();

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await signup(pageB, uniqueEmail('b'));
    await expect(pageB.getByText('List is empty')).toBeVisible();
    await expect(pageB.getByText('A secret task')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
});
