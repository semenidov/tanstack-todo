import { describe, expect, it } from 'vitest';
import { dbHost, isDbResetAllowed } from '#/lib/db-reset';

describe('isDbResetAllowed', () => {
    it('allows the reset only with ALLOW_DB_RESET=1', () => {
        expect(isDbResetAllowed({ ALLOW_DB_RESET: '1' })).toBe(true);
    });

    it('refuses without the flag or with another value', () => {
        expect(isDbResetAllowed({})).toBe(false);
        expect(isDbResetAllowed({ ALLOW_DB_RESET: '' })).toBe(false);
        expect(isDbResetAllowed({ ALLOW_DB_RESET: 'true' })).toBe(false);
        expect(isDbResetAllowed({ ALLOW_DB_RESET: '0' })).toBe(false);
    });
});

describe('dbHost', () => {
    it('returns the host without credentials', () => {
        expect(dbHost('postgresql://user:secret@ep-x.neon.tech/neondb?sslmode=require')).toBe(
            'ep-x.neon.tech',
        );
    });

    it('returns null for a missing or invalid url', () => {
        expect(dbHost(undefined)).toBeNull();
        expect(dbHost('not a url')).toBeNull();
    });
});
