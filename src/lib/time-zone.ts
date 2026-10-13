import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';
import { UTC, deviceTimeZone, isTimeZone } from '#/lib/due-date';

// The device's time zone in a cookie (#120): the client writes it, the server
// renders relative dates and seeds the guest's demo board by it. Without the
// cookie (first visit) - UTC; after hydration the client re-renders with the
// device's zone (use-time-zone.ts).

export const TIME_ZONE_COOKIE = 'tz';
const YEAR_S = 365 * 24 * 60 * 60;

/** A valid IANA zone from a raw cookie value, else UTC. */
function validTimeZone(value: string | null | undefined): string {
    if (!value) return UTC;
    const decoded = decodeURIComponent(value);
    return isTimeZone(decoded) ? decoded : UTC;
}

/** The time zone from a `Cookie` header (or `document.cookie`); UTC without it. */
export function timeZoneFromCookies(cookies: string | null | undefined) {
    const pair = cookies
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`));
    return validTimeZone(pair?.slice(TIME_ZONE_COOKIE.length + 1));
}

/** Saves the device's time zone for the server, if it changed. */
export function writeTimeZoneCookie() {
    const timeZone = deviceTimeZone();
    if (timeZoneFromCookies(document.cookie) === timeZone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=${YEAR_S}; samesite=lax`;
}

/**
 * The zone from the cookie, the same on the server and on the client, so the
 * first client render matches the server HTML.
 */
export const getCookieTimeZone = createIsomorphicFn()
    .server(() => validTimeZone(getCookie(TIME_ZONE_COOKIE)))
    .client(() => timeZoneFromCookies(document.cookie));
