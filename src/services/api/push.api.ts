import { getStoredAuthToken } from "./auth.api";
import { apiPost } from "./client";

async function authHeaders() {
	const token = await getStoredAuthToken();
	if (!token) throw new Error("No auth token");
	return { Authorization: `Bearer ${token}` };
}

/** Links this device's Expo push token to the signed-in owner. */
export async function registerPushTokenApi(token: string, platform: "ios" | "android"): Promise<void> {
	await apiPost("/api/me/push-tokens", { token, platform }, { headers: await authHeaders() });
}

/** Stops notifications to this device (used on logout). */
export async function removePushTokenApi(token: string): Promise<void> {
	await apiPost("/api/me/push-tokens/remove", { token }, { headers: await authHeaders() });
}

/** The owner's single on/off switch; applies to all of their devices. */
export async function updateNotificationSettingsApi(enabled: boolean): Promise<{ data: { push_notifications_enabled: boolean } }> {
	return apiPost("/api/me/notification-settings", { enabled }, { headers: await authHeaders() });
}
