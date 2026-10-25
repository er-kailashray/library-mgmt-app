import { router } from "expo-router";

import { clearAuthData, logoutApi } from "@/services/api/auth.api";
import { unregisterPushToken } from "@/services/push/push-notifications";

export async function handleLogout(): Promise<void> {
	try {
		// Needs the auth token, so it goes before logging out.
		await unregisterPushToken();
		await logoutApi();
	} catch {
		// Fail silently and continue clearing local auth state.
	} finally {
		await clearAuthData();
		router.replace("/login");
	}
}
