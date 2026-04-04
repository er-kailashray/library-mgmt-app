import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthUser } from "@/features/auth/types/auth.types";
import { handleLogout } from "@/features/settings/logic/settings-logic";
import { getStoredAuthUser } from "@/services/api/auth.api";
import { colors } from "@/shared/constants/theme";

export function SettingsScreen() {
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [user, setUser] = useState<AuthUser | null>(null);

	useEffect(() => {
		const loadUser = async () => {
			const storedUser = await getStoredAuthUser();
			setUser(storedUser);
		};
		loadUser();
	}, []);

	const onLogout = useCallback(async () => {
		Alert.alert("Logout", "Are you sure you want to log out?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				style: "destructive",
				onPress: async () => {
					setIsLoggingOut(true);
					try {
						await handleLogout();
					} finally {
						setIsLoggingOut(false);
					}
				},
			},
		]);
	}, []);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.top}>
				<Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()} hitSlop={12}>
					<Ionicons name="chevron-back" size={26} color={colors.primary} />
					<Text style={styles.backText}>Back</Text>
				</Pressable>
			</View>
			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					<Text style={styles.title}>Settings</Text>
					<Text style={styles.subtitle}>Library & account</Text>
				</View>

				{user && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Profile</Text>
						<View style={styles.profileCard}>
							<View style={styles.avatarContainer}>
								<View style={styles.avatarBackground}>
									<Ionicons name="person-outline" size={30} color={colors.background} />
								</View>
							</View>
							<View style={styles.profileContent}>
								<Text style={styles.profileName}>{user.name}</Text>
								<View style={styles.profileDetails}>
									<View style={styles.detailRow}>
										<Ionicons name="call-outline" size={16} color={colors.mutedForeground} />
										<Text style={styles.profileDetail}>{user.phone}</Text>
									</View>
								</View>
							</View>
						</View>
					</View>
				)}

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Account</Text>
					<Pressable accessibilityRole="button" style={[styles.optionButton, isLoggingOut && styles.optionButtonDisabled]} onPress={onLogout} disabled={isLoggingOut}>
						<Ionicons name="log-out-outline" size={20} color={colors.destructive} />
						<Text style={[styles.optionText, styles.logoutText]}>{isLoggingOut ? "Logging out..." : "Logout"}</Text>
					</Pressable>
				</View>
			</ScrollView>
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
	scroll: {
		paddingHorizontal: 24,
		paddingTop: 24,
		paddingBottom: 32,
	},
	header: {
		marginBottom: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: "800",
		color: colors.primary,
	},
	subtitle: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.mutedForeground,
		marginTop: 4,
	},
	section: {
		marginBottom: 32,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: "800",
		letterSpacing: 1,
		color: colors.mutedForeground,
		textTransform: "uppercase",
		marginBottom: 12,
	},
	profileCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.card,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: colors.border,
		padding: 22,
		gap: 18,
	},
	avatarContainer: {
		flexShrink: 0,
	},
	avatarBackground: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	profileContent: {
		flex: 1,
	},
	profileName: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.primary,
		marginBottom: 10,
	},
	profileDetails: {
		gap: 8,
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	profileDetail: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.mutedForeground,
	},
	optionButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.card,
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: colors.border,
		padding: 16,
		gap: 12,
	},
	optionButtonDisabled: {
		opacity: 0.6,
	},
	optionText: {
		flex: 1,
		fontSize: 16,
		fontWeight: "500",
		color: colors.primary,
	},
	logoutText: {
		color: colors.destructive,
	},
});
