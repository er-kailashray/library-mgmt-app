import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/shared/constants/theme";

type Props = {
	title: string;
	subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle = "This section will be wired to your library data soon." }: Props) {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.top}>
				<Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()} hitSlop={12}>
					<Ionicons name="chevron-back" size={26} color={colors.primary} />
					<Text style={styles.backText}>Back</Text>
				</Pressable>
			</View>
			<View style={styles.body}>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.subtitle}>{subtitle}</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	top: {
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	back: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		paddingVertical: 8,
		paddingHorizontal: 8,
		gap: 4,
	},
	backText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.primary,
	},
	body: {
		flex: 1,
		paddingHorizontal: 24,
		paddingTop: 24,
	},
	title: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.primary,
	},
	subtitle: {
		marginTop: 12,
		fontSize: 16,
		fontWeight: "500",
		color: colors.mutedForeground,
		lineHeight: 24,
	},
});
