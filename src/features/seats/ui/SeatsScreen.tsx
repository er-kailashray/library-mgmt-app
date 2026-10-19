import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

const formatSeatNumber = (num: any) => {
    const str = String(num || "");
    const n = str.replace(/\D/g, "");
    return parseInt(n || "0", 10).toString();
};

export function SeatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();

    const { data, isLoading, error, refetch: fetchData } = useApiData(getSeatMatrixApi, []);
    const batchesFilter = data?.batches ?? [];
    const seats = data?.seats ?? [];
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);

    const [selectedSeat, setSelectedSeat] = useState<SeatMatrixSeat | null>(null);

    const toggleBatch = (batchId: number) => {
        setSelectedBatchIds((prev) =>
            prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
        );
    };

    const styles = createStyles(theme);

    const renderFilterHeader = () => {
        if (batchesFilter.length === 0) return null;

        const physicalSeatsCount = seats.length;
        const summaryStats = batchesFilter.map((batch) => {
            const occupiedInBatch = seats.filter((s) =>
                s.batches.some((b) => b.batch_id === batch.id && !b.available)
            ).length;

            let statusText = "Available";
            let statusColor = theme.success;
            let statusEmoji = "✅";

            if (occupiedInBatch >= physicalSeatsCount && physicalSeatsCount > 0) {
                statusText = "Full";
                statusColor = theme.destructive;
                statusEmoji = "🔴";
            } else if (occupiedInBatch >= physicalSeatsCount * 0.8) {
                statusText = "Almost Full";
                statusColor = "#F97316"; // Orange
                statusEmoji = "⚠️";
            }

            return {
                id: batch.id,
                name: batch.name,
                occupied: occupiedInBatch,
                total: physicalSeatsCount,
                statusText,
                statusColor,
                statusEmoji,
            };
        });

        const totalEnrolled = summaryStats.reduce((sum, b) => sum + b.occupied, 0);
        const totalPossible = summaryStats.length * physicalSeatsCount;

        return (
            <View style={styles.headerSection}>
                {/* 1. SEATS SUMMARY WIDGET */}
                <View style={[styles.summaryCard, { backgroundColor: "#1A1A1A" }]}>
                    <View style={styles.summaryTop}>
                        <Text style={[styles.summaryTitle, { color: "rgba(255,255,255,0.6)" }]}>SEAT CAPACITY</Text>
                        <Text style={[styles.summaryPhysical, { color: "#fff" }]}>{physicalSeatsCount} Total</Text>
                    </View>

                    <Text style={styles.summaryTotalEnrolled}>
                        {totalEnrolled} <Text style={styles.summaryTotalSuffix}>/ {totalPossible} Enrolled</Text>
                    </Text>

                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${totalPossible > 0 ? (totalEnrolled / totalPossible) * 100 : 0}%` }]} />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryBatchScroll}>
                        {summaryStats.map((batch) => (
                            <View key={batch.id} style={styles.miniBatchCard}>
                                <Text style={styles.miniBatchName}>{batch.name}</Text>
                                <View style={styles.miniBatchStatusRow}>
                                    <View style={[styles.miniBatchDot, { backgroundColor: batch.statusColor }]} />
                                    <Text style={styles.miniBatchRatio}>{batch.occupied}/{batch.total}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* 2. FILTER CHIPS */}
                <View style={styles.filterSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <Pressable
                            style={[styles.filterChip, selectedBatchIds.length === 0 && styles.filterChipSelected]}
                            onPress={() => setSelectedBatchIds([])}>
                            <Text style={[styles.filterChipText, selectedBatchIds.length === 0 && styles.filterChipTextSelected]}>All</Text>
                        </Pressable>
                        {batchesFilter.map(b => {
                            const isSelected = selectedBatchIds.includes(b.id);
                            return (
                                <Pressable
                                    key={b.id}
                                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                                    onPress={() => toggleBatch(b.id)}>
                                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{b.name}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };

    const renderSeatBlock = ({ item: seat }: { item: SeatMatrixSeat }) => {
        const displayedBatches = seat.batches.filter((b) => selectedBatchIds.length === 0 || selectedBatchIds.includes(b.batch_id));

        if (displayedBatches.length === 0 && selectedBatchIds.length > 0) return null;

        const allAvailable = displayedBatches.every((b) => b.available);
        const anyAvailable = displayedBatches.some((b) => b.available);

        let textColor = theme.primary;
        let bgTint = theme.success + "15";
        let borderColor = theme.success + "30";

        if (!anyAvailable) {
            // Fully Booked (Visible light translucent grey to match airy vibe)
            textColor = "#A1A1AA"; // Significantly brighter grey text for visibility
            bgTint = "rgba(255,255,255,0.08)"; // Slightly brighter soft grey tint
            borderColor = "rgba(255,255,255,0.2)";
        } else if (!allAvailable) {
            // Partially Booked (Blue)
            bgTint = "#3B82F6" + "15";
            borderColor = "#3B82F6" + "30";
        }

        return (
            <Pressable style={[styles.gridSeatCard, { backgroundColor: bgTint, borderColor: borderColor }]} onPress={() => setSelectedSeat(seat)}>
                <Text style={[styles.gridSeatNumber, { color: textColor }]}>
                    {formatSeatNumber(seat.seat_number)}
                </Text>
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.headerActionCircle}
                        onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Seat Management</Text>
                        <Text style={styles.headerSubtitle}>Check availability across batches</Text>
                    </View>
                </View>
            </View>

            {isLoading ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={error} onRetry={fetchData} />
            ) : seats.length === 0 ? (
                <EmptyState icon="grid-outline" title="No seats configured yet" subtitle="Seats are created automatically when your library is set up." />
            ) : batchesFilter.length === 0 ? (
                <EmptyState
                    icon="calendar-outline"
                    title="No batches set up yet"
                    subtitle="Seat availability is shown per batch — add a batch first to see it here."
                    actionLabel="Set up a batch"
                    onAction={() => router.push("/batches")}
                />
            ) : (
                <FlatList
                    data={seats}
                    keyExtractor={(item) => item.seat_id.toString()}
                    renderItem={renderSeatBlock}
                    ListHeaderComponent={renderFilterHeader}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                    numColumns={4}
                    initialNumToRender={20}
                    maxToRenderPerBatch={40}
                    windowSize={7}
                    removeClippedSubviews={true}
                />
            )}

            <Modal
                visible={!!selectedSeat}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedSeat(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seat {formatSeatNumber(selectedSeat?.seat_number || "")}</Text>
                            <Pressable
                                accessibilityRole="button"
                                style={styles.modalCloseButton}
                                onPress={() => setSelectedSeat(null)}>
                                <Ionicons name="close" size={24} color={theme.primary} />
                            </Pressable>
                        </View>

                        <Text style={styles.modalSubheading}>Batch Availability</Text>

                        <View style={styles.batchList}>
                            {selectedSeat?.batches.map(b => {
                                const filteredOut = selectedBatchIds.length > 0 && !selectedBatchIds.includes(b.batch_id);
                                if (filteredOut) return null;

                                return (
                                    <View key={b.batch_id} style={styles.batchRow}>
                                        <Text style={styles.batchRowName}>{b.batch_name}</Text>
                                        {b.available ? (
                                            <View style={[styles.statusBadge, { backgroundColor: theme.success + "1A" }]}>
                                                <Text style={[styles.statusText, { color: theme.success }]}>Available</Text>
                                            </View>
                                        ) : (
                                            <View style={[styles.statusBadge, { backgroundColor: theme.destructive + "1A" }]}>
                                                <Text style={[styles.statusText, { color: theme.destructive }]}>Occupied</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.background,
    },
    headerWrapper: {
        backgroundColor: theme.background,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        zIndex: 10,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 16,
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
    listContent: {
        paddingTop: 16,
        paddingBottom: 40,
        gap: 12,
    },
    columnWrapper: {
        paddingHorizontal: 20,
        justifyContent: "flex-start",
        gap: 12,
    },
    filterSection: {
        marginBottom: 8,
    },
    filterRow: {
        paddingHorizontal: 20,
        gap: 8,
        paddingBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: theme.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    filterChipSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    filterChipText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: theme.primary,
    },
    filterChipTextSelected: {
        color: theme.background,
    },
    gridDotRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
    },
    gridDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    moreBatchText: {
        fontSize: 10,
        fontFamily: "sans-bold",
        color: theme.mutedForeground,
    },
    dotAvailable: {
        backgroundColor: theme.success,
    },
    dotOccupied: {
        backgroundColor: theme.destructive,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: theme.background,
        borderRadius: 28,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: theme.primary,
    },
    modalSubheading: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: theme.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 16,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.card,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    batchList: {
        gap: 12,
    },
    batchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    batchRowName: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: theme.primary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontFamily: "sans-bold",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    headerSection: {
        marginBottom: 8,
    },
    summaryCard: {
        backgroundColor: "#1A1A1A",
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    summaryTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    summaryTitle: {
        fontFamily: "sans-bold",
        fontSize: 11,
        color: "rgba(255,255,255,0.6)",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    summaryPhysical: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: "#fff",
    },
    summaryTotalEnrolled: {
        fontFamily: "sans-extrabold",
        fontSize: 32,
        color: theme.accent,
        letterSpacing: -1,
        marginBottom: 12,
    },
    summaryTotalSuffix: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: "rgba(255,255,255,0.6)",
        letterSpacing: 0,
    },
    progressContainer: {
        height: 6,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 20,
    },
    progressBar: {
        height: "100%",
        backgroundColor: theme.accent,
        borderRadius: 3,
    },
    summaryBatchScroll: {
        gap: 12,
    },
    miniBatchCard: {
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        minWidth: 90,
    },
    miniBatchName: {
        fontFamily: "sans-bold",
        fontSize: 11,
        color: "rgba(255,255,255,0.6)",
        marginBottom: 6,
    },
    miniBatchStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    miniBatchDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    miniBatchRatio: {
        fontFamily: "sans-extrabold",
        fontSize: 14,
        color: "#fff",
    },
    gridSeatCard: {
        flex: 1,
        minWidth: "21%",
        maxWidth: "25%",
        aspectRatio: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    gridSeatNumber: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
    },
});
