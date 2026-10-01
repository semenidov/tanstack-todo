/** Guard for `npm run db:reset`: the reset wipes the database, so it runs only when explicitly allowed (#75). */
export const isDbResetAllowed = (
    env: Record<string, string | undefined>,
): boolean => env.ALLOW_DB_RESET === '1';

/** Host of a Postgres connection string, without credentials; `null` if the URL is missing or invalid. */
export const dbHost = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
        return new URL(url).host || null;
    } catch {
        return null;
    }
};
