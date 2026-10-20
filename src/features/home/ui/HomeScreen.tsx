import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getBatchesApi } from "@/features/batches/logic/batches-api";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { StatTile } from "@/shared/ui/StatTile";

type MenuItem = {
	key: string;
	label: string;
	hint: string;
	icon: keyof typeof Ionicons.glyphMap;
	href: Href;
};

const MENU: MenuItem[] = [
	{ key: "admission", label: "Admission", hint: "Onboard new member", icon: "person-add-outline", href: "/admission" },
	{ key: "seats", label: "Seats", hint: "Availability by batch", icon: "grid-outline", href: "/seats" },
	{ key: "batches", label: "Batches", hint: "Daily time slots", icon: "layers-outline", href: "/batches" },
	{ key: "members", label: "Members", hint: "Students & subs", icon: "people-outline", href: "/members" },
	{ key: "payments", label: "Payments", hint: "Paid & due", icon: "wallet-outline", href: "/payments" },
	{ key: "renewals", label: "Renewals", hint: "Renewing soon", icon: "refresh-outline", href: "/renewals" },
	{ key: "attendance", label: "Attendance", hint: "Who attended", icon: "clipboard-outline", href: "/attendance" },
	{ key: "settings", label: "Settings", hint: "Library & reminders", icon: "settings-outline", href: "/settings" },
];

function formatRupee(amount: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function HomeScreen() {
	const router = useRouter();
	const { theme, isDark } = useTheme();

	const { data: dashboard, refetch: refetchDashboard } = useApiData(getDashboardApi, []);
	const { data: batches, refetch: refetchBatches } = useApiData(getBatchesApi, []);

	// Refresh whenever Home regains focus (e.g. coming back after adding a batch) - Expo Router
	// keeps this screen mounted in the stack, so the initial-mount fetch alone would go stale.
	useFocusEffect(
		useCallback(() => {
			void refetchDashboard();
			void refetchBatches();
		}, [refetchDashboard, refetchBatches])
	);

	// Only resolve once batches have actually loaded, to avoid flashing the banner before we know.
	const showBatchSetupBanner = batches !== null && batches.length === 0;

	const progressPercentage =
		dashboard && dashboard.expected_collection > 0 ? Math.min(100, Math.round((dashboard.monthly_collection / dashboard.expected_collection) * 100)) : 0;

	const styles = createStyles(theme);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<StatusBar style={isDark ? "light" : "dark"} />
			<View style={styles.headerWrapper}>
				<View style={styles.header}>
					<View style={styles.headerText}>
						<Text style={styles.headerTitle}>{dashboard?.library_name || "My Library"}</Text>
						<Text style={styles.headerSubtitle}>{dashboard?.owner_name || ""}</Text>
					</View>
					<Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.push("/settings")}>
						<Ionicons name="menu" size={24} color={theme.primary} />
					</Pressable>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				{dashboard && (
					<View style={styles.statsRow}>
						<StatTile label="Seats Filled" value={`${dashboard.occupied_seats}/${dashboard.total_seats}`} icon="grid-outline" />
						<StatTile label="Members" value={String(dashboard.total_members)} icon="people-outline" />
						<StatTile
							label="Occupancy"
							value={dashboard.total_seats > 0 ? `${Math.round((dashboard.occupied_seats / dashboard.total_seats) * 100)}%` : "—"}
							icon="pie-chart-outline"
							accentColor={theme.accent}
						/>
					</View>
				)}

				{showBatchSetupBanner ? (
					<View style={styles.alertCard} accessibilityRole="alert">
						<View style={styles.alertTitleRow}>
							<View style={styles.alertIconWrap}>
								<Ionicons name="calendar-outline" size={20} color={theme.primary} />
							</View>
							<Text style={styles.alertTitle}>Set up your batches first</Text>
						</View>
						<Text style={styles.alertCopy}>Add the time slots you run each day — morning, afternoon, evening. Then you can assign seats and track who paid.</Text>
						<Pressable accessibilityRole="button" style={styles.alertCta} onPress={() => router.push("/batches")}>
							<Text style={styles.alertCtaText}>Add batches</Text>
							<Ionicons name="arrow-forward" size={16} color={theme.background} />
						</Pressable>
					</View>
				) : null}

				{dashboard && (
					<Pressable style={styles.duesCard} onPress={() => router.push("/renewals")}>
						<View style={styles.duesHeaderRow}>
							<Text style={styles.duesTitle}>Dues & Renewals</Text>
							{dashboard.critical_dues_count > 0 && (
								<View style={styles.duesCriticalBadge}>
									<Text style={styles.duesCriticalBadgeText}>{dashboard.critical_dues_count} critical</Text>
								</View>
							)}
						</View>

						{dashboard.due_members_count > 0 ? (
							<>
								<Text style={styles.duesBigNumber}>
									{dashboard.due_members_count} <Text style={styles.duesBigNumberSuffix}>member{dashboard.due_members_count === 1 ? "" : "s"} due</Text>
								</Text>
								<View style={styles.duesBreakdownRow}>
									<View style={styles.duesBreakdownItem}>
										<Text style={styles.duesBreakdownValue}>{dashboard.overdue_summary.two_months_plus}</Text>
										<Text style={styles.duesBreakdownLabel}>2+ months</Text>
									</View>
									<View style={styles.duesBreakdownItem}>
										<Text style={styles.duesBreakdownValue}>{dashboard.overdue_summary.one_month}</Text>
										<Text style={styles.duesBreakdownLabel}>1 month</Text>
									</View>
									<View style={styles.duesBreakdownItem}>
										<Text style={styles.duesBreakdownValue}>{dashboard.overdue_summary.due_this_week}</Text>
										<Text style={styles.duesBreakdownLabel}>Due this week</Text>
									</View>
								</View>
							</>
						) : (
							<Text style={styles.duesAllCaughtUp}>All caught up - no dues pending.</Text>
						)}

						{(dashboard.upcoming_renewals > 0 || dashboard.this_month_dues_count > 0) && (
							<Text style={styles.duesFooterText}>
								{dashboard.this_month_dues_count > 0 ? `${dashboard.this_month_dues_count} due this month` : ""}
								{dashboard.this_month_dues_count > 0 && dashboard.upcoming_renewals > 0 ? " · " : ""}
								{dashboard.upcoming_renewals > 0 ? `${dashboard.upcoming_renewals} renewing soon` : ""}
							</Text>
						)}
					</Pressable>
				)}

				<Pressable style={styles.summaryCard} onPress={() => router.push("/payments")}>
					<Text style={styles.summaryLabel}>This month (collections)</Text>
					<Text style={styles.summaryValue}>{dashboard ? formatRupee(dashboard.monthly_collection) : "—"}</Text>

					{dashboard && (
						<>
							<View style={styles.progressContainer}>
								<View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
							</View>
							<View style={styles.summarySecondaryRow}>
								<View>
									<Text style={styles.summarySecondaryLabel}>PENDING</Text>
									<Text style={styles.summarySecondaryValue}>{formatRupee(dashboard.pending_collection)}</Text>
								</View>
								<View style={styles.summarySecondaryRight}>
									<Text style={styles.summarySecondaryLabel}>TODAY</Text>
									<Text style={styles.summarySecondaryValue}>{formatRupee(dashboard.today_collection)}</Text>
								</View>
							</View>
						</>
					)}

					{showBatchSetupBanner && <Text style={styles.summaryHint}>Set up batches to start tracking seat sales and renewals.</Text>}
				</Pressable>

				{dashboard && (
					<>
						<Text style={styles.sectionTitle}>Recent Payments</Text>
						<View style={styles.recentCard}>
							{dashboard.recent_payments.length > 0 ? (
								dashboard.recent_payments.map((payment, index) => (
									<View key={`${payment.name}-${index}`} style={[styles.recentRow, index !== dashboard.recent_payments.length - 1 && styles.recentRowBorder]}>
										<View style={styles.recentIconCircle}>
											<Ionicons name="checkmark-circle" size={18} color={theme.success} />
										</View>
										<View style={styles.recentInfo}>
											<Text style={styles.recentName}>{payment.name}</Text>
											<Text style={styles.recentMeta}>
												{payment.seat ? `Seat ${payment.seat} · ` : ""}
												{payment.time_ago}
											</Text>
										</View>
										<Text style={styles.recentAmount}>{formatRupee(payment.amount)}</Text>
									</View>
								))
							) : (
								<Text style={styles.recentEmptyText}>No payments yet.</Text>
							)}
						</View>
					</>
				)}

				<Text style={styles.sectionTitle}>Menu</Text>
				<View style={styles.menuGrid}>
					{MENU.map((item) => (
						<Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} style={({ pressed }) => [styles.menuCell, pressed && styles.menuCellPressed]} onPress={() => router.push(item.href)}>
							<View style={styles.menuIconCircle}>
								<Ionicons name={item.icon} size={24} color={theme.accent} />
							</View>
							<Text style={styles.menuLabel}>{item.label}</Text>
							<Text style={styles.menuHint}>{item.hint}</Text>
						</Pressable>
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		safe: {
			flex: 1,
			backgroundColor: theme.background,
		},
		scroll: {
			paddingHorizontal: 20,
			paddingTop: 24,
			paddingBottom: 40,
		},
		headerWrapper: {
			backgroundColor: theme.background,
			paddingTop: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.border,
			zIndex: 10,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 20,
			paddingBottom: 16,
		},
		headerText: {
			flex: 1,
			paddingRight: 16,
		},
		headerTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 22,
			color: theme.primary,
			marginBottom: 2,
		},
		headerSubtitle: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.mutedForeground,
		},
		headerActionCircle: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
		},
		summaryCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			padding: 20,
			marginBottom: 32,
			borderWidth: 1,
			borderColor: theme.border,
		},
		summaryLabel: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			letterSpacing: 0.5,
		},
		summaryValue: {
			fontFamily: "sans-extrabold",
			fontSize: 34,
			color: theme.accent,
			marginTop: 8,
			letterSpacing: -1,
		},
		summaryHint: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 12,
			lineHeight: 18,
		},
		progressContainer: {
			height: 6,
			backgroundColor: theme.muted,
			borderRadius: 3,
			overflow: "hidden",
			marginTop: 16,
		},
		progressBar: {
			height: "100%",
			backgroundColor: theme.accent,
			borderRadius: 3,
		},
		summarySecondaryRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			marginTop: 16,
		},
		summarySecondaryRight: {
			alignItems: "flex-end",
		},
		summarySecondaryLabel: {
			fontFamily: "sans-bold",
			fontSize: 11,
			color: theme.mutedForeground,
			letterSpacing: 0.5,
			marginBottom: 2,
		},
		summarySecondaryValue: {
			fontFamily: "sans-extrabold",
			fontSize: 16,
			color: theme.primary,
		},
		statsRow: {
			flexDirection: "row",
			gap: 10,
			marginBottom: 24,
		},
		alertCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 18,
			marginBottom: 32,
		},
		alertTitleRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			marginBottom: 12,
		},
		alertIconWrap: {
			width: 44,
			height: 44,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
		},
		alertTitle: {
			fontFamily: "sans-bold",
			flex: 1,
			fontSize: 15,
			color: theme.primary,
		},
		alertCopy: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			lineHeight: 18,
			marginBottom: 14,
		},
		alertCta: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			backgroundColor: theme.primary,
			paddingVertical: 12,
			paddingHorizontal: 16,
			borderRadius: RADIUS.sm,
			alignSelf: "flex-start",
		},
		alertCtaText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.background,
		},
		duesCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 18,
			marginBottom: 32,
		},
		duesHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 12,
		},
		duesTitle: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
		},
		duesCriticalBadge: {
			backgroundColor: theme.destructive + "15",
			paddingHorizontal: 10,
			paddingVertical: 4,
			borderRadius: RADIUS.sm,
		},
		duesCriticalBadgeText: {
			fontFamily: "sans-bold",
			fontSize: 11,
			color: theme.destructive,
			textTransform: "uppercase",
		},
		duesBigNumber: {
			fontFamily: "sans-extrabold",
			fontSize: 24,
			color: theme.primary,
			marginBottom: 14,
		},
		duesBigNumberSuffix: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.mutedForeground,
		},
		duesAllCaughtUp: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.mutedForeground,
		},
		duesBreakdownRow: {
			flexDirection: "row",
			justifyContent: "space-between",
		},
		duesBreakdownItem: {
			alignItems: "flex-start",
		},
		duesBreakdownValue: {
			fontFamily: "sans-extrabold",
			fontSize: 17,
			color: theme.primary,
			marginBottom: 2,
		},
		duesBreakdownLabel: {
			fontFamily: "sans-medium",
			fontSize: 11,
			color: theme.mutedForeground,
		},
		duesFooterText: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 14,
		},
		recentCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			overflow: "hidden",
			marginBottom: 32,
			borderWidth: 1,
			borderColor: theme.border,
		},
		recentRow: {
			flexDirection: "row",
			alignItems: "center",
			padding: 16,
		},
		recentRowBorder: {
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.border,
		},
		recentIconCircle: {
			width: 36,
			height: 36,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.success + "15",
			alignItems: "center",
			justifyContent: "center",
			marginRight: 12,
		},
		recentInfo: {
			flex: 1,
		},
		recentName: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		recentMeta: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		recentAmount: {
			fontFamily: "sans-extrabold",
			fontSize: 14,
			color: theme.success,
		},
		recentEmptyText: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			padding: 18,
		},
		sectionTitle: {
			fontFamily: "sans-bold",
			fontSize: 14,
			letterSpacing: 1.2,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			marginBottom: 16,
		},
		menuGrid: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "space-between",
			gap: 14,
		},
		menuCell: {
			width: "47%",
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 16,
		},
		menuCellPressed: {
			opacity: 0.8,
			transform: [{ scale: 0.98 }],
		},
		menuIconCircle: {
			width: 44,
			height: 44,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 10,
		},
		menuLabel: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
			marginBottom: 4,
		},
		menuHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			lineHeight: 16,
		},
	});
