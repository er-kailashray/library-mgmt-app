import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { describePaymentPeriod, PAYMENT_STATUS_LOOK } from "@/features/payments/logic/payment-display";
import { getPaymentsApi } from "@/features/payments/logic/payments-api";
import { Payment } from "@/features/payments/types/payments.types";
import { remindAllOverdueApi, remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FloatingActionButton, FAB_CLEARANCE } from "@/shared/ui/FloatingActionButton";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Text, TextInput } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";
import { addDays, formatShortDate, fromIsoDate, todayIso } from "@/shared/utils/dates";

import { MonthPickerSheet } from "./MonthPickerSheet";
import { RecordPaymentSheet } from "./RecordPaymentSheet";

type Tab = "received" | "due";
type ReceivedFilter = "all" | "PAID" | "PARTIAL" | "REFUNDED";

const RECEIVED_FILTERS: { key: ReceivedFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "PAID", label: "Paid" },
    { key: "PARTIAL", label: "Partial" },
    { key: "REFUNDED", label: "Refunds" },
];

const AVATAR_SIZE = 40;

/** One flat list: a heading per day (Received only), then rows that share a rounded card. */
type ListItem =
    | { type: "day"; key: string; label: string; total: number }
    | { type: "payment"; key: string; payment: Payment; isFirst: boolean; isLast: boolean }
    | { type: "due"; key: string; payment: Payment; isFirst: boolean; isLast: boolean };

/** "YYYY-MM" for the current month. */
function currentMonth(): string {
    return todayIso().slice(0, 7);
}

/** "YYYY-MM" shifted by whole months. */
function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "October 2026" (or "Oct 2026") from "YYYY-MM". */
function formatMonth(month: string, short = false): string {
    return fromIsoDate(`${month}-01`).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: "numeric" });
}

function dayLabel(iso: string): string {
    if (iso === todayIso()) return "Today";
    if (iso === addDays(todayIso(), -1)) return "Yesterday";
    return fromIsoDate(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function daysSince(iso: string): number {
    return Math.max(0, Math.round((fromIsoDate(todayIso()).getTime() - fromIsoDate(iso).getTime()) / 86_400_000));
}

/** "10:42 AM" when it was entered on the day it's dated (the time the money was taken), else null. */
function timeTaken(payment: Payment): string | null {
    if (!payment.recorded_at) return null;
    const recorded = new Date(payment.recorded_at);
    const sameDay = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, "0")}-${String(recorded.getDate()).padStart(2, "0")}` === payment.date.slice(0, 10);
    return sameDay ? recorded.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase() : null;
}

/** What a payment was for: the period it covers, else the seats it was for. */
function paymentDetail(payment: Payment): string {
    const period = describePaymentPeriod(payment);
    if (period) return period;
    const seats = (payment.seats ?? []).filter((s) => s.batch_name).map((s) => `${s.batch_name} · Seat ${s.seat_number ?? "—"}`);
    return seats.join("   ");
}

const sumOf = (list: Payment[]) => list.reduce((sum, p) => sum + p.amount, 0);

/**
 * Payments: money received month by month (grouped by day, with the month's total and how it
 * compares to the month before), and who owes money now, with Remind and Collect on each. "Record
 * payment" picks the member, then opens their payment sheet, which works out the period paid for.
 */
export function PaymentsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const params = useLocalSearchParams<{ tab?: string }>();
    const [tab, setTab] = useState<Tab>(params.tab === "due" ? "due" : "received");
    const [month, setMonth] = useState(currentMonth());
    const [isMonthPickerVisible, setMonthPickerVisible] = useState(false);
    const [isRecordSheetVisible, setRecordSheetVisible] = useState(false);
    const [receivedFilter, setReceivedFilter] = useState<ReceivedFilter>("all");
    const [query, setQuery] = useState("");
    const [remindingId, setRemindingId] = useState<string | null>(null);
    const [isRemindingAll, setIsRemindingAll] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data, isLoading, error, refetch } = useApiData(getPaymentsApi, []);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    // The API returns money received (payments, partials, refunds) and current dues (PENDING) together.
    const { received, dues } = useMemo(() => {
        const payments = data ?? [];
        return { received: payments.filter((p) => p.status !== "PENDING"), dues: payments.filter((p) => p.status === "PENDING") };
    }, [data]);

    const q = query.trim().toLowerCase();
    const matches = useCallback((p: Payment) => !q || p.member_name.toLowerCase().includes(q), [q]);

    // Net of refunds (stored as negative amounts) - the same figure Home shows for the month.
    const monthReceived = useMemo(() => received.filter((p) => p.date.startsWith(month)), [received, month]);
    const monthTotal = sumOf(monthReceived);
    const previousTotal = sumOf(received.filter((p) => p.date.startsWith(shiftMonth(month, -1))));
    const monthRefunded = Math.abs(sumOf(monthReceived.filter((p) => p.status === "REFUNDED")));
    const monthCount = monthReceived.filter((p) => p.status !== "REFUNDED").length;
    const change = previousTotal > 0 ? Math.round(((monthTotal - previousTotal) / previousTotal) * 100) : null;
    const dueTotal = sumOf(dues);

    const items = useMemo((): ListItem[] => {
        if (tab === "due") {
            // Longest overdue first.
            const sorted = dues.filter(matches).sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
            return sorted.map((payment, index) => ({ type: "due" as const, key: payment.id, payment, isFirst: index === 0, isLast: index === sorted.length - 1 }));
        }
        const shown = monthReceived.filter((p) => matches(p) && (receivedFilter === "all" || p.status === receivedFilter));
        const byDay = new Map<string, Payment[]>();
        for (const payment of shown) {
            const day = payment.date.slice(0, 10);
            byDay.set(day, [...(byDay.get(day) ?? []), payment]);
        }
        return [...byDay.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .flatMap(([day, list]) => [
                { type: "day" as const, key: `day-${day}`, label: dayLabel(day), total: sumOf(list) },
                ...list.map((payment, index) => ({ type: "payment" as const, key: payment.id, payment, isFirst: index === 0, isLast: index === list.length - 1 })),
            ]);
    }, [tab, dues, monthReceived, receivedFilter, matches]);

    const openMember = (payment: Payment, collect = false) =>
        router.push({ pathname: "/members/[id]", params: { id: String(payment.member_id), ...(collect ? { collect: "1" } : {}) } });

    const handleRemind = async (payment: Payment) => {
        try {
            setRemindingId(payment.id);
            await remindMemberApi(payment.member_id);
            Alert.alert("Reminder sent", `${payment.member_name} got an SMS about the ${formatRupee(payment.amount)} due.`);
        } catch (err: any) {
            Alert.alert("Couldn't send", err.message || "Failed to send the reminder.");
        } finally {
            setRemindingId(null);
        }
    };

    const handleRemindAll = useCallback(async () => {
        try {
            setIsRemindingAll(true);
            const response = await remindAllOverdueApi();
            Alert.alert("Reminders sent", response.message || `Sent ${response.data.sent} reminder(s).`);
        } catch (err: any) {
            Alert.alert("Couldn't send", err.message || "Failed to send reminders.");
        } finally {
            setIsRemindingAll(false);
        }
    }, []);

    const subtitle = !data
        ? "Money in, and who owes"
        : `${formatRupee(sumOf(received.filter((p) => p.date.startsWith(currentMonth()))))} in ${formatMonth(currentMonth(), true).split(" ")[0]}` +
          (dues.length > 0 ? ` · ${formatRupee(dueTotal)} due from ${dues.length}` : " · nobody owes");

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === "day") {
            return (
                <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{item.label}</Text>
                    <Text style={styles.dayTotal}>{formatRupee(item.total)}</Text>
                </View>
            );
        }
        const { payment, isFirst, isLast } = item;
        const left = payment.member_status === "inactive";

        if (item.type === "due") {
            const days = daysSince(payment.date);
            const busy = remindingId === payment.id;
            return (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${payment.member_name} owes ${formatRupee(payment.amount)}`}
                    onPress={() => openMember(payment)}
                    style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}
                >
                    <View style={styles.avatar}>
                        <MemberAvatar id={payment.member_id} name={payment.member_name} size={AVATAR_SIZE} />
                    </View>
                    <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                        <View style={styles.rowTop}>
                            <View style={styles.rowText}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {payment.member_name}
                                </Text>
                                <Text style={styles.detail} numberOfLines={1}>
                                    Due since {formatShortDate(payment.date)} · {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}
                                </Text>
                            </View>
                            <Text style={[styles.amount, { color: theme.destructive }]}>{formatRupee(payment.amount)}</Text>
                        </View>
                        <View style={styles.dueActions}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remind ${payment.member_name} by SMS`}
                                style={({ pressed }) => [styles.smallBtn, pressed && styles.rowPressed]}
                                onPress={() => handleRemind(payment)}
                                disabled={busy}
                            >
                                {busy ? (
                                    <ActivityIndicator size="small" color={theme.primary} />
                                ) : (
                                    <>
                                        <Ionicons name="chatbox-ellipses-outline" size={14} color={theme.primary} />
                                        <Text style={styles.smallBtnText}>Remind</Text>
                                    </>
                                )}
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Collect from ${payment.member_name}`}
                                style={({ pressed }) => [styles.smallBtn, styles.smallBtnPrimary, pressed && styles.rowPressed]}
                                onPress={() => openMember(payment, true)}
                            >
                                <Ionicons name="wallet-outline" size={14} color="#fff" />
                                <Text style={[styles.smallBtnText, styles.smallBtnTextPrimary]}>Collect</Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            );
        }

        const look = PAYMENT_STATUS_LOOK[payment.status] ?? PAYMENT_STATUS_LOOK.PAID;
        const isRefund = payment.status === "REFUNDED";
        const isPartial = payment.status === "PARTIAL";
        const detail = paymentDetail(payment);
        const time = timeTaken(payment);
        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${payment.member_name}, ${look.label}, ${formatRupee(Math.abs(payment.amount))}`}
                onPress={() => openMember(payment)}
                style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}
            >
                <View style={styles.avatar}>
                    <MemberAvatar id={payment.member_id} name={payment.member_name} size={AVATAR_SIZE} faded={left} />
                </View>
                <View style={[styles.rowMain, styles.rowTop, !isLast && styles.rowDivider]}>
                    <View style={[styles.rowText, left && styles.faded]}>
                        <Text style={styles.name} numberOfLines={1}>
                            {payment.member_name}
                            {left ? <Text style={styles.leftTag}>  · Left</Text> : null}
                        </Text>
                        <Text style={styles.detail} numberOfLines={1}>
                            {isPartial ? "Partial · " : ""}
                            {detail || look.label}
                        </Text>
                    </View>
                    <View style={styles.trailing}>
                        <Text style={[styles.amount, { color: isRefund ? theme.destructive : isPartial ? theme.accent : theme.primary }]}>
                            {isRefund ? "−" : "+"}
                            {formatRupee(Math.abs(payment.amount))}
                        </Text>
                        <Text style={styles.trailingMeta} numberOfLines={1}>
                            {[payment.method, time].filter(Boolean).join(" · ")}
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    const receivedHeader = (
        <View style={styles.headerBlock}>
            <View style={styles.hero}>
                {/* Tap the month to jump to any other month. */}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${formatMonth(month)}, pick a month`}
                    onPress={() => setMonthPickerVisible(true)}
                    style={({ pressed }) => [styles.monthPill, pressed && styles.rowPressed]}
                >
                    <Text style={styles.monthText}>{formatMonth(month)}</Text>
                </Pressable>
                <Text style={styles.heroAmount}>{formatRupee(monthTotal)}</Text>
                <View style={styles.heroMetaRow}>
                    <Text style={styles.heroMeta}>
                        {monthCount === 0 ? "Nothing received" : `${monthCount} payment${monthCount === 1 ? "" : "s"}`}
                        {monthRefunded > 0 ? ` · ${formatRupee(monthRefunded)} refunded` : ""}
                    </Text>
                    {change !== null && (
                        <View style={[styles.changeBadge, { backgroundColor: (change >= 0 ? theme.success : theme.destructive) + "18" }]}>
                            <Ionicons name={change >= 0 ? "arrow-up" : "arrow-down"} size={11} color={change >= 0 ? theme.success : theme.destructive} />
                            <Text style={[styles.changeText, { color: change >= 0 ? theme.success : theme.destructive }]}>{Math.abs(change)}% vs last month</Text>
                        </View>
                    )}
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {RECEIVED_FILTERS.map((f) => (
                    <FilterChip key={f.key} label={f.label} selected={receivedFilter === f.key} onPress={() => setReceivedFilter(f.key)} />
                ))}
            </ScrollView>
        </View>
    );

    const dueHeader = (
        <View style={styles.headerBlock}>
            <View style={styles.hero}>
                <Text style={styles.heroLabel}>Owed to you now</Text>
                <Text style={[styles.heroAmount, dueTotal > 0 && { color: theme.destructive }]}>{formatRupee(dueTotal)}</Text>
                <Text style={styles.heroMeta}>{dues.length === 0 ? "Everyone is paid up" : `from ${dues.length} member${dues.length === 1 ? "" : "s"}, longest overdue first`}</Text>
                {dues.length > 0 && (
                    <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.remindAll, (pressed || isRemindingAll) && styles.rowPressed]}
                        onPress={handleRemindAll}
                        disabled={isRemindingAll}
                    >
                        {isRemindingAll ? (
                            <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                            <>
                                <Ionicons name="megaphone-outline" size={15} color={theme.accent} />
                                <Text style={styles.remindAllText}>Remind everyone by SMS</Text>
                            </>
                        )}
                    </Pressable>
                )}
            </View>
        </View>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Payments" subtitle={subtitle} />

                <View style={styles.controls}>
                    <SegmentedControl
                        segments={[
                            { key: "received", label: "Received" },
                            { key: "due", label: "Due", count: dues.length, alert: dues.length > 0 },
                        ]}
                        value={tab}
                        onChange={setTab}
                    />
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={theme.mutedForeground} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by member name"
                            placeholderTextColor={theme.mutedForeground + "99"}
                            value={query}
                            onChangeText={setQuery}
                            autoCorrect={false}
                        />
                        {query.length > 0 && (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                            </Pressable>
                        )}
                    </View>
                </View>

                {isLoading && !data ? (
                    <LoadingState />
                ) : error && !data ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : (
                    <FlashList
                        data={items}
                        keyExtractor={(item) => item.key}
                        // Day headings, payments and dues recycle separately (different layouts).
                        getItemType={(item) => item.type}
                        renderItem={renderItem}
                        // Due rows show a spinner while their reminder sends.
                        extraData={remindingId}
                        ListHeaderComponent={tab === "received" ? receivedHeader : dueHeader}
                        ListEmptyComponent={
                            tab === "due" ? (
                                q ? (
                                    <EmptyState icon="search-outline" title="No one matches" subtitle="Try a different name." />
                                ) : (
                                    <EmptyState icon="checkmark-circle-outline" title="Nobody owes anything" subtitle="Every active member is paid up." />
                                )
                            ) : monthReceived.length === 0 ? (
                                <EmptyState icon="cash-outline" title={`Nothing received in ${formatMonth(month)}`} subtitle="Use the arrows or tap the month to see other months." />
                            ) : (
                                <EmptyState icon="search-outline" title="No payments match" subtitle="Try a different name or filter." />
                            )
                        }
                        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE + bottomInset }}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
                    />
                )}

                <MonthPickerSheet
                    visible={isMonthPickerVisible}
                    value={month}
                    maxMonth={currentMonth()}
                    onPick={(picked) => {
                        setMonth(picked);
                        setMonthPickerVisible(false);
                    }}
                    onClose={() => setMonthPickerVisible(false)}
                />
                <RecordPaymentSheet
                    visible={isRecordSheetVisible}
                    onClose={() => setRecordSheetVisible(false)}
                    onPick={(member) => {
                        setRecordSheetVisible(false);
                        router.push({ pathname: "/members/[id]", params: { id: String(member.id), collect: "1" } });
                    }}
                />

                <FloatingActionButton label="Record payment" onPress={() => setRecordSheetVisible(true)} />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        controls: {
            paddingHorizontal: 20,
            paddingTop: 16,
            gap: 12,
        },
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        searchInput: {
            flex: 1,
            height: "100%",
            fontFamily: "sans-regular",
            fontSize: 15,
            color: theme.primary,
        },
        headerBlock: {
            paddingTop: 14,
        },
        hero: {
            marginHorizontal: 20,
            padding: 16,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        monthPill: {
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
            marginBottom: 10,
        },
        monthText: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        heroLabel: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        heroAmount: {
            fontFamily: "sans-bold",
            fontSize: 30,
            color: theme.primary,
            marginTop: 2,
        },
        heroMetaRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
        },
        heroMeta: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        changeBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: RADIUS.sm,
        },
        changeText: {
            fontFamily: "sans-semibold",
            fontSize: 11,
        },
        remindAll: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 14,
            paddingVertical: 10,
            borderRadius: RADIUS.md,
            backgroundColor: theme.accent + "14",
        },
        remindAllText: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.accent,
        },
        chips: {
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 12,
        },
        dayHeader: {
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: 18,
            paddingBottom: 8,
        },
        dayLabel: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        dayTotal: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        // Rows in a group share one rounded card, split by hairlines that start at the text.
        row: {
            flexDirection: "row",
            alignItems: "flex-start",
            marginHorizontal: 20,
            paddingLeft: 16,
            backgroundColor: theme.card,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: theme.border,
        },
        rowFirst: {
            borderTopWidth: 1,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
        },
        rowLast: {
            borderBottomWidth: 1,
            borderBottomLeftRadius: RADIUS.lg,
            borderBottomRightRadius: RADIUS.lg,
        },
        rowPressed: {
            opacity: 0.7,
        },
        avatar: {
            marginRight: 12,
            paddingTop: 13,
        },
        rowMain: {
            flex: 1,
            paddingVertical: 13,
            paddingRight: 16,
        },
        rowTop: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        rowDivider: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.mutedForeground + "33",
        },
        rowText: {
            flex: 1,
        },
        faded: {
            opacity: 0.6,
        },
        name: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        leftTag: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        detail: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        trailing: {
            alignItems: "flex-end",
        },
        amount: {
            fontFamily: "sans-semibold",
            fontSize: 15,
        },
        trailingMeta: {
            fontFamily: "sans-regular",
            fontSize: 11,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        dueActions: {
            flexDirection: "row",
            gap: 8,
            marginTop: 10,
        },
        smallBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            minWidth: 92,
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
        },
        smallBtnPrimary: {
            backgroundColor: theme.accent,
        },
        smallBtnText: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.primary,
        },
        smallBtnTextPrimary: {
            color: "#fff",
        },
    });
