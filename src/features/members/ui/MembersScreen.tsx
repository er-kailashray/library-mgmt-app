import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DUMMY_MEMBERS, MemberStatus } from "@/features/members/types/members.types";
import { colors } from "@/shared/constants/theme";

export function MembersScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<MemberStatus | "ALL">("ALL");

    const filteredMembers = useMemo(() => {
        return DUMMY_MEMBERS.filter((m) => {
            const matchesSearch =
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.phone.includes(searchQuery);
            const matchesStatus = selectedStatus === "ALL" || m.status === selectedStatus;
            return matchesSearch && matchesStatus;
        });
    }, [searchQuery, selectedStatus]);

    const getStatusColor = (status: MemberStatus) => {
        switch (status) {
            case MemberStatus.ACTIVE:
                return colors.success;
            case MemberStatus.EXPIRING_SOON:
                return colors.accent;
            case MemberStatus.EXPIRED:
                return colors.destructive;
            default:
                return colors.mutedForeground;
        }
    };

    const renderMemberItem = ({ item }: { item: (typeof DUMMY_MEMBERS)[0] }) => (
        <Pressable style={styles.memberCard}>
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: getStatusColor(item.status) + "20" }]}>
                    <Text style={[styles.avatarText, { color: getStatusColor(item.status) }]}>{item.initials}</Text>
                </View>
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberPhone}>{item.phone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "15" }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.replace("_", " ")}
                    </Text>
                </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.detailText}>{item.batch_name}</Text>
                </View>
                <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.detailText}>Expires: {item.expiry_date}</Text>
                </View>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Library Members</Text>
                    <Text style={styles.headerSubtitle}>{DUMMY_MEMBERS.length} Total Registered</Text>
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={colors.mutedForeground} />
                    <TextInput
                        placeholder="Search by name or phone..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                        </Pressable>
                    )}
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                    style={styles.filterScroll}>
                    <Pressable
                        style={[styles.filterChip, selectedStatus === "ALL" && styles.filterChipSelected]}
                        onPress={() => setSelectedStatus("ALL")}>
                        <Text style={[styles.filterChipText, selectedStatus === "ALL" && styles.filterChipTextSelected]}>
                            All
                        </Text>
                    </Pressable>
                    {Object.values(MemberStatus).map((status) => (
                        <Pressable
                            key={status}
                            style={[styles.filterChip, selectedStatus === status && styles.filterChipSelected]}
                            onPress={() => setSelectedStatus(status)}>
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedStatus === status && styles.filterChipTextSelected,
                                ]}>
                                {status.replace("_", " ")}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item.id}
                renderItem={renderMemberItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={64} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                        <Text style={styles.emptyText}>No members found</Text>
                        <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: colors.primary,
    },
    headerSubtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: colors.mutedForeground,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        paddingHorizontal: 16,
        height: 52,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontFamily: "sans-medium",
        fontSize: 15,
        color: colors.primary,
    },
    filterScroll: {
        marginTop: 16,
        marginBottom: 8,
    },
    filterRow: {
        gap: 8,
        paddingRight: 20,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: colors.primary,
        textTransform: "capitalize",
    },
    filterChipTextSelected: {
        color: colors.background,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 40,
        gap: 16,
    },
    memberCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: colors.primary,
        marginBottom: 2,
    },
    memberPhone: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontFamily: "sans-bold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    cardDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 14,
        opacity: 0.5,
    },
    cardDetails: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    detailText: {
        fontFamily: "sans-semibold",
        fontSize: 12,
        color: colors.mutedForeground,
    },
    emptyContainer: {
        alignItems: "center",
        marginTop: 80,
    },
    emptyText: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        color: colors.primary,
        marginTop: 20,
    },
    emptySubText: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: colors.mutedForeground,
        marginTop: 8,
    },
});
