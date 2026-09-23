import type { Page } from '@playwright/test';
import { gotoHydrated } from './auth';

export async function createTodo(page: Page, name: string) {
    await gotoHydrated(page, '/new');
    await page.getByLabel('Task name').fill(name);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForURL('/');
}

export function todoItem(page: Page, name: string) {
    return page.getByRole('link', { name, exact: true });
}
