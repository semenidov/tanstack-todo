import { expect } from '@playwright/test';
import type { Page, Response } from '@playwright/test';
import { gotoHydrated } from './auth';
import { seedBoard } from './db';

/** Seeds a board for the user with `email` and opens it. */
export async function gotoBoard(page: Page, email: string) {
    const boardId = await seedBoard(email);
    await gotoHydrated(page, `/b/${boardId}`);
    return boardId;
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
    // Creation is not optimistic: the field is cleared once the server saved the card.
    await expect(list.getByLabel('New card title')).toHaveValue('');
    await expect(cardRow(page, title)).toBeVisible();
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

/** Card titles of a list, top to bottom. */
export function cardTitles(page: Page, listTitle: string) {
    return listColumn(page, listTitle)
        .getByRole('listitem')
        .getByRole('link')
        .allTextContents();
}

/** Moves a card through its menu → Move… window to a list and a 1-based position. */
export async function moveCardTo(
    page: Page,
    title: string,
    listTitle: string,
    position: number,
) {
    await cardRow(page, title)
        .getByRole('button', { name: 'Card actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Move…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Move card' });
    await dialog.getByRole('combobox', { name: 'List' }).click();
    await page.getByRole('option', { name: listTitle, exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Position' }).click();
    await page
        .getByRole('option', { name: String(position), exact: true })
        .click();
    // The board shows the move at once; wait for the server to save it, so a
    // reload right after sees the new order.
    const saved = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await dialog.getByRole('button', { name: 'Move' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await saved).ok()).toBe(true);
}

/** The drag-and-drop screen reader live region (latest announcement). */
export function dndAnnouncement(page: Page) {
    return page.locator('[id^="DndLiveRegion"]');
}

/** Resolves once `count` card moves (POST server fn calls) have been answered. */
export function waitForSavedMoves(page: Page, count: number) {
    let answered = 0;
    return new Promise<void>((resolve, reject) => {
        const onResponse = (r: Response) => {
            if (
                r.request().method() !== 'POST' ||
                !r.url().includes('_serverFn')
            )
                return;
            if (!r.ok()) reject(new Error(`Move failed: ${r.status()}`));
            answered += 1;
            if (answered === count) {
                page.off('response', onResponse);
                resolve();
            }
        };
        page.on('response', onResponse);
    });
}

/**
 * Drags a card with the keyboard: Space picks it up, `keys` move it (each waits
 * for its announcement), Space drops it.
 */
export async function dragCardWithKeys(
    page: Page,
    title: string,
    keys: Array<{ key: string; announcement: string }>,
) {
    await cardRow(page, title).getByRole('link').focus();
    await page.keyboard.press('Space');
    await expect(dndAnnouncement(page)).toHaveText(`Picked up card ${title}`);
    for (const { key, announcement } of keys) {
        await page.keyboard.press(key);
        await expect(dndAnnouncement(page)).toHaveText(announcement);
    }
    await page.keyboard.press('Space');
}

/** Presses the mouse on a card and moves it past the 5 px drag threshold. */
export async function pickUpWithMouse(page: Page, title: string) {
    const box = await cardRow(page, title).boundingBox();
    if (!box) throw new Error(`No card ${title}`);
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2 + 10, {
        steps: 5,
    });
    await expect(dndAnnouncement(page)).toHaveText(`Picked up card ${title}`);
}
