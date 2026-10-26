import { Image, type ImageSource } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent, Pressable, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setOnboardingComplete } from "@/features/onboarding/logic/onboarding-storage";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { Text } from "@/shared/ui/Text";

type Slide = {
	key: string;
	image: ImageSource | number;
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
			image: require("@/assets/images/onboarding/welcome.png"),
			title: "Welcome to Librum",
			body: "Members, seats and fee dues for your whole library, all in one calm place.",
		},
		{
			key: "2",
			image: require("@/assets/images/onboarding/desk.png"),
			title: "Every seat, every batch",
			body: "See who sits where in each batch, and send a reminder before a fee falls due.",
		},
		{
			key: "3",
			image: require("@/assets/images/onboarding/ready.png"),
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
				<View style={styles.illustrationWrap}>
					<Image source={item.image} style={styles.illustration} contentFit="contain" />
				</View>
				<Text style={styles.title}>{item.title}</Text>
				<Text style={styles.body}>{item.body}</Text>
			</View>
		),
		[width, styles],
	);

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe}>
				<View style={styles.topBar}>
					<View style={styles.brandRow}>
						<Image source={require("@/assets/images/logo.png")} style={styles.brandMark} />
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
		</ScreenBackground>
	);
}

const createStyles = (theme: any) => ScaledSheet.create({
	// Transparent so the gradient behind shows through.
	safe: {
		flex: 1,
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
		paddingBottom: 12,
		alignItems: "center",
	},
	// Takes the space above the copy so the illustration sits centred in it.
	illustrationWrap: {
		flex: 1,
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	illustration: {
		width: "100%",
		maxWidth: 440,
		maxHeight: "100%",
		aspectRatio: 5 / 4,
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
		borderRadius: RADIUS.md,
		backgroundColor: theme.accent,
		paddingVertical: 18,
	},
	primaryBtnText: {
		...BUTTON_TEXT,
		color: "#fff",
	},
});
