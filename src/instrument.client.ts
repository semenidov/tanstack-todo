import * as Sentry from '@sentry/tanstackstart-react';
import { sentryDataCollection } from '#/lib/sentry';

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    dataCollection: sentryDataCollection,
    tracesSampleRate: 0,
});
