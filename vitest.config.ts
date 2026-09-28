import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [react()],
    test: {
        globals: true,
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    setupFiles: ['./src/test/setup.ts'],
                    include: ['src/**/*.{test,spec}.{ts,tsx}'],
                    exclude: [
                        ...configDefaults.exclude,
                        'src/**/*.integration.{test,spec}.{ts,tsx}',
                    ],
                },
            },
            {
                extends: true,
                test: {
                    name: 'integration',
                    environment: 'node',
                    setupFiles: ['./src/test/setup.integration.ts'],
                    // One shared DB and a global truncate in beforeEach: files must not run in parallel.
                    fileParallelism: false,
                    include: ['src/**/*.integration.{test,spec}.{ts,tsx}'],
                    hookTimeout: 30000,
                    testTimeout: 30000,
                    retry: 2,
                },
            },
        ],
    },
});
