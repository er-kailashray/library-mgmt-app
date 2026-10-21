import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/shared/providers/ThemeProvider";

// react-native-maps has no web implementation, so the picker is mobile-only.
export function LibraryLocationScreen() {
	const { theme } = useTheme();
	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.text, { color: theme.mutedForeground }]}>Open the Librum mobile app to set your library location on the map.</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	text: {
		fontFamily: "sans-medium",
		fontSize: 15,
		textAlign: "center",
	},
});
