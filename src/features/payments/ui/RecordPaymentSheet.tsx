import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { getMembersApi } from "@/features/members/logic/members.api";
import { Member } from "@/features/members/types/members.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
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
        <BottomSheet visible={visible} onClose={onClose} title="Record payment" subtitle="Who paid? Members who owe are at the top." showClose bottomPadding={12}>
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
        </BottomSheet>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
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
