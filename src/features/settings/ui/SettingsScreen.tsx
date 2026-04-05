import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthUser } from "@/features/auth/types/auth.types";
import { MOCK_LIBRARY_NAME } from "@/features/home/logic/home-flags";
import { handleLogout } from "@/features/settings/logic/settings-logic";
import { getStoredAuthUser } from "@/services/api/auth.api";
import { colors } from "@/shared/constants/theme";

// Schema for modular menu system additions
interface SettingsItem {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
	destructive?: boolean;
}

interface SettingsGroup {
	title: string;
	items: SettingsItem[];
}

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

	// Add more items or groups dynamically as the app scales
	const SETTINGS_GROUPS: SettingsGroup[] = [
		{
			title: "Library Setup",
			items: [
				{
					icon: "business-outline",
					label: "Edit Library Name & Seats",
					onPress: () => Alert.alert("Library Profile", "Coming soon!"),
				},
				{
					icon: "images-outline",
					label: "Manage Photos",
					onPress: () => Alert.alert("Gallery", "Coming soon!"),
				},
				{
					icon: "star-outline",
					label: "Amenities (AC, Wi-Fi, Water)",
					onPress: () => Alert.alert("Amenities", "Coming soon!"),
				},
			],
		},
		{
			title: "Account Options",
			items: [
				{
					icon: "call-outline",
					label: "Update Contact Numbers",
					onPress: () => Alert.alert("Contact Info", "Coming soon!"),
				},
				{
					icon: "log-out-outline",
					label: isLoggingOut ? "Logging out..." : "Logout",
					onPress: onLogout,
					destructive: true,
				},
			],
		},
	];

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.headerWrapper}>
				<View style={styles.header}>
					<Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={colors.primary} />
					</Pressable>
					<View style={styles.headerText}>
						<Text style={styles.headerTitle}>Settings</Text>
						<Text style={styles.headerSubtitle}>Library & account preferences</Text>
					</View>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

				{/* CENTERED PROFILE HEADER */}
				<View style={styles.profileCenterBlock}>
					<View style={styles.avatarHugeBackground}>
						<Ionicons name="library" size={54} color={colors.background} />
					</View>

					{/* Handling large library names cleanly with center text align */}
					<Text style={styles.libraryHugeName}>{MOCK_LIBRARY_NAME || "My Library"}</Text>

					{user && (
						<Text style={styles.ownerSubtitle}>
							{user.name} • {user.phone}
						</Text>
					)}
				</View>

				{SETTINGS_GROUPS.map((group, gIndex) => (
					<View key={`group-${gIndex}`} style={styles.section}>
						<Text style={styles.sectionTitle}>{group.title}</Text>
						<View style={styles.groupCard}>
							{group.items.map((item, iIndex) => (
								<Pressable
									key={`item-${gIndex}-${iIndex}`}
									accessibilityRole="button"
									style={({ pressed }) => [
										styles.optionRow,
										pressed && styles.optionRowPressed,
										iIndex !== group.items.length - 1 && styles.optionRowBorder,
									]}
									onPress={item.onPress}
									disabled={isLoggingOut && item.destructive}>
									<View style={[styles.iconCircle, item.destructive && styles.iconCircleDestructive]}>
										<Ionicons
											name={item.icon}
											size={20}
											color={item.destructive ? colors.destructive : colors.primary}
										/>
									</View>
									<Text style={[styles.optionText, item.destructive && styles.logoutText]}>
										{item.label}
									</Text>
									<Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
								</Pressable>
							))}
						</View>
					</View>
				))}

				<View style={styles.footerBlock}>
					<Text style={styles.footerText}>Powered by Kailash Ray</Text>
					<Text style={styles.versionText}>v1.0.0</Text>
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
	headerWrapper: {
		backgroundColor: colors.background,
		paddingTop: 8,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
		zIndex: 10,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingBottom: 16,
		gap: 16,
	},
	headerText: {
		flex: 1,
	},
	headerTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 22,
		color: colors.primary,
		marginBottom: 2,
	},
	headerSubtitle: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: colors.mutedForeground,
	},
	headerActionCircle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 40,
	},
	profileCenterBlock: {
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 40,
		paddingHorizontal: 16,
	},
	avatarHugeBackground: {
		width: 110,
		height: 110,
		borderRadius: 55,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 20,
		shadowColor: colors.accent,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 16,
		elevation: 8,
	},
	libraryHugeName: {
		fontFamily: "sans-extrabold",
		fontSize: 28,
		color: colors.primary,
		textAlign: "center",
		lineHeight: 34,
		marginBottom: 8,
	},
	ownerSubtitle: {
		fontFamily: "sans-bold",
		fontSize: 15,
		color: colors.mutedForeground,
		textAlign: "center",
	},
	section: {
		marginBottom: 32,
	},
	sectionTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 14,
		textTransform: "uppercase",
		letterSpacing: 1,
		color: colors.mutedForeground,
		marginBottom: 16,
		marginLeft: 4,
	},
	groupCard: {
		backgroundColor: colors.card,
		borderRadius: 20,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 20,
		elevation: 4,
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: 18,
		backgroundColor: colors.card,
	},
	optionRowPressed: {
		backgroundColor: "rgba(0,0,0,0.03)",
	},
	optionRowBorder: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	iconCircle: {
		width: 40,
		height: 40,
		borderRadius: 12,
		backgroundColor: colors.muted,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	iconCircleDestructive: {
		backgroundColor: colors.destructive + "1A",
	},
	optionText: {
		flex: 1,
		fontFamily: "sans-semibold",
		fontSize: 16,
		color: colors.primary,
	},
	logoutText: {
		color: colors.destructive,
	},
	footerBlock: {
		alignItems: "center",
		marginTop: 20,
		marginBottom: 20,
	},
	footerText: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: colors.mutedForeground,
		marginBottom: 4,
	},
	versionText: {
		fontFamily: "sans-bold",
		fontSize: 12,
		color: "rgba(0,0,0,0.25)",
	},
});
