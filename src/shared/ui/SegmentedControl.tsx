import { Pressable, StyleSheet, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

export interface Segment<K extends string> {
    key: K;
    label: string;
    /** Shown after the label, e.g. a count. */
    count?: number | string;
    /** Colours the count red (e.g. people who owe money). */
    alert?: boolean;
}

/**
 * iOS-style segmented control: equal segments in a muted track, the selected one raised on a
 * card. Used for the main views of a screen (Members' Active/Due/Left/All, Payments' Received/Due).
 */
export function SegmentedControl<K extends string>({ segments, value, onChange }: { segments: Segment<K>[]; value: K; onChange: (key: K) => void }) {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={styles.track} accessibilityRole="tablist">
            {segments.map((segment) => {
                const selected = segment.key === value;
                return (
                    <Pressable
                        key={segment.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={segment.count !== undefined ? `${segment.label}, ${segment.count}` : segment.label}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        onPress={() => onChange(segment.key)}
                    >
                        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                            {segment.label}
                        </Text>
                        {segment.count !== undefined && <Text style={[styles.count, segment.alert && styles.countAlert]}>{segment.count}</Text>}
                    </Pressable>
                );
            })}
        </View>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        track: {
            flexDirection: "row",
            padding: 3,
            borderRadius: RADIUS.md,
            backgroundColor: theme.muted,
        },
        segment: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingVertical: 8,
            borderRadius: RADIUS.sm + 1,
        },
        segmentSelected: {
            backgroundColor: theme.card,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 1,
        },
        label: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        labelSelected: {
            fontFamily: "sans-semibold",
            color: theme.primary,
        },
        count: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        countAlert: {
            color: theme.destructive,
        },
    });
