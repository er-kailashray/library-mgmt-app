import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { formatTime, formatTimeRange, toMinutes } from "@/features/batches/logic/batch-time";
import { Batch } from "@/features/batches/types/batches.types";
import { DashboardData } from "@/features/home/types/home.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

const DAY = 24 * 60;

/** Overlapping batches stack into rows on the timeline; beyond this many they share the last row. */
const MAX_LANES = 3;

/** "2h 15m", "45m", "3h" */
function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return [h ? `${h}h` : "", m || !h ? `${m}m` : ""].filter(Boolean).join(" ");
}

/** Minutes since midnight now. */
function nowMinutes(): number {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

/** Running now (overnight batches count after midnight too), and minutes until it ends. */
function running(batch: Batch, now: number): number | null {
	const start = toMinutes(batch.start_time);
	const end = toMinutes(batch.end_time);
	if (start < end) return now >= start && now < end ? end - now : null;
	if (now >= start) return end + DAY - now;
	if (now < end) return end - now;
	return null;
}

/** "6a", "12p", "10p" for the timeline's hour labels. */
function shortHour(minutes: number): string {
	const h = Math.floor((minutes % DAY) / 60);
	return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
}

type Span = { batch: Batch; start: number; end: number; lane: number };

/**
 * Lays the day's batches out on one time axis: overnight batches extend past 24:00, and batches
 * that overlap go on separate rows (greedy, earliest start first).
 */
function layoutDay(batches: Batch[]): { spans: Span[]; from: number; to: number; lanes: number } {
	const laneEnds: number[] = [];
	const spans = [...batches]
		.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
		.map((batch) => {
			const start = toMinutes(batch.start_time);
			let end = toMinutes(batch.end_time);
			if (end <= start) end += DAY;
			let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
			if (lane < 0) lane = Math.min(laneEnds.length, MAX_LANES - 1);
			laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, end);
			return { batch, start, end, lane };
		});
	// Whole hours either side, so the axis labels land on round times.
	const from = Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60;
	const to = Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60;
	return { spans, from, to, lanes: laneEnds.length };
}

type Props = {
	batches: Batch[];
	occupancy: DashboardData["batch_occupancy"];
	onPress: () => void;
};

/**
 * Home's "Today": the batch running now (time left, seats booked, check-ins so far), else the next
 * to start, else tomorrow's first; under it a timeline of every batch with a marker at the current
 * time. Updates twice a minute. Tap for attendance.
 */
export function LiveBatchCard({ batches, occupancy, onPress }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const [now, setNow] = useState(nowMinutes());

	useEffect(() => {
		const timer = setInterval(() => setNow(nowMinutes()), 30_000);
		return () => clearInterval(timer);
	}, []);

	const sorted = [...batches].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
	const current = sorted.map((b) => ({ batch: b, left: running(b, now) })).find((x) => x.left !== null) ?? null;
	const laterToday = sorted.find((b) => toMinutes(b.start_time) > now && b.id !== current?.batch.id) ?? null;
	const next = laterToday ?? sorted[0] ?? null;
	const nextIsTomorrow = !laterToday;
	const minutesToNext = next ? (nextIsTomorrow ? DAY - now + toMinutes(next.start_time) : toMinutes(next.start_time) - now) : 0;

	const mode: "live" | "next" | "done" = current ? "live" : laterToday ? "next" : "done";
	const focus = current?.batch ?? next;
	if (!focus) return null;
	const focusStats = occupancy.find((o) => o.id === focus.id);
	const checkedIn = focusStats?.checked_in_today ?? 0;

	const tint = mode === "live" ? theme.success : mode === "next" ? theme.accent : theme.mutedForeground;

	// After midnight, "now" sits past 24:00 on an axis that an overnight batch stretches that far.
	const day = layoutDay(sorted);
	const nowOnAxis = now < day.from && now + DAY <= day.to ? now + DAY : now;
	const span = Math.max(1, day.to - day.from);
	const position = (minutes: number) => `${((minutes - day.from) / span) * 100}%` as const;
	const showNow = nowOnAxis >= day.from && nowOnAxis <= day.to;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Open attendance"
			onPress={onPress}
			style={({ pressed }) => [styles.card, { borderColor: tint + "40" }, pressed && { opacity: 0.92 }]}>
			<LinearGradient pointerEvents="none" colors={[tint + "1F", theme.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

			<View style={styles.topRow}>
				<View style={[styles.statusPill, { backgroundColor: tint + "1F" }]}>
					{mode === "live" ? <PulsingDot color={theme.success} /> : <Ionicons name={mode === "next" ? "time-outline" : "moon-outline"} size={13} color={tint} />}
					<Text style={[styles.statusText, { color: tint }]}>{mode === "live" ? "LIVE NOW" : mode === "next" ? "NEXT UP" : "DONE FOR TODAY"}</Text>
				</View>
				<Text style={styles.timeLeft}>
					{mode === "live" && current ? `${formatDuration(current.left!)} left` : mode === "next" ? `in ${formatDuration(minutesToNext)}` : ""}
				</Text>
			</View>

			{mode === "done" ? (
				<>
					<Text style={styles.batchName}>All batches are over</Text>
					<Text style={styles.batchTime}>
						First tomorrow: {focus.name} at {formatTime(focus.start_time)}
					</Text>
				</>
			) : (
				<>
					<Text style={styles.batchName} numberOfLines={1}>
						{focus.name}
					</Text>
					<Text style={styles.batchTime}>{formatTimeRange(focus.start_time, focus.end_time)}</Text>
				</>
			)}

			{mode !== "done" && focusStats && (
				<View style={styles.statRow}>
					<View style={styles.stat}>
						<Text style={styles.statValue}>
							{focusStats.occupied}
							<Text style={styles.statTotal}>/{focusStats.total}</Text>
						</Text>
						<Text style={styles.statLabel}>seats booked</Text>
					</View>
					{mode === "live" && (
						<View style={styles.stat}>
							<Text style={styles.statValue}>
								{checkedIn}
								<Text style={styles.statTotal}>/{focusStats.occupied}</Text>
							</Text>
							<Text style={styles.statLabel}>checked in</Text>
							{/* How much of the booked batch has turned up. */}
							<View style={styles.meterTrack}>
								<View style={[styles.meterFill, { width: `${focusStats.occupied > 0 ? Math.min(100, (checkedIn / focusStats.occupied) * 100) : 0}%` }]} />
							</View>
						</View>
					)}
				</View>
			)}

			{/* The day at a glance: one bar per batch on a shared time axis, and a "now" line. */}
			{sorted.length > 1 && (
				<View style={styles.timeline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
					<View style={[styles.lanes, { height: day.lanes * LANE_HEIGHT + (day.lanes - 1) * LANE_GAP }]}>
						{day.spans.map((s) => {
							const isCurrent = current?.batch.id === s.batch.id;
							const isPast = !isCurrent && s.end <= nowOnAxis;
							return (
								<View
									key={s.batch.id}
									style={[
										styles.span,
										{
											left: position(s.start),
											width: `${((s.end - s.start) / span) * 100}%`,
											top: s.lane * (LANE_HEIGHT + LANE_GAP),
											backgroundColor: isCurrent ? theme.success : isPast ? theme.mutedForeground + "33" : theme.accent + "8C",
										},
									]}
								/>
							);
						})}
						{showNow && (
							<View style={[styles.nowLine, { left: position(nowOnAxis) }]}>
								<View style={styles.nowDot} />
							</View>
						)}
					</View>
					<View style={styles.axis}>
						<Text style={styles.axisLabel}>{shortHour(day.from)}</Text>
						<Text style={styles.axisLabel}>{shortHour(day.to)}</Text>
					</View>
				</View>
			)}

			<View style={styles.footer}>
				<Text style={styles.footerText} numberOfLines={1}>
					{mode === "live" && next ? (
						<>
							Next: <Text style={styles.footerStrong}>{next.name}</Text> at {formatTime(next.start_time)}
							{nextIsTomorrow ? " tomorrow" : ""}
						</>
					) : (
						"Mark attendance"
					)}
				</Text>
				<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
			</View>
		</Pressable>
	);
}

/** A soft "on air" pulse. */
function PulsingDot({ color }: { color: string }) {
	const pulse = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
				Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [pulse]);

	return (
		<View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
			<Animated.View
				style={{
					position: "absolute",
					width: 12,
					height: 12,
					borderRadius: 6,
					backgroundColor: color,
					opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
					transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }],
				}}
			/>
			<View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
		</View>
	);
}

const LANE_HEIGHT = 6;
const LANE_GAP = 3;

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		card: {
			borderRadius: RADIUS.lg,
			borderWidth: 1.5,
			padding: 16,
			overflow: "hidden",
			backgroundColor: theme.card,
		},
		topRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 10,
		},
		statusPill: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			paddingHorizontal: 8,
			paddingVertical: 4,
			borderRadius: 6,
		},
		statusText: {
			fontFamily: "sans-extrabold",
			fontSize: 11,
			letterSpacing: 0.8,
		},
		timeLeft: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.primary,
		},
		batchName: {
			fontFamily: "sans-extrabold",
			fontSize: 22,
			letterSpacing: -0.3,
			color: theme.primary,
		},
		batchTime: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		statRow: {
			flexDirection: "row",
			gap: 10,
			marginTop: 14,
		},
		stat: {
			flex: 1,
			backgroundColor: theme.card,
			borderRadius: RADIUS.sm,
			borderWidth: 1,
			borderColor: theme.border,
			paddingVertical: 10,
			paddingHorizontal: 12,
		},
		statValue: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
		},
		statTotal: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		statLabel: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		// Same-hue track under the fill, so the whole bar reads as one meter.
		meterTrack: {
			height: 4,
			borderRadius: 2,
			backgroundColor: theme.success + "26",
			marginTop: 8,
			overflow: "hidden",
		},
		meterFill: {
			height: "100%",
			borderRadius: 2,
			backgroundColor: theme.success,
		},
		timeline: {
			marginTop: 16,
		},
		lanes: {
			position: "relative",
		},
		span: {
			position: "absolute",
			height: LANE_HEIGHT,
			borderRadius: LANE_HEIGHT / 2,
		},
		// A thin vertical line through every row, with a dot on top, at the current time.
		nowLine: {
			position: "absolute",
			top: -5,
			bottom: -3,
			width: 2,
			marginLeft: -1,
			borderRadius: 1,
			backgroundColor: theme.primary,
			alignItems: "center",
		},
		nowDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
			marginTop: -3,
			backgroundColor: theme.primary,
			borderWidth: 1.5,
			borderColor: theme.card,
		},
		axis: {
			flexDirection: "row",
			justifyContent: "space-between",
			marginTop: 6,
		},
		axisLabel: {
			fontFamily: "sans-medium",
			fontSize: 10,
			color: theme.mutedForeground,
		},
		footer: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			marginTop: 14,
			paddingTop: 12,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		footerText: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		footerStrong: {
			fontFamily: "sans-bold",
			color: theme.primary,
		},
	});
