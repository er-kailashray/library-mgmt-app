import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { Text, TextInput } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";
import { formatShortDate } from "@/shared/utils/dates";

/**
 * "Record payment": pick who paid. Members who owe come first, with what they owe. Picking one
 * opens their page with the payment sheet, which works out the period the payment covers.
 */
export function RecordPaymentSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (member: Member) => void }) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);

    const [members, setMembers] = useState<Member[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!visible) return;
        setQuery("");
        setError(null);
        let cancelled = false;
        getMembersApi()
            // Members who left have no seat to pay for; they settle up when readmitted.
            .then((response) => !cancelled && setMembers((response.data ?? []).filter((m) => m.status === "active")))
            .catch((err: any) => !cancelled && setError(err.message || "Couldn't load members."));
        return () => {
            cancelled = true;
        };
    }, [visible]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (members ?? [])
            .filter((m) => !q || m.name.toLowerCase().includes(q) || m.phone.includes(q))
            .sort((a, b) => (b.due_amount ?? 0) - (a.due_amount ?? 0) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    }, [members, query]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>Record payment</Text>
                            <Text style={styles.subtitle}>Who paid? Members who owe are at the top.</Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={20} color={theme.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={theme.mutedForeground} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Name or phone"
                            placeholderTextColor={theme.mutedForeground + "99"}
                            value={query}
                            onChangeText={setQuery}
                            autoCorrect={false}
                        />
                    </View>

                    {members === null && !error ? (
                        <ActivityIndicator color={theme.accent} style={styles.spinner} />
                    ) : error ? (
                        <Text style={styles.note}>{error}</Text>
                    ) : (
                        <FlatList
                            data={shown}
                            keyExtractor={(m) => String(m.id)}
                            style={styles.list}
                            keyboardShouldPersistTaps="handled"
                            ItemSeparatorComponent={() => <View style={styles.divider} />}
                            ListEmptyComponent={<Text style={styles.note}>{members?.length ? "Nobody matches that." : "No active members yet."}</Text>}
                            renderItem={({ item }) => {
                                const owes = (item.due_amount ?? 0) > 0;
                                return (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`${item.name}${owes ? `, owes ${formatRupee(item.due_amount ?? 0)}` : ""}`}
                                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                                        onPress={() => onPick(item)}
                                    >
                                        <MemberAvatar id={item.id} name={item.name} size={38} />
                                        <View style={styles.rowText}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={styles.meta} numberOfLines={1}>
                                                {item.next_renewal_date && !owes ? `Renews ${formatShortDate(item.next_renewal_date)}` : item.phone}
                                            </Text>
                                        </View>
                                        {owes ? (
                                            <Text style={styles.owes}>{formatRupee(item.due_amount ?? 0)}</Text>
                                        ) : (
                                            <Text style={styles.paidUp}>Paid up</Text>
                                        )}
                                    </Pressable>
                                );
                            }}
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: "flex-end",
        },
        backdrop: {
            ...StyleSheet.absoluteFill,
            backgroundColor: "rgba(0,0,0,0.45)",
        },
        sheet: {
            maxHeight: "80%",
            backgroundColor: theme.background,
            borderTopLeftRadius: RADIUS.lg + 4,
            borderTopRightRadius: RADIUS.lg + 4,
            paddingHorizontal: 20,
            paddingTop: 10,
            ...FLOATING_SHADOW,
        },
        handle: {
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.mutedForeground + "55",
            marginBottom: 14,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 14,
        },
        headerText: {
            flex: 1,
        },
        title: {
            fontFamily: "sans-bold",
            fontSize: 20,
            color: theme.primary,
        },
        subtitle: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
        },
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 8,
        },
        searchInput: {
            flex: 1,
            height: "100%",
            fontFamily: "sans-regular",
            fontSize: 15,
            color: theme.primary,
        },
        list: {
            flexGrow: 0,
        },
        spinner: {
            marginVertical: 32,
        },
        note: {
            fontFamily: "sans-regular",
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: "center",
            marginVertical: 28,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 11,
        },
        rowPressed: {
            opacity: 0.7,
        },
        divider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.mutedForeground + "33",
            marginLeft: 50,
        },
        rowText: {
            flex: 1,
        },
        name: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        meta: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        owes: {
            fontFamily: "sans-semibold",
            fontSize: 14,
            color: theme.destructive,
        },
        paidUp: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
    });
