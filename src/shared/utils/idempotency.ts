/**
 * A random key that marks one attempt at a write (e.g. "Save Payment"). Send the same key again when
 * retrying that attempt, and the server returns what it already saved instead of saving it twice.
 * Not for anything secret: Hermes has no crypto.randomUUID, so this falls back to Math.random.
 */
export function newIdempotencyKey(): string {
    const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
    if (uuid) return uuid;
    let key = Date.now().toString(36);
    while (key.length < 40) key += Math.random().toString(36).slice(2);
    return key.slice(0, 40);
}
