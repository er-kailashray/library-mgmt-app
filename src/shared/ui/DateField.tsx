import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CalendarPicker } from "@/shared/ui/CalendarPicker";
import { Text } from "@/shared/ui/Text";
import { formatShortDate, todayIso } from "@/shared/utils/dates";

type DateFieldProps = {
	/** "YYYY-MM-DD", or null when nothing is picked yet. */
	value: string | null;
	onChange: (iso: string) => void;
	minDate: string;
	maxDate: string;
	/** Heading of the calendar popup, e.g. "Joining date". */
	sheetTitle: string;
	/** Small line under the date, e.g. "Already paid for". */
	note?: string;
	/** Shown when value is null. */
	placeholder?: string;
	/** No border or padding of its own, for use inside a card that already has them. */
	bare?: boolean;
};

/**
 * A compact date card (like the seat card): the chosen date with a Change button. The calendar
 * only opens in a popup when asked for, so it doesn't fill the screen.
 */
export function DateField({ value, onChange, minDate, maxDate, sheetTitle, note, placeholder = "Pick a date", bare = false }: DateFieldProps) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const [open, setOpen] = useState(false);
	const isToday = value === todayIso();

	return (
		<>
			<Pressable accessibilityRole="button" accessibilityLabel={`${sheetTitle}: ${value ? formatShortDate(value, true) : placeholder}. Change`} style={[styles.field, bare && styles.fieldBare]} onPress={() => setOpen(true)}>
				<View style={styles.icon}>
					<Ionicons name="calendar-outline" size={20} color={theme.accent} />
				</View>
				<View style={styles.text}>
					{/* Always one line; shrinks a little on narrow phones rather than wrapping. */}
					<Text style={[styles.date, !value && styles.datePlaceholder]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
						{value ? `${isToday ? "Today, " : ""}${formatShortDate(value, true)}` : placeholder}
					</Text>
					{!!note && <Text style={styles.note}>{note}</Text>}
				</View>
				<View style={[styles.changeButton, bare && styles.changeButtonBare]}>
					<Text style={styles.changeText}>{value ? "Change" : "Pick"}</Text>
				</View>
			</Pressable>

			<BottomSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle} showClose bottomPadding={24}>
				<CalendarBody
					value={value}
					minDate={minDate}
					maxDate={maxDate}
					onDone={(iso) => {
						onChange(iso);
						setOpen(false);
					}}
				/>
			</BottomSheet>
		</>
	);
}

function CalendarBody({ value, minDate, maxDate, onDone }: { value: string | null; minDate: string; maxDate: string; onDone: (iso: string) => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	// Picking only previews; "Done" confirms, so a stray tap doesn't change the form.
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);

	return (
		<>
			<CalendarPicker value={draft} onChange={setDraft} minDate={minDate} maxDate={maxDate} />
			<Pressable accessibilityRole="button" style={[styles.doneButton, !draft && styles.doneButtonDisabled]} disabled={!draft} onPress={() => draft && onDone(draft)}>
				<Text style={styles.doneText}>{draft ? `Set ${formatShortDate(draft, true)}` : "Pick a date"}</Text>
			</Pressable>
		</>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		field: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			padding: 14,
		},
		fieldBare: {
			backgroundColor: "transparent",
			borderWidth: 0,
			padding: 0,
		},
		icon: {
			width: 44,
			height: 44,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.accent + "1A",
			alignItems: "center",
			justifyContent: "center",
		},
		text: {
			flex: 1,
		},
		date: {
			fontFamily: "sans-semibold",
			fontSize: 16,
			color: theme.primary,
		},
		datePlaceholder: {
			color: theme.mutedForeground,
		},
		note: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		changeButton: {
			borderWidth: 1,
			borderColor: theme.accent,
			borderRadius: RADIUS.sm,
			paddingHorizontal: 12,
			paddingVertical: 6,
		},
		changeButtonBare: {
			borderWidth: 0,
			paddingHorizontal: 4,
		},
		changeText: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.accent,
		},
		doneButton: {
			backgroundColor: theme.accent,
			borderRadius: RADIUS.md,
			paddingVertical: 16,
			alignItems: "center",
			marginTop: 16,
		},
		doneButtonDisabled: {
			opacity: 0.5,
		},
		doneText: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: "#fff",
		},
	});
