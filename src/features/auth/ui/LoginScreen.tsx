import { clsx } from "clsx";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/shared/constants/theme";

const PHONE_MIN = 10;
const PASSWORD_MIN = 6;

export function LoginScreen() {
	const router = useRouter();
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [showErrors, setShowErrors] = useState(false);

	const phoneError = phone.length > 0 && phone.length < PHONE_MIN;
	const passwordError = password.length > 0 && password.length < PASSWORD_MIN;
	const phoneErrorSubmit = phone.length < PHONE_MIN;
	const passwordErrorSubmit = password.length < PASSWORD_MIN;

	const onSubmit = useCallback(() => {
		setShowErrors(true);
		if (phoneErrorSubmit || passwordErrorSubmit) {
			return;
		}
		router.replace("/home");
	}, [phoneErrorSubmit, passwordErrorSubmit, router]);

	return (
		<SafeAreaView style={styles.safe} className="auth-safe-area">
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="auth-scroll">
				<ScrollView
					keyboardShouldPersistTaps="handled"
					style={styles.flex}
					contentContainerStyle={styles.scrollContent}
					contentContainerClassName="auth-content"
					showsVerticalScrollIndicator={false}>
					<View className="auth-brand-block">
						<View className="auth-logo-wrap">
							<View className="auth-logo-mark">
								<Text style={styles.logoLetter} className="auth-logo-mark-text">
									L
								</Text>
							</View>
							<View>
								<Text style={styles.wordmark} className="auth-wordmark">
									Librum
								</Text>
								<Text style={styles.wordmarkSub} className="auth-wordmark-sub">
									Library Pro
								</Text>
							</View>
						</View>
						<Text style={styles.screenTitle} className="auth-title">
							Welcome back
						</Text>
						<Text style={styles.screenSubtitle} className="auth-subtitle">
							Sign in with your phone number and password.
						</Text>
					</View>

					<View style={styles.card} className="auth-card">
						<View className="auth-form">
							<View className="auth-field">
								<Text style={styles.label} className="auth-label">
									Phone number
								</Text>
								<TextInput
									style={[
										styles.input,
										((showErrors && phoneErrorSubmit) || phoneError) && styles.inputError,
									]}
									className={clsx(
										"auth-input",
										(showErrors && phoneErrorSubmit) || phoneError ? "auth-input-error" : null,
									)}
									placeholder="10-digit mobile number"
									placeholderTextColor="rgba(0,0,0,0.35)"
									keyboardType="phone-pad"
									maxLength={15}
									autoCapitalize="none"
									autoCorrect={false}
									value={phone}
									onChangeText={setPhone}
								/>
								{showErrors && phoneErrorSubmit ? (
									<Text style={styles.fieldError} className="auth-error">
										Enter at least {PHONE_MIN} digits.
									</Text>
								) : null}
							</View>

							<View className="auth-field">
								<Text style={styles.label} className="auth-label">
									Password
								</Text>
								<TextInput
									style={[
										styles.input,
										((showErrors && passwordErrorSubmit) || passwordError) && styles.inputError,
									]}
									className={clsx(
										"auth-input",
										(showErrors && passwordErrorSubmit) || passwordError ? "auth-input-error" : null,
									)}
									placeholder="••••••••"
									placeholderTextColor="rgba(0,0,0,0.35)"
									secureTextEntry
									value={password}
									onChangeText={setPassword}
								/>
								{showErrors && passwordErrorSubmit ? (
									<Text style={styles.fieldError} className="auth-error">
										Password must be at least {PASSWORD_MIN} characters.
									</Text>
								) : null}
							</View>

							<Pressable accessibilityRole="button" onPress={() => {}}>
								<Text style={styles.forgot} className="auth-forgot">
									Forgot password?
								</Text>
							</Pressable>

							<Pressable accessibilityRole="button" style={styles.primaryButton} className={clsx("auth-button")} onPress={onSubmit}>
								<Text style={styles.primaryButtonText} className="auth-button-text">
									Log in
								</Text>
							</Pressable>
						</View>
					</View>

					<View className="auth-link-row">
						<Text style={styles.linkMuted} className="auth-link-copy">
							New here?
						</Text>
						<Pressable accessibilityRole="button" onPress={() => router.push("/register")}>
							<Text style={styles.linkAccent} className="auth-link">
								Create library account
							</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	flex: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingHorizontal: 20,
		paddingBottom: 40,
		paddingTop: 32,
	},
	logoLetter: {
		color: colors.background,
	},
	wordmark: {
		color: colors.primary,
	},
	wordmarkSub: {
		color: colors.mutedForeground,
	},
	screenTitle: {
		color: colors.primary,
	},
	screenSubtitle: {
		color: colors.mutedForeground,
	},
	card: {
		backgroundColor: colors.card,
		borderColor: colors.border,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderRadius: 24,
		padding: 20,
		marginTop: 32,
	},
	label: {
		color: colors.primary,
	},
	input: {
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth * 2,
		borderColor: "rgba(0,0,0,0.1)",
		backgroundColor: colors.background,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 16,
		color: colors.primary,
	},
	inputError: {
		borderColor: colors.destructive,
	},
	fieldError: {
		color: colors.destructive,
		fontSize: 12,
		marginTop: 4,
	},
	forgot: {
		color: colors.accent,
		marginTop: 8,
		alignSelf: "flex-end",
		fontSize: 14,
		fontWeight: "600",
	},
	primaryButton: {
		marginTop: 8,
		alignItems: "center",
		borderRadius: 16,
		backgroundColor: colors.accent,
		paddingVertical: 16,
	},
	primaryButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.primary,
	},
	linkMuted: {
		color: colors.mutedForeground,
		fontSize: 14,
	},
	linkAccent: {
		color: colors.accent,
		fontSize: 14,
		fontWeight: "700",
	},
});
