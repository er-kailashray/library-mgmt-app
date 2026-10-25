import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLibraryProfileApi, updateLibraryAmenitiesApi } from "@/features/library-profile/logic/library-profile-api";
import { AMENITY_GROUPS, AMENITY_ICONS, AMENITY_LABELS, Amenity } from "@/features/library-profile/types/library-profile.types";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

/** How long "Saved" stays on screen. */
const SAVED_NOTE_MS = 1800;

export function AmenitiesScreen() {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);

    const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    // What's saved, and what's ticked on screen. The save bar only appears when they differ.
    const [saved, setSaved] = useState<Amenity[]>([]);
    const [selected, setSelected] = useState<Amenity[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showSavedNote, setShowSavedNote] = useState(false);

    useEffect(() => {
        if (profile) {
            setSaved(profile.amenities);
            setSelected(profile.amenities);
        }
    }, [profile]);

    const toggle = (amenity: Amenity) => {
        setShowSavedNote(false);
        setSelected((prev) => (prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]));
    };

    const changes = selected.filter((a) => !saved.includes(a)).length + saved.filter((a) => !selected.includes(a)).length;

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await updateLibraryAmenitiesApi(selected);
            setSaved(selected);
            setShowSavedNote(true);
            setTimeout(() => setShowSavedNote(false), SAVED_NOTE_MS);
        } catch (err: any) {
            Alert.alert("Couldn't save", err.message || "Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // The bar slides up from the bottom when there's something to save (or to say "Saved").
    const barVisible = changes > 0 || showSavedNote;
    const slide = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(slide, { toValue: barVisible ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, [barVisible, slide]);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Facilities" subtitle="What your library offers" />

                {isLoading && !profile ? (
                    <LoadingState />
                ) : error || !profile ? (
                    <ErrorState message={error || "Could not load facilities."} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        <Text style={styles.intro}>
                            Tap everything your library has. <Text style={styles.introStrong}>{selected.length} selected</Text>
                        </Text>

                        {AMENITY_GROUPS.map((group) => (
                            <View key={group.title} style={styles.section}>
                                <Text style={styles.sectionTitle}>{group.title}</Text>
                                <View style={styles.grid}>
                                    {group.amenities.map((amenity) => {
                                        const isSelected = selected.includes(amenity);
                                        return (
                                            <Pressable
                                                key={amenity}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: isSelected }}
                                                accessibilityLabel={AMENITY_LABELS[amenity]}
                                                style={({ pressed }) => [styles.tile, isSelected && styles.tileSelected, pressed && { opacity: 0.85 }]}
                                                onPress={() => toggle(amenity)}>
                                                <View style={[styles.tileIcon, isSelected && styles.tileIconSelected]}>
                                                    <Ionicons name={AMENITY_ICONS[amenity]} size={18} color={isSelected ? "#fff" : theme.primary} />
                                                </View>
                                                <Text style={[styles.tileText, isSelected && styles.tileTextSelected]} numberOfLines={2}>
                                                    {AMENITY_LABELS[amenity]}
                                                </Text>
                                                <Ionicons
                                                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                                    size={18}
                                                    color={isSelected ? theme.accent : theme.mutedForeground + "66"}
                                                />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Save bar: only when something changed; briefly says "Saved" afterwards. */}
                <Animated.View
                    pointerEvents={barVisible ? "auto" : "none"}
                    style={[
                        styles.bar,
                        { paddingBottom: 12 + insets.bottom },
                        { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] },
                    ]}>
                    {changes > 0 ? (
                        <>
                            <Text style={styles.barText}>
                                {changes} {changes === 1 ? "change" : "changes"}
                            </Text>
                            <Pressable accessibilityRole="button" style={styles.barDiscard} onPress={() => setSelected(saved)} disabled={isSaving}>
                                <Text style={styles.barDiscardText}>Discard</Text>
                            </Pressable>
                            <Pressable accessibilityRole="button" style={[styles.barSave, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.barSaveText}>Save</Text>}
                            </Pressable>
                        </>
                    ) : (
                        <View style={styles.savedNote}>
                            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                            <Text style={styles.savedNoteText}>Saved</Text>
                        </View>
                    )}
                </Animated.View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 24,
        },
        intro: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 16,
        },
        introStrong: {
            fontFamily: "sans-bold",
            color: theme.primary,
        },
        // Same card-with-title-inside as the rest of the app.
        section: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 16,
        },
        sectionTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: theme.primary,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            paddingBottom: 10,
            marginBottom: 12,
        },
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 10,
        },
        // Two per row, all the same size.
        tile: {
            width: "48.5%",
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            backgroundColor: theme.background,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        tileSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "12",
        },
        tileIcon: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
        },
        tileIconSelected: {
            backgroundColor: theme.accent,
        },
        tileText: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 13,
            lineHeight: 17,
            color: theme.primary,
        },
        tileTextSelected: {
            fontFamily: "sans-bold",
        },
        bar: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 20,
            paddingTop: 12,
            backgroundColor: theme.card,
            borderTopWidth: 1,
            borderTopColor: theme.border,
        },
        barText: {
            flex: 1,
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        barDiscard: {
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        barDiscardText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        barSave: {
            minWidth: 96,
            alignItems: "center",
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingHorizontal: 22,
            paddingVertical: 12,
        },
        barSaveText: {
            ...BUTTON_TEXT,
            color: "#fff",
        },
        savedNote: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 12,
        },
        savedNoteText: {
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.success,
        },
    });
