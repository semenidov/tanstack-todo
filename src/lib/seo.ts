export const APP_NAME = 'Todo List';

const DESCRIPTION = 'A simple task list: add, edit and complete your tasks.';
const OG_IMAGE = `${import.meta.env.VITE_SITE_URL ?? ''}/og-image.png`;

export function pageTitle(screen?: string) {
    return screen ? `${screen} · ${APP_NAME}` : APP_NAME;
}

export function pageMeta(screen?: string) {
    const title = pageTitle(screen);
    return [{ title }, { property: 'og:title', content: title }];
}

export const siteMeta = [
    { name: 'description', content: DESCRIPTION },
    {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
    },
    {
        name: 'theme-color',
        content: '#09090b',
        media: '(prefers-color-scheme: dark)',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: APP_NAME },
    { property: 'og:description', content: DESCRIPTION },
    { property: 'og:image', content: OG_IMAGE },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: APP_NAME },
    { name: 'twitter:card', content: 'summary_large_image' },
];

export const siteLinks = [
    { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
];
