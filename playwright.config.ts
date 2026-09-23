import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.e2e', override: true });

const HOST = '127.0.0.1';
const PORT = 3100;
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    timeout: process.env.CI ? 60_000 : 30_000,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : 'html',
    use: {
        baseURL,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        {
            name: 'crud',
            testMatch: /todos\.spec\.ts/,
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/user.json',
            },
        },
        {
            name: 'auth-flows',
            testMatch: /(auth|isolation)\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: `npx vite dev --port ${PORT} --host ${HOST}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            DATABASE_URL: process.env.DATABASE_URL!,
            BETTER_AUTH_URL: baseURL,
        },
    },
});
