import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { createPaymentApi, getPaymentsApi } from "@/features/payments/logic/payments-api";
import { PAYMENT_MODE_LABELS, Payment, PaymentMode } from "@/features/payments/types/payments.types";
import { describePaymentPeriod, formatPaymentWhen, PAYMENT_STATUS_LOOK } from "@/features/payments/logic/payment-display";
import { remindAllOverdueApi, remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { RADIUS } from "@/shared/constants/layout";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { FloatingActionButton, FAB_CLEARANCE } from "@/shared/ui/FloatingActionButton";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { FilterChip } from "@/shared/ui/FilterChip";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { formatShortDate } from "@/shared/utils/dates";

import { MonthPickerSheet } from "./MonthPickerSheet";


type Tab = "received" | "due";
type ReceivedFilter = "all" | "PAID" | "PARTIAL" | "REFUNDED";

const RECEIVED_FILTERS: { key: ReceivedFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "PAID", label: "Paid" },
    { key: "PARTIAL", label: "Partial" },
    { key: "REFUNDED", label: "Refunds" },
];

/** "YYYY-MM" for the current month. */
function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" shifted by whole months. */
function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "October 2026" from "YYYY-MM". */
function formatMonth(month: string, short = false): string {
    return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: "numeric" });
}

export function PaymentsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const params = useLocalSearchParams<{ tab?: string }>();
    // Two views: money that came in (by month), and who owes money now.
    const [tab, setTab] = useState<Tab>(params.tab === "due" ? "due" : "received");
    const [month, setMonth] = useState(currentMonth());
    const [isMonthPickerVisible, setMonthPickerVisible] = useState(false);
    const [receivedFilter, setReceivedFilter] = useState<ReceivedFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [remindingId, setRemindingId] = useState<string | null>(null);

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
                // Members who left have no seat to pay for; they settle up when readmitted.
                setMembers((response.data || []).filter((m) => m.status === "active"));
            }
        } catch {
            // The member picker will just show as empty; the form still validates selection is required.
        }
    }, []);

    // The API returns money received (payments, partial payments, refunds) and current dues (PENDING) together.
    const { received, dues } = useMemo(
        () => ({ received: payments.filter((p) => p.status !== "PENDING"), dues: payments.filter((p) => p.status === "PENDING") }),
        [payments]
    );
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = (p: Payment) => !query || p.member_name.toLowerCase().includes(query);

    const monthReceived = received.filter((p) => p.date.startsWith(month));
    // Net of refunds, which are stored as negative amounts - the same figure Home shows for the month.
    const collectedInMonth = monthReceived.reduce((sum, p) => sum + p.amount, 0);
    const dueTotal = dues.reduce((sum, p) => sum + p.amount, 0);

    const visibleReceived = monthReceived.filter((p) => matchesSearch(p) && (receivedFilter === "all" || p.status === receivedFilter));
    const visibleDues = dues.filter(matchesSearch);
    const isCurrentMonth = month === currentMonth();

    // Collecting happens on the member's page, where the payment sheet shows the period it covers.
    const openCollect = (item: Payment) => router.push({ pathname: "/members/[id]", params: { id: String(item.member_id), collect: "1" } });

    const handleRemind = async (item: Payment) => {
        try {
            setRemindingId(item.id);
            await remindMemberApi(item.member_id);
            Alert.alert("Sent", `An SMS reminder was sent to ${item.member_name}.`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send reminder.");
        } finally {
            setRemindingId(null);
        }
    };

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
        const look = PAYMENT_STATUS_LOOK[item.status] ?? PAYMENT_STATUS_LOOK.PENDING;
        const color = look.color(theme);
        return (
            <Pressable
                style={[styles.paymentCard, hasLeft && styles.paymentCardFaded]}
                onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(item.member_id) } })}>
                <View style={[styles.paymentIconBox, { backgroundColor: color + "15" }]}>
                    <Ionicons name={look.icon} size={24} color={color} />
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
                    {/* When and how it was paid */}
                    <View style={styles.paymentWhenRow}>
                        <Text style={styles.paymentDate}>{formatPaymentWhen(item)}</Text>
                        {!!item.method && (
                            <View style={styles.methodChip}>
                                <Text style={styles.methodChipText}>{item.method}</Text>
                            </View>
                        )}
                    </View>
                    {/* What it was for: the days it covers (or, for a refund, gives back) */}
                    {!!describePaymentPeriod(item) && <Text style={styles.paymentFor}>{describePaymentPeriod(item)}</Text>}
                </View>
                <View style={styles.paymentAmountBlock}>
                    <Text style={[styles.paymentAmount, { color }]}>
                        {look.sign}₹{Math.abs(item.amount).toLocaleString("en-IN")}
                    </Text>
                    <Text style={styles.paymentStatus}>{look.label}</Text>
                </View>
            </Pressable>
        );
    };

    const renderDueItem = ({ item }: { item: Payment }) => (
        <View style={[styles.paymentCard, styles.dueCard]}>
            <Pressable style={styles.dueMain} onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(item.member_id) } })}>
                <View style={[styles.paymentIconBox, { backgroundColor: theme.destructive + "15" }]}>
                    <Ionicons name="time" size={24} color={theme.destructive} />
                </View>
                <View style={styles.paymentInfo}>
                    <Text style={styles.paymentName} numberOfLines={1}>
                        {item.member_name}
                    </Text>
                    <Text style={styles.paymentDate}>Due since {formatShortDate(item.date, true)}</Text>
                </View>
                <Text style={[styles.paymentAmount, { color: theme.destructive }]}>₹{item.amount.toLocaleString("en-IN")}</Text>
            </Pressable>
            <View style={styles.dueActions}>
                <Pressable accessibilityRole="button" style={styles.dueActionSecondary} onPress={() => handleRemind(item)} disabled={remindingId === item.id}>
                    {remindingId === item.id ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                        <>
                            <Ionicons name="chatbox-ellipses-outline" size={15} color={theme.primary} />
                            <Text style={styles.dueActionSecondaryText}>Remind</Text>
                        </>
                    )}
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.dueActionPrimary} onPress={() => openCollect(item)}>
                    <Ionicons name="wallet-outline" size={15} color="#fff" />
                    <Text style={styles.dueActionPrimaryText}>Collect</Text>
                </Pressable>
            </View>
        </View>
    );

    if (showPaymentForm) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.safe} edges={["top"]}>
                    <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
                            <ScreenHeader title="Mark Payment" subtitle="Record a student payment" onBack={() => setShowPaymentForm(false)} />

                            <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
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
                                    <TextInput style={[styles.input, styles.textArea]} placeholder="e.g. Partial payment, rest next week" placeholderTextColor={theme.mutedForeground + "80"} multiline numberOfLines={4} value={notes} onChangeText={setNotes} />
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
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Payments" subtitle="Revenue & collections" />

                {/* The two cards are the tabs: each shows its total and switches the list below. */}
                <View style={styles.summaryRow} accessibilityRole="tablist">
                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === "received" }}
                        style={[styles.summaryCard, tab === "received" && styles.summaryCardActive]}
                        onPress={() => setTab("received")}>
                        <Text style={[styles.summaryLabel, tab === "received" && styles.summaryLabelActive]}>Received · {formatMonth(month, true)}</Text>
                        <Text style={[styles.summaryValue, { color: theme.success }]}>₹{collectedInMonth.toLocaleString("en-IN")}</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === "due" }}
                        style={[styles.summaryCard, tab === "due" && styles.summaryCardActive]}
                        onPress={() => setTab("due")}>
                        <Text style={[styles.summaryLabel, tab === "due" && styles.summaryLabelActive]}>Due now</Text>
                        <Text style={[styles.summaryValue, { color: dueTotal > 0 ? theme.destructive : theme.primary }]}>₹{dueTotal.toLocaleString("en-IN")}</Text>
                        <Text style={styles.summarySub}>
                            {dues.length} {dues.length === 1 ? "person" : "people"}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color={theme.mutedForeground} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by member name"
                        placeholderTextColor={theme.mutedForeground + "80"}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {!!searchQuery && (
                        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery("")} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                        </Pressable>
                    )}
                </View>

                {tab === "received" ? (
                    <>
                        {/* Older payments: step back a month, or tap the month to jump to any month. */}
                        <View style={styles.monthRow}>
                            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={8} style={styles.monthArrow}>
                                <Ionicons name="chevron-back" size={20} color={theme.primary} />
                            </Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel="Pick a month" onPress={() => setMonthPickerVisible(true)} style={styles.monthLabelButton}>
                                <Ionicons name="calendar-outline" size={16} color={theme.accent} />
                                <Text style={styles.monthLabel}>{formatMonth(month)}</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.mutedForeground} />
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Next month"
                                disabled={isCurrentMonth}
                                onPress={() => setMonth((m) => shiftMonth(m, 1))}
                                hitSlop={8}
                                style={[styles.monthArrow, isCurrentMonth && { opacity: 0.25 }]}>
                                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
                            </Pressable>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
                            {RECEIVED_FILTERS.map((f) => (
                                <FilterChip key={f.key} label={f.label} selected={receivedFilter === f.key} onPress={() => setReceivedFilter(f.key)} />
                            ))}
                        </ScrollView>

                        {isLoading ? (
                            <LoadingState />
                        ) : error ? (
                            <ErrorState message={error} onRetry={fetchPayments} />
                        ) : visibleReceived.length === 0 ? (
                            <EmptyState
                                icon="cash-outline"
                                title={monthReceived.length === 0 ? `Nothing received in ${formatMonth(month)}` : "No payments match"}
                                subtitle={monthReceived.length === 0 ? "Use the arrows or tap the month to see other months." : "Try a different name or filter."}
                            />
                        ) : (
                            <FlatList
                                style={styles.list}
                                data={visibleReceived}
                                renderItem={renderPaymentItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={[styles.listContent, { paddingBottom: FAB_CLEARANCE + bottomInset }]}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </>
                ) : (
                    <>
                        {dues.length > 0 && (
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

                        {isLoading ? (
                            <LoadingState />
                        ) : error ? (
                            <ErrorState message={error} onRetry={fetchPayments} />
                        ) : visibleDues.length === 0 ? (
                            <EmptyState
                                icon="checkmark-done-outline"
                                title={dues.length === 0 ? "Nobody owes anything" : "No one matches"}
                                subtitle={dues.length === 0 ? "Everyone is paid up." : "Try a different name."}
                            />
                        ) : (
                            <FlatList
                                style={styles.list}
                                data={visibleDues}
                                renderItem={renderDueItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={[styles.listContent, { paddingBottom: FAB_CLEARANCE + bottomInset }]}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </>
                )}

                <MonthPickerSheet
                    visible={isMonthPickerVisible}
                    value={month}
                    maxMonth={currentMonth()}
                    onPick={(picked) => {
                        setMonth(picked);
                        setMonthPickerVisible(false);
                    }}
                    onClose={() => setMonthPickerVisible(false)}
                />

                <FloatingActionButton label="Record payment" onPress={openPaymentForm} />
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
    summaryRow: {
        flexDirection: "row",
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
        paddingTop: 24,
    },
    summaryCard: {
        flex: 1,
        padding: 20,
        borderRadius: RADIUS.md,
        backgroundColor: theme.card,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    summaryLabel: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: theme.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: theme.primary,
    },
    remindAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: 20,
        marginBottom: 20,
        paddingVertical: 12,
        borderRadius: RADIUS.md,
        backgroundColor: theme.accent + "15",
        borderWidth: 1,
        borderColor: theme.accent + "30",
    },
    remindAllBtnText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.accent,
    },
    summaryCardActive: {
        borderColor: theme.accent,
        backgroundColor: theme.accent + "12",
    },
    summaryLabelActive: {
        color: theme.accent,
    },
    summarySub: {
        fontFamily: "sans-medium",
        fontSize: 12,
        color: theme.mutedForeground,
        marginTop: 2,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    searchInput: {
        flex: 1,
        fontFamily: "sans-medium",
        fontSize: 15,
        color: theme.primary,
        paddingVertical: 12,
    },
    monthRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: 20,
        marginBottom: 10,
    },
    monthArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    monthLabelButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: RADIUS.md,
    },
    monthLabel: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: theme.primary,
    },
    // ScrollViews grow and shrink by default; without this the list below squeezes the chips to nothing.
    chipScroll: {
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: 12,
    },
    list: {
        flex: 1,
    },
    chipRow: {
        paddingHorizontal: 20,
        gap: 8,
    },
    // Name and amount on top, Remind / Collect underneath.
    dueCard: {
        flexDirection: "column",
        alignItems: "stretch",
    },
    dueMain: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    dueActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 12,
    },
    dueActionSecondary: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: RADIUS.sm,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    dueActionSecondaryText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: theme.primary,
    },
    dueActionPrimary: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: RADIUS.sm,
        backgroundColor: theme.accent,
    },
    dueActionPrimaryText: {
        fontFamily: "sans-bold",
        fontSize: 13,
        color: "#fff",
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    paymentCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card,
        borderRadius: RADIUS.md,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: theme.border,
    },
    paymentIconBox: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
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
    paymentWhenRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
    },
    methodChip: {
        backgroundColor: theme.muted,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    methodChipText: {
        fontFamily: "sans-bold",
        fontSize: 11,
        color: theme.primary,
    },
    paymentFor: {
        fontFamily: "sans-medium",
        fontSize: 12,
        lineHeight: 16,
        color: theme.mutedForeground,
        marginTop: 3,
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
        paddingTop: 24,
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
        borderRadius: RADIUS.md,
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
        borderRadius: RADIUS.md,
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
        borderTopLeftRadius: RADIUS.lg,
        borderTopRightRadius: RADIUS.lg,
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
        borderRadius: RADIUS.md,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 12,
    },
    primaryButtonText: {
        ...BUTTON_TEXT,
        color: "#fff",
    },
    emptyText: {
        fontFamily: "sans-bold",
        fontSize: 16,
        color: theme.mutedForeground,
    },
});
