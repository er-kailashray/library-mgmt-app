import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deactivateMemberApi, getMemberDetailApi } from "@/features/members/logic/members.api";
import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

export function MemberDetailScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: member, isLoading, error, refetch } = useApiData(() => getMemberDetailApi(id), [id]);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isSendingSms, setIsSendingSms] = useState(false);

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
            `${member.name} will be marked inactive and their seat${member.allocations.length > 1 ? "s" : ""} will be freed up for new admissions.`,
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

    const getStatusColor = (payment_status: string) => (payment_status === "Paid" ? theme.success : theme.destructive);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Member Details</Text>
                </View>
            </View>

            {isLoading ? (
                <LoadingState />
            ) : error || !member ? (
                <ErrorState message={error || "Member not found."} onRetry={refetch} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.profileBlock}>
                        <View style={[styles.avatar, { backgroundColor: getStatusColor(member.payment_status) + "15" }]}>
                            <Text style={[styles.avatarText, { color: getStatusColor(member.payment_status) }]}>{getInitials(member.name)}</Text>
                        </View>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberPhone}>{member.phone}</Text>
                        <View style={[styles.badge, { backgroundColor: getStatusColor(member.payment_status) + "15" }]}>
                            <Text style={[styles.badgeText, { color: getStatusColor(member.payment_status) }]}>{member.payment_status}</Text>
                        </View>
                    </View>

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
                </ScrollView>
            )}
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
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
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
        memberPhone: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 12,
        },
        badge: {
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 10,
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
            borderRadius: 18,
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
            borderRadius: 16,
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
            borderRadius: 16,
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
    });
