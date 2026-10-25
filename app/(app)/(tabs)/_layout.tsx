import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { AppState } from "react-native";

import { refreshUnreadCount, setUnreadCount, useUnreadCount } from "@/features/notifications/logic/unread-count";
import { Notifications } from "@/services/push/notifications-module";
import { useTheme } from "@/shared/providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

/** Tab route => label and icon (filled when selected, outline otherwise). */
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
	{ name: "home", title: "Home", icon: "home-outline", iconActive: "home" },
	{ name: "members", title: "Members", icon: "people-outline", iconActive: "people" },
	{ name: "payments", title: "Payments", icon: "wallet-outline", iconActive: "wallet" },
	{ name: "reports", title: "Reports", icon: "bar-chart-outline", iconActive: "bar-chart" },
	{ name: "notifications", title: "Alerts", icon: "notifications-outline", iconActive: "notifications" },
];

/**
 * The bottom tab bar for the everyday screens. Everything else (member detail, admission,
 * batches, seats, settings, …) lives in the parent stack, so it opens full-screen over the tabs;
 * Settings is reached from the profile button on Home.
 */
export default function TabsLayout() {
	const { theme } = useTheme();
	const unread = useUnreadCount();

	// Keep the Alerts badge current: on sign-in, when the app comes back, and when a push lands.
	useEffect(() => {
		void refreshUnreadCount();
		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") void refreshUnreadCount();
		});
		const received = Notifications?.addNotificationReceivedListener(() => void refreshUnreadCount());
		return () => {
			appState.remove();
			received?.remove();
			// Signed out: the next account starts from its own count.
			setUnreadCount(0);
		};
	}, []);

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarHideOnKeyboard: true,
				tabBarActiveTintColor: theme.accent,
				tabBarInactiveTintColor: theme.mutedForeground,
				tabBarStyle: {
					backgroundColor: theme.card,
					borderTopColor: theme.border,
				},
				tabBarLabelStyle: {
					fontFamily: "sans-semibold",
					fontSize: 11,
				},
				tabBarBadgeStyle: {
					backgroundColor: theme.accent,
					color: "#fff",
					fontFamily: "sans-bold",
					fontSize: 10,
				},
				sceneStyle: { backgroundColor: theme.background },
			}}
		>
			{TABS.map((tab) => (
				<Tabs.Screen
					key={tab.name}
					name={tab.name}
					options={{
						title: tab.title,
						tabBarIcon: ({ focused, size }) => (
							<Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={focused ? theme.accent : theme.mutedForeground} />
						),
						...(tab.name === "notifications" && unread > 0 ? { tabBarBadge: unread > 99 ? "99+" : unread } : {}),
					}}
				/>
			))}
		</Tabs>
	);
}
