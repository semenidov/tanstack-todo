import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoHydrated } from './auth';

/** Goes to `/`, follows the redirect to the user's default board. */
export async function gotoBoard(page: Page) {
    await gotoHydrated(page, '/');
    await page.waitForURL(/\/b\/[^/]+$/);
}

/** The list column containing `listTitle`, scoped for actions within it. */
export function listColumn(page: Page, listTitle: string) {
    return page.locator('.rounded-lg', { hasText: listTitle });
}

/** The `<li>` card row for a card with the given (exact) title. */
export function cardRow(page: Page, title: string) {
    return page
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: title, exact: true }) });
}

export async function addCard(page: Page, listTitle: string, title: string) {
    const list = listColumn(page, listTitle);
    await list.getByRole('button', { name: 'Add card' }).click();
    await list.getByLabel('New card title').fill(title);
    await list.getByLabel('New card title').press('Enter');
    // Wait until the server replaces the optimistic temp id: card actions and
    // the card link are disabled/broken while the id is temporary.
    await expect(cardRow(page, title).getByRole('link')).not.toHaveAttribute(
        'id',
        /^card-temp-/,
    );
    // The composer stays open for the next card; close it so its blur-collapse
    // doesn't shift the layout under the next click.
    await list.getByLabel('New card title').press('Escape');
    await expect(list.getByLabel('New card title')).toHaveCount(0);
}

export async function addList(page: Page, title: string) {
    await page.getByRole('button', { name: 'Add list' }).click();
    await page.getByLabel('New list title').fill(title);
    await page.getByLabel('New list title').press('Enter');
}
