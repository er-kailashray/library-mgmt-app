import { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from "react-native";

import { formatTime, MINUTE_STEPS } from "@/features/batches/logic/batch-time";
import { useTheme } from "@/shared/providers/ThemeProvider";

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const PERIODS = ["AM", "PM"];

/** Wheel geometry: rows are ITEM_HEIGHT tall and VISIBLE_ROWS show at once, the middle one selected. */
const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const EDGE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

type Props = {
	title: string;
	/** "HH:MM" (24h) the picker opens on. */
	initialValue: string;
	/** Minute steps on the wheel; batches use 15 (the default), arrival times 5. */
	minuteStep?: number;
	onDone: (value: string) => void;
	onCancel: () => void;
};

/** One scrollable column that snaps to a row; the row in the middle band is the selection. */
function Wheel({ items, index, onChange }: { items: string[]; index: number; onChange: (index: number) => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const ref = useRef<ScrollViewInstance>(null);

	// Open on the starting value without animating.
	useEffect(() => {
		const timer = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false }), 0);
		return () => clearTimeout(timer);
		// Only on mount; afterwards the wheel's own scrolling drives the index.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const next = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
		if (next !== index) onChange(next);
	};

	return (
		<View style={styles.wheel}>
			<ScrollView
				ref={ref}
				showsVerticalScrollIndicator={false}
				snapToInterval={ITEM_HEIGHT}
				decelerationRate="fast"
				scrollEventThrottle={16}
				onScroll={onScroll}
				nestedScrollEnabled
				contentContainerStyle={{ paddingVertical: EDGE_PADDING }}>
				{items.map((item, i) => (
					<Pressable key={item} style={styles.wheelItem} onPress={() => ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true })}>
						<Text style={[styles.wheelText, i === index && styles.wheelTextSelected, Math.abs(i - index) >= 2 && styles.wheelTextFar]}>{item}</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	);
}

/** Hour / minute (15-minute steps) / AM-PM scroll wheels, shown in place of the batch form. */
export function BatchTimeWheelPicker({ title, initialValue, minuteStep = 15, onDone, onCancel }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	const [initialHours, initialMinutes] = initialValue.split(":").map(Number);
	const [hourIndex, setHourIndex] = useState(HOURS.indexOf(initialHours % 12 || 12));
	const minutes = minuteStep === 15 ? [...MINUTE_STEPS] : Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);
	// Round the starting time down to the nearest step.
	const [minuteIndex, setMinuteIndex] = useState(Math.max(0, Math.floor(initialMinutes / minuteStep)));
	const [periodIndex, setPeriodIndex] = useState(initialHours >= 12 ? 1 : 0);

	const hours24 = (HOURS[hourIndex] % 12) + (periodIndex === 1 ? 12 : 0);
	const value = `${String(hours24).padStart(2, "0")}:${String(minutes[minuteIndex]).padStart(2, "0")}`;

	return (
		<View>
			<Text style={styles.title}>{title}</Text>

			<View style={styles.wheels}>
				{/* Band behind the middle row marks the selection across all three wheels. */}
				<View pointerEvents="none" style={styles.selectionBand} />
				<Wheel items={HOURS.map(String)} index={hourIndex} onChange={setHourIndex} />
				<Text style={styles.colon}>:</Text>
				<Wheel items={minutes.map((m) => String(m).padStart(2, "0"))} index={minuteIndex} onChange={setMinuteIndex} />
				<Wheel items={PERIODS} index={periodIndex} onChange={setPeriodIndex} />
			</View>

			<Pressable accessibilityRole="button" style={styles.doneBtn} onPress={() => onDone(value)}>
				<Text style={styles.doneText}>Set {formatTime(value)}</Text>
			</Pressable>
			<Pressable accessibilityRole="button" style={styles.cancelBtn} onPress={onCancel}>
				<Text style={styles.cancelText}>Cancel</Text>
			</Pressable>
		</View>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		title: {
			fontFamily: "sans-bold",
			fontSize: 16,
			color: theme.mutedForeground,
			textAlign: "center",
			marginBottom: 16,
		},
		wheels: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			height: ITEM_HEIGHT * VISIBLE_ROWS,
			marginBottom: 24,
		},
		selectionBand: {
			position: "absolute",
			left: 0,
			right: 0,
			top: EDGE_PADDING,
			height: ITEM_HEIGHT,
			borderRadius: 14,
			backgroundColor: theme.accent + "1A",
			borderWidth: 1.5,
			borderColor: theme.accent + "40",
		},
		wheel: {
			width: 76,
			height: ITEM_HEIGHT * VISIBLE_ROWS,
		},
		wheelItem: {
			height: ITEM_HEIGHT,
			alignItems: "center",
			justifyContent: "center",
		},
		wheelText: {
			fontFamily: "sans-semibold",
			fontSize: 20,
			color: theme.mutedForeground,
		},
		wheelTextSelected: {
			fontFamily: "sans-extrabold",
			fontSize: 26,
			color: theme.primary,
		},
		wheelTextFar: {
			opacity: 0.4,
		},
		colon: {
			fontFamily: "sans-extrabold",
			fontSize: 26,
			color: theme.primary,
		},
		doneBtn: {
			backgroundColor: theme.accent,
			padding: 18,
			borderRadius: 16,
			alignItems: "center",
		},
		doneText: {
			fontFamily: "sans-extrabold",
			fontSize: 16,
			color: "#fff",
		},
		cancelBtn: {
			padding: 16,
			alignItems: "center",
			marginTop: 4,
		},
		cancelText: {
			fontFamily: "sans-extrabold",
			fontSize: 16,
			color: theme.accent,
		},
	});
