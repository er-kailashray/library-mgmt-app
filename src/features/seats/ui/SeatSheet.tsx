import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { batchTimeLabel, blockSummary, seatLabel } from "@/features/seats/logic/seat-display";
import { MatrixBatchRef, SeatBlock, SeatMatrixSeat, SeatOccupant } from "@/features/seats/types/seats.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Text } from "@/shared/ui/Text";
import { formatShortDate, todayIso } from "@/shared/utils/dates";

interface SeatSheetProps {
    seat: SeatMatrixSeat | null;
    batches: MatrixBatchRef[];
    /** The batch the map is showing, highlighted in the list; null for "All batches". */
    focusBatchId: number | null;
    onClose: () => void;
    onOpenMember: (memberId: number) => void;
    onAdmit: (batchId: number, seatId: number) => void;
    /** Move the member sitting here (in this batch) to another seat. */
    onMove: (batchId: number, batchName: string, seat: SeatMatrixSeat, occupant: SeatOccupant) => void;
    /** Take this seat out of use for a while (opens the block form). */
    onBlock: (seat: SeatMatrixSeat) => void;
    /** Put a blocked seat back in use, or drop a block that hasn't started. */
    onUnblock: (block: SeatBlock, seat: SeatMatrixSeat) => void;
    /** After the sheet has slid away, e.g. to open the seat picker next. */
    onClosed?: () => void;
}

/**
 * One seat across every batch: who sits there (tap through to their profile, or move them to
 * another seat), whether it's blocked (and unblocking it), or, where it's free, a one-tap "Admit"
 * that opens admission with this seat and batch already chosen. "Block seat" takes it out of use.
 */
export function SeatSheet({ seat: openSeat, batches, focusBatchId, onClose, onOpenMember, onAdmit, onMove, onBlock, onUnblock, onClosed }: SeatSheetProps) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    // Keep showing the last seat while the sheet slides away after `seat` is cleared.
    const lastSeat = useRef(openSeat);
    if (openSeat) lastSeat.current = openSeat;
    const seat = openSeat ?? lastSeat.current;

    const rows = seat?.batches ?? [];
    const free = rows.filter((b) => b.available).length;
    const blockedNow = rows.filter((b) => b.blocked).length;
    const today = todayIso();
    // Set up ahead: not in force yet, so no batch row shows them.
    const scheduled = (seat?.blocks ?? []).filter((block) => block.starts_on > today);
    // Something left to block: a batch that's neither taken nor already blocked.
    const canBlock = rows.some((b) => !b.occupant && !b.blocked);

    return (
        <BottomSheet
            visible={!!openSeat}
            onClose={onClose}
            onClosed={onClosed}
            title={seat ? seatLabel(seat.seat_number) : ""}
            subtitle={
                rows.length === 0
                    ? "No batches yet"
                    : blockedNow === rows.length
                      ? "Blocked in every batch"
                      : free === 0
                        ? "Taken in every batch"
                        : free === rows.length
                          ? "Free in every batch"
                          : `Free in ${free} of ${rows.length} batches`
            }
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
                            {row.blocked ? (
                                <View style={styles.blocked}>
                                    <View style={styles.blockedText}>
                                        <View style={styles.blockedTitleRow}>
                                            <Ionicons name="lock-closed" size={12} color={theme.mutedForeground} />
                                            <Text style={styles.blockedTitle}>Blocked</Text>
                                        </View>
                                        <Text style={styles.occupantMeta} numberOfLines={1}>
                                            {blockSummary(row.blocked, today)}
                                        </Text>
                                    </View>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Unblock ${seat ? seatLabel(seat.seat_number) : "seat"}${row.blocked.all_batches ? " in every batch" : ` in ${row.batch_name}`}`}
                                        style={({ pressed }) => [styles.unblockPill, pressed && styles.pressed]}
                                        onPress={() => seat && row.blocked && onUnblock(row.blocked, seat)}
                                    >
                                        <Text style={styles.unblockText}>Unblock</Text>
                                    </Pressable>
                                </View>
                            ) : row.available || !occupant ? (
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
                            {!row.available && occupant && seat && (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Move ${occupant.name ?? "member"} to another seat`}
                                    style={({ pressed }) => [styles.moveBtn, pressed && styles.pressed]}
                                    onPress={() => onMove(row.batch_id, row.batch_name, seat, occupant)}
                                    hitSlop={6}
                                >
                                    <Ionicons name="swap-horizontal" size={16} color={theme.primary} />
                                </Pressable>
                            )}
                        </View>
                    );
                })}
            </View>

            {scheduled.length > 0 && (
                <View style={styles.scheduled}>
                    <Text style={styles.scheduledLabel}>Blocks coming up</Text>
                    {scheduled.map((block) => (
                        <View key={block.id} style={styles.scheduledRow}>
                            <Ionicons name="calendar-outline" size={15} color={theme.mutedForeground} />
                            <Text style={styles.scheduledText} numberOfLines={2}>
                                {blockSummary(block, today)} · {block.all_batches ? "all batches" : (rows.find((r) => r.batch_id === block.batch_id)?.batch_name ?? "one batch")}
                            </Text>
                            <Pressable accessibilityRole="button" accessibilityLabel="Remove this block" hitSlop={8} onPress={() => seat && onUnblock(block, seat)}>
                                <Text style={styles.removeText}>Remove</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}

            {canBlock && seat && (
                <Pressable accessibilityRole="button" style={({ pressed }) => [styles.blockBtn, pressed && styles.pressed]} onPress={() => onBlock(seat)}>
                    <Ionicons name="lock-closed-outline" size={15} color={theme.primary} />
                    <Text style={styles.blockBtnText}>Block seat for a while</Text>
                </Pressable>
            )}
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
        blocked: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            maxWidth: "62%",
        },
        blockedText: {
            alignItems: "flex-end",
            flexShrink: 1,
        },
        blockedTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        blockedTitle: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        unblockPill: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
        },
        unblockText: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.primary,
        },
        scheduled: {
            marginTop: 14,
            gap: 8,
        },
        scheduledLabel: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        scheduledRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        scheduledText: {
            flex: 1,
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.primary,
        },
        removeText: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.destructive,
        },
        blockBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 14,
            paddingVertical: 12,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
        },
        blockBtnText: {
            fontFamily: "sans-semibold",
            fontSize: 14,
            color: theme.primary,
        },
        moveBtn: {
            width: 34,
            height: 34,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
            alignItems: "center",
            justifyContent: "center",
        },
        pressed: {
            opacity: 0.7,
        },
    });
