import { Pressable, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { SelectOption } from "@/shared/ui/SelectField";
import { Text } from "@/shared/ui/Text";
import { haptics } from "@/shared/utils/haptics";

interface ChoiceChipsProps<T extends string> {
    label: string;
    value: T | null;
    options: SelectOption<T>[];
    onChange: (value: T | null) => void;
    /** Tapping the selected chip again clears it - use for optional fields. */
    allowDeselect?: boolean;
    /** Just the chips: no label and no space below, for forms that label fields themselves. */
    bare?: boolean;
}

/**
 * A single-choice row of chips: one tap to pick, everything visible at once.
 * Prefer this over SelectField for ~3 short options; SelectField scales better beyond that.
 */
export function ChoiceChips<T extends string>({ label, value, options, onChange, allowDeselect = false, bare = false }: ChoiceChipsProps<T>) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={!bare && styles.wrap}>
            {!bare && <Text style={styles.label}>{label}</Text>}
            <View style={styles.row} accessibilityRole="radiogroup">
                {options.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <Pressable
                            key={option.value}
                            accessibilityRole="radio"
                            accessibilityLabel={bare ? `${label}: ${option.label}` : option.label}
                            accessibilityState={{ selected: isSelected }}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                            onPress={() => {
                                if (!isSelected) haptics.selection();
                                onChange(isSelected && allowDeselect ? null : option.value);
                            }}>
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
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
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.primary,
        },
        chipTextSelected: {
            fontFamily: "sans-semibold",
            color: "#fff",
        },
    });
