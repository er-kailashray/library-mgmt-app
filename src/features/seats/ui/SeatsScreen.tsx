import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BatchSwitcher } from "@/features/batches/ui/BatchSwitcher";
import { batchTimeLabel, freeBatches, isRunningNow, seatLabel, seatNumber } from "@/features/seats/logic/seat-display";
import { getSeatMatrixApi } from "@/features/seats/logic/seats-api";
import { MatrixBatchRef, SeatMatrixSeat } from "@/features/seats/types/seats.types";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text, TextInput } from "@/shared/ui/Text";
import { getInitials } from "@/shared/utils/text";

import { SeatSheet } from "./SeatSheet";

const COLUMNS = 5;
/** Seats per block on the map ("Seats 1–20"); the block headings stay pinned while scrolling. */
const BLOCK_SIZE = 20;
const GRID_PADDING = 20;
const GRID_GAP = 8;
/** Beyond this many batches, an "All batches" tile shows "2/7" instead of one dot per batch. */
const MAX_DOTS = 6;

/** Which map is showing: one batch, or every batch at once. */
type MapView = number | "all";

/** How a seat looks on the map for the current view. */
type SeatState = "free" | "taken" | "due" | "partial" | "full";

type Block = { key: string; title: string; free: number; rows: SeatMatrixSeat[][] };
type ListItem = { type: "header"; key: string; block: Block } | { type: "row"; key: string; seats: SeatMatrixSeat[] };

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

function seatState(seat: SeatMatrixSeat, view: MapView): SeatState {
    if (view === "all") {
        const { free, total } = freeBatches(seat);
        return free === total ? "free" : free === 0 ? "full" : "partial";
    }
    const info = seat.batches.find((b) => b.batch_id === view);
    if (!info || info.available) return "free";
    return info.occupant?.is_due ? "due" : "taken";
}

const isFreeIn = (seat: SeatMatrixSeat, view: MapView) => (view === "all" ? freeBatches(seat).free > 0 : seatState(seat, view) === "free");

/** The batch on right now, so the map opens on what the owner is most likely looking at. */
function defaultView(batches: MatrixBatchRef[]): MapView {
    const running = batches.find((b) => isRunningNow(b));
    if (running) return running.id;
    return batches.length === 1 ? batches[0].id : "all";
}

/**
 * Seats: a map of every seat for one batch (or all of them), showing what's free, who sits where
 * and who owes. Search finds a seat by number or a member by name; tapping a seat lists it per
 * batch, with the sitter's profile one tap away and "Admit" on any free slot.
 */
export function SeatsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const { width: screenWidth } = useWindowDimensions();
    const tileSize = Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);
    const styles = useMemo(() => createStyles(theme, tileSize), [theme, tileSize]);

    const { data, isLoading, error, refetch } = useApiData(getSeatMatrixApi, []);
    const batches = useMemo(() => [...(data?.batches ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time)), [data?.batches]);
    const seats = useMemo(() => [...(data?.seats ?? [])].sort((a, b) => Number(seatNumber(a.seat_number)) - Number(seatNumber(b.seat_number))), [data?.seats]);

    const [view, setView] = useState<MapView | null>(null);
    const [freeOnly, setFreeOnly] = useState(false);
    const [query, setQuery] = useState("");
    const [openSeat, setOpenSeat] = useState<SeatMatrixSeat | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const listRef = useRef<FlashListRef<ListItem>>(null);

    useFocusEffect(
        useCallback(() => {
            void refetch();
        }, [refetch])
    );

    // Open on the running batch once batches arrive; keep the owner's choice after that, unless
    // their batch was deleted.
    useEffect(() => {
        if (batches.length === 0) return;
        setView((current) => (current === null || (current !== "all" && !batches.some((b) => b.id === current)) ? defaultView(batches) : current));
    }, [batches]);

    const activeView: MapView = view ?? "all";
    const focusBatch = activeView === "all" ? null : batches.find((b) => b.id === activeView) ?? null;

    const hasAllCard = batches.length > 1;

    // Keep the open sheet in step with refreshed data (e.g. after admitting someone and coming back).
    useEffect(() => {
        setOpenSeat((current) => (current ? seats.find((s) => s.seat_id === current.seat_id) ?? null : null));
    }, [seats]);

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    /** Seats the search points at: one seat by number, or wherever matching members sit. */
    const search = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        if (/^(seat\s*)?\d+$/.test(q)) {
            const target = seatNumber(q);
            const seat = seats.find((s) => seatNumber(s.seat_number) === target);
            return { ids: new Set(seat ? [seat.seat_id] : []), caption: seat ? null : `There's no seat ${target}.` };
        }
        const hits: { name: string; seat: SeatMatrixSeat; batch: string }[] = [];
        for (const seat of seats) {
            for (const b of seat.batches) {
                if (activeView !== "all" && b.batch_id !== activeView) continue;
                if (b.occupant?.name?.toLowerCase().includes(q)) hits.push({ name: b.occupant.name, seat, batch: b.batch_name });
            }
        }
        const ids = new Set(hits.map((h) => h.seat.seat_id));
        const caption =
            hits.length === 0
                ? `No one matching "${query.trim()}" has a seat${focusBatch ? ` in ${focusBatch.name}` : ""}.`
                : hits
                      .slice(0, 3)
                      .map((h) => `${h.name} · ${seatLabel(h.seat.seat_number)}${activeView === "all" ? ` (${h.batch})` : ""}`)
                      .join("\n") + (hits.length > 3 ? `\n+${hits.length - 3} more` : "");
        return { ids, caption };
    }, [query, seats, activeView, focusBatch]);

    const visibleSeats = useMemo(() => (freeOnly ? seats.filter((s) => isFreeIn(s, activeView)) : seats), [seats, freeOnly, activeView]);

    const items = useMemo((): ListItem[] => {
        return chunk(visibleSeats, BLOCK_SIZE).flatMap((group) => {
            const block: Block = {
                key: `block-${group[0].seat_id}`,
                title: `Seats ${seatNumber(group[0].seat_number)}–${seatNumber(group[group.length - 1].seat_number)}`,
                free: group.filter((s) => isFreeIn(s, activeView)).length,
                rows: chunk(group, COLUMNS),
            };
            return [
                { type: "header" as const, key: block.key, block },
                ...block.rows.map((row) => ({ type: "row" as const, key: `row-${row[0].seat_id}`, seats: row })),
            ];
        });
    }, [visibleSeats, activeView]);
    const stickyHeaderIndices = useMemo(() => items.flatMap((item, index) => (item.type === "header" ? [index] : [])), [items]);

    const jumpToSearch = useCallback(() => {
        if (!search || search.ids.size === 0) return;
        const index = items.findIndex((item) => item.type === "row" && item.seats.some((s) => search.ids.has(s.seat_id)));
        if (index >= 0) void listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }, [search, items]);

    const counts = useMemo(() => {
        if (activeView === "all") {
            const withRoom = seats.filter((s) => freeBatches(s).free > 0).length;
            return { primary: withRoom, secondary: seats.length - withRoom, due: 0 };
        }
        const states = seats.map((s) => seatState(s, activeView));
        return { primary: states.filter((st) => st === "free").length, secondary: states.filter((st) => st !== "free").length, due: states.filter((st) => st === "due").length };
    }, [seats, activeView]);

    const subtitle = !data
        ? "Who sits where, and what's free"
        : focusBatch
          ? `${counts.primary} free · ${counts.secondary} taken in ${focusBatch.name}${counts.due > 0 ? ` · ${counts.due} owe` : ""}`
          : `${counts.primary} seats with room · ${counts.secondary} full`;

    const renderTile = (seat: SeatMatrixSeat) => {
        const state = seatState(seat, activeView);
        const occupant = activeView === "all" ? null : seat.batches.find((b) => b.batch_id === activeView)?.occupant;
        const highlighted = search?.ids.has(seat.seat_id) ?? false;
        const look = tileLook(theme, state);
        const { free, total } = freeBatches(seat);
        const description =
            activeView === "all" ? `free in ${free} of ${total} batches` : occupant ? `${occupant.name ?? "taken"}${occupant.is_due ? ", fee due" : ""}` : "free";

        return (
            <Pressable
                key={seat.seat_id}
                accessibilityRole="button"
                accessibilityLabel={`${seatLabel(seat.seat_number)}, ${description}`}
                onPress={() => setOpenSeat(seat)}
                style={({ pressed }) => [styles.tile, { backgroundColor: look.background, borderColor: look.border }, highlighted && styles.tileHighlighted, pressed && styles.tilePressed]}
            >
                {state === "due" && <View style={styles.dueDot} />}
                <Text style={[styles.tileNumber, { color: look.number }]}>{seatNumber(seat.seat_number)}</Text>
                {activeView === "all" ? (
                    total <= MAX_DOTS ? (
                        <View style={styles.dots}>
                            {seat.batches.map((b) => (
                                <View key={b.batch_id} style={[styles.dot, { backgroundColor: b.available ? theme.success : theme.mutedForeground + "55" }]} />
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.tileCaption}>
                            {free}/{total}
                        </Text>
                    )
                ) : occupant ? (
                    <Text style={styles.tileCaption} numberOfLines={1}>
                        {getInitials(occupant.name ?? "")}
                    </Text>
                ) : null}
            </Pressable>
        );
    };

    const renderItem = ({ item }: { item: ListItem }) =>
        item.type === "header" ? (
            <View style={styles.blockHeader}>
                <Text style={styles.blockTitle}>{item.block.title}</Text>
                <Text style={styles.blockMeta}>
                    {item.block.free === 0 ? "none free" : activeView === "all" ? `${item.block.free} with room` : `${item.block.free} free`}
                </Text>
            </View>
        ) : (
            <View style={styles.tileRow}>{item.seats.map(renderTile)}</View>
        );

    const listHeader = (
        <View>
            <BatchSwitcher<MapView>
                meter="occupancy"
                selectedKey={activeView}
                onSelect={setView}
                items={[
                    ...(hasAllCard
                        ? [{ key: "all" as MapView, title: "All batches", caption: `${seats.length} seats`, filled: seats.filter((s) => freeBatches(s).free === 0).length, total: seats.length }]
                        : []),
                    ...batches.map((batch) => ({
                        key: batch.id as MapView,
                        title: batch.name,
                        caption: batchTimeLabel(batch),
                        filled: seats.filter((s) => s.batches.some((b) => b.batch_id === batch.id && !b.available)).length,
                        total: seats.length,
                        tag: isRunningNow(batch) ? "Now" : undefined,
                    })),
                ]}
            />

            <View style={styles.controls}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color={theme.mutedForeground} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Seat number or member name"
                        placeholderTextColor={theme.mutedForeground + "99"}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={jumpToSearch}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={10}>
                            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                        </Pressable>
                    )}
                </View>
                {search?.caption ? <Text style={styles.searchCaption}>{search.caption}</Text> : null}

                <View style={styles.legendRow}>
                    <View style={styles.legend}>
                        {(activeView === "all"
                            ? [
                                  { label: "Free in all", color: theme.success },
                                  { label: "Partly free", color: theme.warning },
                                  { label: "Full", color: theme.mutedForeground },
                              ]
                            : [
                                  { label: "Free", color: theme.success },
                                  { label: "Taken", color: theme.mutedForeground },
                                  { label: "Fee due", color: theme.destructive },
                              ]
                        ).map((entry) => (
                            <View key={entry.label} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
                                <Text style={styles.legendText}>{entry.label}</Text>
                            </View>
                        ))}
                    </View>
                    <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: freeOnly }}
                        accessibilityLabel="Show free seats only"
                        onPress={() => setFreeOnly((on) => !on)}
                        style={[styles.freeToggle, freeOnly && styles.freeToggleOn]}
                    >
                        <Ionicons name={freeOnly ? "checkmark" : "funnel-outline"} size={13} color={freeOnly ? "#fff" : theme.primary} />
                        <Text style={[styles.freeToggleText, freeOnly && styles.freeToggleTextOn]}>Free only</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
                <ScreenHeader title="Seats" subtitle={subtitle} />

                {isLoading && !data ? (
                    <LoadingState />
                ) : error && !data ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : seats.length === 0 ? (
                    <EmptyState icon="grid-outline" title="No seats yet" subtitle="Seats are created when your library is set up. Add more from Edit Library Name & Seats." />
                ) : batches.length === 0 ? (
                    <EmptyState
                        icon="calendar-outline"
                        title="No batches yet"
                        subtitle="Seats are booked per batch. Add your first batch to start filling them."
                        actionLabel="Set up a batch"
                        onAction={() => router.push("/batches")}
                    />
                ) : (
                    <FlashList
                        ref={listRef}
                        data={items}
                        keyExtractor={(item) => item.key}
                        // Block headings and seat rows recycle separately (different layouts).
                        getItemType={(item) => item.type}
                        renderItem={renderItem}
                        extraData={search}
                        stickyHeaderIndices={stickyHeaderIndices}
                        ListHeaderComponent={listHeader}
                        ListEmptyComponent={
                            <EmptyState
                                icon="checkmark-done-outline"
                                title="No free seats"
                                subtitle={focusBatch ? `Every seat in ${focusBatch.name} is taken. Try another batch.` : "Every seat is taken in every batch."}
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 32 + bottomInset }}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
                    />
                )}

                <SeatSheet
                    seat={openSeat}
                    batches={batches}
                    focusBatchId={focusBatch?.id ?? null}
                    onClose={() => setOpenSeat(null)}
                    onOpenMember={(memberId) => {
                        setOpenSeat(null);
                        router.push({ pathname: "/members/[id]", params: { id: String(memberId) } });
                    }}
                    onAdmit={(batchId, seatId) => {
                        setOpenSeat(null);
                        router.push({ pathname: "/admission", params: { batch_id: String(batchId), seat_id: String(seatId) } });
                    }}
                />
            </SafeAreaView>
        </ScreenBackground>
    );
}

function tileLook(theme: Theme, state: SeatState): { background: string; border: string; number: string } {
    switch (state) {
        case "free":
            return { background: theme.card, border: theme.success + "66", number: theme.success };
        case "partial":
            return { background: theme.card, border: theme.warning + "66", number: theme.warning };
        case "full":
            return { background: theme.muted, border: "transparent", number: theme.mutedForeground };
        default:
            // Taken, with or without a fee due (the red dot marks that).
            return { background: theme.muted, border: "transparent", number: theme.primary };
    }
}

const createStyles = (theme: Theme, tileSize: number) =>
    StyleSheet.create({
        safe: {
            flex: 1,
        },
        controls: {
            paddingHorizontal: GRID_PADDING,
            paddingTop: 14,
            gap: 10,
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
        searchCaption: {
            fontFamily: "sans-regular",
            fontSize: 13,
            lineHeight: 19,
            color: theme.mutedForeground,
            paddingHorizontal: 4,
        },
        legendRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },
        legend: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            flexShrink: 1,
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
        freeToggle: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        freeToggleOn: {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
        },
        freeToggleText: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.primary,
        },
        freeToggleTextOn: {
            color: "#fff",
        },
        // Pinned while scrolling, so it needs a solid background.
        blockHeader: {
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingHorizontal: GRID_PADDING + 4,
            paddingTop: 18,
            paddingBottom: 8,
            backgroundColor: theme.background,
        },
        blockTitle: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        blockMeta: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        tileRow: {
            flexDirection: "row",
            gap: GRID_GAP,
            paddingHorizontal: GRID_PADDING,
            marginBottom: GRID_GAP,
        },
        tile: {
            width: tileSize,
            height: tileSize,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
        },
        tileHighlighted: {
            borderWidth: 2,
            borderColor: theme.accent,
        },
        tilePressed: {
            opacity: 0.75,
        },
        tileNumber: {
            fontFamily: "sans-semibold",
            fontSize: 16,
        },
        tileCaption: {
            fontFamily: "sans-medium",
            fontSize: 10,
            color: theme.mutedForeground,
        },
        dueDot: {
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: theme.destructive,
        },
        dots: {
            flexDirection: "row",
            gap: 3,
        },
        dot: {
            width: 5,
            height: 5,
            borderRadius: 2.5,
        },
    });
