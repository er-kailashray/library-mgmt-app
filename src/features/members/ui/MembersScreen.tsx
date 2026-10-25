import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { FloatingActionButton, FAB_CLEARANCE } from "@/shared/ui/FloatingActionButton";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { formatShortDate, fromIsoDate, todayIso } from "@/shared/utils/dates";
import { getInitials } from "@/shared/utils/text";

type MemberFilter = "active" | "due" | "inactive" | "all";

/** `inactive` keeps its key so Home's links (?filter=inactive) still work; owners read it as "Left". */
const FILTERS: { key: MemberFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "due", label: "Due" },
    { key: "inactive", label: "Left" },
    { key: "all", label: "All" },
];

/** Soft, distinct avatar colours; each member keeps the same one (picked from their id). */
const AVATAR_COLORS = ["#E26D4D", "#14B8A6", "#6366F1", "#F59E0B", "#0EA5E9", "#EC4899", "#10B981", "#8B5CF6"];

/** Renewals this close are called out in the accent colour. */
const RENEWS_SOON_DAYS = 3;

const AVATAR_SIZE = 44;
const ROW_PADDING = 16;
const AVATAR_GAP = 14;

type Section = { key: string; title: string; data: Member[] };

const isDue = (member: Member) => member.status === "active" && (member.due_amount ?? 0) > 0;

function matchesFilter(member: Member, filter: MemberFilter): boolean {
    switch (filter) {
        case "active":
            return member.status === "active";
        case "due":
            return isDue(member) || (member.status === "active" && member.payment_status !== "Paid");
        case "inactive":
            return member.status === "inactive";
        default:
            return true;
    }
}

/** Name, phone, batch name or seat number ("12", "seat 12"). */
function matchesSearch(member: Member, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const seatQuery = q.replace(/^seat\s*/, "");
    return (
        member.name.toLowerCase().includes(q) ||
        member.phone.includes(q) ||
        (member.seats ?? []).some((seat) => (seat.batch_name ?? "").toLowerCase().includes(q) || String(seat.seat_number ?? "") === seatQuery)
    );
}

function avatarColor(member: Member): string {
    const n = Number(member.id);
    const index = Number.isFinite(n) ? n : member.name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];
}

function formatRupee(amount: number): string {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function daysUntil(iso: string): number {
    return Math.round((fromIsoDate(iso).getTime() - fromIsoDate(todayIso()).getTime()) / 86_400_000);
}

const byName = (a: Member, b: Member) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/**
 * How the list is grouped: A–Z sections for Active and All (like contacts), most overdue first
 * for Due, and most recently left first for Left.
 */
function toSections(members: Member[], filter: MemberFilter): Section[] {
    if (members.length === 0) return [];
    if (filter === "due") {
        const sorted = [...members].sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0) || (b.due_amount ?? 0) - (a.due_amount ?? 0));
        return [{ key: "due", title: "Most overdue first", data: sorted }];
    }
    if (filter === "inactive") {
        const sorted = [...members].sort((a, b) => (b.left_on ?? "").localeCompare(a.left_on ?? "") || byName(a, b));
        return [{ key: "left", title: "Most recent first", data: sorted }];
    }
    const groups = new Map<string, Member[]>();
    for (const member of [...members].sort(byName)) {
        const first = member.name.trim().charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(first) ? first : "#";
        groups.set(letter, [...(groups.get(letter) ?? []), member]);
    }
    return [...groups.entries()]
        .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
        .map(([letter, data]) => ({ key: letter, title: letter, data }));
}

/**
 * Members: everyone the library has admitted, findable by name, phone, batch or seat. Each row
 * says where the member sits and the one thing worth knowing about them right now: what they
 * owe, when they renew, or when they left.
 */
export function MembersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [searchQuery, setSearchQuery] = useState("");
    // Home's "See all dues" opens this list pre-filtered.
    const { filter: initialFilter } = useLocalSearchParams<{ filter?: MemberFilter }>();
    const [filter, setFilter] = useState<MemberFilter>(initialFilter && FILTERS.some((f) => f.key === initialFilter) ? initialFilter : "active");

    const { data, isLoading, error, refetch } = useApiData(getMembersApi, []);
    const members = useMemo(() => data ?? [], [data]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Refresh whenever this screen regains focus (e.g. coming back after marking someone as left).
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

    const counts = useMemo(
        () => Object.fromEntries(FILTERS.map((f) => [f.key, members.filter((m) => matchesFilter(m, f.key)).length])) as Record<MemberFilter, number>,
        [members]
    );

    const sections = useMemo(
        () => toSections(members.filter((m) => matchesFilter(m, filter) && matchesSearch(m, searchQuery)), filter),
        [members, filter, searchQuery]
    );

    const summary = useMemo(() => {
        if (!data) return "Everyone you've admitted";
        const owing = members.filter(isDue);
        const owed = owing.reduce((sum, m) => sum + (m.due_amount ?? 0), 0);
        const active = `${counts.active} active`;
        return owing.length > 0 ? `${active} · ${formatRupee(owed)} due from ${owing.length}` : `${active} · everyone's paid up`;
    }, [data, members, counts.active]);

    const openMember = useCallback((member: Member) => router.push({ pathname: "/members/[id]", params: { id: String(member.id) } }), [router]);

    const renderItem = useCallback(
        ({ item, index, section }: { item: Member; index: number; section: Section }) => (
            <MemberRow member={item} isFirst={index === 0} isLast={index === section.data.length - 1} onPress={openMember} styles={styles} theme={theme} />
        ),
        [openMember, styles, theme]
    );

    const isSearching = searchQuery.trim().length > 0;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Members" subtitle={summary} />

                <View style={styles.controls}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={theme.mutedForeground} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Name, phone, batch or seat"
                            placeholderTextColor={theme.mutedForeground + "99"}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                            returnKeyType="search"
                            clearButtonMode="never"
                        />
                        {isSearching && (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery("")} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.segments} accessibilityRole="tablist">
                        {FILTERS.map((f) => {
                            const selected = filter === f.key;
                            const alert = f.key === "due" && counts.due > 0;
                            return (
                                <Pressable
                                    key={f.key}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected }}
                                    accessibilityLabel={`${f.label}, ${counts[f.key]}`}
                                    style={[styles.segment, selected && styles.segmentSelected]}
                                    onPress={() => setFilter(f.key)}
                                >
                                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{f.label}</Text>
                                    <Text style={[styles.segmentCount, alert && styles.segmentCountAlert]}>{counts[f.key]}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {isLoading && !data ? (
                    <LoadingState />
                ) : error && !data ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
                        stickySectionHeadersEnabled={false}
                        contentContainerStyle={[styles.listContent, { paddingBottom: FAB_CLEARANCE + bottomInset }]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
                        ListEmptyComponent={
                            members.length === 0 ? (
                                <EmptyState
                                    icon="people-outline"
                                    title="No members yet"
                                    subtitle="Admit your first student and they'll appear here."
                                    actionLabel="New admission"
                                    onAction={() => router.push("/admission")}
                                />
                            ) : isSearching ? (
                                <EmptyState icon="search-outline" title="No matches" subtitle={`Nobody matches "${searchQuery.trim()}" here. Try All, or another name, phone or seat.`} />
                            ) : filter === "due" ? (
                                <EmptyState icon="checkmark-circle-outline" title="Nobody owes anything" subtitle="Every active member is paid up." />
                            ) : filter === "inactive" ? (
                                <EmptyState icon="people-outline" title="No one has left" subtitle="Members you mark as left show up here, so you can readmit them later." />
                            ) : (
                                <EmptyState icon="people-outline" title="No active members" subtitle="Everyone here has left. Find them under Left to readmit." />
                            )
                        }
                    />
                )}

                <FloatingActionButton label="New admission" onPress={() => router.push("/admission")} />
            </SafeAreaView>
        </ScreenBackground>
    );
}

type Styles = ReturnType<typeof createStyles>;

function MemberRow({
    member,
    isFirst,
    isLast,
    onPress,
    styles,
    theme,
}: {
    member: Member;
    isFirst: boolean;
    isLast: boolean;
    onPress: (member: Member) => void;
    styles: Styles;
    theme: Theme;
}) {
    const color = avatarColor(member);
    const isLeft = member.status === "inactive";
    const seats = member.seats ?? [];
    const seatText = isLeft
        ? member.phone
        : seats.length === 0
          ? "No seat assigned"
          : seats
                .slice(0, 2)
                .map((seat) => `${seat.batch_name ?? "Batch"} · Seat ${seat.seat_number ?? "—"}`)
                .join("   ") + (seats.length > 2 ? `   +${seats.length - 2}` : "");

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${member.name}. ${seatText}`}
            onPress={() => onPress(member)}
            style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}
        >
            <View style={[styles.avatar, { backgroundColor: color + "22" }, isLeft && styles.faded]}>
                <Text style={[styles.avatarText, { color }]}>{member.initials || getInitials(member.name)}</Text>
            </View>

            <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                <View style={[styles.rowText, isLeft && styles.faded]}>
                    <Text style={styles.name} numberOfLines={1}>
                        {member.name}
                    </Text>
                    <Text style={[styles.seats, seats.length === 0 && !isLeft && styles.seatsEmpty]} numberOfLines={1}>
                        {seatText}
                    </Text>
                </View>
                <Trailing member={member} styles={styles} theme={theme} />
            </View>
        </Pressable>
    );
}

/** The right-hand column: owed amount, renewal date, or when they left. */
function Trailing({ member, styles, theme }: { member: Member; styles: Styles; theme: Theme }) {
    if (member.status === "inactive") {
        const pending = member.outstanding_balance > 0;
        return (
            <View style={styles.trailing}>
                <Text style={styles.trailingLabel}>Left</Text>
                <Text style={[styles.trailingValue, pending && { color: theme.destructive }]}>
                    {pending ? `${formatRupee(member.outstanding_balance)} owed` : member.left_on ? formatShortDate(member.left_on) : "—"}
                </Text>
            </View>
        );
    }

    if (isDue(member)) {
        const days = member.days_overdue ?? 0;
        return (
            <View style={styles.trailing}>
                <Text style={[styles.trailingAmount, { color: theme.destructive }]}>{formatRupee(member.due_amount ?? 0)}</Text>
                <Text style={styles.trailingLabel}>{days === 0 ? "due today" : `${days} day${days === 1 ? "" : "s"} overdue`}</Text>
            </View>
        );
    }

    if (member.next_renewal_date) {
        const days = daysUntil(member.next_renewal_date);
        const soon = days >= 0 && days <= RENEWS_SOON_DAYS;
        return (
            <View style={styles.trailing}>
                <Text style={styles.trailingLabel}>Renews</Text>
                <Text style={[styles.trailingValue, soon && { color: theme.accent }]}>
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatShortDate(member.next_renewal_date)}
                </Text>
            </View>
        );
    }

    return null;
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        controls: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 4,
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
        segments: {
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
        segmentLabel: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        segmentLabelSelected: {
            fontFamily: "sans-semibold",
            color: theme.primary,
        },
        segmentCount: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        segmentCountAlert: {
            color: theme.destructive,
        },
        listContent: {
            paddingHorizontal: 20,
            paddingTop: 4,
            flexGrow: 1,
        },
        sectionTitle: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
            paddingTop: 18,
            paddingBottom: 8,
            paddingLeft: 4,
        },
        // Rows in a section share one rounded card, split by hairlines that start at the text.
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: ROW_PADDING,
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
            backgroundColor: theme.muted,
        },
        avatar: {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            marginRight: AVATAR_GAP,
        },
        avatarText: {
            fontFamily: "sans-semibold",
            fontSize: 15,
        },
        rowMain: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
            paddingRight: ROW_PADDING,
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
            fontSize: 16,
            color: theme.primary,
        },
        seats: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        seatsEmpty: {
            fontStyle: "italic",
        },
        faded: {
            opacity: 0.55,
        },
        trailing: {
            alignItems: "flex-end",
            minWidth: 64,
        },
        trailingLabel: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        trailingValue: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.primary,
            marginTop: 2,
        },
        trailingAmount: {
            fontFamily: "sans-semibold",
            fontSize: 15,
        },
    });
