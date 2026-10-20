import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthUser } from "@/features/auth/types/auth.types";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { handleLogout } from "@/features/settings/logic/settings-logic";
import { getStoredAuthUser } from "@/services/api/auth.api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";

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
	const { theme, mode, setMode } = useTheme();
	const insets = useSafeAreaInsets();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [user, setUser] = useState<AuthUser | null>(null);
	const { data: dashboard } = useApiData(getDashboardApi, []);

	useEffect(() => {
		const loadUser = async () => {
			const storedUser = await getStoredAuthUser();
			setUser(storedUser);
		};
		void loadUser();
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

	const styles = createStyles(theme);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<View style={styles.headerWrapper}>
				<View style={styles.header}>
					<Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={theme.primary} />
					</Pressable>
					<View style={styles.headerText}>
						<Text style={styles.headerTitle}>Settings</Text>
						<Text style={styles.headerSubtitle}>Library & account preferences</Text>
					</View>
				</View>
			</View>

			<ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
				<View style={styles.profileCenterBlock}>
					<View style={styles.avatarHugeBackground}>
						<Ionicons name="library" size={54} color="#fff" />
					</View>
					<Text style={styles.libraryHugeName}>{dashboard?.library_name || "My Library"}</Text>
					{user && (
						<Text style={styles.ownerSubtitle}>
							{user.name} • {user.phone}
						</Text>
					)}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>App Preferences</Text>
					<View style={styles.groupCard}>
						<View style={styles.optionRowNoPress}>
							<View style={styles.iconCircle}>
								<Ionicons name="color-palette-outline" size={20} color={theme.primary} />
							</View>
							<View style={styles.themeToggleContainer}>
								<Text style={styles.optionText}>Theme Mode</Text>
								<View style={styles.segmentControl}>
									{(["system", "light", "dark"] as const).map((m) => (
										<Pressable key={m} onPress={() => setMode(m)} style={[styles.segment, mode === m && styles.segmentActive]}>
											<Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
										</Pressable>
									))}
								</View>
							</View>
						</View>
					</View>
				</View>

				{SETTINGS_GROUPS.map((group, gIndex) => (
					<View key={`group-${gIndex}`} style={styles.section}>
						<Text style={styles.sectionTitle}>{group.title}</Text>
						<View style={styles.groupCard}>
							{group.items.map((item, iIndex) => (
								<Pressable key={`item-${gIndex}-${iIndex}`} accessibilityRole="button" style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed, iIndex !== group.items.length - 1 && styles.optionRowBorder]} onPress={item.onPress} disabled={isLoggingOut && item.destructive}>
									<View style={[styles.iconCircle, item.destructive && styles.iconCircleDestructive]}>
										<Ionicons name={item.icon} size={20} color={item.destructive ? theme.destructive : theme.primary} />
									</View>
									<Text style={[styles.optionText, item.destructive && styles.logoutText]}>{item.label}</Text>
									<Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
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

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: theme.background,
	},
	headerWrapper: {
		backgroundColor: theme.background,
		paddingTop: 8,
		borderBottomWidth: 1,
		borderBottomColor: theme.border,
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
		color: theme.primary,
		marginBottom: 2,
	},
	headerSubtitle: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: theme.mutedForeground,
	},
	headerActionCircle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: theme.card,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1.5,
		borderColor: theme.border,
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
		backgroundColor: theme.accent,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 20,
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 16,
		elevation: 8,
	},
	libraryHugeName: {
		fontFamily: "sans-extrabold",
		fontSize: 28,
		color: theme.primary,
		textAlign: "center",
		lineHeight: 34,
		marginBottom: 8,
	},
	ownerSubtitle: {
		fontFamily: "sans-bold",
		fontSize: 15,
		color: theme.mutedForeground,
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
		color: theme.mutedForeground,
		marginBottom: 16,
		marginLeft: 4,
	},
	groupCard: {
		backgroundColor: theme.card,
		borderRadius: 24,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 20,
		elevation: 4,
		borderWidth: 1.5,
		borderColor: theme.border,
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: 18,
	},
	optionRowNoPress: {
		flexDirection: "row",
		alignItems: "center",
		padding: 18,
	},
	themeToggleContainer: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap", // Allow wrapping if content is too wide
		gap: 8,
	},
	segmentControl: {
		flexDirection: "row",
		backgroundColor: theme.background,
		borderRadius: 14,
		padding: 3, // Reduced padding
		gap: 2, // Reduced gap
		borderWidth: 1,
		borderColor: theme.border,
	},
	segment: {
		paddingHorizontal: 10, // Reduced padding
		paddingVertical: 6, // Reduced padding
		borderRadius: 10,
	},
	segmentActive: {
		backgroundColor: theme.accent,
	},
	segmentText: {
		fontFamily: "sans-bold",
		fontSize: 11, // Slightly smaller text for consistency
		color: theme.mutedForeground,
	},
	segmentTextActive: {
		fontFamily: "sans-extrabold",
		color: "#fff",
	},
	optionRowPressed: {
		backgroundColor: theme.muted + "40",
	},
	optionRowBorder: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: theme.border,
	},
	iconCircle: {
		width: 44,
		height: 44,
		borderRadius: 14,
		backgroundColor: theme.background,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12, // Reduced margin slightly
		borderWidth: 1,
		borderColor: theme.border,
	},
	iconCircleDestructive: {
		backgroundColor: theme.destructive + "15",
		borderColor: theme.destructive + "30",
	},
	optionText: {
		fontFamily: "sans-bold",
		fontSize: 15, // Slightly smaller font for better fit
		color: theme.primary,
		minWidth: 80, // Ensure label doesn't shrink too much
	},
	logoutText: {
		color: theme.destructive,
		flex: 1,
	},
	footerBlock: {
		alignItems: "center",
		marginTop: 20,
		marginBottom: 20,
	},
	footerText: {
		fontFamily: "sans-medium",
		fontSize: 14,
		color: theme.mutedForeground,
		marginBottom: 4,
	},
	versionText: {
		fontFamily: "sans-bold",
		fontSize: 12,
		color: theme.mutedForeground + "80",
	},
});
