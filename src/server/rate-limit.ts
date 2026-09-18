const hits = new Map<string, Array<number>>();

/**
 * Простейший in-memory sliding-window лимитер на ключ (обычно userId).
 * Ограничение: состояние в памяти процесса - не переживает рестарт и не
 * шарится между инстансами. Для прод-многоинстансового деплоя нужен общий
 * стор (Redis) или лимит на уровне инфраструктуры.
 */
export function checkRateLimit(
    key: string,
    limit = 30,
    windowMs = 10_000,
): void {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
        throw new Error('Rate limit exceeded. Please slow down.');
    }
    recent.push(now);
    hits.set(key, recent);
}
