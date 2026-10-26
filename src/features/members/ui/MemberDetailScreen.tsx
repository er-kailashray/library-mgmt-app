import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_LABELS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { AddIdProofCard, IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
import { deactivateMemberApi, deleteMemberIdProofApi, getMemberDetailApi, getMemberIdProofSource, restartMemberApi, updateMemberApi, uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { GENDER_OPTIONS, Gender } from "@/features/members/types/members.types";
import { createPaymentApi } from "@/features/payments/logic/payments-api";
import { PAYMENT_MODE_LABELS, Payment, PaymentMode, PaymentStatus } from "@/features/payments/types/payments.types";
import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { formatRupee } from "@/shared/utils/currency";
import { getInitials } from "@/shared/utils/text";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";
import { CalendarPicker } from "@/shared/ui/CalendarPicker";
import { addDays, addMonths, durationSince, toIsoDate } from "@/shared/utils/dates";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { Text, TextInput } from "@/shared/ui/Text";

const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));

/** "22 Oct", or "22 Oct 2026" with the year. Accepts "YYYY-MM-DD" or a full timestamp. */
function formatShortDate(date: string, withYear = false): string {
    return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/** How far ahead a restart date may be set (matches the backend). */
const RESTART_MAX_DAYS_AHEAD = 31;

/** How many payments show before "See all". */
const PAYMENTS_PREVIEW = 3;

type Styles = ReturnType<typeof createStyles>;

function QuickAction({ icon, label, color, onPress, busy, styles }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; busy?: boolean; styles: Styles }) {
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]} onPress={onPress} disabled={busy}>
            <View style={styles.quickActionIcon}>{busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={18} color={color} />}</View>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </Pressable>
    );
}

export function MemberDetailScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    // `collect=1` comes from Payments > Due: open the payment sheet straight away.
    const { id, collect } = useLocalSearchParams<{ id: string; collect?: string }>();

    const { data: member, isLoading, error, refetch } = useApiData(() => getMemberDetailApi(id), [id]);

    // Refresh on return, e.g. after readmitting this member from the admission screen.
    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isSendingSms, setIsSendingSms] = useState(false);
    const [loadingIdProofSide, setLoadingIdProofSide] = useState<IdProofSide | null>(null);
    const [idProofModalVisible, setIdProofModalVisible] = useState(false);
    const [idProofSource, setIdProofSource] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
    const [viewingSide, setViewingSide] = useState<IdProofSide | null>(null);

    const handleViewIdProof = useCallback(
        async (side: IdProofSide) => {
            if (!member) return;
            try {
                setLoadingIdProofSide(side);
                const source = await getMemberIdProofSource(member.id, side);
                setIdProofSource(source);
                setViewingSide(side);
                setIdProofModalVisible(true);
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to load ID proof.");
            } finally {
                setLoadingIdProofSide(null);
            }
        },
        [member]
    );

    const closeIdProofModal = useCallback(() => {
        setIdProofModalVisible(false);
        setIdProofSource(null);
        setViewingSide(null);
    }, []);

    // Adding an ID proof to a member who was admitted without one
    const [isSavingIdProof, setIsSavingIdProof] = useState(false);
    const [isIdProofSheetVisible, setIsIdProofSheetVisible] = useState(false);

    const handleSaveIdProof = useCallback(
        async ({ type, frontUri, backUri }: IdProofDraft) => {
            if (!member) return;
            try {
                setIsSavingIdProof(true);
                await uploadMemberIdProofApi(member.id, type, "front", frontUri);
                if (backUri) {
                    await uploadMemberIdProofApi(member.id, type, "back", backUri);
                } else if (member.has_id_proof_back) {
                    // Replaced with a front-only ID: don't leave the old ID's back photo attached.
                    await deleteMemberIdProofApi(member.id, "back");
                }
                setIsIdProofSheetVisible(false);
                await refetch();
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to save ID proof.");
            } finally {
                setIsSavingIdProof(false);
            }
        },
        [member, refetch]
    );

    const handleRemoveIdProof = useCallback(() => {
        if (!member) return;
        Alert.alert("Remove ID proof?", `The ID proof photos for ${member.name} will be deleted.`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                    try {
                        setIsSavingIdProof(true);
                        await deleteMemberIdProofApi(member.id);
                        await refetch();
                    } catch (err: any) {
                        Alert.alert("Error", err.message || "Failed to remove ID proof.");
                    } finally {
                        setIsSavingIdProof(false);
                    }
                },
            },
        ]);
    }, [member, refetch]);

    // Editing name/phone/gender/address
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editGender, setEditGender] = useState<Gender | null>(null);
    const [editAddress, setEditAddress] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const openEditModal = useCallback(() => {
        if (!member) return;
        setEditName(member.name);
        setEditPhone(member.phone);
        setEditGender(member.gender);
        setEditAddress(member.address ?? "");
        setIsEditModalVisible(true);
    }, [member]);

    const handleSaveEdit = useCallback(async () => {
        if (!member) return;
        if (!editName.trim()) {
            Alert.alert("Error", "Please enter a name.");
            return;
        }
        if (editPhone.trim().length < 10) {
            Alert.alert("Error", "Please enter a valid 10-digit phone number.");
            return;
        }
        if (member.status === "inactive" && editPhone.trim() !== member.phone) {
            Alert.alert("Error", "Phone number can't be changed for a member who has left.");
            return;
        }
        try {
            setIsSavingEdit(true);
            await updateMemberApi(member.id, { name: editName.trim(), phone: editPhone.trim(), gender: editGender, address: editAddress.trim() || null });
            setIsEditModalVisible(false);
            await refetch();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update member.");
        } finally {
            setIsSavingEdit(false);
        }
    }, [member, editName, editPhone, editGender, editAddress, refetch]);

    // Recording a payment / renewing
    const [isPaymentSheetVisible, setIsPaymentSheetVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    // Back after a break: restart on a chosen date instead of charging the days they were away.
    const [restartMode, setRestartMode] = useState(false);
    const [restartDate, setRestartDate] = useState<string | null>(null);
    const [isRestarting, setIsRestarting] = useState(false);

    const openPaymentSheet = useCallback(() => {
        if (!member) return;
        // Fall back to a month's fee when nothing is owed yet (e.g. renewing early).
        const suggested = member.suggested_payment || member.monthly_fee;
        setPaymentAmount(suggested > 0 ? String(Math.round(suggested)) : "");
        setPaymentMode("cash");
        setRestartMode(false);
        setRestartDate(null);
        setIsPaymentSheetVisible(true);
    }, [member]);

    const openedForCollect = useRef(false);
    useEffect(() => {
        if (collect === "1" && member && member.status === "active" && !openedForCollect.current) {
            openedForCollect.current = true;
            openPaymentSheet();
        }
    }, [collect, member, openPaymentSheet]);

    const todayIso = toIsoDate(new Date());
    const paidThrough = member?.paid_through ?? null;
    // A break they could restart after: their paid time ended before today.
    const canRestart = !!paidThrough && paidThrough < todayIso && member?.status === "active";
    const isPaidAhead = !!paidThrough && paidThrough > todayIso;
    // A restart forgives the gap, so it's one month's fee less any partial payment already made.
    const restartAmount = member ? Math.max(0, member.monthly_fee - (member.partial_credit ?? 0)) : 0;

    const paymentAmountValue = parseFloat(paymentAmount) || 0;
    // How much is still needed to clear dues (or, if nothing is overdue, to renew for a month).
    const amountToSettle = restartMode ? restartAmount : member ? member.suggested_payment || member.monthly_fee : 0;
    const remainingAfterPayment = Math.max(0, amountToSettle - paymentAmountValue);

    // The days this payment pays for, worked out the same way as the backend.
    const periodStart = restartMode ? restartDate : (paidThrough ?? todayIso);
    const monthsCovered = member && member.monthly_fee > 0 ? Math.floor((paymentAmountValue + (member.partial_credit ?? 0)) / member.monthly_fee + 1e-9) : 0;
    const periodEnd = periodStart ? addDays(addMonths(periodStart, Math.max(1, monthsCovered)), -1) : null;
    const periodText = !periodStart || !periodEnd ? "" : `${formatShortDate(periodStart, true)} – ${formatShortDate(periodEnd, true)}`;

    const switchRestartMode = (on: boolean) => {
        setRestartMode(on);
        if (!member) return;
        const suggested = on ? restartAmount : member.suggested_payment || member.monthly_fee;
        setPaymentAmount(suggested > 0 ? String(Math.round(suggested)) : "");
    };

    const handleSavePayment = useCallback(async () => {
        if (!member) return;
        if (restartMode && !restartDate) {
            Alert.alert("Pick a date", "Choose the date their membership restarts from.");
            return;
        }
        if (paymentAmountValue <= 0) {
            Alert.alert("Error", "Please enter the amount received.");
            return;
        }
        try {
            setIsSavingPayment(true);
            const { data: payment } = await createPaymentApi({
                member_id: member.id,
                amount: paymentAmountValue,
                payment_mode: paymentMode,
                ...(restartMode && restartDate ? { start_date: restartDate } : {}),
            });
            setIsPaymentSheetVisible(false);
            await refetch();
            const covers = payment.period_start && payment.period_end ? `${formatShortDate(payment.period_start, true)} – ${formatShortDate(payment.period_end, true)}` : "";
            Alert.alert(
                payment.status === PaymentStatus.PAID ? "Payment recorded" : "Partial payment recorded",
                payment.status === PaymentStatus.PAID
                    ? `${formatRupee(paymentAmountValue)} received${covers ? ` for ${covers}` : ""}.`
                    : `${formatRupee(paymentAmountValue)} received toward ${covers}. ${formatRupee(remainingAfterPayment)} more is needed to renew.`
            );
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to record payment.");
        } finally {
            setIsSavingPayment(false);
        }
    }, [member, paymentAmountValue, paymentMode, remainingAfterPayment, restartMode, restartDate, refetch]);

    // Restart now, pay later: the seat is theirs again from the chosen date and they're due from then.
    const handleRestartWithoutPayment = useCallback(async () => {
        if (!member || !restartDate) return;
        try {
            setIsRestarting(true);
            await restartMemberApi(member.id, restartDate);
            setIsPaymentSheetVisible(false);
            await refetch();
            Alert.alert("Membership restarted", `${member.name} restarts on ${formatShortDate(restartDate, true)}. ${formatRupee(restartAmount)} is due from that date.`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to restart membership.");
        } finally {
            setIsRestarting(false);
        }
    }, [member, restartDate, restartAmount, refetch]);

    const handleWhatsApp = useCallback(async () => {
        if (!member) return;
        const dueAmountText = member.due_amount ? ` of ₹${Math.round(member.due_amount)}` : "";
        // Pre-fill a fee reminder when they owe money; otherwise just open the chat.
        const message =
            member.payment_status === "Due" && member.status === "active"
                ? `Dear ${member.name}, your library fee${dueAmountText} is overdue. Please pay at the earliest.`
                : `Hi ${member.name}, `;
        try {
            await openWhatsAppMessage(member.phone, message);
        } catch {
            Alert.alert("Couldn't open WhatsApp", "Make sure WhatsApp is installed on this device.");
        }
    }, [member]);

    const handleSmsRemind = useCallback(async () => {
        if (!member) return;
        try {
            setIsSendingSms(true);
            await remindMemberApi(member.id);
            Alert.alert("Sent", `An SMS reminder was sent to ${member.name}.`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send SMS reminder.");
        } finally {
            setIsSendingSms(false);
        }
    }, [member]);

    // Leaving with paid days still to come: choose to give back nothing, the unused days' share, or all of it.
    const [isLeaveSheetVisible, setIsLeaveSheetVisible] = useState(false);
    const [refundChoice, setRefundChoice] = useState<"none" | "partial" | "full">("none");
    const [refundAmount, setRefundAmount] = useState("");
    const [refundMode, setRefundMode] = useState<PaymentMode>("cash");

    const chooseRefund = (choice: "none" | "partial" | "full") => {
        setRefundChoice(choice);
        const options = member?.refund_options;
        setRefundAmount(choice === "none" || !options ? "" : String(Math.round(choice === "full" ? options.full : options.partial)));
    };

    const confirmLeave = useCallback(async () => {
        if (!member) return;
        const amount = refundChoice === "none" ? 0 : parseFloat(refundAmount) || 0;
        if (refundChoice !== "none" && amount <= 0) {
            Alert.alert("Error", "Enter the amount you're giving back, or choose No refund.");
            return;
        }
        try {
            setIsDeactivating(true);
            await deactivateMemberApi(member.id, amount > 0 ? { refund_amount: amount, refund_mode: refundMode } : undefined);
            setIsLeaveSheetVisible(false);
            router.back();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update member.");
        } finally {
            setIsDeactivating(false);
        }
    }, [member, refundChoice, refundAmount, refundMode, router]);

    const handleMarkAsLeft = useCallback(() => {
        if (!member) return;
        if (member.refund_options) {
            chooseRefund("none");
            setRefundMode("cash");
            setIsLeaveSheetVisible(true);
            return;
        }
        Alert.alert(
            "Mark as left?",
            `${member.name} will be marked inactive and their seat${member.allocations.length > 1 ? "s" : ""} will be freed up for new admissions.` +
                (member.due_amount ? ` The ${formatRupee(member.due_amount)} they owe will be kept on record, to collect or waive if they come back.` : ""),
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mark as left",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsDeactivating(true);
                            await deactivateMemberApi(member.id);
                            router.back();
                        } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to update member.");
                        } finally {
                            setIsDeactivating(false);
                        }
                    },
                },
            ]
        );
        // chooseRefund only reads member, which is already a dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [member, router]);

    const [showAllPayments, setShowAllPayments] = useState(false);

    const isActive = member?.status === "active";
    const isDue = isActive && member?.payment_status === "Due";
    const statusColor = isActive ? theme.success : theme.mutedForeground;
    // Earliest renewal across their seats - that's when they're next due (or have been due since).
    const nextRenewal = useMemo(
        () => member?.allocations.map((a) => a.renewal_date).sort()[0] ?? null,
        [member]
    );
    const visiblePayments = member ? (showAllPayments ? member.payments : member.payments.slice(0, PAYMENTS_PREVIEW)) : [];

    const handleCall = () => {
        if (member) void Linking.openURL(`tel:${member.phone}`);
    };

    const styles = createStyles(theme);

    const handleReadmit = () => {
        if (!member) return;
        router.push({
            pathname: "/admission",
            params: {
                name: member.name,
                phone: member.phone,
                ...(member.gender ? { gender: member.gender } : {}),
                ...(member.address ? { address: member.address } : {}),
                outstanding: String(member.outstanding_balance ?? 0),
            },
        });
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                {/* No header on this page: the member's name below is the title. Just a plain back arrow. */}
                <View style={styles.topBar}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={styles.backArrow}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                </View>

                {isLoading ? (
                    <LoadingState />
                ) : error || !member ? (
                    <ErrorState message={error || "Member not found."} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        {/* IDENTITY */}
                        <View style={styles.identityRow}>
                            <View style={[styles.avatar, { backgroundColor: statusColor + "15" }]}>
                                <Text style={[styles.avatarText, { color: statusColor }]}>{getInitials(member.name)}</Text>
                            </View>
                            <View style={styles.identityText}>
                                <Text style={styles.memberName} numberOfLines={1}>
                                    {member.name}
                                </Text>
                                <View style={styles.identityMetaRow}>
                                    <Text style={styles.memberPhone}>{member.phone}</Text>
                                    <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
                                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                        <Text style={[styles.statusPillText, { color: statusColor }]}>{isActive ? "Active" : "Inactive"}</Text>
                                    </View>
                                </View>
                                {!!member.join_date && (
                                    <View style={styles.addressRow}>
                                        <Ionicons name="calendar-outline" size={13} color={theme.mutedForeground} />
                                        <Text style={styles.addressText}>
                                            Joined {formatShortDate(member.join_date, true)} · {durationSince(member.join_date)}
                                        </Text>
                                    </View>
                                )}
                                {!!member.address && (
                                    <View style={styles.addressRow}>
                                        <Ionicons name="location-outline" size={13} color={theme.mutedForeground} />
                                        <Text style={styles.addressText} numberOfLines={2}>
                                            {member.address}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Pressable accessibilityRole="button" accessibilityLabel="Edit details" style={styles.editButton} onPress={openEditModal} hitSlop={6}>
                                <Ionicons name="create-outline" size={18} color={theme.primary} />
                            </Pressable>
                        </View>

                        {/* QUICK ACTIONS */}
                        <View style={styles.quickActions}>
                            <QuickAction icon="call-outline" label="Call" onPress={handleCall} styles={styles} color={theme.primary} />
                            <QuickAction icon="logo-whatsapp" label="WhatsApp" onPress={handleWhatsApp} styles={styles} color="#25D366" />
                            {isDue && <QuickAction icon="chatbox-ellipses-outline" label="Remind" onPress={handleSmsRemind} styles={styles} color={theme.primary} busy={isSendingSms} />}
                        </View>

                        {/* SUMMARY */}
                        {isActive ? (
                            <View style={styles.card}>
                                <View style={styles.statsRow}>
                                    <View style={styles.stat}>
                                        <Text style={styles.statLabel}>{isDue ? "Due" : "Status"}</Text>
                                        <Text style={[styles.statValue, { color: isDue ? theme.destructive : theme.success }]}>
                                            {isDue && member.due_amount ? formatRupee(member.due_amount) : "Paid"}
                                        </Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.stat}>
                                        <Text style={styles.statLabel}>Fee</Text>
                                        <Text style={styles.statValue}>
                                            {formatRupee(member.monthly_fee)}
                                            <Text style={styles.statUnit}>/mo</Text>
                                        </Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.stat}>
                                        <Text style={styles.statLabel}>{isDue ? "Due since" : "Renews"}</Text>
                                        <Text style={styles.statValue}>{nextRenewal ? formatShortDate(nextRenewal) : "—"}</Text>
                                    </View>
                                </View>
                                {member.suggested_payment !== null && (
                                    <Pressable accessibilityRole="button" style={[styles.cardButton, !isDue && styles.cardButtonOutline]} onPress={openPaymentSheet}>
                                        <Ionicons name="wallet-outline" size={16} color={isDue ? "#fff" : theme.primary} />
                                        <Text style={[styles.cardButtonText, !isDue && styles.cardButtonTextOutline]}>
                                            {isDue && member.due_amount ? `Collect ${formatRupee(member.due_amount)}` : isPaidAhead ? "Renew early" : "Record payment"}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        ) : (
                            <View style={styles.card}>
                                <Text style={styles.inactiveText}>
                                    Left the library
                                    {member.outstanding_balance > 0 ? (
                                        <>
                                            {" "}
                                            with <Text style={styles.inactiveDues}>{formatRupee(member.outstanding_balance)}</Text> pending
                                        </>
                                    ) : null}
                                    . Their seat has been freed.
                                </Text>
                                <Pressable accessibilityRole="button" style={styles.cardButton} onPress={handleReadmit}>
                                    <Ionicons name="person-add-outline" size={16} color="#fff" />
                                    <Text style={styles.cardButtonText}>Readmit member</Text>
                                </Pressable>
                            </View>
                        )}

                        {/* SEATS - same ticket badge as the New Admission form */}
                        {isActive && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>{member.allocations.length > 1 ? "Seats" : "Seat"}</Text>
                                {member.allocations.length === 0 ? (
                                    <Text style={styles.emptyText}>No active seats.</Text>
                                ) : (
                                    member.allocations.map((allocation, index) => (
                                        <View key={`${allocation.batch_id}-${allocation.seat_id}`} style={[styles.seatRow, index > 0 && styles.listRowBorder]}>
                                            <View style={styles.seatBadge}>
                                                <Text style={styles.seatBadgeLabel}>SEAT</Text>
                                                <Text style={styles.seatBadgeNumber} numberOfLines={1} adjustsFontSizeToFit>
                                                    {allocation.seat_number}
                                                </Text>
                                            </View>
                                            <View style={styles.seatText}>
                                                <View style={styles.seatBatchRow}>
                                                    <MaterialCommunityIcons name="chair-school" size={15} color={theme.mutedForeground} />
                                                    <Text style={styles.listRowTitle} numberOfLines={1}>
                                                        {allocation.batch_name}
                                                    </Text>
                                                </View>
                                                <Text style={styles.listRowMeta}>Paid till {formatShortDate(allocation.renewal_date, true)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* PAYMENTS */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Payments</Text>
                                {member.payments.length > PAYMENTS_PREVIEW && (
                                    <Pressable accessibilityRole="button" onPress={() => setShowAllPayments((v) => !v)} hitSlop={8}>
                                        <Text style={styles.sectionLink}>{showAllPayments ? "Show less" : `See all (${member.payments.length})`}</Text>
                                    </Pressable>
                                )}
                            </View>
                            {member.payments.length === 0 ? (
                                <Text style={styles.emptyText}>No payments recorded yet.</Text>
                            ) : (
                                visiblePayments.map((payment: Payment, index: number) => {
                                    const isRefund = payment.status === PaymentStatus.REFUNDED;
                                    const isPaid = payment.status === PaymentStatus.PAID;
                                    const dotColor = isRefund ? theme.destructive : isPaid ? theme.success : theme.accent;
                                    return (
                                        <View key={payment.id} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                                            <View style={[styles.paymentDot, { backgroundColor: dotColor }]} />
                                            <View style={styles.paymentText}>
                                                <View style={styles.paymentTitleRow}>
                                                    <Text style={[styles.listRowTitle, isRefund && { color: theme.destructive }]}>
                                                        {isRefund ? `−${formatRupee(Math.abs(payment.amount))}` : formatRupee(payment.amount)}
                                                    </Text>
                                                    {isRefund ? <Text style={[styles.partialTag, styles.refundTag]}>Refund</Text> : !isPaid && <Text style={styles.partialTag}>Partial</Text>}
                                                </View>
                                                {payment.period_start && payment.period_end && (
                                                    <Text style={styles.paymentPeriod}>
                                                        {isRefund ? "Refund for " : "Covers "}
                                                        {formatShortDate(payment.period_start)} – {formatShortDate(payment.period_end, true)}
                                                    </Text>
                                                )}
                                            </View>
                                            <Text style={[styles.listRowTrailing, styles.listRowTrailingFlex]}>
                                                {payment.method} · {formatShortDate(payment.date, true)}
                                            </Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* PAST SEATS - every seat that ended, kept even if the batch was later deleted */}
                        {member.seat_history?.some((entry) => entry.status === "ended") && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Past Seats</Text>
                                {member.seat_history
                                    .filter((entry) => entry.status === "ended")
                                    .map((entry, index) => (
                                        <View key={`${entry.start_date}-${entry.seat_number}-${index}`} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                                            <MaterialCommunityIcons name="chair-school" size={16} color={theme.mutedForeground} />
                                            <Text style={styles.listRowTitle}>Seat {entry.seat_number ?? "?"}</Text>
                                            <Text style={styles.listRowMeta} numberOfLines={1}>
                                                {entry.batch_name ?? "Batch"}
                                            </Text>
                                            <Text style={styles.listRowTrailing}>
                                                {formatShortDate(entry.start_date)} – {entry.ended_on ? formatShortDate(entry.ended_on, true) : "?"}
                                            </Text>
                                        </View>
                                    ))}
                            </View>
                        )}

                        {/* ID PROOF */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>ID Proof</Text>
                            {member.has_id_proof_front ? (
                                <View style={styles.listRow}>
                                    <Ionicons name="card-outline" size={16} color={theme.accent} />
                                    <View style={styles.idProofText}>
                                        <Text style={styles.listRowTitle}>{member.id_proof_type ? ID_PROOF_TYPE_LABELS[member.id_proof_type as IdProofType] : "ID Proof"}</Text>
                                        <View style={styles.idProofLinks}>
                                            {(member.has_id_proof_back ? (["front", "back"] as const) : (["front"] as const)).map((side) => (
                                                <Pressable key={side} accessibilityRole="button" onPress={() => handleViewIdProof(side)} disabled={loadingIdProofSide !== null} hitSlop={6}>
                                                    {loadingIdProofSide === side ? (
                                                        <ActivityIndicator color={theme.accent} size="small" />
                                                    ) : (
                                                        <Text style={styles.sectionLink}>View {side}</Text>
                                                    )}
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                    {isSavingIdProof ? (
                                        <ActivityIndicator color={theme.mutedForeground} size="small" />
                                    ) : (
                                        <>
                                            <Pressable accessibilityRole="button" accessibilityLabel="Re-upload ID proof" style={styles.rowIconBtn} onPress={() => setIsIdProofSheetVisible(true)} hitSlop={6}>
                                                <Ionicons name="pencil" size={15} color={theme.mutedForeground} />
                                            </Pressable>
                                            <Pressable accessibilityRole="button" accessibilityLabel="Remove ID proof" style={styles.rowIconBtn} onPress={handleRemoveIdProof} hitSlop={6}>
                                                <Ionicons name="trash-outline" size={15} color={theme.destructive} />
                                            </Pressable>
                                        </>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.addIdProofWrap}>
                                    <AddIdProofCard onAdd={() => setIsIdProofSheetVisible(true)} />
                                </View>
                            )}
                        </View>

                        {/* Rare and destructive, so it sits at the very end rather than among the everyday actions. */}
                        {isActive && (
                            <Pressable
                                accessibilityRole="button"
                                style={({ pressed }) => [styles.leaveButton, pressed && { opacity: 0.7 }]}
                                onPress={handleMarkAsLeft}
                                disabled={isDeactivating}>
                                {isDeactivating ? (
                                    <ActivityIndicator color={theme.destructive} size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="person-remove-outline" size={18} color={theme.destructive} />
                                        <Text style={styles.leaveButtonText}>Mark as left</Text>
                                    </>
                                )}
                            </Pressable>
                        )}
                    </ScrollView>
                )}

                <Modal visible={idProofModalVisible} transparent animationType="fade" onRequestClose={closeIdProofModal}>
                    <View style={styles.idProofModalOverlay}>
                        <Pressable style={styles.idProofModalCloseBtn} onPress={closeIdProofModal}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </Pressable>
                        {viewingSide && <Text style={styles.idProofModalLabel}>{viewingSide === "front" ? "Front" : "Back"}</Text>}
                        {idProofSource ? (
                            <Image source={idProofSource} style={styles.idProofModalImage} contentFit="contain" transition={150} />
                        ) : (
                            <ActivityIndicator color="#fff" size="large" />
                        )}
                    </View>
                </Modal>

                <IdProofSheet
                    visible={isIdProofSheetVisible}
                    onClose={() => setIsIdProofSheetVisible(false)}
                    // Re-uploading starts from the current ID type; the photos are retaken.
                    initial={member?.id_proof_type ? { type: member.id_proof_type as IdProofType } : null}
                    title={member?.has_id_proof_front ? "Re-upload ID Proof" : "Add ID Proof"}
                    onSave={handleSaveIdProof}
                    isSaving={isSavingIdProof}
                />

                <Modal visible={isPaymentSheetVisible} transparent animationType="slide" onRequestClose={() => setIsPaymentSheetVisible(false)}>
                    <Pressable style={styles.editModalOverlay} onPress={() => setIsPaymentSheetVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editModalSheetWrap}>
                        <View style={styles.editModalSheet}>
                            <Text style={styles.editModalTitle}>{isPaidAhead ? "Renew Early" : "Record Payment"}</Text>
                            {member && (
                                <Text style={styles.paymentSheetSubtitle}>
                                    {member.name} · Monthly fee {formatRupee(member.monthly_fee)}
                                    {member.due_amount ? ` · ${formatRupee(member.due_amount)} due` : ""}
                                </Text>
                            )}
                            {isPaidAhead && paidThrough && (
                                <View style={styles.sheetNote}>
                                    <Ionicons name="information-circle-outline" size={16} color={theme.accent} />
                                    <Text style={styles.sheetNoteText}>Already paid till {formatShortDate(addDays(paidThrough, -1), true)}. This payment adds the time after that.</Text>
                                </View>
                            )}

                            {/* Overdue after a break: carry on from where their paid time ended, or restart on a chosen date. */}
                            {canRestart && paidThrough && (
                                <>
                                    <Text style={styles.inputLabel}>Start From</Text>
                                    <View style={styles.restartChoiceRow}>
                                        <Pressable
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: !restartMode }}
                                            style={[styles.restartChoice, !restartMode && styles.restartChoiceSelected]}
                                            onPress={() => switchRestartMode(false)}>
                                            <Text style={[styles.restartChoiceTitle, !restartMode && styles.restartChoiceTitleSelected]}>Continue</Text>
                                            <Text style={styles.restartChoiceHint}>From {formatShortDate(paidThrough, true)}</Text>
                                        </Pressable>
                                        <Pressable
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: restartMode }}
                                            style={[styles.restartChoice, restartMode && styles.restartChoiceSelected]}
                                            onPress={() => switchRestartMode(true)}>
                                            <Text style={[styles.restartChoiceTitle, restartMode && styles.restartChoiceTitleSelected]}>Restart</Text>
                                            <Text style={styles.restartChoiceHint}>{restartDate ? `From ${formatShortDate(restartDate, true)}` : "Pick a date"}</Text>
                                        </Pressable>
                                    </View>
                                    {restartMode && (
                                        <View style={styles.calendarWrap}>
                                            <CalendarPicker value={restartDate} onChange={setRestartDate} minDate={paidThrough} maxDate={addDays(todayIso, RESTART_MAX_DAYS_AHEAD)} />
                                            {restartDate && (
                                                <Text style={styles.paymentHint}>
                                                    {restartDate > paidThrough ? `${formatShortDate(paidThrough)} – ${formatShortDate(addDays(restartDate, -1), true)} won't be charged.` : " "}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </>
                            )}

                            <Text style={styles.inputLabel}>Amount Received</Text>
                            <View style={styles.amountField}>
                                <Text style={styles.amountPrefix}>₹</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    value={paymentAmount}
                                    onChangeText={(text) => setPaymentAmount(text.replace(/[^0-9.]/g, ""))}
                                    keyboardType="decimal-pad"
                                    placeholder="0"
                                    placeholderTextColor={theme.mutedForeground + "80"}
                                />
                            </View>
                            {/* Which days this pays for, so it's never a guess. */}
                            <Text style={[styles.paymentHint, monthsCovered >= 1 && styles.paymentCovers]}>
                                {paymentAmountValue <= 0 || (restartMode && !restartDate)
                                    ? " "
                                    : monthsCovered >= 1
                                      ? `Covers ${periodText}${monthsCovered > 1 ? ` (${monthsCovered} months)` : ""}${remainingAfterPayment > 0 ? ` · ${formatRupee(remainingAfterPayment)} still due` : ""}`
                                      : `Partial payment toward ${periodText} · ${formatRupee(remainingAfterPayment)} more to renew`}
                            </Text>

                            <ChoiceChips label="Payment Mode" value={paymentMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPaymentMode(mode)} />

                            <Pressable style={[styles.editSaveBtn, isSavingPayment && { opacity: 0.7 }]} onPress={handleSavePayment} disabled={isSavingPayment || isRestarting}>
                                {isSavingPayment ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Payment</Text>}
                            </Pressable>
                            {restartMode && restartDate && (
                                <Pressable accessibilityRole="button" style={styles.secondaryBtn} onPress={handleRestartWithoutPayment} disabled={isSavingPayment || isRestarting}>
                                    {isRestarting ? <ActivityIndicator color={theme.primary} size="small" /> : <Text style={styles.secondaryBtnText}>Restart now, collect later</Text>}
                                </Pressable>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <Modal visible={isLeaveSheetVisible} transparent animationType="slide" onRequestClose={() => setIsLeaveSheetVisible(false)}>
                    <Pressable style={styles.editModalOverlay} onPress={() => setIsLeaveSheetVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editModalSheetWrap}>
                        <View style={styles.editModalSheet}>
                            <Text style={styles.editModalTitle}>Mark as left</Text>
                            {member?.refund_options && (
                                <Text style={styles.paymentSheetSubtitle}>
                                    {member.name} has paid till {formatShortDate(addDays(member.refund_options.paid_through, -1), true)} · {member.refund_options.unused_days} day
                                    {member.refund_options.unused_days === 1 ? "" : "s"} unused. Their seat will be freed.
                                </Text>
                            )}

                            <Text style={styles.inputLabel}>Money Back</Text>
                            <View style={styles.restartChoiceRow}>
                                {(
                                    [
                                        ["none", "No refund", " "],
                                        ["partial", "Partial", member?.refund_options ? formatRupee(member.refund_options.partial) : ""],
                                        ["full", "Full", member?.refund_options ? formatRupee(member.refund_options.full) : ""],
                                    ] as const
                                ).map(([key, title, hint]) => (
                                    <Pressable
                                        key={key}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: refundChoice === key }}
                                        style={[styles.restartChoice, refundChoice === key && styles.restartChoiceSelected]}
                                        onPress={() => chooseRefund(key)}>
                                        <Text style={[styles.restartChoiceTitle, refundChoice === key && styles.restartChoiceTitleSelected]}>{title}</Text>
                                        <Text style={styles.restartChoiceHint}>{hint}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {refundChoice !== "none" && (
                                <>
                                    <Text style={styles.inputLabel}>Refund Amount</Text>
                                    <View style={styles.amountField}>
                                        <Text style={styles.amountPrefix}>₹</Text>
                                        <TextInput
                                            style={styles.amountInput}
                                            value={refundAmount}
                                            onChangeText={(text) => setRefundAmount(text.replace(/[^0-9.]/g, ""))}
                                            keyboardType="decimal-pad"
                                            placeholder="0"
                                            placeholderTextColor={theme.mutedForeground + "80"}
                                        />
                                    </View>
                                    <Text style={styles.paymentHint}>
                                        {refundChoice === "partial" && member?.refund_options ? `For the ${member.refund_options.unused_days} unused days. You can change the amount.` : "You can change the amount."}
                                    </Text>
                                    <ChoiceChips label="Paid Back By" value={refundMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setRefundMode(mode)} />
                                </>
                            )}

                            <Pressable style={[styles.editSaveBtn, styles.leaveConfirmBtn, isDeactivating && { opacity: 0.7 }]} onPress={confirmLeave} disabled={isDeactivating}>
                                {isDeactivating ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.editSaveBtnText}>
                                        {refundChoice === "none" || !(parseFloat(refundAmount) > 0) ? "Mark as left" : `Mark as left · refund ${formatRupee(parseFloat(refundAmount))}`}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <Modal visible={isEditModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditModalVisible(false)}>
                    <Pressable style={styles.editModalOverlay} onPress={() => setIsEditModalVisible(false)} />
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editModalSheetWrap}>
                        <View style={styles.editModalSheet}>
                            <Text style={styles.editModalTitle}>Edit Member</Text>

                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput style={styles.inputField} value={editName} onChangeText={setEditName} autoCapitalize="words" placeholder="e.g. Rahul Sharma" placeholderTextColor={theme.mutedForeground + "80"} />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={[styles.inputField, member?.status === "inactive" && styles.inputFieldDisabled]}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                keyboardType="phone-pad"
                                maxLength={15}
                                placeholder="10-digit mobile number"
                                placeholderTextColor={theme.mutedForeground + "80"}
                                editable={member?.status !== "inactive"}
                            />
                            {member?.status === "inactive" && (
                                <Text style={styles.inputHint}>Phone can&apos;t be changed once a member has left - it&apos;s used to recognize them if they rejoin.</Text>
                            )}

                            <ChoiceChips label="Gender" value={editGender} options={GENDER_OPTIONS} onChange={setEditGender} allowDeselect />

                            <Text style={styles.inputLabel}>Address</Text>
                            <TextInput
                                style={[styles.inputField, styles.addressField]}
                                value={editAddress}
                                onChangeText={setEditAddress}
                                placeholder="House no., street, area, city"
                                placeholderTextColor={theme.mutedForeground + "80"}
                                autoCapitalize="words"
                                multiline
                                maxLength={500}
                            />

                            <Pressable style={[styles.editSaveBtn, isSavingEdit && { opacity: 0.7 }]} onPress={handleSaveEdit} disabled={isSavingEdit}>
                                {isSavingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Changes</Text>}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 12,
        },
        topBar: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 4,
        },
        backArrow: {
            alignSelf: "flex-start",
            paddingVertical: 6,
        },
        identityRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
        },
        editButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.card,
            borderWidth: 1.5,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
        },
        avatar: {
            width: 56,
            height: 56,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        avatarText: {
            fontFamily: "sans-extrabold",
            fontSize: 20,
        },
        identityText: {
            flex: 1,
        },
        memberName: {
            fontFamily: "sans-extrabold",
            fontSize: 19,
            color: theme.primary,
        },
        identityMetaRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
        },
        memberPhone: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        addressRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 4,
            marginTop: 4,
        },
        addressText: {
            flexShrink: 1,
            fontFamily: "sans-medium",
            fontSize: 12,
            lineHeight: 17,
            color: theme.mutedForeground,
        },
        statusPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
        },
        statusDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        statusPillText: {
            fontFamily: "sans-bold",
            fontSize: 11,
        },
        quickActions: {
            flexDirection: "row",
            gap: 10,
            marginTop: 18,
            marginBottom: 18,
        },
        quickAction: {
            flex: 1,
            alignItems: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        quickActionPressed: {
            opacity: 0.7,
        },
        quickActionIcon: {
            height: 20,
            justifyContent: "center",
        },
        quickActionLabel: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.primary,
        },
        card: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 14,
            gap: 14,
        },
        statsRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        stat: {
            flex: 1,
            alignItems: "center",
        },
        statLabel: {
            fontFamily: "sans-semibold",
            fontSize: 11,
            color: theme.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
        },
        statValue: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
        },
        statUnit: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
        },
        statDivider: {
            width: StyleSheet.hairlineWidth,
            alignSelf: "stretch",
            backgroundColor: theme.border,
        },
        cardButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 42,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent,
        },
        cardButtonOutline: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: theme.border,
        },
        cardButtonText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: "#fff",
        },
        cardButtonTextOutline: {
            color: theme.primary,
        },
        inactiveText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            lineHeight: 19,
        },
        inactiveDues: {
            fontFamily: "sans-bold",
            color: theme.destructive,
        },
        // Matches the New Admission form: a card per section with its title inside.
        sectionCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 8,
            marginTop: 20,
        },
        sectionHeaderRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            paddingBottom: 10,
            marginBottom: 4,
        },
        sectionTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: theme.primary,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            paddingBottom: 10,
            marginBottom: 4,
        },
        sectionTitleInline: {
            borderBottomWidth: 0,
            paddingBottom: 0,
            marginBottom: 0,
        },
        sectionLink: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.accent,
            textTransform: "capitalize",
        },
        listRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 12,
        },
        listRowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
        },
        listRowTitle: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        listRowMeta: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        seatRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 12,
        },
        seatBadge: {
            width: 52,
            height: 52,
            borderRadius: RADIUS.md,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
        },
        seatBadgeLabel: {
            fontFamily: "sans-bold",
            fontSize: 8,
            letterSpacing: 1.5,
            color: "rgba(255,255,255,0.8)",
        },
        seatBadgeNumber: {
            fontFamily: "sans-extrabold",
            fontSize: 20,
            color: "#fff",
            marginTop: -2,
        },
        seatText: {
            flex: 1,
            gap: 3,
        },
        seatBatchRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        listRowTrailing: {
            marginLeft: "auto",
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        listRowTrailingFlex: {
            flexShrink: 1,
            textAlign: "right",
        },
        emptyText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            paddingVertical: 14,
        },
        paymentText: {
            gap: 2,
        },
        paymentTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        paymentPeriod: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        refundTag: {
            color: theme.destructive,
            backgroundColor: theme.destructive + "15",
        },
        paymentCovers: {
            fontFamily: "sans-bold",
            color: theme.success,
        },
        sheetNote: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            backgroundColor: theme.accent + "12",
            borderRadius: RADIUS.sm,
            padding: 10,
            marginTop: -8,
            marginBottom: 16,
        },
        sheetNoteText: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 12,
            lineHeight: 17,
            color: theme.primary,
        },
        // Equal-width choice tiles (Continue / Restart, and the refund choices).
        restartChoiceRow: {
            flexDirection: "row",
            gap: 10,
            marginBottom: 16,
        },
        restartChoice: {
            flex: 1,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        restartChoiceSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "12",
        },
        restartChoiceTitle: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        restartChoiceTitleSelected: {
            color: theme.accent,
        },
        restartChoiceHint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        calendarWrap: {
            marginTop: -6,
            marginBottom: 8,
        },
        secondaryBtn: {
            alignItems: "center",
            paddingVertical: 14,
            marginTop: 6,
        },
        secondaryBtnText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        leaveConfirmBtn: {
            backgroundColor: theme.destructive,
        },
        paymentDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        partialTag: {
            fontFamily: "sans-bold",
            fontSize: 10,
            color: theme.accent,
            backgroundColor: theme.accent + "15",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            overflow: "hidden",
            textTransform: "uppercase",
        },
        addIdProofWrap: {
            paddingTop: 8,
            paddingBottom: 12,
        },
        idProofText: {
            flex: 1,
        },
        idProofLinks: {
            flexDirection: "row",
            gap: 14,
            marginTop: 2,
        },
        rowIconBtn: {
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
        },
        paymentSheetSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: -12,
            marginBottom: 20,
        },
        amountField: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
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
            fontSize: 12,
            color: theme.mutedForeground,
            lineHeight: 17,
            marginTop: 8,
            marginBottom: 16,
        },
        idProofModalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            alignItems: "center",
            justifyContent: "center",
        },
        idProofModalCloseBtn: {
            position: "absolute",
            top: 50,
            right: 20,
            zIndex: 1,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
        },
        idProofModalImage: {
            width: "100%",
            height: "70%",
        },
        idProofModalLabel: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: "#fff",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        leaveButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 28,
            paddingVertical: 14,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.destructive + "40",
        },
        leaveButtonText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.destructive,
        },
        editModalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        editModalSheetWrap: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
        },
        editModalSheet: {
            backgroundColor: theme.background,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
            padding: 24,
            paddingBottom: 32,
        },
        editModalTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 18,
            color: theme.primary,
            marginBottom: 20,
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
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: RADIUS.md,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 15,
            color: theme.primary,
            marginBottom: 16,
        },
        // Room for two lines, e.g. house and street on one, area and city on the next.
        addressField: {
            minHeight: 76,
            textAlignVertical: "top",
        },
        inputFieldDisabled: {
            opacity: 0.6,
        },
        inputHint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: -10,
            marginBottom: 16,
        },
        editSaveBtn: {
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 8,
        },
        editSaveBtnText: {
            ...BUTTON_TEXT,
            color: "#fff",
        },
    });
