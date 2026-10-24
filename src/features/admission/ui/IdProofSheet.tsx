import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_OPTIONS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { PhotoPickerTile } from "@/shared/ui/PhotoPickerTile";

export interface IdProofDraft {
    type: IdProofType;
    frontUri: string;
    backUri: string | null;
}

interface AddIdProofCardProps {
    onAdd: () => void;
}

/** Shown before any ID proof exists: one tappable card. The ID types are listed in the sheet it opens. */
export function AddIdProofCard({ onAdd }: AddIdProofCardProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <Pressable accessibilityRole="button" accessibilityLabel="Add ID proof" style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.85 }]} onPress={onAdd}>
            <View style={styles.addCardIcon}>
                <MaterialCommunityIcons name="card-account-details-outline" size={22} color={theme.accent} />
            </View>
            <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Add ID proof</Text>
                <Text style={styles.cardSubtitle}>Take a photo or pick one from your gallery</Text>
            </View>
            <View style={styles.addCardPlus}>
                <Ionicons name="add" size={20} color="#fff" />
            </View>
        </Pressable>
    );
}

/** An icon per ID type, so the choices are easy to tell apart at a glance. */
const ID_TYPE_ICONS: Record<IdProofType, keyof typeof MaterialCommunityIcons.glyphMap> = {
    aadhaar: "card-account-details-outline",
    pan: "card-text-outline",
    voter_id_dl: "license",
    student_id: "school-outline",
    other: "file-document-outline",
};

interface IdProofSheetProps {
    visible: boolean;
    onClose: () => void;
    /** Pre-fills the sheet, e.g. when editing a draft that hasn't been uploaded yet. May be partial. */
    initial?: Partial<IdProofDraft> | null;
    onSave: (draft: IdProofDraft) => void;
    isSaving?: boolean;
    title?: string;
    saveLabel?: string;
}

/** Bottom sheet to pick an ID type and photograph the front (required) and back (optional). */
export function IdProofSheet({ visible, onClose, initial, onSave, isSaving = false, title = "Add ID Proof", saveLabel = "Save ID Proof" }: IdProofSheetProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);

    const [type, setType] = useState<IdProofType | null>(null);
    const [frontUri, setFrontUri] = useState<string | null>(null);
    const [backUri, setBackUri] = useState<string | null>(null);

    // Start from the given draft (or blank) each time the sheet opens. Keyed on `visible` only, so a
    // caller passing a fresh `initial` object every render doesn't wipe what the owner just picked.
    useEffect(() => {
        if (!visible) return;
        setType(initial?.type ?? null);
        setFrontUri(initial?.frontUri ?? null);
        setBackUri(initial?.backUri ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const pickImage = async (side: IdProofSide, source: "camera" | "gallery") => {
        // The gallery uses the system photo picker, which needs no permission.
        if (source === "camera") {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Permission needed", "Please allow camera access to photograph the ID proof.");
                return;
            }
        }

        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, allowsEditing: true };
        const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (!result.canceled && result.assets[0]) {
            (side === "front" ? setFrontUri : setBackUri)(result.assets[0].uri);
        }
    };

    const askImageSource = (side: IdProofSide) => {
        Alert.alert(`Add ${side === "front" ? "Front" : "Back"} Photo`, undefined, [
            { text: "Take Photo", onPress: () => pickImage(side, "camera") },
            { text: "Choose from Gallery", onPress: () => pickImage(side, "gallery") },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    const canSave = !!type && !!frontUri && !isSaving;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={styles.sheetWrap}>
                <View style={[styles.sheet, { paddingBottom: 32 + insets.bottom }]}>
                    <Text style={styles.sheetTitle}>{title}</Text>

                    <Text style={styles.label}>ID Type</Text>
                    {/* Equal-size tiles, two per row, so long and short names line up. */}
                    <View style={styles.typeGrid} accessibilityRole="radiogroup">
                        {ID_PROOF_TYPE_OPTIONS.map((option) => {
                            const selected = type === option.value;
                            return (
                                <Pressable
                                    key={option.value}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                    style={[styles.typeTile, selected && styles.typeTileSelected]}
                                    onPress={() => setType(option.value)}>
                                    <MaterialCommunityIcons name={ID_TYPE_ICONS[option.value]} size={22} color={selected ? theme.accent : theme.mutedForeground} />
                                    <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]} numberOfLines={2}>
                                        {option.label}
                                    </Text>
                                    {selected && <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.typeCheck} />}
                                </Pressable>
                            );
                        })}
                    </View>

                    <Text style={styles.label}>Photos</Text>
                    <View style={styles.tileRow}>
                        <PhotoPickerTile label="Front" uri={frontUri} onAdd={() => askImageSource("front")} onRemove={() => setFrontUri(null)} />
                        <PhotoPickerTile label="Back" hint="(optional)" uri={backUri} onAdd={() => askImageSource("back")} onRemove={() => setBackUri(null)} />
                    </View>

                    <Pressable
                        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                        onPress={() => type && frontUri && onSave({ type, frontUri, backUri })}
                        disabled={!canSave}>
                        {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{saveLabel}</Text>}
                    </Pressable>
                    {(!type || !frontUri) && <Text style={styles.sheetHint}>{!type ? "Pick the ID type, then add a front photo." : "Add a photo of the front side to save."}</Text>}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        addCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
        },
        addCardIcon: {
            width: 44,
            height: 44,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent + "1A",
            alignItems: "center",
            justifyContent: "center",
        },
        addCardPlus: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
        },
        cardHeaderText: {
            flex: 1,
        },
        cardTitle: {
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
        },
        cardSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        sheetWrap: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
        },
        sheet: {
            backgroundColor: theme.background,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
            padding: 24,
        },
        sheetTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 18,
            color: theme.primary,
            marginBottom: 20,
        },
        label: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: theme.primary,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        typeGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 10,
            marginBottom: 20,
        },
        // Two per row at a fixed height; an odd last tile keeps the same size.
        typeTile: {
            width: "48.5%",
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingLeft: 12,
            // Room for the corner check so a two-line label never runs under it.
            paddingRight: 24,
            paddingVertical: 10,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        typeTileSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "12",
        },
        typeLabel: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 13,
            lineHeight: 17,
            color: theme.primary,
        },
        typeLabelSelected: {
            fontFamily: "sans-bold",
        },
        typeCheck: {
            position: "absolute",
            top: 6,
            right: 6,
        },
        tileRow: {
            flexDirection: "row",
            gap: 12,
            marginBottom: 20,
        },
        saveBtn: {
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            alignItems: "center",
        },
        saveBtnDisabled: {
            opacity: 0.5,
        },
        saveBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
        sheetHint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: "center",
            marginTop: 10,
        },
    });
