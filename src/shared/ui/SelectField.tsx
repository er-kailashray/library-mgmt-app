import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Text } from "@/shared/ui/Text";

export interface SelectOption<T extends string> {
    value: T;
    label: string;
}

interface SelectFieldProps<T extends string> {
    label: string;
    placeholder: string;
    value: T | null;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
}

/**
 * A tappable field that opens a bottom-sheet list to pick one option - the
 * mobile-native equivalent of a <select>. Prefer this over a row of chips
 * once there are more than ~3 options or any label is long enough to wrap.
 */
export function SelectField<T extends string>({ label, placeholder, value, options, onChange }: SelectFieldProps<T>) {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const styles = createStyles(theme);

    const selectedLabel = options.find((o) => o.value === value)?.label;

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            <Pressable accessibilityRole="button" style={styles.field} onPress={() => setIsOpen(true)}>
                <Text style={[styles.fieldText, !selectedLabel && styles.placeholderText]}>{selectedLabel || placeholder}</Text>
                <Ionicons name="chevron-down" size={18} color={theme.mutedForeground} />
            </Pressable>

            <BottomSheet visible={isOpen} onClose={() => setIsOpen(false)} title={label}>
                <FlatList
                    data={options}
                    keyExtractor={(item) => item.value}
                    style={{ maxHeight: 360 }}
                    renderItem={({ item }) => {
                        const isSelected = item.value === value;
                        return (
                            <Pressable
                                style={styles.optionRow}
                                onPress={() => {
                                    onChange(item.value);
                                    setIsOpen(false);
                                }}>
                                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item.label}</Text>
                                {isSelected && <Ionicons name="checkmark" size={20} color={theme.accent} />}
                            </Pressable>
                        );
                    }}
                />
            </BottomSheet>
        </View>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
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
        field: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: theme.border,
        },
        fieldText: {
            fontFamily: "sans-medium",
            fontSize: 15,
            color: theme.primary,
        },
        placeholderText: {
            color: theme.mutedForeground,
        },
        optionRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
        },
        optionText: {
            fontFamily: "sans-medium",
            fontSize: 15,
            color: theme.primary,
        },
        optionTextSelected: {
            fontFamily: "sans-bold",
            color: theme.accent,
        },
    });
