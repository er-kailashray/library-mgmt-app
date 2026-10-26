import { createContext, useContext } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** True for screens inside the bottom tab bar. Provided by app/(app)/(tabs)/_layout.tsx. */
export const InTabsContext = createContext(false);

/** True on a screen rendered inside the bottom tab bar. */
export function useIsInTabs(): boolean {
	return useContext(InTabsContext);
}

/**
 * Bottom padding a screen needs so its content and floating buttons clear the home indicator
 * and, inside the tabs, the native tab bar:
 * - iOS: each tab screen gets its own safe-area provider whose bottom inset already includes the
 *   (translucent) tab bar, so the inset is right as-is. Automatic scroll insets are turned off in
 *   the tabs layout so this isn't doubled.
 * - Android: the tab bar (AndroidTabBar) sits below the screens rather than over them, so inside
 *   the tabs it's 0.
 */
export function useScreenBottomInset(): number {
	const insets = useSafeAreaInsets();
	const inTabs = useIsInTabs();
	return inTabs && Platform.OS === "android" ? 0 : insets.bottom;
}
