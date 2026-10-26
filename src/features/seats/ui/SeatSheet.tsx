import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { batchTimeLabel, seatLabel } from "@/features/seats/logic/seat-display";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";
import { formatShortDate } from "@/shared/utils/dates";

interface SeatSheetProps {
    seat: SeatMatrixSeat | null;
    batches: MatrixBatchRef[];
    /** The batch the map is showing, highlighted in the list; null for "All batches". */
    focusBatchId: number | null;
    onClose: () => void;
    onOpenMember: (memberId: number) => void;
    onAdmit: (batchId: number, seatId: number) => void;
}

/**
 * One seat across every batch: who sits there (tap through to their profile) or, where it's
 * free, a one-tap "Admit" that opens admission with this seat and batch already chosen.
 */
export function SeatSheet({ seat, batches, focusBatchId, onClose, onOpenMember, onAdmit }: SeatSheetProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);

    const rows = seat?.batches ?? [];
    const free = rows.filter((b) => b.available).length;

    return (
        <Modal visible={!!seat} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>{seat ? seatLabel(seat.seat_number) : ""}</Text>
                            <Text style={styles.subtitle}>
                                {rows.length === 0 ? "No batches yet" : free === 0 ? "Taken in every batch" : free === rows.length ? "Free in every batch" : `Free in ${free} of ${rows.length} batches`}
                            </Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={20} color={theme.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.list}>
                        {rows.map((row, index) => {
                            const batch = batches.find((b) => b.id === row.batch_id);
                            const occupant = row.occupant;
                            const focused = focusBatchId === row.batch_id;
                            return (
                                <View key={row.batch_id} style={[styles.row, index > 0 && styles.rowDivider, focused && styles.rowFocused]}>
                                    <View style={styles.rowText}>
                                        <Text style={styles.batchName}>{row.batch_name}</Text>
                                        {batch && <Text style={styles.batchTime}>{batchTimeLabel(batch)}</Text>}
                                    </View>
                                    {row.available || !occupant ? (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={`Admit someone to ${seat ? seatLabel(seat.seat_number) : "this seat"} in ${row.batch_name}`}
                                            style={({ pressed }) => [styles.admitBtn, pressed && styles.pressed]}
                                            onPress={() => seat && onAdmit(row.batch_id, seat.seat_id)}
                                        >
                                            <Text style={styles.freeText}>Free</Text>
                                            <View style={styles.admitPill}>
                                                <Ionicons name="add" size={14} color="#fff" />
                                                <Text style={styles.admitText}>Admit</Text>
                                            </View>
                                        </Pressable>
                                    ) : (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={`Open ${occupant.name ?? "member"}'s profile`}
                                            style={({ pressed }) => [styles.occupant, pressed && styles.pressed]}
                                            onPress={() => onOpenMember(occupant.member_id)}
                                        >
                                            <View style={styles.occupantText}>
                                                <Text style={styles.occupantName} numberOfLines={1}>
                                                    {occupant.name ?? "Member"}
                                                </Text>
                                                <Text style={[styles.occupantMeta, occupant.is_due && { color: theme.destructive }]}>
                                                    {occupant.is_due ? "Fee due" : `Renews ${formatShortDate(occupant.renewal_date)}`}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
                                        </Pressable>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>
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
            marginBottom: 16,
        },
        headerText: {
            flex: 1,
        },
        title: {
            fontFamily: "sans-bold",
            fontSize: 22,
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
        list: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: "hidden",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
        },
        rowDivider: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.mutedForeground + "33",
        },
        rowFocused: {
            backgroundColor: theme.accent + "0F",
        },
        rowText: {
            flex: 1,
        },
        batchName: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        batchTime: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        admitBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        freeText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.success,
        },
        admitPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent,
        },
        admitText: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: "#fff",
        },
        occupant: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            maxWidth: "58%",
        },
        occupantText: {
            alignItems: "flex-end",
            flexShrink: 1,
        },
        occupantName: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.primary,
        },
        occupantMeta: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        pressed: {
            opacity: 0.7,
        },
    });
