import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/shared/constants/theme";

export function OtpScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();

    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = async () => {
        setError(null);
        if (otp.length < 6) {
            setError("Please enter the 6-digit code.");
            return;
        }

        // Dummy OTP validation
        setIsVerifying(true);

        // Simulate API call
        setTimeout(() => {
            if (otp === "000111") {
                // Success -> Go to login or directly to home if token returned
                // For now, let's go back to login so they can sign in with the new password
                router.replace("/login");
            } else {
                setError("Invalid OTP code. Use 000111 for testing.");
                setIsVerifying(false);
            }
        }, 1000);
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </Pressable>
                <View>
                    <Text style={styles.title}>Verify Account</Text>
                    <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={styles.content}>
                    <View style={styles.otpCard}>
                        <Ionicons name="mail-unread-outline" size={48} color={colors.accent} style={{ alignSelf: "center", marginBottom: 20 }} />
                        <Text style={styles.instruction}>We've sent a 6-digit confirmation code to your mobile number.</Text>

                        <TextInput
                            style={[styles.otpInput, { letterSpacing: 8 }]}
                            placeholder="000000"
                            placeholderTextColor="rgba(0,0,0,0.15)"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                        />

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Pressable style={styles.submitButton} onPress={handleVerify} disabled={isVerifying}>
                            {isVerifying ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.submitButtonText}>Verify & Complete</Text>
                            )}
                        </Pressable>

                        <Pressable style={styles.resendButton}>
                            <Text style={styles.resendText}>Didn't receive code? <Text style={{ color: colors.accent }}>Resend</Text></Text>
                        </Pressable>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Powered by Kailash Ray</Text>
                    </View>
                </View>
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: colors.primary,
        marginBottom: 2,
    },
    subtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: colors.mutedForeground,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: 40,
    },
    otpCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    instruction: {
        fontFamily: "sans-medium",
        fontSize: 15,
        color: colors.mutedForeground,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    otpInput: {
        fontFamily: "sans-extrabold",
        fontSize: 32,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingVertical: 20,
        textAlign: "center",
        color: colors.primary,
        marginBottom: 24,
    },
    submitButton: {
        backgroundColor: colors.accent,
        padding: 20,
        borderRadius: 18,
        alignItems: "center",
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: "#fff",
    },
    resendButton: {
        marginTop: 24,
        alignItems: "center",
    },
    resendText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.mutedForeground,
    },
    errorBox: {
        backgroundColor: colors.destructive + "1A",
        padding: 14,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
    },
    errorText: {
        fontFamily: "sans-semibold",
        color: colors.destructive,
        fontSize: 14,
        flex: 1,
    },
    footer: {
        alignItems: "center",
        marginTop: "auto",
        paddingBottom: 20,
    },
    footerText: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
    },
});
