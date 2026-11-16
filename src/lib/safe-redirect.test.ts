import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
    it.each(['/invite/token', '/boards?tab=mine', '/'])(
        'accepts %s',
        (path) => {
            expect(safeRedirect(path)).toBe(path);
        },
    );

    it.each([
        'https://example.com',
        '//example.com',
        '/\\example.com',
        '/%5cexample.com',
        '/%2fexample.com',
        '/%252f%252fexample.com',
        '/\n/example.com',
        '/%',
        123,
    ])('rejects unsafe redirect %s', (path) => {
        expect(safeRedirect(path)).toBeUndefined();
    });
});
