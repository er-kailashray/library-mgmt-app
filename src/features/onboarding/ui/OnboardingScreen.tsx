import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
import { useTheme } from "@/shared/providers/ThemeProvider";

type Slide = {
	key: string;
	icon: ComponentProps<typeof Ionicons>["name"];
	iconBg: string;
	title: string;
	body: string;
};

export function OnboardingScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const { width } = useWindowDimensions();
	const listRef = useRef<FlatList<Slide>>(null);
	const [index, setIndex] = useState(0);
	const last = index === 3 - 1; // Assuming 3 slides

	const SLIDES: Slide[] = [
		{
			key: "1",
			icon: "library-outline",
			iconBg: theme.accent,
			title: "Welcome to Librum",
			body: "Run your library from one calm place—balances, renewals, and members at a glance.",
		},
		{
			key: "2",
			icon: "people-outline",
			iconBg: theme.subscription,
			title: "Built for desks & shelves",
			body: "Track who borrows what, stay ahead of due dates, and keep your desk uncluttered.",
		},
		{
			key: "3",
			icon: "sparkles-outline",
			iconBg: theme.accent,
			title: "Ready when you are",
			body: "Sign in with your phone to sync, or create a new library in a few taps.",
		},
	];

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
	}, [width, SLIDES.length]);

	const goNext = useCallback(() => {
		if (index === SLIDES.length - 1) {
			void finish();
			return;
		}
		listRef.current?.scrollToIndex({ index: index + 1, animated: true });
	}, [finish, index, SLIDES.length]);

	const styles = createStyles(theme);

	const renderItem = useCallback(
		({ item }: ListRenderItemInfo<Slide>) => (
			<View style={[styles.page, { width }]}>
				<View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
					<Ionicons name={item.icon} size={44} color="#fff" />
				</View>
				<Text style={styles.title}>{item.title}</Text>
				<Text style={styles.body}>{item.body}</Text>
			</View>
		),
		[width, styles],
	);

	return (
		<SafeAreaView style={styles.safe}>
			<StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
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
					<Text style={styles.primaryBtnText}>{index === SLIDES.length - 1 ? "Get started" : "Next"}</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: theme.background,
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
		backgroundColor: theme.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	brandLetter: {
		fontFamily: "sans-extrabold",
		fontSize: 20,
		color: "#fff",
	},
	brandName: {
		fontFamily: "sans-extrabold",
		fontSize: 22,
		color: theme.primary,
	},
	skip: {
		fontFamily: "sans-bold",
		fontSize: 15,
		color: theme.accent,
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
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.1,
		shadowRadius: 16,
		elevation: 4,
	},
	title: {
		fontFamily: "sans-extrabold",
		fontSize: 26,
		color: theme.primary,
		textAlign: "center",
		marginBottom: 12,
	},
	body: {
		fontFamily: "sans-medium",
		fontSize: 16,
		lineHeight: 24,
		color: theme.mutedForeground,
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
		backgroundColor: theme.muted,
	},
	dotActive: {
		width: 22,
		backgroundColor: theme.accent,
	},
	primaryBtn: {
		alignItems: "center",
		borderRadius: 16,
		backgroundColor: theme.accent,
		paddingVertical: 18,
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.2,
		shadowRadius: 10,
		elevation: 4,
	},
	primaryBtnText: {
		fontFamily: "sans-extrabold",
		fontSize: 17,
		color: "#fff",
	},
});
