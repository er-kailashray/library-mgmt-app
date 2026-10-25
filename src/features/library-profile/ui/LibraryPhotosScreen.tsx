import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteLibraryPhotoApi, getLibraryProfileApi, uploadLibraryPhotoApi } from "@/features/library-profile/logic/library-profile-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { PhotoViewer } from "@/shared/ui/PhotoViewer";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text } from "@/shared/ui/Text";

const MAX_PHOTOS = 10;
/** Longest side of an uploaded photo, in pixels. */
const MAX_PHOTO_EDGE = 1920;
const COLUMNS = 3;
const GRID_GAP = 12;
const SIDE_PADDING = 20;

/**
 * The backend takes JPG/PNG up to 5 MB, but gallery originals are often HEIC or larger than that.
 * Re-saving as a JPEG no bigger than MAX_PHOTO_EDGE always passes and keeps the gallery quick to load.
 */
async function toUploadableJpeg(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > MAX_PHOTO_EDGE) {
        context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return saved.uri;
}

export function LibraryPhotosScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    // Exact pixel squares: percentage widths with aspectRatio left the add tile's icon off-centre
    // and the last column short of the edge.
    const tileSize = Math.floor((width - SIDE_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);
    const tileStyle = { width: tileSize, height: tileSize };
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const { data: profile, isLoading, error, refetch } = useApiData(getLibraryProfileApi, []);
    const photos = profile?.photos ?? [];

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    // Several gallery picks upload one after another; this drives the "2 / 4" on the add tile.
    const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
    const isUploading = uploadProgress !== null;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const remainingSlots = MAX_PHOTOS - photos.length;

    const pickAndUpload = useCallback(
        async (source: "camera" | "gallery") => {
            // The gallery uses the system photo picker, which needs no permission (asking for it
            // only blocked the gallery for anyone who had once said no).
            if (source === "camera") {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert("Permission needed", "Please allow camera access to take a photo.");
                    return;
                }
            }

            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ["images"],
                quality: 0.7,
                // iOS: hand back a JPEG-compatible copy rather than the HEIC original.
                preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            };
            const result =
                source === "camera"
                    ? await ImagePicker.launchCameraAsync(options)
                    : await ImagePicker.launchImageLibraryAsync({
                          ...options,
                          // Pick several at once, up to the free slots; ordered so they upload in the order tapped.
                          allowsMultipleSelection: remainingSlots > 1,
                          selectionLimit: remainingSlots,
                          orderedSelection: true,
                      });

            if (result.canceled || result.assets.length === 0) return;
            // Older Android pickers ignore selectionLimit, so never send more than there's room for.
            const assets = result.assets.slice(0, remainingSlots);
            const skipped = result.assets.length - assets.length;

            // One at a time, so a bad photo doesn't stop the rest and the backend's limit check stays accurate.
            const failures: string[] = [];
            setUploadProgress({ done: 0, total: assets.length });
            for (const [index, asset] of assets.entries()) {
                try {
                    await uploadLibraryPhotoApi(await toUploadableJpeg(asset));
                } catch (err: any) {
                    failures.push(err.message || "Failed to upload photo.");
                }
                setUploadProgress({ done: index + 1, total: assets.length });
            }
            await refetch();
            setUploadProgress(null);

            if (failures.length > 0) {
                const uploaded = assets.length - failures.length;
                Alert.alert(
                    uploaded > 0 ? `${uploaded} of ${assets.length} photos added` : assets.length > 1 ? "Photos not added" : "Photo not added",
                    [...new Set(failures)].join("\n")
                );
            } else if (skipped > 0) {
                Alert.alert("Limit reached", `Added ${assets.length}. You can have up to ${MAX_PHOTOS} photos, so ${skipped} weren't added.`);
            }
        },
        [refetch, remainingSlots]
    );

    const handleAddPhoto = useCallback(() => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert("Limit reached", `You can add up to ${MAX_PHOTOS} photos.`);
            return;
        }
        Alert.alert("Add Photos", remainingSlots > 1 ? `You can add ${remainingSlots} more.` : "You can add 1 more.", [
            { text: "Take Photo", onPress: () => pickAndUpload("camera") },
            { text: "Choose from Gallery", onPress: () => pickAndUpload("gallery") },
            { text: "Cancel", style: "cancel" },
        ]);
    }, [photos.length, pickAndUpload, remainingSlots]);

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
                            {photos.map((photo, index) => (
                                <View key={photo.id} style={[styles.photoTile, tileStyle]}>
                                    <Pressable accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}`} style={styles.photoImage} onPress={() => setPreviewIndex(index)}>
                                        <Image source={{ uri: photo.url }} style={styles.photoImage} transition={150} />
                                    </Pressable>
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
                                <Pressable accessibilityRole="button" accessibilityLabel="Add photo" style={[styles.addTile, tileStyle]} onPress={handleAddPhoto} disabled={isUploading}>
                                    {uploadProgress ? (
                                        <>
                                            <ActivityIndicator color={theme.primary} size="small" />
                                            {uploadProgress.total > 1 && (
                                                <Text style={styles.addTileText}>
                                                    Uploading {Math.min(uploadProgress.done + 1, uploadProgress.total)} / {uploadProgress.total}
                                                </Text>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons name="camera-outline" size={28} color={theme.mutedForeground} />
                                            <Text style={styles.addTileText}>Add Photos</Text>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>

                        {photos.length === 0 && <Text style={styles.emptyText}>Add a few photos of your library - these help members know what to expect.</Text>}
                    </ScrollView>
                )}

                <PhotoViewer
                    visible={previewIndex !== null}
                    photos={photos.map((photo) => ({ key: String(photo.id), uri: photo.url }))}
                    initialIndex={previewIndex ?? 0}
                    onClose={() => setPreviewIndex(null)}
                />
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
            paddingHorizontal: SIDE_PADDING,
            paddingTop: 24,
        },
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: GRID_GAP,
        },
        photoTile: {
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
