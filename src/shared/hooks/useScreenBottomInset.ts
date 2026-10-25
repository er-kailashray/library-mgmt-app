import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** True on a screen rendered inside the bottom tab bar. */
export function useIsInTabs(): boolean {
	return useContext(BottomTabBarHeightContext) !== undefined;
}

/**
 * Bottom padding a screen needs for the home indicator. Inside the tabs it is 0: the tab bar
 * already sits over that area and the screen ends above it.
 */
export function useScreenBottomInset(): number {
	const insets = useSafeAreaInsets();
	return useIsInTabs() ? 0 : insets.bottom;
}
