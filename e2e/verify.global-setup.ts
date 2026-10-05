import { request } from '@playwright/test';

/** Browser state with only the Vercel bypass cookie (gitignored dir). */
export const BYPASS_STATE_PATH = 'e2e/.auth/vercel-bypass.json';

export function previewUrl() {
    const url = process.env.PREVIEW_URL;
    if (!url) throw new Error('PREVIEW_URL is not set');
    return url;
}

/**
 * Vercel Deployment Protection bypass: one request to the preview host with
 * `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie`. Vercel answers
 * with a cookie bound to the preview host; the browser reuses it, so the
 * secret itself never reaches the browser or other hosts.
 */
export default async function globalSetup() {
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (!secret) throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is not set');

    const ctx = await request.newContext({ baseURL: previewUrl() });
    try {
        const res = await ctx.get('/', {
            headers: {
                'x-vercel-protection-bypass': secret,
                'x-vercel-set-bypass-cookie': 'true',
            },
        });
        if (!res.ok()) {
            throw new Error(`Preview bypass failed: HTTP ${res.status()}`);
        }
        await ctx.storageState({ path: BYPASS_STATE_PATH });
    } finally {
        await ctx.dispose();
    }
}
