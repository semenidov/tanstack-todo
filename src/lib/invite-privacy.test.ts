import { describe, expect, it } from 'vitest';
import { redactInviteData, redactInviteTokens } from './invite-privacy';
import { normalizeAnalyticsUrl } from './analytics';

describe('invite privacy', () => {
    const token = 'a'.repeat(64);
    it('redacts page, redirect and serialized server-function tokens', () => {
        for (const url of [
            `https://example.com/invite/${token}`,
            `/login?redirect=/invite/${token}`,
            `/login?redirect=%2Finvite%2F${token}`,
            `/fn?payload=${encodeURIComponent(JSON.stringify({ token }))}`,
        ]) {
            expect(redactInviteTokens(url)).not.toContain(token);
            expect(normalizeAnalyticsUrl({ url }).url).not.toContain(token);
        }
    });
    it('redacts Sentry requests, breadcrumbs and nested contexts', () => {
        const event = {
            message: `Failed at "/invite/${token}"`,
            request: { url: `/invite/${token}` },
            breadcrumbs: [
                { data: { from: `/invite/${token}`, to: '/boards' } },
            ],
            contexts: { args: { token } },
        };
        expect(JSON.stringify(redactInviteData(event))).not.toContain(token);
        expect(event.contexts.args.token).toBe(token);
        expect(
            redactInviteData({ message: 'ordinary failure', value: 42 }),
        ).toEqual({ message: 'ordinary failure', value: 42 });
    });
});
