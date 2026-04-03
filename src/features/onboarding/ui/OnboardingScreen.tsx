import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useRef, useState } from "react";
import {
	FlatList,
	ListRenderItemInfo,
	NativeScrollEvent,
	NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setOnboardingComplete } from "@/features/onboarding/logic/onboarding-storage";
import { colors } from "@/shared/constants/theme";

type Slide = {
	key: string;
	icon: ComponentProps<typeof Ionicons>["name"];
	iconBg: string;
	title: string;
	body: string;
};

const SLIDES: Slide[] = [
	{
		key: "1",
		icon: "library-outline",
		iconBg: colors.accent,
		title: "Welcome to Librum",
		body: "Run your library from one calm place—balances, renewals, and members at a glance.",
	},
	{
		key: "2",
		icon: "people-outline",
		iconBg: colors.subscription,
		title: "Built for desks & shelves",
		body: "Track who borrows what, stay ahead of due dates, and keep your desk uncluttered.",
	},
	{
		key: "3",
		icon: "sparkles-outline",
		iconBg: colors.accent,
		title: "Ready when you are",
		body: "Sign in with your phone to sync, or create a new library in a few taps.",
	},
];

export function OnboardingScreen() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const listRef = useRef<FlatList<Slide>>(null);
	const [index, setIndex] = useState(0);
	const last = index === SLIDES.length - 1;

	const finish = useCallback(async () => {
		await setOnboardingComplete();
		router.replace("/login");
	}, [router]);

	const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const x = e.nativeEvent.contentOffset.x;
		const next = Math.round(x / width);
		if (next >= 0 && next < SLIDES.length) {
			setIndex(next);
		}
	}, [width]);

	const goNext = useCallback(() => {
		if (last) {
			void finish();
			return;
		}
		listRef.current?.scrollToIndex({ index: index + 1, animated: true });
	}, [finish, index, last]);

	const renderItem = useCallback(
		({ item }: ListRenderItemInfo<Slide>) => (
			<View style={[styles.page, { width }]}>
				<View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
					<Ionicons name={item.icon} size={44} color={colors.primary} />
				</View>
				<Text style={styles.title}>{item.title}</Text>
				<Text style={styles.body}>{item.body}</Text>
			</View>
		),
		[width],
	);

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar style="dark" />
			<View style={styles.topBar}>
				<View style={styles.brandRow}>
					<View style={styles.brandMark}>
						<Text style={styles.brandLetter}>L</Text>
					</View>
					<Text style={styles.brandName}>Librum</Text>
				</View>
				<Pressable accessibilityRole="button" onPress={() => void finish()} hitSlop={12}>
					<Text style={styles.skip}>Skip</Text>
				</Pressable>
			</View>

			<FlatList
				ref={listRef}
				style={styles.list}
				data={SLIDES}
				keyExtractor={(item) => item.key}
				renderItem={renderItem}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={onScroll}
				onScrollToIndexFailed={({ index: i }) => {
					setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: false }), 100);
				}}
				getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
			/>

			<View style={styles.footer}>
				<View style={styles.dots}>
					{SLIDES.map((s, i) => (
						<View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
					))}
				</View>
				<Pressable accessibilityRole="button" style={styles.primaryBtn} onPress={goNext}>
					<Text style={styles.primaryBtnText}>{last ? "Get started" : "Next"}</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	list: {
		flex: 1,
	},
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingTop: 8,
		paddingBottom: 16,
	},
	brandRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	brandMark: {
		width: 40,
		height: 40,
		borderRadius: 14,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	brandLetter: {
		fontSize: 20,
		fontWeight: "800",
		color: colors.background,
	},
	brandName: {
		fontSize: 22,
		fontWeight: "800",
		color: colors.primary,
	},
	skip: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.accent,
	},
	page: {
		flex: 1,
		paddingHorizontal: 28,
		paddingTop: 24,
		alignItems: "center",
	},
	iconWrap: {
		width: 112,
		height: 112,
		borderRadius: 36,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 28,
	},
	title: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.primary,
		textAlign: "center",
		marginBottom: 12,
	},
	body: {
		fontSize: 16,
		fontWeight: "500",
		lineHeight: 24,
		color: colors.mutedForeground,
		textAlign: "center",
		maxWidth: 320,
	},
	footer: {
		paddingHorizontal: 20,
		paddingBottom: 24,
		paddingTop: 8,
		gap: 20,
	},
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 8,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "rgba(8, 17, 38, 0.15)",
	},
	dotActive: {
		width: 22,
		backgroundColor: colors.accent,
	},
	primaryBtn: {
		alignItems: "center",
		borderRadius: 16,
		backgroundColor: colors.accent,
		paddingVertical: 16,
	},
	primaryBtnText: {
		fontSize: 17,
		fontWeight: "800",
		color: colors.primary,
	},
});
