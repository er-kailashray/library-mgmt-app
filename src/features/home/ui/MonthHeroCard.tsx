import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { getMonthlyCollectionApi } from "@/features/home/logic/home-api";
import { formatMonth, formatMonthName, percentChange, shiftMonth } from "@/features/home/logic/home-format";
import { DashboardData, MonthlyCollection } from "@/features/home/types/home.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";

/** How far back the month arrows go. */
const MAX_MONTHS_BACK = 12;

// The card is always dark (in both themes), so its ink is fixed rather than themed.
const INK = "#FFFFFF";
const INK_MUTED = "rgba(255,255,255,0.62)";
const INK_FAINT = "rgba(255,255,255,0.14)";

type Props = {
	dashboard: DashboardData;
	/** Changes on pull to refresh, so a past month being viewed reloads too. */
	refreshSignal: number;
	onOpenPayments: () => void;
};

/**
 * Home's lead: cash received this month as one big number, its pace against the same point last
 * month, and how this month's fees stand (received / due now / due later). The arrows step back
 * through earlier months, which show just their total.
 */
export function MonthHeroCard({ dashboard, refreshSignal, onOpenPayments }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	// 0 = this month; negative = browsing earlier months.
	const [monthOffset, setMonthOffset] = useState(0);
	const [pastMonth, setPastMonth] = useState<MonthlyCollection | null>(null);
	const [isLoadingPastMonth, setIsLoadingPastMonth] = useState(false);
	const viewedMonth = shiftMonth(dashboard.collection_month, monthOffset);
	const isThisMonth = monthOffset === 0;

	useEffect(() => {
		if (monthOffset === 0) return;
		let cancelled = false;
		setIsLoadingPastMonth(true);
		getMonthlyCollectionApi(viewedMonth)
			.then((response) => !cancelled && setPastMonth(response.data))
			.catch(() => !cancelled && setPastMonth(null))
			.finally(() => !cancelled && setIsLoadingPastMonth(false));
		return () => {
			cancelled = true;
		};
	}, [monthOffset, viewedMonth, refreshSignal]);

	const { month_cash: cash, month_fees: fees } = dashboard;
	const change = percentChange(cash.received, dashboard.last_month_same_period);
	const feeSegments = [
		{ key: "paid", label: "Received", amount: fees.collected, color: theme.success },
		{ key: "due", label: "Due now", amount: fees.due, color: theme.destructive },
		{ key: "later", label: "Due later", amount: fees.upcoming, color: "rgba(255,255,255,0.32)" },
	];
	const extras = [
		cash.for_earlier_months > 0 && `${formatRupee(cash.for_earlier_months)} old dues`,
		cash.in_advance > 0 && `${formatRupee(cash.in_advance)} advance`,
	].filter(Boolean);

	return (
		<View style={styles.card}>
			{/* A coral glow from the top-right corner. */}
			<LinearGradient
				pointerEvents="none"
				colors={[theme.accent + "70", theme.accent + "00"]}
				start={{ x: 1, y: 0 }}
				end={{ x: 0.3, y: 0.7 }}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.topRow}>
				<Text style={styles.label}>{isThisMonth ? "Collected this month" : "Collected in"}</Text>
				<View style={styles.monthSwitcher}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Previous month"
						style={styles.monthArrow}
						onPress={() => setMonthOffset((o) => o - 1)}
						disabled={monthOffset <= -MAX_MONTHS_BACK}
						hitSlop={8}>
						<Ionicons name="chevron-back" size={15} color={monthOffset <= -MAX_MONTHS_BACK ? INK_FAINT : INK} />
					</Pressable>
					<Text style={styles.monthLabel}>{formatMonth(viewedMonth)}</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Next month"
						style={styles.monthArrow}
						onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
						disabled={isThisMonth}
						hitSlop={8}>
						<Ionicons name="chevron-forward" size={15} color={isThisMonth ? INK_FAINT : INK} />
					</Pressable>
				</View>
			</View>

			{isThisMonth ? (
				<>
					<Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>
						{formatRupee(cash.received)}
					</Text>
					<View style={styles.metaRow}>
						{change !== null && (
							<View style={[styles.changeBadge, { backgroundColor: (change >= 0 ? theme.success : theme.destructive) + "2E" }]}>
								<Ionicons name={change >= 0 ? "trending-up" : "trending-down"} size={13} color={change >= 0 ? theme.success : theme.destructive} />
								<Text style={styles.changeText}>
									{change >= 0 ? "+" : "−"}
									{Math.abs(change)}%
								</Text>
							</View>
						)}
						<Text style={styles.meta} numberOfLines={1}>
							{change !== null ? "vs this time last month" : `Day ${dashboard.day_of_month} of ${dashboard.days_in_month}`}
						</Text>
					</View>
					{extras.length > 0 && <Text style={styles.extras}>Includes {extras.join(" · ")}</Text>}

					{fees.expected > 0 && (
						<View style={styles.fees}>
							<View style={styles.feesHeader}>
								<Text style={styles.feesTitle}>{formatMonthName(dashboard.collection_month)} fees</Text>
								<Text style={styles.feesTotal}>{formatRupee(fees.expected)}</Text>
							</View>
							{/* One stacked bar: received | due now | due later, 2px gaps between segments. */}
							<View
								style={styles.stackBar}
								accessibilityRole="progressbar"
								accessibilityLabel={`${formatRupee(fees.collected)} received, ${formatRupee(fees.due)} due now, ${formatRupee(fees.upcoming)} due later`}>
								{feeSegments.map((segment) =>
									segment.amount > 0 ? <View key={segment.key} style={[styles.stackSegment, { flex: segment.amount, backgroundColor: segment.color }]} /> : null
								)}
							</View>
							<View style={styles.legend}>
								{feeSegments.map((segment) => (
									<View key={segment.key} style={styles.legendItem}>
										<View style={styles.legendLabelRow}>
											<View style={[styles.legendDot, { backgroundColor: segment.color }]} />
											<Text style={styles.legendLabel}>{segment.label}</Text>
										</View>
										<Text style={styles.legendAmount} numberOfLines={1} adjustsFontSizeToFit>
											{formatRupee(segment.amount)}
										</Text>
									</View>
								))}
							</View>
							{fees.arrears > 0 && (
								<Text style={styles.arrears}>
									+ <Text style={styles.arrearsAmount}>{formatRupee(fees.arrears)}</Text> still owed from earlier months
								</Text>
							)}
						</View>
					)}
				</>
			) : isLoadingPastMonth ? (
				<ActivityIndicator style={styles.loader} color={INK} />
			) : (
				<>
					<Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>
						{pastMonth ? formatRupee(pastMonth.collected) : "—"}
					</Text>
					<Text style={styles.meta}>
						{pastMonth ? `from ${pastMonth.payments_count} payment${pastMonth.payments_count === 1 ? "" : "s"}` : "Couldn't load this month"}
					</Text>
				</>
			)}

			<Pressable accessibilityRole="button" onPress={onOpenPayments} style={({ pressed }) => [styles.footer, pressed && { opacity: 0.7 }]}>
				<Text style={styles.footerText}>View payments</Text>
				<Ionicons name="arrow-forward" size={14} color={INK} />
			</Pressable>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		card: {
			backgroundColor: theme.primarySurface,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 18,
			overflow: "hidden",
		},
		topRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		label: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: INK_MUTED,
		},
		monthSwitcher: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: "rgba(255,255,255,0.08)",
			borderRadius: RADIUS.sm,
			paddingHorizontal: 2,
		},
		monthArrow: {
			width: 26,
			height: 28,
			alignItems: "center",
			justifyContent: "center",
		},
		monthLabel: {
			fontFamily: "sans-semibold",
			fontSize: 12,
			color: INK,
			minWidth: 64,
			textAlign: "center",
		},
		hero: {
			fontFamily: "sans-bold",
			fontSize: 44,
			letterSpacing: -1.2,
			color: INK,
			marginTop: 10,
		},
		metaRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			marginTop: 4,
		},
		changeBadge: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			paddingHorizontal: 7,
			paddingVertical: 3,
			borderRadius: 6,
		},
		changeText: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: INK,
		},
		meta: {
			flexShrink: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: INK_MUTED,
		},
		extras: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: INK_MUTED,
			marginTop: 6,
		},
		fees: {
			marginTop: 18,
			paddingTop: 14,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: "rgba(255,255,255,0.16)",
			gap: 10,
		},
		feesHeader: {
			flexDirection: "row",
			alignItems: "baseline",
			justifyContent: "space-between",
		},
		feesTitle: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: INK_MUTED,
		},
		feesTotal: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: INK,
		},
		stackBar: {
			flexDirection: "row",
			height: 8,
			borderRadius: 4,
			overflow: "hidden",
			backgroundColor: "rgba(255,255,255,0.08)",
			gap: 2,
		},
		stackSegment: {
			height: "100%",
		},
		legend: {
			flexDirection: "row",
		},
		legendItem: {
			flex: 1,
		},
		legendLabelRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		legendDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
		},
		legendLabel: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: INK_MUTED,
		},
		legendAmount: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: INK,
			marginTop: 2,
			marginLeft: 14,
		},
		arrears: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: INK_MUTED,
		},
		arrearsAmount: {
			fontFamily: "sans-bold",
			color: "#FCA5A5",
		},
		loader: {
			marginVertical: 26,
		},
		footer: {
			flexDirection: "row",
			alignItems: "center",
			alignSelf: "flex-start",
			gap: 6,
			marginTop: 16,
			paddingVertical: 8,
			paddingHorizontal: 12,
			borderRadius: RADIUS.sm,
			backgroundColor: "rgba(255,255,255,0.1)",
		},
		footerText: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: INK,
		},
	});
