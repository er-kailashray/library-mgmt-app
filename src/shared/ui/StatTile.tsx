import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";

interface StatTileProps {
    label: string;
    value: string;
    icon?: keyof typeof Ionicons.glyphMap;
    accentColor?: string;
}

/** A small label-above-value tile, used for compact stat rows (occupancy, dues breakdown, …). */
export function StatTile({ label, value, icon, accentColor }: StatTileProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const color = accentColor ?? theme.primary;

    return (
        <View style={styles.tile}>
            {icon && (
                <View style={[styles.iconCircle, accentColor && { backgroundColor: accentColor + "15" }]}>
                    <Ionicons name={icon} size={16} color={color} />
                </View>
            )}
            <Text style={[styles.value, { color }]}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        tile: {
            flex: 1,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: 14,
            paddingHorizontal: 12,
        },
        iconCircle: {
            width: 28,
            height: 28,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
        },
        value: {
            fontFamily: "sans-extrabold",
            fontSize: 18,
            marginBottom: 2,
        },
        label: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
        },
    });
