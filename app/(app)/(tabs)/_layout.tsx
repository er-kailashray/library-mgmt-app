import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/native-tabs";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { refreshUnreadCount, setUnreadCount, useUnreadCount } from "@/features/notifications/logic/unread-count";
import { Notifications } from "@/services/push/notifications-module";
import { InTabsContext } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Tab route => label and icons: SF Symbols on iOS, Ionicons on Android (outline normally, filled
 * when selected).
 */
const TABS: { name: string; title: string; sf: SFSymbol; sfSelected: SFSymbol; icon: IconName; iconSelected: IconName }[] = [
	{ name: "home", title: "Home", sf: "house", sfSelected: "house.fill", icon: "home-outline", iconSelected: "home" },
	{ name: "members", title: "Members", sf: "person.2", sfSelected: "person.2.fill", icon: "people-outline", iconSelected: "people" },
	{ name: "payments", title: "Payments", sf: "indianrupeesign.circle", sfSelected: "indianrupeesign.circle.fill", icon: "wallet-outline", iconSelected: "wallet" },
	{ name: "reports", title: "Reports", sf: "chart.bar", sfSelected: "chart.bar.fill", icon: "bar-chart-outline", iconSelected: "bar-chart" },
	{ name: "notifications", title: "Alerts", sf: "bell", sfSelected: "bell.fill", icon: "notifications-outline", iconSelected: "notifications" },
];

/**
 * The native bottom tab bar (UITabBarController on iOS, Material bottom navigation on Android) for
 * the everyday screens. Everything else (member detail, admission, batches, seats, settings, …)
 * lives in the parent stack, so it opens full-screen over the tabs; Settings is reached from the
 * profile button on Home.
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
		// Lets ScreenHeader and useScreenBottomInset know they're on a tab screen.
		<InTabsContext.Provider value={true}>
			<NativeTabs
				tintColor={theme.accent}
				iconColor={{ default: theme.mutedForeground, selected: theme.accent }}
				backgroundColor={theme.card}
				labelStyle={{
					default: { fontFamily: "sans-medium", fontSize: 11, color: theme.mutedForeground },
					selected: { fontFamily: "sans-semibold", fontSize: 11, color: theme.accent },
				}}
				badgeBackgroundColor={theme.accent}
				badgeTextColor="#fff"
				indicatorColor={theme.accent + "22"}
				rippleColor={theme.accent + "22"}
			>
				{TABS.map((tab) => (
					<NativeTabs.Trigger
						key={tab.name}
						name={tab.name}
						// iOS: screens pad themselves from their safe-area inset (see useScreenBottomInset);
						// the automatic scroll inset would double it.
						disableAutomaticContentInsets={Platform.OS === "ios"}
					>
						<NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
						<NativeTabs.Trigger.Icon
							sf={{ default: tab.sf, selected: tab.sfSelected }}
							src={{
								default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.icon} />,
								selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={tab.iconSelected} />,
							}}
						/>
						{/* Only rendered when there's something unread: native tabs show any text they're given
						    (even "0") and ignore `hidden` once text is set. */}
						{tab.name === "notifications" && unread > 0 ? (
							<NativeTabs.Trigger.Badge>{unread > 99 ? "99+" : String(unread)}</NativeTabs.Trigger.Badge>
						) : null}
					</NativeTabs.Trigger>
				))}
			</NativeTabs>
		</InTabsContext.Provider>
	);
}
