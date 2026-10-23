import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatSubscriptionDate, getSubscriptionApi } from "@/features/subscription/logic/subscription-api";
import { SUBSCRIPTION_NUDGE_DAYS, SubscriptionInfo } from "@/features/subscription/types/subscription.types";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";

/** What to tell the owner, or null when there's nothing worth interrupting Home for. */
function bannerFor(info: SubscriptionInfo, theme: any): { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; detail: string } | null {
    const days = `${info.days_left} day${info.days_left === 1 ? "" : "s"}`;
    switch (info.state) {
        case "trial":
            return info.days_left <= SUBSCRIPTION_NUDGE_DAYS
                ? { icon: "gift-outline", color: theme.accent, title: `Free trial ends in ${days}`, detail: `On ${formatSubscriptionDate(info.ends_at)} · choose a plan to keep going` }
                : null;
        case "active":
            return info.days_left <= SUBSCRIPTION_NUDGE_DAYS
                ? { icon: "refresh-outline", color: theme.accent, title: `${info.plan?.name ?? "Your"} plan ends in ${days}`, detail: "Renew to keep full access" }
                : null;
        case "grace":
            return { icon: "time-outline", color: theme.warning, title: "Your plan has ended", detail: `Full access for ${days} more, then read-only` };
        case "expired":
            return { icon: "lock-closed-outline", color: theme.destructive, title: "Read-only mode", detail: "Subscribe to add members, record payments and more" };
    }
}

/** Home-screen nudge shown near the end of a trial/plan, during grace, and once expired. */
export function SubscriptionBanner() {
    const router = useRouter();
    const { theme } = useTheme();
    const { data: info, refetch } = useApiData(getSubscriptionApi, []);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const banner = info ? bannerFor(info, theme) : null;
    if (!banner) return null;

    const styles = createStyles(theme);
    return (
        <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.banner, { borderColor: banner.color + "55", backgroundColor: banner.color + "12" }, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/subscription")}>
            <View style={[styles.icon, { backgroundColor: banner.color + "22" }]}>
                <Ionicons name={banner.icon} size={18} color={banner.color} />
            </View>
            <View style={styles.text}>
                <Text style={styles.title}>{banner.title}</Text>
                <Text style={styles.detail}>{banner.detail}</Text>
            </View>
            <Text style={[styles.action, { color: banner.color }]}>{info?.state === "active" ? "Renew" : "Plans"}</Text>
            <Ionicons name="chevron-forward" size={16} color={banner.color} />
        </Pressable>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        banner: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderRadius: RADIUS.md,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 20,
        },
        icon: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
        },
        text: {
            flex: 1,
        },
        title: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        detail: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 1,
        },
        action: {
            fontFamily: "sans-bold",
            fontSize: 13,
        },
    });
