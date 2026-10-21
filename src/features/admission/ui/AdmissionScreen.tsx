import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { createAdmissionApi } from "@/features/admission/logic/admission-api";
import { ID_PROOF_TYPE_LABELS } from "@/features/admission/types/admission.types";
import { AddIdProofCard, IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
import { uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { GENDER_OPTIONS, Gender } from "@/features/members/types/members.types";
import { PAYMENT_MODE_LABELS, PaymentMode } from "@/features/payments/types/payments.types";

const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { PhotoPickerTile } from "@/shared/ui/PhotoPickerTile";

function formatRupee(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export function AdmissionScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data, isLoading, error, refetch: fetchData } = useApiData(getSeatMatrixApi, []);
    const batches = data?.batches ?? [];
    const seatsData = data?.seats ?? [];

    useFocusEffect(
        useCallback(() => {
            void fetchData();
        }, [fetchData])
    );

    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [assignMode, setAssignMode] = useState<"common" | "perBatch">("common");
    const [commonSeatId, setCommonSeatId] = useState<number | null>(null);
    const [seatsByBatch, setSeatsByBatch] = useState<Record<number, number>>({});

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [gender, setGender] = useState<Gender | null>(null);

    const [payNow, setPayNow] = useState(true);
    const [paidAmount, setPaidAmount] = useState("");
    // Once the owner types an amount, stop overwriting it when batches change.
    const [paidAmountEdited, setPaidAmountEdited] = useState(false);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");

    // Held locally and uploaded after the admission is created.
    const [idProof, setIdProof] = useState<IdProofDraft | null>(null);
    const [isIdProofSheetVisible, setIsIdProofSheetVisible] = useState(false);
    // What the sheet opens with - usually the current draft, but partial when re-taking the front photo.
    const [idProofSheetInitial, setIdProofSheetInitial] = useState<Partial<IdProofDraft> | null>(null);

    const openIdProofSheet = (initial: Partial<IdProofDraft> | null) => {
        setIdProofSheetInitial(initial);
        setIsIdProofSheetVisible(true);
    };

    const removeIdProofFront = () => {
        if (!idProof) return;
        // The front photo is required: with a back photo kept, ask for a new front; otherwise drop the ID proof.
        if (idProof.backUri) {
            openIdProofSheet({ type: idProof.type, backUri: idProof.backUri });
        } else {
            setIdProof(null);
        }
    };

    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const seatAvailableForBatches = (seat: (typeof seatsData)[number], batchIds: number[]) =>
        batchIds.every((bId) => seat.batches.find((sb) => sb.batch_id === bId)?.available === true);

    const hasCommonSeatOption = useMemo(
        () => selectedBatchIds.length > 0 && seatsData.some((seat) => seatAvailableForBatches(seat, selectedBatchIds)),
        [selectedBatchIds, seatsData]
    );

    const totalMonthlyFee = useMemo(
        () => selectedBatchIds.reduce((sum, bId) => sum + (parseFloat(batches.find((b) => b.id === bId)?.monthly_fee || "0") || 0), 0),
        [selectedBatchIds, batches]
    );

    useEffect(() => {
        if (!paidAmountEdited) setPaidAmount(totalMonthlyFee > 0 ? String(totalMonthlyFee) : "");
    }, [totalMonthlyFee, paidAmountEdited]);

    const paidAmountValue = parseFloat(paidAmount) || 0;
    const isPartialPayment = payNow && paidAmountValue > 0 && paidAmountValue < totalMonthlyFee;

    const toggleBatch = (batchId: number) => {
        setSubmitError(null);
        const nextSelected = selectedBatchIds.includes(batchId) ? selectedBatchIds.filter((id) => id !== batchId) : [...selectedBatchIds, batchId];
        setSelectedBatchIds(nextSelected);
        setCommonSeatId(null);
        setSeatsByBatch({});

        const hasCommon = nextSelected.length > 0 && seatsData.some((seat) => seatAvailableForBatches(seat, nextSelected));
        setAssignMode(hasCommon ? "common" : "perBatch");
    };

    const handleSeatSelect = (seatId: number) => {
        setSubmitError(null);
        setCommonSeatId(seatId);
    };

    const handlePerBatchSeatSelect = (batchId: number, seatId: number) => {
        setSubmitError(null);
        setSeatsByBatch((prev) => ({ ...prev, [batchId]: seatId }));
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
        if (payNow && paidAmountValue <= 0) {
            setSubmitError('Please enter the amount received, or choose "Pay later".');
            return;
        }

        let allocationPayload: { batch_id: number; seat_id: number }[];

        if (assignMode === "common") {
            if (!commonSeatId) {
                setSubmitError("Please select an available seat from the grid.");
                return;
            }
            allocationPayload = selectedBatchIds.map((bId) => ({ batch_id: bId, seat_id: commonSeatId }));
        } else {
            const missingBatchId = selectedBatchIds.find((bId) => !seatsByBatch[bId]);
            if (missingBatchId) {
                const missingBatchName = batches.find((b) => b.id === missingBatchId)?.name || "a batch";
                setSubmitError(`Please select a seat for ${missingBatchName}.`);
                return;
            }
            allocationPayload = selectedBatchIds.map((bId) => ({ batch_id: bId, seat_id: seatsByBatch[bId] }));
        }

        try {
            setIsSubmitting(true);
            const { memberId } = await createAdmissionApi({
                name: name.trim(),
                phone: phone.trim(),
                gender: gender ?? undefined,
                allocations: allocationPayload,
                payment: payNow ? { amount: paidAmountValue, payment_mode: paymentMode } : undefined,
            });

            if (idProof) {
                try {
                    await uploadMemberIdProofApi(memberId, idProof.type, "front", idProof.frontUri);
                    if (idProof.backUri) {
                        await uploadMemberIdProofApi(memberId, idProof.type, "back", idProof.backUri);
                    }
                } catch {
                    Alert.alert("Admission confirmed", "Admission was created, but the ID proof photo failed to upload. You can add it from the member's profile.");
                    router.back();
                    return;
                }
            }

            Alert.alert(
                "Admission confirmed",
                payNow
                    ? `${formatRupee(paidAmountValue)} received via ${PAYMENT_MODE_LABELS[paymentMode]}.${isPartialPayment ? ` ${formatRupee(totalMonthlyFee - paidAmountValue)} is still due.` : ""}`
                    : "No payment recorded - the member will show as due."
            );
            router.back();
        } catch (err: any) {
            setSubmitError(err.message || "Failed to create admission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>New Admission</Text>
                        <Text style={styles.headerSubtitle}>Onboard member and allocate seat</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {isLoading ? (
                        <LoadingState />
                    ) : error ? (
                        <ErrorState message={error} onRetry={fetchData} />
                    ) : batches.length === 0 ? (
                        <EmptyState
                            icon="calendar-outline"
                            title="No batches set up yet"
                            subtitle="You need at least one batch before you can admit a student — batches are what a seat gets booked against."
                            actionLabel="Set up a batch"
                            onAction={() => router.push("/batches")}
                        />
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
                                                    {b.name} · {formatRupee(parseFloat(b.monthly_fee) || 0)}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {selectedBatchIds.length > 0 && (
                                    <View style={styles.feeSummaryRow}>
                                        <Text style={styles.feeSummaryLabel}>Total Monthly Fee</Text>
                                        <Text style={styles.feeSummaryValue}>{formatRupee(totalMonthlyFee)}</Text>
                                    </View>
                                )}
                            </View>

                            {/* SEAT ASSIGNMENT */}
                            {selectedBatchIds.length > 0 && (
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Assign Seat</Text>

                                    {selectedBatchIds.length > 1 && (
                                        <View style={styles.modeToggleRow}>
                                            <Pressable
                                                style={[styles.modeToggleChip, assignMode === "common" && styles.modeToggleChipActive]}
                                                onPress={() => {
                                                    setAssignMode("common");
                                                    setSeatsByBatch({});
                                                }}>
                                                <Text style={[styles.modeToggleText, assignMode === "common" && styles.modeToggleTextActive]}>Same seat for all</Text>
                                            </Pressable>
                                            <Pressable
                                                style={[styles.modeToggleChip, assignMode === "perBatch" && styles.modeToggleChipActive]}
                                                onPress={() => {
                                                    setAssignMode("perBatch");
                                                    setCommonSeatId(null);
                                                }}>
                                                <Text style={[styles.modeToggleText, assignMode === "perBatch" && styles.modeToggleTextActive]}>Different seat per batch</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    {assignMode === "common" ? (
                                        <>
                                            <Text style={styles.gridInstruction}>
                                                {hasCommonSeatOption
                                                    ? "The grid shows all seats. Only seats available across ALL selected batches can be picked."
                                                    : 'No single seat is free across every selected batch — switch to "Different seat per batch" above.'}
                                            </Text>

                                            <View style={styles.unifiedGrid}>
                                                {seatsData.map((seat) => {
                                                    const isFullyAvailable = seatAvailableForBatches(seat, selectedBatchIds);
                                                    const isSelected = commonSeatId === seat.seat_id;

                                                    if (isFullyAvailable) {
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
                                                    }
                                                    return (
                                                        <View key={seat.seat_id} style={[styles.gridSeatBox, styles.gridSeatBoxDisabled]}>
                                                            <Text style={styles.gridSeatNumberDisabled}>{seat.seat_number}</Text>
                                                            <View style={styles.strikethrough} />
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </>
                                    ) : (
                                        selectedBatchIds.map((bId) => {
                                            const batch = batches.find((b) => b.id === bId);
                                            return (
                                                <View key={bId} style={styles.perBatchBlock}>
                                                    <Text style={styles.perBatchLabel}>{batch?.name ?? "Batch"}</Text>
                                                    <View style={styles.unifiedGrid}>
                                                        {seatsData.map((seat) => {
                                                            const isAvailable = seat.batches.find((sb) => sb.batch_id === bId)?.available === true;
                                                            const isSelected = seatsByBatch[bId] === seat.seat_id;

                                                            if (isAvailable) {
                                                                return (
                                                                    <Pressable
                                                                        key={seat.seat_id}
                                                                        style={[styles.gridSeatBox, isSelected && styles.gridSeatBoxSelected]}
                                                                        onPress={() => handlePerBatchSeatSelect(bId, seat.seat_id)}>
                                                                        <Text style={[styles.gridSeatNumber, isSelected && styles.gridSeatNumberSelected]}>
                                                                            {seat.seat_number}
                                                                        </Text>
                                                                    </Pressable>
                                                                );
                                                            }
                                                            return (
                                                                <View key={seat.seat_id} style={[styles.gridSeatBox, styles.gridSeatBoxDisabled]}>
                                                                    <Text style={styles.gridSeatNumberDisabled}>{seat.seat_number}</Text>
                                                                    <View style={styles.strikethrough} />
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            );
                                        })
                                    )}
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
                                        placeholderTextColor={theme.mutedForeground + "80"}
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
                                        placeholderTextColor={theme.mutedForeground + "80"}
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        maxLength={15}
                                    />
                                </View>
                                <ChoiceChips label="Gender (Optional)" value={gender} options={GENDER_OPTIONS} onChange={setGender} allowDeselect />
                            </View>

                            {/* FIRST PAYMENT */}
                            {selectedBatchIds.length > 0 && (
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>First Payment</Text>
                                    <View style={styles.modeToggleRow}>
                                        <Pressable
                                            style={[styles.modeToggleChip, payNow && styles.modeToggleChipActive]}
                                            onPress={() => {
                                                setPayNow(true);
                                                setSubmitError(null);
                                            }}>
                                            <Text style={[styles.modeToggleText, payNow && styles.modeToggleTextActive]}>Paid now</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.modeToggleChip, !payNow && styles.modeToggleChipActive]}
                                            onPress={() => {
                                                setPayNow(false);
                                                setSubmitError(null);
                                            }}>
                                            <Text style={[styles.modeToggleText, !payNow && styles.modeToggleTextActive]}>Pay later</Text>
                                        </Pressable>
                                    </View>

                                    {payNow ? (
                                        <>
                                            <View style={styles.inputWrap}>
                                                <Text style={styles.inputLabel}>Amount Received</Text>
                                                <View style={styles.amountField}>
                                                    <Text style={styles.amountPrefix}>₹</Text>
                                                    <TextInput
                                                        style={styles.amountInput}
                                                        value={paidAmount}
                                                        onChangeText={(text) => {
                                                            setPaidAmount(text.replace(/[^0-9.]/g, ""));
                                                            setPaidAmountEdited(true);
                                                            setSubmitError(null);
                                                        }}
                                                        keyboardType="decimal-pad"
                                                        placeholder="0"
                                                        placeholderTextColor={theme.mutedForeground + "80"}
                                                    />
                                                </View>
                                                {isPartialPayment && (
                                                    <Text style={styles.paymentHint}>Partial payment - {formatRupee(totalMonthlyFee - paidAmountValue)} will show as due.</Text>
                                                )}
                                            </View>

                                            <ChoiceChips label="Payment Mode" value={paymentMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPaymentMode(mode)} />
                                        </>
                                    ) : (
                                        <Text style={styles.paymentHint}>No payment will be recorded. The member will show as due from today, so you can collect later from Dues & Renewals.</Text>
                                    )}
                                </View>
                            )}

                            {/* ID PROOF (OPTIONAL) */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>ID Proof (Optional)</Text>
                                {idProof ? (
                                    <View style={styles.idProofSummary}>
                                        <View style={styles.idProofSummaryHeader}>
                                            <View style={styles.idProofSummaryIcon}>
                                                <Ionicons name="card-outline" size={20} color={theme.accent} />
                                            </View>
                                            <View style={styles.idProofSummaryText}>
                                                <Text style={styles.idProofSummaryTitle}>{ID_PROOF_TYPE_LABELS[idProof.type]}</Text>
                                                <Text style={styles.idProofSummarySubtitle}>{idProof.backUri ? "Front & back added" : "Front added"}</Text>
                                            </View>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                                        </View>
                                        <View style={styles.idProofThumbRow}>
                                            <PhotoPickerTile label="Front" uri={idProof.frontUri} onAdd={() => openIdProofSheet(idProof)} onRemove={removeIdProofFront} />
                                            <PhotoPickerTile
                                                label="Back"
                                                hint="(optional)"
                                                uri={idProof.backUri}
                                                onAdd={() => openIdProofSheet(idProof)}
                                                onRemove={() => setIdProof({ ...idProof, backUri: null })}
                                            />
                                        </View>
                                        <View style={styles.idProofActionRow}>
                                            <Pressable accessibilityRole="button" style={styles.idProofActionBtn} onPress={() => openIdProofSheet(idProof)}>
                                                <Ionicons name="pencil" size={14} color={theme.primary} />
                                                <Text style={styles.idProofActionText}>Edit</Text>
                                            </Pressable>
                                            <Pressable accessibilityRole="button" style={styles.idProofActionBtn} onPress={() => setIdProof(null)}>
                                                <Ionicons name="trash-outline" size={14} color={theme.destructive} />
                                                <Text style={[styles.idProofActionText, { color: theme.destructive }]}>Remove</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ) : (
                                    <AddIdProofCard title="No ID proof added" onAdd={() => openIdProofSheet(null)} />
                                )}
                            </View>

                            {submitError && (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={18} color={theme.destructive} />
                                    <Text style={styles.errorText}>{submitError}</Text>
                                </View>
                            )}

                            <Pressable style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Confirm Admission</Text>
                                )}
                            </Pressable>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <IdProofSheet
                visible={isIdProofSheetVisible}
                onClose={() => setIsIdProofSheetVisible(false)}
                initial={idProofSheetInitial}
                saveLabel="Done"
                onSave={(draft) => {
                    setIdProof(draft);
                    setIsIdProofSheetVisible(false);
                    setSubmitError(null);
                }}
            />
        </SafeAreaView>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: theme.background,
    },
    flex: {
        flex: 1,
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
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },
    sectionBlock: {
        backgroundColor: theme.card,
        padding: 20,
        borderRadius: RADIUS.md,
        marginBottom: 24,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    sectionTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 14,
        color: theme.primary,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingBottom: 10,
    },
    idProofSummary: {
        gap: 14,
    },
    idProofSummaryHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    idProofSummaryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.accent + "15",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    idProofSummaryText: {
        flex: 1,
    },
    idProofSummaryTitle: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: theme.primary,
    },
    idProofSummarySubtitle: {
        fontFamily: "sans-medium",
        fontSize: 12,
        color: theme.mutedForeground,
        marginTop: 2,
    },
    idProofThumbRow: {
        flexDirection: "row",
        gap: 12,
    },
    idProofActionRow: {
        flexDirection: "row",
        gap: 10,
    },
    idProofActionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 40,
        borderRadius: RADIUS.sm,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
    },
    idProofActionText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
    },
    chipRowWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: theme.border,
    },
    filterChipSelected: {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
    },
    filterChipText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: theme.primary,
    },
    filterChipTextSelected: {
        color: "#fff",
    },
    feeSummaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border,
    },
    feeSummaryLabel: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    feeSummaryValue: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        color: theme.accent,
    },
    modeToggleRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 16,
    },
    modeToggleChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: RADIUS.md,
        alignItems: "center",
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
    },
    modeToggleChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    modeToggleText: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: theme.mutedForeground,
        textAlign: "center",
    },
    modeToggleTextActive: {
        color: theme.background,
    },
    perBatchBlock: {
        marginBottom: 20,
    },
    perBatchLabel: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
        marginBottom: 10,
    },
    gridInstruction: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: theme.mutedForeground,
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
        backgroundColor: theme.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
    },
    gridSeatBoxSelected: {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
    },
    gridSeatNumber: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: theme.primary,
        textAlign: "center",
    },
    gridSeatNumberSelected: {
        color: "#fff",
    },
    gridSeatBoxDisabled: {
        backgroundColor: theme.muted,
        borderColor: theme.border,
        opacity: 0.6,
    },
    gridSeatNumberDisabled: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: theme.mutedForeground,
        textAlign: "center",
    },
    strikethrough: {
        position: "absolute",
        width: "80%",
        height: 2,
        backgroundColor: theme.mutedForeground,
        transform: [{ rotate: "-45deg" }],
        opacity: 0.3,
    },
    inputWrap: {
        marginBottom: 16,
    },
    inputLabel: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    inputField: {
        fontFamily: "sans-medium",
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: theme.primary,
    },
    amountField: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
    },
    amountPrefix: {
        fontFamily: "sans-bold",
        fontSize: 17,
        color: theme.mutedForeground,
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontFamily: "sans-bold",
        fontSize: 17,
        color: theme.primary,
        paddingVertical: 14,
    },
    paymentHint: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: theme.mutedForeground,
        lineHeight: 18,
        marginTop: 8,
    },
    errorBox: {
        backgroundColor: theme.destructive + "1A",
        padding: 14,
        borderRadius: RADIUS.md,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
    },
    errorText: {
        fontFamily: "sans-semibold",
        color: theme.destructive,
        fontSize: 14,
        flex: 1,
    },
    submitButton: {
        backgroundColor: theme.accent,
        padding: 20,
        borderRadius: RADIUS.md,
        alignItems: "center",
    },
    submitButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: "#fff",
    },
});
