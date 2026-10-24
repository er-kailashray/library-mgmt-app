import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
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

import { registerApi } from "@/features/auth/logic/auth-register.api";
import { RADIUS } from "@/shared/constants/layout";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export function RegisterScreen() {
    const router = useRouter();
    const { theme } = useTheme();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [libraryName, setLibraryName] = useState("");
    const [totalSeats, setTotalSeats] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async () => {
        setError(null);
        if (!name || !phone || !password || !libraryName || !totalSeats) {
            setError("Please fill out all fields to continue.");
            return;
        }

        if (phone.length < 10) {
            setError("Enter a valid 10-digit phone number.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        try {
            setIsSubmitting(true);
            await registerApi({
                name,
                phone,
                password,
                library_name: libraryName,
                total_seats: totalSeats,
            });

            router.push({
                pathname: "/otp",
                params: { phone }
            });
        } catch (err: any) {
            setError(err.message || "An error occurred during registration.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader
                    title="Create Account"
                    subtitle="Set up your library profile"
                    right={<Image source={require("@/assets/images/logo.png")} style={styles.headerLogo} />}
                />

                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                        <View style={styles.formCard}>
                            <Text style={styles.sectionTitle}>Library Details</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Library Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Gyan Library"
                                    placeholderTextColor={theme.mutedForeground + "4D"}
                                    value={libraryName}
                                    onChangeText={setLibraryName}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Total Capacity (Seats)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 50"
                                    placeholderTextColor={theme.mutedForeground + "4D"}
                                    keyboardType="numeric"
                                    value={totalSeats}
                                    onChangeText={setTotalSeats}
                                />
                            </View>
                        </View>

                        <View style={styles.formCard}>
                            <Text style={styles.sectionTitle}>Owner Details</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Suresh Kumar"
                                    placeholderTextColor={theme.mutedForeground + "4D"}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Phone Number</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="10-digit mobile number"
                                    placeholderTextColor={theme.mutedForeground + "4D"}
                                    keyboardType="phone-pad"
                                    maxLength={15}
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Min 6 characters"
                                    placeholderTextColor={theme.mutedForeground + "4D"}
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={18} color={theme.destructive} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Pressable style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} onPress={handleRegister} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <ActivityIndicator color={theme.background === "#0C0A09" ? theme.primary : "#fff"} size="small" />
                            ) : (
                                <Text style={styles.submitButtonText}>Register & Send OTP</Text>
                            )}
                        </Pressable>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Powered by Kailash Ray</Text>
                        </View>

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
    headerLogo: {
        width: 40,
        height: 40,
    },
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 48,
    },
    formCard: {
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    sectionTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 14,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: theme.mutedForeground,
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        fontFamily: "sans-medium",
        fontSize: 15,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: theme.primary,
    },
    submitButton: {
        backgroundColor: theme.accent,
        padding: 20,
        borderRadius: RADIUS.md,
        alignItems: "center",
        marginTop: 8,
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: theme.background === "#0C0A09" ? theme.primary : "#fff",
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
        alignItems: "center",
        marginTop: 32,
    },
    footerText: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: theme.mutedForeground,
    },
});
