import { expect, test } from '@playwright/test';
import { gotoHydrated, login, signup, uniqueEmail } from './helpers/auth';
import { gotoBoard } from './helpers/board';

test('redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
});

test('a new user can sign up and lands on an empty boards list', async ({
    page,
}) => {
    await signup(page, uniqueEmail());
    await expect(
        page.getByRole('heading', { name: 'Boards', exact: true }),
    ).toBeVisible();
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
    await expect(
        page.getByRole('heading', { name: 'Boards', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'My tasks' })).toBeVisible();
});

test('an external redirect after sign in falls back to boards', async ({
    page,
}) => {
    const email = uniqueEmail();
    await signup(page, email);
    await page.context().clearCookies();
    await gotoHydrated(page, '/login?redirect=https%3A%2F%2Fexample.com');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/boards$/);
});
