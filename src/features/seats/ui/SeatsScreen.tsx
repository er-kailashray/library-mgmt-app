import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { colors } from "@/shared/constants/theme";

export function SeatsScreen() {
    const router = useRouter();

    const [batchesFilter, setBatchesFilter] = useState<MatrixBatchRef[]>([]);
    const [seats, setSeats] = useState<SeatMatrixSeat[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedSeat, setSelectedSeat] = useState<SeatMatrixSeat | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await getSeatMatrixApi();
            if (response.status) {
                setBatchesFilter(response.data?.batches || []);
                setSeats(response.data?.seats || []);
            } else {
                setError("Failed to fetch seat matrix.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred while fetching seat matrix.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const toggleBatch = (batchId: number) => {
        setSelectedBatchIds((prev) =>
            prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
        );
    };

    const renderFilterHeader = () => {
        if (isLoading || error || batchesFilter.length === 0) return null;

        return (
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
        );
    };

    const renderEmptyState = () => {
        if (isLoading) {
            return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;
        }
        if (error) {
            return <Text style={{ textAlign: "center", marginTop: 40, color: colors.destructive }}>{error}</Text>;
        }
        if (seats.length === 0) {
            return (
                <Text style={{ textAlign: "center", marginTop: 40, color: colors.mutedForeground }}>
                    No seats configurations found.
                </Text>
            );
        }
        return null;
    };

    const renderSeatBlock = ({ item: seat }: { item: SeatMatrixSeat }) => {
        const displayedBatches = seat.batches.filter(b =>
            selectedBatchIds.length === 0 || selectedBatchIds.includes(b.batch_id)
        );

        if (displayedBatches.length === 0 && selectedBatchIds.length > 0) return null;

        return (
            <Pressable style={styles.gridSeatCard} onPress={() => setSelectedSeat(seat)}>
                <Text style={styles.gridSeatNumber}>{seat.seat_number}</Text>
                <View style={styles.gridDotRow}>
                    {displayedBatches.map(b => (
                        <View
                            key={b.batch_id}
                            style={[styles.gridDot, b.available ? styles.dotAvailable : styles.dotOccupied]}
                        />
                    ))}
                </View>
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.headerActionCircle}
                        onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={colors.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Seat Management</Text>
                        <Text style={styles.headerSubtitle}>Check availability across batches</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={seats}
                keyExtractor={(item) => item.seat_id.toString()}
                renderItem={renderSeatBlock}
                ListHeaderComponent={renderFilterHeader}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={false}
                numColumns={4}
                initialNumToRender={20}
                maxToRenderPerBatch={40}
                windowSize={7}
                removeClippedSubviews={true}
            />

            {/* Custom Modal for showing exact Batch details when tapping a Seat */}
            <Modal
                visible={!!selectedSeat}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedSeat(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seat {selectedSeat?.seat_number}</Text>
                            <Pressable
                                accessibilityRole="button"
                                style={styles.modalCloseButton}
                                onPress={() => setSelectedSeat(null)}>
                                <Ionicons name="close" size={24} color={colors.primary} />
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
                                            <View style={[styles.statusBadge, { backgroundColor: colors.success + "1A" }]}>
                                                <Text style={[styles.statusText, { color: colors.success }]}>Available</Text>
                                            </View>
                                        ) : (
                                            <View style={[styles.statusBadge, { backgroundColor: colors.destructive + "1A" }]}>
                                                <Text style={[styles.statusText, { color: colors.destructive }]}>Occupied</Text>
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

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerWrapper: {
        backgroundColor: colors.background,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        color: colors.primary,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: colors.mutedForeground,
    },
    headerActionCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    listContent: {
        paddingTop: 16,
        paddingBottom: 40,
        gap: 12,
    },
    columnWrapper: {
        paddingHorizontal: 20,
        justifyContent: "flex-start", // Flex start ensures elements align cleanly without gaps if a row isn't full
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
        fontSize: 14,
        color: colors.primary,
    },
    filterChipTextSelected: {
        color: colors.background,
    },
    gridSeatCard: {
        flex: 1,
        minWidth: "21%", // Approximately fits 4 items per row cleanly with ~4% gap calculation. 
        maxWidth: "25%",
        aspectRatio: 1, // Enforces geometric square
        backgroundColor: colors.card,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    gridSeatNumber: {
        fontFamily: "sans-extrabold",
        fontSize: 20,
        color: colors.primary,
        textAlign: "center",
    },
    gridDotRow: {
        position: "absolute",
        bottom: 12,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 4,
    },
    gridDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotAvailable: {
        backgroundColor: colors.success,
    },
    dotOccupied: {
        backgroundColor: colors.destructive,
    },

    // Modal Details Interface
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: colors.background,
        borderRadius: 28,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
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
        color: colors.primary,
    },
    modalSubheading: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 16,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    batchList: {
        gap: 12,
    },
    batchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    batchRowName: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: colors.primary,
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
});
