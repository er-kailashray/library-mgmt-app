import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { formatTime } from "@/features/batches/logic/batch-time";
import { DashboardData } from "@/features/home/types/home.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { scale, ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

/** Column chart: plot height and the band above it for the picked column's value. */
const CHART_HEIGHT = scale(96);
const CHART_VALUE_SPACE = 18;

type BatchOccupancy = DashboardData["batch_occupancy"][number];

type Props = {
	occupancy: BatchOccupancy[];
	/** The batch on right now, picked by default and marked with a dot. */
	currentBatchId?: number | null;
	onOpenSeats: () => void;
};

/**
 * Seats filled per batch: an average headline, then one column per batch in a single hue, the pale
 * track being the batch's capacity. Tap a column to read its numbers below.
 */
export function OccupancyCard({ occupancy, currentBatchId, onOpenSeats }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const [pickedId, setPickedId] = useState<number | null>(null);

	// Average across batches: all bookings / (seats x batches). A library full in the morning and
	// empty in the evening is 50% used, not 100%.
	const slots = occupancy.reduce((sum, b) => sum + b.total, 0);
	const bookings = occupancy.reduce((sum, b) => sum + b.occupied, 0);
	const percent = slots > 0 ? Math.min(100, Math.round((bookings / slots) * 100)) : 0;
	const freeSlots = Math.max(0, slots - bookings);

	const busiest = occupancy.reduce<BatchOccupancy | null>(
		(best, b) => (!best || b.occupied / Math.max(1, b.total) > best.occupied / Math.max(1, best.total) ? b : best),
		null
	);
	const picked = occupancy.find((b) => b.id === pickedId) ?? occupancy.find((b) => b.id === currentBatchId) ?? busiest;

	return (
		<View style={styles.card}>
			<View style={styles.headline}>
				<Text style={styles.percent}>
					{percent}
					<Text style={styles.percentSign}>%</Text>
				</Text>
				<View style={styles.headlineText}>
					<Text style={styles.headlineLabel}>seats used on average</Text>
					<Text style={styles.headlineMeta}>
						{freeSlots} free seat{freeSlots === 1 ? "" : "s"} across {occupancy.length} batch{occupancy.length === 1 ? "" : "es"}
					</Text>
				</View>
			</View>

			<View style={styles.chart} accessibilityRole="summary" accessibilityLabel="Seats filled in each batch">
				<View style={styles.chartFullLine} pointerEvents="none">
					<Text style={styles.chartFullLabel}>Full</Text>
				</View>
				<View style={styles.chartBaseline} pointerEvents="none" />
				<View style={styles.chartColumns}>
					{occupancy.map((batch) => {
						const fill = batch.total > 0 ? Math.min(100, (batch.occupied / batch.total) * 100) : 0;
						const isPicked = picked?.id === batch.id;
						return (
							<Pressable
								key={batch.id}
								accessibilityRole="button"
								accessibilityLabel={`${batch.name}, ${batch.occupied} of ${batch.total} seats filled`}
								accessibilityState={{ selected: isPicked }}
								style={styles.chartSlot}
								hitSlop={4}
								onPress={() => setPickedId(batch.id)}>
								<View style={styles.chartPlot}>
									<Text style={[styles.chartValue, !isPicked && styles.hidden]}>{batch.occupied}</Text>
									<View style={styles.chartTrack}>
										<View style={[styles.chartBar, { height: `${fill}%` }, !isPicked && styles.chartBarDim]} />
									</View>
								</View>
								<Text style={[styles.chartName, isPicked && styles.chartNamePicked]} numberOfLines={1}>
									{batch.name}
								</Text>
								<View style={styles.chartTimeRow}>
									{currentBatchId === batch.id && <View style={styles.liveDot} />}
									<Text style={styles.chartTime} numberOfLines={1}>
										{formatTime(batch.start_time).replace(":00", "")}
									</Text>
								</View>
							</Pressable>
						);
					})}
				</View>
			</View>

			{picked && (
				<Pressable accessibilityRole="button" onPress={onOpenSeats} style={({ pressed }) => [styles.footer, pressed && { opacity: 0.7 }]}>
					<Text style={styles.footerText} numberOfLines={1}>
						<Text style={styles.footerStrong}>{picked.name}</Text>
						{currentBatchId === picked.id ? " (now)" : ""} · {picked.occupied} of {picked.total} seats
						{picked.occupied === 0 ? " · empty" : picked.occupied >= picked.total ? " · full" : ""}
					</Text>
					<Text style={styles.footerLink}>Open seats</Text>
					<Ionicons name="arrow-forward" size={14} color={theme.accent} />
				</Pressable>
			)}
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		card: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 16,
			gap: 14,
		},
		headline: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		percent: {
			fontFamily: "sans-extrabold",
			fontSize: 34,
			letterSpacing: -1,
			color: theme.primary,
		},
		percentSign: {
			fontFamily: "sans-bold",
			fontSize: 18,
			color: theme.mutedForeground,
		},
		headlineText: {
			flex: 1,
		},
		headlineLabel: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		headlineMeta: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		chart: {
			paddingTop: 4,
		},
		// Recessive hairline marking 100% (top of the plot area).
		chartFullLine: {
			position: "absolute",
			top: CHART_VALUE_SPACE + 4,
			left: 0,
			right: 0,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		chartFullLabel: {
			position: "absolute",
			top: -14,
			left: 0,
			fontFamily: "sans-medium",
			fontSize: 10,
			color: theme.mutedForeground,
		},
		// Shared baseline the columns grow from.
		chartBaseline: {
			position: "absolute",
			top: CHART_VALUE_SPACE + CHART_HEIGHT + 4,
			left: 0,
			right: 0,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		chartColumns: {
			flexDirection: "row",
			alignItems: "flex-start",
		},
		chartSlot: {
			flex: 1,
			alignItems: "center",
			paddingHorizontal: 2,
		},
		chartPlot: {
			height: CHART_VALUE_SPACE + CHART_HEIGHT,
			alignItems: "center",
			justifyContent: "flex-end",
		},
		chartValue: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: theme.primary,
			height: CHART_VALUE_SPACE,
		},
		hidden: {
			opacity: 0,
		},
		chartTrack: {
			width: 22,
			height: CHART_HEIGHT,
			justifyContent: "flex-end",
			backgroundColor: theme.accent + "1A",
			borderTopLeftRadius: 4,
			borderTopRightRadius: 4,
		},
		chartBar: {
			width: "100%",
			backgroundColor: theme.accent,
			borderTopLeftRadius: 4,
			borderTopRightRadius: 4,
		},
		// Unpicked columns step back so the picked one reads as selected.
		chartBarDim: {
			opacity: 0.5,
		},
		chartName: {
			fontFamily: "sans-semibold",
			fontSize: 11,
			color: theme.mutedForeground,
			marginTop: 6,
			maxWidth: "100%",
		},
		chartNamePicked: {
			fontFamily: "sans-bold",
			color: theme.primary,
		},
		chartTimeRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 3,
		},
		liveDot: {
			width: 5,
			height: 5,
			borderRadius: 2.5,
			backgroundColor: theme.success,
		},
		chartTime: {
			fontFamily: "sans-medium",
			fontSize: 10,
			color: theme.mutedForeground,
		},
		footer: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			paddingTop: 12,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		footerText: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginRight: 6,
		},
		footerStrong: {
			fontFamily: "sans-bold",
			color: theme.primary,
		},
		footerLink: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
		},
	});
