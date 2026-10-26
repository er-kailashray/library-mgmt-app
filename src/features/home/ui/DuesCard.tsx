import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { formatLateness } from "@/features/home/logic/home-format";
import { DashboardData } from "@/features/home/types/home.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { Text } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";

/** Most-overdue members named on Home; everyone else is one tap away. */
const MAX_DUES_ON_HOME = 3;

/** Lateness at which a row's "N days late" turns red. */
const LATE_DAYS = 15;

/**
 * "Needs attention": the total owed and by how many, the longest-overdue few by name, and how many
 * renew this week. When nobody owes anything it says so in one calm line.
 */
export function DuesCard({ dashboard }: { dashboard: DashboardData }) {
	const router = useRouter();
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const owing = dashboard.due_members_count > 0;
	const top = dashboard.top_dues.slice(0, MAX_DUES_ON_HOME);

	return (
		<View style={styles.card}>
			<Pressable
				accessibilityRole="button"
				style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
				onPress={() => router.push({ pathname: "/payments", params: { tab: "due" } })}>
				<View style={[styles.summaryIcon, { backgroundColor: (owing ? theme.destructive : theme.success) + "1A" }]}>
					<Ionicons name={owing ? "alert-circle" : "checkmark-circle"} size={22} color={owing ? theme.destructive : theme.success} />
				</View>
				<View style={styles.summaryText}>
					{owing ? (
						<>
							<Text style={styles.summaryValue}>{formatRupee(dashboard.due_total)} due</Text>
							<Text style={styles.summaryMeta}>
								from {dashboard.due_members_count} member{dashboard.due_members_count === 1 ? "" : "s"}
								{dashboard.this_month_dues_count > 0 ? ` · ${dashboard.this_month_dues_count} new this month` : ""}
							</Text>
						</>
					) : (
						<>
							<Text style={styles.summaryValue}>All paid up</Text>
							<Text style={styles.summaryMeta}>Nobody owes anything right now</Text>
						</>
					)}
				</View>
				<Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
			</Pressable>

			{top.map((due) => (
				<Pressable
					key={due.member_id}
					accessibilityRole="button"
					accessibilityLabel={`${due.name}, ${formatRupee(due.amount)}, ${formatLateness(due.days_overdue)}`}
					style={({ pressed }) => [styles.row, pressed && styles.pressed]}
					onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(due.member_id) } })}>
					<MemberAvatar id={due.member_id} name={due.name} size={36} />
					<View style={styles.rowText}>
						<Text style={styles.rowName} numberOfLines={1}>
							{due.name}
						</Text>
						<Text style={[styles.rowMeta, due.days_overdue >= LATE_DAYS && { color: theme.destructive }]}>{formatLateness(due.days_overdue)}</Text>
					</View>
					<Text style={styles.rowAmount}>{formatRupee(due.amount)}</Text>
				</Pressable>
			))}

			{dashboard.upcoming_renewals > 0 && (
				<Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push("/renewals")}>
					<View style={styles.renewIcon}>
						<Ionicons name="refresh" size={17} color={theme.accent} />
					</View>
					<Text style={styles.renewText}>
						<Text style={styles.rowName}>{dashboard.upcoming_renewals}</Text> renewing this week
					</Text>
					<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
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
			overflow: "hidden",
		},
		summary: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			padding: 14,
		},
		summaryIcon: {
			width: 42,
			height: 42,
			borderRadius: RADIUS.md,
			alignItems: "center",
			justifyContent: "center",
		},
		summaryText: {
			flex: 1,
		},
		summaryValue: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			letterSpacing: -0.2,
			color: theme.primary,
		},
		summaryMeta: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: 11,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		rowText: {
			flex: 1,
		},
		rowName: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		rowMeta: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		rowAmount: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		renewIcon: {
			width: 36,
			height: 36,
			borderRadius: 18,
			backgroundColor: theme.accent + "14",
			alignItems: "center",
			justifyContent: "center",
		},
		renewText: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		pressed: {
			backgroundColor: theme.muted,
		},
	});
