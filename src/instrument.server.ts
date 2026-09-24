import * as Sentry from '@sentry/tanstackstart-react';
import { sentryDataCollection } from '#/lib/sentry';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    dataCollection: sentryDataCollection,
    tracesSampleRate: 0,
});
