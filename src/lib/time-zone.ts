import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';
import { UTC, deviceTimeZone, isTimeZone } from '#/lib/due-date';

export const TIME_ZONE_COOKIE = 'tz';
const YEAR_S = 365 * 24 * 60 * 60;

function validTimeZone(value: string | null | undefined): string {
    if (!value) return UTC;
    const decoded = decodeURIComponent(value);
    return isTimeZone(decoded) ? decoded : UTC;
}

export function timeZoneFromCookies(cookies: string | null | undefined) {
    const pair = cookies
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`));
    return validTimeZone(pair?.slice(TIME_ZONE_COOKIE.length + 1));
}

export function writeTimeZoneCookie() {
    const timeZone = deviceTimeZone();
    if (timeZoneFromCookies(document.cookie) === timeZone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=${YEAR_S}; samesite=lax`;
}

/** Same on the server and the client, so hydration matches the server HTML. */
export const getCookieTimeZone = createIsomorphicFn()
    .server(() => validTimeZone(getCookie(TIME_ZONE_COOKIE)))
    .client(() => timeZoneFromCookies(document.cookie));
