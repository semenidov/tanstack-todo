import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
    Link,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { ThemeProvider } from 'next-themes';
import { MessageScreen } from '#/components/message-screen';
import { Button } from '#/components/ui/button';
import { Toaster } from '#/components/ui/sonner';
import { normalizeAnalyticsUrl } from '#/lib/analytics';
import { pageMeta, siteLinks, siteMeta } from '#/lib/seo';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { getSession } from '#/lib/auth-server';
import { ArrowLeftIcon, MapPinOffIcon } from 'lucide-react';

import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
    {
        beforeLoad: async () => {
            const session = await getSession();
            return { session };
        },
        head: ({ match }) => ({
            meta: [
                {
                    charSet: 'utf-8',
                },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1',
                },
                ...siteMeta,
                ...pageMeta(
                    match.status === 'notFound' || match._notFound
                        ? 'Page not found'
                        : undefined,
                ),
            ],
            links: [
                {
                    rel: 'stylesheet',
                    href: appCss,
                },
                ...siteLinks,
            ],
        }),
        shellComponent: RootDocument,
        notFoundComponent: () => {
            return (
                <MessageScreen
                    icon={
                        <MapPinOffIcon className="size-8 text-muted-foreground" />
                    }
                    title="Page not found"
                    description="The page you're looking for doesn't exist."
                    action={
                        <Button asChild>
                            <Link to="/">
                                <ArrowLeftIcon />
                                Back to list
                            </Link>
                        </Button>
                    }
                />
            );
        },
    },
);

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                    <Toaster richColors position="bottom-right" />
                    <Analytics beforeSend={normalizeAnalyticsUrl} />
                    <SpeedInsights beforeSend={normalizeAnalyticsUrl} />
                </ThemeProvider>
                <TanStackDevtools
                    config={{
                        position: 'bottom-right',
                    }}
                    plugins={[
                        {
                            name: 'Tanstack Router',
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                    ]}
                />
                <Scripts />
            </body>
        </html>
    );
}
