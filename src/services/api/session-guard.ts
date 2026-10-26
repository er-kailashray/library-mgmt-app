/**
 * A signed-in request refused with HTTP 401 means the token is no longer valid (expired, or
 * signed out from another device after a password change). Every API response passes through
 * notifyIfSessionExpired, so one app-wide handler (registered in the app layout) can clear the
 * stored login and send the owner back to the sign-in screen, instead of every screen showing
 * an error it can't recover from.
 */
let onExpired: (() => void) | null = null;
let lastNotifiedAt = 0;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
	onExpired = handler;
}

/**
 * Returns true when a request that carried a bearer token came back 401 (and notifies the
 * handler, at most once per burst). Unauthenticated requests are left alone: a 401 from the
 * login form is just a wrong password.
 */
export function notifyIfSessionExpired(status: number, hadToken: boolean): boolean {
	if (status !== 401 || !hadToken) return false;

	// Home loads several things at once; when they all fail together, sign out once.
	const now = Date.now();
	if (now - lastNotifiedAt > 2000) {
		lastNotifiedAt = now;
		onExpired?.();
	}
	return true;
}
