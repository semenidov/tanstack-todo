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
    reporter: process.env.CI ? 'github' : 'html',
    use: {
        baseURL,
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
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
