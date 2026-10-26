import { View } from "react-native";

import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

// react-native-maps has no web implementation, so the picker is mobile-only.
export function LibraryLocationScreen() {
	const { theme } = useTheme();
	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.text, { color: theme.mutedForeground }]}>Open the Librum mobile app to set your library location on the map.</Text>
		</View>
	);
}

const styles = ScaledSheet.create({
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
