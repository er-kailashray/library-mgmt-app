import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { DashboardData } from "@/features/home/types/home.types";
import { describePaymentPeriod, formatPaymentWhen, PAYMENT_STATUS_LOOK } from "@/features/payments/logic/payment-display";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { Text } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";

/** Latest payments listed on Home; the full list is one tap away. */
const MAX_RECENT_PAYMENTS_ON_HOME = 4;

/** The last few payments: who, when and how, the days covered, and the amount. */
export function RecentPaymentsCard({ payments }: { payments: DashboardData["recent_payments"] }) {
	const router = useRouter();
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const recent = payments.slice(0, MAX_RECENT_PAYMENTS_ON_HOME);

	if (recent.length === 0) {
		return (
			<View style={[styles.card, styles.empty]}>
				<Ionicons name="receipt-outline" size={22} color={theme.mutedForeground} />
				<Text style={styles.emptyText}>No payments yet. They'll show up here as you record them.</Text>
			</View>
		);
	}

	return (
		<View style={styles.card}>
			{recent.map((payment, index) => {
				// Same as the Payments list: when and how, then the days it covers.
				const look = PAYMENT_STATUS_LOOK[payment.status ?? "PAID"] ?? PAYMENT_STATUS_LOOK.PAID;
				const color = look.color(theme);
				const period = payment.status ? describePaymentPeriod({ status: payment.status, period_start: payment.period_start, period_end: payment.period_end }) : "";
				return (
					<Pressable
						key={`${payment.name}-${index}`}
						accessibilityRole="button"
						disabled={!payment.member_id}
						style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && styles.pressed]}
						onPress={() => payment.member_id && router.push({ pathname: "/members/[id]", params: { id: String(payment.member_id) } })}>
						<View>
							<MemberAvatar id={payment.member_id} name={payment.name} size={40} />
							{/* The payment's kind (paid / partial / refund) as a small badge on the avatar. */}
							<View style={[styles.badge, { backgroundColor: color }]}>
								<Ionicons name={look.icon} size={10} color="#fff" />
							</View>
						</View>
						<View style={styles.info}>
							<Text style={styles.name} numberOfLines={1}>
								{payment.name}
							</Text>
							<Text style={styles.meta} numberOfLines={1}>
								{payment.date ? formatPaymentWhen({ date: payment.date, recorded_at: payment.recorded_at }) : payment.time_ago}
								{payment.method ? ` · ${payment.method}` : ""}
							</Text>
							{!!period && (
								<Text style={styles.meta} numberOfLines={1}>
									{period}
								</Text>
							)}
						</View>
						<Text style={[styles.amount, { color: payment.status === "REFUNDED" ? theme.destructive : theme.primary }]}>
							{look.sign}
							{formatRupee(Math.abs(payment.amount))}
						</Text>
					</Pressable>
				);
			})}
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
		empty: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			padding: 16,
		},
		emptyText: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: 12,
		},
		rowBorder: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		pressed: {
			backgroundColor: theme.muted,
		},
		badge: {
			position: "absolute",
			right: -2,
			bottom: -2,
			width: 17,
			height: 17,
			borderRadius: 8.5,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 2,
			borderColor: theme.card,
		},
		info: {
			flex: 1,
		},
		name: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		meta: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		amount: {
			fontFamily: "sans-bold",
			fontSize: 14,
		},
	});
