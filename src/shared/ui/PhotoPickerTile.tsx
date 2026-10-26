import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

interface PhotoPickerTileProps {
    label: string;
    hint?: string;
    uri: string | null;
    onAdd: () => void;
    onRemove: () => void;
}

/**
 * A compact square photo slot, sized to sit two-up in a row (e.g. ID front + back).
 * Empty: dashed tile with a camera icon. Filled: thumbnail with remove (x) and tap-to-change.
 */
export function PhotoPickerTile({ label, hint, uri, onAdd, onRemove }: PhotoPickerTileProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={styles.wrap}>
            {uri ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label} photo`} style={styles.tile} onPress={onAdd}>
                    <Image source={{ uri }} style={styles.preview} transition={150} />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} photo`} style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
                        <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                </Pressable>
            ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label} photo`} style={[styles.tile, styles.tileEmpty]} onPress={onAdd}>
                    <Ionicons name="camera-outline" size={24} color={theme.accent} />
                    <Text style={styles.addText}>Add photo</Text>
                </Pressable>
            )}
            <Text style={styles.label}>
                {label}
                {hint ? <Text style={styles.hint}> {hint}</Text> : null}
            </Text>
        </View>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
        wrap: {
            flex: 1,
        },
        tile: {
            aspectRatio: 1.4,
            borderRadius: RADIUS.md,
            overflow: "hidden",
            backgroundColor: theme.card,
        },
        tileEmpty: {
            borderWidth: 1.5,
            borderColor: theme.border,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
        },
        preview: {
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
        addText: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.primary,
        },
        label: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.primary,
            marginTop: 8,
            textAlign: "center",
        },
        hint: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
    });
