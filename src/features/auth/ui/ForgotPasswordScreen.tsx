import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { forgotPasswordApi, resetPasswordApi } from "@/features/auth/logic/auth-password.api";
import { ApiError } from "@/services/api/client";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { OtpInput } from "@/shared/ui/OtpInput";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { PoweredBy } from "@/shared/ui/PoweredBy";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text, TextInput } from "@/shared/ui/Text";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const PASSWORD_MIN = 6;
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Two steps on one screen: enter the phone number to get a code, then enter the code
 * together with the new password.
 */
export function ForgotPasswordScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const params = useLocalSearchParams<{ phone?: string }>();

	const [step, setStep] = useState<"phone" | "reset">("phone");
	const [phone, setPhone] = useState(params.phone ?? "");
	const [otp, setOtp] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [cooldown, setCooldown] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const sendCode = async () => {
		const response = await forgotPasswordApi(phone);
		setCooldown(response.retry_after ?? RESEND_COOLDOWN_SECONDS);
	};

	const handleSendCode = async () => {
		setError(null);
		setNotice(null);
		if (!PHONE_REGEX.test(phone)) {
			setError("Enter your 10-digit registered mobile number.");
			return;
		}

		try {
			setIsSubmitting(true);
			await sendCode();
			setStep("reset");
		} catch (err: any) {
			// A code is already on its way; let the owner enter it instead of blocking them.
			if (err instanceof ApiError && typeof err.data?.retry_after === "number") {
				setCooldown(err.data.retry_after);
				setStep("reset");
				return;
			}
			setError(err.message || "Could not send the code. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResend = async () => {
		if (cooldown > 0 || isResending) return;
		setError(null);
		setNotice(null);

		try {
			setIsResending(true);
			await sendCode();
			setOtp("");
			setNotice("A new code has been sent.");
		} catch (err: any) {
			if (err instanceof ApiError && typeof err.data?.retry_after === "number") {
				setCooldown(err.data.retry_after);
			}
			setError(err.message || "Could not send a new code. Please try again.");
		} finally {
			setIsResending(false);
		}
	};

	const handleReset = async () => {
		setError(null);
		setNotice(null);
		if (otp.length < 6) {
			setError("Please enter the 6-digit code.");
			return;
		}
		if (password.length < PASSWORD_MIN) {
			setError(`Password must be at least ${PASSWORD_MIN} characters.`);
			return;
		}
		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		try {
			setIsSubmitting(true);
			await resetPasswordApi(phone, otp, password);
			Alert.alert("Password reset", "Your password has been changed. Please sign in with the new password.");
			// Return to the existing login screen rather than stacking a second one on top of it.
			router.dismissTo("/login");
		} catch (err: any) {
			setError(err.message || "Could not reset the password. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const styles = createStyles(theme);
	const buttonTextColor = theme.background === "#0C0A09" ? theme.primary : "#fff";

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
				<ScreenHeader
					title="Forgot Password"
					subtitle={step === "phone" ? "We'll send a code to your phone" : `Enter the code sent to ${phone}`}
					onBack={step === "reset" ? () => setStep("phone") : undefined}
				/>

				<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
					<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
						<View style={styles.card}>
							<Ionicons
								name={step === "phone" ? "lock-closed-outline" : "key-outline"}
								size={44}
								color={theme.accent}
								style={styles.cardIcon}
							/>

							{step === "phone" ? (
								<>
									<Text style={styles.instruction}>Enter the mobile number you sign in with. We'll text you a 6-digit code to reset your password.</Text>
									<View style={styles.field}>
										<Text style={styles.label}>Phone number</Text>
										<TextInput
											style={styles.input}
											placeholder="10-digit mobile number"
											placeholderTextColor={theme.mutedForeground + "80"}
											keyboardType="phone-pad"
											maxLength={10}
											value={phone}
											onChangeText={setPhone}
										/>
									</View>
								</>
							) : (
								<>
									<View style={styles.field}>
										<Text style={styles.label}>Verification code</Text>
										<OtpInput value={otp} onChangeText={setOtp} />
									</View>
									<View style={styles.field}>
										<Text style={styles.label}>New password</Text>
										<PasswordInput placeholder="At least 6 characters" value={password} onChangeText={setPassword} />
									</View>
									<View style={styles.field}>
										<Text style={styles.label}>Confirm new password</Text>
										<PasswordInput placeholder="Re-enter the new password" value={confirmPassword} onChangeText={setConfirmPassword} />
									</View>
								</>
							)}

							{notice && <Text style={styles.noticeText}>{notice}</Text>}

							{error && (
								<View style={styles.errorBox}>
									<Ionicons name="alert-circle" size={18} color={theme.destructive} />
									<Text style={styles.errorText}>{error}</Text>
								</View>
							)}

							<Pressable
								accessibilityRole="button"
								style={[styles.submitButton, isSubmitting && styles.disabledButton]}
								onPress={step === "phone" ? handleSendCode : handleReset}
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<ActivityIndicator color={buttonTextColor} size="small" />
								) : (
									<Text style={[styles.submitButtonText, { color: buttonTextColor }]}>
										{step === "phone" ? "Send Code" : "Reset Password"}
									</Text>
								)}
							</Pressable>

							{step === "reset" && (
								<Pressable accessibilityRole="button" style={styles.resendButton} onPress={handleResend} disabled={cooldown > 0 || isResending}>
									{isResending ? (
										<ActivityIndicator color={theme.accent} size="small" />
									) : cooldown > 0 ? (
										<Text style={styles.resendText}>Resend code in 0:{String(cooldown).padStart(2, "0")}</Text>
									) : (
										<Text style={styles.resendText}>
											Didn't receive code? <Text style={{ color: theme.accent }}>Resend</Text>
										</Text>
									)}
								</Pressable>
							)}
						</View>

						<PoweredBy style={styles.footer} />
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
	content: {
		flexGrow: 1,
		padding: 20,
		paddingTop: 24,
	},
	card: {
		backgroundColor: theme.card,
		borderRadius: RADIUS.md,
		padding: 24,
		borderWidth: 1.5,
		borderColor: theme.border,
		gap: 20,
	},
	cardIcon: {
		alignSelf: "center",
	},
	instruction: {
		fontFamily: "sans-medium",
		fontSize: 15,
		color: theme.mutedForeground,
		textAlign: "center",
		lineHeight: 22,
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
	submitButton: {
		backgroundColor: theme.accent,
		paddingVertical: 18,
		borderRadius: RADIUS.md,
		alignItems: "center",
	},
	disabledButton: {
		opacity: 0.6,
	},
	submitButtonText: {
		...BUTTON_TEXT,
		color: "#fff",
	},
	resendButton: {
		alignItems: "center",
	},
	resendText: {
		fontFamily: "sans-bold",
		fontSize: 14,
		color: theme.mutedForeground,
	},
	noticeText: {
		fontFamily: "sans-semibold",
		fontSize: 14,
		color: theme.success,
		textAlign: "center",
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
	footer: {
		paddingBottom: 20,
	},
});
