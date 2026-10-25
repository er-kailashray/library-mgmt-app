import * as Notifications from "expo-notifications";
import { Href, Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { setSubscriptionExpiredHandler } from "@/services/api/subscription-guard";
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
		const open = (response: Notifications.NotificationResponse | null) => {
			const url = notificationUrl(response);
			if (url) router.push(url as Href);
		};

		// Cleared once handled, so signing in again later doesn't reopen an old notification.
		open(Notifications.getLastNotificationResponse());
		Notifications.clearLastNotificationResponse();
		const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
			open(response);
			Notifications.clearLastNotificationResponse();
		});
		return () => subscription.remove();
	}, [router]);

	return <Stack screenOptions={{ headerShown: false }} />;
}
