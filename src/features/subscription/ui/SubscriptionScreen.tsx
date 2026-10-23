import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { formatSubscriptionDate, getSubscriptionApi, getSubscriptionInvoicesApi, startCheckoutApi } from "@/features/subscription/logic/subscription-api";
import { SubscriptionInfo, SubscriptionPlan, SubscriptionStateKey } from "@/features/subscription/types/subscription.types";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";

function formatRupee(amount: number): string {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

const INCLUDED = [
    { icon: "people-outline", text: "Members, admissions & ID proofs" },
    { icon: "wallet-outline", text: "Fees, dues, reminders & payment history" },
    { icon: "grid-outline", text: "Seats, batches & attendance" },
    { icon: "stats-chart-outline", text: "Home dashboard & monthly collections" },
] as const;

/** Title, one-line explanation and icon for each subscription state. */
function describeState(info: SubscriptionInfo): { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap } {
    const ends = formatSubscriptionDate(info.ends_at);
    const days = `${info.days_left} day${info.days_left === 1 ? "" : "s"}`;
    const byState: Record<SubscriptionStateKey, { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }> = {
        trial: { title: "Free trial", detail: `Full access until ${ends} · ${days} left`, icon: "gift-outline" },
        active: { title: `${info.plan?.name ?? "Paid"} plan`, detail: `Renews on ${ends} · ${days} left`, icon: "checkmark-circle-outline" },
        grace: {
            title: "Plan ended",
            detail: `Ended on ${ends}. Full access for ${days} more, then read-only.`,
            icon: "time-outline",
        },
        expired: {
            title: "Subscription expired",
            detail: "Read-only: you can view everything, but can't add or change anything until you subscribe.",
            icon: "lock-closed-outline",
        },
    };
    return byState[info.state];
}

export function SubscriptionScreen() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const { data: info, isLoading, error, refetch } = useApiData(getSubscriptionApi, []);
    const { data: invoices, refetch: refetchInvoices } = useApiData(getSubscriptionInvoicesApi, []);
    const [isPaying, setIsPaying] = useState(false);

    useFocusEffect(
        useCallback(() => {
            void refetch();
            void refetchInvoices();
        }, [refetch, refetchInvoices])
    );

    // Yearly is the better deal, so it's pre-selected; otherwise keep the owner's current plan.
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    useEffect(() => {
        if (info && !selectedCode) setSelectedCode(info.plan?.code ?? info.plans.find((p) => p.code === "yearly")?.code ?? info.plans[0]?.code ?? null);
    }, [info, selectedCode]);
    const selectedPlan = info?.plans.find((p) => p.code === selectedCode) ?? null;

    // Saving of the longest plan against paying monthly for the same period.
    const monthlyPlan = info?.plans.find((p) => p.duration_months === 1);
    const savingFor = (plan: SubscriptionPlan) => (monthlyPlan && plan.duration_months > 1 ? monthlyPlan.price * plan.duration_months - plan.price : 0);

    const stateColor: Record<SubscriptionStateKey, string> = {
        trial: theme.accent,
        active: theme.success,
        grace: theme.warning,
        expired: theme.destructive,
    };

    // Razorpay Checkout runs on a signed page in the in-app browser, which redirects back to this
    // deep link with ?result=success|failed|cancelled. The server verifies the payment itself.
    const handleContinue = async () => {
        if (!selectedPlan) return;
        const returnUrl = Linking.createURL("subscription");
        try {
            setIsPaying(true);
            const { data } = await startCheckoutApi(selectedPlan.code, returnUrl);
            const session = await WebBrowser.openAuthSessionAsync(data.pay_url, returnUrl);
            const result = session.type === "success" ? Linking.parse(session.url).queryParams?.result : null;

            await Promise.all([refetch(), refetchInvoices()]);
            if (result === "success") {
                Alert.alert("Payment successful", `Your ${selectedPlan.name} plan is active. Thank you!`);
            } else if (result === "failed") {
                Alert.alert("Payment failed", "No money was taken for this attempt. Please try again or use another payment method.");
            }
        } catch (err: any) {
            Alert.alert("Couldn't start payment", err.message || "Please try again.");
        } finally {
            setIsPaying(false);
        }
    };

    const styles = createStyles(theme);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={isDark ? "light" : "dark"} />
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerActionCircle} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.primary} />
                    </Pressable>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Subscription</Text>
                        <Text style={styles.headerSubtitle}>Your plan & billing</Text>
                    </View>
                </View>

                {isLoading && !info ? (
                    <LoadingState />
                ) : error || !info ? (
                    <ErrorState message={error || "Could not load your subscription."} onRetry={refetch} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                        {/* CURRENT STATUS */}
                        {(() => {
                            const { title, detail, icon } = describeState(info);
                            const color = stateColor[info.state];
                            return (
                                <View style={[styles.statusCard, { borderColor: color + "55", backgroundColor: color + "10" }]}>
                                    <View style={[styles.statusIcon, { backgroundColor: color + "22" }]}>
                                        <Ionicons name={icon} size={22} color={color} />
                                    </View>
                                    <View style={styles.statusText}>
                                        <Text style={styles.statusTitle}>{title}</Text>
                                        <Text style={styles.statusDetail}>{detail}</Text>
                                    </View>
                                </View>
                            );
                        })()}

                        {/* PLANS */}
                        <Text style={styles.sectionTitle}>{info.state === "active" ? "Your plan" : "Choose a plan"}</Text>
                        <View style={styles.plans}>
                            {info.plans.map((plan) => {
                                const isSelected = plan.code === selectedCode;
                                const saving = savingFor(plan);
                                const isCurrent = info.state === "active" && info.plan?.code === plan.code;
                                return (
                                    <Pressable
                                        key={plan.code}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isSelected }}
                                        style={[styles.planCard, isSelected && styles.planCardSelected]}
                                        onPress={() => setSelectedCode(plan.code)}>
                                        <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected && <View style={styles.radioDot} />}</View>
                                        <View style={styles.planText}>
                                            <View style={styles.planNameRow}>
                                                <Text style={styles.planName}>{plan.name}</Text>
                                                {saving > 0 && <Text style={styles.planBadge}>Save {formatRupee(saving)}</Text>}
                                                {isCurrent && <Text style={[styles.planBadge, styles.planBadgeCurrent]}>Current</Text>}
                                            </View>
                                            <Text style={styles.planHint}>
                                                {plan.duration_months > 1
                                                    ? `${formatRupee(plan.monthly_equivalent)}/month, billed yearly`
                                                    : "Billed every month"}
                                            </Text>
                                        </View>
                                        <View style={styles.planPrice}>
                                            <Text style={styles.planPriceValue}>{formatRupee(plan.price)}</Text>
                                            <Text style={styles.planPriceUnit}>/{plan.duration_months > 1 ? "year" : "month"}</Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* INCLUDED */}
                        <Text style={styles.sectionTitle}>Everything included</Text>
                        <View style={styles.included}>
                            {INCLUDED.map((item) => (
                                <View key={item.text} style={styles.includedRow}>
                                    <Ionicons name={item.icon} size={18} color={theme.accent} />
                                    <Text style={styles.includedText}>{item.text}</Text>
                                </View>
                            ))}
                        </View>

                        {selectedPlan && (
                            <Pressable
                                accessibilityRole="button"
                                style={({ pressed }) => [styles.cta, (pressed || isPaying) && { opacity: 0.85 }]}
                                onPress={handleContinue}
                                disabled={isPaying}>
                                {isPaying ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.ctaText}>
                                        {info.state === "active" && info.plan?.code === selectedPlan.code ? "Extend" : "Continue with"} {selectedPlan.name} ·{" "}
                                        {formatRupee(selectedPlan.price)}
                                    </Text>
                                )}
                            </Pressable>
                        )}
                        {info.state === "active" && (
                            <Text style={styles.finePrint}>Paying now adds to your current plan - it starts when this one ends.</Text>
                        )}
                        {invoices && invoices.length > 0 && (
                            <>
                                <Text style={styles.sectionTitle}>Payment history</Text>
                                <View style={styles.included}>
                                    {invoices.map((invoice) => (
                                        <View key={invoice.id} style={styles.invoiceRow}>
                                            <View style={styles.invoiceText}>
                                                <Text style={styles.invoicePlan}>{invoice.plan} plan</Text>
                                                <Text style={styles.invoiceMeta}>
                                                    {formatSubscriptionDate(invoice.paid_at)} · {invoice.invoice_number}
                                                </Text>
                                            </View>
                                            <Text style={styles.invoiceAmount}>{formatRupee(invoice.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

                        <Text style={styles.finePrint}>Your data is never deleted. If your plan ends, you can still view everything and pick up where you left off.</Text>
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
        headerSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 8,
        },
        statusCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: 1,
            borderRadius: RADIUS.md,
            padding: 16,
        },
        statusIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
        },
        statusText: {
            flex: 1,
        },
        statusTitle: {
            fontFamily: "sans-bold",
            fontSize: 16,
            color: theme.primary,
        },
        statusDetail: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            lineHeight: 18,
            marginTop: 2,
        },
        sectionTitle: {
            fontFamily: "sans-bold",
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginTop: 24,
            marginBottom: 10,
        },
        plans: {
            gap: 10,
        },
        planCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: theme.card,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderRadius: RADIUS.md,
            padding: 16,
        },
        planCardSelected: {
            borderColor: theme.accent,
            backgroundColor: theme.accent + "0D",
        },
        radio: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
        },
        radioSelected: {
            borderColor: theme.accent,
        },
        radioDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.accent,
        },
        planText: {
            flex: 1,
        },
        planNameRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
        },
        planName: {
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
        },
        planBadge: {
            fontFamily: "sans-bold",
            fontSize: 10,
            color: theme.success,
            backgroundColor: theme.success + "18",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            overflow: "hidden",
            textTransform: "uppercase",
        },
        planBadgeCurrent: {
            color: theme.accent,
            backgroundColor: theme.accent + "18",
        },
        planHint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        planPrice: {
            alignItems: "flex-end",
        },
        planPriceValue: {
            fontFamily: "sans-extrabold",
            fontSize: 17,
            color: theme.primary,
        },
        planPriceUnit: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
        },
        included: {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: RADIUS.md,
            padding: 16,
            gap: 12,
        },
        includedRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        includedText: {
            flex: 1,
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.primary,
        },
        invoiceRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        invoiceText: {
            flex: 1,
        },
        invoicePlan: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        invoiceMeta: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 1,
        },
        invoiceAmount: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        cta: {
            backgroundColor: theme.accent,
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 24,
        },
        ctaText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
        finePrint: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: "center",
            lineHeight: 17,
            marginTop: 14,
        },
    });
