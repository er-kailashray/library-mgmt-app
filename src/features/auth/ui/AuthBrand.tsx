import { Image, StyleSheet, Text, View } from "react-native";

import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";

/** Logo with the wordmark and tagline beside it, shared by the login and register screens. */
export function AuthBrand() {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	return (
		<View style={styles.logoWrap}>
			<Image source={require("@/assets/images/logo.png")} style={styles.logoMark} />
			<View>
				<Text style={styles.wordmark}>Librum</Text>
				<Text style={styles.wordmarkSub}>Smarter library management</Text>
			</View>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	StyleSheet.create({
		logoWrap: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		logoMark: {
			width: 56,
			height: 56,
		},
		wordmark: {
			fontFamily: "sans-extrabold",
			fontSize: 28,
			color: theme.primary,
			letterSpacing: -0.5,
		},
		wordmarkSub: {
			fontFamily: "sans-medium",
			fontSize: 15,
			color: theme.mutedForeground,
			marginTop: -2,
		},
	});
