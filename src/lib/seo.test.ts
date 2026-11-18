import { describe, expect, it } from 'vitest';
import { pageMeta } from '#/lib/seo';

describe('pageMeta', () => {
    it.each([
        ['Sign in', 'Sign in · Todo List'],
        [undefined, 'Todo List'],
    ])('sets matching document and sharing titles for %s', (screen, title) => {
        expect(pageMeta(screen)).toEqual(
            expect.arrayContaining([
                { title },
                { property: 'og:title', content: title },
            ]),
        );
    });
});
