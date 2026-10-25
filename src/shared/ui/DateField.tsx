import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
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

			<Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
				<SafeAreaProvider>
					<CalendarSheet
						title={sheetTitle}
						value={value}
						minDate={minDate}
						maxDate={maxDate}
						onDone={(iso) => {
							onChange(iso);
							setOpen(false);
						}}
						onClose={() => setOpen(false)}
					/>
				</SafeAreaProvider>
			</Modal>
		</>
	);
}

function CalendarSheet({ title, value, minDate, maxDate, onDone, onClose }: { title: string; value: string | null; minDate: string; maxDate: string; onDone: (iso: string) => void; onClose: () => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const insets = useSafeAreaInsets();
	// Picking only previews; "Done" confirms, so a stray tap doesn't change the form.
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);

	return (
		<View style={styles.root}>
			<Pressable style={styles.overlay} onPress={onClose} />
			<View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
				<View style={styles.sheetHeader}>
					<Text style={styles.sheetTitle}>{title}</Text>
					<Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
						<Ionicons name="close" size={22} color={theme.mutedForeground} />
					</Pressable>
				</View>
				<CalendarPicker value={draft} onChange={setDraft} minDate={minDate} maxDate={maxDate} />
				<Pressable accessibilityRole="button" style={[styles.doneButton, !draft && styles.doneButtonDisabled]} disabled={!draft} onPress={() => draft && onDone(draft)}>
					<Text style={styles.doneText}>{draft ? `Set ${formatShortDate(draft, true)}` : "Pick a date"}</Text>
				</Pressable>
			</View>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
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
			fontFamily: "sans-extrabold",
			fontSize: 16,
			color: theme.primary,
		},
		datePlaceholder: {
			color: theme.mutedForeground,
		},
		note: {
			fontFamily: "sans-medium",
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
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
		},
		root: {
			flex: 1,
		},
		overlay: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.5)",
		},
		sheet: {
			backgroundColor: theme.background,
			borderTopLeftRadius: RADIUS.lg,
			borderTopRightRadius: RADIUS.lg,
			paddingHorizontal: 20,
			paddingTop: 20,
		},
		sheetHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 14,
		},
		sheetTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
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
			fontFamily: "sans-extrabold",
			fontSize: 15,
			color: "#fff",
		},
	});
