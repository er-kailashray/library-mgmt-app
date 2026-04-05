import { Ionicons } from "@expo/vector-icons";
import { clsx } from "clsx";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loginApi, saveAuthData } from "@/services/api/auth.api";
import { colors } from "@/shared/constants/theme";

const PHONE_MIN = 10;
const PASSWORD_MIN = 6;

export function LoginScreen() {
	const router = useRouter();
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);

	const phoneError = phone.length > 0 && phone.length < PHONE_MIN;
	const passwordError = password.length > 0 && password.length < PASSWORD_MIN;
	const phoneErrorSubmit = phone.length < PHONE_MIN;
	const passwordErrorSubmit = password.length < PASSWORD_MIN;

	const onSubmit = useCallback(async () => {
		setShowErrors(true);
		if (phoneErrorSubmit || passwordErrorSubmit) {
			return;
		}

		setApiError(null);
		setIsSubmitting(true);

		try {
			const response = await loginApi({ phone, password });
			await saveAuthData(response.token, response.user);
			router.replace("/home");
		} catch (error) {
			setApiError("Unable to sign in. Please check your phone number and password.");
		} finally {
			setIsSubmitting(false);
		}
	}, [phone, password, phoneErrorSubmit, passwordErrorSubmit, router]);

	return (
		<SafeAreaView style={styles.safe} className="auth-safe-area">
			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} className="auth-scroll">
				<ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={styles.scrollContent} contentContainerClassName="auth-content" showsVerticalScrollIndicator={false}>
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
									style={[styles.input, ((showErrors && phoneErrorSubmit) || phoneError) && styles.inputError]}
									className={clsx("auth-input", (showErrors && phoneErrorSubmit) || phoneError ? "auth-input-error" : null)}
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
								<View style={styles.passwordContainer}>
									<TextInput
										style={[styles.input, ((showErrors && passwordErrorSubmit) || passwordError) && styles.inputError]}
										className={clsx("auth-input", (showErrors && passwordErrorSubmit) || passwordError ? "auth-input-error" : null)}
										placeholder="••••••••"
										placeholderTextColor="rgba(0,0,0,0.35)"
										secureTextEntry={!isPasswordVisible}
										value={password}
										onChangeText={setPassword}
									/>
									<Pressable style={styles.eyeButton} onPress={() => setIsPasswordVisible(!isPasswordVisible)} accessibilityRole="button" accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}>
										<Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} />
									</Pressable>
								</View>
								{showErrors && passwordErrorSubmit ? (
									<Text style={styles.fieldError} className="auth-error">
										Password must be at least {PASSWORD_MIN} characters.
									</Text>
								) : null}
							</View>

							<Pressable accessibilityRole="button" onPress={() => { }}>
								<Text style={styles.forgot} className="auth-forgot">
									Forgot password?
								</Text>
							</Pressable>
							{apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

							<Pressable accessibilityRole="button" style={[styles.primaryButton, isSubmitting && styles.disabledButton]} className={clsx("auth-button")} onPress={onSubmit} disabled={isSubmitting}>
								<Text style={styles.primaryButtonText} className="auth-button-text">
									{isSubmitting ? "Signing in..." : "Log in"}
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

					<View style={styles.poweredByBlock}>
						<Text style={styles.poweredByText}>Powered by Kailash Ray</Text>
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
		borderRadius: 24,
		padding: 24,
		marginTop: 32,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.1,
		shadowRadius: 20,
		elevation: 5,
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
		paddingRight: 50, // Make space for eye button
	},
	passwordContainer: {
		position: "relative",
	},
	eyeButton: {
		position: "absolute",
		right: 12,
		top: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 8,
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
	disabledButton: {
		opacity: 0.65,
	},
	primaryButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.primary,
	},
	apiError: {
		marginTop: 12,
		color: colors.destructive,
		fontSize: 14,
		fontWeight: "600",
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
	poweredByBlock: {
		alignItems: "center",
		marginTop: 32,
		paddingBottom: 20,
	},
	poweredByText: {
		color: colors.mutedForeground,
		fontSize: 13,
		fontWeight: "600",
	},
});
