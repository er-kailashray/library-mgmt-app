import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";

import { SEAT_BLOCK_SIZE, seatBlocks } from "@/features/admission/logic/seat-picking";
import { SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { RADIUS } from "@/shared/constants/layout";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Text, TextInput } from "@/shared/ui/Text";

type Props = {
	visible: boolean;
	/** e.g. "Seat for Morning & Evening". */
	title: string;
	/** All seats, in seat-number order. */
	seats: SeatMatrixSeat[];
	isFree: (seat: SeatMatrixSeat) => boolean;
	selectedSeatId: number | null;
	onPick: (seatId: number) => void;
	onClose: () => void;
	/** After the sheet has finished sliding away, e.g. to open a confirmation next. */
	onClosed?: () => void;
};

/**
 * Seat picker that stays quick for big libraries: type a seat number to check it directly, or
 * browse 50 seats at a time with each block's free count shown. Free seats only by default.
 */
export function SeatPickerSheet(props: Props) {
	return (
		// The sheet rides on top of the keyboard while a seat number is typed, and the grid shrinks to fit.
		<BottomSheet visible={props.visible} onClose={props.onClose} onClosed={props.onClosed} title={props.title} showClose bottomPadding={24}>
			<SeatPickerContent {...props} />
		</BottomSheet>
	);
}

function SeatPickerContent({ visible, seats, isFree, selectedSeatId, onPick }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	const blocks = useMemo(() => seatBlocks(seats), [seats]);
	const freeCounts = useMemo(() => blocks.map((block) => block.seats.filter(isFree).length), [blocks, isFree]);
	const showBlocks = seats.length > SEAT_BLOCK_SIZE;

	const [query, setQuery] = useState("");
	const [freeOnly, setFreeOnly] = useState(true);
	const [blockIndex, setBlockIndex] = useState(0);
	// Tiles are sized from the grid's own width so each row fills it exactly, with no gap left over.
	const [gridWidth, setGridWidth] = useState(0);
	const columns = gridWidth >= 330 ? 6 : 5;
	const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;

	const blockOf = (seatId: number) => blocks.findIndex((block) => block.seats.some((seat) => seat.seat_id === seatId));

	// Each time it opens: start on the block holding the current seat, else the first with a free seat.
	useEffect(() => {
		if (!visible) return;
		setQuery("");
		const selectedBlock = selectedSeatId != null ? blockOf(selectedSeatId) : -1;
		const firstWithFree = freeCounts.findIndex((count) => count > 0);
		setBlockIndex(selectedBlock >= 0 ? selectedBlock : Math.max(0, firstWithFree));
		// Only when opened; blocks/counts are stable while it's open.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	const typed = query.trim();
	const match = typed ? seats.find((seat) => String(seat.seat_number) === typed) ?? null : null;

	// Typing a seat number also moves the grid to its block.
	useEffect(() => {
		if (match) {
			const index = blockOf(match.seat_id);
			if (index >= 0) setBlockIndex(index);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [match?.seat_id]);

	const block = blocks[blockIndex];
	const gridSeats = (showBlocks ? block?.seats : seats) ?? [];
	const visibleSeats = freeOnly ? gridSeats.filter(isFree) : gridSeats;

	return (
		<>
			{/* Jump straight to a seat, e.g. a student's usual one. */}
			<View style={styles.searchBox}>
				<Ionicons name="search" size={18} color={theme.mutedForeground} />
				<TextInput
					style={styles.searchInput}
					placeholder="Type a seat number"
					placeholderTextColor={theme.mutedForeground + "80"}
					keyboardType="number-pad"
					value={query}
					onChangeText={setQuery}
					maxLength={5}
				/>
			</View>
			{typed !== "" && (
				<View style={styles.searchResult}>
					{!match ? (
						<Text style={styles.searchResultMuted}>There's no seat {typed}.</Text>
					) : isFree(match) ? (
						<>
							<Text style={styles.searchResultFree}>Seat {match.seat_number} is free</Text>
							<Pressable accessibilityRole="button" style={styles.pickBtn} onPress={() => onPick(match.seat_id)}>
								<Text style={styles.pickBtnText}>Pick</Text>
							</Pressable>
						</>
					) : (
						<Text style={styles.searchResultTaken}>Seat {match.seat_number} is taken in this time.</Text>
					)}
				</View>
			)}

			{showBlocks && (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blockRow} style={styles.blockScroll}>
					{blocks.map((b, i) => {
						const active = i === blockIndex;
						return (
							<Pressable
								key={b.key}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								style={[styles.blockChip, active && styles.blockChipActive, freeCounts[i] === 0 && !active && styles.blockChipFull]}
								onPress={() => setBlockIndex(i)}>
								<Text style={[styles.blockLabel, active && styles.blockTextActive]}>{b.label}</Text>
								<Text style={[styles.blockCount, active && styles.blockTextActive]}>{freeCounts[i] === 0 ? "full" : `${freeCounts[i]} free`}</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			)}

			<View style={styles.toggleRow}>
				<Text style={styles.toggleLabel}>Free seats only</Text>
				<Switch value={freeOnly} onValueChange={setFreeOnly} trackColor={{ true: theme.accent, false: theme.muted }} thumbColor="#fff" />
			</View>

			<ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled" onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
				{visibleSeats.length === 0 ? (
					<Text style={styles.emptyText}>{showBlocks && block ? `No free seats in ${block.label}.` : "No free seats."}</Text>
				) : (
					visibleSeats.map((seat) => {
						const free = isFree(seat);
						const selected = seat.seat_id === selectedSeatId;
						return (
							<Pressable
								key={seat.seat_id}
								accessibilityRole="button"
								accessibilityLabel={`Seat ${seat.seat_number}${free ? "" : ", taken"}`}
								accessibilityState={{ selected, disabled: !free }}
								disabled={!free}
								style={[styles.seat, tileWidth > 0 && { width: tileWidth }, selected && styles.seatSelected, !free && styles.seatTaken]}
								onPress={() => onPick(seat.seat_id)}>
								<Text style={[styles.seatText, selected && styles.seatTextSelected, !free && styles.seatTextTaken]}>{seat.seat_number}</Text>
							</Pressable>
						);
					})
				)}
			</ScrollView>
		</>
	);
}

/** Space between seat tiles; the tile width is worked out from it. */
const GRID_GAP = 8;

const createStyles = (theme: any) =>
	ScaledSheet.create({
		searchBox: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			paddingHorizontal: 14,
		},
		searchInput: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 16,
			color: theme.primary,
			paddingVertical: 12,
		},
		searchResult: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			minHeight: 40,
			marginTop: 8,
		},
		searchResultFree: {
			flex: 1,
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.success,
		},
		searchResultTaken: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.destructive,
		},
		searchResultMuted: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.mutedForeground,
		},
		pickBtn: {
			backgroundColor: theme.accent,
			borderRadius: RADIUS.sm,
			paddingHorizontal: 18,
			paddingVertical: 8,
		},
		pickBtnText: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: "#fff",
		},
		// Never squashed by the seat grid below (ScrollViews shrink by default).
		blockScroll: {
			flexGrow: 0,
			flexShrink: 0,
			marginTop: 14,
		},
		blockRow: {
			gap: 8,
		},
		blockChip: {
			alignItems: "center",
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.sm,
			paddingHorizontal: 12,
			paddingVertical: 8,
			minWidth: 76,
		},
		blockChipActive: {
			backgroundColor: theme.accent,
			borderColor: theme.accent,
		},
		blockChipFull: {
			opacity: 0.5,
		},
		blockLabel: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.primary,
		},
		blockCount: {
			fontFamily: "sans-regular",
			fontSize: 11,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		blockTextActive: {
			color: "#fff",
		},
		toggleRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginTop: 12,
			marginBottom: 8,
		},
		toggleLabel: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.primary,
		},
		gridScroll: {
			flexGrow: 0,
			flexShrink: 1,
		},
		grid: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: GRID_GAP,
			paddingBottom: 8,
		},
		seat: {
			width: 54,
			height: 46,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.success + "59",
			alignItems: "center",
			justifyContent: "center",
		},
		seatSelected: {
			backgroundColor: theme.accent,
			borderColor: theme.accent,
		},
		seatTaken: {
			backgroundColor: theme.muted,
			borderColor: theme.muted,
		},
		seatText: {
			fontFamily: "sans-medium",
			fontSize: 15,
			color: theme.primary,
		},
		seatTextSelected: {
			fontFamily: "sans-semibold",
			color: "#fff",
		},
		seatTextTaken: {
			color: theme.mutedForeground + "80",
			textDecorationLine: "line-through",
		},
		emptyText: {
			fontFamily: "sans-regular",
			fontSize: 14,
			color: theme.mutedForeground,
			paddingVertical: 16,
		},
	});
