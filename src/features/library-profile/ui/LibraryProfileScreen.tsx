import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLibraryProfileApi, updateLibraryProfileApi } from "@/features/library-profile/logic/library-profile-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export function LibraryProfileScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const [name, setName] = useState("");
    const [seats, setSeats] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setName(profile.library_name);
            setSeats(String(profile.total_seats));
        }
    }, [profile]);

    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Please enter a library name.");
            return;
        }
        const seatCount = parseInt(seats, 10);
        if (!seatCount || seatCount < 1) {
            Alert.alert("Error", "Please enter a valid number of seats.");
            return;
        }
        try {
            setIsSaving(true);
            await updateLibraryProfileApi({ library_name: name.trim(), total_seats: seatCount });
            Alert.alert("Saved", "Library profile updated.");
            router.back();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update library.");
        } finally {
            setIsSaving(false);
        }
    }, [name, seats, router]);

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Library Profile" subtitle="Name & total seats" />

                {isLoading ? (
                    <LoadingState />
                ) : error || !profile ? (
                    <ErrorState message={error || "Could not load library profile."} onRetry={refetch} />
                ) : (
                    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
                            <View style={styles.inputWrap}>
                                <Text style={styles.inputLabel}>Library Name</Text>
                                <TextInput
                                    style={styles.inputField}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g. Gyan Library"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    autoCapitalize="words"
                                />
                            </View>

                            <View style={styles.inputWrap}>
                                <Text style={styles.inputLabel}>Total Seats</Text>
                                <TextInput
                                    style={styles.inputField}
                                    value={seats}
                                    onChangeText={setSeats}
                                    placeholder="e.g. 40"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                                <Text style={styles.inputHint}>
                                    Reducing this will remove the highest-numbered seats - you can&apos;t remove a seat that currently has a member assigned to it.
                                </Text>
                            </View>

                            <Pressable style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                            </Pressable>
                        </ScrollView>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        flex: {
            flex: 1,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 24,
        },
        inputWrap: {
            marginBottom: 20,
        },
        inputLabel: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: theme.primary,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        inputField: {
            fontFamily: "sans-medium",
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 15,
            color: theme.primary,
        },
        inputHint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 8,
        },
        saveBtn: {
            backgroundColor: theme.accent,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 12,
        },
        saveBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
    });
