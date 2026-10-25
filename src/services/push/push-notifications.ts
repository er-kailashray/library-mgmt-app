import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushTokenApi, removePushTokenApi } from "@/services/api/push.api";
import { STORAGE_KEYS } from "@/shared/constants/storage";

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

export type PushRegistrationResult = "registered" | "denied" | "unsupported";

/**
 * Asks for permission (only prompts the first time), gets this device's Expo push token and
 * sends it to the backend. Safe to call on every app start; the backend upserts the token.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
	// Simulators can't receive push; Expo Go on Android doesn't support remote push either.
	if (!Device.isDevice || Platform.OS === "web") return "unsupported";

	if (Platform.OS === "android") {
		// The backend sends with channelId "default".
		await Notifications.setNotificationChannelAsync("default", {
			name: "Library alerts",
			importance: Notifications.AndroidImportance.HIGH,
			lightColor: "#E26D4D",
		});
	}

	let { status } = await Notifications.getPermissionsAsync();
	if (status !== "granted") {
		({ status } = await Notifications.requestPermissionsAsync());
	}
	if (status !== "granted") return "denied";

	const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
	if (!projectId) return "unsupported";

	try {
		const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
		await registerPushTokenApi(token, Platform.OS === "ios" ? "ios" : "android");
		await AsyncStorage.setItem(STORAGE_KEYS.pushToken, token);
		return "registered";
	} catch {
		return "unsupported";
	}
}

/** Unlinks this device on logout so the next owner to sign in here doesn't get the old alerts. */
export async function unregisterPushToken(): Promise<void> {
	const token = await AsyncStorage.getItem(STORAGE_KEYS.pushToken);
	if (!token) return;
	try {
		await removePushTokenApi(token);
	} catch {
		// Logging out anyway; the backend also drops tokens Expo reports as dead.
	}
	await AsyncStorage.removeItem(STORAGE_KEYS.pushToken);
}

/** The in-app screen a notification opens, from the `url` the backend puts in its data. */
export function notificationUrl(response: Notifications.NotificationResponse | null): string | null {
	const url = response?.notification.request.content.data?.url;
	return typeof url === "string" && url.startsWith("/") ? url : null;
}
