// Cover page URLs, encoded redirect parameters and tokens in server-function payloads.
export function redactInviteTokens(value: string): string {
    return value
        .replace(/\/invite\/[^/?#\s"<>\\]+/g, '/invite/[token]')
        .replace(/%2Finvite%2F[^&\s"<>\\]+/gi, '%2Finvite%2F[token]')
        .replace(/(%22)?[a-f0-9]{64}/gi, '$1[token]');
}

export function redactInviteData<T>(data: T): T {
    // Sentry events are JSON payloads; traversing the serialized form also covers
    // SDK-added breadcrumb/context fields without relying on their structure.
    return JSON.parse(redactInviteTokens(JSON.stringify(data)));
}
