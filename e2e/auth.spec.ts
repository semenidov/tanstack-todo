import { expect, test } from '@playwright/test';
import { login, signup, uniqueEmail } from './helpers/auth';
import { gotoBoard } from './helpers/board';

test('redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
});

test('a new user can sign up and lands on an empty boards list', async ({
    page,
}) => {
    await signup(page, uniqueEmail());
    await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible();
    // No board is created lazily.
    await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('a user can sign out and log back in', async ({ page }) => {
    const email = uniqueEmail();
    await signup(page, email);
    // Sign-out lives in the board header; the boards page is a stub for now.
    await gotoBoard(page, email);

    await page.getByLabel('Sign out').click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, email);
    await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My tasks' })).toBeVisible();
});
