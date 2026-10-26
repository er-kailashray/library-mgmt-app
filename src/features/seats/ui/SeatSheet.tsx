import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { batchTimeLabel, seatLabel } from "@/features/seats/logic/seat-display";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
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
export function SeatSheet({ seat: openSeat, batches, focusBatchId, onClose, onOpenMember, onAdmit }: SeatSheetProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    // Keep showing the last seat while the sheet slides away after `seat` is cleared.
    const lastSeat = useRef(openSeat);
    if (openSeat) lastSeat.current = openSeat;
    const seat = openSeat ?? lastSeat.current;

    const rows = seat?.batches ?? [];
    const free = rows.filter((b) => b.available).length;

    return (
        <BottomSheet
            visible={!!openSeat}
            onClose={onClose}
            title={seat ? seatLabel(seat.seat_number) : ""}
            subtitle={rows.length === 0 ? "No batches yet" : free === 0 ? "Taken in every batch" : free === rows.length ? "Free in every batch" : `Free in ${free} of ${rows.length} batches`}
            showClose
        >
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
        </BottomSheet>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
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
