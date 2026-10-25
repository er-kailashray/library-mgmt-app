import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { clearAttendanceApi, getAttendanceRosterApi, markAttendanceApi } from "@/features/attendance/logic/attendance-api";
import { AttendanceBatch, AttendanceMember, AttendanceStatus } from "@/features/attendance/types/attendance.types";
import { formatTime } from "@/features/batches/logic/batch-time";
import { BatchTimeWheelPicker } from "@/features/batches/ui/BatchTimeWheelPicker";
import { RADIUS } from "@/shared/constants/layout";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { DateField } from "@/shared/ui/DateField";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text, TextInput } from "@/shared/ui/Text";
import { addDays, formatShortDate, todayIso } from "@/shared/utils/dates";

/** The batch to open on: the one running now, else the next one still to finish, else the first. */
function defaultBatchId(batches: AttendanceBatch[]): number | null {
    return (batches.find((b) => b.is_running) ?? batches.find((b) => !b.has_ended) ?? batches[0])?.batch_id ?? null;
}

/** "Wednesday, 24 October" */
function formatDayLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

type TimeRequest = { memberId: number; initial: string; title: string };

export function AttendanceScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme);
    const today = todayIso();

    const [date, setDate] = useState(today);
    const { data: roster, isLoading, error, refetch } = useApiData(() => getAttendanceRosterApi(date), [date]);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const batches = roster?.batches ?? [];
    // A tapped batch belongs to the day it was tapped on; any other day (or first load) opens on
    // the batch that's running, or the next one.
    const [picked, setPicked] = useState<{ date: string; batchId: number } | null>(null);
    const batchId =
        picked && picked.date === roster?.date && batches.some((b) => b.batch_id === picked.batchId) ? picked.batchId : defaultBatchId(batches);
    const setBatchId = (id: number) => roster && setPicked({ date: roster.date, batchId: id });

    const batch = batches.find((b) => b.batch_id === batchId) ?? null;
    const isToday = date === today;
    const editableFrom = roster?.editable_from ?? addDays(today, -6);

    const [search, setSearch] = useState("");
    const query = search.trim().toLowerCase();
    const members = useMemo(
        () => (batch?.members ?? []).filter((m) => !query || m.name.toLowerCase().includes(query) || String(m.seat_number ?? "") === query),
        [batch, query]
    );

    // ---------------------------------------------------------------- actions
    const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
    const [timeRequest, setTimeRequest] = useState<TimeRequest | null>(null);

    const mark = async (memberId: number, status: AttendanceStatus, checkInAt?: string) => {
        if (!batch) return;
        try {
            setBusyMemberId(memberId);
            await markAttendanceApi({ member_id: memberId, batch_id: batch.batch_id, date, status, ...(checkInAt ? { check_in_at: checkInAt } : {}) });
            await refetch();
        } catch (err: any) {
            Alert.alert("Couldn't save", err.message || "Please try again.");
        } finally {
            setBusyMemberId(null);
        }
    };

    const undo = async (memberId: number) => {
        if (!batch) return;
        try {
            setBusyMemberId(memberId);
            await clearAttendanceApi({ member_id: memberId, batch_id: batch.batch_id, date });
            await refetch();
        } catch (err: any) {
            Alert.alert("Couldn't undo", err.message || "Please try again.");
        } finally {
            setBusyMemberId(null);
        }
    };

    // Today the time is "now"; for an earlier day, ask when they came (starting at the batch's start).
    const checkIn = (memberId: number, name: string) => {
        if (!batch) return;
        if (isToday) void mark(memberId, "present");
        else setTimeRequest({ memberId, initial: batch.start_time, title: `${name} came at` });
    };

    const openMenu = (member: { member_id: number; name: string; check_in_at: string | null }, seated: boolean) => {
        Alert.alert(member.name, member.check_in_at ? `Came at ${formatTime(member.check_in_at)}` : undefined, [
            { text: "Change time", onPress: () => setTimeRequest({ memberId: member.member_id, initial: member.check_in_at ?? batch?.start_time ?? "09:00", title: `${member.name} came at` }) },
            ...(seated ? [{ text: "Mark absent", onPress: () => void mark(member.member_id, "absent") }] : []),
            { text: "Undo", style: "destructive" as const, onPress: () => void undo(member.member_id) },
            { text: "Cancel", style: "cancel" as const },
        ]);
    };

    // ---------------------------------------------------------------- rows
    const renderMember = ({ item }: { item: AttendanceMember }) => {
        const busy = busyMemberId === item.member_id;
        return (
            <View style={styles.row}>
                <View style={styles.seatBadge}>
                    <Text style={styles.seatBadgeLabel}>SEAT</Text>
                    <Text style={styles.seatBadgeNumber} numberOfLines={1} adjustsFontSizeToFit>
                        {item.seat_number ?? "–"}
                    </Text>
                </View>
                <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.status === "present" && item.check_in_at && <Text style={[styles.rowMeta, { color: theme.success }]}>In {formatTime(item.check_in_at)}</Text>}
                    {item.status === "present" && !item.check_in_at && <Text style={[styles.rowMeta, { color: theme.success }]}>Present</Text>}
                    {item.elsewhere && (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                            Came in {item.elsewhere.batch_name}
                            {item.elsewhere.check_in_at ? ` · ${formatTime(item.elsewhere.check_in_at)}` : ""}
                        </Text>
                    )}
                    {item.status === "absent" && <Text style={[styles.rowMeta, { color: theme.destructive }]}>{item.auto_absent ? "Absent · didn't check in" : "Absent"}</Text>}
                </View>
                {busy ? (
                    <ActivityIndicator color={theme.accent} />
                ) : item.status === "present" || (item.status === "absent" && !item.auto_absent) ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${item.name}`} style={styles.moreButton} onPress={() => openMenu(item, true)} hitSlop={6}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={theme.primary} />
                    </Pressable>
                ) : item.elsewhere ? null : (
                    <Pressable
                        accessibilityRole="button"
                        style={[styles.checkInButton, item.status === "absent" && styles.checkInButtonLate]}
                        onPress={() => checkIn(item.member_id, item.name)}>
                        <Text style={[styles.checkInText, item.status === "absent" && styles.checkInTextLate]}>Check in</Text>
                    </Pressable>
                )}
            </View>
        );
    };

    // ---------------------------------------------------------------- header (date, batches, counts, search)
    const enrolled = batch?.members.length ?? 0;
    const absentCount = batch?.members.filter((m) => m.status === "absent").length ?? 0;
    const elsewhereCount = batch?.members.filter((m) => m.elsewhere).length ?? 0;
    const notYetCount = batch?.members.filter((m) => !m.status && !m.elsewhere).length ?? 0;
    const counts = [
        { key: "in", label: "Checked in", value: batch?.present_count ?? 0, color: theme.success },
        { key: "wait", label: "Not yet", value: notYetCount, color: theme.primary },
        { key: "absent", label: "Absent", value: absentCount, color: theme.destructive },
    ];
    const extras = [
        batch && batch.visitors.length > 0 ? `+${batch.visitors.length} from other batches` : null,
        elsewhereCount > 0 ? `${elsewhereCount} went to another batch` : null,
    ].filter(Boolean);
    const header = (
        <View>
            <DateField
                value={date}
                onChange={(picked) => {
                    setDate(picked);
                    setSearch("");
                }}
                minDate={editableFrom}
                maxDate={today}
                sheetTitle="Attendance date"
                note={isToday ? undefined : "Times for earlier days are entered by hand"}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchScroll} contentContainerStyle={styles.batchRow}>
                {batches.map((b) => {
                    const selected = b.batch_id === batchId;
                    return (
                        <Pressable
                            key={b.batch_id}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                            style={[styles.batchPill, selected && styles.batchPillSelected]}
                            onPress={() => {
                                setBatchId(b.batch_id);
                                setSearch("");
                            }}>
                            <View style={styles.batchPillTop}>
                                <Text style={[styles.batchPillName, selected && styles.batchPillTextSelected]} numberOfLines={1}>
                                    {b.batch_name}
                                </Text>
                                {isToday && b.is_running && (
                                    <View style={[styles.nowBadge, selected && styles.nowBadgeSelected]}>
                                        <Text style={[styles.nowBadgeText, selected && styles.nowBadgeTextSelected]}>NOW</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.batchPillTime, selected && styles.batchPillTextSelected]}>
                                {formatTime(b.start_time)} – {formatTime(b.end_time)}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Where the batch stands: three counts instead of a progress bar. A zero stays grey. */}
            {batch && enrolled > 0 && (
                <>
                    <View style={styles.countRow}>
                        {counts.map((c) => (
                            <View key={c.key} style={styles.countTile}>
                                <Text style={[styles.countValue, { color: c.value > 0 ? c.color : theme.mutedForeground + "99" }]}>{c.value}</Text>
                                <Text style={styles.countLabel}>{c.label}</Text>
                            </View>
                        ))}
                    </View>
                    {extras.length > 0 && <Text style={styles.countExtras}>{extras.join(" · ")}</Text>}
                </>
            )}

            {enrolled > 0 && (
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color={theme.mutedForeground} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name or seat number"
                        placeholderTextColor={theme.mutedForeground + "80"}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {!!search && (
                        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );

    // ---------------------------------------------------------------- footer (people from other batches)
    // Only shown for check-ins recorded against another batch; students are normally checked in from
    // their own batch at whatever time they come, and the time shows when that was.
    const footer = batch && batch.visitors.length > 0 ? (
        <View style={styles.visitorsBlock}>
            {batch.visitors.length > 0 && (
                <View style={styles.visitorsCard}>
                    <Text style={styles.visitorsTitle}>From other batches</Text>
                    {batch.visitors.map((v, index) => (
                        <View key={v.member_id} style={[styles.visitorRow, index > 0 && styles.visitorRowBorder]}>
                            <Ionicons name="swap-horizontal" size={16} color={theme.mutedForeground} />
                            <Text style={styles.rowName} numberOfLines={1}>
                                {v.name}
                            </Text>
                            <Text style={[styles.rowMeta, styles.visitorTime]}>{v.check_in_at ? `In ${formatTime(v.check_in_at)}` : "Present"}</Text>
                            {busyMemberId === v.member_id ? (
                                <ActivityIndicator color={theme.accent} />
                            ) : (
                                <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${v.name}`} style={styles.moreButton} onPress={() => openMenu(v, false)} hitSlop={6}>
                                    <Ionicons name="ellipsis-horizontal" size={18} color={theme.primary} />
                                </Pressable>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    ) : null;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Attendance" subtitle={formatDayLabel(date)} />

                {isLoading && !roster ? (
                    <LoadingState />
                ) : error || !roster ? (
                    <ErrorState message={error || "Couldn't load attendance."} onRetry={refetch} />
                ) : batches.length === 0 ? (
                    <EmptyState
                        icon="calendar-outline"
                        title="No batches yet"
                        subtitle="Set up a batch first to start tracking attendance."
                        actionLabel="Set up a batch"
                        onAction={() => router.push("/batches")}
                    />
                ) : (
                    <FlashList
                        style={styles.list}
                        data={members}
                        keyExtractor={(m) => String(m.member_id)}
                        renderItem={renderMember}
                        ListHeaderComponent={header}
                        ListFooterComponent={footer ?? undefined}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>{enrolled === 0 ? "No one is seated in this batch yet." : "No one matches that search."}</Text>
                        }
                        contentContainerStyle={[styles.listContent, { paddingBottom: 40 + insets.bottom }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Arrival time for an earlier day, or a correction */}
                <Modal visible={!!timeRequest} transparent animationType="slide" onRequestClose={() => setTimeRequest(null)} statusBarTranslucent navigationBarTranslucent>
                    <SafeAreaProvider>
                        <SheetFrame onClose={() => setTimeRequest(null)}>
                            {timeRequest && (
                                <BatchTimeWheelPicker
                                    title={timeRequest.title}
                                    initialValue={timeRequest.initial}
                                    minuteStep={5}
                                    onCancel={() => setTimeRequest(null)}
                                    onDone={(time) => {
                                        const memberId = timeRequest.memberId;
                                        setTimeRequest(null);
                                        void mark(memberId, "present", time);
                                    }}
                                />
                            )}
                        </SheetFrame>
                    </SafeAreaProvider>
                </Modal>

            </SafeAreaView>
        </ScreenBackground>
    );
}

/** Bottom sheet frame for the time picker. */
function SheetFrame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const insets = useSafeAreaInsets();
    return (
        <View style={styles.sheetRoot}>
            <Pressable style={styles.sheetOverlay} onPress={onClose} />
            <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>{children}</View>
        </View>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        list: {
            flex: 1,
        },
        listContent: {
            paddingHorizontal: 20,
            paddingTop: 24,
        },
        batchScroll: {
            flexGrow: 0,
            flexShrink: 0,
            marginTop: 14,
            marginHorizontal: -20,
        },
        batchRow: {
            paddingHorizontal: 20,
            gap: 10,
        },
        batchPill: {
            minWidth: 130,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        batchPillSelected: {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
        },
        batchPillTop: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        batchPillName: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
            flexShrink: 1,
        },
        batchPillTime: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        batchPillTextSelected: {
            color: "#fff",
        },
        nowBadge: {
            backgroundColor: theme.success + "22",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 1,
        },
        nowBadgeSelected: {
            backgroundColor: "rgba(255,255,255,0.25)",
        },
        nowBadgeText: {
            fontFamily: "sans-extrabold",
            fontSize: 10,
            color: theme.success,
        },
        nowBadgeTextSelected: {
            color: "#fff",
        },
        countRow: {
            flexDirection: "row",
            gap: 10,
            marginTop: 14,
        },
        countTile: {
            flex: 1,
            alignItems: "center",
            paddingVertical: 12,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        countValue: {
            fontFamily: "sans-extrabold",
            fontSize: 22,
        },
        countLabel: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        countExtras: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: "center",
            marginTop: 8,
        },
        searchBar: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            marginBottom: 8,
            paddingHorizontal: 14,
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        searchInput: {
            flex: 1,
            fontFamily: "sans-medium",
            fontSize: 15,
            color: theme.primary,
            paddingVertical: 12,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
        },
        seatBadge: {
            width: 44,
            height: 44,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
        },
        seatBadgeLabel: {
            fontFamily: "sans-bold",
            fontSize: 7,
            letterSpacing: 1.2,
            color: "rgba(255,255,255,0.8)",
        },
        seatBadgeNumber: {
            fontFamily: "sans-extrabold",
            fontSize: 17,
            color: "#fff",
            marginTop: -2,
        },
        rowText: {
            flex: 1,
            gap: 2,
        },
        rowName: {
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
            flexShrink: 1,
        },
        rowMeta: {
            fontFamily: "sans-semibold",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        checkInButton: {
            backgroundColor: theme.accent,
            borderRadius: RADIUS.sm,
            paddingHorizontal: 14,
            paddingVertical: 9,
        },
        checkInButtonLate: {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: theme.accent,
        },
        checkInText: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: "#fff",
        },
        checkInTextLate: {
            color: theme.accent,
        },
        moreButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        emptyText: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
            textAlign: "center",
            paddingVertical: 24,
        },
        visitorsBlock: {
            marginTop: 20,
            gap: 12,
        },
        visitorsCard: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            paddingHorizontal: 14,
            paddingTop: 12,
        },
        visitorsTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: theme.primary,
            paddingBottom: 8,
        },
        visitorRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 10,
        },
        visitorRowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
        },
        visitorTime: {
            marginLeft: "auto",
            color: theme.success,
        },
        sheetRoot: {
            flex: 1,
        },
        sheetOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        sheet: {
            backgroundColor: theme.background,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
            paddingHorizontal: 20,
            paddingTop: 20,
        },
    });
