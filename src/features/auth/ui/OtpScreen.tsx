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

import { useTheme } from "@/shared/providers/ThemeProvider";

export function OtpScreen() {
    const router = useRouter();
    const { theme } = useTheme();
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

        setIsVerifying(true);
        // Simulate API call
        setTimeout(() => {
            if (otp === "000111") {
                router.replace("/login");
            } else {
                setError("Invalid OTP code. Use 000111 for testing.");
                setIsVerifying(false);
            }
        }, 1000);
    };

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View>
                    <Text style={styles.title}>Verify Account</Text>
                    <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={styles.content}>
                    <View style={styles.otpCard}>
                        <Ionicons name="mail-unread-outline" size={48} color={theme.accent} style={{ alignSelf: "center", marginBottom: 20 }} />
                        <Text style={styles.instruction}>We've sent a 6-digit confirmation code to your mobile number.</Text>

                        <TextInput
                            style={[styles.otpInput, { letterSpacing: 8 }]}
                            placeholder="000000"
                            placeholderTextColor={theme.mutedForeground + "4D"}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                        />

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={18} color={theme.destructive} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Pressable style={styles.submitButton} onPress={handleVerify} disabled={isVerifying}>
                            {isVerifying ? (
                                <ActivityIndicator color={theme.background === "#0C0A09" ? theme.primary : "#fff"} size="small" />
                            ) : (
                                <Text style={styles.submitButtonText}>Verify & Complete</Text>
                            )}
                        </Pressable>

                        <Pressable style={styles.resendButton}>
                            <Text style={styles.resendText}>Didn't receive code? <Text style={{ color: theme.accent }}>Resend</Text></Text>
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

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.background,
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
        borderBottomColor: theme.border,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.card,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    title: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: theme.primary,
        marginBottom: 2,
    },
    subtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: theme.mutedForeground,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: 40,
    },
    otpCard: {
        backgroundColor: theme.card,
        borderRadius: 24,
        padding: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
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
        fontFamily: "sans-extrabold",
        fontSize: 32,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 20,
        paddingVertical: 20,
        textAlign: "center",
        color: theme.primary,
        marginBottom: 24,
    },
    submitButton: {
        backgroundColor: theme.accent,
        padding: 20,
        borderRadius: 18,
        alignItems: "center",
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: theme.background === "#0C0A09" ? theme.primary : "#fff",
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
    errorBox: {
        backgroundColor: theme.destructive + "1A",
        padding: 14,
        borderRadius: 16,
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
        alignItems: "center",
        marginTop: "auto",
        paddingBottom: 20,
    },
    footerText: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: theme.mutedForeground,
    },
});
