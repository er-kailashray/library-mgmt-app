import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteLibraryPhotoApi, getLibraryProfileApi, uploadLibraryPhotoApi } from "@/features/library-profile/logic/library-profile-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

const MAX_PHOTOS = 10;

export function LibraryPhotosScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);
    const photos = profile?.photos ?? [];

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const pickAndUpload = useCallback(
        async (source: "camera" | "gallery") => {
            const permission =
                source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permission.granted) {
                Alert.alert("Permission needed", `Please allow ${source === "camera" ? "camera" : "photo library"} access to add a photo.`);
                return;
            }

            const result =
                source === "camera"
                    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
                    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });

            if (result.canceled || !result.assets[0]) return;

            try {
                setIsUploading(true);
                await uploadLibraryPhotoApi(result.assets[0].uri);
                await refetch();
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to upload photo.");
            } finally {
                setIsUploading(false);
            }
        },
        [refetch]
    );

    const handleAddPhoto = useCallback(() => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert("Limit reached", `You can add up to ${MAX_PHOTOS} photos.`);
            return;
        }
        Alert.alert("Add Photo", undefined, [
            { text: "Take Photo", onPress: () => pickAndUpload("camera") },
            { text: "Choose from Gallery", onPress: () => pickAndUpload("gallery") },
            { text: "Cancel", style: "cancel" },
        ]);
    }, [photos.length, pickAndUpload]);

    const handleDeletePhoto = useCallback(
        (id: number) => {
            Alert.alert("Remove photo?", "This photo will be removed from your library's gallery.", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setDeletingId(id);
                            await deleteLibraryPhotoApi(id);
                            await refetch();
                        } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to remove photo.");
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ]);
        },
        [refetch]
    );

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Manage Photos" subtitle={`${photos.length} / ${MAX_PHOTOS} photos`} />

                {isLoading ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        <View style={styles.grid}>
                            {photos.map((photo) => (
                                <View key={photo.id} style={styles.photoTile}>
                                    <Image source={{ uri: photo.url }} style={styles.photoImage} />
                                    <Pressable
                                        accessibilityRole="button"
                                        style={styles.removeBtn}
                                        onPress={() => handleDeletePhoto(photo.id)}
                                        disabled={deletingId === photo.id}>
                                        {deletingId === photo.id ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="close" size={16} color="#fff" />}
                                    </Pressable>
                                </View>
                            ))}

                            {photos.length < MAX_PHOTOS && (
                                <Pressable style={styles.addTile} onPress={handleAddPhoto} disabled={isUploading}>
                                    {isUploading ? (
                                        <ActivityIndicator color={theme.primary} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="camera-outline" size={28} color={theme.mutedForeground} />
                                            <Text style={styles.addTileText}>Add Photo</Text>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>

                        {photos.length === 0 && <Text style={styles.emptyText}>Add a few photos of your library - these help members know what to expect.</Text>}
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
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 24,
        },
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
        },
        photoTile: {
            width: "31%",
            aspectRatio: 1,
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            backgroundColor: theme.card,
        },
        photoImage: {
            width: "100%",
            height: "100%",
        },
        removeBtn: {
            position: "absolute",
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
        },
        addTile: {
            width: "31%",
            aspectRatio: 1,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
        },
        addTileText: {
            fontFamily: "sans-bold",
            fontSize: 11,
            color: theme.mutedForeground,
        },
        emptyText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 20,
            textAlign: "center",
        },
    });
