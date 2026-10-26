import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

/** A section's title, with an optional link on the right ("See all"). */
export function SectionHeader({ title, linkLabel, onLink }: { title: string; linkLabel?: string; onLink?: () => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	return (
		<View style={styles.header}>
			<Text style={styles.title}>{title}</Text>
			{linkLabel && onLink && <TextLink label={linkLabel} onPress={onLink} />}
		</View>
	);
}

/** Coral "Label →" link, used at the foot of cards and beside section titles. */
export function TextLink({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const tint = color ?? theme.accent;
	return (
		<Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
			<Text style={[styles.linkText, { color: tint }]}>{label}</Text>
			<Ionicons name="arrow-forward" size={14} color={tint} />
		</Pressable>
	);
}

/** Fades and lifts its content in once, `delay` ms after it first appears (Home staggers its sections). */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
	const value = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(value, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [value, delay]);

	return <Animated.View style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}

/** A softly pulsing placeholder block, shown while Home's first load is in flight. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
	const { theme } = useTheme();
	const pulse = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
				Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [pulse]);

	return (
		<Animated.View
			style={[{ backgroundColor: theme.muted, borderRadius: RADIUS.md, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }, style]}
		/>
	);
}

/** Placeholder layout for Home before the dashboard arrives: hero, actions, two cards. */
export function HomeSkeleton() {
	return (
		<View style={{ gap: 16 }}>
			<Skeleton style={{ height: 196, borderRadius: RADIUS.lg }} />
			<Skeleton style={{ height: 168 }} />
			<Skeleton style={{ height: 150 }} />
			<Skeleton style={{ height: 120 }} />
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 12,
		},
		title: {
			fontFamily: "sans-bold",
			fontSize: 17,
			color: theme.primary,
			letterSpacing: -0.2,
		},
		link: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
		},
		linkText: {
			fontFamily: "sans-bold",
			fontSize: 13,
		},
		pressed: {
			opacity: 0.6,
		},
	});
