import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createBatchApi, getBatchesApi } from "@/features/batches/logic/batches-api";
import { Batch } from "@/features/batches/types/batches.types";
import { colors } from "@/shared/constants/theme";

// Standard times for selection
const TIME_OPTIONS = [
    "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
    "21:00", "22:00", "23:00", "00:00", "01:00", "02:00"
];

function formatRupee(amountStr: string): string {
    const amount = parseFloat(amountStr) || 0;
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatTimeDisplay(t: string): string {
    if (!t) return "Select Time";
    const parts = t.split(":");
    if (parts.length < 2) return t;
    let hour = parseInt(parts[0], 10);
    const min = parts[1];
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour < 10 ? "0" : ""}${hour}:${min} ${ampm}`;
}

export function BatchesScreen() {
    const router = useRouter();

    const [batches, setBatches] = useState<Batch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [newName, setNewName] = useState("");
    const [newStartTime, setNewStartTime] = useState("");
    const [newEndTime, setNewEndTime] = useState("");
    const [newFee, setNewFee] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Time Picker Picker State
    const [selectingTimeFor, setSelectingTimeFor] = useState<"start" | "end" | null>(null);

    const fetchBatches = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await getBatchesApi();
            // Handle standard response wrapper
            if (response.status) {
                setBatches(response.data || []);
            } else {
                setError("Failed to fetch batches.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred while fetching batches.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchBatches();
    }, [fetchBatches]);

    const handleCreateBatch = async () => {
        setSubmitError(null);
        if (!newName || !newStartTime || !newEndTime || !newFee) {
            setSubmitError("Please fill out all fields.");
            return;
        }

        try {
            setIsSubmitting(true);
            await createBatchApi({
                name: newName,
                start_time: newStartTime,
                end_time: newEndTime,
                monthly_fee: newFee,
            });
            setIsAddModalVisible(false);

            // Reset fields
            setNewName("");
            setNewStartTime("");
            setNewEndTime("");
            setNewFee("");

            // Refetch data
            await fetchBatches();
        } catch (err: any) {
            // Surface the backend validation/overlap error safely parsing the response
            setSubmitError(err.message || "Failed to create batch due to an unknown overlap.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderTimePicker = () => (
        <View style={styles.timePickerContainer}>
            <Text style={styles.timePickerTitle}>
                Select {selectingTimeFor === "start" ? "Start" : "End"} Time
            </Text>
            <ScrollView
                horizontal={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timePickerGrid}
            >
                {TIME_OPTIONS.map((time) => (
                    <Pressable
                        key={time}
                        style={styles.timePickerPill}
                        onPress={() => {
                            if (selectingTimeFor === "start") setNewStartTime(time);
                            if (selectingTimeFor === "end") setNewEndTime(time);
                            setSelectingTimeFor(null);
                        }}>
                        <Text style={styles.timePickerPillText}>{formatTimeDisplay(time)}</Text>
                    </Pressable>
                ))}
            </ScrollView>
            <Pressable style={styles.timePickerCancelBtn} onPress={() => setSelectingTimeFor(null)}>
                <Text style={styles.timePickerCancelText}>Cancel</Text>
            </Pressable>
        </View>
    );

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
                        <Text style={styles.headerTitle}>Seat Batches</Text>
                        <Text style={styles.headerSubtitle}>Manage timeslots & pricing</Text>
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        style={[styles.headerActionCircle, { backgroundColor: colors.primary }]}
                        onPress={() => {
                            setSubmitError(null);
                            setIsAddModalVisible(true);
                        }}>
                        <Ionicons name="add" size={24} color={colors.card} />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryContainer}>
                    <Text style={styles.sectionTitle}>Active Batches ({batches.length})</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                ) : error ? (
                    <Text style={{ textAlign: "center", marginTop: 20, color: colors.destructive }}>{error}</Text>
                ) : batches.length === 0 ? (
                    <Text style={{ textAlign: "center", marginTop: 20, color: colors.mutedForeground }}>
                        No batches configured yet.
                    </Text>
                ) : (
                    batches.map((batch) => {
                        const capacity = batch.total_seats || 50;
                        const filled = batch.allocations_count || 0;
                        const isFull = filled >= capacity;
                        const occupancyPercent = (filled / capacity) * 100;

                        return (
                            <View key={batch.id} style={styles.batchCard}>
                                <View style={styles.batchHeader}>
                                    <View style={styles.batchTitleWrap}>
                                        <Text style={styles.batchName}>{batch.name}</Text>
                                        <View style={styles.timeWrap}>
                                            <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                                            <Text style={styles.timeText}>
                                                {formatTimeDisplay(batch.start_time)} - {formatTimeDisplay(batch.end_time)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.priceBadge}>
                                        <Text style={styles.priceText}>{formatRupee(batch.monthly_fee)}</Text>
                                    </View>
                                </View>

                                <View style={styles.statsRow}>
                                    <View style={styles.statBlock}>
                                        <Text style={styles.statValue}>
                                            {filled} <Text style={styles.statDivider}>/ {capacity}</Text>
                                        </Text>
                                        <Text style={styles.statLabel}>Seats filled</Text>
                                    </View>
                                    {isFull ? (
                                        <View style={[styles.statusBadge, { backgroundColor: colors.destructive + "1A" }]}>
                                            <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                                            <Text style={[styles.statusText, { color: colors.destructive }]}>Full</Text>
                                        </View>
                                    ) : (
                                        <View style={[styles.statusBadge, { backgroundColor: colors.success + "1A" }]}>
                                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                            <Text style={[styles.statusText, { color: colors.success }]}>Available</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${occupancyPercent}%` },
                                            isFull && { backgroundColor: colors.destructive },
                                        ]}
                                    />
                                </View>
                            </View>
                        );
                    })
                )}

                {!isLoading && (
                    <Pressable style={styles.heavyAddButton} onPress={() => {
                        setSubmitError(null);
                        setIsAddModalVisible(true);
                    }}>
                        <Ionicons name="add-circle" size={24} color={colors.primary} />
                        <Text style={styles.heavyAddButtonText}>Create New Batch</Text>
                    </Pressable>
                )}
            </ScrollView>

            <Modal
                visible={isAddModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAddModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectingTimeFor ? (
                            renderTimePicker()
                        ) : (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Create New Batch</Text>
                                    <Pressable
                                        accessibilityRole="button"
                                        style={styles.modalCloseButton}
                                        onPress={() => setIsAddModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={colors.primary} />
                                    </Pressable>
                                </View>

                                <Text style={styles.inputLabel}>Batch Name</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Morning Focus"
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholderTextColor="rgba(0,0,0,0.3)"
                                />

                                <View style={styles.modalRowGroup}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Start Time</Text>
                                        <Pressable
                                            style={styles.modalTimeSelector}
                                            onPress={() => setSelectingTimeFor("start")}>
                                            <Ionicons name="time-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                            <Text style={[styles.modalTimeSelectorText, !newStartTime && { color: "rgba(0,0,0,0.3)" }]}>
                                                {formatTimeDisplay(newStartTime)}
                                            </Text>
                                        </Pressable>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>End Time</Text>
                                        <Pressable
                                            style={styles.modalTimeSelector}
                                            onPress={() => setSelectingTimeFor("end")}>
                                            <Ionicons name="time-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                            <Text style={[styles.modalTimeSelectorText, !newEndTime && { color: "rgba(0,0,0,0.3)" }]}>
                                                {formatTimeDisplay(newEndTime)}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>

                                <Text style={styles.inputLabel}>Monthly Fee (Rs)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="500"
                                    value={newFee}
                                    onChangeText={setNewFee}
                                    keyboardType="numeric"
                                    placeholderTextColor="rgba(0,0,0,0.3)"
                                />

                                {submitError && (
                                    <View style={styles.errorBox}>
                                        <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                                        <Text style={styles.errorText}>{submitError}</Text>
                                    </View>
                                )}

                                <Pressable
                                    style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.7 }]}
                                    onPress={handleCreateBatch}
                                    disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.modalSubmitText}>Create Batch</Text>
                                    )}
                                </Pressable>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
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
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },
    summaryContainer: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontFamily: "sans-bold",
        fontSize: 14,
        letterSpacing: 1.2,
        color: colors.mutedForeground,
        textTransform: "uppercase",
    },
    batchCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 0,
        padding: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    batchHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    batchTitleWrap: {
        flex: 1,
        paddingRight: 12,
    },
    batchName: {
        fontFamily: "sans-bold",
        fontSize: 16,
        color: colors.primary,
        marginBottom: 4,
    },
    timeWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    timeText: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
    },
    priceBadge: {
        backgroundColor: colors.muted,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    priceText: {
        fontFamily: "sans-extrabold",
        fontSize: 13,
        color: colors.primary,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 16,
    },
    statBlock: {
        flex: 1,
    },
    statValue: {
        fontFamily: "sans-extrabold",
        fontSize: 32,
        color: colors.primary,
        marginBottom: 0,
    },
    statDivider: {
        fontFamily: "sans-semibold",
        fontSize: 16,
        color: colors.mutedForeground,
    },
    statLabel: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontFamily: "sans-bold",
        fontSize: 13,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: colors.muted,
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: colors.accent,
        borderRadius: 3,
    },
    heavyAddButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 16,
        marginTop: 8,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: "dashed",
    },
    heavyAddButtonText: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: colors.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 48,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 20,
        color: colors.primary,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    inputLabel: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: colors.primary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    modalInput: {
        fontFamily: "sans-medium",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.primary,
        marginBottom: 20,
    },
    modalTimeSelector: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 20,
    },
    modalTimeSelectorText: {
        fontFamily: "sans-medium",
        fontSize: 16,
        color: colors.primary,
    },
    modalRowGroup: {
        flexDirection: "row",
        gap: 16,
    },
    errorBox: {
        backgroundColor: colors.destructive + "1A",
        padding: 12,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
    },
    errorText: {
        fontFamily: "sans-semibold",
        color: colors.destructive,
        fontSize: 14,
        flex: 1,
    },
    modalSubmitBtn: {
        backgroundColor: colors.accent,
        padding: 18,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 8,
    },
    modalSubmitText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: "#fff",
    },
    timePickerContainer: {
        height: 400,
    },
    timePickerTitle: {
        fontFamily: "sans-bold",
        fontSize: 18,
        color: colors.primary,
        marginBottom: 16,
        textAlign: "center",
    },
    timePickerGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 10,
        paddingBottom: 20,
    },
    timePickerPill: {
        width: "31%",
        backgroundColor: colors.card,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    timePickerPillText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.primary,
    },
    timePickerCancelBtn: {
        padding: 16,
        alignItems: "center",
        marginTop: 8,
    },
    timePickerCancelText: {
        fontFamily: "sans-bold",
        fontSize: 16,
        color: colors.mutedForeground,
    }
});
