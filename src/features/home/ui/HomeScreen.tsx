import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MOCK_LIBRARY_NAME, MOCK_MONTH_EARNINGS_CENTS, MOCK_OWNER_HAS_BATCHES, MOCK_OWNER_NAME } from "@/features/home/logic/home-flags";
import { colors } from "@/shared/constants/theme";

type MenuItem = {
	key: string;
	label: string;
	hint: string;
	icon: keyof typeof Ionicons.glyphMap;
	href: Href;
};

const MENU: MenuItem[] = [
	{ key: "seats", label: "Seats", hint: "Availability by batch", icon: "grid-outline", href: "/seats" },
	{ key: "batches", label: "Batches", hint: "Daily time slots", icon: "layers-outline", href: "/batches" },
	{ key: "members", label: "Members", hint: "Students & subs", icon: "people-outline", href: "/members" },
	{ key: "payments", label: "Payments", hint: "Paid & due", icon: "wallet-outline", href: "/payments" },
	{ key: "attendance", label: "Attendance", hint: "Who attended", icon: "clipboard-outline", href: "/attendance" },
	{ key: "settings", label: "Settings", hint: "Library & reminders", icon: "settings-outline", href: "/settings" },
];

function formatRupeeFromCents(cents: number): string {
	const rupees = cents / 100;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(rupees);
}

export function HomeScreen() {
	const router = useRouter();
	const showBatchSetupBanner = !MOCK_OWNER_HAS_BATCHES;

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<StatusBar style="dark" />
			<View style={styles.headerWrapper}>
				<View style={styles.header}>
					<View style={styles.headerText}>
						<Text style={styles.headerTitle}>{MOCK_LIBRARY_NAME}</Text>
						<Text style={styles.headerSubtitle}>{MOCK_OWNER_NAME}</Text>
					</View>
					<Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.push("/settings")}>
						<Ionicons name="menu" size={24} color={colors.primary} />
					</Pressable>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				<View style={styles.summaryCard}>
					<Text style={styles.summaryLabel}>This month (collections)</Text>
					<Text style={styles.summaryValue}>{MOCK_MONTH_EARNINGS_CENTS != null ? formatRupeeFromCents(MOCK_MONTH_EARNINGS_CENTS) : "—"}</Text>
					<Text style={styles.summaryHint}>{MOCK_OWNER_HAS_BATCHES ? "Tap Payments for breakdown & dues." : "Set up batches to start tracking seat sales and renewals."}</Text>
				</View>

				{showBatchSetupBanner ? (
					<View style={styles.alertCard} accessibilityRole="alert">
						<View style={styles.alertTitleRow}>
							<View style={styles.alertIconWrap}>
								<Ionicons name="calendar-outline" size={22} color={colors.primary} />
							</View>
							<Text style={styles.alertTitle}>Set up your batches first</Text>
						</View>
						<Text style={styles.alertCopy}>Add the time slots you run each day (for example morning, afternoon, evening). Then you can assign seats, see who paid for which batch, and get clearer earnings visibility.</Text>
						<Pressable accessibilityRole="button" style={styles.alertCta} onPress={() => router.push("/batches")}>
							<Text style={styles.alertCtaText}>Add batches</Text>
							<Ionicons name="arrow-forward" size={18} color={colors.background} />
						</Pressable>
					</View>
				) : null}

				<Text style={styles.sectionTitle}>Menu</Text>
				<View style={styles.menuGrid}>
					{MENU.map((item) => (
						<Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} style={({ pressed }) => [styles.menuCell, pressed && styles.menuCellPressed]} onPress={() => router.push(item.href)}>
							<View style={styles.menuIconCircle}>
								<Ionicons name={item.icon} size={24} color={colors.accent} />
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

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 40,
	},
	headerWrapper: {
		backgroundColor: colors.background,
		paddingTop: 8,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
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
		color: colors.primary,
		marginBottom: 2,
	},
	headerSubtitle: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: colors.mutedForeground,
	},
	headerActionCircle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
	},
	summaryCard: {
		backgroundColor: colors.accent,
		borderRadius: 24,
		padding: 20,
		marginBottom: 32,
		shadowColor: colors.accent,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.25,
		shadowRadius: 16,
		elevation: 6,
	},
	summaryLabel: {
		fontFamily: "sans-semibold",
		fontSize: 13,
		color: "rgba(255,255,255,0.85)",
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	summaryValue: {
		fontFamily: "sans-extrabold",
		fontSize: 34,
		color: "#fff",
		marginTop: 8,
		letterSpacing: -1,
	},
	summaryHint: {
		fontFamily: "sans-medium",
		fontSize: 13,
		color: "rgba(255,255,255,0.9)",
		marginTop: 12,
		lineHeight: 18,
	},
	alertCard: {
		backgroundColor: colors.card,
		borderRadius: 20,
		borderWidth: 0,
		padding: 18,
		marginBottom: 32,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.06,
		shadowRadius: 16,
		elevation: 3,
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
		borderRadius: 14,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
	},
	alertTitle: {
		fontFamily: "sans-bold",
		flex: 1,
		fontSize: 16,
		color: colors.primary,
	},
	alertCopy: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: colors.mutedForeground,
		lineHeight: 20,
		marginBottom: 16,
	},
	alertCta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.primary,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 14,
		alignSelf: "flex-start",
	},
	alertCtaText: {
		fontFamily: "sans-bold",
		fontSize: 14,
		color: colors.background,
	},
	sectionTitle: {
		fontFamily: "sans-bold",
		fontSize: 14,
		letterSpacing: 1.2,
		color: colors.mutedForeground,
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
		backgroundColor: colors.card,
		borderRadius: 20,
		borderWidth: 0,
		padding: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.04,
		shadowRadius: 12,
		elevation: 2,
	},
	menuCellPressed: {
		opacity: 0.8,
		transform: [{ scale: 0.98 }],
	},
	menuIconCircle: {
		width: 44,
		height: 44,
		borderRadius: 14,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 10,
	},
	menuLabel: {
		fontFamily: "sans-bold",
		fontSize: 15,
		color: colors.primary,
		marginBottom: 4,
	},
	menuHint: {
		fontFamily: "sans-medium",
		fontSize: 12,
		color: colors.mutedForeground,
		lineHeight: 16,
	},
});
