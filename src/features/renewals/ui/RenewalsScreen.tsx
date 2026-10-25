import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { getUpcomingRenewalsApi, remindAllUpcomingRenewalsApi } from "@/features/renewals/logic/renewals-api";
import { UpcomingRenewal } from "@/features/renewals/types/renewals.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { RADIUS } from "@/shared/constants/layout";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

function formatRupee(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}

function buildRenewalMessage(renewal: UpcomingRenewal): string {
    const date = new Date(`${renewal.renewal_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `Dear ${renewal.name}, your library membership renews on ${date} (${formatRupee(renewal.amount)}). Renew in time to keep your seat.`;
}

export function RenewalsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const { data, isLoading, error, refetch } = useApiData(getUpcomingRenewalsApi, []);
    const renewals = data?.renewals ?? [];

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const [sendingMemberId, setSendingMemberId] = useState<number | null>(null);
    const [isSendingBulk, setIsSendingBulk] = useState(false);

    const handleWhatsAppRemind = useCallback(async (renewal: UpcomingRenewal) => {
        try {
            await openWhatsAppMessage(renewal.phone, buildRenewalMessage(renewal));
        } catch {
            Alert.alert("Couldn't open WhatsApp", "Make sure WhatsApp is installed on this device.");
        }
    }, []);

    const handleSmsRemind = useCallback(async (renewal: UpcomingRenewal) => {
        try {
            setSendingMemberId(renewal.member_id);
            await remindMemberApi(renewal.member_id);
            Alert.alert("Sent", `An SMS reminder was sent to ${renewal.name}.`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send SMS reminder.");
        } finally {
            setSendingMemberId(null);
        }
    }, []);

    const handleRemindAll = useCallback(async () => {
        try {
            setIsSendingBulk(true);
            const response = await remindAllUpcomingRenewalsApi();
            Alert.alert("Reminders sent", response.message || `Sent ${response.data.sent} reminder(s).`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send reminders.");
        } finally {
            setIsSendingBulk(false);
        }
    }, []);

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Renewals" subtitle={data ? `Renewing within ${data.window_days} days` : "Upcoming renewals"} />

                {isLoading ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : renewals.length === 0 ? (
                    <EmptyState icon="refresh-outline" title="No renewals coming up" subtitle="You'll see members here as their membership gets close to renewing." />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        <Pressable style={[styles.remindAllBtn, isSendingBulk && { opacity: 0.7 }]} onPress={handleRemindAll} disabled={isSendingBulk}>
                            {isSendingBulk ? (
                                <ActivityIndicator color={theme.accent} size="small" />
                            ) : (
                                <>
                                    <Ionicons name="megaphone-outline" size={16} color={theme.accent} />
                                    <Text style={styles.remindAllBtnText}>Remind everyone renewing soon (SMS)</Text>
                                </>
                            )}
                        </Pressable>

                        {renewals.map((renewal) => (
                            // The card opens the member's profile; the WhatsApp/SMS buttons inside keep their own taps.
                            <Pressable
                                key={renewal.member_id}
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${renewal.name}'s profile`}
                                style={({ pressed }) => [styles.renewalCard, pressed && styles.renewalCardPressed]}
                                onPress={() => router.push({ pathname: "/members/[id]", params: { id: String(renewal.member_id) } })}>
                                <View style={styles.renewalInfo}>
                                    <Text style={styles.renewalName}>{renewal.name}</Text>
                                    <Text style={styles.renewalMeta}>
                                        Renews in {renewal.days_until_renewal} day{renewal.days_until_renewal === 1 ? "" : "s"} · {formatRupee(renewal.amount)}
                                    </Text>
                                </View>
                                <View style={styles.renewalActions}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remind ${renewal.name} on WhatsApp`}
                                        style={[styles.iconBtn, styles.whatsappBtn]}
                                        onPress={() => handleWhatsAppRemind(renewal)}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remind ${renewal.name} by SMS`}
                                        style={[styles.iconBtn, styles.smsBtn]}
                                        onPress={() => handleSmsRemind(renewal)}
                                        disabled={sendingMemberId === renewal.member_id}>
                                        {sendingMemberId === renewal.member_id ? (
                                            <ActivityIndicator color={theme.primary} size="small" />
                                        ) : (
                                            <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.primary} />
                                        )}
                                    </Pressable>
                                    <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} style={styles.chevron} />
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
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
            paddingTop: 24,
            paddingBottom: 40,
        },
        remindAllBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
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
        renewalCard: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        renewalCardPressed: {
            opacity: 0.85,
        },
        renewalInfo: {
            flex: 1,
        },
        chevron: {
            alignSelf: "center",
            marginLeft: -2,
        },
        renewalName: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
            marginBottom: 2,
        },
        renewalMeta: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        renewalActions: {
            flexDirection: "row",
            gap: 8,
        },
        iconBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
        },
        whatsappBtn: {
            backgroundColor: "#25D366",
        },
        smsBtn: {
            backgroundColor: theme.background,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
    });
