import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/shared/constants/theme";

/** Placeholder until register flow is implemented. */
export default function RegisterRoute() {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.safe}>
			<View style={styles.content}>
				<Text style={styles.title}>Register</Text>
				<Text style={styles.subtitle}>Registration will be added in a later milestone.</Text>
				<Pressable accessibilityRole="button" style={styles.button} onPress={() => router.back()}>
					<Text style={styles.buttonText}>Back to login</Text>
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
	content: {
		flexGrow: 1,
		paddingHorizontal: 20,
		paddingBottom: 40,
		paddingTop: 32,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: colors.primary,
	},
	subtitle: {
		marginTop: 8,
		maxWidth: 320,
		fontSize: 16,
		fontWeight: "500",
		color: colors.mutedForeground,
	},
	button: {
		marginTop: 32,
		alignItems: "center",
		borderRadius: 16,
		backgroundColor: colors.accent,
		paddingVertical: 16,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.primary,
	},
});
