import { router } from "expo-router";

import { clearAuthData, logoutApi } from "@/services/api/auth.api";

export async function handleLogout(): Promise<void> {
	try {
		await logoutApi();
	} catch {
		// Fail silently and continue clearing local auth state.
	} finally {
		await clearAuthData();
		router.replace("/login");
	}
}
