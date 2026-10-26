import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";

import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";

/**
 * App-wide page backdrop: a coral wash at the top that fades into the page
 * background. Screens render inside it and keep their own
 * root/header surfaces transparent so the gradient shows through.
 */
export function ScreenBackground({ children }: { children: ReactNode }) {
	const { theme, isDark } = useTheme();
	const { height } = useWindowDimensions();

	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			<LinearGradient
				pointerEvents="none"
				colors={[theme.accent + (isDark ? "59" : "40"), theme.accent + "00"]}
				style={[styles.gradient, { height: height * 0.25 }]}
			/>
			{children}
		</View>
	);
}

const styles = ScaledSheet.create({
	root: {
		flex: 1,
	},
	gradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
});
