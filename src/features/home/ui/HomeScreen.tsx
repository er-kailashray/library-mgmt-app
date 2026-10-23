import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getBatchesApi } from "@/features/batches/logic/batches-api";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { pickProfilePhoto, uploadProfilePhoto } from "@/features/settings/logic/profile-photo";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { getInitials } from "@/shared/utils/text";

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

// The four things an owner does most days get one-tap tiles at the top; the rest stay in "More".
const QUICK_ACCESS_KEYS = ["admission", "payments", "members", "attendance"];
const QUICK_ACCESS = QUICK_ACCESS_KEYS.map((key) => MENU.find((item) => item.key === key)!);
const MORE_MENU = MENU.filter((item) => !QUICK_ACCESS_KEYS.includes(item.key));

type SetupStep = {
	key: string;
	label: string;
	hint: string;
	icon: keyof typeof Ionicons.glyphMap;
	done: boolean;
	required?: boolean;
	busy?: boolean;
	onPress: () => void;
};

/** One-line read of how full the library is. */
function occupancyStatus(percent: number): string {
	if (percent >= 100) return "Full";
	if (percent >= 80) return "Almost full";
	if (percent >= 40) return "Filling up";
	return "Plenty of space";
}

function formatLateness(daysOverdue: number): string {
	if (daysOverdue <= 0) return "Due today";
	if (daysOverdue < 30) return `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} late`;
	const months = Math.floor(daysOverdue / 30);
	return `${months} month${months === 1 ? "" : "s"} late`;
}

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
	const { height: windowHeight } = useWindowDimensions();

	const { data: dashboard, refetch: refetchDashboard, setData: setDashboard } = useApiData(getDashboardApi, []);
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
	const hasBatches = batches !== null && batches.length > 0;
	// Brand-new library: every number on Home would be 0, so guide the owner to their first member instead.
	// Payments are checked too so a library whose members have all left doesn't look "new".
	const isNewLibrary = dashboard !== null && dashboard.total_members === 0 && dashboard.recent_payments.length === 0;

	const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

	const handleAddPhoto = useCallback(async () => {
		const uri = await pickProfilePhoto();
		if (!uri) return;
		try {
			setIsUploadingPhoto(true);
			const user = await uploadProfilePhoto(uri);
			// Patch the photo in place rather than refetching the whole dashboard.
			setDashboard((current) => (current ? { ...current, owner_photo: user.profile_photo_url ?? null } : current));
		} catch (err: any) {
			Alert.alert("Error", err.message || "Failed to upload photo.");
		} finally {
			setIsUploadingPhoto(false);
		}
	}, [setDashboard]);

	// Batches are required before anything else works; location and photo are nice-to-haves.
	// Wait for both requests so the card doesn't flash with half its ticks wrong.
	const setupSteps: SetupStep[] =
		dashboard && batches
			? [
					{
						key: "batches",
						label: "Set up your batches",
						hint: "Add your daily time slots, then assign seats",
						icon: "calendar-outline",
						done: batches.length > 0,
						required: true,
						onPress: () => router.push("/batches"),
					},
					{
						key: "location",
						label: "Pin library on map",
						hint: "So students can get directions",
						icon: "location-outline",
						done: !!dashboard.library_address,
						onPress: () => router.push("/library-location"),
					},
					{
						key: "photo",
						label: "Add profile photo",
						hint: "Shown to your students",
						icon: "camera-outline",
						done: !!dashboard.owner_photo,
						busy: isUploadingPhoto,
						onPress: handleAddPhoto,
					},
				]
			: [];
	const completedSteps = setupSteps.filter((step) => step.done).length;
	const showSetupCard = setupSteps.length > 0 && completedSteps < setupSteps.length;

	const occupancyPercent = dashboard && dashboard.total_seats > 0 ? Math.min(100, Math.round((dashboard.occupied_seats / dashboard.total_seats) * 100)) : 0;

	const progressPercentage =
		dashboard && dashboard.expected_collection > 0 ? Math.min(100, Math.round((dashboard.monthly_collection / dashboard.expected_collection) * 100)) : 0;

	const styles = createStyles(theme);

	return (
		<View style={styles.root}>
			{/* Accent wash over the top quarter of the screen, fading into the page background. */}
			<LinearGradient
				pointerEvents="none"
				colors={[theme.accent + (isDark ? "59" : "40"), theme.accent + "00"]}
				style={[styles.topGradient, { height: windowHeight * 0.25 }]}
			/>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<StatusBar style={isDark ? "light" : "dark"} />
				<View style={styles.headerWrapper}>
					<View style={styles.header}>
						<View style={styles.headerText}>
							<Text style={styles.headerTitle} numberOfLines={1}>
								{dashboard?.library_name || "My Library"}
							</Text>
							<Pressable accessibilityRole="button" style={styles.headerAddressRow} onPress={() => router.push("/library-location")}>
								<Ionicons name="location" size={14} color={theme.accent} />
								<Text style={styles.headerSubtitle} numberOfLines={1}>
									{dashboard?.library_address || "Add library address"}
								</Text>
								<Ionicons name="chevron-down" size={14} color={theme.mutedForeground} />
							</Pressable>
						</View>
						<Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push("/settings")}>
							{dashboard?.owner_photo ? (
								<Image source={{ uri: dashboard.owner_photo }} style={styles.avatar} />
							) : (
								<View style={styles.avatar}>
									<Text style={styles.avatarText}>{getInitials(dashboard?.owner_name || "")}</Text>
								</View>
							)}
						</Pressable>
					</View>
				</View>

				<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
					{showSetupCard && (
						<View style={styles.setupCard}>
							<View style={styles.setupHeaderRow}>
								<Text style={styles.setupTitle}>Get your library ready</Text>
								<Text style={styles.setupCount}>
									{completedSteps}/{setupSteps.length} done
								</Text>
							</View>
							<View style={styles.setupProgressTrack}>
								<View style={[styles.setupProgressBar, { width: `${(completedSteps / setupSteps.length) * 100}%` }]} />
							</View>

							{setupSteps.map((step, index) => {
								const highlight = step.required && !step.done;
								return (
									<Pressable
										key={step.key}
										accessibilityRole="button"
										style={[styles.setupRow, index !== setupSteps.length - 1 && styles.setupRowBorder]}
										onPress={step.onPress}
										disabled={step.done || step.busy}
									>
										<View style={styles.setupIconWrap}>
											<Ionicons name={step.icon} size={20} color={theme.accent} />
										</View>
										<View style={styles.setupRowText}>
											<View style={styles.setupLabelRow}>
												<Text style={styles.setupRowLabel}>{step.label}</Text>
												{!step.done && (
													<Text style={[styles.setupTag, highlight ? styles.setupTagRequired : styles.setupTagOptional]}>{step.required ? "Start here" : "Optional"}</Text>
												)}
											</View>
											<Text style={styles.setupRowHint}>{step.hint}</Text>
										</View>
										{step.busy ? (
											<ActivityIndicator size="small" color={theme.accent} />
										) : step.done ? (
											<Ionicons name="checkmark-circle" size={22} color={theme.success} />
										) : (
											<Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
										)}
									</Pressable>
								);
							})}
						</View>
					)}

					{/* Everything here needs batches first, so it only appears once some exist. */}
					{hasBatches && (
						<View style={styles.quickAccessRow}>
							{QUICK_ACCESS.map((item) => (
								<Pressable
									key={item.key}
									accessibilityRole="button"
									accessibilityLabel={item.label}
									style={({ pressed }) => [styles.quickAccessItem, pressed && styles.menuCellPressed]}
									onPress={() => router.push(item.href)}>
									<View style={styles.quickAccessIcon}>
										<Ionicons name={item.icon} size={24} color={theme.accent} />
									</View>
									<Text style={styles.quickAccessLabel} numberOfLines={1}>
										{item.label}
									</Text>
								</Pressable>
							))}
						</View>
					)}

					{isNewLibrary && (
						<View style={styles.firstMemberCard}>
							<View style={styles.firstMemberIconWrap}>
								<Ionicons name="person-add-outline" size={26} color={theme.accent} />
							</View>
							<Text style={styles.firstMemberTitle}>Add your first member</Text>
							<Text style={styles.firstMemberCopy}>
								Admit a student, give them a seat and record their first payment. Your seats, collections and dues will show up here.
							</Text>
							{showBatchSetupBanner ? (
								<>
									<Pressable accessibilityRole="button" style={[styles.firstMemberCta, styles.firstMemberCtaMuted]} onPress={() => router.push("/batches")}>
										<Text style={[styles.firstMemberCtaText, styles.firstMemberCtaTextMuted]}>Set up batches first</Text>
										<Ionicons name="arrow-forward" size={16} color={theme.primary} />
									</Pressable>
									<Text style={styles.firstMemberHint}>Members are assigned to a batch, so add your time slots before admitting anyone.</Text>
								</>
							) : (
								<Pressable accessibilityRole="button" style={styles.firstMemberCta} onPress={() => router.push("/admission")}>
									<Ionicons name="add" size={18} color="#fff" />
									<Text style={styles.firstMemberCtaText}>Add member</Text>
								</Pressable>
							)}
						</View>
					)}

					{dashboard && !isNewLibrary && (
						<Pressable accessibilityRole="button" accessibilityLabel="Occupancy - open seats" style={({ pressed }) => [styles.occupancyCard, pressed && styles.menuCellPressed]} onPress={() => router.push("/seats")}>
							<View style={styles.occupancyHeader}>
								<Text style={styles.occupancyLabel}>Occupancy</Text>
								<Text style={styles.occupancyPercent}>{occupancyPercent}%</Text>
							</View>
							<View style={styles.progressContainer}>
								<View style={[styles.progressBar, { width: `${occupancyPercent}%` }]} />
							</View>
							<Text style={styles.occupancyDetail}>
								{dashboard.occupied_seats} of {dashboard.total_seats} seats filled · {Math.max(0, dashboard.total_seats - dashboard.occupied_seats)} free
							</Text>
							<View style={styles.occupancyFooter}>
								<Text style={styles.occupancyStatus}>{occupancyStatus(occupancyPercent)}</Text>
								<View style={styles.occupancyLink}>
									<Text style={styles.occupancyLinkText}>Seats</Text>
									<Ionicons name="chevron-forward" size={14} color={theme.accent} />
								</View>
							</View>
						</Pressable>
					)}

					{dashboard && !isNewLibrary && (
						<View style={styles.duesCard}>
							{dashboard.due_members_count > 0 ? (
								<>
									<View style={styles.duesHeaderRow}>
										<View style={styles.duesTitleRow}>
											<View style={[styles.duesTitleDot, { backgroundColor: theme.destructive }]} />
											<Text style={styles.duesTitle}>Dues pending</Text>
										</View>
										<Text style={styles.duesTotal}>
											{formatRupee(dashboard.due_total)}
											<Text style={styles.duesTotalSuffix}>
												{" "}
												· {dashboard.due_members_count} member{dashboard.due_members_count === 1 ? "" : "s"}
											</Text>
										</Text>
									</View>

									{dashboard.top_dues.map((due) => (
										<Pressable
											key={due.member_id}
											accessibilityRole="button"
											style={({ pressed }) => [styles.dueRow, pressed && styles.menuRowPressed]}
											onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(due.member_id) } })}>
											<View style={styles.dueAvatar}>
												<Text style={styles.dueAvatarText}>{getInitials(due.name)}</Text>
											</View>
											<View style={styles.dueInfo}>
												<Text style={styles.dueName} numberOfLines={1}>
													{due.name}
												</Text>
												<Text style={[styles.dueLateness, due.days_overdue >= 15 && { color: theme.destructive }]}>{formatLateness(due.days_overdue)}</Text>
											</View>
											<Text style={styles.dueAmount}>{formatRupee(due.amount)}</Text>
											<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
										</Pressable>
									))}

									<Pressable accessibilityRole="button" style={styles.duesSeeAll} onPress={() => router.push({ pathname: "/members", params: { filter: "due" } })} hitSlop={6}>
										<Text style={styles.duesSeeAllText}>
											{dashboard.due_members_count > dashboard.top_dues.length ? `See all ${dashboard.due_members_count} dues` : "Open dues list"}
										</Text>
										<Ionicons name="chevron-forward" size={14} color={theme.accent} />
									</Pressable>
								</>
							) : (
								<View style={styles.duesTitleRow}>
									<Ionicons name="checkmark-circle" size={18} color={theme.success} />
									<Text style={styles.duesCaughtUp}>All caught up - no dues pending</Text>
								</View>
							)}

							{dashboard.upcoming_renewals > 0 && (
								<Pressable accessibilityRole="button" style={({ pressed }) => [styles.renewalsRow, pressed && styles.menuRowPressed]} onPress={() => router.push("/renewals")}>
									<Ionicons name="refresh-outline" size={16} color={theme.accent} />
									<Text style={styles.renewalsText}>
										{dashboard.upcoming_renewals} renewing this week
									</Text>
									<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
								</Pressable>
							)}
						</View>
					)}

					{!isNewLibrary && (
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
					)}

					{dashboard && !isNewLibrary && (
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

					<Text style={styles.sectionTitle}>More</Text>
					<View style={styles.menuList}>
						{MORE_MENU.map((item, index) => (
							<Pressable
								key={item.key}
								accessibilityRole="button"
								accessibilityLabel={item.label}
								style={({ pressed }) => [styles.menuRow, index > 0 && styles.menuRowBorder, pressed && styles.menuRowPressed]}
								onPress={() => router.push(item.href)}>
								<View style={styles.menuIconCircle}>
									<Ionicons name={item.icon} size={18} color={theme.accent} />
								</View>
								<View style={styles.menuText}>
									<Text style={styles.menuLabel}>{item.label}</Text>
									<Text style={styles.menuHint}>{item.hint}</Text>
								</View>
								<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
							</Pressable>
						))}
					</View>
				</ScrollView>
			</SafeAreaView>
		</View>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: theme.background,
		},
		topGradient: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
		},
		// Transparent so the gradient behind shows through the header.
		safe: {
			flex: 1,
		},
		quickAccessRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			marginBottom: 24,
		},
		quickAccessItem: {
			width: "23%",
			alignItems: "center",
			gap: 8,
		},
		quickAccessIcon: {
			width: 60,
			height: 60,
			borderRadius: 18,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			alignItems: "center",
			justifyContent: "center",
			shadowColor: theme.accent,
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.12,
			shadowRadius: 8,
			elevation: 2,
		},
		quickAccessLabel: {
			fontFamily: "sans-semibold",
			fontSize: 12,
			color: theme.primary,
		},
		scroll: {
			paddingHorizontal: 20,
			paddingTop: 24,
			paddingBottom: 40,
		},
		headerWrapper: {
			paddingTop: 8,
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
			fontSize: 20,
			color: theme.primary,
			marginBottom: 2,
		},
		headerAddressRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
		},
		headerSubtitle: {
			flexShrink: 1,
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		avatar: {
			width: 44,
			height: 44,
			borderRadius: 22,
			backgroundColor: theme.muted,
			alignItems: "center",
			justifyContent: "center",
			overflow: "hidden",
		},
		avatarText: {
			fontFamily: "sans-bold",
			fontSize: 16,
			color: theme.primary,
		},
		setupCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.accent + "40",
			padding: 18,
			marginBottom: 24,
		},
		setupHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		setupTitle: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
		},
		setupCount: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		setupProgressTrack: {
			height: 4,
			backgroundColor: theme.muted,
			borderRadius: 2,
			overflow: "hidden",
			marginTop: 10,
			marginBottom: 6,
		},
		setupProgressBar: {
			height: "100%",
			backgroundColor: theme.success,
			borderRadius: 2,
		},
		setupRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
		},
		setupRowBorder: {
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.border,
		},
		setupIconWrap: {
			width: 40,
			height: 40,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.accent + "15",
			alignItems: "center",
			justifyContent: "center",
		},
		setupRowText: {
			flex: 1,
		},
		setupLabelRow: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 6,
		},
		setupRowLabel: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		setupTag: {
			fontFamily: "sans-bold",
			fontSize: 10,
			textTransform: "uppercase",
			letterSpacing: 0.4,
			paddingHorizontal: 6,
			paddingVertical: 2,
			borderRadius: 4,
			overflow: "hidden",
		},
		setupTagRequired: {
			color: theme.accent,
			backgroundColor: theme.accent + "1A",
		},
		setupTagOptional: {
			color: theme.mutedForeground,
			backgroundColor: theme.muted,
		},
		setupRowHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 2,
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
		firstMemberCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 24,
			alignItems: "center",
			marginBottom: 32,
		},
		firstMemberIconWrap: {
			width: 56,
			height: 56,
			borderRadius: 28,
			backgroundColor: theme.accent + "15",
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 14,
		},
		firstMemberTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
			marginBottom: 6,
		},
		firstMemberCopy: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			lineHeight: 19,
			textAlign: "center",
			marginBottom: 18,
		},
		firstMemberCta: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
			backgroundColor: theme.accent,
			borderRadius: RADIUS.sm,
			paddingVertical: 12,
			paddingHorizontal: 22,
		},
		firstMemberCtaMuted: {
			backgroundColor: theme.muted,
		},
		firstMemberCtaText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: "#fff",
		},
		firstMemberCtaTextMuted: {
			color: theme.primary,
		},
		firstMemberHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			textAlign: "center",
			marginTop: 10,
			lineHeight: 17,
		},
		occupancyCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 16,
			marginBottom: 24,
		},
		occupancyHeader: {
			flexDirection: "row",
			alignItems: "baseline",
			justifyContent: "space-between",
		},
		occupancyLabel: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			letterSpacing: 0.5,
		},
		occupancyPercent: {
			fontFamily: "sans-extrabold",
			fontSize: 26,
			color: theme.accent,
			letterSpacing: -0.5,
		},
		occupancyDetail: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.primary,
			marginTop: 12,
		},
		occupancyFooter: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginTop: 4,
		},
		occupancyStatus: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		occupancyLink: {
			flexDirection: "row",
			alignItems: "center",
			gap: 2,
		},
		occupancyLinkText: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
		},
		duesCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			paddingHorizontal: 16,
			paddingVertical: 14,
			marginBottom: 24,
		},
		duesHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 4,
		},
		duesTitleRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
		},
		duesTitleDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
		},
		duesTitle: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
		},
		duesTotal: {
			fontFamily: "sans-extrabold",
			fontSize: 15,
			color: theme.destructive,
		},
		duesTotalSuffix: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		dueRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingVertical: 10,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		dueAvatar: {
			width: 34,
			height: 34,
			borderRadius: 11,
			backgroundColor: theme.destructive + "12",
			alignItems: "center",
			justifyContent: "center",
		},
		dueAvatarText: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: theme.destructive,
		},
		dueInfo: {
			flex: 1,
		},
		dueName: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		dueLateness: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		dueAmount: {
			fontFamily: "sans-extrabold",
			fontSize: 14,
			color: theme.primary,
		},
		duesSeeAll: {
			flexDirection: "row",
			alignItems: "center",
			gap: 2,
			paddingTop: 10,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		duesSeeAllText: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
		},
		duesCaughtUp: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		renewalsRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			marginTop: 12,
			paddingTop: 12,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		renewalsText: {
			flex: 1,
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.primary,
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
		menuList: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			paddingHorizontal: 14,
		},
		menuRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
		},
		menuRowBorder: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		menuRowPressed: {
			opacity: 0.6,
		},
		// Still used by the Quick Access tiles and the occupancy card.
		menuCellPressed: {
			opacity: 0.8,
			transform: [{ scale: 0.98 }],
		},
		menuIconCircle: {
			width: 36,
			height: 36,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.accent + "15",
			alignItems: "center",
			justifyContent: "center",
		},
		menuText: {
			flex: 1,
		},
		menuLabel: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		menuHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
	});
