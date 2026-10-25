import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { changePasswordApi } from "@/services/api/auth.api";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text } from "@/shared/ui/Text";

const PASSWORD_MIN = 6;

export function ChangePasswordScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		setError(null);
		if (!currentPassword) {
			setError("Please enter your current password.");
			return;
		}
		if (newPassword.length < PASSWORD_MIN) {
			setError(`New password must be at least ${PASSWORD_MIN} characters.`);
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("New passwords do not match.");
			return;
		}
		if (newPassword === currentPassword) {
			setError("New password must be different from the current one.");
			return;
		}

		try {
			setIsSaving(true);
			await changePasswordApi(currentPassword, newPassword);
			Alert.alert("Password changed", "Your password has been updated. Other devices have been signed out.");
			router.back();
		} catch (err: any) {
			setError(err.message || "Failed to change password.");
		} finally {
			setIsSaving(false);
		}
	};

	const styles = createStyles(theme);

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<ScreenHeader title="Change Password" subtitle="Update the password you sign in with" />

				<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
						showsVerticalScrollIndicator={false}
					>
						<View style={styles.card}>
							<View style={styles.field}>
								<Text style={styles.inputLabel}>Current password</Text>
								<PasswordInput placeholder="••••••••" value={currentPassword} onChangeText={setCurrentPassword} />
							</View>
							<View style={styles.field}>
								<Text style={styles.inputLabel}>New password</Text>
								<PasswordInput placeholder="At least 6 characters" value={newPassword} onChangeText={setNewPassword} />
							</View>
							<View style={styles.field}>
								<Text style={styles.inputLabel}>Confirm new password</Text>
								<PasswordInput placeholder="Re-enter the new password" value={confirmPassword} onChangeText={setConfirmPassword} />
							</View>

							{error && (
								<View style={styles.errorBox}>
									<Ionicons name="alert-circle" size={18} color={theme.destructive} />
									<Text style={styles.errorText}>{error}</Text>
								</View>
							)}

							<Pressable accessibilityRole="button" style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
								{isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
							</Pressable>
						</View>

						<Text style={styles.hint}>Forgot your current password? Log out and use "Forgot password?" on the sign-in screen.</Text>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</ScreenBackground>
	);
}

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
	},
	flex: {
		flex: 1,
	},
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 24,
	},
	card: {
		backgroundColor: theme.card,
		borderRadius: RADIUS.md,
		padding: 20,
		borderWidth: 1.5,
		borderColor: theme.border,
		gap: 18,
	},
	field: {
		gap: 8,
	},
	inputLabel: {
		fontFamily: "sans-bold",
		fontSize: 13,
		color: theme.primary,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	errorBox: {
		backgroundColor: theme.destructive + "1A",
		padding: 14,
		borderRadius: RADIUS.md,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	errorText: {
		fontFamily: "sans-semibold",
		color: theme.destructive,
		fontSize: 14,
		flex: 1,
	},
	saveBtn: {
		backgroundColor: theme.accent,
		borderRadius: RADIUS.md,
		paddingVertical: 16,
		alignItems: "center",
	},
	saveBtnText: {
		...BUTTON_TEXT,
		color: "#fff",
	},
	hint: {
		fontFamily: "sans-medium",
		fontSize: 13,
		color: theme.mutedForeground,
		textAlign: "center",
		lineHeight: 19,
		marginTop: 16,
		paddingHorizontal: 12,
	},
});
