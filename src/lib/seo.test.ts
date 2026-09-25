import { describe, expect, it } from 'vitest';
import { pageMeta, pageTitle } from '#/lib/seo';

describe('pageTitle', () => {
    it('formats a screen title with the app name', () => {
        expect(pageTitle('New task')).toBe('New task · Todo List');
    });

    it('falls back to the app name', () => {
        expect(pageTitle()).toBe('Todo List');
    });
});

describe('pageMeta', () => {
    it('sets the document and og titles', () => {
        expect(pageMeta('Sign in')).toEqual([
            { title: 'Sign in · Todo List' },
            { property: 'og:title', content: 'Sign in · Todo List' },
        ]);
    });
});
