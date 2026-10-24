import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStoredAuthUser } from "@/services/api/auth.api";
import { STORAGE_KEYS } from "@/shared/constants/storage";

/**
 * "pending": the owner has seen the setup card with steps left, so finishing them earns the
 * "You're all set" card. "done": they've dismissed it. Missing: neither yet - e.g. a library
 * that was already set up before this existed, which never gets the celebration.
 */
export type SetupCelebrationState = "pending" | "done";

async function storageKey(): Promise<string | null> {
	const user = await getStoredAuthUser();
	return user ? `${STORAGE_KEYS.setupCelebration}${user.id}` : null;
}

export async function getSetupCelebrationState(): Promise<SetupCelebrationState | null> {
	const key = await storageKey();
	if (!key) return null;
	const value = await AsyncStorage.getItem(key);
	return value === "pending" || value === "done" ? value : null;
}

export async function setSetupCelebrationState(state: SetupCelebrationState): Promise<void> {
	const key = await storageKey();
	if (key) await AsyncStorage.setItem(key, state);
}
