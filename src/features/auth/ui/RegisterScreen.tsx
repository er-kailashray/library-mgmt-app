import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
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
import { colors } from "@/shared/constants/theme";

export function RegisterScreen() {
    const router = useRouter();

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

            // On success, go to OTP screen
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

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </Pressable>
                <View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Setup your library profile</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>Library Details</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Library Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Yash Library"
                                placeholderTextColor="rgba(0,0,0,0.3)"
                                value={libraryName}
                                onChangeText={setLibraryName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Total Capacity (Seats)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 50"
                                placeholderTextColor="rgba(0,0,0,0.3)"
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
                                placeholder="e.g. Kailash Ray"
                                placeholderTextColor="rgba(0,0,0,0.3)"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="10-digit mobile number"
                                placeholderTextColor="rgba(0,0,0,0.3)"
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
                                placeholderTextColor="rgba(0,0,0,0.3)"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>
                    </View>

                    {error && (
                        <View style={styles.errorBox}>
                            <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <Pressable style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} onPress={handleRegister} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" size="small" />
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
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 48,
    },
    formCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    sectionTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 14,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: colors.mutedForeground,
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: colors.primary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        fontFamily: "sans-medium",
        fontSize: 15,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: colors.primary,
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
        marginTop: 8,
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: "#fff",
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
        marginTop: 32,
    },
    footerText: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
    },
});
