import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { haptics } from "@/shared/utils/haptics";

type IconName = keyof typeof Ionicons.glyphMap;

export type AndroidTab = { name: string; title: string; icon: IconName; iconSelected: IconName };

type Props = BottomTabBarProps & {
	tabs: AndroidTab[];
	/** Number shown on a tab's icon (e.g. unread alerts); 0 or missing hides it. */
	badges?: Partial<Record<string, number>>;
};

/**
 * Android's bottom tab bar: a raised surface with a hairline top edge, a coral pill that grows in
 * behind the selected tab's (filled) icon, and the label underneath, Material 3 style. Sits above the
 * system navigation bar. iOS keeps the native UITabBarController instead.
 */
export function AndroidTabBar({ state, emitter, navigateToTab, tabs, badges = {} }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
			{state.routes.map((route, index) => {
				const tab = tabs.find((t) => t.name === route.name);
				if (!tab) return null;
				const focused = state.index === index;
				const onPress = () => {
					// Same as the stock bar: screens can listen for tabPress (e.g. scroll to top on a re-tap).
					const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
					if (!focused) haptics.selection();
					if (!focused && !event.defaultPrevented) navigateToTab(route.key);
				};
				return (
					<TabItem
						key={route.key}
						tab={tab}
						focused={focused}
						badge={badges[route.name] ?? 0}
						onPress={onPress}
						onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
						styles={styles}
						theme={theme}
					/>
				);
			})}
		</View>
	);
}

type Styles = ReturnType<typeof createStyles>;

function TabItem({
	tab,
	focused,
	badge,
	onPress,
	onLongPress,
	styles,
	theme,
}: {
	tab: AndroidTab;
	focused: boolean;
	badge: number;
	onPress: () => void;
	onLongPress: () => void;
	styles: Styles;
	theme: Theme;
}) {
	// 0 → 1 as the tab becomes selected: the pill widens out from the icon and fades in.
	const progress = useSharedValue(focused ? 1 : 0);
	useEffect(() => {
		progress.value = focused ? withSpring(1, { damping: 18, stiffness: 240 }) : withTiming(0, { duration: 160 });
	}, [focused, progress]);

	const pillStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ scaleX: 0.5 + progress.value * 0.5 }],
	}));

	const color = focused ? theme.accent : theme.mutedForeground;

	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected: focused }}
			accessibilityLabel={badge > 0 ? `${tab.title}, ${badge} new` : tab.title}
			onPress={onPress}
			onLongPress={onLongPress}
			// No android_ripple: it spread over the whole tab and then the pill drew on top, giving two
			// backgrounds. The press shows on the pill's spot only, like Material's own navigation bar.
			style={styles.item}>
			{({ pressed }) => (
				<>
					<View style={styles.iconWrap}>
						{pressed && !focused && <View style={styles.pressLayer} />}
						<Animated.View style={[styles.pill, pillStyle]} />
						<Ionicons name={focused ? tab.iconSelected : tab.icon} size={22} color={color} />
						{badge > 0 && (
							<View style={styles.badge}>
								<Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
							</View>
						)}
					</View>
					<Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1}>
						{tab.title}
					</Text>
				</>
			)}
		</Pressable>
	);
}

const PILL_WIDTH = 60;
const PILL_HEIGHT = 32;

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		bar: {
			flexDirection: "row",
			backgroundColor: theme.card,
			borderTopWidth: 1,
			borderTopColor: theme.border,
			paddingTop: 8,
			// A soft shadow cast upward, so the bar reads as a surface above the page.
			shadowColor: "#000",
			shadowOffset: { width: 0, height: -2 },
			shadowOpacity: 0.06,
			shadowRadius: 8,
			elevation: 12,
		},
		item: {
			flex: 1,
			alignItems: "center",
			gap: 4,
		},
		iconWrap: {
			width: PILL_WIDTH,
			height: PILL_HEIGHT,
			alignItems: "center",
			justifyContent: "center",
		},
		pill: {
			position: "absolute",
			width: PILL_WIDTH,
			height: PILL_HEIGHT,
			borderRadius: PILL_HEIGHT / 2,
			backgroundColor: theme.accent + "22",
		},
		// Faint pill under the finger on an unselected tab, in the same spot as the selected pill.
		pressLayer: {
			position: "absolute",
			width: PILL_WIDTH,
			height: PILL_HEIGHT,
			borderRadius: PILL_HEIGHT / 2,
			backgroundColor: theme.mutedForeground + "1F",
		},
		badge: {
			position: "absolute",
			top: 1,
			left: PILL_WIDTH / 2 + 4,
			minWidth: 18,
			height: 18,
			paddingHorizontal: 5,
			borderRadius: 9,
			backgroundColor: theme.accent,
			borderWidth: 2,
			borderColor: theme.card,
			alignItems: "center",
			justifyContent: "center",
		},
		badgeText: {
			fontFamily: "sans-bold",
			fontSize: 10,
			color: "#fff",
		},
		label: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		labelFocused: {
			fontFamily: "sans-bold",
			color: theme.accent,
		},
	});
