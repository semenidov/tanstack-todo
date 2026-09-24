import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    define: {
        'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(
            process.env.VERCEL_GIT_COMMIT_SHA ?? '',
        ),
        'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
            process.env.VERCEL_ENV ?? 'development',
        ),
    },
    plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
