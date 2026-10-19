import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loginApi, saveAuthData } from "@/services/api/auth.api";
import { useTheme } from "@/shared/providers/ThemeProvider";

const PHONE_MIN = 10;
const PASSWORD_MIN = 6;

export function LoginScreen() {
	const router = useRouter();
	const { theme } = useTheme();
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

	const styles = createStyles(theme);

	return (
		<SafeAreaView style={styles.safe} edges={["top"]}>
			<StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
					<View style={styles.brandBlock}>
						<View style={styles.logoWrap}>
							<View style={styles.logoMark}>
								<Text style={styles.logoLetter}>L</Text>
							</View>
							<View>
								<Text style={styles.wordmark}>Librum</Text>
								<Text style={styles.wordmarkSub}>Library Pro</Text>
							</View>
						</View>
						<Text style={styles.screenTitle}>Welcome back</Text>
						<Text style={styles.screenSubtitle}>Sign in with your phone number and password.</Text>
					</View>

					<View style={styles.card}>
						<View style={styles.form}>
							<View style={styles.field}>
								<Text style={styles.label}>Phone number</Text>
								<TextInput
									style={[styles.input, ((showErrors && phoneErrorSubmit) || phoneError) && styles.inputError]}
									placeholder="10-digit mobile number"
									placeholderTextColor={theme.mutedForeground + "80"}
									keyboardType="phone-pad"
									maxLength={15}
									autoCapitalize="none"
									autoCorrect={false}
									value={phone}
									onChangeText={setPhone}
								/>
								{showErrors && phoneErrorSubmit ? (
									<Text style={styles.fieldError}>
										Enter at least {PHONE_MIN} digits.
									</Text>
								) : null}
							</View>

							<View style={styles.field}>
								<Text style={styles.label}>Password</Text>
								<View style={styles.passwordContainer}>
									<TextInput
										style={[styles.input, ((showErrors && passwordErrorSubmit) || passwordError) && styles.inputError]}
										placeholder="••••••••"
										placeholderTextColor={theme.mutedForeground + "80"}
										secureTextEntry={!isPasswordVisible}
										value={password}
										onChangeText={setPassword}
									/>
									<Pressable style={styles.eyeButton} onPress={() => setIsPasswordVisible(!isPasswordVisible)} accessibilityRole="button">
										<Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={20} color={theme.mutedForeground} />
									</Pressable>
								</View>
								{showErrors && passwordErrorSubmit ? (
									<Text style={styles.fieldError}>
										Password must be at least {PASSWORD_MIN} characters.
									</Text>
								) : null}
							</View>

							<Pressable accessibilityRole="button" onPress={() => { }}>
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

					<View style={styles.poweredByBlock}>
						<Text style={styles.poweredByText}>Powered by Kailash Ray</Text>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: theme.background,
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
	logoWrap: {
		alignItems: "center",
		gap: 12,
		marginBottom: 24,
	},
	logoMark: {
		width: 64,
		height: 64,
		borderRadius: 20,
		backgroundColor: theme.accent,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 4,
	},
	logoLetter: {
		fontFamily: "sans-extrabold",
		fontSize: 32,
		color: "#fff",
	},
	wordmark: {
		fontFamily: "sans-extrabold",
		fontSize: 28,
		color: theme.primary,
		letterSpacing: -0.5,
		textAlign: "center",
	},
	wordmarkSub: {
		fontFamily: "sans-medium",
		fontSize: 15,
		color: theme.mutedForeground,
		marginTop: -2,
		textAlign: "center",
	},
	screenTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 28,
		color: theme.primary,
		marginBottom: 8,
		textAlign: "center",
	},
	screenSubtitle: {
		fontFamily: "sans-medium",
		fontSize: 16,
		color: theme.mutedForeground,
		lineHeight: 22,
		textAlign: "center",
	},
	card: {
		backgroundColor: theme.card,
		borderRadius: 24,
		padding: 24,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 20,
		elevation: 4,
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
		borderRadius: 16,
		borderWidth: 1.5,
		borderColor: theme.border,
		backgroundColor: theme.background,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 15,
		color: theme.primary,
	},
	passwordContainer: {
		position: "relative",
	},
	eyeButton: {
		position: "absolute",
		right: 4,
		top: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		width: 44,
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
		borderRadius: 16,
		alignItems: "center",
		marginTop: 8,
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.2,
		shadowRadius: 10,
		elevation: 4,
	},
	disabledButton: {
		opacity: 0.6,
	},
	primaryButtonText: {
		fontFamily: "sans-extrabold",
		fontSize: 16,
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
	poweredByBlock: {
		alignItems: "center",
		marginTop: 32,
	},
	poweredByText: {
		fontFamily: "sans-medium",
		color: theme.mutedForeground,
		fontSize: 13,
	},
});
