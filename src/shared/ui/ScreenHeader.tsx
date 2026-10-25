import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";

type ScreenHeaderProps = {
	title: string;
	/** One short line saying what the screen is for. */
	subtitle?: string;
	/** Defaults to going back. */
	onBack?: () => void;
	/** Buttons on the right, usually one or two HeaderIconButtons. */
	right?: ReactNode;
};

/**
 * The header every inner screen uses: round back button, title, a one-line subtitle and optional
 * actions on the right, with a hairline underneath. Keeps sizes identical from screen to screen.
 */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
	const router = useRouter();
	const { theme } = useTheme();
	const styles = createStyles(theme);

	return (
		<View style={styles.wrapper}>
			<View style={styles.row}>
				<HeaderIconButton icon="arrow-back" label="Go back" onPress={onBack ?? (() => router.back())} />
				<View style={styles.text}>
					<Text style={styles.title} numberOfLines={1}>
						{title}
					</Text>
					{!!subtitle && (
						<Text style={styles.subtitle} numberOfLines={1}>
							{subtitle}
						</Text>
					)}
				</View>
				{right}
			</View>
		</View>
	);
}

type HeaderIconButtonProps = {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
	/** Solid primary circle, for the screen's main action (e.g. "+" to add). */
	filled?: boolean;
	busy?: boolean;
};

/** Round 44pt button matching the header's back button. */
export function HeaderIconButton({ icon, label, onPress, filled = false, busy = false }: HeaderIconButtonProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const color = filled ? theme.background : theme.primary;

	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.iconButton, filled && styles.iconButtonFilled]} onPress={onPress} disabled={busy}>
			{busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={22} color={color} />}
		</Pressable>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		wrapper: {
			paddingTop: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.border,
			zIndex: 10,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: 20,
			paddingBottom: 14,
			gap: 14,
		},
		text: {
			flex: 1,
		},
		title: {
			fontFamily: "sans-extrabold",
			fontSize: 19,
			color: theme.primary,
			marginBottom: 1,
		},
		subtitle: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		iconButton: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: theme.card,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 1.5,
			borderColor: theme.border,
		},
		iconButtonFilled: {
			backgroundColor: theme.primary,
			borderColor: theme.primary,
		},
	});
