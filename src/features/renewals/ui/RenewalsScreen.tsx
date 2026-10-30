import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { getUpcomingRenewalsApi, remindAllUpcomingRenewalsApi } from "@/features/renewals/logic/renewals-api";
import { UpcomingRenewal } from "@/features/renewals/types/renewals.types";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { useActionSheet } from "@/shared/ui/ActionSheet";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text } from "@/shared/ui/Text";
import { showToast } from "@/shared/ui/Toast";
import { formatRupee } from "@/shared/utils/currency";
import { formatShortDate } from "@/shared/utils/dates";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";

const AVATAR_SIZE = 40;

type ListItem =
    | { type: "group"; key: string; label: string; total: number }
    | { type: "renewal"; key: string; renewal: UpcomingRenewal; isFirst: boolean; isLast: boolean };

/** Which heading a renewal falls under, by how soon it is. */
function groupLabel(days: number): string {
    if (days <= 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return "This week";
    return "Later";
}

function whenLabel(days: number): string {
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
}

function buildRenewalMessage(renewal: UpcomingRenewal): string {
    return `Dear ${renewal.name}, your library membership renews on ${formatShortDate(renewal.renewal_date)} (${formatRupee(renewal.amount)}). Renew in time to keep your seat.`;
}

export function RenewalsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);
    const actionSheet = useActionSheet();

    const { data, isLoading, error, refetch } = useApiData(getUpcomingRenewalsApi, []);
    const renewals = useMemo(() => data?.renewals ?? [], [data]);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const [isRefreshing, setIsRefreshing] = useState(false);
    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    const [sendingMemberId, setSendingMemberId] = useState<number | null>(null);
    const [isSendingBulk, setIsSendingBulk] = useState(false);

    const total = renewals.reduce((sum, r) => sum + r.amount, 0);

    // Soonest first, under Today / Tomorrow / This week / Later, each with its total.
    const items = useMemo((): ListItem[] => {
        const sorted = [...renewals].sort((a, b) => a.days_until_renewal - b.days_until_renewal || a.name.localeCompare(b.name));
        const groups = new Map<string, UpcomingRenewal[]>();
        for (const renewal of sorted) {
            const label = groupLabel(renewal.days_until_renewal);
            groups.set(label, [...(groups.get(label) ?? []), renewal]);
        }
        return [...groups.entries()].flatMap(([label, list]) => [
            { type: "group" as const, key: `group-${label}`, label, total: list.reduce((sum, r) => sum + r.amount, 0) },
            ...list.map((renewal, index) => ({
                type: "renewal" as const,
                key: String(renewal.member_id),
                renewal,
                isFirst: index === 0,
                isLast: index === list.length - 1,
            })),
        ]);
    }, [renewals]);

    const sendWhatsApp = async (renewal: UpcomingRenewal) => {
        try {
            await openWhatsAppMessage(renewal.phone, buildRenewalMessage(renewal));
        } catch {
            showToast({ message: "Couldn't open WhatsApp", detail: "Make sure WhatsApp is installed on this device.", tone: "error" });
        }
    };

    const sendSms = async (renewal: UpcomingRenewal) => {
        try {
            setSendingMemberId(renewal.member_id);
            await remindMemberApi(renewal.member_id);
            showToast({ message: "Reminder sent", detail: `${renewal.name} got an SMS.` });
        } catch (err: any) {
            showToast({ message: "Couldn't send the reminder", detail: err.message, tone: "error" });
        } finally {
            setSendingMemberId(null);
        }
    };

    const openRemind = (renewal: UpcomingRenewal) =>
        actionSheet.open({
            title: `Remind ${renewal.name}`,
            message: `${formatRupee(renewal.amount)} renews ${whenLabel(renewal.days_until_renewal)}.`,
            actions: [
                { label: "WhatsApp", hint: "Opens a ready-made message", icon: "logo-whatsapp", onPress: () => void sendWhatsApp(renewal) },
                { label: "SMS", hint: "Sent from Librum straight away", icon: "chatbox-ellipses-outline", onPress: () => void sendSms(renewal) },
            ],
        });

    const sendAll = async () => {
        try {
            setIsSendingBulk(true);
            const response = await remindAllUpcomingRenewalsApi();
            showToast({ message: "Reminders sent", detail: response.message || `Sent ${response.data.sent} reminder(s).` });
        } catch (err: any) {
            showToast({ message: "Couldn't send reminders", detail: err.message, tone: "error" });
        } finally {
            setIsSendingBulk(false);
        }
    };

    // An SMS to everyone can't be taken back, so ask first.
    const confirmRemindAll = () =>
        actionSheet.open({
            title: `Remind ${renewals.length} member${renewals.length === 1 ? "" : "s"}?`,
            message: "Everyone renewing soon gets an SMS with their renewal date and amount.",
            confirm: true,
            actions: [{ label: "Send SMS to all", icon: "megaphone-outline", tone: "primary", onPress: () => void sendAll() }],
        });

    const openMember = (renewal: UpcomingRenewal, collect = false) =>
        router.push({ pathname: "/members/[id]", params: { id: String(renewal.member_id), ...(collect ? { collect: "1" } : {}) } });

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === "group") {
            return (
                <View style={styles.groupHeader}>
                    <Text style={styles.groupLabel}>{item.label}</Text>
                    <Text style={styles.groupTotal}>{formatRupee(item.total)}</Text>
                </View>
            );
        }
        const { renewal, isFirst, isLast } = item;
        const busy = sendingMemberId === renewal.member_id;
        const soon = renewal.days_until_renewal <= 1;
        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${renewal.name}, ${formatRupee(renewal.amount)}, renews ${whenLabel(renewal.days_until_renewal)}`}
                onPress={() => openMember(renewal)}
                style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}>
                <View style={styles.avatar}>
                    <MemberAvatar id={renewal.member_id} name={renewal.name} size={AVATAR_SIZE} />
                </View>
                <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                    <View style={styles.rowTop}>
                        <View style={styles.rowText}>
                            <Text style={styles.name} numberOfLines={1}>
                                {renewal.name}
                            </Text>
                            <Text style={styles.detail} numberOfLines={1}>
                                Renews {formatShortDate(renewal.renewal_date)} ·{" "}
                                <Text style={soon && { color: theme.accent }}>{whenLabel(renewal.days_until_renewal)}</Text>
                            </Text>
                        </View>
                        <Text style={styles.amount}>{formatRupee(renewal.amount)}</Text>
                    </View>
                    <View style={styles.actions}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remind ${renewal.name}`}
                            style={({ pressed }) => [styles.smallBtn, pressed && styles.rowPressed]}
                            onPress={() => openRemind(renewal)}
                            disabled={busy}>
                            {busy ? (
                                <ActivityIndicator size="small" color={theme.primary} />
                            ) : (
                                <>
                                    <Ionicons name="notifications-outline" size={14} color={theme.primary} />
                                    <Text style={styles.smallBtnText}>Remind</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Collect from ${renewal.name}`}
                            style={({ pressed }) => [styles.smallBtn, styles.smallBtnPrimary, pressed && styles.rowPressed]}
                            onPress={() => openMember(renewal, true)}>
                            <Ionicons name="wallet-outline" size={14} color="#fff" />
                            <Text style={[styles.smallBtnText, styles.smallBtnTextPrimary]}>Collect</Text>
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        );
    };

    const header = (
        <View style={styles.hero}>
            <Text style={styles.heroLabel}>Renewing in the next {data?.window_days ?? 7} days</Text>
            <Text style={styles.heroAmount}>{formatRupee(total)}</Text>
            <Text style={styles.heroMeta}>
                from {renewals.length} member{renewals.length === 1 ? "" : "s"}, soonest first
            </Text>
            <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.remindAll, (pressed || isSendingBulk) && styles.rowPressed]}
                onPress={confirmRemindAll}
                disabled={isSendingBulk}>
                {isSendingBulk ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                    <>
                        <Ionicons name="megaphone-outline" size={15} color={theme.accent} />
                        <Text style={styles.remindAllText}>Remind everyone by SMS</Text>
                    </>
                )}
            </Pressable>
        </View>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <ScreenHeader
                    title="Renewals"
                    subtitle={
                        !data
                            ? "Memberships renewing soon"
                            : renewals.length === 0
                              ? `Nothing in the next ${data.window_days} days`
                              : `${formatRupee(total)} from ${renewals.length} in ${data.window_days} days`
                    }
                />

                {isLoading && !data ? (
                    <LoadingState />
                ) : error && !data ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : renewals.length === 0 ? (
                    <EmptyState icon="refresh-outline" title="No renewals coming up" subtitle="Members show up here as their membership gets close to renewing." />
                ) : (
                    <FlashList
                        data={items}
                        keyExtractor={(item) => item.key}
                        // Headings and rows recycle separately (different layouts).
                        getItemType={(item) => item.type}
                        renderItem={renderItem}
                        // Rows show a spinner while their SMS sends.
                        extraData={sendingMemberId}
                        ListHeaderComponent={header}
                        contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 + insets.bottom }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
                    />
                )}

                {actionSheet.sheet}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
        safe: {
            flex: 1,
        },
        hero: {
            marginHorizontal: 20,
            padding: 16,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
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
        heroMeta: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 2,
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
        groupHeader: {
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: 18,
            paddingBottom: 8,
        },
        groupLabel: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        groupTotal: {
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
        name: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        detail: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        amount: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        actions: {
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
