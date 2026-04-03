import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
	MOCK_LIBRARY_NAME,
	MOCK_MONTH_EARNINGS_CENTS,
	MOCK_OWNER_HAS_BATCHES,
	MOCK_OWNER_NAME,
} from "@/features/home/logic/home-flags";
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
			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					<View style={styles.headerText}>
						<Text style={styles.greeting}>Hello,</Text>
						<Text style={styles.ownerName}>{MOCK_OWNER_NAME}</Text>
						<Text style={styles.libraryName}>{MOCK_LIBRARY_NAME}</Text>
					</View>
					<View style={styles.avatar}>
						<Ionicons name="library-outline" size={26} color={colors.primary} />
					</View>
				</View>

				<View style={styles.summaryCard}>
					<Text style={styles.summaryLabel}>This month (collections)</Text>
					<Text style={styles.summaryValue}>
						{MOCK_MONTH_EARNINGS_CENTS != null
							? formatRupeeFromCents(MOCK_MONTH_EARNINGS_CENTS)
							: "—"}
					</Text>
					<Text style={styles.summaryHint}>
						{MOCK_OWNER_HAS_BATCHES
							? "Tap Payments for breakdown & dues."
							: "Set up batches to start tracking seat sales and renewals."}
					</Text>
				</View>

				{showBatchSetupBanner ? (
					<View style={styles.alertCard} accessibilityRole="alert">
						<View style={styles.alertAccent} />
						<View style={styles.alertBody}>
							<View style={styles.alertTitleRow}>
								<View style={styles.alertIconWrap}>
									<Ionicons name="calendar-outline" size={22} color={colors.primary} />
								</View>
								<Text style={styles.alertTitle}>Set up your batches first</Text>
							</View>
							<Text style={styles.alertCopy}>
								Add the time slots you run each day (for example morning, afternoon, evening). Then you can assign
								seats, see who paid for which batch, and get clearer earnings visibility.
							</Text>
							<Pressable
								accessibilityRole="button"
								style={styles.alertCta}
								onPress={() => router.push("/batches")}>
								<Text style={styles.alertCtaText}>Add batches</Text>
								<Ionicons name="arrow-forward" size={18} color={colors.background} />
							</Pressable>
						</View>
					</View>
				) : null}

				<Text style={styles.sectionTitle}>Menu</Text>
				<View style={styles.menuGrid}>
					{MENU.map((item) => (
						<Pressable
							key={item.key}
							accessibilityRole="button"
							accessibilityLabel={item.label}
							style={({ pressed }) => [styles.menuCell, pressed && styles.menuCellPressed]}
							onPress={() => router.push(item.href)}>
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
		paddingBottom: 32,
	},
	header: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		marginTop: 8,
		marginBottom: 20,
	},
	headerText: {
		flex: 1,
		paddingRight: 12,
	},
	greeting: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.mutedForeground,
	},
	ownerName: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.primary,
		marginTop: 2,
	},
	libraryName: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.mutedForeground,
		marginTop: 4,
	},
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 18,
		backgroundColor: colors.card,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
	},
	summaryCard: {
		backgroundColor: colors.accent,
		borderRadius: 24,
		padding: 20,
		marginBottom: 20,
	},
	summaryLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: "rgba(255,255,255,0.85)",
	},
	summaryValue: {
		fontSize: 32,
		fontWeight: "800",
		color: "#fff",
		marginTop: 6,
	},
	summaryHint: {
		fontSize: 14,
		fontWeight: "500",
		color: "rgba(255,255,255,0.9)",
		marginTop: 10,
		lineHeight: 20,
	},
	alertCard: {
		flexDirection: "row",
		backgroundColor: colors.card,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: colors.border,
		marginBottom: 24,
		overflow: "hidden",
	},
	alertAccent: {
		width: 5,
		backgroundColor: colors.accent,
	},
	alertBody: {
		flex: 1,
		padding: 16,
		paddingLeft: 14,
	},
	alertTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginBottom: 8,
	},
	alertIconWrap: {
		width: 40,
		height: 40,
		borderRadius: 12,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
	},
	alertTitle: {
		flex: 1,
		fontSize: 17,
		fontWeight: "800",
		color: colors.primary,
	},
	alertCopy: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.mutedForeground,
		lineHeight: 21,
		marginBottom: 14,
	},
	alertCta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		alignSelf: "flex-start",
		backgroundColor: colors.primary,
		paddingVertical: 12,
		paddingHorizontal: 18,
		borderRadius: 14,
	},
	alertCtaText: {
		fontSize: 15,
		fontWeight: "800",
		color: colors.background,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: "800",
		letterSpacing: 1,
		color: colors.mutedForeground,
		textTransform: "uppercase",
		marginBottom: 12,
	},
	menuGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	menuCell: {
		width: "48%",
		flexGrow: 1,
		maxWidth: "48%",
		backgroundColor: colors.card,
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: colors.border,
		paddingVertical: 18,
		paddingHorizontal: 14,
	},
	menuCellPressed: {
		opacity: 0.92,
		backgroundColor: colors.muted,
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
		fontSize: 16,
		fontWeight: "800",
		color: colors.primary,
	},
	menuHint: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.mutedForeground,
		marginTop: 4,
		lineHeight: 16,
	},
});
