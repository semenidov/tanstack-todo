import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite';

function siteUrl() {
    const host =
        process.env.VERCEL_ENV === 'production'
            ? process.env.VERCEL_PROJECT_PRODUCTION_URL
            : process.env.VERCEL_URL;
    return host ? `https://${host}` : '';
}

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    define: {
        'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(
            process.env.VERCEL_GIT_COMMIT_SHA ?? '',
        ),
        'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
            process.env.VERCEL_ENV ?? 'development',
        ),
        'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl()),
    },
    plugins: [
        devtools(),
        nitro(),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
        ...(process.env.SENTRY_AUTH_TOKEN
            ? sentryTanstackStart({
                  org: process.env.SENTRY_ORG,
                  project: process.env.SENTRY_PROJECT,
                  authToken: process.env.SENTRY_AUTH_TOKEN,
                  autoInstrumentMiddleware: false,
              })
            : []),
    ],
});

export default config;
