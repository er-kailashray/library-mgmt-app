import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLibraryProfileApi, updateLibraryAmenitiesApi } from "@/features/library-profile/logic/library-profile-api";
import { AMENITY_ICONS, AMENITY_LABELS, AMENITY_OPTIONS, Amenity } from "@/features/library-profile/types/library-profile.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";

export function AmenitiesScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const [selected, setSelected] = useState<Amenity[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setSelected(profile.amenities);
        }
    }, [profile]);

    const toggle = useCallback((amenity: Amenity) => {
        setSelected((prev) => (prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]));
    }, []);

    const handleSave = useCallback(async () => {
        try {
            setIsSaving(true);
            await updateLibraryAmenitiesApi(selected);
            Alert.alert("Saved", "Amenities updated.");
            router.back();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update amenities.");
        } finally {
            setIsSaving(false);
        }
    }, [selected, router]);

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Amenities</Text>
                        <Text style={styles.headerSubtitle}>What your library offers</Text>
                    </View>
                </View>

                {isLoading ? (
                    <LoadingState />
                ) : error || !profile ? (
                    <ErrorState message={error || "Could not load amenities."} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        <View style={styles.grid}>
                            {AMENITY_OPTIONS.map((amenity) => {
                                const isSelected = selected.includes(amenity);
                                return (
                                    <Pressable key={amenity} style={[styles.tile, isSelected && styles.tileSelected]} onPress={() => toggle(amenity)}>
                                        <View style={[styles.tileIconCircle, isSelected && styles.tileIconCircleSelected]}>
                                            <Ionicons name={AMENITY_ICONS[amenity]} size={22} color={isSelected ? "#fff" : theme.primary} />
                                        </View>
                                        <Text style={[styles.tileText, isSelected && styles.tileTextSelected]}>{AMENITY_LABELS[amenity]}</Text>
                                        {isSelected && (
                                            <View style={styles.tileCheck}>
                                                <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Pressable style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                        </Pressable>
                    </ScrollView>
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
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
            gap: 16,
        },
        headerActionCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.card,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        headerText: {
            flex: 1,
        },
        headerTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 20,
            color: theme.primary,
        },
        headerSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 24,
        },
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
        },
        tile: {
            width: "47%",
            backgroundColor: theme.card,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1.5,
            borderColor: theme.border,
            position: "relative",
        },
        tileSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "10",
        },
        tileIconCircle: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 12,
        },
        tileIconCircleSelected: {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
        },
        tileText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        tileTextSelected: {
            color: theme.primary,
        },
        tileCheck: {
            position: "absolute",
            top: 12,
            right: 12,
        },
        saveBtn: {
            backgroundColor: theme.accent,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
        },
        saveBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
    });
