import { test as setup } from '@playwright/test';
import { resetDb } from './helpers/db';
import { CRUD_EMAIL, signup } from './helpers/auth';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
    await resetDb();
    await signup(page, CRUD_EMAIL);
    await page.context().storageState({ path: authFile });
});
