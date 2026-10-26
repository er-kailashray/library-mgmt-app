/**
 * The backend refuses changes from a library whose subscription has expired (read-only mode) with
 * HTTP 402 and this code. Every API response passes through notifyIfSubscriptionExpired, so one
 * app-wide handler (registered in the app layout) can send the owner to the plans screen instead
 * of each screen checking for it.
 */
export const SUBSCRIPTION_EXPIRED_CODE = "subscription_expired";

let onExpired: (() => void) | null = null;
let lastNotifiedAt = 0;

export function setSubscriptionExpiredHandler(handler: (() => void) | null): void {
	onExpired = handler;
}

/** Returns true when the response is the read-only refusal (and notifies the handler, at most once per burst). */
export function notifyIfSubscriptionExpired(status: number, body: unknown): boolean {
	if (status !== 402 || (body as { code?: string } | null)?.code !== SUBSCRIPTION_EXPIRED_CODE) return false;

	// Several requests can fail together (e.g. a save that uploads two photos); open the plans screen once.
	const now = Date.now();
	if (now - lastNotifiedAt > 2000) {
		lastNotifiedAt = now;
		onExpired?.();
	}
	return true;
}
