import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, ScrollViewInstance, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { clearAttendanceApi, getAttendanceRosterApi, markAttendanceApi } from "@/features/attendance/logic/attendance-api";
import { AttendanceBatch, AttendanceMember, AttendanceRoster, AttendanceStatus, AttendanceVisitor } from "@/features/attendance/types/attendance.types";
import { formatTime, formatTimeRange } from "@/features/batches/logic/batch-time";
import { BatchSwitcher } from "@/features/batches/ui/BatchSwitcher";
import { BatchTimeWheelPicker } from "@/features/batches/ui/BatchTimeWheelPicker";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Text, TextInput } from "@/shared/ui/Text";
import { addDays, fromIsoDate, todayIso } from "@/shared/utils/dates";

type Filter = "pending" | "in" | "absent" | "all";
type TimeRequest = { memberId: number; initial: string; title: string };

/** One flat list: the batch's members in one rounded card, then a card of visitors from other batches. */
type ListItem =
    | { type: "member"; key: string; member: AttendanceMember; isFirst: boolean; isLast: boolean }
    | { type: "visitorsHeader"; key: string }
    | { type: "visitor"; key: string; visitor: AttendanceVisitor; isFirst: boolean; isLast: boolean };

const AVATAR_SIZE = 40;
const DAY_CHIP_WIDTH = 52;

/** The batch to open on: the one running now, else the next one still to finish, else the first. */
function defaultBatchId(batches: AttendanceBatch[]): number | null {
    return (batches.find((b) => b.is_running) ?? batches.find((b) => !b.has_ended) ?? batches[0])?.batch_id ?? null;
}

/** "HH:MM" now, for an instant check-in (the server records the same moment). */
function nowTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const isPending = (m: AttendanceMember) => !m.status && !m.elsewhere;

function matchesFilter(m: AttendanceMember, filter: Filter): boolean {
    switch (filter) {
        case "pending":
            return isPending(m);
        case "in":
            return m.status === "present";
        case "absent":
            return m.status === "absent";
        default:
            return true;
    }
}

/**
 * Attendance: pick a day (last 7) and a batch, see how many are in, and check people in with one
 * tap. Check-ins show straight away and save in the background; tapping a row offers the rest
 * (time, absent, undo, profile).
 */
export function AttendanceScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const today = todayIso();

    const [date, setDate] = useState(today);
    const { data: roster, isLoading, error, refetch, setData } = useApiData(() => getAttendanceRosterApi(date), [date]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    const batches = useMemo(() => roster?.batches ?? [], [roster]);
    // A tapped batch belongs to the day it was tapped on; any other day (or first load) opens on
    // the batch that's running, or the next one.
    const [picked, setPicked] = useState<{ date: string; batchId: number } | null>(null);
    const batchId =
        picked && picked.date === roster?.date && batches.some((b) => b.batch_id === picked.batchId) ? picked.batchId : defaultBatchId(batches);
    const batch = batches.find((b) => b.batch_id === batchId) ?? null;
    const isToday = date === today;
    // "Live": the batch is on right now - today's, or an overnight one that began yesterday and runs
    // past midnight. Live check-ins are one tap at the current time; otherwise a time is asked for.
    const isLive = isToday || !!batch?.is_running;

    // Open on the session that's on now, even when it belongs to yesterday (10 PM - 2 AM after
    // midnight), and come back to today once it's over - until the owner picks a day themselves.
    const pickedDayByHand = useRef(false);
    useEffect(() => {
        if (!roster || pickedDayByHand.current) return;
        const live = roster.live_session;
        if (live && live.date !== date) {
            setDate(live.date);
            setPicked({ date: live.date, batchId: live.batch_id });
        } else if (!live && date !== today) {
            setDate(today);
        }
    }, [roster, date, today]);
    const editableFrom = roster?.editable_from ?? addDays(today, -6);

    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const query = search.trim().toLowerCase();

    const selectBatch = (id: number) => {
        if (roster) setPicked({ date: roster.date, batchId: id });
        setSearch("");
    };
    const selectDay = (day: string) => {
        pickedDayByHand.current = true;
        setDate(day);
        setSearch("");
    };

    // ---------------------------------------------------------------- counts
    const all = batch?.members ?? [];
    const enrolled = all.length;
    const present = all.filter((m) => m.status === "present").length;
    const absent = all.filter((m) => m.status === "absent").length;
    const pending = all.filter(isPending).length;
    const elsewhere = all.filter((m) => m.elsewhere).length;
    const visitors = batch?.visitors ?? [];

    const items = useMemo((): ListItem[] => {
        const members = all.filter((m) => matchesFilter(m, filter) && (!query || m.name.toLowerCase().includes(query) || String(m.seat_number ?? "") === query));
        const rows: ListItem[] = members.map((member, index) => ({
            type: "member",
            key: `m-${member.member_id}`,
            member,
            isFirst: index === 0,
            isLast: index === members.length - 1,
        }));
        const shownVisitors = filter === "all" || filter === "in" ? visitors.filter((v) => !query || v.name.toLowerCase().includes(query)) : [];
        if (shownVisitors.length > 0) {
            rows.push({ type: "visitorsHeader", key: "visitors" });
            shownVisitors.forEach((visitor, index) =>
                rows.push({ type: "visitor", key: `v-${visitor.member_id}`, visitor, isFirst: index === 0, isLast: index === shownVisitors.length - 1 })
            );
        }
        return rows;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batch, filter, query]);

    // ---------------------------------------------------------------- actions
    const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
    const [timeRequest, setTimeRequest] = useState<TimeRequest | null>(null);

    /** Show a change on this batch's row at once; the server's answer replaces it after saving. */
    const patchMember = (memberId: number, changes: Partial<AttendanceMember>) => {
        if (!batch) return;
        setData((current: AttendanceRoster | null) =>
            current
                ? {
                      ...current,
                      batches: current.batches.map((b) =>
                          b.batch_id !== batch.batch_id
                              ? b
                              : (() => {
                                    const members = b.members.map((m) => (m.member_id === memberId ? { ...m, ...changes } : m));
                                    return { ...b, members, present_count: members.filter((m) => m.status === "present").length };
                                })()
                      ),
                  }
                : current
        );
    };

    const mark = async (memberId: number, status: AttendanceStatus, checkInAt?: string) => {
        if (!batch) return;
        // Today's check-in needs no wait: show it now, save behind it.
        const instant = status === "present" && !checkInAt;
        if (instant) patchMember(memberId, { status: "present", check_in_at: nowTime(), auto_absent: false });
        else setBusyMemberId(memberId);
        try {
            await markAttendanceApi({ member_id: memberId, batch_id: batch.batch_id, date, status, ...(checkInAt ? { check_in_at: checkInAt } : {}) });
        } catch (err: any) {
            Alert.alert("Couldn't save", err.message || "Please try again.");
        } finally {
            setBusyMemberId(null);
            void refetch();
        }
    };

    const undo = async (memberId: number) => {
        if (!batch) return;
        try {
            setBusyMemberId(memberId);
            await clearAttendanceApi({ member_id: memberId, batch_id: batch.batch_id, date });
        } catch (err: any) {
            Alert.alert("Couldn't undo", err.message || "Please try again.");
        } finally {
            setBusyMemberId(null);
            void refetch();
        }
    };

    // While the batch is on, the time is "now"; otherwise ask when they came (starting at the batch's start).
    const checkIn = (memberId: number, name: string) => {
        if (!batch) return;
        if (isLive) void mark(memberId, "present");
        else setTimeRequest({ memberId, initial: batch.start_time, title: `${name} came at` });
    };

    const askTime = (memberId: number, name: string, current: string | null) =>
        setTimeRequest({ memberId, initial: current ?? batch?.start_time ?? "09:00", title: `${name} came at` });

    const openOptions = (member: AttendanceMember) => {
        const marked = !!member.status && !member.auto_absent;
        Alert.alert(member.name, member.check_in_at ? `Came at ${formatTime(member.check_in_at)}` : member.seat_number ? `Seat ${member.seat_number}` : undefined, [
            ...(member.status !== "present" ? [{ text: isLive ? "Check in now" : "Check in…", onPress: () => checkIn(member.member_id, member.name) }] : []),
            ...(member.status === "present" ? [{ text: "Change time", onPress: () => askTime(member.member_id, member.name, member.check_in_at) }] : []),
            ...(member.status !== "absent" || member.auto_absent ? [{ text: "Mark absent", onPress: () => void mark(member.member_id, "absent") }] : []),
            ...(marked ? [{ text: "Undo", style: "destructive" as const, onPress: () => void undo(member.member_id) }] : []),
            { text: "View profile", onPress: () => router.push({ pathname: "/members/[id]", params: { id: String(member.member_id) } }) },
            { text: "Cancel", style: "cancel" as const },
        ]);
    };

    const openVisitorOptions = (visitor: AttendanceVisitor) => {
        Alert.alert(visitor.name, visitor.check_in_at ? `Came at ${formatTime(visitor.check_in_at)}` : undefined, [
            { text: "Change time", onPress: () => askTime(visitor.member_id, visitor.name, visitor.check_in_at) },
            { text: "Undo", style: "destructive", onPress: () => void undo(visitor.member_id) },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    // ---------------------------------------------------------------- rows
    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === "visitorsHeader") {
            return <Text style={styles.groupTitle}>From other batches</Text>;
        }

        if (item.type === "visitor") {
            const { visitor, isFirst, isLast } = item;
            const busy = busyMemberId === visitor.member_id;
            return (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${visitor.name}, came from another batch`}
                    onPress={() => openVisitorOptions(visitor)}
                    style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}
                >
                    <View style={styles.avatar}>
                        <MemberAvatar id={visitor.member_id} name={visitor.name} size={AVATAR_SIZE} />
                    </View>
                    <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                        <View style={styles.rowText}>
                            <Text style={styles.name} numberOfLines={1}>
                                {visitor.name}
                            </Text>
                            <Text style={[styles.detail, { color: theme.success }]}>{visitor.check_in_at ? `In ${formatTime(visitor.check_in_at)}` : "Present"}</Text>
                        </View>
                        {busy ? <ActivityIndicator color={theme.accent} /> : <Ionicons name="checkmark-circle" size={24} color={theme.success} />}
                    </View>
                </Pressable>
            );
        }

        const { member, isFirst, isLast } = item;
        const busy = busyMemberId === member.member_id;
        const seat = member.seat_number ? `Seat ${member.seat_number}` : "No seat";
        let detail: { text: string; color: string };
        if (member.status === "present") detail = { text: member.check_in_at ? `In ${formatTime(member.check_in_at)}` : "Present", color: theme.success };
        else if (member.elsewhere)
            detail = { text: `Came to ${member.elsewhere.batch_name}${member.elsewhere.check_in_at ? ` · ${formatTime(member.elsewhere.check_in_at)}` : ""}`, color: theme.mutedForeground };
        else if (member.status === "absent") detail = { text: member.auto_absent ? "Didn't come" : "Absent", color: theme.destructive };
        else detail = { text: "Not in yet", color: theme.mutedForeground };

        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${member.name}, ${seat}, ${detail.text}`}
                onPress={() => openOptions(member)}
                style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast, pressed && styles.rowPressed]}
            >
                <View style={styles.avatar}>
                    <MemberAvatar id={member.member_id} name={member.name} size={AVATAR_SIZE} faded={!!member.elsewhere} />
                </View>
                <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                    <View style={styles.rowText}>
                        <Text style={styles.name} numberOfLines={1}>
                            {member.name}
                        </Text>
                        <Text style={styles.detail} numberOfLines={1}>
                            {seat} · <Text style={{ color: detail.color }}>{detail.text}</Text>
                        </Text>
                    </View>
                    {busy ? (
                        <ActivityIndicator color={theme.accent} />
                    ) : member.status === "present" ? (
                        <Ionicons name="checkmark-circle" size={26} color={theme.success} />
                    ) : member.status === "absent" && !member.auto_absent ? (
                        <Ionicons name="close-circle" size={26} color={theme.destructive} />
                    ) : member.elsewhere ? null : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Check in ${member.name}`}
                            onPress={() => checkIn(member.member_id, member.name)}
                            hitSlop={6}
                            style={({ pressed }) => [styles.checkIn, member.auto_absent && styles.checkInLate, pressed && styles.rowPressed]}
                        >
                            <Text style={[styles.checkInText, member.auto_absent && styles.checkInTextLate]}>Check in</Text>
                        </Pressable>
                    )}
                </View>
            </Pressable>
        );
    };

    // ---------------------------------------------------------------- header
    const extras = [visitors.length > 0 ? `+${visitors.length} from other batches` : null, elsewhere > 0 ? `${elsewhere} went to another batch` : null].filter(Boolean);
    const ratio = (n: number) => (enrolled > 0 ? n / enrolled : 0);

    const header = (
        <View>
            <DayStrip from={editableFrom} to={today} value={date} liveDate={roster?.live_session?.date ?? null} onChange={selectDay} styles={styles} />

            {batches.length > 0 && (
                <BatchSwitcher
                    meter="progress"
                    selectedKey={batchId}
                    onSelect={selectBatch}
                    items={batches.map((b) => ({
                        key: b.batch_id,
                        title: b.batch_name,
                        caption: formatTimeRange(b.start_time, b.end_time),
                        filled: b.present_count,
                        total: b.members.length,
                        tag: b.is_running ? "Now" : undefined,
                    }))}
                />
            )}

            {batch && enrolled > 0 && (
                <View style={styles.controls}>
                    <View style={styles.progressCard}>
                        <Text style={styles.progressNumber}>
                            {present}
                            <Text style={styles.progressOf}> / {enrolled}</Text>
                        </Text>
                        <Text style={styles.progressLabel}>
                            checked in{isLive ? "" : " that day"} · {batch.batch_name}
                            {!isToday && isLive ? " · on now" : ""}
                        </Text>
                        {/* In, not yet, absent - side by side in one bar. */}
                        <View style={styles.bar}>
                            {/* Only parts with someone in them, so an empty part leaves no gap. */}
                            {[
                                { key: "in", value: present, color: theme.success },
                                { key: "pending", value: pending + elsewhere, color: theme.muted },
                                { key: "absent", value: absent, color: theme.destructive },
                            ]
                                .filter((part) => part.value > 0)
                                .map((part) => (
                                    <View key={part.key} style={{ flex: ratio(part.value), backgroundColor: part.color }} />
                                ))}
                        </View>
                        <View style={styles.legend}>
                            <Legend color={theme.success} label={`${present} in`} styles={styles} />
                            <Legend color={theme.mutedForeground + "66"} label={`${pending} not yet`} styles={styles} />
                            <Legend color={theme.destructive} label={`${absent} absent`} styles={styles} />
                        </View>
                        {extras.length > 0 && <Text style={styles.extras}>{extras.join(" · ")}</Text>}
                    </View>

                    <SegmentedControl
                        segments={[
                            { key: "all", label: "All", count: enrolled },
                            { key: "pending", label: "Not yet", count: pending },
                            { key: "in", label: "In", count: present },
                            { key: "absent", label: "Absent", count: absent, alert: absent > 0 },
                        ]}
                        value={filter}
                        onChange={setFilter}
                    />

                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={theme.mutedForeground} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Name or seat number"
                            placeholderTextColor={theme.mutedForeground + "99"}
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                        {search.length > 0 && (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                            </Pressable>
                        )}
                    </View>
                    {!isLive && <Text style={styles.note}>Earlier day: you'll enter the time each person came.</Text>}
                </View>
            )}
        </View>
    );

    const subtitle = !roster
        ? "Who came in today"
        : batch
          ? `${isToday ? "Today" : fromIsoDate(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${present} of ${enrolled} in ${batch.batch_name}${!isToday && isLive ? " · on now" : ""}`
          : "No batches yet";

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Attendance" subtitle={subtitle} />

                {isLoading && !roster ? (
                    <LoadingState />
                ) : error && !roster ? (
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
                        data={items}
                        keyExtractor={(item) => item.key}
                        // Member rows, the visitors heading and visitor rows recycle separately.
                        getItemType={(item) => item.type}
                        renderItem={renderItem}
                        // Rows show a spinner while their change saves.
                        extraData={busyMemberId}
                        ListHeaderComponent={header}
                        ListEmptyComponent={
                            enrolled === 0 ? (
                                <EmptyState
                                    icon="people-outline"
                                    title={`No one in ${batch?.batch_name ?? "this batch"} yet`}
                                    subtitle="Members show up here once they're given a seat in this batch."
                                    actionLabel="Open seats"
                                    onAction={() => router.push("/seats")}
                                />
                            ) : query ? (
                                <EmptyState icon="search-outline" title="No one matches" subtitle="Try another name or seat number." />
                            ) : (
                                <EmptyState
                                    icon="checkmark-done-outline"
                                    title={filter === "pending" ? "Everyone's marked" : filter === "in" ? "No one's in yet" : "No one's absent"}
                                    subtitle={filter === "pending" ? "Nobody is left to check in for this batch." : "Switch to All to see everyone."}
                                />
                            )
                        }
                        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
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

type Styles = ReturnType<typeof createStyles>;

function Legend({ color, label, styles }: { color: string; label: string; styles: Styles }) {
    return (
        <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
        </View>
    );
}

/**
 * The days attendance can still be marked (the last 7), oldest to today, as tappable chips.
 * Opens scrolled to today's end. A coral dot marks the day whose batch is on right now when that
 * isn't today (an overnight batch after midnight).
 */
function DayStrip({
    from,
    to,
    value,
    liveDate,
    onChange,
    styles,
}: {
    from: string;
    to: string;
    value: string;
    liveDate: string | null;
    onChange: (day: string) => void;
    styles: Styles;
}) {
    const scrollRef = useRef<ScrollViewInstance>(null);
    const days = useMemo(() => {
        const out: string[] = [];
        for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
        return out;
    }, [from, to]);

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
            {days.map((day) => {
                const selected = day === value;
                const isToday = day === to;
                const date = fromIsoDate(day);
                return (
                    <Pressable
                        key={day}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        onPress={() => onChange(day)}
                        style={({ pressed }) => [styles.dayChip, selected && styles.dayChipSelected, pressed && styles.rowPressed]}
                    >
                        <Text style={[styles.dayWeekday, selected && styles.dayTextSelected]}>{isToday ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" })}</Text>
                        <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>{date.getDate()}</Text>
                        {day === liveDate && !isToday && <View style={[styles.liveDot, selected && styles.liveDotSelected]} />}
                    </Pressable>
                );
            })}
        </ScrollView>
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

const createStyles = (theme: Theme) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        dayRow: {
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 16,
        },
        dayChip: {
            width: DAY_CHIP_WIDTH,
            alignItems: "center",
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dayChipSelected: {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
        },
        dayWeekday: {
            fontFamily: "sans-medium",
            fontSize: 11,
            color: theme.mutedForeground,
        },
        dayNumber: {
            fontFamily: "sans-semibold",
            fontSize: 17,
            color: theme.primary,
            marginTop: 2,
        },
        dayTextSelected: {
            color: "#fff",
        },
        liveDot: {
            position: "absolute",
            top: 5,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.accent,
        },
        liveDotSelected: {
            backgroundColor: "#fff",
        },
        controls: {
            paddingHorizontal: 20,
            paddingTop: 14,
            gap: 12,
        },
        progressCard: {
            padding: 16,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        progressNumber: {
            fontFamily: "sans-bold",
            fontSize: 30,
            color: theme.primary,
        },
        progressOf: {
            fontFamily: "sans-medium",
            fontSize: 18,
            color: theme.mutedForeground,
        },
        progressLabel: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        bar: {
            flexDirection: "row",
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: theme.muted,
            marginTop: 14,
            gap: 2,
        },
        legend: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 10,
        },
        legendItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
        },
        legendDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        legendText: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        extras: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 8,
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
        },
        searchInput: {
            flex: 1,
            height: "100%",
            fontFamily: "sans-regular",
            fontSize: 15,
            color: theme.primary,
        },
        note: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            paddingHorizontal: 4,
        },
        groupTitle: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
            paddingHorizontal: 24,
            paddingTop: 22,
            paddingBottom: 8,
        },
        // Rows share one rounded card, split by hairlines that start at the text.
        row: {
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 20,
            paddingLeft: 16,
            backgroundColor: theme.card,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: theme.border,
        },
        rowFirst: {
            marginTop: 14,
            borderTopWidth: 1,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
        },
        rowLast: {
            borderBottomWidth: 1,
            borderBottomLeftRadius: RADIUS.lg,
            borderBottomRightRadius: RADIUS.lg,
        },
        rowPressed: {
            opacity: 0.7,
        },
        avatar: {
            marginRight: 12,
        },
        rowMain: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingRight: 16,
            minHeight: 64,
        },
        rowDivider: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.mutedForeground + "33",
        },
        rowText: {
            flex: 1,
        },
        name: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.primary,
        },
        detail: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        checkIn: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.accent,
        },
        checkInLate: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: theme.accent,
        },
        checkInText: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: "#fff",
        },
        checkInTextLate: {
            color: theme.accent,
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
