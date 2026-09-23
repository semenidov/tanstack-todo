import { test as setup } from '@playwright/test';
import { resetDb } from './helpers/db';
import { signup, uniqueEmail } from './helpers/auth';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
    await resetDb();
    await signup(page, uniqueEmail('crud'));
    await page.context().storageState({ path: authFile });
});
