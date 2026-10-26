import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { resendRegisterOtpApi, verifyRegisterOtpApi } from "@/features/auth/logic/auth-register.api";
import { saveAuthData } from "@/services/api/auth.api";
import { ApiError } from "@/services/api/client";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { OtpInput } from "@/shared/ui/OtpInput";
import { PoweredBy } from "@/shared/ui/PoweredBy";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text } from "@/shared/ui/Text";
import { formatCountdown } from "@/shared/utils/dates";

const RESEND_COOLDOWN_SECONDS = 30;

export function OtpScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { phone } = useLocalSearchParams<{ phone: string }>();

    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    // A code was sent just before this screen opened, so start on the backend's cooldown.
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0 || isResending) return;
        setError(null);
        setNotice(null);

        try {
            setIsResending(true);
            const response = await resendRegisterOtpApi(phone);
            setOtp("");
            setNotice("A new code has been sent.");
            setCooldown(response.retry_after ?? RESEND_COOLDOWN_SECONDS);
        } catch (err: any) {
            if (err instanceof ApiError && typeof err.data?.retry_after === "number") {
                setCooldown(err.data.retry_after);
            }
            setError(err.message || "Could not send a new code. Please try again.");
        } finally {
            setIsResending(false);
        }
    };

    const handleVerify = async () => {
        setError(null);
        setNotice(null);
        if (otp.length < 6) {
            setError("Please enter the 6-digit code.");
            return;
        }

        try {
            setIsVerifying(true);
            const response = await verifyRegisterOtpApi(phone, otp);
            await saveAuthData(response.token, response.user);
            router.replace("/home");
        } catch (err: any) {
            setError(err.message || "Could not verify the code. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <ScreenHeader
                    title="Verify Account"
                    subtitle={`Enter the code sent to ${phone}`}
                    right={<Image source={require("@/assets/images/logo.png")} style={styles.headerLogo} />}
                />

                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <View style={styles.content}>
                        <View style={styles.otpCard}>
                            <Ionicons name="mail-unread-outline" size={48} color={theme.accent} style={{ alignSelf: "center", marginBottom: 20 }} />
                            <Text style={styles.instruction}>We've sent a 6-digit confirmation code to your mobile number.</Text>

                            <View style={styles.otpInput}>
                                <OtpInput value={otp} onChangeText={setOtp} />
                            </View>

                            {notice && <Text style={styles.noticeText}>{notice}</Text>}

                            {error && (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={18} color={theme.destructive} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            <Pressable style={styles.submitButton} onPress={handleVerify} disabled={isVerifying}>
                                {isVerifying ? (
                                    <ActivityIndicator color={"#fff"} size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Verify & Complete</Text>
                                )}
                            </Pressable>

                            <Pressable
                                accessibilityRole="button"
                                style={styles.resendButton}
                                onPress={handleResend}
                                disabled={cooldown > 0 || isResending}
                            >
                                {isResending ? (
                                    <ActivityIndicator color={theme.accent} size="small" />
                                ) : cooldown > 0 ? (
                                    <Text style={styles.resendText}>Resend code in {formatCountdown(cooldown)}</Text>
                                ) : (
                                    <Text style={styles.resendText}>Didn't receive code? <Text style={{ color: theme.accent }}>Resend</Text></Text>
                                )}
                            </Pressable>
                        </View>

                        <PoweredBy style={styles.footer} />
                    </View>
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
    headerLogo: {
        width: 40,
        height: 40,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: 24,
    },
    otpCard: {
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        padding: 32,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    instruction: {
        fontFamily: "sans-medium",
        fontSize: 15,
        color: theme.mutedForeground,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    otpInput: {
        marginBottom: 24,
    },
    submitButton: {
        backgroundColor: theme.accent,
        padding: 20,
        borderRadius: RADIUS.md,
        alignItems: "center",
    },
    submitButtonText: {
        ...BUTTON_TEXT,
        color: "#fff",
    },
    resendButton: {
        marginTop: 24,
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
        marginBottom: 16,
    },
    errorBox: {
        backgroundColor: theme.destructive + "1A",
        padding: 14,
        borderRadius: RADIUS.md,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
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
