import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";

interface PhotoPickerSlotProps {
    label: string;
    uri: string | null;
    onAdd: () => void;
    onRemove: () => void;
}

/** A labeled photo slot: empty "Add Photo" button, or a preview with remove/change actions. */
export function PhotoPickerSlot({ label, uri, onAdd, onRemove }: PhotoPickerSlotProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            {uri ? (
                <View style={styles.previewWrap}>
                    <Image source={{ uri }} style={styles.preview} />
                    <Pressable accessibilityRole="button" style={styles.removeBtn} onPress={onRemove}>
                        <Ionicons name="close" size={16} color="#fff" />
                    </Pressable>
                    <Pressable accessibilityRole="button" style={styles.changeBtn} onPress={onAdd}>
                        <Text style={styles.changeBtnText}>Change Photo</Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable accessibilityRole="button" style={styles.addBtn} onPress={onAdd}>
                    <Ionicons name="camera-outline" size={18} color={theme.primary} />
                    <Text style={styles.addBtnText}>Add Photo</Text>
                </Pressable>
            )}
        </View>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        wrap: {
            marginBottom: 16,
        },
        label: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: theme.primary,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        previewWrap: {
            position: "relative",
            borderRadius: RADIUS.md,
            overflow: "hidden",
        },
        preview: {
            width: "100%",
            height: 160,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
        },
        removeBtn: {
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 14,
            width: 28,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
        },
        changeBtn: {
            position: "absolute",
            bottom: 8,
            right: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: RADIUS.sm,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        changeBtnText: {
            fontFamily: "sans-bold",
            fontSize: 12,
            color: "#fff",
        },
        addBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            borderStyle: "dashed",
            paddingVertical: 16,
        },
        addBtnText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
    });
