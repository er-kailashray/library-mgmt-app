import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getReportApi } from "@/features/reports/logic/reports-api";
import { ReportData, ReportMonths } from "@/features/reports/types/reports.types";
import { BarChart, MeterRow } from "@/features/reports/ui/ReportCharts";
import { RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { FilterChip } from "@/shared/ui/FilterChip";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";
import { formatShortDate } from "@/shared/utils/dates";

const RANGES: ReportMonths[] = [3, 6, 12];

/** Short amounts for chart captions: ₹950, ₹12.5k, ₹1.2L. */
function compactRupee(amount: number): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "−" : "";
    if (abs >= 100_000) return `${sign}₹${trim(abs / 100_000)}L`;
    if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000)}k`;
    return `${sign}₹${Math.round(abs)}`;
}

function trim(value: number): string {
    return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Collection-rate colour: healthy, getting there, or behind. */
function rateColor(theme: Theme, rate: number): string {
    if (rate >= 80) return theme.success;
    if (rate >= 50) return theme.warning;
    return theme.destructive;
}

/**
 * The Reports tab: revenue, dues, members and attendance for the last 3, 6 or 12 months. Numbers
 * come from GET /reports, which uses the same rules as Home, so the two always agree.
 */
export function ReportsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const bottomInset = useScreenBottomInset();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [months, setMonths] = useState<ReportMonths>(6);
    const { data, isLoading, error, refetch } = useApiData(() => getReportApi(months), [months]);
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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <ScreenHeader title="Reports" subtitle={data ? `${formatShortDate(data.from, true)} – ${formatShortDate(data.to, true)}` : "How your library is doing"} />

                <View style={styles.rangeRow}>
                    {RANGES.map((range) => (
                        <FilterChip key={range} label={`${range} months`} selected={months === range} onPress={() => setMonths(range)} />
                    ))}
                </View>

                {!data && isLoading ? (
                    <LoadingState />
                ) : !data ? (
                    <ErrorState message={error ?? "Couldn't load reports."} onRetry={refetch} />
                ) : (
                    <ScrollView
                        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + bottomInset }]}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
                        showsVerticalScrollIndicator={false}
                    >
                        <RevenueCard data={data} styles={styles} theme={theme} />
                        <DuesCard data={data} styles={styles} theme={theme} onSeeDues={() => router.push({ pathname: "/payments", params: { tab: "due" } })} />
                        <MembersCard data={data} styles={styles} theme={theme} onOpenSeats={() => router.push("/seats")} />
                        <AttendanceCard
                            data={data}
                            styles={styles}
                            theme={theme}
                            onMarkAttendance={() => router.push("/attendance")}
                            onOpenMember={(id) => router.push({ pathname: "/members/[id]", params: { id: String(id) } })}
                        />
                    </ScrollView>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

type Styles = ReturnType<typeof createStyles>;
type CardProps = { data: ReportData; styles: Styles; theme: Theme };

function Card({ title, icon, styles, theme, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; styles: Styles; theme: Theme; children: ReactNode }) {
    return (
        <View style={styles.card}>
            <View style={styles.cardTitleRow}>
                <Ionicons name={icon} size={18} color={theme.accent} />
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

function CardLink({ label, onPress, styles, theme }: { label: string; onPress: () => void; styles: Styles; theme: Theme }) {
    return (
        <Pressable accessibilityRole="button" style={styles.link} onPress={onPress}>
            <Text style={styles.linkText}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.accent} />
        </Pressable>
    );
}

function RevenueCard({ data, styles, theme }: CardProps) {
    const { revenue } = data;
    const refunded = revenue.by_month.reduce((sum, month) => sum + month.refunded, 0);
    const modesTotal = revenue.by_mode.reduce((sum, mode) => sum + mode.amount, 0);
    const change = revenue.change_pct;

    return (
        <Card title="Revenue" icon="trending-up" styles={styles} theme={theme}>
            <Text style={styles.bigNumber}>{formatRupee(revenue.total)}</Text>
            <Text style={styles.caption}>collected in the last {data.months} months</Text>

            <View style={styles.compareRow}>
                <Text style={styles.compareText}>
                    This month <Text style={styles.compareStrong}>{formatRupee(revenue.this_month)}</Text>
                </Text>
                {change === null ? (
                    <Text style={styles.compareMuted}>nothing last month to compare</Text>
                ) : (
                    <View style={[styles.changeBadge, { backgroundColor: (change >= 0 ? theme.success : theme.destructive) + "18" }]}>
                        <Ionicons name={change >= 0 ? "arrow-up" : "arrow-down"} size={12} color={change >= 0 ? theme.success : theme.destructive} />
                        <Text style={[styles.changeText, { color: change >= 0 ? theme.success : theme.destructive }]}>{Math.abs(change)}% vs last month</Text>
                    </View>
                )}
            </View>

            <BarChart
                accessibilityLabel={`Collected per month: ${revenue.by_month.map((m) => `${m.label} ${formatRupee(m.collected)}`).join(", ")}`}
                bars={revenue.by_month.map((m) => ({ key: m.month, label: m.label, value: m.collected, caption: compactRupee(m.collected) }))}
            />
            {refunded > 0 && <Text style={styles.footnote}>After {formatRupee(refunded)} refunded.</Text>}

            {revenue.by_mode.length > 0 && (
                <>
                    <Text style={styles.subheading}>By payment mode</Text>
                    {revenue.by_mode.map((mode) => (
                        <MeterRow
                            key={mode.mode}
                            label={mode.label}
                            value={`${formatRupee(mode.amount)} · ${plural(mode.count, "payment")}`}
                            percent={modesTotal > 0 ? (mode.amount / modesTotal) * 100 : 0}
                        />
                    ))}
                </>
            )}
        </Card>
    );
}

function DuesCard({ data, styles, theme, onSeeDues }: CardProps & { onSeeDues: () => void }) {
    const { dues } = data;
    const ageColors: Record<string, string> = { week: theme.accent, month: theme.warning, two_months: theme.destructive, older: theme.destructive };

    return (
        <Card title="Dues" icon="alert-circle" styles={styles} theme={theme}>
            <Text style={styles.bigNumber}>{formatRupee(dues.total_outstanding)}</Text>
            <Text style={styles.caption}>{dues.overdue_members > 0 ? `owed by ${plural(dues.overdue_members, "member")}` : "Nobody owes anything right now"}</Text>

            {dues.collection_rate !== null && (
                <>
                    <MeterRow label="Collected this month" value={`${dues.collection_rate}%`} percent={dues.collection_rate} color={rateColor(theme, dues.collection_rate)} />
                    <Text style={styles.footnote}>Share of this month's money already in hand, out of what's collected plus what's still owed.</Text>
                </>
            )}

            {dues.overdue_members > 0 && (
                <>
                    <Text style={styles.subheading}>How long it's been due</Text>
                    {dues.by_age.map((age) => (
                        <MeterRow
                            key={age.key}
                            label={age.label}
                            value={age.members > 0 ? `${plural(age.members, "member")} · ${formatRupee(age.amount)}` : "—"}
                            percent={dues.total_outstanding > 0 ? (age.amount / dues.total_outstanding) * 100 : 0}
                            color={ageColors[age.key]}
                        />
                    ))}
                    <CardLink label="See who owes" onPress={onSeeDues} styles={styles} theme={theme} />
                </>
            )}
        </Card>
    );
}

function MembersCard({ data, styles, theme, onOpenSeats }: CardProps & { onOpenSeats: () => void }) {
    const { members } = data;
    // Newest first; a year of rows is too long for a card, so the latest six.
    const recent = [...members.by_month].reverse().slice(0, 6);

    return (
        <Card title="Members" icon="people" styles={styles} theme={theme}>
            <Text style={styles.bigNumber}>{members.active}</Text>
            <Text style={styles.caption}>active members</Text>

            <BarChart
                accessibilityLabel={`Active members at each month's end: ${members.by_month.map((m) => `${m.label} ${m.active}`).join(", ")}`}
                bars={members.by_month.map((m) => ({ key: m.month, label: m.label, value: m.active, caption: String(m.active) }))}
            />

            <Text style={styles.subheading}>Joined and left</Text>
            {recent.map((month) => (
                <View key={month.month} style={styles.tableRow}>
                    <Text style={styles.tableLabel}>{formatShortDate(`${month.month}-01`, true).replace(/^1 /, "")}</Text>
                    <Text style={[styles.tableValue, { color: month.joined > 0 ? theme.success : theme.mutedForeground }]}>+{month.joined} joined</Text>
                    <Text style={[styles.tableValue, { color: month.left > 0 ? theme.destructive : theme.mutedForeground }]}>−{month.left} left</Text>
                </View>
            ))}

            {members.occupancy.length > 0 && (
                <>
                    <Text style={styles.subheading}>Seats filled per batch</Text>
                    {members.occupancy.map((batch) => (
                        <MeterRow key={batch.batch_id} label={batch.name} value={`${batch.occupied} / ${batch.total} · ${batch.rate}%`} percent={batch.rate} />
                    ))}
                    <CardLink label="Open seats" onPress={onOpenSeats} styles={styles} theme={theme} />
                </>
            )}
        </Card>
    );
}

function AttendanceCard({
    data,
    styles,
    theme,
    onMarkAttendance,
    onOpenMember,
}: CardProps & { onMarkAttendance: () => void; onOpenMember: (id: number) => void }) {
    const { attendance } = data;

    if (!attendance.tracked) {
        return (
            <Card title="Attendance" icon="checkmark-done" styles={styles} theme={theme}>
                <Text style={styles.caption}>No attendance taken in the last {attendance.window_days} days. Mark it daily to see who comes regularly and who has stopped coming.</Text>
                <CardLink label="Mark attendance" onPress={onMarkAttendance} styles={styles} theme={theme} />
            </Card>
        );
    }

    const { not_seen: notSeen } = attendance;
    const hidden = notSeen.count - notSeen.members.length;

    return (
        <Card title="Attendance" icon="checkmark-done" styles={styles} theme={theme}>
            <Text style={styles.caption}>Average check-ins on days attendance was taken, last {attendance.window_days} days.</Text>
            {attendance.by_batch.map((batch) => (
                <MeterRow
                    key={batch.batch_id}
                    label={batch.name}
                    value={batch.average_present === null ? "Not taken" : `${batch.average_present} of ${batch.enrolled} · ${batch.rate ?? 0}%`}
                    percent={batch.rate ?? 0}
                    color={theme.success}
                />
            ))}

            <Text style={styles.subheading}>
                Not seen in {notSeen.after_days ?? 7}+ days{notSeen.count > 0 ? ` (${notSeen.count})` : ""}
            </Text>
            {notSeen.count === 0 ? (
                <Text style={styles.caption}>Everyone enrolled has come in recently.</Text>
            ) : (
                notSeen.members.map((member) => (
                    <Pressable key={member.member_id} accessibilityRole="button" style={styles.personRow} onPress={() => onOpenMember(member.member_id)}>
                        <View style={styles.personText}>
                            <Text style={styles.personName}>{member.name}</Text>
                            <Text style={styles.personMeta}>
                                {member.last_seen ? `Last seen ${formatShortDate(member.last_seen)} · ${plural(member.days, "day")} ago` : `Never checked in · started ${plural(member.days, "day")} ago`}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
                    </Pressable>
                ))
            )}
            {hidden > 0 && <Text style={styles.footnote}>and {hidden} more</Text>}
        </Card>
    );
}

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
        safe: {
            flex: 1,
        },
        rangeRow: {
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 4,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 12,
        },
        card: {
            backgroundColor: theme.card,
            borderRadius: RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 16,
        },
        cardTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
        },
        cardTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 16,
            color: theme.primary,
        },
        bigNumber: {
            fontFamily: "sans-extrabold",
            fontSize: 28,
            color: theme.primary,
        },
        caption: {
            fontFamily: "sans-medium",
            fontSize: 13,
            lineHeight: 19,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        compareRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            marginBottom: 4,
        },
        compareText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        compareStrong: {
            fontFamily: "sans-bold",
            color: theme.primary,
        },
        compareMuted: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        changeBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: RADIUS.sm,
        },
        changeText: {
            fontFamily: "sans-bold",
            fontSize: 12,
        },
        subheading: {
            fontFamily: "sans-bold",
            fontSize: 12,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginTop: 20,
        },
        footnote: {
            fontFamily: "sans-medium",
            fontSize: 12,
            lineHeight: 17,
            color: theme.mutedForeground,
            marginTop: 8,
        },
        tableRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        tableLabel: {
            flex: 1,
            fontFamily: "sans-semibold",
            fontSize: 14,
            color: theme.primary,
        },
        tableValue: {
            width: 84,
            textAlign: "right",
            fontFamily: "sans-semibold",
            fontSize: 13,
        },
        link: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 2,
            marginTop: 14,
            paddingVertical: 4,
        },
        linkText: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.accent,
        },
        personRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        personText: {
            flex: 1,
        },
        personName: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.primary,
        },
        personMeta: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
    });
