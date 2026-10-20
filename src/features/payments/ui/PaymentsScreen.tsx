import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { createPaymentApi, getPaymentsApi } from "@/features/payments/logic/payments-api";
import { PAYMENT_MODE_LABELS, Payment, PaymentMode } from "@/features/payments/types/payments.types";
import { remindAllOverdueApi } from "@/features/reminders/logic/reminders-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

export function PaymentsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");

    const { data, isLoading, error, refetch: fetchPayments } = useApiData(getPaymentsApi, []);
    const payments = data ?? [];

    useFocusEffect(
        useCallback(() => {
            void fetchPayments();
        }, [fetchPayments])
    );

    // Form State
    const [members, setMembers] = useState<Member[]>([]);
    const [isMemberPickerVisible, setMemberPickerVisible] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [amount, setAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingBulkReminder, setIsSendingBulkReminder] = useState(false);

    const openPaymentForm = useCallback(async () => {
        setShowPaymentForm(true);
        try {
            const response = await getMembersApi();
            if (response.status) {
                setMembers(response.data || []);
            }
        } catch {
            // The member picker will just show as empty; the form still validates selection is required.
        }
    }, []);

    const totalCollection = payments.reduce((sum, p) => (p.status === "PAID" ? sum + p.amount : sum), 0);
    const pendingAmount = payments.reduce((sum, p) => (p.status === "PENDING" ? sum + p.amount : sum), 0);

    const filteredPayments = payments.filter((p) => {
        const matchesSearch = p.member_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === "all" || p.status.toLowerCase() === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleMarkPayment = useCallback(async () => {
        if (!selectedMember || !amount) {
            Alert.alert("Error", "Please select a member and enter an amount.");
            return;
        }

        try {
            setIsSubmitting(true);
            await createPaymentApi({
                member_id: selectedMember.id,
                amount: Number(amount),
                payment_mode: paymentMode,
                notes: notes || undefined,
            });
            setShowPaymentForm(false);
            setSelectedMember(null);
            setAmount("");
            setPaymentMode("cash");
            setNotes("");
            await fetchPayments();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to record payment.");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedMember, amount, paymentMode, notes, fetchPayments]);

    const handleRemindAllDue = useCallback(async () => {
        try {
            setIsSendingBulkReminder(true);
            const response = await remindAllOverdueApi();
            Alert.alert("Reminders sent", response.message || `Sent ${response.data.sent} reminder(s).`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send reminders.");
        } finally {
            setIsSendingBulkReminder(false);
        }
    }, []);

    const styles = createStyles(theme);

    const renderPaymentItem = ({ item }: { item: Payment }) => {
        const hasLeft = item.member_status === "inactive";
        return (
            <Pressable
                style={[styles.paymentCard, hasLeft && styles.paymentCardFaded]}
                onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(item.member_id) } })}>
                <View style={[styles.paymentIconBox, { backgroundColor: item.status === "PAID" ? theme.success + "15" : theme.accent + "15" }]}>
                    <Ionicons name={item.status === "PAID" ? "checkmark-circle" : "time"} size={24} color={item.status === "PAID" ? theme.success : theme.accent} />
                </View>
                <View style={styles.paymentInfo}>
                    <View style={styles.paymentNameRow}>
                        <Text style={styles.paymentName}>{item.member_name}</Text>
                        {hasLeft && (
                            <View style={styles.leftBadge}>
                                <Text style={styles.leftBadgeText}>Left</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.paymentDate}>{item.date}</Text>
                </View>
                <View style={styles.paymentAmountBlock}>
                    <Text style={[styles.paymentAmount, { color: item.status === "PAID" ? theme.success : theme.accent }]}>
                        {item.status === "PAID" ? "+" : ""}
                        ₹{item.amount}
                    </Text>
                    <Text style={styles.paymentStatus}>{item.status}</Text>
                </View>
            </Pressable>
        );
    };

    if (showPaymentForm) {
        return (
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
                        <View style={styles.header}>
                            <Pressable style={styles.headerActionCircle} onPress={() => setShowPaymentForm(false)}>
                                <Ionicons name="close" size={24} color={theme.primary} />
                            </Pressable>
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>Mark Payment</Text>
                                <Text style={styles.headerSubtitle}>Record a student payment</Text>
                            </View>
                        </View>

                        <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Member</Text>
                                <Pressable style={styles.input} onPress={() => setMemberPickerVisible(true)}>
                                    <Text style={[styles.pickerText, !selectedMember && { color: theme.mutedForeground + "80" }]}>
                                        {selectedMember ? selectedMember.name : "Select a member"}
                                    </Text>
                                </Pressable>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Amount (₹)</Text>
                                <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor={theme.mutedForeground + "80"} keyboardType="numeric" value={amount} onChangeText={setAmount} />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Payment Mode</Text>
                                <View style={styles.modeRow}>
                                    {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((mode) => (
                                        <Pressable key={mode} style={[styles.modeChip, paymentMode === mode && styles.modeChipActive]} onPress={() => setPaymentMode(mode)}>
                                            <Text style={[styles.modeChipText, paymentMode === mode && styles.modeChipTextActive]}>{PAYMENT_MODE_LABELS[mode]}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Notes (Optional)</Text>
                                <TextInput style={[styles.input, styles.textArea]} placeholder="e.g. Cash payment for April" placeholderTextColor={theme.mutedForeground + "80"} multiline numberOfLines={4} value={notes} onChangeText={setNotes} />
                            </View>

                            <Pressable style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }]} onPress={handleMarkPayment} disabled={isSubmitting}>
                                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Confirm Payment</Text>}
                            </Pressable>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>

                <Modal visible={isMemberPickerVisible} animationType="slide" transparent onRequestClose={() => setMemberPickerVisible(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setMemberPickerVisible(false)} />
                    <View style={styles.memberPickerSheet}>
                        <Text style={styles.memberPickerTitle}>Select Member</Text>
                        <FlatList
                            data={members}
                            keyExtractor={(item) => item.id.toString()}
                            style={{ maxHeight: 400 }}
                            ListEmptyComponent={<Text style={styles.emptyText}>No members found.</Text>}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.memberPickerRow}
                                    onPress={() => {
                                        setSelectedMember(item);
                                        setMemberPickerVisible(false);
                                    }}>
                                    <Text style={styles.memberPickerName}>{item.name}</Text>
                                    <Text style={styles.memberPickerPhone}>{item.phone}</Text>
                                </Pressable>
                            )}
                        />
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable style={styles.headerActionCircle} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Payments</Text>
                    <Text style={styles.headerSubtitle}>Revenue & collections</Text>
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: theme.accent }]}>
                    <Text style={styles.summaryLabel}>Total Collected</Text>
                    <Text style={styles.summaryValue}>₹{totalCollection.toLocaleString("en-IN")}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.border }]}>
                    <Text style={[styles.summaryLabel, { color: theme.mutedForeground }]}>Pending</Text>
                    <Text style={[styles.summaryValue, { color: theme.primary }]}>₹{pendingAmount.toLocaleString("en-IN")}</Text>
                </View>
            </View>

            {pendingAmount > 0 && (
                <Pressable style={[styles.remindAllBtn, isSendingBulkReminder && { opacity: 0.7 }]} onPress={handleRemindAllDue} disabled={isSendingBulkReminder}>
                    {isSendingBulkReminder ? (
                        <ActivityIndicator color={theme.accent} size="small" />
                    ) : (
                        <>
                            <Ionicons name="megaphone-outline" size={16} color={theme.accent} />
                            <Text style={styles.remindAllBtnText}>Remind everyone who&apos;s due (SMS)</Text>
                        </>
                    )}
                </Pressable>
            )}

            <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Recent Transactions</Text>
                <View style={styles.filterRow}>
                    <Pressable onPress={() => setFilterStatus("all")} style={[styles.filterBtn, filterStatus === "all" && { backgroundColor: theme.accent }]}>
                        <Text style={[styles.filterBtnText, filterStatus === "all" && { color: theme.background === "#0C0A09" ? theme.primary : "#fff" }]}>All</Text>
                    </Pressable>
                    <Pressable onPress={() => setFilterStatus("paid")} style={[styles.filterBtn, filterStatus === "paid" && { backgroundColor: theme.accent }]}>
                        <Text style={[styles.filterBtnText, filterStatus === "paid" && { color: theme.background === "#0C0A09" ? theme.primary : "#fff" }]}>Paid</Text>
                    </Pressable>
                </View>
            </View>

            {isLoading ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={error} onRetry={fetchPayments} />
            ) : filteredPayments.length === 0 ? (
                payments.length === 0 ? (
                    <EmptyState icon="cash-outline" title="No payments recorded yet" subtitle="Payments you record will show up here." />
                ) : (
                    <EmptyState icon="search-outline" title="No transactions found" subtitle="Try adjusting your search or filters." />
                )
            ) : (
                <FlatList data={filteredPayments} renderItem={renderPaymentItem} keyExtractor={(item) => item.id} contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false} />
            )}

            <Pressable style={[styles.fab, { bottom: 30 + insets.bottom }]} onPress={openPaymentForm}>
                <Ionicons name="add" size={32} color={theme.background} />
            </Pressable>
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 20,
        gap: 16,
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
        fontSize: 22,
        color: theme.primary,
    },
    headerSubtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: theme.mutedForeground,
    },
    summaryRow: {
        flexDirection: "row",
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
    },
    summaryCard: {
        flex: 1,
        padding: 20,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
    },
    summaryLabel: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: "#fff",
    },
    remindAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: 20,
        marginBottom: 20,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: theme.accent + "15",
        borderWidth: 1,
        borderColor: theme.accent + "30",
    },
    remindAllBtnText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.accent,
    },
    listHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    listTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        color: theme.primary,
    },
    filterRow: {
        flexDirection: "row",
        gap: 8,
    },
    filterBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    filterBtnText: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: theme.mutedForeground,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    paymentCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    paymentIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    paymentCardFaded: {
        opacity: 0.55,
    },
    paymentInfo: {
        flex: 1,
        marginLeft: 16,
    },
    paymentNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    paymentName: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: theme.primary,
    },
    leftBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: theme.mutedForeground + "20",
    },
    leftBadgeText: {
        fontFamily: "sans-bold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: theme.mutedForeground,
    },
    paymentDate: {
        fontFamily: "sans-medium",
        fontSize: 12,
        color: theme.mutedForeground,
        marginTop: 2,
    },
    paymentAmountBlock: {
        alignItems: "flex-end",
    },
    paymentAmount: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
    },
    paymentStatus: {
        fontFamily: "sans-bold",
        fontSize: 10,
        color: theme.mutedForeground,
        textTransform: "uppercase",
        marginTop: 2,
    },
    formScroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: theme.primary,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: theme.card,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: "sans-medium",
        fontSize: 15,
        color: theme.primary,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    textArea: {
        height: 100,
        textAlignVertical: "top",
    },
    pickerText: {
        fontFamily: "sans-medium",
        fontSize: 15,
        color: theme.primary,
    },
    modeRow: {
        flexDirection: "row",
        gap: 10,
    },
    modeChip: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: theme.card,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    modeChipActive: {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
    },
    modeChipText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.mutedForeground,
    },
    modeChipTextActive: {
        color: "#fff",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    memberPickerSheet: {
        backgroundColor: theme.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "70%",
    },
    memberPickerTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        color: theme.primary,
        marginBottom: 16,
    },
    memberPickerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
    },
    memberPickerName: {
        fontFamily: "sans-bold",
        fontSize: 15,
        color: theme.primary,
    },
    memberPickerPhone: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: theme.mutedForeground,
    },
    primaryButton: {
        backgroundColor: theme.accent,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 12,
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    primaryButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: theme.background === "#0C0A09" ? theme.primary : "#fff",
    },
    fab: {
        position: "absolute",
        right: 20,
        bottom: 30,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    emptyText: {
        fontFamily: "sans-bold",
        fontSize: 16,
        color: theme.mutedForeground,
    },
});
