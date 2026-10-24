import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { fromIsoDate, toIsoDate } from "@/shared/utils/dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type CalendarPickerProps = {
	/** "YYYY-MM-DD" or null for nothing picked yet. */
	value: string | null;
	onChange: (iso: string) => void;
	/** Earliest pickable day, "YYYY-MM-DD". */
	minDate: string;
	/** Latest pickable day, "YYYY-MM-DD". */
	maxDate: string;
};

/** A one-month calendar with month arrows; days outside [minDate, maxDate] are greyed out. */
export function CalendarPicker({ value, onChange, minDate, maxDate }: CalendarPickerProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const today = toIsoDate(new Date());

	const start = fromIsoDate(value ?? (today >= minDate && today <= maxDate ? today : minDate));
	const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

	const first = new Date(month.getFullYear(), month.getMonth(), 1);
	const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	// Monday-first grid: blanks before the 1st.
	const leading = (first.getDay() + 6) % 7;
	const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
	while (cells.length % 7 !== 0) cells.push(null);

	const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
	const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
	const canGoBack = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 0)) >= minDate;
	const canGoForward = toIsoDate(nextMonth) <= maxDate;

	return (
		<View style={styles.wrap}>
			<View style={styles.monthRow}>
				<Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoBack} onPress={() => setMonth(prevMonth)} hitSlop={8} style={[styles.monthArrow, !canGoBack && styles.disabled]}>
					<Ionicons name="chevron-back" size={18} color={theme.primary} />
				</Pressable>
				<Text style={styles.monthLabel}>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Text>
				<Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canGoForward} onPress={() => setMonth(nextMonth)} hitSlop={8} style={[styles.monthArrow, !canGoForward && styles.disabled]}>
					<Ionicons name="chevron-forward" size={18} color={theme.primary} />
				</Pressable>
			</View>

			<View style={styles.grid}>
				{WEEKDAYS.map((d, i) => (
					<Text key={`w${i}`} style={styles.weekday}>
						{d}
					</Text>
				))}
				{cells.map((day, i) => {
					if (day == null) return <View key={`b${i}`} style={styles.cell} />;
					const iso = toIsoDate(new Date(month.getFullYear(), month.getMonth(), day));
					const enabled = iso >= minDate && iso <= maxDate;
					const selected = iso === value;
					const isToday = iso === today;
					return (
						<Pressable
							key={iso}
							accessibilityRole="button"
							accessibilityState={{ selected, disabled: !enabled }}
							disabled={!enabled}
							onPress={() => onChange(iso)}
							style={styles.cell}>
							<View style={[styles.day, selected && styles.daySelected, isToday && !selected && styles.dayToday]}>
								<Text style={[styles.dayText, !enabled && styles.dayTextDisabled, selected && styles.dayTextSelected]}>{day}</Text>
							</View>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		wrap: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1.5,
			borderColor: theme.border,
			padding: 12,
		},
		monthRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 8,
		},
		monthArrow: {
			width: 32,
			height: 32,
			borderRadius: 16,
			alignItems: "center",
			justifyContent: "center",
		},
		disabled: {
			opacity: 0.25,
		},
		monthLabel: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
		},
		grid: {
			flexDirection: "row",
			flexWrap: "wrap",
		},
		weekday: {
			width: `${100 / 7}%`,
			textAlign: "center",
			fontFamily: "sans-bold",
			fontSize: 11,
			color: theme.mutedForeground,
			paddingVertical: 4,
		},
		cell: {
			width: `${100 / 7}%`,
			aspectRatio: 1,
			alignItems: "center",
			justifyContent: "center",
		},
		day: {
			width: 34,
			height: 34,
			borderRadius: 17,
			alignItems: "center",
			justifyContent: "center",
		},
		daySelected: {
			backgroundColor: theme.accent,
		},
		dayToday: {
			borderWidth: 1.5,
			borderColor: theme.accent,
		},
		dayText: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		dayTextDisabled: {
			color: theme.mutedForeground + "55",
		},
		dayTextSelected: {
			color: "#fff",
		},
	});
