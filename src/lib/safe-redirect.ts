export function safeRedirect(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;

    let decoded = value;
    try {
        while (decoded.length > 0) {
            if (
                !decoded.startsWith('/') ||
                decoded.startsWith('//') ||
                decoded.includes('\\') ||
                [...decoded].some(
                    (char) =>
                        char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
                )
            )
                return undefined;
            const next = decodeURIComponent(decoded);
            if (next === decoded) return value;
            decoded = next;
        }
    } catch {
        return undefined;
    }
    return undefined;
}
