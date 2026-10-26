import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { haptics } from "@/shared/utils/haptics";

/** Track padding around the segments; the sliding card sits inside it. */
const TRACK_PADDING = 3;

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
 * card that slides to the picked segment. Used for the main views of a screen (Members'
 * Active/Due/Left/All, Payments' Received/Due).
 */
export function SegmentedControl<K extends string>({ segments, value, onChange }: { segments: Segment<K>[]; value: K; onChange: (key: K) => void }) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const [trackWidth, setTrackWidth] = useState(0);
    const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / segments.length : 0;
    const index = Math.max(0, segments.findIndex((segment) => segment.key === value));

    // Jumps into place on first layout, then springs to each new pick.
    const x = useSharedValue(0);
    const [placed, setPlaced] = useState(false);
    useEffect(() => {
        if (segmentWidth === 0) return;
        if (placed) {
            x.value = withSpring(index * segmentWidth, { damping: 20, stiffness: 260, mass: 0.6 });
        } else {
            x.value = index * segmentWidth;
            setPlaced(true);
        }
    }, [index, segmentWidth, placed, x]);
    const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

    return (
        <View style={styles.track} accessibilityRole="tablist" onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            {segmentWidth > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} />}
            {segments.map((segment) => {
                const selected = segment.key === value;
                return (
                    <Pressable
                        key={segment.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={segment.count !== undefined ? `${segment.label}, ${segment.count}` : segment.label}
                        style={styles.segment}
                        onPress={() => {
                            if (selected) return;
                            haptics.selection();
                            onChange(segment.key);
                        }}
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
    ScaledSheet.create({
        track: {
            flexDirection: "row",
            padding: TRACK_PADDING,
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
        // The raised card under the selected segment.
        indicator: {
            position: "absolute",
            top: TRACK_PADDING,
            bottom: TRACK_PADDING,
            left: TRACK_PADDING,
            borderRadius: RADIUS.sm + 1,
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
