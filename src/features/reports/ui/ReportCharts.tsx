import { StyleSheet, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

const BAR_AREA_HEIGHT = 120;

type Bar = { key: string; label: string; value: number; caption: string };

/**
 * Vertical bars, one per month, scaled to the largest. The last bar (the current month) is
 * coral and the rest muted, so "now" stands out against the trend.
 */
export function BarChart({ bars, accessibilityLabel }: { bars: Bar[]; accessibilityLabel: string }) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const max = Math.max(...bars.map((bar) => bar.value), 0);
    // Twelve months of captions don't fit; show them for the current month and the peak only.
    const showAllCaptions = bars.length <= 6;
    const peakIndex = bars.findIndex((bar) => bar.value === max);

    return (
        <View style={styles.chart} accessible accessibilityLabel={accessibilityLabel}>
            {bars.map((bar, index) => {
                const isCurrent = index === bars.length - 1;
                const height = max > 0 ? Math.max(3, (Math.max(bar.value, 0) / max) * BAR_AREA_HEIGHT) : 3;
                const showCaption = showAllCaptions || isCurrent || index === peakIndex;
                return (
                    <View key={bar.key} style={styles.column}>
                        <Text style={[styles.caption, isCurrent && styles.captionCurrent]} numberOfLines={1}>
                            {showCaption ? bar.caption : " "}
                        </Text>
                        <View style={styles.barArea}>
                            <View style={[styles.bar, { height, backgroundColor: isCurrent ? theme.accent : theme.mutedForeground + "40" }]} />
                        </View>
                        <Text style={[styles.label, isCurrent && styles.labelCurrent]}>{bar.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

/** A labelled horizontal bar: "Morning      3 / 10" over a filled track. `percent` is 0-100. */
export function MeterRow({ label, value, percent, color }: { label: string; value: string; percent: number; color?: string }) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const width = `${Math.min(100, Math.max(0, percent))}%` as const;

    return (
        <View style={styles.meter} accessible accessibilityLabel={`${label}: ${value}`}>
            <View style={styles.meterHeader}>
                <Text style={styles.meterLabel} numberOfLines={1}>
                    {label}
                </Text>
                <Text style={styles.meterValue}>{value}</Text>
            </View>
            <View style={styles.track}>
                <View style={[styles.fill, { width, backgroundColor: color ?? theme.accent }]} />
            </View>
        </View>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        chart: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 6,
            marginTop: 8,
        },
        column: {
            flex: 1,
            alignItems: "center",
        },
        caption: {
            fontFamily: "sans-semibold",
            fontSize: 10,
            color: theme.mutedForeground,
            marginBottom: 4,
        },
        captionCurrent: {
            color: theme.accent,
            fontFamily: "sans-bold",
        },
        barArea: {
            height: BAR_AREA_HEIGHT,
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
        },
        bar: {
            width: "70%",
            maxWidth: 28,
            borderRadius: 4,
        },
        label: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
            marginTop: 6,
        },
        labelCurrent: {
            fontFamily: "sans-bold",
            color: theme.primary,
        },
        meter: {
            marginTop: 12,
        },
        meterHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 6,
        },
        meterLabel: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 14,
            color: theme.primary,
        },
        meterValue: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        track: {
            height: 8,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
            overflow: "hidden",
        },
        fill: {
            height: "100%",
            borderRadius: RADIUS.sm,
        },
    });
