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
import { AuthBrand } from "@/features/auth/ui/AuthBrand";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { PoweredBy } from "@/shared/ui/PoweredBy";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const PASSWORD_MIN = 6;
// Matches the backend's limit when seats are edited later from Settings.
const MAX_SEATS = 500;

type FieldErrors = Partial<Record<"libraryName" | "totalSeats" | "name" | "phone" | "password" | "confirmPassword", string>>;

export function RegisterScreen() {
    const router = useRouter();
    const { theme } = useTheme();

    const [libraryName, setLibraryName] = useState("");
    const [totalSeats, setTotalSeats] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [error, setError] = useState<string | null>(null);

    const validate = (): FieldErrors => {
        const errors: FieldErrors = {};
        const seats = Number(totalSeats);

        if (!libraryName.trim()) errors.libraryName = "Enter your library's name.";
        if (!totalSeats) errors.totalSeats = "Enter the number of seats.";
        else if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) errors.totalSeats = `Enter a number between 1 and ${MAX_SEATS}.`;
        if (!name.trim()) errors.name = "Enter your name.";
        if (!PHONE_REGEX.test(phone)) errors.phone = "Enter a valid 10-digit mobile number.";
        if (password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
        else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

        return errors;
    };

    const handleRegister = async () => {
        setError(null);
        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        try {
            setIsSubmitting(true);
            await registerApi({
                name: name.trim(),
                phone,
                password,
                library_name: libraryName.trim(),
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

    const goToLogin = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/login");
    };

    const styles = createStyles(theme);

    const fieldError = (key: keyof FieldErrors) =>
        fieldErrors[key] ? <Text style={styles.fieldError}>{fieldErrors[key]}</Text> : null;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />

                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.brandBlock}>
                            <View style={styles.brandRow}>
                                <AuthBrand />
                            </View>
                            <Text style={styles.screenTitle}>Create your library account</Text>
                            <Text style={styles.screenSubtitle}>Takes a minute. Your free trial starts as soon as you verify your number.</Text>
                        </View>

                        <View style={styles.formCard}>
                            <Text style={styles.sectionTitle}>Library Details</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Library Name</Text>
                                <TextInput
                                    style={[styles.input, fieldErrors.libraryName && styles.inputError]}
                                    placeholder="e.g. Gyan Library"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    autoCapitalize="words"
                                    maxLength={150}
                                    value={libraryName}
                                    onChangeText={setLibraryName}
                                />
                                {fieldError("libraryName")}
                            </View>

                            <View style={[styles.inputGroup, styles.lastInputGroup]}>
                                <Text style={styles.label}>Total Seats</Text>
                                <TextInput
                                    style={[styles.input, fieldErrors.totalSeats && styles.inputError]}
                                    placeholder="e.g. 50"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    value={totalSeats}
                                    onChangeText={(text) => setTotalSeats(text.replace(/\D/g, ""))}
                                />
                                {fieldError("totalSeats") ?? <Text style={styles.hint}>You can change this later in Settings.</Text>}
                            </View>
                        </View>

                        <View style={styles.formCard}>
                            <Text style={styles.sectionTitle}>Owner Details</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={[styles.input, fieldErrors.name && styles.inputError]}
                                    placeholder="e.g. Suresh Kumar"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    autoCapitalize="words"
                                    value={name}
                                    onChangeText={setName}
                                />
                                {fieldError("name")}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Mobile Number</Text>
                                <TextInput
                                    style={[styles.input, fieldErrors.phone && styles.inputError]}
                                    placeholder="10-digit mobile number"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={phone}
                                    onChangeText={(text) => setPhone(text.replace(/\D/g, ""))}
                                />
                                {fieldError("phone") ?? <Text style={styles.hint}>We'll send a code to verify it. You'll sign in with this number.</Text>}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <PasswordInput
                                    hasError={!!fieldErrors.password}
                                    placeholder={`At least ${PASSWORD_MIN} characters`}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                {fieldError("password")}
                            </View>

                            <View style={[styles.inputGroup, styles.lastInputGroup]}>
                                <Text style={styles.label}>Confirm Password</Text>
                                <PasswordInput
                                    hasError={!!fieldErrors.confirmPassword}
                                    placeholder="Re-enter the password"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                {fieldError("confirmPassword")}
                            </View>
                        </View>

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={18} color={theme.destructive} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Pressable accessibilityRole="button" style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} onPress={handleRegister} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <ActivityIndicator color={theme.background === "#0C0A09" ? theme.primary : "#fff"} size="small" />
                            ) : (
                                <Text style={styles.submitButtonText}>Create Account</Text>
                            )}
                        </Pressable>

                        <View style={styles.linkRow}>
                            <Text style={styles.linkMuted}>Already have an account?</Text>
                            <Pressable accessibilityRole="button" onPress={goToLogin}>
                                <Text style={styles.linkAccent}>Log in</Text>
                            </Pressable>
                        </View>

                        <PoweredBy />
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
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 40,
    },
    brandBlock: {
        alignItems: "center",
        marginBottom: 32,
    },
    brandRow: {
        marginBottom: 40,
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
        paddingHorizontal: 8,
    },
    formCard: {
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        padding: 24,
        marginBottom: 20,
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
        gap: 8,
    },
    lastInputGroup: {
        marginBottom: 0,
    },
    label: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        fontFamily: "sans-medium",
        fontSize: 15,
        backgroundColor: theme.background,
        borderWidth: 1.5,
        borderColor: theme.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: theme.primary,
    },
    inputError: {
        borderColor: theme.destructive,
    },
    fieldError: {
        fontFamily: "sans-semibold",
        color: theme.destructive,
        fontSize: 12,
    },
    hint: {
        fontFamily: "sans-medium",
        color: theme.mutedForeground,
        fontSize: 12,
    },
    submitButton: {
        backgroundColor: theme.accent,
        paddingVertical: 18,
        borderRadius: RADIUS.md,
        alignItems: "center",
        marginTop: 4,
    },
    submitButtonText: {
        ...BUTTON_TEXT,
        color: "#fff",
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
