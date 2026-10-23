import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_LABELS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
import { deactivateMemberApi, deleteMemberIdProofApi, getMemberDetailApi, getMemberIdProofSource, updateMemberApi, uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { GENDER_OPTIONS, Gender } from "@/features/members/types/members.types";
import { createPaymentApi } from "@/features/payments/logic/payments-api";
import { PAYMENT_MODE_LABELS, Payment, PaymentMode, PaymentStatus } from "@/features/payments/types/payments.types";
import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ChoiceChips } from "@/shared/ui/ChoiceChips";
import { getInitials } from "@/shared/utils/text";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";

const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));

function formatRupee(amount: number): string {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

/** "22 Oct", or "22 Oct 2026" with the year. Accepts "YYYY-MM-DD" or a full timestamp. */
function formatShortDate(date: string, withYear = false): string {
    return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

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

export function MemberDetailScreenV2() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

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

    // Editing name/phone/gender
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editGender, setEditGender] = useState<Gender | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const openEditModal = useCallback(() => {
        if (!member) return;
        setEditName(member.name);
        setEditPhone(member.phone);
        setEditGender(member.gender);
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
            await updateMemberApi(member.id, { name: editName.trim(), phone: editPhone.trim(), gender: editGender });
            setIsEditModalVisible(false);
            await refetch();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update member.");
        } finally {
            setIsSavingEdit(false);
        }
    }, [member, editName, editPhone, editGender, refetch]);

    // Recording a payment / renewing
    const [isPaymentSheetVisible, setIsPaymentSheetVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    const openPaymentSheet = useCallback(() => {
        if (!member) return;
        // Fall back to a month's fee when nothing is owed yet (e.g. renewing early).
        const suggested = member.suggested_payment || member.monthly_fee;
        setPaymentAmount(suggested > 0 ? String(Math.round(suggested)) : "");
        setPaymentMode("cash");
        setIsPaymentSheetVisible(true);
    }, [member]);

    const paymentAmountValue = parseFloat(paymentAmount) || 0;
    // How much is still needed to clear dues (or, if nothing is overdue, to renew for a month).
    const amountToSettle = member ? member.suggested_payment || member.monthly_fee : 0;
    const remainingAfterPayment = Math.max(0, amountToSettle - paymentAmountValue);

    const handleSavePayment = useCallback(async () => {
        if (!member) return;
        if (paymentAmountValue <= 0) {
            Alert.alert("Error", "Please enter the amount received.");
            return;
        }
        try {
            setIsSavingPayment(true);
            const { data: payment } = await createPaymentApi({ member_id: member.id, amount: paymentAmountValue, payment_mode: paymentMode });
            setIsPaymentSheetVisible(false);
            await refetch();
            Alert.alert(
                payment.status === PaymentStatus.PAID ? "Payment recorded" : "Partial payment recorded",
                payment.status === PaymentStatus.PAID
                    ? `${formatRupee(paymentAmountValue)} received. ${member.name}'s renewal date has been moved forward.`
                    : `${formatRupee(paymentAmountValue)} received. ${formatRupee(remainingAfterPayment)} is still needed to renew.`
            );
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to record payment.");
        } finally {
            setIsSavingPayment(false);
        }
    }, [member, paymentAmountValue, paymentMode, remainingAfterPayment, refetch]);

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

    const handleMarkAsLeft = useCallback(() => {
        if (!member) return;
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

    // Rarely-used actions live behind "..." so they don't crowd the page.
    const openMoreMenu = () => {
        if (!member) return;
        Alert.alert(member.name, undefined, [
            { text: "Edit details", onPress: openEditModal },
            ...(member.status === "active" ? [{ text: "Mark as left", style: "destructive" as const, onPress: handleMarkAsLeft }] : []),
            { text: "Cancel", style: "cancel" as const },
        ]);
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
                outstanding: String(member.outstanding_balance ?? 0),
            },
        });
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerIconBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color={theme.primary} />
                </Pressable>
                <Text style={styles.headerTitle}>Member</Text>
                <View style={styles.headerRight}>
                    {/* Temporary: compare with the original screen (MemberDetailScreen). */}
                    <Pressable
                        accessibilityRole="button"
                        style={styles.designSwitch}
                        onPress={() => router.replace({ pathname: "/members/[id]", params: { id: String(id) } })}>
                        <Ionicons name="swap-horizontal" size={14} color={theme.accent} />
                        <Text style={styles.designSwitchText}>Old design</Text>
                    </Pressable>
                    {member && (
                        <Pressable accessibilityRole="button" accessibilityLabel="More options" style={styles.headerIconBtn} onPress={openMoreMenu} disabled={isDeactivating}>
                            {isDeactivating ? <ActivityIndicator color={theme.primary} size="small" /> : <Ionicons name="ellipsis-horizontal" size={20} color={theme.primary} />}
                        </Pressable>
                    )}
                </View>
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
                        </View>
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
                                        {isDue && member.due_amount ? `Collect ${formatRupee(member.due_amount)}` : "Record payment"}
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

                    {/* SEATS */}
                    {isActive && (
                        <>
                            <Text style={styles.sectionTitle}>Seats</Text>
                            <View style={styles.listCard}>
                                {member.allocations.length === 0 ? (
                                    <Text style={styles.emptyText}>No active seats.</Text>
                                ) : (
                                    member.allocations.map((allocation, index) => (
                                        <View key={`${allocation.batch_id}-${allocation.seat_id}`} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                                            <Ionicons name="grid-outline" size={16} color={theme.accent} />
                                            <Text style={styles.listRowTitle}>{allocation.batch_name}</Text>
                                            <Text style={styles.listRowMeta}>Seat {allocation.seat_number}</Text>
                                            <Text style={styles.listRowTrailing}>till {formatShortDate(allocation.renewal_date)}</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </>
                    )}

                    {/* PAYMENTS */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Payments</Text>
                        {member.payments.length > PAYMENTS_PREVIEW && (
                            <Pressable accessibilityRole="button" onPress={() => setShowAllPayments((v) => !v)} hitSlop={8}>
                                <Text style={styles.sectionLink}>{showAllPayments ? "Show less" : `See all (${member.payments.length})`}</Text>
                            </Pressable>
                        )}
                    </View>
                    <View style={styles.listCard}>
                        {member.payments.length === 0 ? (
                            <Text style={styles.emptyText}>No payments recorded yet.</Text>
                        ) : (
                            visiblePayments.map((payment: Payment, index: number) => {
                                const isPaid = payment.status === PaymentStatus.PAID;
                                return (
                                    <View key={payment.id} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                                        <View style={[styles.paymentDot, { backgroundColor: isPaid ? theme.success : theme.accent }]} />
                                        <Text style={styles.listRowTitle}>{formatRupee(payment.amount)}</Text>
                                        {!isPaid && <Text style={styles.partialTag}>Partial</Text>}
                                        <Text style={[styles.listRowTrailing, styles.listRowTrailingFlex]}>
                                            {payment.method} · {formatShortDate(payment.date, true)}
                                        </Text>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* ID PROOF */}
                    <Text style={styles.sectionTitle}>ID Proof</Text>
                    <View style={styles.listCard}>
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
                            <Pressable accessibilityRole="button" style={styles.listRow} onPress={() => setIsIdProofSheetVisible(true)}>
                                <Ionicons name="card-outline" size={16} color={theme.mutedForeground} />
                                <Text style={[styles.listRowTitle, styles.mutedText]}>No ID proof on file</Text>
                                <Text style={styles.sectionLink}>+ Add</Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            )}

            <Modal visible={idProofModalVisible} transparent animationType="fade" onRequestClose={closeIdProofModal}>
                <View style={styles.idProofModalOverlay}>
                    <Pressable style={styles.idProofModalCloseBtn} onPress={closeIdProofModal}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </Pressable>
                    {viewingSide && <Text style={styles.idProofModalLabel}>{viewingSide === "front" ? "Front" : "Back"}</Text>}
                    {idProofSource ? (
                        <Image source={idProofSource} style={styles.idProofModalImage} resizeMode="contain" />
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
                        <Text style={styles.editModalTitle}>Record Payment</Text>
                        {member && (
                            <Text style={styles.paymentSheetSubtitle}>
                                {member.name} · Monthly fee {formatRupee(member.monthly_fee)}
                                {member.due_amount ? ` · ${formatRupee(member.due_amount)} due` : ""}
                            </Text>
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
                        <Text style={styles.paymentHint}>
                            {paymentAmountValue <= 0
                                ? " "
                                : remainingAfterPayment > 0
                                  ? member?.due_amount
                                      ? `${formatRupee(remainingAfterPayment)} will still be due after this.`
                                      : `Partial payment - ${formatRupee(remainingAfterPayment)} more needed to renew.`
                                  : member?.due_amount
                                    ? "Clears all dues and moves the renewal date forward."
                                    : "Renews the membership for another month."}
                        </Text>

                        <ChoiceChips label="Payment Mode" value={paymentMode} options={PAYMENT_MODE_OPTIONS} onChange={(mode) => mode && setPaymentMode(mode)} />

                        <Pressable style={[styles.editSaveBtn, isSavingPayment && { opacity: 0.7 }]} onPress={handleSavePayment} disabled={isSavingPayment}>
                            {isSavingPayment ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Payment</Text>}
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
                        <TextInput style={styles.inputField} value={editName} onChangeText={setEditName} autoCapitalize="words" placeholder="e.g. John Doe" placeholderTextColor={theme.mutedForeground + "80"} />

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

                        <ChoiceChips label="Gender (Optional)" value={editGender} options={GENDER_OPTIONS} onChange={setEditGender} allowDeselect />

                        <Pressable style={[styles.editSaveBtn, isSavingEdit && { opacity: 0.7 }]} onPress={handleSaveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Changes</Text>}
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: theme.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 8,
        },
        // Temporary: jumps between the original and redesigned member screens for comparison.
        designSwitch: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            height: 30,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme.accent,
        },
        designSwitchText: {
            fontFamily: "sans-bold",
            fontSize: 12,
            color: theme.accent,
        },
        headerRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        headerIconBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
        },
        headerTitle: {
            fontFamily: "sans-bold",
            fontSize: 16,
            color: theme.primary,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 8,
        },
        identityRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
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
            borderWidth: 1,
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
        sectionHeaderRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 22,
            marginBottom: 8,
        },
        sectionTitle: {
            fontFamily: "sans-bold",
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginTop: 22,
            marginBottom: 8,
        },
        sectionTitleInline: {
            marginTop: 0,
            marginBottom: 0,
        },
        sectionLink: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.accent,
            textTransform: "capitalize",
        },
        listCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 14,
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
        mutedText: {
            flex: 1,
            color: theme.mutedForeground,
            fontFamily: "sans-medium",
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
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
    });
