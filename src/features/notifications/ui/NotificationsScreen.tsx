import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getNotificationsApi, markNotificationsReadApi } from "@/features/notifications/logic/notifications-api";
import { setUnreadCount } from "@/features/notifications/logic/unread-count";
import { OwnerNotification } from "@/features/notifications/types/notifications.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { formatShortDate, todayIso, toIsoDate, addDays } from "@/shared/utils/dates";

type Look = { icon: keyof typeof Ionicons.glyphMap; color: (theme: Theme) => string };

/** Icon and colour per alert type; anything unknown gets the bell. */
const LOOKS: Record<string, Look> = {
    renewals_due: { icon: "refresh", color: (t) => t.accent },
    dues_summary: { icon: "wallet", color: (t) => t.warning },
    subscription: { icon: "card", color: (t) => t.subscription },
};
const DEFAULT_LOOK: Look = { icon: "notifications", color: (t) => t.primary };

type Row = { kind: "day"; key: string; label: string } | { kind: "alert"; key: string; alert: OwnerNotification };

function dayLabel(iso: string): string {
    if (iso === todayIso()) return "Today";
    if (iso === addDays(todayIso(), -1)) return "Yesterday";
    return formatShortDate(iso, iso.slice(0, 4) !== todayIso().slice(0, 4));
}

function timeLabel(createdAt: string): string {
    return new Date(createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

/**
 * Alerts grouped under a heading per day, newest first. Sorted by time first: pages come in id
 * order, which isn't always time order (e.g. back-dated entries), and grouping unsorted rows
 * would repeat a day's heading.
 */
function toRows(alerts: OwnerNotification[]): Row[] {
    const sorted = [...alerts].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    const rows: Row[] = [];
    let currentDay = "";
    for (const alert of sorted) {
        const day = toIsoDate(new Date(alert.created_at));
        if (day !== currentDay) {
            currentDay = day;
            rows.push({ kind: "day", key: `day-${day}`, label: dayLabel(day) });
        }
        rows.push({ kind: "alert", key: String(alert.id), alert });
    }
    return rows;
}

/**
 * The Alerts tab: everything the owner was notified about (dues, renewals, plan reminders), so
 * nothing is lost when a push is missed. Opening it marks all as read; the dots stay on what was
 * new until the next visit, so it's still clear what just came in.
 */
export function NotificationsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [alerts, setAlerts] = useState<OwnerNotification[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedOnce = useRef(false);

    const loadFirstPage = useCallback(async (refreshing = false) => {
        try {
            if (refreshing) setIsRefreshing(true);
            else if (!loadedOnce.current) setIsLoading(true);
            setError(null);

            const response = await getNotificationsApi();
            setAlerts(response.data.items);
            setHasMore(response.data.has_more);
            loadedOnce.current = true;

            if (response.data.unread_count > 0) {
                const marked = await markNotificationsReadApi();
                setUnreadCount(marked.data.unread_count);
            } else {
                setUnreadCount(0);
            }
        } catch (err: any) {
            setError(err.message || "Couldn't load alerts.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadFirstPage();
        }, [loadFirstPage])
    );

    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || alerts.length === 0) return;
        try {
            setIsLoadingMore(true);
            const response = await getNotificationsApi(alerts[alerts.length - 1].id);
            setAlerts((current) => [...current, ...response.data.items]);
            setHasMore(response.data.has_more);
        } catch {
            // Scrolling to the end again retries.
        } finally {
            setIsLoadingMore(false);
        }
    }, [alerts, hasMore, isLoadingMore]);

    const rows = useMemo(() => toRows(alerts), [alerts]);

    const renderRow = useCallback(
        ({ item }: { item: Row }) => {
            if (item.kind === "day") {
                return <Text style={styles.dayLabel}>{item.label}</Text>;
            }
            const { alert } = item;
            const look = LOOKS[alert.type] ?? DEFAULT_LOOK;
            const color = look.color(theme);
            return (
                <Pressable
                    accessibilityRole={alert.url ? "button" : undefined}
                    style={({ pressed }) => [styles.card, !alert.read && styles.cardUnread, pressed && alert.url && styles.cardPressed]}
                    onPress={alert.url ? () => router.push(alert.url as Href) : undefined}
                >
                    <View style={[styles.iconCircle, { backgroundColor: color + "18" }]}>
                        <Ionicons name={look.icon} size={18} color={color} />
                    </View>
                    <View style={styles.cardText}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>
                                {alert.title}
                            </Text>
                            <Text style={styles.time}>{timeLabel(alert.created_at)}</Text>
                        </View>
                        <Text style={styles.body} numberOfLines={3}>
                            {alert.body}
                        </Text>
                    </View>
                    {!alert.read && <View style={styles.unreadDot} accessibilityLabel="New" />}
                </Pressable>
            );
        },
        [router, styles, theme]
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Alerts" subtitle="Dues, renewals and plan updates" />

                {isLoading ? (
                    <LoadingState />
                ) : error && alerts.length === 0 ? (
                    <ErrorState message={error} onRetry={() => void loadFirstPage()} />
                ) : (
                    <FlatList
                        data={rows}
                        keyExtractor={(row) => row.key}
                        renderItem={renderRow}
                        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + bottomInset }]}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadFirstPage(true)} tintColor={theme.accent} colors={[theme.accent]} />}
                        onEndReached={() => void loadMore()}
                        onEndReachedThreshold={0.4}
                        ListEmptyComponent={
                            <EmptyState
                                icon="notifications-outline"
                                title="No alerts yet"
                                subtitle="Each morning you'll find a summary of dues and renewals here, along with plan reminders."
                            />
                        }
                        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={theme.accent} style={styles.footerSpinner} /> : undefined}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        listContent: {
            paddingHorizontal: 20,
            paddingTop: 8,
            flexGrow: 1,
        },
        dayLabel: {
            fontFamily: "sans-bold",
            fontSize: 12,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginTop: 18,
            marginBottom: 10,
        },
        card: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 14,
            marginBottom: 10,
        },
        cardUnread: {
            borderColor: theme.accent + "40",
        },
        cardPressed: {
            opacity: 0.85,
        },
        iconCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        cardText: {
            flex: 1,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 3,
        },
        title: {
            flex: 1,
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
        },
        time: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        body: {
            fontFamily: "sans-medium",
            fontSize: 13,
            lineHeight: 19,
            color: theme.mutedForeground,
        },
        unreadDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.accent,
            marginTop: 6,
        },
        footerSpinner: {
            marginVertical: 16,
        },
    });
