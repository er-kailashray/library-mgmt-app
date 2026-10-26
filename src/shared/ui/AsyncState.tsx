import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from "react-native";

import { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

export function LoadingState({ style }: { style?: StyleProp<ViewStyle> }) {
    const { theme } = useTheme();
    return <ActivityIndicator size="large" color={theme.accent} style={[styles.spacing, style]} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    const { theme } = useTheme();
    const s = createStyles(theme);
    return (
        <View style={[s.container, styles.spacing]}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.destructive} />
            <Text style={s.errorText}>{message}</Text>
            {onRetry && (
                <Pressable style={s.retryBtn} onPress={onRetry}>
                    <Text style={s.retryBtnText}>Retry</Text>
                </Pressable>
            )}
        </View>
    );
}

export function EmptyState({
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    const { theme } = useTheme();
    const s = createStyles(theme);
    return (
        <View style={[s.container, styles.spacing]}>
            <Ionicons name={icon} size={56} color={theme.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={s.emptyTitle}>{title}</Text>
            {subtitle ? <Text style={s.emptySubtitle}>{subtitle}</Text> : null}
            {!!actionLabel && onAction && (
                <Pressable style={s.retryBtn} onPress={onAction}>
                    <Text style={s.retryBtnText}>{actionLabel}</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = ScaledSheet.create({
    spacing: {
        marginTop: 40,
    },
});

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
        container: {
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
            gap: 4,
        },
        errorText: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.destructive,
            textAlign: "center",
            marginTop: 8,
        },
        retryBtn: {
            backgroundColor: theme.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 14,
            marginTop: 16,
        },
        retryBtnText: {
            ...BUTTON_TEXT,
            fontSize: 14,
            color: "#fff",
        },
        emptyTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 18,
            color: theme.primary,
            marginTop: 16,
            textAlign: "center",
        },
        emptySubtitle: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
            marginTop: 6,
            textAlign: "center",
            lineHeight: 20,
        },
    });
