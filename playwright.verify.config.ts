import { defineConfig, devices } from '@playwright/test';
import { BYPASS_STATE_PATH, previewUrl } from './e2e/verify.global-setup';

/**
 * Manual QA by the CI verifier (`.github/workflows/verify.yml`) against the
 * Vercel preview of the PR. Throwaway specs live in `e2e/_verify/`
 * (gitignored). Each spec signs up its own users (`uniqueEmail` + `signup`),
 * the preview database is never reset.
 *
 * The Vercel bypass secret is sent only by the global setup, only to the
 * preview host; the browser gets the host-bound bypass cookie from it, so
 * third-party requests (Sentry, Vercel Analytics) never carry the secret.
 */
export default defineConfig({
    testDir: './e2e/_verify',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 60_000,
    reporter: 'line',
    globalSetup: './e2e/verify.global-setup.ts',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: previewUrl(),
        // Only the Vercel bypass cookie, no logged-in user.
        storageState: BYPASS_STATE_PATH,
        trace: 'on',
    },
});
