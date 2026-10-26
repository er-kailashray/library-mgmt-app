import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthBrand } from "@/features/auth/ui/AuthBrand";
import { loginApi, saveAuthData } from "@/services/api/auth.api";
import { ApiError } from "@/services/api/client";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { PoweredBy } from "@/shared/ui/PoweredBy";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { Text, TextInput } from "@/shared/ui/Text";
import { PHONE_INPUT_MAX_LENGTH, phoneDigits } from "@/shared/utils/text";

const PHONE_MIN = 10;
const PASSWORD_MIN = 6;

export function LoginScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [showErrors, setShowErrors] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);

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
			// Registered but never confirmed the OTP: the backend has sent a code, so finish verification.
			if (error instanceof ApiError && error.data?.requires_verification) {
				router.push({ pathname: "/otp", params: { phone } });
				return;
			}
			// Offline or a server fault isn't a wrong password; say what actually happened.
			const noAnswer = error instanceof ApiError && (error.status === 0 || error.status >= 500);
			setApiError(noAnswer ? error.message : "Unable to sign in. Please check your phone number and password.");
		} finally {
			setIsSubmitting(false);
		}
	}, [phone, password, phoneErrorSubmit, passwordErrorSubmit, router]);

	const styles = createStyles(theme);

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
					<ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
						<View style={styles.brandBlock}>
							<View style={styles.brandRow}>
								<AuthBrand />
							</View>
							<Text style={styles.screenTitle}>Sign in to your library</Text>
							<Text style={styles.screenSubtitle}>Use your registered phone number and password.</Text>
						</View>

						<View style={styles.card}>
							<View style={styles.form}>
								<View style={styles.field}>
									<Text style={styles.label}>Phone number</Text>
									<TextInput
										style={[styles.input, showErrors && phoneErrorSubmit && styles.inputError]}
										placeholder="10-digit mobile number"
										placeholderTextColor={theme.mutedForeground + "80"}
										keyboardType="phone-pad"
										// Digits only, like Register; a pasted "+91 98..." loses its country code.
										maxLength={PHONE_INPUT_MAX_LENGTH}
										autoCapitalize="none"
										autoCorrect={false}
										textContentType="telephoneNumber"
										autoComplete="tel"
										value={phone}
										onChangeText={(text) => setPhone(phoneDigits(text))}
									/>
									{showErrors && phoneErrorSubmit ? (
										<Text style={styles.fieldError}>
											Enter your {PHONE_MIN}-digit mobile number.
										</Text>
									) : null}
								</View>

								<View style={styles.field}>
									<Text style={styles.label}>Password</Text>
									<PasswordInput
										hasError={showErrors && passwordErrorSubmit}
										placeholder="••••••••"
										textContentType="password"
										autoComplete="password"
										value={password}
										onChangeText={setPassword}
									/>
									{showErrors && passwordErrorSubmit ? (
										<Text style={styles.fieldError}>
											Password must be at least {PASSWORD_MIN} characters.
										</Text>
									) : null}
								</View>

								<Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/forgot-password", params: { phone } })}>
									<Text style={styles.forgot}>Forgot password?</Text>
								</Pressable>
								{apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

								<Pressable accessibilityRole="button" style={[styles.primaryButton, isSubmitting && styles.disabledButton]} onPress={onSubmit} disabled={isSubmitting}>
									<Text style={styles.primaryButtonText}>
										{isSubmitting ? "Signing in..." : "Log in"}
									</Text>
								</Pressable>
							</View>
						</View>

						<View style={styles.linkRow}>
							<Text style={styles.linkMuted}>New here?</Text>
							<Pressable accessibilityRole="button" onPress={() => router.push("/register")}>
								<Text style={styles.linkAccent}>Create library account</Text>
							</Pressable>
						</View>

						<PoweredBy />
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</ScreenBackground>
	);
}

const createStyles = (theme: any) => ScaledSheet.create({
	safe: {
		flex: 1,
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
	brandBlock: {
		alignItems: "center",
		marginBottom: 32,
	},
	brandRow: {
		marginBottom: 56,
	},
	screenTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 22,
		color: theme.primary,
		marginBottom: 6,
		textAlign: "center",
	},
	screenSubtitle: {
		fontFamily: "sans-medium",
		fontSize: 15,
		color: theme.mutedForeground,
		lineHeight: 21,
		textAlign: "center",
	},
	card: {
		backgroundColor: theme.card,
		borderRadius: RADIUS.md,
		padding: 24,
		borderWidth: 1.5,
		borderColor: theme.border,
	},
	form: {
		gap: 20,
	},
	field: {
		gap: 8,
	},
	label: {
		fontFamily: "sans-bold",
		fontSize: 13,
		color: theme.primary,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	input: {
		fontFamily: "sans-medium",
		borderRadius: RADIUS.md,
		borderWidth: 1.5,
		borderColor: theme.border,
		backgroundColor: theme.background,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 15,
		color: theme.primary,
	},
	inputError: {
		borderColor: theme.destructive,
	},
	fieldError: {
		fontFamily: "sans-semibold",
		color: theme.destructive,
		fontSize: 12,
		marginTop: 2,
	},
	forgot: {
		fontFamily: "sans-bold",
		color: theme.accent,
		fontSize: 14,
		textAlign: "right",
	},
	primaryButton: {
		backgroundColor: theme.accent,
		paddingVertical: 18,
		borderRadius: RADIUS.md,
		alignItems: "center",
		marginTop: 8,
	},
	disabledButton: {
		opacity: 0.6,
	},
	primaryButtonText: {
		...BUTTON_TEXT,
		color: "#fff",
	},
	apiError: {
		fontFamily: "sans-semibold",
		color: theme.destructive,
		fontSize: 14,
		textAlign: "center",
	},
	linkRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: 24,
	},
	linkMuted: {
		fontFamily: "sans-medium",
		color: theme.mutedForeground,
		fontSize: 14,
	},
	linkAccent: {
		fontFamily: "sans-bold",
		color: theme.accent,
		fontSize: 14,
	},
});
