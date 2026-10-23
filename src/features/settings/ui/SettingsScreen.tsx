import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthUser } from "@/features/auth/types/auth.types";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { getSubscriptionApi, subscriptionChipLabel } from "@/features/subscription/logic/subscription-api";
import { pickProfilePhoto, uploadProfilePhoto } from "@/features/settings/logic/profile-photo";
import { handleLogout } from "@/features/settings/logic/settings-logic";
import { getMeApi, getStoredAuthUser, updateProfileApi, updateStoredAuthUser } from "@/services/api/auth.api";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { getInitials } from "@/shared/utils/text";

interface SettingsItem {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
	destructive?: boolean;
	/** Short status shown before the chevron, e.g. "Trial · 12 days left". */
	badge?: { text: string; color: string };
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
	const { data: subscription, refetch: refetchSubscription } = useApiData(getSubscriptionApi, []);

	// Pick up a plan change when coming back from the Subscription screen.
	useFocusEffect(
		useCallback(() => {
			void refetchSubscription();
		}, [refetchSubscription])
	);

	const subscriptionColor = subscription
		? { trial: theme.accent, active: theme.success, grace: theme.warning, expired: theme.destructive }[subscription.state]
		: theme.mutedForeground;

	useEffect(() => {
		const loadUser = async () => {
			setUser(await getStoredAuthUser());
			// The cached copy can be stale (e.g. photo URL), so refresh it from the server.
			try {
				const freshUser = await getMeApi();
				await updateStoredAuthUser(freshUser);
				setUser(freshUser);
			} catch {
				// Offline or token issue - keep showing the cached user.
			}
		};
		void loadUser();
	}, []);

	const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
	const [editProfileName, setEditProfileName] = useState("");
	const [editProfilePhone, setEditProfilePhone] = useState("");
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

	const handleChangePhoto = useCallback(async () => {
		const uri = await pickProfilePhoto();
		if (!uri) return;
		try {
			setIsUploadingPhoto(true);
			setUser(await uploadProfilePhoto(uri));
		} catch (err: any) {
			Alert.alert("Error", err.message || "Failed to upload photo.");
		} finally {
			setIsUploadingPhoto(false);
		}
	}, []);

	const openEditProfile = useCallback(() => {
		if (!user) return;
		setEditProfileName(user.name);
		setEditProfilePhone(user.phone);
		setIsEditProfileVisible(true);
	}, [user]);

	const handleSaveProfile = useCallback(async () => {
		if (!editProfileName.trim()) {
			Alert.alert("Error", "Please enter your name.");
			return;
		}
		if (editProfilePhone.trim().length < 10) {
			Alert.alert("Error", "Please enter a valid 10-digit phone number.");
			return;
		}
		try {
			setIsSavingProfile(true);
			const response = await updateProfileApi({ name: editProfileName.trim(), phone: editProfilePhone.trim() });
			await updateStoredAuthUser(response.user);
			setUser(response.user);
			setIsEditProfileVisible(false);
		} catch (err: any) {
			Alert.alert("Error", err.message || "Failed to update profile.");
		} finally {
			setIsSavingProfile(false);
		}
	}, [editProfileName, editProfilePhone]);

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
			title: "Subscription",
			items: [
				{
					icon: "diamond-outline",
					label: "Plan & Billing",
					onPress: () => router.push("/subscription"),
					badge: subscription ? { text: subscriptionChipLabel(subscription), color: subscriptionColor } : undefined,
				},
			],
		},
		{
			title: "Library Setup",
			items: [
				{
					icon: "business-outline",
					label: "Edit Library Name & Seats",
					onPress: () => router.push("/library-profile"),
				},
				{
					icon: "location-outline",
					label: "Library Location",
					onPress: () => router.push("/library-location"),
				},
				{
					icon: "images-outline",
					label: "Manage Photos",
					onPress: () => router.push("/library-photos"),
				},
				{
					icon: "star-outline",
					label: "Amenities (AC, Wi-Fi, Water)",
					onPress: () => router.push("/library-amenities"),
				},
			],
		},
		{
			title: "Account Options",
			items: [
				{
					icon: "person-circle-outline",
					label: "Edit Profile (Name & Number)",
					onPress: openEditProfile,
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
					<Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={handleChangePhoto} disabled={isUploadingPhoto} style={styles.avatarHugeWrap}>
						<View style={styles.avatarHugeBackground}>
							{user?.profile_photo_url ? (
								<Image source={{ uri: user.profile_photo_url }} style={styles.avatarHugeImage} />
							) : (
								<Text style={styles.avatarHugeText}>{getInitials(user?.name || "")}</Text>
							)}
							{isUploadingPhoto && (
								<View style={styles.avatarHugeOverlay}>
									<ActivityIndicator color="#fff" />
								</View>
							)}
						</View>
						<View style={styles.avatarCameraBadge}>
							<Ionicons name="camera" size={16} color={theme.background} />
						</View>
					</Pressable>
					<Text style={styles.libraryHugeName}>{dashboard?.library_name || "My Library"}</Text>
					{user && (
						<View style={styles.ownerInfoRow}>
							<View style={styles.ownerInfoPill}>
								<Ionicons name="person-outline" size={14} color={theme.mutedForeground} />
								<Text style={styles.ownerInfoText}>{user.name}</Text>
							</View>
							<View style={styles.ownerInfoPill}>
								<Ionicons name="call-outline" size={14} color={theme.mutedForeground} />
								<Text style={styles.ownerInfoText}>{user.phone}</Text>
							</View>
						</View>
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
									{item.badge && (
										<Text style={[styles.optionBadge, { color: item.badge.color, backgroundColor: item.badge.color + "18" }]}>{item.badge.text}</Text>
									)}
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

			<Modal visible={isEditProfileVisible} transparent animationType="slide" onRequestClose={() => setIsEditProfileVisible(false)}>
				<Pressable style={styles.editModalOverlay} onPress={() => setIsEditProfileVisible(false)} />
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editModalSheetWrap}>
					<View style={styles.editModalSheet}>
						<Text style={styles.editModalTitle}>Edit Profile</Text>

						<Text style={styles.inputLabel}>Your Name</Text>
						<TextInput
							style={styles.inputField}
							value={editProfileName}
							onChangeText={setEditProfileName}
							autoCapitalize="words"
							placeholder="e.g. Asha Owner"
							placeholderTextColor={theme.mutedForeground + "80"}
						/>

						<Text style={styles.inputLabel}>Phone Number</Text>
						<TextInput
							style={styles.inputField}
							value={editProfilePhone}
							onChangeText={setEditProfilePhone}
							keyboardType="phone-pad"
							maxLength={15}
							placeholder="10-digit mobile number"
							placeholderTextColor={theme.mutedForeground + "80"}
						/>
						<Text style={styles.inputHint}>This is the number you use to log in.</Text>

						<Pressable style={[styles.editSaveBtn, isSavingProfile && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={isSavingProfile}>
							{isSavingProfile ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Changes</Text>}
						</Pressable>
					</View>
				</KeyboardAvoidingView>
			</Modal>
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
	// iOS shadow lives on the wrapper because overflow: "hidden" (needed to clip the photo) would clip it.
	avatarHugeWrap: {
		marginBottom: 20,
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 16,
	},
	avatarHugeBackground: {
		width: 110,
		height: 110,
		borderRadius: 55,
		backgroundColor: theme.accent,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		elevation: 8,
	},
	avatarHugeImage: {
		width: "100%",
		height: "100%",
	},
	avatarHugeOverlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: "rgba(0,0,0,0.4)",
		alignItems: "center",
		justifyContent: "center",
	},
	avatarCameraBadge: {
		position: "absolute",
		right: 2,
		bottom: 2,
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: theme.primary,
		borderWidth: 2,
		borderColor: theme.background,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarHugeText: {
		fontFamily: "sans-extrabold",
		fontSize: 36,
		color: "#fff",
	},
	libraryHugeName: {
		fontFamily: "sans-extrabold",
		fontSize: 28,
		color: theme.primary,
		textAlign: "center",
		lineHeight: 34,
		marginBottom: 12,
	},
	ownerInfoRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 10,
	},
	ownerInfoPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: theme.card,
		borderWidth: 1,
		borderColor: theme.border,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	ownerInfoText: {
		fontFamily: "sans-bold",
		fontSize: 13,
		color: theme.mutedForeground,
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
		borderRadius: RADIUS.md,
		overflow: "hidden",
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
		borderRadius: RADIUS.sm,
		padding: 3, // Reduced padding
		gap: 2, // Reduced gap
		borderWidth: 1,
		borderColor: theme.border,
	},
	segment: {
		paddingHorizontal: 10, // Reduced padding
		paddingVertical: 6, // Reduced padding
		borderRadius: RADIUS.sm,
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
		borderRadius: RADIUS.sm,
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
		flex: 1,
		fontFamily: "sans-bold",
		fontSize: 15,
		color: theme.primary,
	},
	optionBadge: {
		fontFamily: "sans-bold",
		fontSize: 11,
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 10,
		overflow: "hidden",
		marginRight: 6,
	},
	logoutText: {
		color: theme.destructive,
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
	editModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	editModalSheetWrap: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
	},
	editModalSheet: {
		backgroundColor: theme.background,
		borderTopLeftRadius: RADIUS.lg,
		borderTopRightRadius: RADIUS.lg,
		padding: 24,
		paddingBottom: 32,
	},
	editModalTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 18,
		color: theme.primary,
		marginBottom: 20,
	},
	inputLabel: {
		fontFamily: "sans-bold",
		fontSize: 13,
		color: theme.primary,
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	inputField: {
		fontFamily: "sans-medium",
		backgroundColor: theme.card,
		borderWidth: 1,
		borderColor: theme.border,
		borderRadius: RADIUS.md,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 15,
		color: theme.primary,
		marginBottom: 16,
	},
	inputHint: {
		fontFamily: "sans-medium",
		fontSize: 12,
		color: theme.mutedForeground,
		marginTop: -10,
		marginBottom: 16,
	},
	editSaveBtn: {
		backgroundColor: theme.accent,
		borderRadius: RADIUS.md,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: 8,
	},
	editSaveBtnText: {
		fontFamily: "sans-extrabold",
		fontSize: 15,
		color: "#fff",
	},
});
