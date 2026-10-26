import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { scale, ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

type Action = {
	key: string;
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
	href: Href;
};

// The everyday jobs that have no tab of their own. Members and Payments are tabs, Settings is the
// header avatar, and Batches (changed rarely) lives in Settings.
const ACTIONS: Action[] = [
	{ key: "admission", label: "Admission", icon: "person-add-outline", href: "/admission" },
	{ key: "attendance", label: "Attendance", icon: "checkbox-outline", href: "/attendance" },
	{ key: "seats", label: "Seats", icon: "grid-outline", href: "/seats" },
	{ key: "renewals", label: "Renewals", icon: "refresh-outline", href: "/renewals" },
];

/** One row of four one-tap shortcuts in a single card. */
export function QuickActions() {
	const router = useRouter();
	const { theme } = useTheme();
	const styles = createStyles(theme);

	return (
		<View style={styles.card}>
			{ACTIONS.map((action) => (
				<Pressable
					key={action.key}
					accessibilityRole="button"
					accessibilityLabel={action.label}
					style={({ pressed }) => [styles.item, pressed && styles.pressed]}
					onPress={() => router.push(action.href)}>
					<View style={styles.icon}>
						<Ionicons name={action.icon} size={22} color={theme.accent} />
					</View>
					<Text style={styles.label} numberOfLines={1}>
						{action.label}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		card: {
			flexDirection: "row",
			flexWrap: "wrap",
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
			paddingVertical: 8,
			paddingHorizontal: 4,
		},
		item: {
			width: "25%",
			alignItems: "center",
			paddingVertical: 10,
			gap: 8,
		},
		icon: {
			width: scale(52),
			height: scale(52),
			borderRadius: scale(16),
			backgroundColor: theme.accent + "14",
			alignItems: "center",
			justifyContent: "center",
		},
		label: {
			fontFamily: "sans-semibold",
			fontSize: 12,
			color: theme.primary,
		},
		pressed: {
			opacity: 0.75,
			transform: [{ scale: 0.96 }],
		},
	});
