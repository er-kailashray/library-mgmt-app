import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/shared/constants/storage";

export async function getOnboardingComplete(): Promise<boolean> {
	const v = await AsyncStorage.getItem(STORAGE_KEYS.onboardingComplete);
	return v === "true";
}

export async function setOnboardingComplete(): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEYS.onboardingComplete, "true");
}
