import type { NotificationResponse } from "expo-notifications";
import { Href, Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { clearAuthData } from "@/services/api/auth.api";
import { SESSION_EXPIRED_MESSAGE } from "@/services/api/client";
import { setSessionExpiredHandler } from "@/services/api/session-guard";
import { setSubscriptionExpiredHandler } from "@/services/api/subscription-guard";
import { Notifications } from "@/services/push/notifications-module";
import { notificationUrl, registerForPushNotifications } from "@/services/push/push-notifications";
import { showToast } from "@/shared/ui/Toast";

export default function AppGroupLayout() {
	const router = useRouter();

	// Any change refused because the subscription expired (read-only mode) opens the plans screen.
	useEffect(() => {
		setSubscriptionExpiredHandler(() => router.push("/subscription"));
		return () => setSubscriptionExpiredHandler(null);
	}, [router]);

	// The token stopped working (expired, or signed out elsewhere after a password change): forget
	// it and go back to sign-in, rather than leaving every screen stuck on an error.
	useEffect(() => {
		setSessionExpiredHandler(() => {
			void clearAuthData().then(() => {
				router.replace("/login");
				showToast({ message: SESSION_EXPIRED_MESSAGE, tone: "info" });
			});
		});
		return () => setSessionExpiredHandler(null);
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
