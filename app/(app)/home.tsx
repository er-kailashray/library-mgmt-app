import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/shared/constants/theme";

/** Post-login home stub until auth gating is implemented. Route: /home */
export default function AppHomeStub() {
	return (
		<SafeAreaView style={styles.safe}>
			<View style={styles.center}>
				<Text style={styles.title}>Signed-in area (stub)</Text>
				<Text style={styles.subtitle}>This screen will be reachable after session handling is added.</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	title: {
		textAlign: "center",
		fontSize: 22,
		fontWeight: "700",
		color: colors.primary,
	},
	subtitle: {
		marginTop: 8,
		textAlign: "center",
		fontSize: 15,
		fontWeight: "500",
		color: colors.mutedForeground,
	},
});
