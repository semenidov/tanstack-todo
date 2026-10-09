import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CRUD_EMAIL, gotoHydrated } from './helpers/auth';
import { resetBoards, seedBoard } from './helpers/db';
import { addCard, cardRow, gotoBoard, listColumn } from './helpers/board';

test.beforeEach(async () => {
    await resetBoards();
});

/** Runs `action` and waits for the server fn call it makes to succeed. */
async function saved(page: Page, action: () => Promise<void>) {
    const response = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('_serverFn'),
    );
    await action();
    expect((await response).ok()).toBe(true);
}

const labelsPopover = (page: Page) =>
    page.getByRole('dialog', { name: 'Labels' });

/** In the open labels popover: Create label → title → Create, back to the list. */
async function createLabel(page: Page, title: string) {
    await labelsPopover(page)
        .getByRole('button', { name: 'Create label' })
        .click();
    const form = page.getByRole('dialog', { name: 'Create label' });
    await form.getByLabel('Title').fill(title);
    await form.getByRole('radio', { name: 'Blue' }).check();
    await saved(page, () =>
        form.getByRole('button', { name: 'Create' }).click(),
    );
    await expect(labelsPopover(page)).toBeVisible();
}

/** Esc closes the popover, then the card window: one at a time. */
async function closePopoverAndWindow(page: Page) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Opens the card window, ticks the label in its popover, closes both. */
async function putLabel(page: Page, cardTitle: string, label: string) {
    await cardRow(page, cardTitle).getByRole('link').click();
    await page
        .getByRole('dialog', { name: cardTitle })
        .getByRole('button', { name: 'Labels' })
        .click();
    const checkbox = labelsPopover(page).getByRole('checkbox', { name: label });
    await saved(page, () => checkbox.click());
    await expect(checkbox).toBeChecked();
    await closePopoverAndWindow(page);
}

test('creates a label, puts it on cards, expands titles on the board and deletes it', async ({
    page,
}) => {
    // One long scenario with a reload on the dev server.
    test.slow();
    await gotoBoard(page, CRUD_EMAIL);
    await addCard(page, 'To do', 'Ship it');
    await addCard(page, 'To do', 'Write docs');

    await cardRow(page, 'Ship it').getByRole('link').click();
    await page
        .getByRole('dialog', { name: 'Ship it' })
        .getByRole('button', { name: 'Labels' })
        .click();
    await createLabel(page, 'Frontend');
    await closePopoverAndWindow(page);
    await putLabel(page, 'Ship it', 'Frontend');
    await putLabel(page, 'Write docs', 'Frontend');

    // A click on a label expands the titles on every card and doesn't open the card.
    const shipLabels = cardRow(page, 'Ship it').getByRole('button', {
        name: 'Labels: Frontend',
    });
    const docsLabels = cardRow(page, 'Write docs').getByRole('button', {
        name: 'Labels: Frontend',
    });
    await expect(shipLabels).toHaveAttribute('aria-pressed', 'false');
    await shipLabels.click();
    await expect(shipLabels).toHaveAttribute('aria-pressed', 'true');
    await expect(docsLabels).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await docsLabels.click();
    await expect(shipLabels).toHaveAttribute('aria-pressed', 'false');

    // Delete: the confirmation counts the cards and starts on Cancel.
    await cardRow(page, 'Ship it').getByRole('link').click();
    await page
        .getByRole('dialog', { name: 'Ship it' })
        .getByRole('button', { name: 'Edit labels' })
        .click();
    await labelsPopover(page)
        .getByRole('button', { name: 'Edit label Frontend' })
        .click();
    await page
        .getByRole('dialog', { name: 'Edit label' })
        .getByRole('button', { name: 'Delete' })
        .click();
    const confirm = page.getByRole('dialog', { name: 'Delete label?' });
    await expect(confirm).toContainText(
        'will be removed from 2 cards on this board.',
    );
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await saved(page, () =>
        confirm.getByRole('button', { name: 'Delete' }).click(),
    );
    await expect(labelsPopover(page)).toContainText('No labels yet.');
    await closePopoverAndWindow(page);

    const anyLabels = page.getByRole('button', { name: /^Labels:/ });
    await expect(anyLabels).toHaveCount(0);
    await page.reload();
    await expect(cardRow(page, 'Ship it')).toBeVisible();
    await expect(anyLabels).toHaveCount(0);
});

test('moving a list to another board warns about its labels and takes them off; completion stays', async ({
    page,
}) => {
    test.slow();
    const otherBoardId = await seedBoard(CRUD_EMAIL, 'Other board');
    await gotoBoard(page, CRUD_EMAIL);
    await addCard(page, 'To do', 'Tagged');

    await cardRow(page, 'Tagged').getByRole('link').click();
    const window = page.getByRole('dialog', { name: 'Tagged' });
    await saved(page, () =>
        window.getByRole('checkbox', { name: 'Completed' }).click(),
    );
    await window.getByRole('button', { name: 'Labels' }).click();
    await createLabel(page, 'Urgent');
    await closePopoverAndWindow(page);
    await putLabel(page, 'Tagged', 'Urgent');

    await listColumn(page, 'To do')
        .getByRole('button', { name: 'List actions' })
        .click();
    await page.getByRole('menuitem', { name: 'Move…' }).click();
    const form = page.getByRole('dialog', { name: 'Move list' });
    const warning = form.getByText('1 label will be removed from cards.');
    // Within the board the labels stay: no warning.
    await expect(form.getByRole('combobox', { name: 'Board' })).toBeVisible();
    await expect(warning).toHaveCount(0);
    await form.getByRole('combobox', { name: 'Board' }).click();
    await page
        .getByRole('option', { name: 'Other board', exact: true })
        .click();
    await expect(warning).toBeVisible();
    await saved(page, () => form.getByRole('button', { name: 'Move' }).click());

    await gotoHydrated(page, `/b/${otherBoardId}`);
    await expect(cardRow(page, 'Tagged')).toBeVisible();
    await expect(
        cardRow(page, 'Tagged').getByRole('img', { name: 'Completed' }),
    ).toBeVisible();
    await expect(
        cardRow(page, 'Tagged').getByRole('button', { name: /^Labels:/ }),
    ).toHaveCount(0);
});
