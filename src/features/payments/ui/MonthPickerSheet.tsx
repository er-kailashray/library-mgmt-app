import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Text } from "@/shared/ui/Text";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
	visible: boolean;
	/** "YYYY-MM" currently shown. */
	value: string;
	/** Latest pickable month, "YYYY-MM" (the current month). */
	maxMonth: string;
	onPick: (month: string) => void;
	onClose: () => void;
};

/** Jump to any month: year arrows and a 4x3 grid of months. Future months can't be picked. */
export function MonthPickerSheet(props: Props) {
	return (
		<BottomSheet visible={props.visible} onClose={props.onClose} title="Pick a month" showClose bottomPadding={24}>
			<MonthPickerContent {...props} />
		</BottomSheet>
	);
}

function MonthPickerContent({ value, maxMonth, onPick }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const [year, setYear] = useState(Number(value.slice(0, 4)));
	useEffect(() => setYear(Number(value.slice(0, 4))), [value]);
	const maxYear = Number(maxMonth.slice(0, 4));

	return (
		<>
			<View style={styles.yearRow}>
				<Pressable accessibilityRole="button" accessibilityLabel="Previous year" onPress={() => setYear((y) => y - 1)} hitSlop={8} style={styles.yearArrow}>
					<Ionicons name="chevron-back" size={20} color={theme.primary} />
				</Pressable>
				<Text style={styles.yearText}>{year}</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Next year"
					disabled={year >= maxYear}
					onPress={() => setYear((y) => y + 1)}
					hitSlop={8}
					style={[styles.yearArrow, year >= maxYear && styles.disabled]}>
					<Ionicons name="chevron-forward" size={20} color={theme.primary} />
				</Pressable>
			</View>

			<View style={styles.grid}>
				{MONTHS.map((label, i) => {
					const month = `${year}-${String(i + 1).padStart(2, "0")}`;
					const enabled = month <= maxMonth;
					const selected = month === value;
					return (
						<Pressable
							key={month}
							accessibilityRole="button"
							accessibilityState={{ selected, disabled: !enabled }}
							disabled={!enabled}
							onPress={() => onPick(month)}
							style={[styles.month, selected && styles.monthSelected, !enabled && styles.disabled]}>
							<Text style={[styles.monthText, selected && styles.monthTextSelected]}>{label}</Text>
						</Pressable>
					);
				})}
			</View>
		</>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		yearRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 12,
		},
		yearArrow: {
			width: 36,
			height: 36,
			borderRadius: 18,
			alignItems: "center",
			justifyContent: "center",
		},
		yearText: {
			fontFamily: "sans-extrabold",
			fontSize: 17,
			color: theme.primary,
		},
		grid: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "space-between",
			rowGap: 10,
		},
		// Three per row.
		month: {
			width: "31.5%",
			paddingVertical: 14,
			alignItems: "center",
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1.5,
			borderColor: theme.border,
		},
		monthSelected: {
			backgroundColor: theme.accent,
			borderColor: theme.accent,
		},
		monthText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		monthTextSelected: {
			color: "#fff",
		},
		disabled: {
			opacity: 0.3,
		},
	});
