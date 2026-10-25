import type { NotificationResponse } from "expo-notifications";
import { Href, Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { setSubscriptionExpiredHandler } from "@/services/api/subscription-guard";
import { Notifications } from "@/services/push/notifications-module";
import { notificationUrl, registerForPushNotifications } from "@/services/push/push-notifications";

export default function AppGroupLayout() {
	const router = useRouter();

	// Any change refused because the subscription expired (read-only mode) opens the plans screen.
	useEffect(() => {
		setSubscriptionExpiredHandler(() => router.push("/subscription"));
		return () => setSubscriptionExpiredHandler(null);
	}, [router]);

	// Signed in: make sure this device is registered for push (no-op if permission was refused).
	useEffect(() => {
		void registerForPushNotifications();
	}, []);

	// Tapping a notification opens the screen it is about, including when it launched the app.
	useEffect(() => {
		// Not available in Expo Go on Android (see notifications-module).
		const notifications = Notifications;
		if (!notifications) return;
		const open = (response: NotificationResponse | null) => {
			const url = notificationUrl(response);
			if (url) router.push(url as Href);
		};

		// Cleared once handled, so signing in again later doesn't reopen an old notification.
		open(notifications.getLastNotificationResponse());
		notifications.clearLastNotificationResponse();
		const subscription = notifications.addNotificationResponseReceivedListener((response) => {
			open(response);
			notifications.clearLastNotificationResponse();
		});
		return () => subscription.remove();
	}, [router]);

	return <Stack screenOptions={{ headerShown: false }} />;
}
