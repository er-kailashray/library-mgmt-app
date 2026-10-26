import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, useWindowDimensions, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

/** Cards are a fixed width, so any of them can be scrolled into view without measuring. */
const CARD_WIDTH = 148;
const GAP = 10;
const SIDE_PADDING = 20;

export interface BatchSwitcherItem<K extends string | number> {
    key: K;
    title: string;
    /** Second line, usually the batch's time. */
    caption: string;
    /** The bar and "filled/total" count: seats taken (Seats) or members checked in (Attendance). */
    filled: number;
    total: number;
    /** A small coral tag after the title, e.g. "Now" on the batch that's running. */
    tag?: string;
}

/**
 * A horizontal row of batch cards (name, time, a bar of how full / how far along it is) that keeps
 * the selected card in view: centred when picked, and already showing when the screen opens on a
 * batch at the far end.
 *
 * `meter`: "occupancy" colours the bar by fullness (coral, then amber at 80%, red when full);
 * "progress" fills it green as people check in.
 */
export function BatchSwitcher<K extends string | number>({
    items,
    selectedKey,
    onSelect,
    meter,
}: {
    items: BatchSwitcherItem<K>[];
    selectedKey: K | null;
    onSelect: (key: K) => void;
    meter: "occupancy" | "progress";
}) {
    const { theme } = useTheme();
    const { width: screenWidth } = useWindowDimensions();
    const styles = createStyles(theme);
    const scrollRef = useRef<ScrollViewInstance>(null);

    const index = items.findIndex((item) => item.key === selectedKey);
    const scrollToSelected = useCallback(
        (animated: boolean) => {
            if (index < 0) return;
            const contentWidth = SIDE_PADDING * 2 + items.length * CARD_WIDTH + (items.length - 1) * GAP;
            const left = SIDE_PADDING + index * (CARD_WIDTH + GAP);
            const x = left - (screenWidth - CARD_WIDTH) / 2;
            scrollRef.current?.scrollTo({ x: Math.max(0, Math.min(x, contentWidth - screenWidth)), animated });
        },
        [index, items.length, screenWidth]
    );
    useEffect(() => {
        scrollToSelected(true);
    }, [scrollToSelected]);

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            // First layout: jump straight to the selected card, without animating from the start.
            onContentSizeChange={() => scrollToSelected(false)}
        >
            {items.map((item) => {
                const selected = item.key === selectedKey;
                const ratio = item.total > 0 ? Math.min(1, item.filled / item.total) : 0;
                const fill =
                    meter === "progress" ? theme.success : ratio >= 1 ? theme.destructive : ratio >= 0.8 ? theme.warning : theme.accent;
                return (
                    <Pressable
                        key={String(item.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${item.title}, ${item.caption}, ${item.filled} of ${item.total}${item.tag ? `, ${item.tag}` : ""}`}
                        onPress={() => onSelect(item.key)}
                        style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
                    >
                        <View style={styles.top}>
                            <Text style={[styles.title, selected && { color: theme.accent }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            {item.tag ? <Text style={styles.tag}>{item.tag}</Text> : null}
                        </View>
                        <Text style={styles.caption} numberOfLines={1}>
                            {item.caption}
                        </Text>
                        <View style={styles.bottom}>
                            <View style={styles.track}>
                                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill }]} />
                            </View>
                            <Text style={styles.count}>
                                {item.filled}/{item.total}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        row: {
            gap: GAP,
            paddingHorizontal: SIDE_PADDING,
            paddingTop: 16,
            paddingBottom: 4,
        },
        card: {
            width: CARD_WIDTH,
            padding: 12,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        cardSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "0D",
        },
        pressed: {
            opacity: 0.75,
        },
        top: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        title: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        tag: {
            fontFamily: "sans-semibold",
            fontSize: 10,
            color: "#fff",
            backgroundColor: theme.accent,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: RADIUS.sm,
            overflow: "hidden",
        },
        caption: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        bottom: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
        },
        track: {
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.muted,
            overflow: "hidden",
        },
        fill: {
            height: "100%",
            borderRadius: 2,
        },
        count: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.primary,
        },
    });
