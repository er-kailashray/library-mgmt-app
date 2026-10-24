import { Pressable, StyleSheet, Text } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";

type FilterChipProps = {
	label: string;
	selected: boolean;
	onPress: () => void;
};

/** A filter pill for horizontal filter rows (Members status, Seats batches). Coral when selected. */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	return (
		<Pressable accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
			<Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
				{label}
			</Text>
		</Pressable>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		chip: {
			paddingHorizontal: 18,
			paddingVertical: 10,
			borderRadius: RADIUS.md,
			backgroundColor: theme.card,
			borderWidth: 1.5,
			borderColor: theme.border,
		},
		chipSelected: {
			backgroundColor: theme.accent,
			borderColor: theme.accent,
		},
		text: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		textSelected: {
			color: "#fff",
		},
	});
