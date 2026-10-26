import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/shared/constants/storage";

export async function getOnboardingComplete(): Promise<boolean> {
	const v = await AsyncStorage.getItem(STORAGE_KEYS.onboardingComplete);
	return v === "true";
}

export async function setOnboardingComplete(): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEYS.onboardingComplete, "true");
}

/** Development aid: forget that onboarding was seen, so it shows again (also on the next app start). */
export async function clearOnboardingComplete(): Promise<void> {
	await AsyncStorage.removeItem(STORAGE_KEYS.onboardingComplete);
}
