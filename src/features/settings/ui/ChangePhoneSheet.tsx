import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AuthUser } from "@/features/auth/types/auth.types";
import { requestPhoneChangeApi, updateStoredAuthUser, verifyPhoneChangeApi } from "@/services/api/auth.api";
import { ApiError } from "@/services/api/client";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { OtpInput } from "@/shared/ui/OtpInput";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { Text, TextInput } from "@/shared/ui/Text";
import { showToast } from "@/shared/ui/Toast";
import { formatCountdown } from "@/shared/utils/dates";
import { PHONE_INPUT_MAX_LENGTH, phoneDigits } from "@/shared/utils/text";

type Props = {
	visible: boolean;
	currentPhone: string;
	onClose: () => void;
	onChanged: (user: AuthUser) => void;
};

/**
 * Changing the number the owner signs in with: their password first (so a phone left unlocked
 * can't be used to hand the account to someone else), then the code texted to the new number,
 * which proves they hold it.
 */
export function ChangePhoneSheet({ visible, currentPhone, onClose, onChanged }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);

	const [step, setStep] = useState<"details" | "code">("details");
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	// Fresh each time it opens.
	useEffect(() => {
		if (!visible) return;
		setStep("details");
		setPhone("");
		setPassword("");
		setOtp("");
		setError(null);
		setCooldown(0);
	}, [visible]);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const sendCode = async () => {
		setError(null);
		if (!/^[6-9]\d{9}$/.test(phone)) {
			setError("Enter a valid 10-digit mobile number.");
			return;
		}
		if (phone === currentPhone) {
			setError("That's already your number.");
			return;
		}
		if (!password) {
			setError("Enter your current password.");
			return;
		}
		try {
			setIsBusy(true);
			const response = await requestPhoneChangeApi(phone, password);
			setCooldown(response.retry_after ?? 30);
			setOtp("");
			setStep("code");
		} catch (err: any) {
			if (err instanceof ApiError && err.data?.retry_after) setCooldown(err.data.retry_after);
			setError(err.message || "Could not send the code. Please try again.");
		} finally {
			setIsBusy(false);
		}
	};

	const verify = async () => {
		setError(null);
		if (otp.length < 6) {
			setError("Enter the 6-digit code.");
			return;
		}
		try {
			setIsBusy(true);
			const response = await verifyPhoneChangeApi(phone, otp);
			await updateStoredAuthUser(response.user);
			showToast({ message: "Phone number changed", detail: `You now sign in with ${phone}.` });
			onChanged(response.user);
		} catch (err: any) {
			setError(err.message || "Could not verify the code. Please try again.");
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<BottomSheet
			visible={visible}
			onClose={onClose}
			title="Change phone number"
			subtitle={step === "details" ? "The number you sign in with" : `Enter the code sent to ${phone}`}
			showClose
			bottomPadding={28}>
			{step === "details" ? (
				<View>
					<Text style={styles.label}>New mobile number</Text>
					<TextInput
						style={styles.input}
						value={phone}
						onChangeText={(text) => setPhone(phoneDigits(text))}
						keyboardType="phone-pad"
						maxLength={PHONE_INPUT_MAX_LENGTH}
						placeholder="10-digit mobile number"
						placeholderTextColor={theme.mutedForeground + "80"}
					/>
					<Text style={styles.label}>Current password</Text>
					<PasswordInput value={password} onChangeText={setPassword} placeholder="Your password" />
					<Text style={styles.hint}>We'll text a code to the new number to confirm it's yours.</Text>
				</View>
			) : (
				<View>
					<View style={styles.otp}>
						<OtpInput value={otp} onChangeText={setOtp} />
					</View>
					<Pressable
						accessibilityRole="button"
						disabled={cooldown > 0 || isBusy}
						onPress={sendCode}
						style={({ pressed }) => [styles.resend, pressed && { opacity: 0.6 }]}>
						<Text style={[styles.resendText, cooldown > 0 && { color: theme.mutedForeground }]}>
							{cooldown > 0 ? `Send again in ${formatCountdown(cooldown)}` : "Send the code again"}
						</Text>
					</Pressable>
					<Pressable accessibilityRole="button" onPress={() => setStep("details")} style={styles.resend}>
						<Text style={styles.backText}>Use a different number</Text>
					</Pressable>
				</View>
			)}

			{error && <Text style={styles.error}>{error}</Text>}

			<Pressable
				accessibilityRole="button"
				style={({ pressed }) => [styles.button, (pressed || isBusy) && { opacity: 0.85 }]}
				onPress={step === "details" ? sendCode : verify}
				disabled={isBusy}>
				{isBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>{step === "details" ? "Send code" : "Confirm new number"}</Text>}
			</Pressable>
		</BottomSheet>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		label: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 14,
			marginBottom: 6,
		},
		input: {
			height: 48,
			paddingHorizontal: 14,
			borderRadius: RADIUS.md,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
			fontFamily: "sans-regular",
			fontSize: 15,
			color: theme.primary,
		},
		hint: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 8,
		},
		otp: {
			marginTop: 8,
		},
		resend: {
			alignSelf: "center",
			paddingVertical: 8,
			marginTop: 6,
		},
		resendText: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: theme.accent,
		},
		backText: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		error: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.destructive,
			marginTop: 12,
		},
		button: {
			marginTop: 20,
			alignItems: "center",
			paddingVertical: 15,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent,
		},
		buttonText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
	});
