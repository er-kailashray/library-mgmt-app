import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { toMinutes } from "@/features/batches/logic/batch-time";
import { getBatchesApi } from "@/features/batches/logic/batches-api";
import { Batch } from "@/features/batches/types/batches.types";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { getSetupCelebrationState, setSetupCelebrationState, type SetupCelebrationState } from "@/features/home/logic/setup-celebration-storage";
import { refreshUnreadCount } from "@/features/notifications/logic/unread-count";
import { pickProfilePhoto, uploadProfilePhoto } from "@/features/settings/logic/profile-photo";
import { SubscriptionBanner } from "@/features/subscription/ui/SubscriptionBanner";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { showToast } from "@/shared/ui/Toast";

import { CelebrationBurst } from "./CelebrationBurst";
import { DuesCard } from "./DuesCard";
import { HomeHeader } from "./HomeHeader";
import { FadeIn, HomeSkeleton, SectionHeader } from "./HomeSection";
import { LiveBatchCard } from "./LiveBatchCard";
import { MonthHeroCard } from "./MonthHeroCard";
import { OccupancyCard } from "./OccupancyCard";
import { QuickActions } from "./QuickActions";
import { RecentPaymentsCard } from "./RecentPaymentsCard";
import { FirstMemberCard, SetupChecklistCard, SetupCompleteCard, type SetupStep } from "./SetupCards";

/** Gap between Home's sections, and how far apart their entrance animations start. */
const SECTION_GAP = 24;
const STAGGER_MS = 70;

/** The batch running right now, handling ones that run past midnight. */
function currentBatchId(batches: Batch[], now: Date): number | null {
	const minutes = now.getHours() * 60 + now.getMinutes();
	const running = batches.find((b) => {
		const start = toMinutes(b.start_time);
		const end = toMinutes(b.end_time);
		return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
	});
	return running?.id ?? null;
}

export function HomeScreen() {
	const router = useRouter();
	const { theme, isDark } = useTheme();
	const bottomInset = useScreenBottomInset();

	const { data: dashboard, error, refetch: refetchDashboard, setData: setDashboard } = useApiData(getDashboardApi, []);
	const { data: batches, refetch: refetchBatches } = useApiData(getBatchesApi, []);

	// Refresh whenever Home regains focus (e.g. coming back after adding a batch) - Expo Router
	// keeps this screen mounted, so the initial-mount fetch alone would go stale.
	useFocusEffect(
		useCallback(() => {
			void refetchDashboard();
			void refetchBatches();
		}, [refetchDashboard, refetchBatches])
	);

	// Pull to refresh: reloads everything on Home. `refreshCount` also tells the parts that load
	// their own data (a past month on the hero card, the plan banner) to reload.
	const [refreshCount, setRefreshCount] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		setRefreshCount((count) => count + 1);
		await Promise.all([refetchDashboard(), refetchBatches(), refreshUnreadCount()]);
		setIsRefreshing(false);
	}, [refetchDashboard, refetchBatches]);

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
			showToast({ message: err.message || "Failed to upload photo.", tone: "error" });
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

	const liveBatchId = batches ? currentBatchId(batches, new Date()) : null;
	const showInsights = dashboard !== null && !isNewLibrary;

	// Each section fades in a beat after the one above it, on first load only.
	let order = 0;
	const next = () => order++ * STAGGER_MS;

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<StatusBar style={isDark ? "light" : "dark"} />
				<HomeHeader
					libraryName={dashboard?.library_name}
					libraryAddress={dashboard?.library_address}
					ownerName={dashboard?.owner_name}
					ownerPhoto={dashboard?.owner_photo}
					onPressLocation={() => router.push("/library-location")}
					onPressProfile={() => router.push("/settings")}
				/>

				<ScrollView
					contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 32 }]}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.accent} colors={[theme.accent]} />}>
					<SubscriptionBanner refreshSignal={refreshCount} />

					{!dashboard && (error ? <ErrorState message={error} onRetry={refetchDashboard} /> : <HomeSkeleton />)}

					{dashboard && (
						<View style={styles.sections}>
							{showSetupCard && (
								<FadeIn delay={next()}>
									<SetupChecklistCard steps={setupSteps} />
								</FadeIn>
							)}

							{showSetupComplete && <SetupCompleteCard steps={setupSteps} onDismiss={dismissSetupComplete} />}

							{/* Comes after setup and its congratulations; members need a batch to sit in. */}
							{showFirstMemberCard && (
								<FadeIn delay={next()}>
									<FirstMemberCard onAdd={() => router.push("/admission")} />
								</FadeIn>
							)}

							{showInsights && (
								<FadeIn delay={next()}>
									<MonthHeroCard dashboard={dashboard} refreshSignal={refreshCount} onOpenPayments={() => router.push("/payments")} />
								</FadeIn>
							)}

							{/* Before batches exist the setup card is the only thing to do. */}
							{hasBatches && (
								<FadeIn delay={next()}>
									<QuickActions />
								</FadeIn>
							)}

							{showInsights && batches && batches.length > 0 && (
								<FadeIn delay={next()}>
									<SectionHeader title="Today" />
									<LiveBatchCard batches={batches} occupancy={dashboard.batch_occupancy} onPress={() => router.push("/attendance")} />
								</FadeIn>
							)}

							{showInsights && (
								<FadeIn delay={next()}>
									<SectionHeader
										title="Needs attention"
										linkLabel={dashboard.due_members_count > 0 ? "All dues" : undefined}
										onLink={() => router.push({ pathname: "/payments", params: { tab: "due" } })}
									/>
									<DuesCard dashboard={dashboard} />
								</FadeIn>
							)}

							{showInsights && dashboard.batch_occupancy.length > 0 && (
								<FadeIn delay={next()}>
									<SectionHeader title="Seats by batch" />
									<OccupancyCard occupancy={dashboard.batch_occupancy} currentBatchId={liveBatchId} onOpenSeats={() => router.push("/seats")} />
								</FadeIn>
							)}

							{showInsights && (
								<FadeIn delay={next()}>
									<SectionHeader
										title="Recent payments"
										linkLabel={dashboard.recent_payments.length > 0 ? "See all" : undefined}
										onLink={() => router.push("/payments")}
									/>
									<RecentPaymentsCard payments={dashboard.recent_payments} />
								</FadeIn>
							)}
						</View>
					)}
				</ScrollView>
			</SafeAreaView>
			{/* Flowers fall over the whole screen once, when setup is first complete. */}
			{showSetupComplete && <CelebrationBurst />}
		</ScreenBackground>
	);
}

const styles = ScaledSheet.create({
	// Transparent so the gradient behind shows through the header.
	safe: {
		flex: 1,
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	sections: {
		gap: SECTION_GAP,
	},
});
