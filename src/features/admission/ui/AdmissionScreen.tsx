import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createAdmissionApi } from "@/features/admission/logic/admission-api";
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { colors } from "@/shared/constants/theme";

export function AdmissionScreen() {
    const router = useRouter();

    const [batches, setBatches] = useState<MatrixBatchRef[]>([]);
    const [seatsData, setSeatsData] = useState<SeatMatrixSeat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [commonSeatId, setCommonSeatId] = useState<number | null>(null);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");

    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await getSeatMatrixApi();
            if (response.status) {
                setBatches(response.data?.batches || []);
                setSeatsData(response.data?.seats || []);
            } else {
                setError("Failed to fetch matrices.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const toggleBatch = (batchId: number) => {
        setSubmitError(null);
        if (selectedBatchIds.includes(batchId)) {
            setSelectedBatchIds((prev) => prev.filter((id) => id !== batchId));
        } else {
            setSelectedBatchIds((prev) => [...prev, batchId]);
        }
        // Reset seat selection if batches change to force re-evaluation
        setCommonSeatId(null);
    };

    const handleSeatSelect = (seatId: number) => {
        setSubmitError(null);
        setCommonSeatId(seatId);
    };

    const handleSubmit = async () => {
        setSubmitError(null);
        if (!name.trim()) {
            setSubmitError("Please enter the complete student name.");
            return;
        }
        if (phone.length < 10) {
            setSubmitError("Please map a valid 10-digit phone number.");
            return;
        }
        if (selectedBatchIds.length === 0) {
            setSubmitError("You must select at least one batch.");
            return;
        }
        if (!commonSeatId) {
            setSubmitError("Please select an available seat from the grid.");
            return;
        }

        // Payload maps the SAME chosen central seat to ALL chosen batches
        const allocationPayload = selectedBatchIds.map((bId) => ({
            batch_id: bId,
            seat_id: commonSeatId,
        }));

        try {
            setIsSubmitting(true);
            await createAdmissionApi({
                name: name.trim(),
                phone: phone.trim(),
                allocations: allocationPayload,
            });
            Alert.alert("Success", "Admission confirmed correctly!");
            router.back();
        } catch (err: any) {
            setSubmitError(err.message || "Failed to create admission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={colors.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>New Admission</Text>
                        <Text style={styles.headerSubtitle}>Onboard member and allocate seat</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {isLoading ? (
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                    ) : error ? (
                        <Text style={{ textAlign: "center", marginTop: 20, color: colors.destructive }}>{error}</Text>
                    ) : (
                        <>
                            {/* BATCH SELECTION */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Select Batches</Text>
                                <View style={styles.chipRowWrap}>
                                    {batches.map((b) => {
                                        const isSelected = selectedBatchIds.includes(b.id);
                                        return (
                                            <Pressable
                                                key={b.id}
                                                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                                                onPress={() => toggleBatch(b.id)}>
                                                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                                                    {b.name}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* UNIFIED SEAT GRID */}
                            {selectedBatchIds.length > 0 && (
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Assign Common Seat</Text>
                                    <Text style={styles.gridInstruction}>
                                        The grid shows all seats. Only seats available across ALL selected batches can be picked.
                                    </Text>

                                    <View style={styles.unifiedGrid}>
                                        {seatsData.map((seat) => {
                                            // Check if this seat is available in ALL selected batches
                                            const isFullyAvailable = selectedBatchIds.every((bId) => {
                                                const match = seat.batches.find((sb) => sb.batch_id === bId);
                                                return match?.available === true;
                                            });

                                            const isSelected = commonSeatId === seat.seat_id;

                                            if (isFullyAvailable) {
                                                // Selectable Seat
                                                return (
                                                    <Pressable
                                                        key={seat.seat_id}
                                                        style={[styles.gridSeatBox, isSelected && styles.gridSeatBoxSelected]}
                                                        onPress={() => handleSeatSelect(seat.seat_id)}>
                                                        <Text style={[styles.gridSeatNumber, isSelected && styles.gridSeatNumberSelected]}>
                                                            {seat.seat_number}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            } else {
                                                // Booked / Disabled Seat (visible so owner can see what is blocked)
                                                return (
                                                    <View key={seat.seat_id} style={[styles.gridSeatBox, styles.gridSeatBoxDisabled]}>
                                                        <Text style={styles.gridSeatNumberDisabled}>{seat.seat_number}</Text>
                                                        {/* Overlay a small lock icon or line indicating it is booked */}
                                                        <View style={styles.strikethrough} />
                                                    </View>
                                                );
                                            }
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* USER INFO */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Member Info</Text>
                                <View style={styles.inputWrap}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <TextInput
                                        style={styles.inputField}
                                        placeholder="e.g. John Doe"
                                        placeholderTextColor="rgba(0,0,0,0.3)"
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.inputWrap}>
                                    <Text style={styles.inputLabel}>Phone Number</Text>
                                    <TextInput
                                        style={styles.inputField}
                                        placeholder="10-digit mobile number"
                                        placeholderTextColor="rgba(0,0,0,0.3)"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        maxLength={15}
                                    />
                                </View>
                            </View>

                            {/* SUBMIT */}
                            {submitError && (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                                    <Text style={styles.errorText}>{submitError}</Text>
                                </View>
                            )}

                            <Pressable style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <ActivityIndicator color={colors.background} size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Confirm Admission</Text>
                                )}
                            </Pressable>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    flex: {
        flex: 1,
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
    sectionBlock: {
        backgroundColor: colors.card,
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    sectionTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        color: colors.primary,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 10,
    },
    chipRowWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.background,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipSelected: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    filterChipText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.primary,
    },
    filterChipTextSelected: {
        color: "#fff",
    },
    gridInstruction: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
        marginBottom: 16,
        lineHeight: 18,
    },
    unifiedGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: "center",
    },
    gridSeatBox: {
        width: "21%",
        paddingVertical: 18,
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    gridSeatBoxSelected: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    gridSeatNumber: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: colors.primary,
        textAlign: "center",
    },
    gridSeatNumberSelected: {
        color: colors.background,
    },
    gridSeatBoxDisabled: {
        backgroundColor: colors.muted,
        borderColor: colors.muted,
        opacity: 0.8,
    },
    gridSeatNumberDisabled: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: "rgba(0,0,0,0.25)",
        textAlign: "center",
    },
    strikethrough: {
        position: "absolute",
        width: "80%",
        height: 2,
        backgroundColor: "rgba(0,0,0,0.15)",
        transform: [{ rotate: "-45deg" }],
    },
    inputWrap: {
        marginBottom: 16,
    },
    inputLabel: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: colors.primary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    inputField: {
        fontFamily: "sans-medium",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.primary,
    },
    errorBox: {
        backgroundColor: colors.destructive + "1A",
        padding: 14,
        borderRadius: 16,
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
    submitButton: {
        backgroundColor: colors.accent,
        padding: 20,
        borderRadius: 18,
        alignItems: "center",
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: "#fff",
    },
});
