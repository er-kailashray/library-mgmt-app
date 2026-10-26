import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { FLOATING_SHADOW } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";

type FloatingActionButtonProps = {
	/** Read by screen readers, e.g. "Add batch". */
	label: string;
	onPress: () => void;
	icon?: keyof typeof Ionicons.glyphMap;
};

/** Height the button occupies above the safe area; list screens pad their scroll content by this. */
export const FAB_CLEARANCE = 30 + 60 + 16;

/**
 * The single "add" action on list screens (members, payments, batches): a coral circle
 * floating bottom-right. Use this instead of an add button in the header so every screen matches.
 */
export function FloatingActionButton({ label, onPress, icon = "add" }: FloatingActionButtonProps) {
	const { theme } = useTheme();
	const bottomInset = useScreenBottomInset();
	const styles = createStyles(theme);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => [styles.fab, { bottom: 30 + bottomInset }, pressed && styles.fabPressed]}
			onPress={onPress}
		>
			<Ionicons name={icon} size={30} color="#fff" />
		</Pressable>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		fab: {
			position: "absolute",
			right: 20,
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: theme.accent,
			alignItems: "center",
			justifyContent: "center",
			...FLOATING_SHADOW,
			shadowColor: theme.accent,
		},
		fabPressed: {
			opacity: 0.85,
			transform: [{ scale: 0.96 }],
		},
	});
