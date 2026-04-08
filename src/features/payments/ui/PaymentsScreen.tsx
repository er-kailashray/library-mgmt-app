import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
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
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DUMMY_MEMBERS } from "@/features/members/types/members.types";
import { DUMMY_PAYMENTS, PaymentStatus } from "@/features/payments/types/payments.types";
import { colors } from "@/shared/constants/theme";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
};

export function PaymentsScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<PaymentStatus | "ALL">("ALL");
    const [payments, setPayments] = useState(DUMMY_PAYMENTS);

    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newPayment, setNewPayment] = useState({
        memberName: "",
        amount: "",
        method: "UPI",
    });

    const filteredPayments = useMemo(() => {
        return payments.filter((p) => {
            const matchesSearch = p.member_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = selectedStatus === "ALL" || p.status === selectedStatus;
            return matchesSearch && matchesStatus;
        });
    }, [searchQuery, selectedStatus, payments]);

    const totalCollected = useMemo(() => {
        return payments.reduce((sum, p) => (p.status === PaymentStatus.PAID ? sum + p.amount : sum), 0);
    }, [payments]);

    const totalPending = useMemo(() => {
        return payments.reduce((sum, p) => (p.status === PaymentStatus.PENDING ? sum + p.amount : sum), 0);
    }, [payments]);

    const getStatusColor = (status: PaymentStatus) => {
        switch (status) {
            case PaymentStatus.PAID:
                return colors.success;
            case PaymentStatus.PENDING:
                return colors.destructive;
            case PaymentStatus.PARTIAL:
                return colors.accent;
            default:
                return colors.mutedForeground;
        }
    };

    const handleSavePayment = () => {
        if (!newPayment.memberName || !newPayment.amount) return;

        Keyboard.dismiss();

        const payment = {
            id: Math.random().toString(36).substr(2, 9),
            member_name: newPayment.memberName,
            amount: parseFloat(newPayment.amount),
            date: new Date().toISOString().split("T")[0],
            status: PaymentStatus.PAID,
            method: newPayment.method,
        };

        setPayments([payment, ...payments]);
        setIsModalVisible(false);
        setNewPayment({ memberName: "", amount: "", method: "UPI" });
    };

    const renderPaymentItem = ({ item }: { item: (typeof DUMMY_PAYMENTS)[0] }) => (
        <Pressable style={styles.paymentCard}>
            <View style={styles.cardHeader}>
                <View style={styles.paymentDetails}>
                    <Text style={styles.memberName}>{item.member_name}</Text>
                    <Text style={styles.paymentDate}>{item.date}</Text>
                </View>
                <View style={styles.amountWrap}>
                    <Text style={[styles.amountText, { color: getStatusColor(item.status) }]}>
                        {formatCurrency(item.amount)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "15" }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardFooter}>
                <View style={styles.methodWrap}>
                    <Ionicons name="card-outline" size={14} color={colors.mutedForeground} />
                    <Text style={styles.methodText}>{item.method}</Text>
                </View>
                <Pressable style={styles.receiptButton}>
                    <Text style={styles.receiptText}>Receipt</Text>
                    <Ionicons name="download-outline" size={14} color={colors.accent} />
                </Pressable>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Payments</Text>
                    <Text style={styles.headerSubtitle}>Collections & Revenue</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.summarySection}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.success }]}>
                        <View style={styles.summaryIconBox}>
                            <Ionicons name="cash-outline" size={24} color="#fff" />
                        </View>
                        <Text style={styles.summaryLabel}>Collected (This Month)</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(totalCollected)}</Text>
                    </View>

                    <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
                        <View style={styles.summaryIconBox}>
                            <Ionicons name="alert-circle-outline" size={24} color="#fff" />
                        </View>
                        <Text style={styles.summaryLabel}>Total Pending</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(totalPending)}</Text>
                    </View>
                </View>

                <View style={styles.toolSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={colors.mutedForeground} />
                        <TextInput
                            placeholder="Search member name..."
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                        style={styles.filterScroll}>
                        <Pressable
                            style={[styles.filterChip, selectedStatus === "ALL" && styles.filterChipSelected]}
                            onPress={() => setSelectedStatus("ALL")}>
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedStatus === "ALL" && styles.filterChipTextSelected,
                                ]}>
                                All
                            </Text>
                        </Pressable>
                        {Object.values(PaymentStatus).map((status) => (
                            <Pressable
                                key={status}
                                style={[styles.filterChip, selectedStatus === status && styles.filterChipSelected]}
                                onPress={() => setSelectedStatus(status)}>
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedStatus === status && styles.filterChipTextSelected,
                                    ]}>
                                    {status}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                <FlatList
                    data={filteredPayments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPaymentItem}
                    scrollEnabled={false}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name="wallet-outline"
                                size={64}
                                color={colors.mutedForeground}
                                style={{ opacity: 0.3 }}
                            />
                            <Text style={styles.emptyText}>No transactions found</Text>
                        </View>
                    }
                />
            </ScrollView>

            <Pressable style={styles.fab} onPress={() => setIsModalVisible(true)}>
                <Ionicons name="add" size={32} color="#fff" />
            </Pressable>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={styles.keyboardView}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Record Payment</Text>
                                    <Pressable
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setIsModalVisible(false);
                                        }}>
                                        <Ionicons name="close" size={24} color={colors.primary} />
                                    </Pressable>
                                </View>

                                <View style={styles.form}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Select Member</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            style={styles.memberSelect}>
                                            {DUMMY_MEMBERS.map((m) => (
                                                <Pressable
                                                    key={m.id}
                                                    style={[
                                                        styles.memberChip,
                                                        newPayment.memberName === m.name && styles.memberChipSelected,
                                                    ]}
                                                    onPress={() => {
                                                        Keyboard.dismiss();
                                                        setNewPayment({ ...newPayment, memberName: m.name });
                                                    }}>
                                                    <Text
                                                        style={[
                                                            styles.memberChipText,
                                                            newPayment.memberName === m.name &&
                                                            styles.memberChipTextSelected,
                                                        ]}>
                                                        {m.name}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Amount (₹)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. 1500"
                                            keyboardType="numeric"
                                            value={newPayment.amount}
                                            onChangeText={(amount) => setNewPayment({ ...newPayment, amount })}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Payment Method</Text>
                                        <View style={styles.methodRow}>
                                            {["UPI", "Cash", "Card"].map((m) => (
                                                <Pressable
                                                    key={m}
                                                    style={[
                                                        styles.methodChip,
                                                        newPayment.method === m && styles.methodChipSelected,
                                                    ]}
                                                    onPress={() => {
                                                        Keyboard.dismiss();
                                                        setNewPayment({ ...newPayment, method: m });
                                                    }}>
                                                    <Text
                                                        style={[
                                                            styles.methodChipText,
                                                            newPayment.method === m && styles.methodChipTextSelected,
                                                        ]}>
                                                        {m}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>

                                    <Pressable style={styles.saveButton} onPress={handleSavePayment}>
                                        <Text style={styles.saveButtonText}>Mark as Paid</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: "sans-extrabold",
        fontSize: 22,
        color: colors.primary,
    },
    headerSubtitle: {
        fontFamily: "sans-medium",
        fontSize: 14,
        color: colors.mutedForeground,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
    },
    summarySection: {
        flexDirection: "row",
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
    },
    summaryIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    summaryLabel: {
        fontFamily: "sans-bold",
        fontSize: 11,
        color: "rgba(255,255,255,0.8)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    summaryValue: {
        fontFamily: "sans-extrabold",
        fontSize: 20,
        color: "#fff",
        marginTop: 4,
    },
    toolSection: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        fontFamily: "sans-medium",
        fontSize: 15,
        color: colors.primary,
    },
    filterScroll: {
        marginTop: 12,
    },
    filterRow: {
        gap: 8,
        paddingRight: 20,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: colors.primary,
    },
    filterChipTextSelected: {
        color: colors.background,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 12,
    },
    paymentCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    paymentDetails: {
        flex: 1,
    },
    memberName: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: colors.primary,
    },
    paymentDate: {
        fontFamily: "sans-medium",
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    amountWrap: {
        alignItems: "flex-end",
    },
    amountText: {
        fontFamily: "sans-extrabold",
        fontSize: 18,
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusText: {
        fontFamily: "sans-bold",
        fontSize: 9,
        textTransform: "uppercase",
    },
    cardDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 12,
        opacity: 0.5,
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    methodWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    methodText: {
        fontFamily: "sans-semibold",
        fontSize: 12,
        color: colors.mutedForeground,
    },
    receiptButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: colors.accent + "10",
    },
    receiptText: {
        fontFamily: "sans-bold",
        fontSize: 12,
        color: colors.accent,
    },
    emptyContainer: {
        alignItems: "center",
        marginTop: 40,
    },
    emptyText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: colors.mutedForeground,
        marginTop: 12,
    },
    fab: {
        position: "absolute",
        right: 24,
        bottom: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    keyboardView: {
        width: "100%",
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        minHeight: "55%",
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
    form: {
        gap: 20,
    },
    formGroup: {
        gap: 8,
    },
    label: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: "sans-semibold",
        fontSize: 16,
        color: colors.primary,
    },
    memberSelect: {
        flexDirection: "row",
        marginTop: 4,
    },
    memberChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.card,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    memberChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    memberChipText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.primary,
    },
    memberChipTextSelected: {
        color: "#fff",
    },
    methodRow: {
        flexDirection: "row",
        gap: 12,
    },
    methodChip: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    methodChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    methodChipText: {
        fontFamily: "sans-bold",
        fontSize: 14,
        color: colors.primary,
    },
    methodChipTextSelected: {
        color: "#fff",
    },
    saveButton: {
        backgroundColor: colors.success,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 12,
    },
    saveButtonText: {
        fontFamily: "sans-extrabold",
        fontSize: 16,
        color: "#fff",
    },
});
