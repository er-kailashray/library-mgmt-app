import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useLayoutEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { getOnboardingComplete } from "@/features/onboarding/logic/onboarding-storage";
import { BootstrapProvider } from "@/shared/providers/BootstrapProvider";
import { ThemeProvider, useTheme } from "@/shared/providers/ThemeProvider";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
	initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

// Android (and some iOS accessibility settings) can scale text well past what this app's
// compact grids/badges were designed for. Cap it rather than disable scaling outright, so
// the UI stays usable for users with larger system text settings without breaking layout.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.2;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.2;

export default function RootLayout() {
	const [fontsLoaded, error] = useFonts({
		"sans-regular": require("../assets/fonts/Inter-Regular.ttf"),
		"sans-bold": require("../assets/fonts/Inter-Bold.ttf"),
		"sans-medium": require("../assets/fonts/Inter-Medium.ttf"),
		"sans-semibold": require("../assets/fonts/Inter-SemiBold.ttf"),
		"sans-extrabold": require("../assets/fonts/Inter-ExtraBold.ttf"),
		"sans-light": require("../assets/fonts/Inter-Light.ttf"),
	});

	const [bootstrap, setBootstrap] = useState<{ done: boolean; onboardingComplete: boolean } | null>(null);

	useEffect(() => {
		if (error) throw error;
	}, [error]);

	useEffect(() => {
		if (!fontsLoaded) return;

		let cancelled = false;
		(async () => {
			try {
				const onboardingComplete = await getOnboardingComplete();
				if (!cancelled) {
					setBootstrap({ done: true, onboardingComplete });
				}
			} catch {
				if (!cancelled) {
					setBootstrap({ done: true, onboardingComplete: false });
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [fontsLoaded]);

	useLayoutEffect(() => {
		if (bootstrap?.done) {
			void SplashScreen.hideAsync();
		}
	}, [bootstrap?.done]);

	if (!fontsLoaded || !bootstrap?.done) {
		return null;
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ThemeProvider>
				<RootContent onboardingComplete={bootstrap.onboardingComplete} />
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}

function RootContent({ onboardingComplete }: { onboardingComplete: boolean }) {
	const { theme } = useTheme();

	return (
		<BootstrapProvider onboardingComplete={onboardingComplete}>
			<View style={{ flex: 1, backgroundColor: theme.background }}>
				<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
					<Stack.Screen name="index" />
					<Stack.Screen name="onboarding" />
					<Stack.Screen name="(auth)" />
					<Stack.Screen name="(app)" />
				</Stack>
			</View>
		</BootstrapProvider>
	);
}
