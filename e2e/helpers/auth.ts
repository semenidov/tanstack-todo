import type { Page } from '@playwright/test';

export function uniqueEmail(prefix = 'user') {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now()}-${rand}@example.com`;
}

const PASSWORD = 'password123';

export async function gotoHydrated(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
}

export async function signup(page: Page, email: string, password = PASSWORD) {
    await gotoHydrated(page, '/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.waitForURL('/');
}

export async function login(page: Page, email: string, password = PASSWORD) {
    await gotoHydrated(page, '/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/');
}
