import "react-native-gesture-handler";
import "@/global.css";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { getOnboardingComplete } from "@/features/onboarding/logic/onboarding-storage";
import { BootstrapProvider } from "@/shared/providers/BootstrapProvider";
import { colors } from "@/shared/constants/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
	initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [fontsLoaded, error] = useFonts({
		"sans-regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
		"sans-bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
		"sans-medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
		"sans-semibold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
		"sans-extrabold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
		"sans-light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
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
			<BootstrapProvider onboardingComplete={bootstrap.onboardingComplete}>
				<View style={{ flex: 1, backgroundColor: colors.background }}>
					<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
						<Stack.Screen name="index" />
						<Stack.Screen name="onboarding" />
						<Stack.Screen name="(auth)" />
						<Stack.Screen name="(app)" />
					</Stack>
				</View>
			</BootstrapProvider>
		</GestureHandlerRootView>
	);
}
