import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

export function MembersScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "due">("all");

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
            const matchesStatus =
                filterStatus === "all" ||
                (filterStatus === "active" && m.payment_status === "Paid") ||
                (filterStatus === "due" && m.payment_status !== "Paid");
            return matchesSearch && matchesStatus;
        });
    }, [members, searchQuery, filterStatus]);

    const getStatusColor = (payment_status: string) => {
        return payment_status === "Paid" ? theme.success : theme.destructive;
    };

    const styles = createStyles(theme);

    const renderMemberItem = ({ item }: { item: Member }) => (
        <Pressable style={styles.memberCard} onPress={() => router.push(`/members/${item.id}`)}>
            <View style={[styles.avatarSmall, { backgroundColor: getStatusColor(item.payment_status) + "15" }]}>
                <Text style={{ color: getStatusColor(item.payment_status), fontFamily: "sans-extrabold" }}>{item.initials || getInitials(item.name)}</Text>
            </View>
            <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.name}</Text>
                <Text style={styles.memberMeta}>{item.phone}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getStatusColor(item.payment_status) + "15" }]}>
                <Text style={[styles.badgeText, { color: getStatusColor(item.payment_status) }]}>
                    {item.payment_status === "Paid" ? "Paid" : "Due"}
                </Text>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Members</Text>
                    <Text style={styles.headerSubtitle}>{filteredMembers.length} active students</Text>
                </View>
                <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => Alert.alert("Export", "Member list export coming soon!")}>
                    <Ionicons name="download-outline" size={22} color={theme.primary} />
                </Pressable>
            </View>

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
                    <Pressable style={[styles.filterChip, filterStatus === "all" && styles.filterChipActive]} onPress={() => setFilterStatus("all")}>
                        <Text style={[styles.filterText, filterStatus === "all" && styles.filterTextActive]}>All Members</Text>
                    </Pressable>
                    <Pressable style={[styles.filterChip, filterStatus === "active" && styles.filterChipActive]} onPress={() => setFilterStatus("active")}>
                        <Text style={[styles.filterText, filterStatus === "active" && styles.filterTextActive]}>Paid Only</Text>
                    </Pressable>
                    <Pressable style={[styles.filterChip, filterStatus === "due" && styles.filterChipActive]} onPress={() => setFilterStatus("due")}>
                        <Text style={[styles.filterText, filterStatus === "due" && styles.filterTextActive]}>Dues Pending</Text>
                    </Pressable>
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
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Pressable accessibilityRole="button" style={styles.fab} onPress={() => router.push("/admission")}>
                <Ionicons name="add" size={32} color={theme.background} />
            </Pressable>
        </SafeAreaView>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 16,
        backgroundColor: theme.background,
    },
    headerActionCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.card,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: theme.primary,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: theme.mutedForeground,
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card,
        borderRadius: 16,
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
    filterChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: theme.card,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    filterChipActive: {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
    },
    filterText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.mutedForeground,
    },
    filterTextActive: {
        color: theme.background === "#0C0A09" ? theme.primary : "#fff",
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
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: theme.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
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
        borderRadius: 10,
    },
    badgeText: {
        fontFamily: "sans-extrabold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    fab: {
        position: "absolute",
        right: 20,
        bottom: 30,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
});
