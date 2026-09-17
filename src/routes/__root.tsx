import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
    Link,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { MessageScreen } from '#/components/message-screen';
import { Button } from '#/components/ui/button';
import { Toaster } from '#/components/ui/sonner';
import { ArrowLeftIcon, MapPinOffIcon } from 'lucide-react';

import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'TanStack Start Starter',
            },
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
    notFoundComponent: () => {
        return (
            <MessageScreen
                icon={<MapPinOffIcon className="size-8 text-muted-foreground" />}
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                {children}
                <Toaster richColors position="bottom-right" />
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
