import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAttendanceRosterApi, markAttendanceApi } from "@/features/attendance/logic/attendance-api";
import { AttendanceStatus } from "@/features/attendance/types/attendance.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

function formatDateLabel(dateStr: string): string {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export function AttendanceScreen() {
    const router = useRouter();
    const { theme } = useTheme();

    const { data: roster, isLoading, error, refetch, setData } = useApiData(() => getAttendanceRosterApi(), []);

    const handleMark = useCallback(
        async (batchId: number, memberId: number, status: AttendanceStatus) => {
            setData((prev) =>
                prev
                    ? {
                          ...prev,
                          batches: prev.batches.map((b) =>
                              b.batch_id === batchId
                                  ? { ...b, members: b.members.map((m) => (m.member_id === memberId ? { ...m, status } : m)) }
                                  : b
                          ),
                      }
                    : prev
            );

            try {
                await markAttendanceApi({ member_id: memberId, batch_id: batchId, status });
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to update attendance.");
                void refetch();
            }
        },
        [setData, refetch]
    );

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Attendance</Text>
                    <Text style={styles.headerSubtitle}>{roster ? formatDateLabel(roster.date) : "Today"}</Text>
                </View>
            </View>

            {isLoading ? (
                <LoadingState />
            ) : error || !roster ? (
                <ErrorState message={error || "Couldn't load attendance."} onRetry={refetch} />
            ) : roster.batches.length === 0 ? (
                <EmptyState
                    icon="calendar-outline"
                    title="No batches yet"
                    subtitle="Set up a batch first to start tracking attendance."
                    actionLabel="Set up a batch"
                    onAction={() => router.push("/batches")}
                />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {roster.batches.map((batch) => {
                        const presentCount = batch.members.filter((m) => m.status === "present").length;
                        return (
                            <View key={batch.batch_id} style={styles.batchBlock}>
                                <View style={styles.batchHeader}>
                                    <Text style={styles.batchTitle}>{batch.batch_name}</Text>
                                    <Text style={styles.batchSummary}>
                                        {presentCount}/{batch.members.length} present
                                    </Text>
                                </View>

                                {batch.members.length === 0 ? (
                                    <Text style={styles.emptyBatchText}>No students in this batch yet.</Text>
                                ) : (
                                    batch.members.map((member) => (
                                        <View key={member.member_id} style={styles.memberRow}>
                                            <View style={styles.memberInfo}>
                                                <Text style={styles.memberName}>{member.name}</Text>
                                                <Text style={styles.memberMeta}>Seat {member.seat_number}</Text>
                                            </View>
                                            <View style={styles.statusButtons}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    style={[styles.statusBtn, member.status === "present" && styles.statusBtnPresentActive]}
                                                    onPress={() => handleMark(batch.batch_id, member.member_id, "present")}>
                                                    <Ionicons name="checkmark" size={18} color={member.status === "present" ? "#fff" : theme.success} />
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    style={[styles.statusBtn, member.status === "absent" && styles.statusBtnAbsentActive]}
                                                    onPress={() => handleMark(batch.batch_id, member.member_id, "absent")}>
                                                    <Ionicons name="close" size={18} color={member.status === "absent" ? "#fff" : theme.destructive} />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: theme.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
            gap: 16,
        },
        headerActionCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.card,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        headerText: {
            flex: 1,
        },
        headerTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 22,
            color: theme.primary,
            marginBottom: 2,
        },
        headerSubtitle: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40,
        },
        batchBlock: {
            marginBottom: 28,
        },
        batchHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
        },
        batchTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 16,
            color: theme.primary,
        },
        batchSummary: {
            fontFamily: "sans-bold",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        emptyBatchText: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        memberRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 18,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        memberInfo: {
            flex: 1,
        },
        memberName: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
            marginBottom: 2,
        },
        memberMeta: {
            fontFamily: "sans-medium",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        statusButtons: {
            flexDirection: "row",
            gap: 8,
        },
        statusBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.background,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        statusBtnPresentActive: {
            backgroundColor: theme.success,
            borderColor: theme.success,
        },
        statusBtnAbsentActive: {
            backgroundColor: theme.destructive,
            borderColor: theme.destructive,
        },
    });
