import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { formatTime, toMinutes } from "@/features/batches/logic/batch-time";
import { Batch } from "@/features/batches/types/batches.types";
import { DashboardData } from "@/features/home/types/home.types";
import { RADIUS } from "@/shared/constants/layout";
import { useTheme } from "@/shared/providers/ThemeProvider";

const DAY = 24 * 60;

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

type Props = {
	batches: Batch[];
	occupancy: DashboardData["batch_occupancy"];
	onPress: () => void;
};

/**
 * Home's live view of the day: the batch running now (with time left, seats booked and today's
 * check-ins), else the next batch to start, else tomorrow's first. Updates every minute.
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

	const stats = (batch: Batch) => occupancy.find((o) => o.id === batch.id);
	const mode: "live" | "next" | "done" = current ? "live" : laterToday ? "next" : "done";
	const focus = current?.batch ?? next;
	if (!focus) return null;
	const focusStats = stats(focus);

	const tint = mode === "live" ? theme.success : mode === "next" ? theme.accent : theme.mutedForeground;

	return (
		<Pressable accessibilityRole="button" accessibilityLabel="Open attendance" onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: tint + "40" }, pressed && { opacity: 0.9 }]}>
			<LinearGradient pointerEvents="none" colors={[tint + "1F", theme.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

			<View style={styles.topRow}>
				<View style={styles.statusRow}>
					{mode === "live" ? <PulsingDot color={theme.success} /> : <Ionicons name={mode === "next" ? "time-outline" : "moon-outline"} size={14} color={tint} />}
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
					<Text style={styles.batchTime}>
						{formatTime(focus.start_time)} – {formatTime(focus.end_time)}
					</Text>
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
							<Text style={[styles.statValue, { color: theme.success }]}>{focusStats.checked_in_today ?? 0}</Text>
							<Text style={styles.statLabel}>checked in</Text>
						</View>
					)}
				</View>
			)}

			{mode === "live" && next && (
				<View style={styles.footer}>
					<Text style={styles.footerText} numberOfLines={1}>
						Next: <Text style={styles.footerStrong}>{next.name}</Text> at {formatTime(next.start_time)}
						{nextIsTomorrow ? " tomorrow" : ` · in ${formatDuration(minutesToNext)}`}
					</Text>
					<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
				</View>
			)}
			{mode !== "live" && (
				<View style={styles.footer}>
					<Text style={styles.footerText}>Open attendance</Text>
					<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
				</View>
			)}
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
		<View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
			<Animated.View
				style={{
					position: "absolute",
					width: 14,
					height: 14,
					borderRadius: 7,
					backgroundColor: color,
					opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
					transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }],
				}}
			/>
			<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
		</View>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		card: {
			borderRadius: RADIUS.md,
			borderWidth: 1.5,
			padding: 16,
			marginBottom: 20,
			overflow: "hidden",
			backgroundColor: theme.card,
		},
		topRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 8,
		},
		statusRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		statusText: {
			fontFamily: "sans-extrabold",
			fontSize: 11,
			letterSpacing: 1,
		},
		timeLeft: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.primary,
		},
		batchName: {
			fontFamily: "sans-extrabold",
			fontSize: 22,
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
