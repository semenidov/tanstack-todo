import { expect, test } from '@playwright/test';
import { login, signup, uniqueEmail } from './helpers/auth';

test('redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
});

test('a new user can sign up and lands on the empty list', async ({ page }) => {
    await signup(page, uniqueEmail());
    await expect(page.getByText('List is empty')).toBeVisible();
});

test('a user can sign out and log back in', async ({ page }) => {
    const email = uniqueEmail();
    await signup(page, email);

    await page.getByLabel('Sign out').click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, email);
    await expect(page.getByText('List is empty')).toBeVisible();
});
