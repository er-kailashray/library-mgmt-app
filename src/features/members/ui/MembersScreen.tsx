import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { formatShortDate } from "@/shared/utils/dates";
import { getInitials } from "@/shared/utils/text";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FloatingActionButton, FAB_CLEARANCE } from "@/shared/ui/FloatingActionButton";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

type MemberFilter = "active" | "due" | "inactive" | "all";

const FILTERS: { key: MemberFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "due", label: "Due" },
    { key: "inactive", label: "Inactive" },
    { key: "all", label: "All" },
];

function matchesFilter(member: Member, filter: MemberFilter): boolean {
    switch (filter) {
        case "active":
            return member.status === "active";
        case "due":
            return member.status === "active" && member.payment_status !== "Paid";
        case "inactive":
            return member.status === "inactive";
        default:
            return true;
    }
}

export function MembersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");
    // Home's "See all dues" opens this list pre-filtered.
    const { filter: initialFilter } = useLocalSearchParams<{ filter?: MemberFilter }>();
    const [filterStatus, setFilterStatus] = useState<MemberFilter>(
        initialFilter && FILTERS.some((f) => f.key === initialFilter) ? initialFilter : "active"
    );

    const { data, isLoading, error, refetch: fetchMembers } = useApiData(getMembersApi, []);
    const members = data ?? [];

    // Refresh whenever this screen regains focus (e.g. coming back after marking someone as left).
    useFocusEffect(
        useCallback(() => {
            void fetchMembers();
        }, [fetchMembers])
    );

    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.phone.includes(searchQuery);
            return matchesSearch && matchesFilter(m, filterStatus);
        });
    }, [members, searchQuery, filterStatus]);

    const filterCounts = useMemo(
        () => Object.fromEntries(FILTERS.map((f) => [f.key, members.filter((m) => matchesFilter(m, f.key)).length])) as Record<MemberFilter, number>,
        [members]
    );

    // Inactive (left) > dues pending > active.
    const getBadge = (member: Member): { label: string; color: string } => {
        if (member.status === "inactive") return { label: "Inactive", color: theme.mutedForeground };
        if (member.payment_status !== "Paid") return { label: "Due", color: theme.destructive };
        return { label: "Active", color: theme.success };
    };

    const styles = createStyles(theme);

    const renderMemberItem = ({ item }: { item: Member }) => {
        const badge = getBadge(item);
        const isInactive = item.status === "inactive";
        return (
            <Pressable style={styles.memberCard} onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(item.id) } })}>
                <View style={[styles.memberCardContent, isInactive && styles.memberCardFaded]}>
                    <View style={[styles.avatarSmall, { backgroundColor: badge.color + "15" }]}>
                        <Text style={{ color: badge.color, fontFamily: "sans-extrabold" }}>{item.initials || getInitials(item.name)}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.name}</Text>
                        <Text style={styles.memberMeta}>
                            {item.phone}
                            {isInactive && item.outstanding_balance > 0 ? ` · ₹${Math.round(item.outstanding_balance).toLocaleString("en-IN")} pending` : ""}
                        </Text>
                        {!!item.join_date && <Text style={styles.memberMeta}>Joined {formatShortDate(item.join_date, true)}</Text>}
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.color + "15" }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                {/* Counts live on the filter chips below, so the subtitle says what the screen is for. */}
                <ScreenHeader
                    title="Members"
                    subtitle="Seats, fees and renewals at a glance"
                />

                <View style={styles.searchSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={theme.mutedForeground} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name, seat or phone..."
                            placeholderTextColor={theme.mutedForeground + "80"}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {FILTERS.map((f) => (
                            <FilterChip key={f.key} label={`${f.label} (${filterCounts[f.key]})`} selected={filterStatus === f.key} onPress={() => setFilterStatus(f.key)} />
                        ))}
                    </ScrollView>
                </View>

                {isLoading ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={fetchMembers} />
                ) : filteredMembers.length === 0 ? (
                    members.length === 0 ? (
                        <EmptyState icon="people-outline" title="No members yet" subtitle="Members will appear here once you admit a student." />
                    ) : (
                        <EmptyState icon="search-outline" title="No members found" subtitle="Try adjusting your search or filters." />
                    )
                ) : (
                    <FlatList
                        data={filteredMembers}
                        renderItem={renderMemberItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.listContent, { paddingBottom: FAB_CLEARANCE + insets.bottom }]}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <FloatingActionButton label="New admission" onPress={() => router.push("/admission")} />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingTop: 24,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card,
        borderRadius: RADIUS.lg,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1.5,
        borderColor: theme.border,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontFamily: "sans-medium",
        fontSize: 15,
        color: theme.primary,
    },
    filterScroll: {
        gap: 8,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 100,
    },
    memberCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    memberCardContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    // Members who left are dimmed, but the card itself stays solid so they're still easy to tap.
    memberCardFaded: {
        opacity: 0.6,
    },
    avatarSmall: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    memberInfo: {
        flex: 1,
        marginLeft: 16,
    },
    memberName: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: theme.primary,
        marginBottom: 2,
    },
    memberMeta: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.mutedForeground,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: RADIUS.sm,
    },
    badgeText: {
        fontFamily: "sans-extrabold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
});
