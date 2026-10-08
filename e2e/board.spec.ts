import { expect, test } from '@playwright/test';
import { CRUD_EMAIL } from './helpers/auth';
import { resetBoards } from './helpers/db';
import {
    addCard,
    addList,
    cardRow,
    cardTitles,
    dndAnnouncement,
    dragCardWithKeys,
    gotoBoard,
    listColumn,
    listTitleButton,
    listTitles,
    moveCardTo,
    pickUpWithMouse,
    waitForSavedMoves,
} from './helpers/board';

test.beforeEach(async ({ page }) => {
    await resetBoards();
    await gotoBoard(page, CRUD_EMAIL);
});

test('shows a board with its lists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
    await expect(listColumn(page, 'To do')).toBeVisible();
    await expect(listColumn(page, 'Done')).toBeVisible();
});

test('links back to the boards list', async ({ page }) => {
    await page.getByRole('link', { name: 'Back to boards' }).click();
    await page.waitForURL(/\/boards$/);
    await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible();
});

test('renames the board in the header and the tile shows it', async ({
    page,
}) => {
    await page.getByRole('heading', { name: 'My tasks' }).click();
    const input = page.getByLabel('Board title');
    await input.fill('Renamed board');
    await input.press('Enter');
    await expect(
        page.getByRole('heading', { name: 'Renamed board' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Renamed board/);

    await page.getByRole('link', { name: 'Back to boards' }).click();
    await page.waitForURL(/\/boards$/);
    await expect(
        page.getByRole('link', { name: /Renamed board/ }),
    ).toBeVisible();
});

test('adds a card and shows it in the list', async ({ page }) => {
    await addCard(page, 'To do', 'Buy milk');
    await expect(cardRow(page, 'Buy milk')).toBeVisible();
});

test('a new card can be opened and has a working menu as soon as it appears', async ({
    page,
}) => {
    const list = listColumn(page, 'To do');
    await list.getByRole('button', { name: 'Add card' }).click();
    await list.getByLabel('New card title').fill('Fresh card');
    await list.getByLabel('New card title').press('Enter');

    const row = cardRow(page, 'Fresh card');
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Card actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await page.keyboard.press('Escape');

    await row.getByRole('link').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Fresh card' }),
    ).toBeVisible();
});

test('renames a card through the card dialog', async ({ page }) => {
    await addCard(page, 'To do', 'Old name');
    await cardRow(page, 'Old name').getByRole('link').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Old name' }).click();
    await dialog.getByLabel('Card title').fill('New name');
    await dialog.getByLabel('Card title').press('Enter');
    await page.keyboard.press('Escape');

    await expect(cardRow(page, 'New name')).toBeVisible();
    await expect(cardRow(page, 'Old name')).toHaveCount(0);
});

test('adds new cards on top and keeps the order after reload', async ({
    page,
}) => {
    await addCard(page, 'To do', 'First');
    await addCard(page, 'To do', 'Second');
    await expect
        .poll(() => cardTitles(page, 'To do'))
        .toEqual(['Second', 'First']);

    await page.reload();
    await expect
        .poll(() => cardTitles(page, 'To do'))
        .toEqual(['Second', 'First']);
});

test('moves a card to a position in another list through the Move window', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Ship it');
    await addCard(page, 'Done', 'Done 2');
    await addCard(page, 'Done', 'Done 1');

    await moveCardTo(page, 'Ship it', 'Done', 2);

    const expected = ['Done 1', 'Ship it', 'Done 2'];
    await expect.poll(() => cardTitles(page, 'Done')).toEqual(expected);
    await expect.poll(() => cardTitles(page, 'To do')).toEqual([]);
    await expect(cardRow(page, 'Ship it')).not.toHaveAttribute('aria-busy');
    await page.reload();
    await expect.poll(() => cardTitles(page, 'Done')).toEqual(expected);
});

test('moves a card down inside its list to exactly the chosen position', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Card 3');
    await addCard(page, 'To do', 'Card 2');
    await addCard(page, 'To do', 'Card 1');

    await moveCardTo(page, 'Card 1', 'To do', 3);

    const expected = ['Card 2', 'Card 3', 'Card 1'];
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(expected);
    await page.reload();
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(expected);
});

test('the Move button is disabled for the current position', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Only');
    await cardRow(page, 'Only')
        .getByRole('button', { name: 'Card actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Move…' }).click();

    await expect(
        page
            .getByRole('dialog', { name: 'Move card' })
            .getByRole('button', { name: 'Move' }),
    ).toBeDisabled();
});

test('deletes a card on the server right away', async ({ page }) => {
    await addCard(page, 'To do', 'Temp card');
    const row = cardRow(page, 'Temp card');
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Card actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
    // The Undo toast appears once the server has saved the delete.
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(cardRow(page, 'Temp card')).toHaveCount(0);
});

test('a deleted card does not come back when the board refetches', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Deleted card');
    const row = cardRow(page, 'Deleted card');

    await row.getByRole('button', { name: 'Card actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

    // Adding a card refetches the board while the Undo toast is still open.
    await addCard(page, 'To do', 'Another card');
    await expect(cardRow(page, 'Another card')).toBeVisible();
    await expect(cardRow(page, 'Deleted card')).toHaveCount(0);
});

test('undo keeps a deleted card', async ({ page }) => {
    await addCard(page, 'To do', 'Keep me');
    const row = cardRow(page, 'Keep me');

    await row.getByRole('button', { name: 'Card actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cardRow(page, 'Keep me')).toBeVisible();
});

test('adds a list', async ({ page }) => {
    await addList(page, 'Backlog');
    await expect(listColumn(page, 'Backlog')).toBeVisible();
});

test('renames a list', async ({ page }) => {
    const list = listColumn(page, 'To do');
    await list.getByRole('button', { name: 'List actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    // The list's own text (which `list` matches on) is replaced by the input
    // while editing, so target the input directly instead of through `list`.
    await page.getByLabel('List title').fill('Todo renamed');
    await page.getByLabel('List title').press('Enter');

    await expect(listColumn(page, 'Todo renamed')).toBeVisible();
});

test('deletes an empty list', async ({ page }) => {
    await addList(page, 'Scratch');
    const list = listColumn(page, 'Scratch');
    await list.getByRole('button', { name: 'List actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();

    await expect(listColumn(page, 'Scratch')).toHaveCount(0);
});

test('opens a card window from a direct link', async ({ page }) => {
    await addCard(page, 'To do', 'Direct link card');
    await cardRow(page, 'Direct link card').getByRole('link').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const cardUrl = page.url();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.goto(cardUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('dialog').getByText('Direct link card'),
    ).toBeVisible();
});

test('drags a card down its list with the keyboard', async ({ page }) => {
    await addCard(page, 'To do', 'Card 3');
    await addCard(page, 'To do', 'Card 2');
    await addCard(page, 'To do', 'Card 1');

    const saved = waitForSavedMoves(page, 1);
    await dragCardWithKeys(page, 'Card 1', [
        {
            key: 'ArrowDown',
            announcement: 'Card Card 1 is in position 2 of 3 in list To do',
        },
        {
            key: 'ArrowDown',
            announcement: 'Card Card 1 is in position 3 of 3 in list To do',
        },
    ]);
    await expect(dndAnnouncement(page)).toHaveText(
        'Card Card 1 dropped in position 3 of 3 in list To do',
    );

    const expected = ['Card 2', 'Card 3', 'Card 1'];
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(expected);
    await saved;
    await page.reload();
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(expected);
});

test('drags cards between lists with the keyboard, two moves in a row', async ({
    page,
}) => {
    await addCard(page, 'To do', 'A2');
    await addCard(page, 'To do', 'A1');
    await addCard(page, 'Done', 'B1');

    const saved = waitForSavedMoves(page, 2);
    // Position 2 into a list of 1 card: its end.
    await dragCardWithKeys(page, 'A2', [
        {
            key: 'ArrowRight',
            announcement: 'Card A2 is in position 2 of 2 in list Done',
        },
    ]);
    // Right away, while the first move may still be saving: the same position.
    await dragCardWithKeys(page, 'B1', [
        {
            key: 'ArrowLeft',
            announcement: 'Card B1 is in position 1 of 2 in list To do',
        },
    ]);

    await expect.poll(() => cardTitles(page, 'To do')).toEqual(['B1', 'A1']);
    await expect.poll(() => cardTitles(page, 'Done')).toEqual(['A2']);
    await saved;
    await page.reload();
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(['B1', 'A1']);
    await expect.poll(() => cardTitles(page, 'Done')).toEqual(['A2']);
});

test('drags a card to another list with the mouse', async ({ page }) => {
    await addCard(page, 'To do', 'Mouse card');
    await addCard(page, 'Done', 'Done card');
    const boardUrl = page.url();

    const saved = waitForSavedMoves(page, 1);
    await pickUpWithMouse(page, 'Mouse card');
    const target = await cardRow(page, 'Done card').boundingBox();
    if (!target) throw new Error('No target card');
    // Upper part of the target card: the dragged card goes before it.
    await page.mouse.move(target.x + target.width / 2, target.y + 5, {
        steps: 15,
    });
    await expect(dndAnnouncement(page)).toHaveText(
        'Card Mouse card is in position 1 of 2 in list Done',
    );
    await page.mouse.up();

    await expect
        .poll(() => cardTitles(page, 'Done'))
        .toEqual(['Mouse card', 'Done card']);
    await expect.poll(() => cardTitles(page, 'To do')).toEqual([]);
    // The drag ended on the card link, but the card window did not open.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(page.url()).toBe(boardUrl);
    await saved;
    await page.reload();
    await expect
        .poll(() => cardTitles(page, 'Done'))
        .toEqual(['Mouse card', 'Done card']);
});

test('a card dropped outside the lists or cancelled with Esc stays in place', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Card 2');
    await addCard(page, 'To do', 'Card 1');
    let requests = 0;
    page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('_serverFn')) {
            requests += 1;
        }
    });

    // Mouse: into Done, then out of all lists (below the columns), drop there.
    await pickUpWithMouse(page, 'Card 1');
    const done = await listColumn(page, 'Done').boundingBox();
    if (!done) throw new Error('No Done list');
    await page.mouse.move(done.x + done.width / 2, done.y + done.height / 2, {
        steps: 10,
    });
    await expect(dndAnnouncement(page)).toContainText('in list Done');
    await page.mouse.move(done.x + done.width / 2, done.y + done.height + 150, {
        steps: 10,
    });
    await expect(dndAnnouncement(page)).toHaveText(
        'Card Card 1 is not over a list',
    );
    await page.mouse.up();
    await expect(dndAnnouncement(page)).toHaveText(
        'Moving card Card 1 was cancelled',
    );

    // Keyboard: move down, then Esc.
    await cardRow(page, 'Card 1').getByRole('link').focus();
    await page.keyboard.press('Space');
    await expect(dndAnnouncement(page)).toHaveText('Picked up card Card 1');
    await page.keyboard.press('ArrowDown');
    await expect(dndAnnouncement(page)).toHaveText(
        'Card Card 1 is in position 2 of 2 in list To do',
    );
    await page.keyboard.press('Escape');
    await expect(dndAnnouncement(page)).toHaveText(
        'Moving card Card 1 was cancelled',
    );

    await expect
        .poll(() => cardTitles(page, 'To do'))
        .toEqual(['Card 1', 'Card 2']);
    await expect.poll(() => cardTitles(page, 'Done')).toEqual([]);
    expect(requests).toBe(0);
    await page.reload();
    await expect
        .poll(() => cardTitles(page, 'To do'))
        .toEqual(['Card 1', 'Card 2']);
});

test('drags a list by its header with the mouse and keeps the order after reload', async ({
    page,
}) => {
    await addCard(page, 'To do', 'Rides along');
    const saved = waitForSavedMoves(page, 1);
    const from = await listTitleButton(page, 'To do').boundingBox();
    const to = await listColumn(page, 'Done').boundingBox();
    if (!from || !to) throw new Error('No lists');

    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + from.height / 2, { steps: 3 });
    await expect(dndAnnouncement(page)).toHaveText('Picked up list To do');
    await page.mouse.move(to.x + to.width / 2 + 10, from.y + from.height / 2, {
        steps: 15,
    });
    await expect(dndAnnouncement(page)).toHaveText(
        'List To do, position 2 of 2',
    );
    await page.mouse.up();

    await expect.poll(() => listTitles(page)).toEqual(['Done', 'To do']);
    // The drag started on the title button, but the rename did not open.
    await expect(
        page.getByRole('textbox', { name: 'List title', exact: true }),
    ).toHaveCount(0);
    await saved;
    await page.reload();
    await expect.poll(() => listTitles(page)).toEqual(['Done', 'To do']);
    await expect.poll(() => cardTitles(page, 'To do')).toEqual(['Rides along']);
});

test('drags a list with the keyboard: Space picks it up instead of renaming', async ({
    page,
}) => {
    await addList(page, 'Later');
    await expect
        .poll(() => listTitles(page))
        .toEqual(['To do', 'Done', 'Later']);
    await page.getByLabel('New list title').press('Escape');
    const saved = waitForSavedMoves(page, 1);

    await listTitleButton(page, 'To do').focus();
    await page.keyboard.press('Space');
    await expect(dndAnnouncement(page)).toHaveText('Picked up list To do');
    await expect(
        page.getByRole('textbox', { name: 'List title', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(dndAnnouncement(page)).toHaveText(
        'List To do, position 2 of 3',
    );
    await page.keyboard.press('ArrowRight');
    await expect(dndAnnouncement(page)).toHaveText(
        'List To do, position 3 of 3',
    );
    await page.keyboard.press('Space');
    await expect(dndAnnouncement(page)).toHaveText(
        'List To do dropped, position 3 of 3',
    );

    await expect
        .poll(() => listTitles(page))
        .toEqual(['Done', 'Later', 'To do']);
    await expect(
        page.getByRole('textbox', { name: 'List title', exact: true }),
    ).toHaveCount(0);
    // Enter still renames.
    await listTitleButton(page, 'Done').focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('textbox', { name: 'List title', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await saved;
    await page.reload();
    await expect
        .poll(() => listTitles(page))
        .toEqual(['Done', 'Later', 'To do']);
});
