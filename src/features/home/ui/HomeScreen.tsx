import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getBatchesApi } from "@/features/batches/logic/batches-api";
import { Batch } from "@/features/batches/types/batches.types";
import { getDashboardApi, getMonthlyCollectionApi } from "@/features/home/logic/home-api";
import { getSetupCelebrationState, setSetupCelebrationState, type SetupCelebrationState } from "@/features/home/logic/setup-celebration-storage";
import { DashboardData, MonthlyCollection } from "@/features/home/types/home.types";
import { describePaymentPeriod, formatPaymentWhen, PAYMENT_STATUS_LOOK } from "@/features/payments/logic/payment-display";
import { pickProfilePhoto, uploadProfilePhoto } from "@/features/settings/logic/profile-photo";
import { SubscriptionBanner } from "@/features/subscription/ui/SubscriptionBanner";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { getInitials } from "@/shared/utils/text";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";

import { CelebrationBurst } from "./CelebrationBurst";
import { LiveBatchCard } from "./LiveBatchCard";

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
	/** Shown on the "You're all set" card once the step is done. */
	doneLabel: string;
	hint: string;
	icon: keyof typeof Ionicons.glyphMap;
	done: boolean;
	required?: boolean;
	busy?: boolean;
	onPress: () => void;
};

function formatLateness(daysOverdue: number): string {
	if (daysOverdue <= 0) return "Due today";
	if (daysOverdue < 30) return `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} late`;
	const months = Math.floor(daysOverdue / 30);
	return `${months} month${months === 1 ? "" : "s"} late`;
}

type StatKey = "occupancy" | "dues" | "collections";

const STAT_ORDER: StatKey[] = ["occupancy", "dues", "collections"];

/** Darkens a "#RRGGBB" colour by `amount` (0-1). */
function shade(hex: string, amount: number): string {
	const channel = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount));
	return `#${[1, 3, 5].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`;
}

/** Minutes since midnight for an "HH:MM[:SS]" time. */
function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + (m || 0);
}

function formatTime(time: string): string {
	const minutes = toMinutes(time);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The batch running right now (handles overnight batches), else the next one to start today/tomorrow. */
function findBatchNow(batches: Batch[], now: Date): { current: Batch | null; next: Batch | null } {
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const current =
		batches.find((b) => {
			const start = toMinutes(b.start_time);
			const end = toMinutes(b.end_time);
			return start <= end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
		}) ?? null;
	const byStart = [...batches].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
	const next = byStart.find((b) => toMinutes(b.start_time) > nowMinutes) ?? byStart[0] ?? null;
	return { current, next };
}

type HomeStyles = ReturnType<typeof createStyles>;

/** The single action at the bottom of every panel. */
function PanelLink({ label, onPress, styles, theme }: { label: string; onPress: () => void; styles: HomeStyles; theme: { accent: string } }) {
	return (
		<Pressable accessibilityRole="button" style={({ pressed }) => [styles.panelLink, pressed && styles.menuRowPressed]} onPress={onPress} hitSlop={6}>
			<Text style={styles.panelLinkText}>{label}</Text>
			<Ionicons name="arrow-forward" size={14} color={theme.accent} />
		</Pressable>
	);
}

/** How long the congratulations card stays before giving way to "Add your first member". */
const CELEBRATION_VISIBLE_MS = 6000;

/** Fades its content in when it first appears. */
function FadeIn({ children }: { children: React.ReactNode }) {
	const value = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
	}, [value]);

	return <Animated.View style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>;
}

/** Replaces the setup card once every step is done, then fades away on its own. */
function SetupCompleteCard({ steps, onDismiss, styles, theme }: { steps: SetupStep[]; onDismiss: () => void; styles: HomeStyles; theme: Theme }) {
	const appear = useRef(new Animated.Value(0)).current;
	const leaving = useRef(false);

	// Fade and shrink away, then hand over to the "Add your first member" card.
	const leave = useCallback(() => {
		if (leaving.current) return;
		leaving.current = true;
		Animated.timing(appear, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDismiss());
	}, [appear, onDismiss]);

	useEffect(() => {
		const timer = setTimeout(leave, CELEBRATION_VISIBLE_MS);
		return () => clearTimeout(timer);
	}, [leave]);
	const bloom = useRef(new Animated.Value(0)).current;
	const wobble = useRef(new Animated.Value(0)).current;
	const stepIn = useRef(steps.map(() => new Animated.Value(0))).current;

	// Card settles in, then the flower blooms and wobbles, then the finished steps tick in one by one.
	useEffect(() => {
		Animated.sequence([
			Animated.spring(appear, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
			Animated.parallel([
				Animated.spring(bloom, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
				Animated.sequence(
					[1, -1, 0.6, -0.6, 0].map((toValue) => Animated.timing(wobble, { toValue, duration: 110, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))
				),
			]),
			Animated.stagger(
				120,
				stepIn.map((value) => Animated.timing(value, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }))
			),
		]).start();
	}, [appear, bloom, wobble, stepIn]);

	return (
		<Animated.View
			style={[
				styles.celebrationCard,
				{ opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
			]}>
			<LinearGradient
				pointerEvents="none"
				colors={[theme.accent + "2E", theme.subscription + "1F", theme.card]}
				locations={[0, 0.55, 1]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
			<Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.celebrationClose} onPress={leave} hitSlop={10}>
				<Ionicons name="close" size={18} color={theme.mutedForeground} />
			</Pressable>

			<View style={styles.celebrationFlowerArea}>
				{/* Small blossoms around the main flower. */}
				<Ionicons name="flower" size={16} color={theme.subscription} style={[styles.celebrationPetal, { top: 4, left: 6 }]} />
				<Ionicons name="flower" size={12} color="#F59E0B" style={[styles.celebrationPetal, { top: 0, right: 10 }]} />
				<Ionicons name="flower" size={14} color="#F472B6" style={[styles.celebrationPetal, { bottom: 2, right: 0 }]} />
				<Animated.View
					style={[
						styles.celebrationFlowerWrap,
						{
							transform: [
								{ scale: bloom },
								{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] }) },
							],
						},
					]}>
					<Ionicons name="flower" size={44} color={theme.accent} />
				</Animated.View>
			</View>

			<Text style={styles.celebrationTitle}>Congratulations!</Text>
			<Text style={styles.celebrationSubtitle}>Your library is ready to use</Text>
			<Text style={styles.celebrationCopy}>Next, add your first member. Seats, collections and dues will show up here as members join and pay.</Text>

			<View style={styles.celebrationSteps}>
				{steps.map((step, i) => (
					<Animated.View
						key={step.key}
						style={[
							styles.celebrationStep,
							{ opacity: stepIn[i], transform: [{ translateX: stepIn[i].interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
						]}>
						<Ionicons name="checkmark-circle" size={18} color={theme.success} />
						<Text style={styles.celebrationStepText}>{step.doneLabel}</Text>
					</Animated.View>
				))}
			</View>

			<Pressable accessibilityRole="button" style={({ pressed }) => [styles.celebrationBtn, pressed && { opacity: 0.85 }]} onPress={leave}>
				<Text style={styles.celebrationBtnText}>Let's go</Text>
				<Ionicons name="arrow-forward" size={16} color="#fff" />
			</Pressable>
		</Animated.View>
	);
}

/** "YYYY-MM" shifted by whole months. */
function shiftMonth(month: string, delta: number): string {
	const [year, monthIndex] = month.split("-").map(Number);
	const date = new Date(year, monthIndex - 1 + delta, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
	return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Occupancy column chart: plot height and the band above it for the tapped column's value. */
const CHART_HEIGHT = 96;
const CHART_VALUE_SPACE = 18;

/** Most-overdue members listed on Home before handing off to the Members screen. */
const MAX_DUES_ON_HOME = 3;

/** Latest payments listed on Home; the full list is one tap away. */
const MAX_RECENT_PAYMENTS_ON_HOME = 3;

/** How far back the collections card lets you browse. */
const MAX_MONTHS_BACK = 12;

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

	// Only true once batches have actually loaded, so batch-dependent sections don't flash in.
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
						doneLabel: "Batches set up",
						hint: "Add your daily time slots, then assign seats",
						icon: "calendar-outline",
						done: batches.length > 0,
						required: true,
						onPress: () => router.push("/batches"),
					},
					{
						key: "location",
						label: "Pin library on map",
						doneLabel: "Library pinned on the map",
						hint: "So students can get directions",
						icon: "location-outline",
						done: !!dashboard.library_address,
						onPress: () => router.push("/library-location"),
					},
					{
						key: "photo",
						label: "Add profile photo",
						doneLabel: "Profile photo added",
						hint: "Shown to your students",
						icon: "camera-outline",
						done: !!dashboard.owner_photo,
						busy: isUploadingPhoto,
						onPress: handleAddPhoto,
					},
				]
			: [];
	const completedSteps = setupSteps.filter((step) => step.done).length;
	// The one step to do next gets "Start here"; other unfinished required steps say "Required".
	const nextStepKey = setupSteps.find((step) => step.required && !step.done)?.key;
	const showSetupCard = setupSteps.length > 0 && completedSteps < setupSteps.length;
	const allStepsDone = setupSteps.length > 0 && completedSteps === setupSteps.length;

	// undefined until read from storage. The congratulations card only follows a setup card the
	// owner actually saw unfinished, so libraries set up before this existed don't get it.
	const [celebration, setCelebration] = useState<SetupCelebrationState | null | undefined>(undefined);

	useEffect(() => {
		void getSetupCelebrationState().then(setCelebration);
	}, []);

	useEffect(() => {
		if (showSetupCard && celebration !== undefined && celebration !== "pending") {
			setCelebration("pending");
			void setSetupCelebrationState("pending");
		}
	}, [showSetupCard, celebration]);

	const showSetupComplete = allStepsDone && celebration === "pending";
	const showFirstMemberCard = isNewLibrary && hasBatches && !showSetupCard && !showSetupComplete && celebration !== undefined;

	const dismissSetupComplete = useCallback(() => {
		setCelebration("done");
		void setSetupCelebrationState("done");
	}, []);

	// Which summary tile is opened below the grid. None at first, so Home opens calm; tap a tile to
	// open its detail, tap it again to close it.
	const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
	const busiestBatch = dashboard?.batch_occupancy.reduce<DashboardData["batch_occupancy"][number] | null>(
		(best, batch) => (!best || batch.occupied / Math.max(1, batch.total) > best.occupied / Math.max(1, best.total) ? batch : best),
		null
	);
	const [pickedBatchId, setPickedBatchId] = useState<number | null>(null);
	const recentPayments = dashboard?.recent_payments.slice(0, MAX_RECENT_PAYMENTS_ON_HOME) ?? [];
	const batchNow = batches && batches.length > 0 ? findBatchNow(batches, new Date()) : null;
	const chartBatch =
		dashboard?.batch_occupancy.find((b) => b.id === pickedBatchId) ??
		dashboard?.batch_occupancy.find((b) => b.id === batchNow?.current?.id) ??
		busiestBatch ??
		null;

	// 0 = this month; negative = browsing earlier months on the collections card.
	const [monthOffset, setMonthOffset] = useState(0);
	const [pastMonth, setPastMonth] = useState<MonthlyCollection | null>(null);
	const [isLoadingPastMonth, setIsLoadingPastMonth] = useState(false);
	const viewedMonth = dashboard ? shiftMonth(dashboard.collection_month, monthOffset) : null;

	useEffect(() => {
		if (monthOffset === 0 || !viewedMonth) return;
		let cancelled = false;
		setIsLoadingPastMonth(true);
		getMonthlyCollectionApi(viewedMonth)
			.then((response) => !cancelled && setPastMonth(response.data))
			.catch(() => !cancelled && setPastMonth(null))
			.finally(() => !cancelled && setIsLoadingPastMonth(false));
		return () => {
			cancelled = true;
		};
	}, [monthOffset, viewedMonth]);

	// Average across batches: all bookings / (seats x batches). A library full in the morning and
	// empty in the evening is 50% used, not 100%.
	const batchSeatSlots = dashboard?.batch_occupancy.reduce((sum, b) => sum + b.total, 0) ?? 0;
	const batchBookings = dashboard?.batch_occupancy.reduce((sum, b) => sum + b.occupied, 0) ?? 0;
	const occupancyPercent = batchSeatSlots > 0 ? Math.min(100, Math.round((batchBookings / batchSeatSlots) * 100)) : 0;

	// This month's fees split by status; the stacked bar and its legend share these.
	const feeSegments = dashboard
		? [
				{ key: "paid", label: "Received", amount: dashboard.month_fees.collected, color: theme.success },
				{ key: "due", label: "Due now", amount: dashboard.month_fees.due, color: theme.destructive },
				{ key: "later", label: "Due later", amount: dashboard.month_fees.upcoming, color: theme.mutedForeground + "66" },
			]
		: [];

	const styles = createStyles(theme);

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<StatusBar style={isDark ? "light" : "dark"} />
				<View style={styles.headerWrapper}>
					<View style={styles.header}>
						<View style={styles.headerText}>
							{/* ON HOLD: today's date line - placement still being decided (style: headerDate).
							<Text style={styles.headerDate}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
							*/}
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
					<SubscriptionBanner />

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
								const highlight = step.key === nextStepKey;
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
													<Text style={[styles.setupTag, highlight ? styles.setupTagRequired : styles.setupTagOptional]}>{highlight ? "Start here" : step.required ? "Required" : "Optional"}</Text>
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

					{showSetupComplete && <SetupCompleteCard steps={setupSteps} onDismiss={dismissSetupComplete} styles={styles} theme={theme} />}

					{/* Comes after setup and its congratulations; members need a batch to sit in. */}
					{showFirstMemberCard && (
						<FadeIn>
							<View style={styles.firstMemberCard}>
								<View style={styles.firstMemberIconWrap}>
									<Ionicons name="person-add-outline" size={26} color={theme.accent} />
								</View>
								<Text style={styles.firstMemberTitle}>Add your first member</Text>
								<Text style={styles.firstMemberCopy}>
									Admit a student, give them a seat and record their first payment. Your seats, collections and dues will show up here.
								</Text>
								<Pressable accessibilityRole="button" style={styles.firstMemberCta} onPress={() => router.push("/admission")}>
									<Ionicons name="add" size={18} color="#fff" />
									<Text style={styles.firstMemberCtaText}>Add member</Text>
								</Pressable>
							</View>
						</FadeIn>
					)}

					{/* Two rows of one-tap actions, shown once batches exist. Before that the setup card is the
					    only thing to do: it links to Batches, and Settings stays on the avatar. */}
					{(hasBatches ? [QUICK_ACCESS, MORE_MENU] : []).map((row, rowIndex, rows) => (
						<View key={rowIndex} style={[styles.quickAccessRow, rowIndex < rows.length - 1 && styles.quickAccessRowStacked]}>
							{row.map((item) => (
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
					))}

					{/* The batch running now (or next), live - tap for attendance. */}
					{dashboard && batches && batches.length > 0 && !isNewLibrary && (
						<LiveBatchCard batches={batches} occupancy={dashboard.batch_occupancy} onPress={() => router.push("/attendance")} />
					)}

					{dashboard && !isNewLibrary && (
						<>
							<View style={[styles.statGrid, !selectedStat && styles.statGridClosed]}>
								{(
									[
										{
											key: "occupancy",
											icon: "pie-chart-outline",
											label: "Occupancy",
											value: `${occupancyPercent}%`,
											alert: false,
										},
										{
											key: "dues",
											icon: "alert-circle-outline",
											label: "Dues",
											value: dashboard.due_members_count > 0 ? formatRupee(dashboard.due_total) : "₹0",
											alert: dashboard.due_members_count > 0,
										},
										{
											key: "collections",
											icon: "wallet-outline",
											label: "Received",
											value: formatRupee(dashboard.month_cash.received),
											alert: false,
										},
									] as { key: StatKey; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; alert: boolean }[]
								).map((tile) => {
									const isSelected = selectedStat === tile.key;
									return (
										<Pressable
											key={tile.key}
											accessibilityRole="tab"
											accessibilityState={{ selected: isSelected }}
											style={({ pressed }) => [styles.statTile, isSelected && styles.statTileSelected, pressed && styles.menuCellPressed]}
											onPress={() => setSelectedStat((current) => (current === tile.key ? null : tile.key))}>
											{isSelected && <LinearGradient pointerEvents="none" colors={[theme.accent, shade(theme.accent, 0.18)]} style={styles.statTileGradient} />}
											<View style={[styles.statTileIcon, isSelected && styles.statTileIconSelected]}>
												<Ionicons name={tile.icon} size={16} color={isSelected ? "#fff" : tile.alert ? theme.destructive : theme.accent} />
											</View>
											<Text
												style={[styles.statTileValue, tile.alert && styles.statTileValueAlert, isSelected && styles.statTileTextSelected]}
												numberOfLines={1}
												adjustsFontSizeToFit>
												{tile.value}
											</Text>
											<Text style={[styles.statTileLabel, isSelected && styles.statTileTextSelected]}>{tile.label}</Text>
										</Pressable>
									);
								})}
							</View>
							{/* Pointer from the selected tile into its detail card, so they read as one unit. */}
							{selectedStat && (
								<View style={styles.caretRow} pointerEvents="none">
									{STAT_ORDER.map((key) => (
										<View key={key} style={styles.caretSlot}>
											{selectedStat === key && <View style={styles.caret} />}
										</View>
									))}
								</View>
							)}
						</>
					)}

					{/* The tile above already shows the headline number; the panel only adds context and the next step. */}
					{dashboard && !isNewLibrary && selectedStat === "occupancy" && (
						<View style={styles.panel}>
							{dashboard.batch_occupancy.length === 0 ? (
								<Text style={styles.panelLine}>Add batches to see how full each one is.</Text>
							) : (
								<>
									{/* Column chart: seats filled per batch. One hue; the pale track is the batch's full capacity. */}
									<View style={styles.chart} accessibilityRole="summary" accessibilityLabel="Seats filled in each batch">
										<View style={styles.chartBaseline} pointerEvents="none" />
										<View style={styles.chartFullLine} pointerEvents="none">
											<Text style={styles.chartFullLabel}>Full</Text>
										</View>
										<View style={styles.chartColumns}>
											{dashboard.batch_occupancy.map((batch) => {
												const percent = batch.total > 0 ? Math.min(100, (batch.occupied / batch.total) * 100) : 0;
												const isPicked = chartBatch?.id === batch.id;
												return (
													<Pressable
														key={batch.id}
														accessibilityRole="button"
														accessibilityLabel={`${batch.name}, ${batch.occupied} of ${batch.total} seats filled`}
														accessibilityState={{ selected: isPicked }}
														style={styles.chartSlot}
														onPress={() => setPickedBatchId(batch.id)}>
														<View style={styles.chartPlot}>
															<Text style={[styles.chartValue, !isPicked && styles.chartValueHidden]}>{batch.occupied}</Text>
															<View style={styles.chartTrack}>
																<View style={[styles.chartBar, { height: `${percent}%` }, !isPicked && chartBatch && styles.chartBarDim]} />
															</View>
														</View>
														<Text style={[styles.chartName, isPicked && styles.chartNamePicked]} numberOfLines={1}>
															{batch.name}
															{batchNow?.current?.id === batch.id ? " •" : ""}
														</Text>
														<Text style={styles.chartTime} numberOfLines={1}>
															{formatTime(batch.start_time).replace(":00", "")}
														</Text>
													</Pressable>
												);
											})}
										</View>
									</View>
									{chartBatch && (
										<View style={[styles.panelFooter, styles.panelRowBorder]}>
											<Text style={styles.panelNote} numberOfLines={1}>
												<Text style={styles.panelStrong}>{chartBatch.name}</Text>
												{batchNow?.current?.id === chartBatch.id ? " (now)" : ""} · {chartBatch.occupied} of {chartBatch.total} seats
												{chartBatch.occupied === 0 ? " · empty" : ""}
											</Text>
											<PanelLink styles={styles} theme={theme} label="Open seats" onPress={() => router.push("/seats")} />
										</View>
									)}
								</>
							)}
						</View>
					)}

					{dashboard && !isNewLibrary && selectedStat === "dues" && (
						<View style={styles.panel}>
							{dashboard.top_dues.length === 0 && <Text style={styles.panelLine}>All caught up - nobody owes anything.</Text>}
							{/* At most 3 here; everyone else is one tap away via "Open members". */}
							{dashboard.top_dues.slice(0, MAX_DUES_ON_HOME).map((due, index) => (
								<Pressable
									key={due.member_id}
									accessibilityRole="button"
									style={({ pressed }) => [styles.panelRow, index > 0 && styles.panelRowBorder, pressed && styles.menuRowPressed]}
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
								</Pressable>
							))}
							{dashboard.upcoming_renewals > 0 && (
								<Pressable
									accessibilityRole="button"
									style={({ pressed }) => [styles.panelRow, styles.panelRowBorder, pressed && styles.menuRowPressed]}
									onPress={() => router.push("/renewals")}>
									<Ionicons name="refresh-outline" size={16} color={theme.accent} />
									<Text style={styles.renewalsText}>{dashboard.upcoming_renewals} renewing this week</Text>
									<Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
								</Pressable>
							)}
							<View style={[styles.panelFooter, styles.panelRowBorder]}>
								<Text style={styles.panelNote}>{dashboard.this_month_dues_count > 0 ? `${dashboard.this_month_dues_count} new this month` : " "}</Text>
								<PanelLink
									styles={styles}
									theme={theme}
									label="Open dues"
									onPress={() => router.push({ pathname: "/payments", params: { tab: "due" } })}
								/>
							</View>
						</View>
					)}

					{dashboard && !isNewLibrary && selectedStat === "collections" && (
						<View style={styles.panel}>
							{viewedMonth && (
								<View style={styles.panelHeaderRow}>
									<Text style={styles.panelHeading}>{monthOffset === 0 ? "Received this month" : "Cash received"}</Text>
									<View style={styles.monthSwitcher}>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel="Previous month"
											style={styles.monthArrow}
											onPress={() => setMonthOffset((o) => o - 1)}
											disabled={monthOffset <= -MAX_MONTHS_BACK}
											hitSlop={8}>
											<Ionicons name="chevron-back" size={16} color={monthOffset <= -MAX_MONTHS_BACK ? theme.border : theme.primary} />
										</Pressable>
										<Text style={styles.monthLabel}>{formatMonth(viewedMonth)}</Text>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel="Next month"
											style={styles.monthArrow}
											onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
											disabled={monthOffset === 0}
											hitSlop={8}>
											<Ionicons name="chevron-forward" size={16} color={monthOffset === 0 ? theme.border : theme.primary} />
										</Pressable>
								</View>
								</View>
							)}

							{monthOffset === 0 ? (
								<>
									{/* Where this month's cash came from. */}
									<View style={styles.cashSplit}>
										{[
											{ key: "this", label: "This month", amount: dashboard.month_cash.for_this_month },
											{ key: "old", label: "Old dues", amount: dashboard.month_cash.for_earlier_months },
											{ key: "advance", label: "Advance", amount: dashboard.month_cash.in_advance },
										].map((part) => (
											<View key={part.key} style={styles.cashSplitItem}>
												<Text style={[styles.cashSplitAmount, part.amount === 0 && styles.cashSplitAmountZero]} numberOfLines={1} adjustsFontSizeToFit>
													{formatRupee(part.amount)}
												</Text>
												<Text style={styles.cashSplitLabel}>{part.label}</Text>
											</View>
										))}
									</View>

									<View style={[styles.panelHeaderRow, styles.panelSection]}>
										<Text style={styles.panelHeading}>{formatMonth(dashboard.collection_month).split(" ")[0]} fees</Text>
										<Text style={styles.panelHeadingValue}>{formatRupee(dashboard.month_fees.expected)}</Text>
									</View>
									{/* One stacked bar for this month's fees: received | due now | due later (the track). */}
									<View style={styles.stackBar}>
										{feeSegments.map((segment) =>
											segment.amount > 0 ? <View key={segment.key} style={[styles.stackSegment, { flex: segment.amount, backgroundColor: segment.color }]} /> : null
										)}
									</View>
									<View style={styles.feeLegend}>
										{feeSegments.map((segment) => (
											<View key={segment.key} style={styles.feeLegendItem}>
												<View style={styles.feeLegendLabelRow}>
													<View style={[styles.feeDot, { backgroundColor: segment.color }]} />
													<Text style={styles.feeLegendLabel}>{segment.label}</Text>
												</View>
												<Text style={styles.feeLegendAmount} numberOfLines={1} adjustsFontSizeToFit>
													{formatRupee(segment.amount)}
												</Text>
											</View>
										))}
									</View>
									{dashboard.month_fees.arrears > 0 && (
										<Text style={styles.panelNote}>
											+ <Text style={[styles.panelStrong, { color: theme.destructive }]}>{formatRupee(dashboard.month_fees.arrears)}</Text> still owed from earlier
											months
										</Text>
									)}
									<View style={[styles.panelFooter, styles.panelRowBorder]}>
										<Text style={styles.panelNote} numberOfLines={1}>
											Payments clear the oldest dues first
										</Text>
										<PanelLink styles={styles} theme={theme} label="Open payments" onPress={() => router.push("/payments")} />
									</View>
								</>
							) : isLoadingPastMonth ? (
								<ActivityIndicator style={styles.pastMonthLoader} color={theme.accent} />
							) : (
								<>
									<Text style={styles.panelLine}>
										{pastMonth ? (
											<>
												<Text style={styles.panelStrong}>{formatRupee(pastMonth.collected)}</Text> collected from {pastMonth.payments_count} payment
												{pastMonth.payments_count === 1 ? "" : "s"}
											</>
										) : (
											"Couldn't load this month."
										)}
									</Text>
									<View style={styles.panelFooter}>
										<Text style={styles.panelNote}>Full month</Text>
										<PanelLink styles={styles} theme={theme} label="Open payments" onPress={() => router.push("/payments")} />
									</View>
								</>
							)}
						</View>
					)}

					{dashboard && !isNewLibrary && (
						<>
							<View style={styles.sectionHeaderRow}>
								<Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Recent Payments</Text>
								{dashboard.recent_payments.length > 0 && (
									<PanelLink styles={styles} theme={theme} label="See more" onPress={() => router.push("/payments")} />
								)}
							</View>
							<View style={styles.recentCard}>
								{dashboard.recent_payments.length > 0 ? (
									recentPayments.map((payment, index) => {
										// Same as the Payments list: when and how, then the days it covers.
										const look = PAYMENT_STATUS_LOOK[payment.status ?? "PAID"] ?? PAYMENT_STATUS_LOOK.PAID;
										const color = look.color(theme);
										const period = payment.status ? describePaymentPeriod({ status: payment.status, period_start: payment.period_start, period_end: payment.period_end }) : "";
										return (
											<Pressable
												key={`${payment.name}-${index}`}
												style={[styles.recentRow, index !== recentPayments.length - 1 && styles.recentRowBorder]}
												onPress={() => payment.member_id && router.push({ pathname: "/members/[id]", params: { id: String(payment.member_id) } })}>
												<View style={[styles.recentIconCircle, { backgroundColor: color + "15" }]}>
													<Ionicons name={look.icon} size={18} color={color} />
												</View>
												<View style={styles.recentInfo}>
													<Text style={styles.recentName}>{payment.name}</Text>
													<Text style={styles.recentMeta}>
														{payment.date ? formatPaymentWhen({ date: payment.date, recorded_at: payment.recorded_at }) : payment.time_ago}
														{payment.method ? ` · ${payment.method}` : ""}
													</Text>
													{!!period && <Text style={styles.recentMeta}>{period}</Text>}
												</View>
												<Text style={[styles.recentAmount, { color }]}>
													{look.sign}
													{formatRupee(Math.abs(payment.amount))}
												</Text>
											</Pressable>
										);
									})
								) : (
									<Text style={styles.recentEmptyText}>No payments yet.</Text>
								)}
							</View>
						</>
					)}
				</ScrollView>
			</SafeAreaView>
			{/* Flowers fall over the whole screen once, when setup is first complete. */}
			{showSetupComplete && <CelebrationBurst />}
		</ScreenBackground>
	);
}

const createStyles = (theme: any) =>
	StyleSheet.create({
		// Transparent so the gradient behind shows through the header.
		safe: {
			flex: 1,
		},
		// Tighter gap when another action row follows directly underneath.
		quickAccessRowStacked: {
			marginBottom: 14,
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
		// Small date line above the library name.
		headerDate: {
			fontFamily: "sans-bold",
			fontSize: 11,
			color: theme.accent,
			textTransform: "uppercase",
			letterSpacing: 0.8,
			marginBottom: 2,
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
		firstMemberCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			padding: 24,
			alignItems: "center",
			marginBottom: 24,
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
		firstMemberCtaText: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: "#fff",
		},
		celebrationCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.accent + "40",
			paddingHorizontal: 20,
			paddingTop: 24,
			paddingBottom: 20,
			marginBottom: 24,
			alignItems: "center",
			overflow: "hidden",
		},
		celebrationClose: {
			position: "absolute",
			top: 12,
			right: 12,
			padding: 4,
			zIndex: 1,
		},
		celebrationFlowerArea: {
			width: 104,
			height: 92,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 8,
		},
		celebrationPetal: {
			position: "absolute",
		},
		celebrationFlowerWrap: {
			width: 76,
			height: 76,
			borderRadius: 38,
			backgroundColor: theme.card,
			borderWidth: 2,
			borderColor: theme.accent + "33",
			alignItems: "center",
			justifyContent: "center",
		},
		celebrationTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 24,
			color: theme.primary,
			letterSpacing: -0.3,
		},
		celebrationSubtitle: {
			fontFamily: "sans-bold",
			fontSize: 16,
			color: theme.accent,
			marginTop: 4,
			marginBottom: 8,
		},
		celebrationCopy: {
			fontFamily: "sans-medium",
			fontSize: 13,
			lineHeight: 19,
			color: theme.mutedForeground,
			textAlign: "center",
			marginBottom: 16,
			maxWidth: 280,
		},
		celebrationSteps: {
			alignSelf: "stretch",
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.success + "33",
			borderRadius: RADIUS.md,
			paddingVertical: 12,
			paddingHorizontal: 14,
			gap: 10,
			marginBottom: 16,
		},
		celebrationStep: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
		},
		celebrationStepText: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		celebrationBtn: {
			alignSelf: "stretch",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			backgroundColor: theme.accent,
			borderRadius: RADIUS.md,
			paddingVertical: 14,
		},
		celebrationBtnText: {
			fontFamily: "sans-extrabold",
			fontSize: 15,
			color: "#fff",
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
		monthSwitcher: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
		},
		monthArrow: {
			width: 26,
			height: 26,
			borderRadius: 13,
			alignItems: "center",
			justifyContent: "center",
		},
		monthLabel: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.primary,
			minWidth: 70,
			textAlign: "center",
		},
		pastMonthLoader: {
			marginVertical: 24,
		},
		statGrid: {
			flexDirection: "row",
			gap: 10,
		},
		statTile: {
			flex: 1,
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			paddingTop: 12,
			paddingBottom: 14,
			paddingHorizontal: 8,
			alignItems: "center",
		},
		statTileSelected: {
			borderColor: theme.accent,
			shadowColor: theme.accent,
			shadowOffset: { width: 0, height: 6 },
			shadowOpacity: 0.35,
			shadowRadius: 10,
			elevation: 6,
		},
		// Rounded itself (rather than clipping the tile) so the selected tile's glow isn't cut off on iOS.
		statTileGradient: {
			...StyleSheet.absoluteFill,
			borderRadius: RADIUS.md,
		},
		statTileIcon: {
			width: 28,
			height: 28,
			borderRadius: 14,
			backgroundColor: theme.accent + "15",
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 8,
		},
		statTileIconSelected: {
			backgroundColor: "rgba(255,255,255,0.22)",
		},
		statTileValue: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
		},
		statTileValueAlert: {
			color: theme.destructive,
		},
		statTileLabel: {
			fontFamily: "sans-bold",
			fontSize: 10,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			letterSpacing: 0.6,
			marginTop: 3,
		},
		statTileTextSelected: {
			color: "#fff",
		},
		// Same 3-column layout as the grid, so the caret lines up under the selected tile.
		// With no tile open there's no panel (and its bottom margin) below, so keep the same gap here.
		statGridClosed: {
			marginBottom: 24,
		},
		caretRow: {
			flexDirection: "row",
			gap: 10,
			height: 10,
			zIndex: 2,
			elevation: 2,
		},
		caretSlot: {
			flex: 1,
			alignItems: "center",
		},
		// A rotated square in the panel colours, half above the panel: reads as the panel's notch.
		caret: {
			width: 14,
			height: 14,
			marginTop: 3,
			backgroundColor: theme.card,
			borderLeftWidth: 1,
			borderTopWidth: 1,
			borderColor: theme.border,
			transform: [{ rotate: "45deg" }],
		},
		// Shared, deliberately light panel under the Occupancy / Dues / Collections tiles.
		panel: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			paddingHorizontal: 14,
			paddingVertical: 12,
			marginBottom: 24,
			gap: 8,
		},
		// --- occupancy column chart ---
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
		// Shared baseline the columns grow from.
		chartBaseline: {
			position: "absolute",
			top: CHART_VALUE_SPACE + CHART_HEIGHT + 4,
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
		chartValueHidden: {
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
		// Non-tapped columns step back a little so the tapped one reads as selected.
		chartBarDim: {
			opacity: 0.55,
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
		chartTime: {
			fontFamily: "sans-medium",
			fontSize: 10,
			color: theme.mutedForeground,
		},
		panelHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		cashSplit: {
			flexDirection: "row",
			paddingVertical: 2,
		},
		cashSplitItem: {
			flex: 1,
		},
		cashSplitAmount: {
			fontFamily: "sans-extrabold",
			fontSize: 16,
			color: theme.primary,
		},
		cashSplitAmountZero: {
			color: theme.mutedForeground,
			fontFamily: "sans-semibold",
		},
		cashSplitLabel: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		// Second heading inside a panel, divided from the part above.
		panelSection: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
			paddingTop: 10,
			marginTop: 2,
		},
		panelHeadingValue: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.primary,
		},
		panelHeading: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			letterSpacing: 0.6,
		},
		// Track = the whole month's expected fees; segments are separated by a 2px surface gap.
		stackBar: {
			flexDirection: "row",
			height: 8,
			borderRadius: 4,
			overflow: "hidden",
			backgroundColor: theme.muted,
			gap: 2,
			marginTop: 2,
		},
		stackSegment: {
			height: "100%",
		},
		feeLegend: {
			flexDirection: "row",
		},
		feeLegendItem: {
			flex: 1,
		},
		feeLegendLabelRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		feeDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
		},
		feeLegendLabel: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		feeLegendAmount: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
			marginTop: 2,
			marginLeft: 14,
		},
		panelLine: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.primary,
		},
		panelStrong: {
			fontFamily: "sans-bold",
		},
		panelNote: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		panelFooter: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			paddingTop: 2,
		},
		panelRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingVertical: 8,
		},
		panelRowBorder: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
			paddingTop: 8,
		},
		panelLink: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
		},
		panelLinkText: {
			fontFamily: "sans-bold",
			fontSize: 13,
			color: theme.accent,
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
		sectionHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 16,
		},
		sectionTitleInline: {
			marginBottom: 0,
		},
		sectionTitle: {
			fontFamily: "sans-bold",
			fontSize: 14,
			letterSpacing: 1.2,
			color: theme.mutedForeground,
			textTransform: "uppercase",
			marginBottom: 16,
		},
		menuRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
		},
		menuRowPressed: {
			opacity: 0.6,
		},
		// Still used by the Quick Access tiles and the occupancy card.
		menuCellPressed: {
			opacity: 0.8,
			transform: [{ scale: 0.98 }],
		},
	});
