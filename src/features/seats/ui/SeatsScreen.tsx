import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

const COLUMNS = 6;
const SECTION_SIZE = 20;
const GRID_PADDING = 20;
const GRID_GAP = 8;

const formatSeatNumber = (num: any) => {
    const str = String(num || "");
    const n = str.replace(/\D/g, "");
    return parseInt(n || "0", 10).toString();
};

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

interface SeatSection {
    title: string;
    availableCount: number;
    total: number;
    data: SeatMatrixSeat[][];
}

export function SeatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();

    const { data, isLoading, error, refetch: fetchData } = useApiData(getSeatMatrixApi, []);

    useFocusEffect(
        useCallback(() => {
            void fetchData();
        }, [fetchData])
    );
    const batchesFilter = data?.batches ?? [];
    const seats = data?.seats ?? [];
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);

    const [selectedSeat, setSelectedSeat] = useState<SeatMatrixSeat | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const sectionListRef = useRef<SectionList<SeatMatrixSeat[], SeatSection>>(null);

    const toggleBatch = (batchId: number) => {
        setSelectedBatchIds((prev) =>
            prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
        );
    };

    const seatChipSize = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

    // Grouping by seat-number range is independent of the batch filter - only
    // the per-seat status color below reacts to that, so sections stay put
    // (no re-chunking / scroll jump) when the user toggles a filter chip.
    const sections = useMemo((): SeatSection[] => {
        return chunk(seats, SECTION_SIZE)
            .filter((group) => group.length > 0)
            .map((group) => {
                const availableCount = group.filter((seat) => seat.batches.some((b) => b.available)).length;
                return {
                    title: `Seats ${formatSeatNumber(group[0].seat_number)}–${formatSeatNumber(group[group.length - 1].seat_number)}`,
                    availableCount,
                    total: group.length,
                    data: chunk(group, COLUMNS),
                };
            });
    }, [seats]);

    const handleJumpToSeat = useCallback(() => {
        const target = formatSeatNumber(searchQuery);
        if (target === "0") return;

        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const rows = sections[sectionIndex].data;
            for (let itemIndex = 0; itemIndex < rows.length; itemIndex++) {
                if (rows[itemIndex].some((seat) => formatSeatNumber(seat.seat_number) === target)) {
                    sectionListRef.current?.scrollToLocation({ sectionIndex, itemIndex, animated: true, viewPosition: 0.2 });
                    return;
                }
            }
        }

        Alert.alert("Not found", `Seat ${target} doesn't exist.`);
    }, [searchQuery, sections]);

    const styles = createStyles(theme, seatChipSize);

    const renderSeatChip = (seat: SeatMatrixSeat) => {
        const displayedBatches = seat.batches.filter((b) => selectedBatchIds.length === 0 || selectedBatchIds.includes(b.batch_id));
        if (displayedBatches.length === 0 && selectedBatchIds.length > 0) return null;

        const allAvailable = displayedBatches.every((b) => b.available);
        const anyAvailable = displayedBatches.some((b) => b.available);

        let textColor = theme.primary;
        let bgTint = theme.success + "15";
        let borderColor = theme.success + "30";

        if (!anyAvailable) {
            // Fully Booked
            textColor = theme.mutedForeground;
            bgTint = theme.muted;
            borderColor = theme.border;
        } else if (!allAvailable) {
            // Partially Booked
            bgTint = theme.warning + "15";
            borderColor = theme.warning + "30";
        }

        return (
            <Pressable key={seat.seat_id} style={[styles.gridSeatCard, { backgroundColor: bgTint, borderColor }]} onPress={() => setSelectedSeat(seat)}>
                <Text style={[styles.gridSeatNumber, { color: textColor }]}>{formatSeatNumber(seat.seat_number)}</Text>
            </Pressable>
        );
    };

    const renderRow = ({ item: row }: { item: SeatMatrixSeat[] }) => <View style={styles.seatRow}>{row.map(renderSeatChip)}</View>;

    const renderSectionHeader = ({ section }: { section: SeatSection }) => (
        <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
            <Text style={styles.sectionHeaderMeta}>
                {section.availableCount}/{section.total} available
            </Text>
        </View>
    );

    const renderListHeader = () => {
        if (batchesFilter.length === 0) return null;

        const physicalSeatsCount = seats.length;
        const summaryStats = batchesFilter.map((batch) => {
            const occupiedInBatch = seats.filter((s) => s.batches.some((b) => b.batch_id === batch.id && !b.available)).length;

            let statusText = "Available";
            let statusColor = theme.success;

            if (occupiedInBatch >= physicalSeatsCount && physicalSeatsCount > 0) {
                statusText = "Full";
                statusColor = theme.destructive;
            } else if (occupiedInBatch >= physicalSeatsCount * 0.8) {
                statusText = "Almost Full";
                statusColor = theme.warning;
            }

            return { id: batch.id, name: batch.name, occupied: occupiedInBatch, total: physicalSeatsCount, statusText, statusColor };
        });

        const totalEnrolled = summaryStats.reduce((sum, b) => sum + b.occupied, 0);
        const totalPossible = summaryStats.length * physicalSeatsCount;

        return (
            <View style={styles.headerSection}>
                {/* 1. SEATS SUMMARY WIDGET */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryTop}>
                        <Text style={styles.summaryTitle}>SEAT CAPACITY</Text>
                        <Text style={styles.summaryPhysical}>{physicalSeatsCount} Total</Text>
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
                                    <Text style={styles.miniBatchRatio}>
                                        {batch.occupied}/{batch.total}
                                    </Text>
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
                        {batchesFilter.map((b) => {
                            const isSelected = selectedBatchIds.includes(b.id);
                            return (
                                <Pressable key={b.id} style={[styles.filterChip, isSelected && styles.filterChipSelected]} onPress={() => toggleBatch(b.id)}>
                                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{b.name}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* 3. JUMP TO SEAT */}
                {seats.length > SECTION_SIZE && (
                    <View style={styles.searchRow}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Jump to seat #"
                            placeholderTextColor={theme.mutedForeground + "80"}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            keyboardType="number-pad"
                            returnKeyType="search"
                            onSubmitEditing={handleJumpToSeat}
                        />
                        <Pressable accessibilityRole="button" style={styles.searchButton} onPress={handleJumpToSeat}>
                            <Ionicons name="search" size={18} color={theme.background} />
                        </Pressable>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
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
                <SectionList<SeatMatrixSeat[], SeatSection>
                    ref={sectionListRef}
                    sections={sections}
                    keyExtractor={(row) => `row-${row[0]?.seat_id}`}
                    renderItem={renderRow}
                    renderSectionHeader={renderSectionHeader}
                    ListHeaderComponent={renderListHeader}
                    stickySectionHeadersEnabled
                    contentContainerStyle={[styles.listContent, { paddingBottom: 40 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    windowSize={10}
                    removeClippedSubviews
                />
            )}

            <Modal visible={!!selectedSeat} transparent={true} animationType="fade" onRequestClose={() => setSelectedSeat(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seat {formatSeatNumber(selectedSeat?.seat_number || "")}</Text>
                            <Pressable accessibilityRole="button" style={styles.modalCloseButton} onPress={() => setSelectedSeat(null)}>
                                <Ionicons name="close" size={24} color={theme.primary} />
                            </Pressable>
                        </View>

                        <Text style={styles.modalSubheading}>Batch Availability</Text>

                        <View style={styles.batchList}>
                            {selectedSeat?.batches.map((b) => {
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

const createStyles = (theme: any, seatChipSize: number) =>
    StyleSheet.create({
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
        },
        filterSection: {
            marginBottom: 12,
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
            borderRadius: RADIUS.sm,
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
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            marginBottom: 8,
        },
        searchInput: {
            flex: 1,
            fontFamily: "sans-medium",
            fontSize: 14,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: RADIUS.sm,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: theme.primary,
        },
        searchButton: {
            width: 40,
            height: 40,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            paddingHorizontal: 20,
        },
        modalContent: {
            backgroundColor: theme.background,
            borderRadius: RADIUS.lg,
            padding: 24,
            ...FLOATING_SHADOW,
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
            borderRadius: RADIUS.md,
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
            borderRadius: RADIUS.sm,
        },
        statusText: {
            fontFamily: "sans-bold",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        headerSection: {
            marginBottom: 4,
        },
        summaryCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            padding: 20,
            marginHorizontal: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.border,
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
            color: theme.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        summaryPhysical: {
            fontFamily: "sans-bold",
            fontSize: 12,
            color: theme.primary,
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
            color: theme.mutedForeground,
            letterSpacing: 0,
        },
        progressContainer: {
            height: 6,
            backgroundColor: theme.muted,
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
            backgroundColor: theme.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            minWidth: 90,
        },
        miniBatchName: {
            fontFamily: "sans-bold",
            fontSize: 11,
            color: theme.mutedForeground,
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
            color: theme.primary,
        },
        sectionHeaderRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: theme.background,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
        },
        sectionHeaderTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 13,
            color: theme.primary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        sectionHeaderMeta: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
        },
        seatRow: {
            flexDirection: "row",
            gap: GRID_GAP,
            paddingHorizontal: GRID_PADDING,
            marginTop: GRID_GAP,
        },
        gridSeatCard: {
            width: seatChipSize,
            height: seatChipSize,
            borderRadius: RADIUS.sm,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
        },
        gridSeatNumber: {
            fontFamily: "sans-extrabold",
            fontSize: 13,
        },
    });
