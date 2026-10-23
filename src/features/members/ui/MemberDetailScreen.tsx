import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_LABELS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { AddIdProofCard, IdProofDraft, IdProofSheet } from "@/features/admission/ui/IdProofSheet";
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
import { ScreenBackground } from "@/shared/ui/ScreenBackground";


const PAYMENT_MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }));

function formatRupee(amount: number): string {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function formatPaymentDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function MemberDetailScreen() {
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

    const handleWhatsAppRemind = useCallback(async () => {
        if (!member) return;
        const dueAmountText = member.due_amount ? ` of ₹${Math.round(member.due_amount)}` : "";
        const message = `Dear ${member.name}, your library fee${dueAmountText} is overdue. Please pay at the earliest.`;
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
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Member Details</Text>
                    </View>
                    {/* Temporary: compare with the redesigned screen (MemberDetailScreenV2). */}
                    <Pressable
                        accessibilityRole="button"
                        style={styles.designSwitch}
                        onPress={() => router.replace({ pathname: "/members/v2/[id]", params: { id: String(id) } })}>
                        <Ionicons name="swap-horizontal" size={14} color={theme.accent} />
                        <Text style={styles.designSwitchText}>New design</Text>
                    </Pressable>
                </View>

                {isLoading ? (
                    <LoadingState />
                ) : error || !member ? (
                    <ErrorState message={error || "Member not found."} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        <View style={styles.profileBlock}>
                            <Pressable accessibilityRole="button" style={styles.editIconBtn} onPress={openEditModal}>
                                <Ionicons name="pencil" size={14} color={theme.mutedForeground} />
                            </Pressable>
                            <View style={[styles.profileContent, member.status === "inactive" && styles.profileBlockFaded]}>
                                <View style={[styles.avatar, { backgroundColor: (member.status === "active" ? theme.success : theme.mutedForeground) + "15" }]}>
                                    <Text style={[styles.avatarText, { color: member.status === "active" ? theme.success : theme.mutedForeground }]}>{getInitials(member.name)}</Text>
                                </View>
                                <Text style={styles.memberName}>{member.name}</Text>
                                <Text style={styles.memberPhone}>{member.phone}</Text>
                                {/* Membership status; whether they've paid is shown by the Collect button and history below. */}
                                {member.status === "inactive" ? (
                                    <View style={[styles.badge, { backgroundColor: theme.mutedForeground + "15" }]}>
                                        <Text style={[styles.badgeText, { color: theme.mutedForeground }]}>Inactive</Text>
                                    </View>
                                ) : (
                                    <View style={[styles.badge, { backgroundColor: theme.success + "15" }]}>
                                        <Text style={[styles.badgeText, { color: theme.success }]}>Active</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {member.status === "active" && member.suggested_payment !== null && (
                            <Pressable accessibilityRole="button" style={styles.renewButton} onPress={openPaymentSheet}>
                                <Ionicons name="wallet-outline" size={18} color="#fff" />
                                <Text style={styles.renewButtonText}>
                                    {member.payment_status === "Due" && member.due_amount ? `Collect ${formatRupee(member.due_amount)}` : "Record Payment / Renew"}
                                </Text>
                            </Pressable>
                        )}

                        <Text style={styles.sectionTitle}>Batches & Seats</Text>
                        {member.allocations.length === 0 ? (
                            <Text style={styles.emptyText}>No active batch allocations.</Text>
                        ) : (
                            member.allocations.map((allocation) => (
                                <View key={`${allocation.batch_id}-${allocation.seat_id}`} style={styles.allocationCard}>
                                    <View style={styles.allocationIconBox}>
                                        <Ionicons name="grid-outline" size={20} color={theme.accent} />
                                    </View>
                                    <View style={styles.allocationInfo}>
                                        <Text style={styles.allocationBatch}>{allocation.batch_name}</Text>
                                        <Text style={styles.allocationMeta}>Seat {allocation.seat_number} · Renews {allocation.renewal_date}</Text>
                                    </View>
                                </View>
                            ))
                        )}

                        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Payment History</Text>
                        {member.payments.length === 0 ? (
                            <Text style={styles.emptyText}>No payments recorded yet.</Text>
                        ) : (
                            <View style={styles.historyCard}>
                                {member.payments.map((payment: Payment, index: number) => {
                                    const isPaid = payment.status === PaymentStatus.PAID;
                                    const tone = isPaid ? theme.success : theme.accent;
                                    return (
                                        <View key={payment.id} style={[styles.historyRow, index !== member.payments.length - 1 && styles.historyRowBorder]}>
                                            <View style={[styles.historyIcon, { backgroundColor: tone + "15" }]}>
                                                <Ionicons name={isPaid ? "checkmark-circle" : "time-outline"} size={18} color={tone} />
                                            </View>
                                            <View style={styles.historyInfo}>
                                                <Text style={styles.historyAmount}>{formatRupee(payment.amount)}</Text>
                                                <Text style={styles.historyMeta}>
                                                    {payment.method} · {formatPaymentDate(payment.date)}
                                                </Text>
                                            </View>
                                            <View style={[styles.badge, styles.historyBadge, { backgroundColor: tone + "15" }]}>
                                                <Text style={[styles.badgeText, { color: tone }]}>{isPaid ? "Paid" : "Partial"}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.idProofBlock}>
                            <Text style={styles.sectionTitle}>ID Proof</Text>
                            {member.has_id_proof_front ? (
                                <View style={styles.idProofCard}>
                                    <View style={styles.idProofHeader}>
                                        <View style={styles.allocationIconBox}>
                                            <Ionicons name="card-outline" size={20} color={theme.accent} />
                                        </View>
                                        <View style={styles.idProofHeaderText}>
                                            <Text style={styles.idProofTitle}>{member.id_proof_type ? ID_PROOF_TYPE_LABELS[member.id_proof_type as IdProofType] : "ID Proof"}</Text>
                                            <Text style={styles.idProofSubtitle}>{member.has_id_proof_back ? "Front & back on file" : "Front on file"}</Text>
                                        </View>
                                        {isSavingIdProof ? (
                                            <ActivityIndicator color={theme.mutedForeground} size="small" />
                                        ) : (
                                            <View style={styles.idProofIconActions}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Re-upload ID proof"
                                                    style={styles.idProofIconBtn}
                                                    onPress={() => setIsIdProofSheetVisible(true)}
                                                    hitSlop={6}>
                                                    <Ionicons name="pencil" size={15} color={theme.primary} />
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Remove ID proof"
                                                    style={styles.idProofIconBtn}
                                                    onPress={handleRemoveIdProof}
                                                    hitSlop={6}>
                                                    <Ionicons name="trash-outline" size={15} color={theme.destructive} />
                                                </Pressable>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.idProofViewRow}>
                                        {(member.has_id_proof_back ? (["front", "back"] as const) : (["front"] as const)).map((side) => (
                                            <Pressable
                                                key={side}
                                                accessibilityRole="button"
                                                style={styles.idProofViewBtn}
                                                onPress={() => handleViewIdProof(side)}
                                                disabled={loadingIdProofSide !== null}>
                                                {loadingIdProofSide === side ? (
                                                    <ActivityIndicator color={theme.primary} size="small" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="eye-outline" size={16} color={theme.primary} />
                                                        <Text style={styles.idProofViewBtnText}>View {side === "front" ? "Front" : "Back"}</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            ) : (
                                <AddIdProofCard title="No ID proof on file" onAdd={() => setIsIdProofSheetVisible(true)} />
                            )}
                        </View>

                        {member.payment_status === "Due" && (
                            <View style={styles.remindBlock}>
                                <Text style={styles.sectionTitle}>Send a Reminder</Text>
                                {member.due_amount ? <Text style={styles.remindAmount}>₹{Math.round(member.due_amount)} due</Text> : null}
                                <View style={styles.remindButtonsRow}>
                                    <Pressable style={[styles.remindBtn, styles.whatsappBtn]} onPress={handleWhatsAppRemind}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                        <Text style={styles.remindBtnText}>WhatsApp</Text>
                                    </Pressable>
                                    <Pressable style={[styles.remindBtn, styles.smsBtn]} onPress={handleSmsRemind} disabled={isSendingSms}>
                                        {isSendingSms ? (
                                            <ActivityIndicator color={theme.primary} size="small" />
                                        ) : (
                                            <>
                                                <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.primary} />
                                                <Text style={[styles.remindBtnText, { color: theme.primary }]}>SMS</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {member.status === "inactive" ? (
                            <View style={styles.inactiveCard}>
                                <View style={styles.inactiveNotice}>
                                    <Ionicons name="exit-outline" size={18} color={theme.mutedForeground} />
                                    <Text style={styles.inactiveNoticeText}>This member has left and their seat has been freed.</Text>
                                </View>
                                {member.outstanding_balance > 0 && (
                                    <Text style={styles.inactiveDues}>
                                        Left with <Text style={styles.inactiveDuesAmount}>{formatRupee(member.outstanding_balance)}</Text> pending - you can collect or waive it when readmitting.
                                    </Text>
                                )}
                                <Pressable accessibilityRole="button" style={styles.readmitButton} onPress={handleReadmit}>
                                    <Ionicons name="person-add-outline" size={18} color="#fff" />
                                    <Text style={styles.readmitButtonText}>Readmit Member</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable style={[styles.leaveButton, isDeactivating && { opacity: 0.7 }]} onPress={handleMarkAsLeft} disabled={isDeactivating}>
                                {isDeactivating ? (
                                    <ActivityIndicator color={theme.destructive} size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="exit-outline" size={18} color={theme.destructive} />
                                        <Text style={styles.leaveButtonText}>Mark as Left</Text>
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
        </ScreenBackground>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
            gap: 16,
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
        headerText: {
            flex: 1,
        },
        headerTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 20,
            color: theme.primary,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40,
        },
        profileBlock: {
            alignItems: "center",
            marginBottom: 32,
            position: "relative",
        },
        profileContent: {
            alignItems: "center",
        },
        profileBlockFaded: {
            opacity: 0.6,
        },
        avatar: {
            width: 88,
            height: 88,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
        },
        avatarText: {
            fontFamily: "sans-extrabold",
            fontSize: 28,
        },
        memberName: {
            fontFamily: "sans-extrabold",
            fontSize: 22,
            color: theme.primary,
            marginBottom: 4,
        },
        editIconBtn: {
            position: "absolute",
            top: 0,
            right: 0,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
        },
        memberPhone: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 12,
        },
        badge: {
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: RADIUS.sm,
        },
        badgeText: {
            fontFamily: "sans-extrabold",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        sectionTitle: {
            fontFamily: "sans-bold",
            fontSize: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginBottom: 12,
        },
        emptyText: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 24,
        },
        allocationCard: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        allocationIconBox: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.accent + "15",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
        },
        allocationInfo: {
            flex: 1,
        },
        allocationBatch: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
            marginBottom: 2,
        },
        allocationMeta: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        idProofBlock: {
            marginTop: 24,
        },
        idProofCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 16,
            gap: 14,
        },
        idProofHeader: {
            flexDirection: "row",
            alignItems: "center",
        },
        idProofHeaderText: {
            flex: 1,
        },
        idProofTitle: {
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
        },
        idProofSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        idProofIconActions: {
            flexDirection: "row",
            gap: 8,
        },
        idProofIconBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
        },
        idProofViewRow: {
            flexDirection: "row",
            gap: 10,
        },
        idProofViewBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 42,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
        },
        idProofViewBtnText: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: theme.primary,
        },
        renewButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingVertical: 15,
            marginTop: -12,
            marginBottom: 28,
        },
        renewButtonText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
        sectionTitleSpaced: {
            marginTop: 12,
        },
        historyCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            overflow: "hidden",
        },
        historyRow: {
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            gap: 12,
        },
        historyRowBorder: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
        },
        historyIcon: {
            width: 36,
            height: 36,
            borderRadius: RADIUS.sm,
            alignItems: "center",
            justifyContent: "center",
        },
        historyInfo: {
            flex: 1,
        },
        historyAmount: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
        },
        historyMeta: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        historyBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
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
        remindBlock: {
            marginTop: 24,
        },
        remindAmount: {
            fontFamily: "sans-extrabold",
            fontSize: 16,
            color: theme.destructive,
            marginBottom: 12,
        },
        remindButtonsRow: {
            flexDirection: "row",
            gap: 10,
        },
        remindBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: RADIUS.md,
            paddingVertical: 14,
        },
        whatsappBtn: {
            backgroundColor: "#25D366",
        },
        smsBtn: {
            backgroundColor: theme.card,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        remindBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: "#fff",
        },
        leaveButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.destructive + "15",
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            marginTop: 20,
            borderWidth: 1.5,
            borderColor: theme.destructive + "30",
        },
        leaveButtonText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.destructive,
        },
        inactiveCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            padding: 16,
            marginTop: 20,
            borderWidth: 1.5,
            borderColor: theme.border,
            gap: 12,
        },
        inactiveNotice: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        inactiveDues: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            lineHeight: 19,
        },
        inactiveDuesAmount: {
            fontFamily: "sans-extrabold",
            color: theme.destructive,
        },
        readmitButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingVertical: 14,
        },
        readmitButtonText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
        inactiveNoticeText: {
            flex: 1,
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
    });
