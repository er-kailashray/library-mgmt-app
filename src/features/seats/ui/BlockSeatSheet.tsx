import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { blockSeatApi } from "@/features/seats/logic/seats-api";
import { seatLabel } from "@/features/seats/logic/seat-display";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { DateField } from "@/shared/ui/DateField";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Text, TextInput } from "@/shared/ui/Text";
import { showToast } from "@/shared/ui/Toast";
import { addDays, addMonths, formatShortDate, todayIso } from "@/shared/utils/dates";
import { haptics } from "@/shared/utils/haptics";

/** One-tap reasons; anything else can be typed. */
const REASONS = ["Repair", "Reserved", "Cleaning"];

type Props = {
	seat: SeatMatrixSeat | null;
	batches: MatrixBatchRef[];
	onClose: () => void;
	onBlocked: () => void;
};

/**
 * Takes a seat out of use for a while: in every batch or only some, from a day until another day
 * or until it's unblocked, with an optional reason. Batches where someone sits can't be picked -
 * move them to another seat first.
 */
export function BlockSeatSheet({ seat: openSeat, batches, onClose, onBlocked }: Props) {
	// Keep showing the last seat while the sheet slides away.
	const lastSeat = useRef(openSeat);
	if (openSeat) lastSeat.current = openSeat;
	const seat = openSeat ?? lastSeat.current;

	return (
		<BottomSheet visible={!!openSeat} onClose={onClose} title={seat ? `Block ${seatLabel(seat.seat_number).toLowerCase()}` : "Block seat"} subtitle="Take it out of use for a while" showClose bottomPadding={28}>
			{seat && <BlockSeatForm key={seat.seat_id} seat={seat} batches={batches} visible={!!openSeat} onBlocked={onBlocked} />}
		</BottomSheet>
	);
}

function BlockSeatForm({ seat, batches, visible, onBlocked }: { seat: SeatMatrixSeat; batches: MatrixBatchRef[]; visible: boolean; onBlocked: () => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const today = todayIso();

	// Who sits where, and which batches are already blocked today: neither can be picked.
	const takenBy = (batchId: number) => seat.batches.find((b) => b.batch_id === batchId)?.occupant?.name ?? null;
	const alreadyBlocked = (batchId: number) => !!seat.batches.find((b) => b.batch_id === batchId)?.blocked;
	const pickable = batches.filter((b) => !takenBy(b.id) && !alreadyBlocked(b.id));
	const canBlockAll = pickable.length === batches.length && batches.length > 0;

	const [allBatches, setAllBatches] = useState(canBlockAll);
	const [picked, setPicked] = useState<number[]>([]);
	const [length, setLength] = useState<"open" | "dates">("open");
	const [startsOn, setStartsOn] = useState(today);
	const [endsOn, setEndsOn] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// Fresh form each time the sheet opens.
	useEffect(() => {
		if (!visible) return;
		setAllBatches(canBlockAll);
		setPicked(canBlockAll ? [] : pickable.length === 1 ? [pickable[0].id] : []);
		setLength("open");
		setStartsOn(today);
		setEndsOn(null);
		setReason("");
	}, [visible, seat.seat_id]);

	const toggleBatch = (batchId: number) => {
		haptics.selection();
		setAllBatches(false);
		setPicked((current) => (current.includes(batchId) ? current.filter((id) => id !== batchId) : [...current, batchId]));
	};

	const chosenCount = allBatches ? batches.length : picked.length;
	const needsEnd = length === "dates" && !endsOn;
	const canSave = chosenCount > 0 && !needsEnd && !isSaving;

	const save = async () => {
		if (!canSave) return;
		try {
			setIsSaving(true);
			await blockSeatApi(seat.seat_id, {
				...(allBatches ? {} : { batch_ids: picked }),
				starts_on: startsOn,
				...(length === "dates" && endsOn ? { ends_on: endsOn } : {}),
				...(reason.trim() ? { reason: reason.trim() } : {}),
			});
			const when = startsOn > today ? ` from ${formatShortDate(startsOn)}` : "";
			const until = length === "dates" && endsOn ? ` till ${formatShortDate(endsOn)}` : "";
			showToast({
				message: `${seatLabel(seat.seat_number)} blocked`,
				detail: `${allBatches ? "All batches" : `${picked.length} batch${picked.length === 1 ? "" : "es"}`}${when}${until}.`,
			});
			onBlocked();
		} catch (err: any) {
			showToast({ message: "Couldn't block the seat", detail: err.message, tone: "error" });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<View>
			<Text style={styles.label}>Batches</Text>
			<View style={styles.chips}>
				<Chip
					label="All batches"
					selected={allBatches}
					disabled={!canBlockAll}
					onPress={() => {
						haptics.selection();
						setAllBatches(true);
						setPicked([]);
					}}
					styles={styles}
				/>
				{batches.map((batch) => {
					const sitter = takenBy(batch.id);
					const blocked = alreadyBlocked(batch.id);
					return (
						<Chip
							key={batch.id}
							label={batch.name}
							note={sitter ? `${sitter} sits here` : blocked ? "Already blocked" : undefined}
							selected={!allBatches && picked.includes(batch.id)}
							disabled={!!sitter || blocked}
							onPress={() => toggleBatch(batch.id)}
							styles={styles}
						/>
					);
				})}
			</View>
			{!canBlockAll && pickable.length < batches.length && batches.some((b) => takenBy(b.id)) && (
				<Text style={styles.hint}>To block a batch where someone sits, change their seat first.</Text>
			)}

			<Text style={[styles.label, styles.labelSpaced]}>For how long</Text>
			<SegmentedControl
				segments={[
					{ key: "open", label: "Until I unblock" },
					{ key: "dates", label: "Till a date" },
				]}
				value={length}
				onChange={(next) => {
					setLength(next);
					if (next === "dates" && !endsOn) setEndsOn(addDays(startsOn, 6));
				}}
			/>

			<View style={styles.dates}>
				<View style={styles.dateCol}>
					<Text style={styles.smallLabel}>From</Text>
					<DateField
						value={startsOn}
						onChange={(iso) => {
							setStartsOn(iso);
							if (endsOn && endsOn < iso) setEndsOn(iso);
						}}
						minDate={today}
						maxDate={addMonths(today, 12)}
						sheetTitle="Blocked from"
					/>
				</View>
				{length === "dates" && (
					<View style={styles.dateCol}>
						<Text style={styles.smallLabel}>Till (last day)</Text>
						<DateField value={endsOn} onChange={setEndsOn} minDate={startsOn} maxDate={addMonths(startsOn, 12)} sheetTitle="Blocked till" placeholder="Pick a day" />
					</View>
				)}
			</View>

			<Text style={[styles.label, styles.labelSpaced]}>Reason (optional)</Text>
			<View style={styles.reasonChips}>
				{REASONS.map((r) => (
					<Pressable
						key={r}
						accessibilityRole="button"
						onPress={() => {
							haptics.selection();
							setReason(reason === r ? "" : r);
						}}
						style={[styles.reasonChip, reason === r && styles.reasonChipOn]}>
						<Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextOn]}>{r}</Text>
					</Pressable>
				))}
			</View>
			<TextInput
				style={styles.input}
				placeholder="e.g. Broken chair"
				placeholderTextColor={theme.mutedForeground + "80"}
				value={reason}
				onChangeText={setReason}
				maxLength={60}
			/>

			<Pressable accessibilityRole="button" style={[styles.saveBtn, !canSave && styles.saveBtnOff]} onPress={save} disabled={!canSave}>
				{isSaving ? (
					<ActivityIndicator color="#fff" />
				) : (
					<>
						<Ionicons name="lock-closed" size={16} color="#fff" />
						<Text style={styles.saveText}>Block seat</Text>
					</>
				)}
			</Pressable>
		</View>
	);
}

function Chip({
	label,
	note,
	selected,
	disabled,
	onPress,
	styles,
}: {
	label: string;
	note?: string;
	selected: boolean;
	disabled?: boolean;
	onPress: () => void;
	styles: ReturnType<typeof createStyles>;
}) {
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected, disabled }}
			accessibilityLabel={note ? `${label}, ${note}` : label}
			disabled={disabled}
			onPress={onPress}
			style={[styles.chip, selected && styles.chipOn, disabled && styles.chipOff]}>
			<Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
			{note && <Text style={styles.chipNote}>{note}</Text>}
		</Pressable>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		label: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.primary,
			marginBottom: 8,
		},
		labelSpaced: {
			marginTop: 18,
		},
		smallLabel: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginBottom: 6,
		},
		chips: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: 8,
		},
		chip: {
			paddingHorizontal: 14,
			paddingVertical: 9,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
		},
		chipOn: {
			backgroundColor: theme.accent,
			borderColor: theme.accent,
		},
		chipOff: {
			opacity: 0.5,
		},
		chipText: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.primary,
		},
		chipTextOn: {
			fontFamily: "sans-semibold",
			color: "#fff",
		},
		chipNote: {
			fontFamily: "sans-regular",
			fontSize: 11,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		hint: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 8,
		},
		dates: {
			flexDirection: "row",
			gap: 12,
			marginTop: 12,
		},
		dateCol: {
			flex: 1,
		},
		reasonChips: {
			flexDirection: "row",
			gap: 8,
			marginBottom: 10,
		},
		reasonChip: {
			paddingHorizontal: 12,
			paddingVertical: 6,
			borderRadius: 999,
			backgroundColor: theme.muted,
		},
		reasonChipOn: {
			backgroundColor: theme.primary,
		},
		reasonChipText: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.primary,
		},
		reasonChipTextOn: {
			color: theme.card,
		},
		input: {
			fontFamily: "sans-regular",
			fontSize: 15,
			color: theme.primary,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			paddingHorizontal: 14,
			paddingVertical: 12,
		},
		saveBtn: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			marginTop: 22,
			paddingVertical: 15,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent,
		},
		saveBtnOff: {
			opacity: 0.5,
		},
		saveText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
	});
