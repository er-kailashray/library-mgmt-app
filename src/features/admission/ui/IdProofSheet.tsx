import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_OPTIONS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { PhotoPickerTile } from "@/shared/ui/PhotoPickerTile";

export interface IdProofDraft {
    type: IdProofType;
    frontUri: string;
    backUri: string | null;
}

interface AddIdProofCardProps {
    title: string;
    onAdd: () => void;
}

/** Dashed empty-state card shown before any ID proof exists, with an "Add ID Proof" button. */
export function AddIdProofCard({ title, onAdd }: AddIdProofCardProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={[styles.card, styles.cardEmpty]}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                    <Ionicons name="card-outline" size={20} color={theme.mutedForeground} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>Aadhaar, PAN, driving licence or college ID</Text>
                </View>
            </View>
            <Pressable accessibilityRole="button" style={styles.addBtn} onPress={onAdd}>
                <Ionicons name="add" size={18} color={theme.accent} />
                <Text style={styles.addBtnText}>Add ID Proof</Text>
            </Pressable>
        </View>
    );
}

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

                    <ChoiceChips label="ID Type" value={type} options={ID_PROOF_TYPE_OPTIONS} onChange={setType} />

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
        card: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 16,
            gap: 14,
        },
        cardEmpty: {
            borderStyle: "dashed",
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
        },
        cardIcon: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
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
        addBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 42,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent + "15",
        },
        addBtnText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.accent,
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
