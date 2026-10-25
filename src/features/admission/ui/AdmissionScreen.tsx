import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { createAdmissionApi } from "@/features/admission/logic/admission-api";
import { firstFreeSeat, isSeatFree } from "@/features/admission/logic/seat-picking";
import { formatTime } from "@/features/batches/logic/batch-time";
import { ID_PROOF_TYPE_LABELS } from "@/features/admission/types/admission.types";
import { AddIdProofCard, IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
import { SeatPickerSheet } from "@/features/admission/ui/SeatPickerSheet";
import { uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { GENDER_OPTIONS, Gender } from "@/features/members/types/members.types";
import { PAYMENT_MODE_LABELS, PaymentMode } from "@/features/payments/types/payments.types";

const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { PhotoPickerTile } from "@/shared/ui/PhotoPickerTile";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { DateField } from "@/shared/ui/DateField";
import { Text, TextInput } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";
import { addDays, addMonths, formatShortDate, todayIso } from "@/shared/utils/dates";

export function AdmissionScreen() {
    const router = useRouter();
    // Set when readmitting a member who left (from their profile's "Readmit" button).
    const readmit = useLocalSearchParams<{ name?: string; phone?: string; gender?: Gender; address?: string; outstanding?: string }>();
    const isReadmission = !!readmit.phone;
    const previousDues = parseFloat(readmit.outstanding ?? "0") || 0;
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data, isLoading, error, refetch: fetchData } = useApiData(getSeatMatrixApi, []);
    const batches = data?.batches ?? [];
    // Seat-number order, so "first free seat" and the picker's blocks run 1, 2, 3...
    const seatsData = useMemo(() => [...(data?.seats ?? [])].sort((a, b) => Number(a.seat_number) - Number(b.seat_number)), [data?.seats]);

    useFocusEffect(
        useCallback(() => {
            void fetchData();
        }, [fetchData])
    );

    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [assignMode, setAssignMode] = useState<"common" | "perBatch">("common");
    const [commonSeatId, setCommonSeatId] = useState<number | null>(null);
    const [seatsByBatch, setSeatsByBatch] = useState<Record<number, number>>({});
    // Which seat the picker sheet is choosing: the shared seat, one batch's seat, or closed.
    const [pickerFor, setPickerFor] = useState<"common" | number | null>(null);

    const [name, setName] = useState(readmit.name ?? "");
    const [phone, setPhone] = useState(readmit.phone ?? "");
    const [gender, setGender] = useState<Gender | null>(readmit.gender ?? null);
    // Optional, for the owner's records; deliberately not labelled "Optional" to keep the form calm.
    const [address, setAddress] = useState(readmit.address ?? "");

    // Dues the member left behind: the owner collects some or all of it, or waives it.
    const [collectPreviousDues, setCollectPreviousDues] = useState(true);
    const [previousDuesAmount, setPreviousDuesAmount] = useState(previousDues > 0 ? String(Math.round(previousDues)) : "");
    const [previousDuesMode, setPreviousDuesMode] = useState<PaymentMode>("cash");
    const previousDuesValue = collectPreviousDues ? parseFloat(previousDuesAmount) || 0 : 0;

    // When they started: today unless entering someone who was already a member before the app.
    const today = todayIso();
    const [joinDate, setJoinDate] = useState(today);
    // Existing members only: the last day they'd already paid for (not counted as money received today).
    const [paidBefore, setPaidBefore] = useState(false);
    const [paidUntil, setPaidUntil] = useState<string | null>(null);
    const isBackdated = joinDate < today;
    // Cover from the day after "paid till", else from the joining date.
    const coverFrom = isBackdated && paidBefore && paidUntil ? addDays(paidUntil, 1) : joinDate;

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

    const hasCommonSeatOption = useMemo(
        () => selectedBatchIds.length > 0 && seatsData.some((seat) => isSeatFree(seat, selectedBatchIds)),
        [selectedBatchIds, seatsData]
    );

    /** The lowest free seat in each batch, keeping `prefer` wherever it's free. */
    const suggestPerBatch = (batchIds: number[], prefer: number | null) => {
        const next: Record<number, number> = {};
        for (const bId of batchIds) {
            const preferred = prefer != null ? seatsData.find((seat) => seat.seat_id === prefer && isSeatFree(seat, [bId])) : undefined;
            const seat = preferred ?? firstFreeSeat(seatsData, [bId]);
            if (seat) next[bId] = seat.seat_id;
        }
        return next;
    };

    // Most admissions take the next free seat, so pick one straight away; "Change" is for the rest.
    const suggestSeats = (batchIds: number[]) => {
        const common = batchIds.length > 0 ? firstFreeSeat(seatsData, batchIds) : null;
        if (common || batchIds.length === 0) {
            setAssignMode("common");
            setCommonSeatId(common?.seat_id ?? null);
            setSeatsByBatch({});
        } else {
            setAssignMode("perBatch");
            setCommonSeatId(null);
            setSeatsByBatch(suggestPerBatch(batchIds, null));
        }
    };

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
        suggestSeats(nextSelected);
    };

    const handleSeatSelect = (seatId: number) => {
        setSubmitError(null);
        setCommonSeatId(seatId);
    };

    const handlePerBatchSeatSelect = (batchId: number, seatId: number) => {
        setSubmitError(null);
        setSeatsByBatch((prev) => ({ ...prev, [batchId]: seatId }));
    };

    const seatNumberOf = (seatId: number | null) => seatsData.find((seat) => seat.seat_id === seatId)?.seat_number;

    /** The chosen seat as a card with "Change"; opens the picker for `target`. */
    const renderSeatField = (target: "common" | number, seatId: number | null, freeNote: string) => {
        const number = seatNumberOf(seatId);
        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={number != null ? `Seat ${number}, ${freeNote}. Change seat` : "No free seat. View seats"}
                style={styles.seatField}
                onPress={() => setPickerFor(target)}>
                {/* Ticket-style badge: the seat number is the thing to read at a glance. */}
                <View style={[styles.seatBadge, number == null && styles.seatBadgeEmpty]}>
                    <Text style={[styles.seatBadgeLabel, number == null && styles.seatBadgeTextEmpty]}>SEAT</Text>
                    <Text style={[styles.seatBadgeNumber, number == null && styles.seatBadgeTextEmpty]} numberOfLines={1} adjustsFontSizeToFit>
                        {number ?? "–"}
                    </Text>
                </View>
                <View style={styles.seatFieldText}>
                    <View style={styles.seatFieldStatusRow}>
                        <MaterialCommunityIcons name="chair-school" size={16} color={number != null ? theme.success : theme.destructive} />
                        <Text style={[styles.seatFieldStatus, number == null && { color: theme.destructive }]}>{number != null ? "Available" : "No free seat"}</Text>
                    </View>
                    <Text style={styles.seatFieldNote}>{number != null ? freeNote : "Every seat is taken in this time"}</Text>
                </View>
                <View style={styles.seatFieldChangeBtn}>
                    <Text style={styles.seatFieldChange}>{number != null ? "Change" : "View"}</Text>
                </View>
            </Pressable>
        );
    };

    const pickerBatchKey = pickerFor === "common" ? selectedBatchIds.join(",") : pickerFor != null ? String(pickerFor) : "";
    const isFreeForPicker = useCallback(
        (seat: (typeof seatsData)[number]) => isSeatFree(seat, pickerBatchKey ? pickerBatchKey.split(",").map(Number) : []),
        [pickerBatchKey]
    );
    // One shared seat across several batches reads "all batches"; otherwise name the single batch.
    const pickerBatchId = pickerFor === "common" ? (selectedBatchIds.length === 1 ? selectedBatchIds[0] : null) : pickerFor;
    const pickerTitle = pickerBatchId != null ? `Seat for ${batches.find((b) => b.id === pickerBatchId)?.name ?? "batch"}` : "Seat for all batches";

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
        if (previousDues > 0 && collectPreviousDues) {
            if (previousDuesValue <= 0) {
                setSubmitError('Enter the previous dues collected, or choose "Waive".');
                return;
            }
            if (previousDuesValue > previousDues) {
                setSubmitError(`Previous dues collected can't be more than ${formatRupee(previousDues)}.`);
                return;
            }
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

        if (isBackdated && paidBefore && !paidUntil) {
            setSubmitError("Pick the date they've already paid till, or choose \"Nothing paid yet\".");
            return;
        }

        try {
            setIsSubmitting(true);
            const { memberId } = await createAdmissionApi({
                join_date: joinDate,
                ...(isBackdated && paidBefore && paidUntil ? { paid_until: paidUntil } : {}),
                name: name.trim(),
                phone: phone.trim(),
                gender: gender ?? undefined,
                ...(address.trim() ? { address: address.trim() } : {}),
                allocations: allocationPayload,
                payment: payNow ? { amount: paidAmountValue, payment_mode: paymentMode } : undefined,
                ...(previousDues > 0 ? { previous_dues_paid: previousDuesValue, previous_dues_mode: previousDuesMode } : {}),
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

            const settlementNote =
                previousDues > 0
                    ? previousDuesValue > 0
                        ? ` Previous dues: ${formatRupee(previousDuesValue)} collected${previousDuesValue < previousDues ? `, ${formatRupee(previousDues - previousDuesValue)} waived` : ""}.`
                        : ` Previous dues of ${formatRupee(previousDues)} waived.`
                    : "";
            Alert.alert(
                isReadmission ? "Readmission confirmed" : "Admission confirmed",
                (payNow
                    ? `${formatRupee(paidAmountValue)} received via ${PAYMENT_MODE_LABELS[paymentMode]}.${isPartialPayment ? ` ${formatRupee(totalMonthlyFee - paidAmountValue)} is still due.` : ""}`
                    : "No payment recorded - the member will show as due.") + settlementNote
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
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader
                    title={isReadmission ? "Readmission" : "New Admission"}
                    subtitle={isReadmission ? `Welcome back ${readmit.name ?? ""} - pick a new seat` : "Onboard member and allocate seat"}
                />

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
                                {/* Order follows a visit: when they start, which batch, which seat, payment - then who they are. */}
                                {/* JOINING DATE - first, today by default; earlier dates enter existing members */}
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Joining Date</Text>
                                    <DateField
                                        value={joinDate}
                                        onChange={(date) => {
                                            setJoinDate(date);
                                            if (paidUntil && paidUntil < date) setPaidUntil(null);
                                            setSubmitError(null);
                                        }}
                                        minDate={addMonths(today, -60)}
                                        maxDate={addDays(today, 31)}
                                        sheetTitle="Joining date"
                                        bare
                                        note={joinDate < today ? "Already a member before today" : joinDate > today ? "Seat starts on this day" : undefined}
                                    />

                                    {isBackdated && (
                                        <View style={styles.paidBeforeBlock}>
                                            <Text style={styles.inputLabel}>Paid Before Today</Text>
                                            <View style={styles.modeToggleRow}>
                                                <Pressable
                                                    style={[styles.modeToggleChip, !paidBefore && styles.modeToggleChipActive]}
                                                    onPress={() => {
                                                        setPaidBefore(false);
                                                        setSubmitError(null);
                                                    }}>
                                                    <Text style={[styles.modeToggleText, !paidBefore && styles.modeToggleTextActive]}>Nothing paid yet</Text>
                                                </Pressable>
                                                <Pressable
                                                    style={[styles.modeToggleChip, paidBefore && styles.modeToggleChipActive]}
                                                    onPress={() => {
                                                        setPaidBefore(true);
                                                        setSubmitError(null);
                                                    }}>
                                                    <Text style={[styles.modeToggleText, paidBefore && styles.modeToggleTextActive]}>Paid till a date</Text>
                                                </Pressable>
                                            </View>
                                            {paidBefore ? (
                                                <>
                                                    <DateField
                                                        value={paidUntil}
                                                        onChange={(date) => {
                                                            setPaidUntil(date);
                                                            setSubmitError(null);
                                                        }}
                                                        minDate={joinDate}
                                                        maxDate={addMonths(today, 12)}
                                                        sheetTitle="Paid till"
                                                        bare
                                                        note="Last day already paid for"
                                                        placeholder="Pick the last paid day"
                                                    />
                                                    <Text style={styles.paymentHint}>
                                                        {paidUntil
                                                            ? `Covered till ${formatShortDate(paidUntil, true)}. This is not counted as money received today.`
                                                            : "Pick the last day they've already paid for."}
                                                    </Text>
                                                </>
                                            ) : (
                                                <Text style={styles.paymentHint}>They'll owe from {formatShortDate(joinDate, true)}, one month's fee for each month since.</Text>
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* BATCH SELECTION */}
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>Select Batches</Text>
                                    {/* Equal-width tiles, two per row, so batch names of any length line up. */}
                                    <View style={styles.batchGrid}>
                                        {batches.map((b) => {
                                            const isSelected = selectedBatchIds.includes(b.id);
                                            return (
                                                <Pressable
                                                    key={b.id}
                                                    accessibilityRole="checkbox"
                                                    accessibilityState={{ checked: isSelected }}
                                                    accessibilityLabel={`${b.name}, ${formatTime(b.start_time)} to ${formatTime(b.end_time)}, ${formatRupee(parseFloat(b.monthly_fee) || 0)} a month`}
                                                    style={[styles.batchTile, isSelected && styles.batchTileSelected]}
                                                    onPress={() => toggleBatch(b.id)}>
                                                    <View style={styles.batchTileHeader}>
                                                        <Text style={[styles.batchTileName, isSelected && styles.batchTileTextSelected]} numberOfLines={1}>
                                                            {b.name}
                                                        </Text>
                                                        <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={18} color={isSelected ? "#fff" : theme.mutedForeground + "80"} />
                                                    </View>
                                                    <Text style={[styles.batchTileTime, isSelected && styles.batchTileSubSelected]} numberOfLines={1}>
                                                        {formatTime(b.start_time)} - {formatTime(b.end_time)}
                                                    </Text>
                                                    <Text style={[styles.batchTileFee, isSelected && styles.batchTileTextSelected]} numberOfLines={1}>
                                                        {formatRupee(parseFloat(b.monthly_fee) || 0)}
                                                        <Text style={[styles.batchTileFeeUnit, isSelected && styles.batchTileSubSelected]}> / month</Text>
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
                                                        setCommonSeatId(firstFreeSeat(seatsData, selectedBatchIds)?.seat_id ?? null);
                                                        setSeatsByBatch({});
                                                    }}>
                                                    <Text style={[styles.modeToggleText, assignMode === "common" && styles.modeToggleTextActive]}>Same seat for all</Text>
                                                </Pressable>
                                                <Pressable
                                                    style={[styles.modeToggleChip, assignMode === "perBatch" && styles.modeToggleChipActive]}
                                                    onPress={() => {
                                                        setAssignMode("perBatch");
                                                        setSeatsByBatch(suggestPerBatch(selectedBatchIds, commonSeatId));
                                                        setCommonSeatId(null);
                                                    }}>
                                                    <Text style={[styles.modeToggleText, assignMode === "perBatch" && styles.modeToggleTextActive]}>Different seat per batch</Text>
                                                </Pressable>
                                            </View>
                                        )}

                                        {assignMode === "common" ? (
                                            hasCommonSeatOption ? (
                                                renderSeatField(
                                                    "common",
                                                    commonSeatId,
                                                    selectedBatchIds.length > 1 ? "Free in all selected batches" : "Free in this batch"
                                                )
                                            ) : (
                                                <Text style={styles.gridInstruction}>
                                                    No single seat is free in every selected batch - choose "Different seat per batch" above.
                                                </Text>
                                            )
                                        ) : (
                                            selectedBatchIds.map((bId) => {
                                                const batch = batches.find((b) => b.id === bId);
                                                return (
                                                    <View key={bId} style={styles.perBatchBlock}>
                                                        <Text style={styles.perBatchLabel}>{batch?.name ?? "Batch"}</Text>
                                                        {renderSeatField(bId, seatsByBatch[bId] ?? null, "Free in this batch")}
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                )}

                                {/* PREVIOUS DUES (READMISSION) */}
                                {previousDues > 0 && (
                                    <View style={styles.sectionBlock}>
                                        <Text style={styles.sectionTitle}>Previous Dues</Text>
                                        <Text style={styles.previousDuesSummary}>
                                            {readmit.name ?? "This member"} left with <Text style={styles.previousDuesAmount}>{formatRupee(previousDues)}</Text> pending.
                                        </Text>
                                        <View style={styles.modeToggleRow}>
                                            <Pressable
                                                style={[styles.modeToggleChip, collectPreviousDues && styles.modeToggleChipActive]}
                                                onPress={() => {
                                                    setCollectPreviousDues(true);
                                                    setSubmitError(null);
                                                }}>
                                                <Text style={[styles.modeToggleText, collectPreviousDues && styles.modeToggleTextActive]}>Collect</Text>
                                            </Pressable>
                                            <Pressable
                                                style={[styles.modeToggleChip, !collectPreviousDues && styles.modeToggleChipActive]}
                                                onPress={() => {
                                                    setCollectPreviousDues(false);
                                                    setSubmitError(null);
                                                }}>
                                                <Text style={[styles.modeToggleText, !collectPreviousDues && styles.modeToggleTextActive]}>Waive & start fresh</Text>
                                            </Pressable>
                                        </View>

                                        {collectPreviousDues ? (
                                            <>
                                                <View style={styles.inputWrap}>
                                                    <Text style={styles.inputLabel}>Amount Collected</Text>
                                                    <View style={styles.amountField}>
                                                        <Text style={styles.amountPrefix}>₹</Text>
                                                        <TextInput
                                                            style={styles.amountInput}
                                                            value={previousDuesAmount}
                                                            onChangeText={(text) => {
                                                                setPreviousDuesAmount(text.replace(/[^0-9.]/g, ""));
                                                                setSubmitError(null);
                                                            }}
                                                            keyboardType="decimal-pad"
                                                            placeholder="0"
                                                            placeholderTextColor={theme.mutedForeground + "80"}
                                                        />
                                                    </View>
                                                    {previousDuesValue > 0 && previousDuesValue < previousDues && (
                                                        <Text style={styles.paymentHint}>Settling for less - the remaining {formatRupee(previousDues - previousDuesValue)} will be waived.</Text>
                                                    )}
                                                </View>
                                                <ChoiceChips label="Payment Mode" value={previousDuesMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPreviousDuesMode(mode)} />
                                            </>
                                        ) : (
                                            <Text style={styles.paymentHint}>The {formatRupee(previousDues)} will be written off. Only the new admission is charged.</Text>
                                        )}
                                    </View>
                                )}

                                {/* FIRST PAYMENT */}
                                {selectedBatchIds.length > 0 && (
                                    <View style={styles.sectionBlock}>
                                        <Text style={styles.sectionTitle}>{isBackdated ? "Payment Today" : "First Payment"}</Text>
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
                                                    {/* Which days this pays for, from where their cover starts. */}
                                                    {paidAmountValue > 0 && totalMonthlyFee > 0 && (
                                                        <Text style={[styles.paymentHint, !isPartialPayment && styles.paymentCovers]}>
                                                            {isPartialPayment
                                                                ? `Partial payment - ${formatRupee(totalMonthlyFee - paidAmountValue)} will show as due from ${formatShortDate(coverFrom, true)}.`
                                                                : (() => {
                                                                      const months = Math.floor(paidAmountValue / totalMonthlyFee + 1e-9);
                                                                      return `Covers ${formatShortDate(coverFrom)} – ${formatShortDate(addDays(addMonths(coverFrom, months), -1), true)}${months > 1 ? ` (${months} months)` : ""}`;
                                                                  })()}
                                                        </Text>
                                                    )}
                                                </View>

                                                <ChoiceChips label="Payment Mode" value={paymentMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPaymentMode(mode)} />
                                            </>
                                        ) : (
                                            <Text style={styles.paymentHint}>No payment will be recorded. The member will show as due from {formatShortDate(coverFrom, true)}, so you can collect later from Dues & Renewals.</Text>
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
                                            placeholder="e.g. Rahul Sharma"
                                            placeholderTextColor={theme.mutedForeground + "80"}
                                            value={name}
                                            onChangeText={setName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                    <View style={styles.inputWrap}>
                                        <Text style={styles.inputLabel}>Phone Number</Text>
                                        <TextInput
                                            style={[styles.inputField, isReadmission && styles.inputFieldLocked]}
                                            placeholder="10-digit mobile number"
                                            placeholderTextColor={theme.mutedForeground + "80"}
                                            value={phone}
                                            onChangeText={setPhone}
                                            keyboardType="phone-pad"
                                            maxLength={15}
                                            // The phone number is how a returning member is recognised.
                                            editable={!isReadmission}
                                        />
                                    </View>
                                    <ChoiceChips label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} allowDeselect />
                                    <View style={styles.inputWrap}>
                                        <Text style={styles.inputLabel}>Address</Text>
                                        <TextInput
                                            style={[styles.inputField, styles.addressField]}
                                            placeholder="House no., street, area, city"
                                            placeholderTextColor={theme.mutedForeground + "80"}
                                            value={address}
                                            onChangeText={setAddress}
                                            autoCapitalize="words"
                                            multiline
                                            maxLength={500}
                                        />
                                    </View>
                                </View>

                                {/* ID PROOF (OPTIONAL) */}
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionTitle}>ID Proof</Text>
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
                                        <AddIdProofCard onAdd={() => openIdProofSheet(null)} />
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

                <SeatPickerSheet
                    visible={pickerFor != null}
                    title={pickerTitle}
                    seats={seatsData}
                    isFree={isFreeForPicker}
                    selectedSeatId={pickerFor === "common" ? commonSeatId : pickerFor != null ? seatsByBatch[pickerFor] ?? null : null}
                    onPick={(seatId) => {
                        if (pickerFor === "common") handleSeatSelect(seatId);
                        else if (pickerFor != null) handlePerBatchSeatSelect(pickerFor, seatId);
                        setPickerFor(null);
                    }}
                    onClose={() => setPickerFor(null)}
                />

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
        </ScreenBackground>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    safe: {
        flex: 1,
    },
    flex: {
        flex: 1,
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
    batchGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 10,
    },
    // Two per row; an odd last tile keeps the same width instead of stretching.
    batchTile: {
        width: "48.5%",
        padding: 12,
        backgroundColor: theme.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 4,
    },
    batchTileSelected: {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
    },
    batchTileHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    batchTileName: {
        flex: 1,
        fontFamily: "sans-bold",
        fontSize: 14,
        color: theme.primary,
    },
    batchTileTime: {
        fontFamily: "sans-medium",
        fontSize: 12,
        color: theme.mutedForeground,
    },
    batchTileFee: {
        fontFamily: "sans-extrabold",
        fontSize: 15,
        color: theme.primary,
        marginTop: 2,
    },
    batchTileFeeUnit: {
        fontFamily: "sans-medium",
        fontSize: 11,
        color: theme.mutedForeground,
    },
    batchTileTextSelected: {
        color: "#fff",
    },
    batchTileSubSelected: {
        color: "rgba(255,255,255,0.8)",
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
    seatField: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: RADIUS.md,
        padding: 14,
    },
    seatBadge: {
        width: 60,
        height: 60,
        borderRadius: RADIUS.md,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    seatBadgeEmpty: {
        backgroundColor: theme.muted,
    },
    seatBadgeLabel: {
        fontFamily: "sans-bold",
        fontSize: 9,
        letterSpacing: 1.5,
        color: "rgba(255,255,255,0.8)",
    },
    seatBadgeNumber: {
        fontFamily: "sans-extrabold",
        fontSize: 24,
        color: "#fff",
        marginTop: -2,
    },
    seatBadgeTextEmpty: {
        color: theme.mutedForeground,
    },
    seatFieldText: {
        flex: 1,
    },
    seatFieldStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    seatFieldStatus: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: theme.primary,
    },
    seatFieldChangeBtn: {
        borderWidth: 1,
        borderColor: theme.accent,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    seatFieldChange: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.accent,
    },
    seatFieldNote: {
        fontFamily: "sans-medium",
        fontSize: 12,
        color: theme.mutedForeground,
        marginTop: 2,
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
    // Room for two lines, e.g. house and street on one, area and city on the next.
    addressField: {
        minHeight: 76,
        textAlignVertical: "top",
    },
    paidBeforeBlock: {
        marginTop: 18,
        gap: 10,
    },
    paymentCovers: {
        fontFamily: "sans-bold",
        color: theme.success,
    },
    inputFieldLocked: {
        opacity: 0.6,
    },
    previousDuesSummary: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: theme.mutedForeground,
        lineHeight: 20,
        marginBottom: 14,
    },
    previousDuesAmount: {
        fontFamily: "sans-extrabold",
        color: theme.destructive,
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
        ...BUTTON_TEXT,
        color: "#fff",
    },
});
