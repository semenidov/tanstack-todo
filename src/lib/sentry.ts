import type * as Sentry from '@sentry/tanstackstart-react';

type SentryOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

export const sentryDataCollection: SentryOptions['dataCollection'] = {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    databaseQueryData: false,
    stackFrameVariables: false,
};
