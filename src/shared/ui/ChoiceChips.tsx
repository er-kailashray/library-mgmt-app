import { Pressable, StyleSheet, Text, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { SelectOption } from "@/shared/ui/SelectField";

interface ChoiceChipsProps<T extends string> {
    label: string;
    value: T | null;
    options: SelectOption<T>[];
    onChange: (value: T | null) => void;
    /** Tapping the selected chip again clears it - use for optional fields. */
    allowDeselect?: boolean;
}

/**
 * A single-choice row of chips: one tap to pick, everything visible at once.
 * Prefer this over SelectField for ~3 short options; SelectField scales better beyond that.
 */
export function ChoiceChips<T extends string>({ label, value, options, onChange, allowDeselect = false }: ChoiceChipsProps<T>) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.row} accessibilityRole="radiogroup">
                {options.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <Pressable
                            key={option.value}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                            onPress={() => onChange(isSelected && allowDeselect ? null : option.value)}>
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
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
        row: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
        },
        chip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: theme.background,
            borderRadius: RADIUS.sm,
            borderWidth: 1,
            borderColor: theme.border,
        },
        chipSelected: {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
        },
        chipText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        chipTextSelected: {
            color: "#fff",
        },
    });
