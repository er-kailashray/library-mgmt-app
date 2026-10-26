import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ScrollViewInstance, type TextInputInstance } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { createAdmissionApi } from "@/features/admission/logic/admission-api";
import { firstFreeSeat, isSeatFree } from "@/features/admission/logic/seat-picking";
import { ID_PROOF_TYPE_LABELS } from "@/features/admission/types/admission.types";
import { AdmissionSuccess, type AdmissionResult } from "@/features/admission/ui/AdmissionSuccess";
import { AddIdProofCard, IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
import { SeatPickerSheet } from "@/features/admission/ui/SeatPickerSheet";
import { formatTimeRange } from "@/features/batches/logic/batch-time";
import { getMembersApi, uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { GENDER_OPTIONS, Gender } from "@/features/members/types/members.types";
import { PAYMENT_MODE_LABELS, PaymentMode } from "@/features/payments/types/payments.types";
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useApiData } from "@/shared/hooks/useApiData";
import { useKeyboardReveal } from "@/shared/hooks/useKeyboardReveal";
import { useKeyboardVisible } from "@/shared/hooks/useKeyboardVisible";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { DateField } from "@/shared/ui/DateField";
import { PhotoPickerTile } from "@/shared/ui/PhotoPickerTile";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Text, TextInput } from "@/shared/ui/Text";
import { showToast } from "@/shared/ui/Toast";
import { formatRupee } from "@/shared/utils/currency";
import { addDays, addMonths, formatShortDate, todayIso } from "@/shared/utils/dates";
import { haptics } from "@/shared/utils/haptics";
import { PHONE_INPUT_MAX_LENGTH, phoneDigits } from "@/shared/utils/text";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";

const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));

/** "Pay for N months" shortcuts under the amount. */
const QUICK_MONTHS = [1, 2, 3];

/** The form's sections, top to bottom; errors scroll to the first section that has one. */
type SectionKey = "start" | "batch" | "seat" | "dues" | "payment" | "member";
const SECTION_ORDER: SectionKey[] = ["start", "batch", "seat", "dues", "payment", "member"];
type FieldKey = "paidUntil" | "batch" | "seat" | "dues" | "payment" | "name" | "phone";
const FIELD_SECTION: Record<FieldKey, SectionKey> = {
	paidUntil: "start",
	batch: "batch",
	seat: "seat",
	dues: "dues",
	payment: "payment",
	name: "member",
	phone: "member",
};
type FieldErrors = Partial<Record<FieldKey, string>>;

type ReadmitParams = { name?: string; phone?: string; gender?: Gender; address?: string; outstanding?: string };
type PresetParams = { batch_id?: string; seat_id?: string };

/** Last 10 digits, so a stored "+91 98765 43210" and "9876543210" compare equal. */
const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/**
 * NOT IN USE - a redesigned admission form kept for later comparison; the app uses AdmissionScreen.
 * To try it, render <AdmissionScreenV2 /> from app/(app)/admission.tsx instead.
 *
 * New admission (or readmission of a member who left), then a success screen with the seat ticket
 * and the usual next steps. "Admit another" starts a fresh form.
 */
export function AdmissionScreenV2() {
	const router = useRouter();
	const params = useLocalSearchParams<ReadmitParams & PresetParams>();
	const { theme } = useTheme();
	const styles = createStyles(theme);

	const [result, setResult] = useState<AdmissionResult | null>(null);
	// Bumped by "Admit another" to remount a blank form.
	const [round, setRound] = useState(0);

	const openWelcome = useCallback(async (admitted: AdmissionResult) => {
		const seats = admitted.seats.map((s) => `Seat ${s.seatNumber} · ${s.batchName} (${s.time})`).join("\n");
		const payment = admitted.payment
			? `Paid ${formatRupee(admitted.payment.amount)} by ${admitted.payment.modeLabel} · ${admitted.payment.covers}`
			: `Monthly fee ${formatRupee(admitted.monthlyFee)}, due from ${formatShortDate(admitted.dueFrom, true)}`;
		const message = `Hi ${admitted.name.split(" ")[0]}! ${admitted.isReadmission ? "Welcome back -" : "Welcome -"} your ${
			admitted.isReadmission ? "readmission" : "admission"
		} is confirmed.\n\n${seats}\nStarts ${formatShortDate(admitted.startDate, true)}\n${payment}\n\nSee you at the library!`;
		try {
			await openWhatsAppMessage(admitted.phone, message);
		} catch {
			showToast({ message: "Couldn't open WhatsApp", detail: "Make sure WhatsApp is installed on this phone.", tone: "error" });
		}
	}, []);

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				{result ? (
					<>
						<ScreenHeader title={result.isReadmission ? "Readmission" : "New admission"} subtitle="Saved" />
						<AdmissionSuccess
							result={result}
							onWhatsApp={() => void openWelcome(result)}
							onViewMember={() => router.replace({ pathname: "/members/[id]", params: { id: String(result.memberId) } })}
							onAdmitAnother={() => {
								// A blank form: forget the readmission and seat this screen was opened with.
								router.setParams({ name: undefined, phone: undefined, gender: undefined, address: undefined, outstanding: undefined, batch_id: undefined, seat_id: undefined });
								setResult(null);
								setRound((r) => r + 1);
							}}
							onDone={() => router.back()}
						/>
					</>
				) : (
					<AdmissionForm
						// A different readmission (e.g. "Readmit" from the duplicate-phone notice) is a new form too.
						key={`${round}-${params.phone ?? ""}`}
						readmit={params}
						preset={params}
						onAdmitted={setResult}
					/>
				)}
			</SafeAreaView>
		</ScreenBackground>
	);
}

/**
 * The form follows a visit: when they start, which batch (with its fee), which seat, the payment,
 * then who they are. Each part is a plain heading over a light card; defaults (today, next free
 * seat, one month in cash) mean most admissions are a batch tap, name, number and Admit.
 */
function AdmissionForm({ readmit, preset, onAdmitted }: { readmit: ReadmitParams; preset: PresetParams; onAdmitted: (result: AdmissionResult) => void }) {
	const router = useRouter();
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const insets = useSafeAreaInsets();
	const isKeyboardVisible = useKeyboardVisible();

	const isReadmission = !!readmit.phone;
	const previousDues = parseFloat(readmit.outstanding ?? "0") || 0;

	const { data, isLoading, error, refetch: fetchData } = useApiData(getSeatMatrixApi, []);
	const batches = data?.batches ?? [];
	// Seat-number order, so "first free seat" and the picker's blocks run 1, 2, 3...
	const seatsData = useMemo(() => [...(data?.seats ?? [])].sort((a, b) => Number(a.seat_number) - Number(b.seat_number)), [data?.seats]);
	// Everyone admitted so far, to spot a phone number that's already a member.
	const { data: members } = useApiData(getMembersApi, []);

	useFocusEffect(
		useCallback(() => {
			void fetchData();
		}, [fetchData])
	);

	// ---- Batches and seats -------------------------------------------------------------------
	const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
	const [assignMode, setAssignMode] = useState<"common" | "perBatch">("common");
	const [commonSeatId, setCommonSeatId] = useState<number | null>(null);
	const [seatsByBatch, setSeatsByBatch] = useState<Record<number, number>>({});
	// Which seat the picker sheet is choosing: the shared seat, one batch's seat, or closed.
	const [pickerFor, setPickerFor] = useState<"common" | number | null>(null);

	// "Admit here" on the Seats screen opens this with that batch and seat already chosen.
	const presetApplied = useRef(false);
	useEffect(() => {
		if (presetApplied.current || !preset.batch_id || batches.length === 0 || seatsData.length === 0) return;
		presetApplied.current = true;
		const batchId = Number(preset.batch_id);
		if (!batches.some((b) => b.id === batchId)) return;
		// Someone may have taken it since; then the next free seat in that batch, as usual.
		const seat = seatsData.find((s) => s.seat_id === Number(preset.seat_id) && isSeatFree(s, [batchId])) ?? firstFreeSeat(seatsData, [batchId]);
		setSelectedBatchIds([batchId]);
		setAssignMode("common");
		setCommonSeatId(seat?.seat_id ?? null);
		setSeatsByBatch({});
	}, [preset.batch_id, preset.seat_id, batches, seatsData]);

	// ---- Member ------------------------------------------------------------------------------
	const [name, setName] = useState(readmit.name ?? "");
	const [phone, setPhone] = useState(phoneKey(readmit.phone ?? ""));
	const [gender, setGender] = useState<Gender | null>(readmit.gender ?? null);
	const [address, setAddress] = useState(readmit.address ?? "");
	const phoneRef = useRef<TextInputInstance>(null);

	// The number belongs to someone already: a current member (can't admit twice) or one who left (readmit them).
	const existing = useMemo(() => {
		if (isReadmission || phone.length !== 10) return null;
		return (members ?? []).find((m) => phoneKey(m.phone) === phone) ?? null;
	}, [members, phone, isReadmission]);

	// ---- Previous dues (readmission) ---------------------------------------------------------
	const [collectPreviousDues, setCollectPreviousDues] = useState(true);
	const [previousDuesAmount, setPreviousDuesAmount] = useState(previousDues > 0 ? String(Math.round(previousDues)) : "");
	const [previousDuesMode, setPreviousDuesMode] = useState<PaymentMode>("cash");
	const previousDuesValue = collectPreviousDues ? parseFloat(previousDuesAmount) || 0 : 0;

	// ---- Start date --------------------------------------------------------------------------
	// Today unless entering someone who was already a member before the app.
	const today = todayIso();
	const [joinDate, setJoinDate] = useState(today);
	// Existing members only: the last day they'd already paid for (not counted as money received today).
	const [paidBefore, setPaidBefore] = useState(false);
	const [paidUntil, setPaidUntil] = useState<string | null>(null);
	const isBackdated = joinDate < today;
	// Cover from the day after "paid till", else from the joining date.
	const coverFrom = isBackdated && paidBefore && paidUntil ? addDays(paidUntil, 1) : joinDate;

	// ---- Payment -----------------------------------------------------------------------------
	const [payNow, setPayNow] = useState(true);
	const [paidAmount, setPaidAmount] = useState("");
	// Once the owner types an amount, stop overwriting it when batches change.
	const [paidAmountEdited, setPaidAmountEdited] = useState(false);
	const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");

	// ---- ID proof: held locally and uploaded after the admission is created ------------------
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
		if (idProof.backUri) openIdProofSheet({ type: idProof.type, backUri: idProof.backUri });
		else setIdProof(null);
	};

	// ---- Errors ------------------------------------------------------------------------------
	const [errors, setErrors] = useState<FieldErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const clearError = (...keys: FieldKey[]) =>
		setErrors((current) => {
			if (!keys.some((k) => current[k])) return current;
			const next = { ...current };
			keys.forEach((k) => delete next[k]);
			return next;
		});
	const sectionHasError = (section: SectionKey) => (Object.keys(errors) as FieldKey[]).some((k) => FIELD_SECTION[k] === section);

	// Where each section sits in the scroll, to bring the first problem into view.
	const scrollRef = useRef<ScrollViewInstance>(null);
	// Keeps the member field being typed in (name, mobile, address) clear of the keyboard.
	const keyboard = useKeyboardReveal(scrollRef);
	const nameRef = useRef<TextInputInstance>(null);
	const addressRef = useRef<TextInputInstance>(null);
	const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
	const trackSection = (section: SectionKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
		sectionY.current[section] = e.nativeEvent.layout.y;
	};

	// ---- Derived -----------------------------------------------------------------------------
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

	const changeAssignMode = (mode: "common" | "perBatch") => {
		clearError("seat");
		if (mode === "common") {
			setAssignMode("common");
			setCommonSeatId(firstFreeSeat(seatsData, selectedBatchIds)?.seat_id ?? null);
			setSeatsByBatch({});
		} else {
			setAssignMode("perBatch");
			setSeatsByBatch(suggestPerBatch(selectedBatchIds, commonSeatId));
			setCommonSeatId(null);
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
	const monthsCovered = totalMonthlyFee > 0 ? Math.floor(paidAmountValue / totalMonthlyFee + 1e-9) : 0;
	const coversText =
		monthsCovered >= 1
			? `Covers ${formatShortDate(coverFrom)} – ${formatShortDate(addDays(addMonths(coverFrom, monthsCovered), -1), true)}${monthsCovered > 1 ? ` (${monthsCovered} months)` : ""}`
			: "";

	const toggleBatch = (batchId: number) => {
		haptics.selection();
		clearError("batch", "seat", "payment");
		const nextSelected = selectedBatchIds.includes(batchId) ? selectedBatchIds.filter((id) => id !== batchId) : [...selectedBatchIds, batchId];
		setSelectedBatchIds(nextSelected);
		suggestSeats(nextSelected);
	};

	const seatNumberOf = (seatId: number | null) => seatsData.find((seat) => seat.seat_id === seatId)?.seat_number ?? null;
	// The seat chosen for each selected batch (same seat for all, or one each).
	const seatFor = (batchId: number) => (assignMode === "common" ? commonSeatId : seatsByBatch[batchId] ?? null);
	const allSeatsChosen = selectedBatchIds.length > 0 && selectedBatchIds.every((bId) => seatFor(bId) != null);

	const pickerBatchKey = pickerFor === "common" ? selectedBatchIds.join(",") : pickerFor != null ? String(pickerFor) : "";
	const isFreeForPicker = useCallback(
		(seat: (typeof seatsData)[number]) => isSeatFree(seat, pickerBatchKey ? pickerBatchKey.split(",").map(Number) : []),
		[pickerBatchKey]
	);
	// One shared seat across several batches reads "all batches"; otherwise name the single batch.
	const pickerBatchId = pickerFor === "common" ? (selectedBatchIds.length === 1 ? selectedBatchIds[0] : null) : pickerFor;
	const pickerTitle = pickerBatchId != null ? `Seat for ${batches.find((b) => b.id === pickerBatchId)?.name ?? "batch"}` : "Seat for all batches";

	// ---- Validation and submit ---------------------------------------------------------------
	const validate = (): FieldErrors => {
		const next: FieldErrors = {};
		if (isBackdated && paidBefore && !paidUntil) next.paidUntil = "Pick the last day they've paid for, or choose Nothing paid";
		if (selectedBatchIds.length === 0) next.batch = "Pick at least one batch";
		else if (!allSeatsChosen) next.seat = assignMode === "common" ? "Pick a seat" : "Pick a seat in every batch";
		if (previousDues > 0 && collectPreviousDues) {
			if (previousDuesValue <= 0) next.dues = "Enter what they paid towards old dues, or choose Waive";
			else if (previousDuesValue > previousDues) next.dues = `Can't be more than ${formatRupee(previousDues)}`;
		}
		if (payNow && selectedBatchIds.length > 0 && paidAmountValue <= 0) next.payment = "Enter the amount received, or choose Pay later";
		if (!name.trim()) next.name = "Enter their full name";
		if (phone.length !== 10) next.phone = "Enter a 10-digit mobile number";
		else if (existing?.status === "active") next.phone = `${existing.name} already has this number`;
		return next;
	};

	const handleSubmit = async () => {
		const found = validate();
		setErrors(found);
		const first = SECTION_ORDER.find((section) => (Object.keys(found) as FieldKey[]).some((k) => FIELD_SECTION[k] === section));
		if (first) {
			haptics.error();
			const y = sectionY.current[first];
			if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
			return;
		}

		try {
			setIsSubmitting(true);
			const allocations = selectedBatchIds.map((bId) => ({ batch_id: bId, seat_id: seatFor(bId)! }));
			const { memberId } = await createAdmissionApi({
				join_date: joinDate,
				...(isBackdated && paidBefore && paidUntil ? { paid_until: paidUntil } : {}),
				name: name.trim(),
				phone,
				gender: gender ?? undefined,
				...(address.trim() ? { address: address.trim() } : {}),
				allocations,
				payment: payNow ? { amount: paidAmountValue, payment_mode: paymentMode } : undefined,
				...(previousDues > 0 ? { previous_dues_paid: previousDuesValue, previous_dues_mode: previousDuesMode } : {}),
			});

			let idProofFailed = false;
			if (idProof) {
				try {
					await uploadMemberIdProofApi(memberId, idProof.type, "front", idProof.frontUri);
					if (idProof.backUri) await uploadMemberIdProofApi(memberId, idProof.type, "back", idProof.backUri);
				} catch {
					idProofFailed = true;
				}
			}

			onAdmitted({
				memberId,
				name: name.trim(),
				phone,
				isReadmission,
				seats: selectedBatchIds.map((bId) => {
					const batch = batches.find((b) => b.id === bId);
					return {
						batchName: batch?.name ?? "Batch",
						time: batch ? formatTimeRange(batch.start_time, batch.end_time) : "",
						seatNumber: String(seatNumberOf(seatFor(bId)) ?? "—"),
					};
				}),
				startDate: joinDate,
				monthlyFee: totalMonthlyFee,
				payment: payNow
					? {
							amount: paidAmountValue,
							modeLabel: PAYMENT_MODE_LABELS[paymentMode],
							covers: coversText || "Partial payment",
							stillDue: isPartialPayment ? totalMonthlyFee - paidAmountValue : 0,
						}
					: null,
				dueFrom: coverFrom,
				settlementNote:
					previousDues > 0
						? previousDuesValue > 0
							? `Old dues: ${formatRupee(previousDuesValue)} collected${previousDuesValue < previousDues ? `, ${formatRupee(previousDues - previousDuesValue)} waived` : ""}`
							: `Old dues of ${formatRupee(previousDues)} waived`
						: undefined,
				idProofFailed,
			});
		} catch (err: any) {
			showToast({ message: "Couldn't save the admission", detail: err.message || "Please try again.", tone: "error", durationMs: 5000 });
		} finally {
			setIsSubmitting(false);
		}
	};

	// ---- Render ------------------------------------------------------------------------------
	/** The chosen seat with "Change"; opens the picker for `target`. */
	const renderSeatField = (target: "common" | number, seatId: number | null, caption: string) => {
		const number = seatNumberOf(seatId);
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={number != null ? `Seat ${number}, ${caption}. Change seat` : "No free seat. View seats"}
				style={({ pressed }) => [styles.seatField, pressed && styles.pressed]}
				onPress={() => setPickerFor(target)}>
				<View style={[styles.seatBadge, number == null && styles.seatBadgeEmpty]}>
					<Text style={[styles.seatBadgeNumber, number == null && styles.seatBadgeTextEmpty]} numberOfLines={1} adjustsFontSizeToFit>
						{number ?? "–"}
					</Text>
				</View>
				<View style={styles.flex}>
					<Text style={[styles.seatTitle, number == null && { color: theme.destructive }]}>{number != null ? `Seat ${number}` : "No free seat"}</Text>
					<Text style={styles.seatCaption}>{number != null ? caption : "Every seat is taken in this time"}</Text>
				</View>
				<Text style={styles.link}>{number != null ? "Change" : "View"}</Text>
			</Pressable>
		);
	};

	const collectingNow = (payNow ? paidAmountValue : 0) + previousDuesValue;
	const title = isReadmission ? "Readmission" : "New admission";

	if (isLoading && !data) return <FormShell title={title} body={<LoadingState />} />;
	if (error && !data) return <FormShell title={title} body={<ErrorState message={error} onRetry={fetchData} />} />;
	if (batches.length === 0) {
		return (
			<FormShell
				title={title}
				body={
					<EmptyState
						icon="calendar-outline"
						title="No batches set up yet"
						subtitle="You need at least one batch before you can admit a student — batches are what a seat gets booked against."
						actionLabel="Set up a batch"
						onAction={() => router.push("/batches")}
					/>
				}
			/>
		);
	}

	return (
		<>
			<ScreenHeader title={title} subtitle={isReadmission ? `Welcome back ${readmit.name?.split(" ")[0] ?? ""} - pick a new seat` : "Add a member and give them a seat"} />

			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<ScrollView
					ref={scrollRef}
					style={styles.flex}
					contentContainerStyle={[styles.scroll, keyboard.bottomInset > 0 && { paddingBottom: 24 + keyboard.bottomInset }]}
					onScroll={keyboard.onScroll}
					scrollEventThrottle={32}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag">
					{/* Order follows a visit: when they start, which batch, which seat, payment - then who they are. */}
					<Section title="Start date" onLayout={trackSection("start")} hasError={sectionHasError("start")}>
						<DateField
							value={joinDate}
							onChange={(date) => {
								setJoinDate(date);
								if (paidUntil && paidUntil < date) setPaidUntil(null);
								clearError("paidUntil");
							}}
							minDate={addMonths(today, -60)}
							maxDate={addDays(today, 31)}
							sheetTitle="Start date"
							bare
							note={joinDate < today ? "Already a member before today" : joinDate > today ? "Seat starts on this day" : "Seat starts today"}
						/>
						{isBackdated && (
							<>
								<View style={styles.divider} />
								<Text style={styles.label}>Already paid before today?</Text>
								<SegmentedControl
									segments={[
										{ key: "no", label: "Nothing paid" },
										{ key: "yes", label: "Paid till a date" },
									]}
									value={paidBefore ? "yes" : "no"}
									onChange={(key) => {
										setPaidBefore(key === "yes");
										clearError("paidUntil");
									}}
								/>
								{paidBefore ? (
									<DateField
										value={paidUntil}
										onChange={(date) => {
											setPaidUntil(date);
											clearError("paidUntil");
										}}
										minDate={joinDate}
										maxDate={addMonths(today, 12)}
										sheetTitle="Paid till"
										bare
										note="Last day already paid for"
										placeholder="Pick the last paid day"
									/>
								) : (
									<Text style={styles.hint}>They'll owe from {formatShortDate(joinDate, true)}, one month's fee for each month since.</Text>
								)}
								<FieldError message={errors.paidUntil} />
							</>
						)}
					</Section>

					<Section
						title="Batch"
						note={totalMonthlyFee > 0 ? `${formatRupee(totalMonthlyFee)} / month` : "Pick one or more"}
						onLayout={trackSection("batch")}
						hasError={sectionHasError("batch")}
						plain>
						{/* Equal-width tiles, two per row, so batch names of any length line up. */}
						<View style={styles.batchGrid}>
							{batches.map((b) => {
								const selected = selectedBatchIds.includes(b.id);
								const fee = parseFloat(b.monthly_fee) || 0;
								return (
									<Pressable
										key={b.id}
										accessibilityRole="checkbox"
										accessibilityState={{ checked: selected }}
										accessibilityLabel={`${b.name}, ${formatTimeRange(b.start_time, b.end_time)}, ${formatRupee(fee)} a month`}
										style={({ pressed }) => [styles.batchTile, selected && styles.batchTileSelected, pressed && styles.pressed]}
										onPress={() => toggleBatch(b.id)}>
										<View style={styles.batchTileHeader}>
											<Text style={[styles.batchName, selected && styles.accentText]} numberOfLines={1}>
												{b.name}
											</Text>
											<Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? theme.accent : theme.mutedForeground + "66"} />
										</View>
										<Text style={styles.batchTime} numberOfLines={1}>
											{formatTimeRange(b.start_time, b.end_time)}
										</Text>
										<Text style={styles.batchFee} numberOfLines={1}>
											{formatRupee(fee)}
											<Text style={styles.batchFeeUnit}> / month</Text>
										</Text>
									</Pressable>
								);
							})}
						</View>
						<FieldError message={errors.batch} />
					</Section>

					<Section title="Seat" onLayout={trackSection("seat")} hasError={sectionHasError("seat")}>
						{selectedBatchIds.length === 0 ? (
							<Text style={styles.hint}>Pick a batch first - the next free seat is chosen for you.</Text>
						) : (
							<>
								{selectedBatchIds.length > 1 && (
									<SegmentedControl
										segments={[
											{ key: "common", label: "Same seat" },
											{ key: "perBatch", label: "Seat per batch" },
										]}
										value={assignMode}
										onChange={changeAssignMode}
									/>
								)}
								{assignMode === "common" ? (
									hasCommonSeatOption ? (
										renderSeatField("common", commonSeatId, selectedBatchIds.length > 1 ? "Free in all selected batches" : "Free in this batch")
									) : (
										<Text style={styles.hint}>No single seat is free in every selected batch - choose "Seat per batch".</Text>
									)
								) : (
									selectedBatchIds.map((bId) => (
										<View key={bId} style={styles.stack}>
											<Text style={styles.label}>{batches.find((b) => b.id === bId)?.name ?? "Batch"}</Text>
											{renderSeatField(bId, seatsByBatch[bId] ?? null, "Free in this batch")}
										</View>
									))
								)}
							</>
						)}
						<FieldError message={errors.seat} />
					</Section>

					{previousDues > 0 && (
						<Section title="Old dues" note={formatRupee(previousDues)} onLayout={trackSection("dues")} hasError={sectionHasError("dues")}>
							<Text style={styles.hint}>
								{readmit.name?.split(" ")[0] ?? "They"} left with <Text style={styles.strongDanger}>{formatRupee(previousDues)}</Text> unpaid.
							</Text>
							<SegmentedControl
								segments={[
									{ key: "collect", label: "Collect" },
									{ key: "waive", label: "Waive & start fresh" },
								]}
								value={collectPreviousDues ? "collect" : "waive"}
								onChange={(key) => {
									setCollectPreviousDues(key === "collect");
									clearError("dues");
								}}
							/>
							{collectPreviousDues ? (
								<>
									<AmountInput
										value={previousDuesAmount}
										onChange={(text) => {
											setPreviousDuesAmount(text);
											clearError("dues");
										}}
									/>
									{previousDuesValue > 0 && previousDuesValue < previousDues && (
										<Text style={styles.hint}>Settling for less - the other {formatRupee(previousDues - previousDuesValue)} will be waived.</Text>
									)}
									<ChoiceChips bare label="Paid by" value={previousDuesMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPreviousDuesMode(mode)} />
								</>
							) : (
								<Text style={styles.hint}>The {formatRupee(previousDues)} will be written off. Only the new admission is charged.</Text>
							)}
							<FieldError message={errors.dues} />
						</Section>
					)}

					<Section title={isBackdated ? "Payment today" : "Payment"} onLayout={trackSection("payment")} hasError={sectionHasError("payment")}>
						<SegmentedControl
							segments={[
								{ key: "now", label: "Paid now" },
								{ key: "later", label: "Pay later" },
							]}
							value={payNow ? "now" : "later"}
							onChange={(key) => {
								setPayNow(key === "now");
								clearError("payment");
							}}
						/>
						{payNow ? (
							<>
								<AmountInput
									value={paidAmount}
									onChange={(text) => {
										setPaidAmount(text);
										setPaidAmountEdited(true);
										clearError("payment");
									}}
								/>
								{/* One tap for the usual amounts: 1, 2 or 3 months of the chosen batches. */}
								{totalMonthlyFee > 0 && (
									<View style={styles.quickRow}>
										{QUICK_MONTHS.map((months) => {
											const amount = totalMonthlyFee * months;
											const selected = paidAmountValue === amount;
											return (
												<Pressable
													key={months}
													accessibilityRole="button"
													accessibilityState={{ selected }}
													style={({ pressed }) => [styles.quickChip, selected && styles.quickChipSelected, pressed && styles.pressed]}
													onPress={() => {
														haptics.selection();
														setPaidAmount(String(amount));
														setPaidAmountEdited(true);
														clearError("payment");
													}}>
													<Text style={[styles.quickLabel, selected && styles.accentText]}>
														{months} month{months === 1 ? "" : "s"}
													</Text>
													<Text style={[styles.quickAmount, selected && styles.accentText]}>{formatRupee(amount)}</Text>
												</Pressable>
											);
										})}
									</View>
								)}
								{paidAmountValue > 0 && totalMonthlyFee > 0 && (
									<Text style={[styles.coverNote, { color: isPartialPayment ? theme.accent : theme.success }]}>
										{isPartialPayment ? `Partial - ${formatRupee(totalMonthlyFee - paidAmountValue)} will show as due from ${formatShortDate(coverFrom, true)}` : coversText}
									</Text>
								)}
								<ChoiceChips bare label="Paid by" value={paymentMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPaymentMode(mode)} />
							</>
						) : (
							<Text style={styles.hint}>Nothing is recorded now. They'll show as due from {formatShortDate(coverFrom, true)}, to collect from Payments later.</Text>
						)}
						<FieldError message={errors.payment} />
					</Section>

					<Section title="Member details" onLayout={trackSection("member")} hasError={sectionHasError("member")} flush>
						<View style={styles.inputRow}>
							<Text style={styles.inputLabel}>Name</Text>
							<TextInput
								style={styles.input}
								ref={nameRef}
								placeholder="Full name"
								placeholderTextColor={theme.mutedForeground + "99"}
								value={name}
								onChangeText={(text) => {
									setName(text);
									clearError("name");
								}}
								autoCapitalize="words"
								textContentType="name"
								autoComplete="name"
								returnKeyType="next"
								submitBehavior="submit"
								onSubmitEditing={() => phoneRef.current?.focus()}
								onFocus={() => keyboard.reveal(nameRef)}
							/>
						</View>
						<View style={[styles.inputRow, styles.rowDivider, isReadmission && styles.locked]}>
							<Text style={styles.inputLabel}>Mobile</Text>
							<Text style={styles.prefix}>+91</Text>
							<TextInput
								ref={phoneRef}
								style={styles.input}
								placeholder="10-digit number"
								placeholderTextColor={theme.mutedForeground + "99"}
								value={phone}
								onChangeText={(text) => {
									setPhone(phoneDigits(text));
									clearError("phone");
								}}
								keyboardType="phone-pad"
								textContentType="telephoneNumber"
								autoComplete="tel"
								maxLength={PHONE_INPUT_MAX_LENGTH}
								onFocus={() => keyboard.reveal(phoneRef)}
								// The phone number is how a returning member is recognised.
								editable={!isReadmission}
							/>
							{phone.length === 10 && !existing && <Ionicons name="checkmark-circle" size={18} color={theme.success} />}
						</View>
						<View style={[styles.inputRow, styles.inputRowChips, styles.rowDivider]}>
							<Text style={styles.inputLabel}>Gender</Text>
							<View style={styles.flex}>
								<ChoiceChips bare label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} allowDeselect />
							</View>
						</View>
						<View style={[styles.inputRow, styles.inputRowTop, styles.rowDivider]}>
							<Text style={[styles.inputLabel, styles.inputLabelTop]}>Address</Text>
							<TextInput
								style={[styles.input, styles.addressInput]}
								ref={addressRef}
								placeholder="House no., street, area, city"
								placeholderTextColor={theme.mutedForeground + "99"}
								value={address}
								onChangeText={setAddress}
								autoCapitalize="words"
								multiline
								maxLength={500}
								onFocus={() => keyboard.reveal(addressRef)}
							/>
						</View>
					</Section>
					<FieldError message={errors.name ?? errors.phone} />

					{/* Someone who left: readmitting them keeps their history and old dues together. */}
					{existing?.status === "inactive" && (
						<View style={styles.notice}>
							<Text style={styles.noticeText}>
								<Text style={styles.noticeStrong}>{existing.name}</Text> had this number and left{existing.left_on ? ` on ${formatShortDate(existing.left_on, true)}` : ""}.
							</Text>
							<Pressable
								accessibilityRole="button"
								style={({ pressed }) => [styles.noticeBtn, pressed && styles.pressed]}
								onPress={() => router.setParams({ name: existing.name, phone: existing.phone, outstanding: String(existing.outstanding_balance ?? 0) })}>
								<Text style={styles.noticeBtnText}>Readmit</Text>
							</Pressable>
						</View>
					)}
					{existing?.status === "active" && (
						<Pressable
							accessibilityRole="button"
							style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
							onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(existing.id) } })}>
							<Text style={styles.link}>Open {existing.name.split(" ")[0]}'s profile</Text>
							<Ionicons name="arrow-forward" size={14} color={theme.accent} />
						</Pressable>
					)}

					{idProof ? (
						<Section title="ID proof">
							<>
								<View style={styles.idHeader}>
									<Ionicons name="card-outline" size={18} color={theme.accent} />
									<Text style={styles.idTitle}>{ID_PROOF_TYPE_LABELS[idProof.type]}</Text>
									<Pressable accessibilityRole="button" hitSlop={8} onPress={() => openIdProofSheet(idProof)}>
										<Text style={styles.link}>Edit</Text>
									</Pressable>
									<Pressable accessibilityRole="button" accessibilityLabel="Remove ID proof" hitSlop={8} onPress={() => setIdProof(null)}>
										<Ionicons name="trash-outline" size={17} color={theme.destructive} />
									</Pressable>
								</View>
								<View style={styles.idThumbs}>
									<PhotoPickerTile label="Front" uri={idProof.frontUri} onAdd={() => openIdProofSheet(idProof)} onRemove={removeIdProofFront} />
									<PhotoPickerTile
										label="Back"
										hint="(optional)"
										uri={idProof.backUri}
										onAdd={() => openIdProofSheet(idProof)}
										onRemove={() => setIdProof({ ...idProof, backUri: null })}
									/>
								</View>
							</>
						</Section>
					) : (
						// One card on its own (its title already says "Add ID proof"), not a heading and a card in a card.
						<AddIdProofCard onAdd={() => openIdProofSheet(null)} />
					)}
				</ScrollView>

				{/* Sticky summary: what's being collected now, and the one button that saves it all. Hidden
				    while typing, so it doesn't sit on top of the keyboard over the field being filled. */}
				{!isKeyboardVisible && (
					<View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
						<View style={styles.flex}>
							{selectedBatchIds.length === 0 ? (
								<Text style={styles.footerMuted}>Pick a batch</Text>
							) : collectingNow > 0 ? (
								<>
									<Text style={styles.footerAmount} numberOfLines={1} adjustsFontSizeToFit>
										{formatRupee(collectingNow)}
									</Text>
									<Text style={styles.footerLabel}>collecting now</Text>
								</>
							) : (
								<>
									<Text style={styles.footerAmount} numberOfLines={1} adjustsFontSizeToFit>
										{formatRupee(totalMonthlyFee)}
										<Text style={styles.footerUnit}> / month</Text>
									</Text>
									<Text style={styles.footerLabel}>pay later</Text>
								</>
							)}
						</View>
						<Pressable
							accessibilityRole="button"
							style={({ pressed }) => [styles.confirmBtn, (pressed || isSubmitting) && styles.confirmBtnPressed]}
							onPress={handleSubmit}
							disabled={isSubmitting}>
							{isSubmitting ? (
								<ActivityIndicator color="#fff" size="small" />
							) : (
								<>
									<Text style={styles.confirmText}>{isReadmission ? "Readmit" : "Admit"}</Text>
									<Ionicons name="arrow-forward" size={18} color="#fff" />
								</>
							)}
						</Pressable>
					</View>
				)}
			</KeyboardAvoidingView>

			<SeatPickerSheet
				visible={pickerFor != null}
				title={pickerTitle}
				seats={seatsData}
				isFree={isFreeForPicker}
				selectedSeatId={pickerFor === "common" ? commonSeatId : pickerFor != null ? seatsByBatch[pickerFor] ?? null : null}
				onPick={(seatId) => {
					clearError("seat");
					if (pickerFor === "common") setCommonSeatId(seatId);
					else if (pickerFor != null) setSeatsByBatch((prev) => ({ ...prev, [pickerFor]: seatId }));
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
				}}
			/>
		</>
	);
}

/** Header plus a loading, error or empty body, before the form can show. */
function FormShell({ title, body }: { title: string; body: ReactNode }) {
	return (
		<>
			<ScreenHeader title={title} subtitle="Add a member and give them a seat" />
			{body}
		</>
	);
}

/**
 * One part of the form: a plain heading (with an optional note on the right) over a light card.
 * `plain` drops the card (for the batch tiles, which are cards themselves); `flush` drops the card's
 * padding (for full-width input rows).
 */
function Section({
	title,
	note,
	hasError = false,
	plain = false,
	flush = false,
	onLayout,
	children,
}: {
	title: string;
	note?: string;
	hasError?: boolean;
	plain?: boolean;
	flush?: boolean;
	onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
	children: ReactNode;
}) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	return (
		<View onLayout={onLayout}>
			<View style={styles.sectionHead}>
				<Text style={styles.sectionTitle}>{title}</Text>
				{note ? <Text style={styles.sectionNote}>{note}</Text> : null}
			</View>
			{plain ? (
				<View style={styles.stack}>{children}</View>
			) : (
				<View style={[styles.card, flush ? styles.cardFlush : styles.cardPadded, hasError && styles.cardError]}>{children}</View>
			)}
		</View>
	);
}

/** A small red line under a field or group. */
function FieldError({ message }: { message?: string }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	if (!message) return null;
	return (
		<View style={styles.errorRow}>
			<Ionicons name="alert-circle" size={14} color={theme.destructive} />
			<Text style={styles.errorText}>{message}</Text>
		</View>
	);
}

/** A rupee amount field: ₹ prefix, larger digits, selects all on focus so it's easy to type over. */
function AmountInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	return (
		<View style={styles.amountField}>
			<Text style={styles.amountPrefix}>₹</Text>
			<TextInput
				style={styles.amountInput}
				value={value}
				onChangeText={(text) => onChange(text.replace(/[^0-9.]/g, ""))}
				keyboardType="decimal-pad"
				placeholder="0"
				placeholderTextColor={theme.mutedForeground + "80"}
				selectTextOnFocus
			/>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		safe: {
			flex: 1,
		},
		flex: {
			flex: 1,
		},
		scroll: {
			paddingHorizontal: 16,
			paddingTop: 16,
			paddingBottom: 24,
			gap: 20,
		},
		pressed: {
			opacity: 0.75,
		},
		stack: {
			gap: 8,
		},
		// --- sections ---
		sectionHead: {
			flexDirection: "row",
			alignItems: "baseline",
			justifyContent: "space-between",
			marginBottom: 8,
			paddingHorizontal: 4,
		},
		sectionTitle: {
			fontFamily: "sans-semibold",
			fontSize: 15,
			color: theme.primary,
		},
		sectionNote: {
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		card: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
		},
		cardPadded: {
			padding: 14,
			gap: 12,
		},
		cardFlush: {
			overflow: "hidden",
		},
		cardError: {
			borderColor: theme.destructive + "80",
		},
		divider: {
			height: 1,
			backgroundColor: theme.border,
		},
		label: {
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		hint: {
			fontFamily: "sans-regular",
			fontSize: 13,
			lineHeight: 18,
			color: theme.mutedForeground,
		},
		strongDanger: {
			fontFamily: "sans-semibold",
			color: theme.destructive,
		},
		link: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.accent,
		},
		accentText: {
			color: theme.accent,
		},
		errorRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			marginTop: -4,
			paddingHorizontal: 4,
		},
		errorText: {
			flex: 1,
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.destructive,
		},
		// --- batch tiles ---
		batchGrid: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "space-between",
			rowGap: 10,
		},
		// Two per row; an odd last tile keeps the same width instead of stretching.
		batchTile: {
			width: "48.5%",
			paddingHorizontal: 12,
			paddingVertical: 11,
			backgroundColor: theme.card,
			borderRadius: RADIUS.md,
			borderWidth: 1,
			borderColor: theme.border,
			gap: 2,
		},
		batchTileSelected: {
			backgroundColor: theme.accent + "0D",
			borderColor: theme.accent,
		},
		batchTileHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		batchName: {
			flex: 1,
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		batchTime: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		batchFee: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.primary,
			marginTop: 4,
		},
		batchFeeUnit: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		// --- seat ---
		seatField: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		seatBadge: {
			width: 44,
			height: 44,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent + "14",
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 4,
		},
		seatBadgeEmpty: {
			backgroundColor: theme.muted,
		},
		seatBadgeNumber: {
			fontFamily: "sans-semibold",
			fontSize: 18,
			color: theme.accent,
		},
		seatBadgeTextEmpty: {
			color: theme.mutedForeground,
		},
		seatTitle: {
			fontFamily: "sans-medium",
			fontSize: 15,
			color: theme.primary,
		},
		seatCaption: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		// --- amounts ---
		amountField: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.background,
			borderWidth: 1,
			borderColor: theme.border,
			borderRadius: RADIUS.md,
			paddingHorizontal: 14,
		},
		amountPrefix: {
			fontFamily: "sans-regular",
			fontSize: 20,
			color: theme.mutedForeground,
			marginRight: 6,
		},
		amountInput: {
			flex: 1,
			fontFamily: "sans-semibold",
			fontSize: 20,
			color: theme.primary,
			paddingVertical: 11,
		},
		quickRow: {
			flexDirection: "row",
			gap: 8,
		},
		quickChip: {
			flex: 1,
			alignItems: "center",
			paddingVertical: 7,
			borderRadius: RADIUS.sm,
			borderWidth: 1,
			borderColor: theme.border,
		},
		quickChipSelected: {
			borderColor: theme.accent,
			backgroundColor: theme.accent + "0D",
		},
		quickLabel: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		quickAmount: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.primary,
			marginTop: 1,
		},
		coverNote: {
			fontFamily: "sans-medium",
			fontSize: 13,
		},
		// --- member rows ---
		inputRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingHorizontal: 14,
			minHeight: 52,
		},
		inputRowChips: {
			paddingVertical: 10,
		},
		inputRowTop: {
			alignItems: "flex-start",
		},
		rowDivider: {
			borderTopWidth: 1,
			borderTopColor: theme.border,
		},
		inputLabel: {
			width: 64,
			fontFamily: "sans-regular",
			fontSize: 14,
			color: theme.mutedForeground,
		},
		inputLabelTop: {
			paddingTop: 15,
		},
		prefix: {
			fontFamily: "sans-regular",
			fontSize: 15,
			color: theme.mutedForeground,
		},
		input: {
			flex: 1,
			fontFamily: "sans-regular",
			fontSize: 15,
			color: theme.primary,
			paddingVertical: 14,
		},
		// Room for two lines, e.g. house and street on one, area and city on the next.
		addressInput: {
			minHeight: 72,
			textAlignVertical: "top",
		},
		locked: {
			opacity: 0.6,
		},
		notice: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			marginTop: -8,
			padding: 12,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent + "12",
		},
		noticeText: {
			flex: 1,
			fontFamily: "sans-regular",
			fontSize: 13,
			lineHeight: 18,
			color: theme.primary,
		},
		noticeStrong: {
			fontFamily: "sans-semibold",
		},
		noticeBtn: {
			paddingHorizontal: 12,
			paddingVertical: 7,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.accent,
		},
		noticeBtnText: {
			fontFamily: "sans-semibold",
			fontSize: 13,
			color: "#fff",
		},
		inlineLink: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			alignSelf: "flex-start",
			marginTop: -8,
			paddingHorizontal: 4,
		},
		// --- ID proof ---
		idHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
		},
		idTitle: {
			flex: 1,
			fontFamily: "sans-medium",
			fontSize: 15,
			color: theme.primary,
		},
		idThumbs: {
			flexDirection: "row",
			gap: 12,
		},
		// --- sticky footer ---
		footer: {
			flexDirection: "row",
			alignItems: "center",
			gap: 14,
			paddingHorizontal: 16,
			paddingTop: 12,
			backgroundColor: theme.card,
			borderTopWidth: 1,
			borderTopColor: theme.border,
		},
		footerAmount: {
			fontFamily: "sans-semibold",
			fontSize: 20,
			color: theme.primary,
		},
		footerUnit: {
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		footerLabel: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		footerMuted: {
			fontFamily: "sans-regular",
			fontSize: 15,
			color: theme.mutedForeground,
		},
		confirmBtn: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			minWidth: 140,
			paddingVertical: 15,
			paddingHorizontal: 22,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent,
		},
		confirmBtnPressed: {
			opacity: 0.85,
		},
		confirmText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
	});
