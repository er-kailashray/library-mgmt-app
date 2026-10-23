import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { durationLabel, findClash, formatTime, fromMinutes, runsPastMidnight, toMinutes } from "@/features/batches/logic/batch-time";
import { createBatchApi, deleteBatchApi, getBatchesApi, updateBatchApi } from "@/features/batches/logic/batches-api";
import { Batch } from "@/features/batches/types/batches.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";

import { BatchTimeWheelPicker } from "./BatchTimeWheelPicker";

function formatRupee(amountStr: string): string {
	const amount = parseFloat(amountStr) || 0;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function BatchesScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const { data: batches, isLoading, error, refetch: fetchBatches } = useApiData(getBatchesApi, []);

	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	// The batch being edited; null while creating a new one.
	const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
	const [newName, setNewName] = useState("");
	const [newStartTime, setNewStartTime] = useState("");
	const [newEndTime, setNewEndTime] = useState("");
	const [newFee, setNewFee] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const [selectingTimeFor, setSelectingTimeFor] = useState<"start" | "end" | null>(null);

	const openCreate = () => {
		setEditingBatch(null);
		setNewName("");
		setNewStartTime("");
		setNewEndTime("");
		setNewFee("");
		setSubmitError(null);
		setSelectingTimeFor(null);
		setIsAddModalVisible(true);
	};

	const openEdit = (batch: Batch) => {
		setEditingBatch(batch);
		setNewName(batch.name);
		setNewStartTime(batch.start_time.slice(0, 5));
		setNewEndTime(batch.end_time.slice(0, 5));
		setNewFee(String(parseFloat(batch.monthly_fee)));
		setSubmitError(null);
		setSelectingTimeFor(null);
		setIsAddModalVisible(true);
	};

	const handleDeleteBatch = () => {
		if (!editingBatch) return;
		const batch = editingBatch;

		// The backend refuses this too; say so up front instead of after a round trip.
		if (batch.allocations_count > 0) {
			Alert.alert(
				"Can't delete this batch",
				`${batch.allocations_count} member${batch.allocations_count === 1 ? " is" : "s are"} in ${batch.name}. Move them to another batch or end their membership first.`
			);
			return;
		}

		Alert.alert(`Delete ${batch.name}?`, "Past seat and attendance records for this batch will also be removed. This can't be undone.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					try {
						setIsDeleting(true);
						setSubmitError(null);
						await deleteBatchApi(batch.id);
						setIsAddModalVisible(false);
						setEditingBatch(null);
						await fetchBatches();
					} catch (err: any) {
						setSubmitError(err.message || "Could not delete the batch. Please try again.");
					} finally {
						setIsDeleting(false);
					}
				},
			},
		]);
	};

	const handleCreateBatch = async () => {
		setSubmitError(null);
		if (!newName || !newStartTime || !newEndTime || !newFee) {
			setSubmitError("Please fill out all fields.");
			return;
		}
		if (newStartTime === newEndTime) {
			setSubmitError("The end time must be different from the start time.");
			return;
		}
		if (clash) {
			setSubmitError(clashMessage);
			return;
		}

		try {
			setIsSubmitting(true);
			const payload = {
				name: newName,
				start_time: newStartTime,
				end_time: newEndTime,
				monthly_fee: newFee,
			};
			if (editingBatch) {
				await updateBatchApi(editingBatch.id, payload);
			} else {
				await createBatchApi(payload);
			}
			setIsAddModalVisible(false);
			setEditingBatch(null);
			await fetchBatches();
		} catch (err: any) {
			setSubmitError(err.message || (editingBatch ? "Could not save the batch. Please try again." : "Could not create the batch. Please try again."));
		} finally {
			setIsSubmitting(false);
		}
	};

	const styles = createStyles(theme);
	const batchList = batches ?? [];

	// Checked live as times are picked, with the same rule the backend enforces.
	const hasBothTimes = !!newStartTime && !!newEndTime;
	const sameTimes = hasBothTimes && newStartTime === newEndTime;
	// When editing, the batch's own current slot doesn't count as a clash.
	const otherBatches = editingBatch ? batchList.filter((b) => b.id !== editingBatch.id) : batchList;
	const clash = hasBothTimes && !sameTimes ? findClash(otherBatches, newStartTime, newEndTime) : null;
	// Dues are worked out from the batch's current fee, so a change also reaches members already in it.
	const feeChangedWithMembers =
		!!editingBatch && editingBatch.allocations_count > 0 && newFee !== "" && parseFloat(newFee) !== parseFloat(editingBatch.monthly_fee);
	const clashMessage = clash ? `This time overlaps with ${clash.name} (${formatTime(clash.start_time)} - ${formatTime(clash.end_time)}).` : "";

	// Start opens on 6:00 AM; end opens four hours after the chosen start.
	const pickerInitialValue =
		selectingTimeFor === "start"
			? newStartTime || "06:00"
			: newEndTime || (newStartTime ? fromMinutes(toMinutes(newStartTime) + 4 * 60) : "10:00");

	return (
		<ScreenBackground>
			<SafeAreaView style={styles.safe} edges={["top"]}>
				<StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
				<View style={styles.headerWrapper}>
					<View style={styles.header}>
						<Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
							<Ionicons name="arrow-back" size={24} color={theme.primary} />
						</Pressable>
						<View style={styles.headerText}>
							<Text style={styles.headerTitle}>Seat Batches</Text>
							<Text style={styles.headerSubtitle}>Manage timeslots & pricing</Text>
						</View>
						<Pressable
							accessibilityRole="button"
							style={[styles.headerActionCircle, { backgroundColor: theme.primary, borderColor: theme.primary }]}
							onPress={openCreate}>
							<Ionicons name="add" size={24} color={theme.background} />
						</Pressable>
					</View>
				</View>

				<ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
					<View style={styles.summaryContainer}>
						<Text style={styles.sectionTitle}>Active Batches ({batchList.length})</Text>
					</View>

					{isLoading ? (
						<LoadingState />
					) : error ? (
						<ErrorState message={error} onRetry={fetchBatches} />
					) : batchList.length === 0 ? (
						<EmptyState icon="calendar-outline" title="No batches available yet" subtitle="Tap the + icon in the header to create your first timeslot." />
					) : (
						batchList.map((batch) => (
							<Pressable
								key={batch.id}
								accessibilityRole="button"
								accessibilityLabel={`Edit ${batch.name}`}
								style={({ pressed }) => [styles.batchCard, pressed && { opacity: 0.85 }]}
								onPress={() => openEdit(batch)}>
								<View style={styles.batchHeader}>
									<View style={styles.batchTitleWrap}>
										<Text style={styles.batchName}>{batch.name}</Text>
										<View style={styles.timeWrap}>
											<Ionicons name="time-outline" size={14} color={theme.mutedForeground} />
											<Text style={styles.timeText}>
												{formatTime(batch.start_time)} - {formatTime(batch.end_time)} · {durationLabel(batch.start_time, batch.end_time)}
											</Text>
										</View>
									</View>
									<View style={styles.priceBadge}>
										<Text style={styles.priceText}>{formatRupee(batch.monthly_fee)}</Text>
									</View>
									<Ionicons name="create-outline" size={20} color={theme.mutedForeground} style={styles.editIcon} />
								</View>
							</Pressable>
						))
					)}
				</ScrollView>

				<Modal visible={isAddModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsAddModalVisible(false)}>
					<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							{selectingTimeFor ? (
								<BatchTimeWheelPicker
									title={selectingTimeFor === "start" ? "Batch starts at" : "Batch ends at"}
									initialValue={pickerInitialValue}
									onCancel={() => setSelectingTimeFor(null)}
									onDone={(value) => {
										if (selectingTimeFor === "start") setNewStartTime(value);
										else setNewEndTime(value);
										setSubmitError(null);
										setSelectingTimeFor(null);
									}}
								/>
							) : (
								<>
									<View style={styles.modalHeader}>
										<Text style={styles.modalTitle}>{editingBatch ? "Edit Batch" : "Create New Batch"}</Text>
										<Pressable accessibilityRole="button" style={styles.modalCloseButton} onPress={() => setIsAddModalVisible(false)}>
											<Ionicons name="close" size={24} color={theme.primary} />
										</Pressable>
									</View>

									<Text style={styles.inputLabel}>Batch Name</Text>
									<TextInput style={styles.modalInput} placeholder="e.g. Morning Focus" value={newName} onChangeText={setNewName} placeholderTextColor={theme.mutedForeground + "80"} />

									<View style={styles.modalRowGroup}>
										<View style={{ flex: 1 }}>
											<Text style={styles.inputLabel}>Start Time</Text>
											<Pressable style={styles.modalTimeSelector} onPress={() => setSelectingTimeFor("start")}>
												<Ionicons name="time-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
												<Text style={[styles.modalTimeSelectorText, !newStartTime && { color: theme.mutedForeground + "80" }]}>{newStartTime ? formatTime(newStartTime) : "Select time"}</Text>
											</Pressable>
										</View>
										<View style={{ flex: 1 }}>
											<Text style={styles.inputLabel}>End Time</Text>
											<Pressable style={styles.modalTimeSelector} onPress={() => setSelectingTimeFor("end")}>
												<Ionicons name="time-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
												<Text style={[styles.modalTimeSelectorText, !newEndTime && { color: theme.mutedForeground + "80" }]}>{newEndTime ? formatTime(newEndTime) : "Select time"}</Text>
											</Pressable>
										</View>
									</View>

									{hasBothTimes && (
										<View style={styles.timeSummary}>
											{sameTimes ? (
												<Text style={styles.timeSummaryError}>Start and end can't be the same time.</Text>
											) : clash ? (
												<Text style={styles.timeSummaryError}>{clashMessage}</Text>
											) : (
												<Text style={styles.timeSummaryText}>
													{durationLabel(newStartTime, newEndTime)}
													{runsPastMidnight(newStartTime, newEndTime) ? " · runs past midnight" : ""}
												</Text>
											)}
										</View>
									)}

									<Text style={styles.inputLabel}>Monthly Fee (Rs)</Text>
									<TextInput style={styles.modalInput} placeholder="500" value={newFee} onChangeText={setNewFee} keyboardType="numeric" placeholderTextColor={theme.mutedForeground + "80"} />

									{feeChangedWithMembers && (
										<Text style={styles.feeWarning}>
											{editingBatch.allocations_count} member{editingBatch.allocations_count === 1 ? " is" : "s are"} in this batch. The new fee will also be used for their dues.
										</Text>
									)}

									{submitError && (
										<View style={styles.errorBox}>
											<Ionicons name="alert-circle" size={18} color={theme.destructive} />
											<Text style={styles.errorText}>{submitError}</Text>
										</View>
									)}

									<Pressable
										style={[styles.modalSubmitBtn, (isSubmitting || sameTimes || !!clash) && { opacity: 0.5 }]}
										onPress={handleCreateBatch}
										disabled={isSubmitting || sameTimes || !!clash}>
										{isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSubmitText}>{editingBatch ? "Save Changes" : "Create Batch"}</Text>}
									</Pressable>

									{editingBatch && (
										<Pressable accessibilityRole="button" style={styles.deleteBtn} onPress={handleDeleteBatch} disabled={isDeleting || isSubmitting}>
											{isDeleting ? (
												<ActivityIndicator color={theme.destructive} size="small" />
											) : (
												<>
													<Ionicons name="trash-outline" size={18} color={theme.destructive} />
													<Text style={styles.deleteText}>Delete Batch</Text>
												</>
											)}
										</Pressable>
									)}
								</>
							)}
						</View>
					</KeyboardAvoidingView>
				</Modal>
			</SafeAreaView>
		</ScreenBackground>
	);
}

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
	},
	headerWrapper: {
		paddingTop: 8,
		borderBottomWidth: 1,
		borderBottomColor: theme.border,
		zIndex: 10,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingBottom: 16,
		gap: 16,
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
	scroll: {
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 40,
	},
	summaryContainer: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontFamily: "sans-bold",
		fontSize: 14,
		letterSpacing: 1.2,
		color: theme.mutedForeground,
		textTransform: "uppercase",
	},
	batchCard: {
		backgroundColor: theme.card,
		borderRadius: 20,
		padding: 20,
		marginBottom: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 20,
		elevation: 4,
		borderWidth: 1.5,
		borderColor: theme.border,
	},
	batchHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	batchTitleWrap: {
		flex: 1,
		paddingRight: 12,
	},
	batchName: {
		fontFamily: "sans-bold",
		fontSize: 15,
		color: theme.primary,
		marginBottom: 4,
	},
	timeWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	timeText: {
		fontFamily: "sans-medium",
		fontSize: 13,
		color: theme.mutedForeground,
	},
	priceBadge: {
		backgroundColor: theme.accent + "15",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 12,
	},
	priceText: {
		fontFamily: "sans-extrabold",
		fontSize: 14,
		color: theme.accent,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.6)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: theme.background,
		borderTopLeftRadius: 32,
		borderTopRightRadius: 32,
		padding: 24,
		paddingBottom: 48,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: -10 },
		shadowOpacity: 0.12,
		shadowRadius: 24,
		elevation: 10,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 24,
	},
	modalTitle: {
		fontFamily: "sans-extrabold",
		fontSize: 20,
		color: theme.primary,
	},
	modalCloseButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: theme.card,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1.5,
		borderColor: theme.border,
	},
	inputLabel: {
		fontFamily: "sans-bold",
		fontSize: 13,
		color: theme.primary,
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	modalInput: {
		fontFamily: "sans-medium",
		backgroundColor: theme.card,
		borderWidth: 1,
		borderColor: theme.border,
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 16,
		color: theme.primary,
		marginBottom: 20,
	},
	modalTimeSelector: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.card,
		borderWidth: 1,
		borderColor: theme.border,
		borderRadius: 16,
		paddingHorizontal: 14,
		paddingVertical: 14,
		marginBottom: 20,
	},
	modalTimeSelectorText: {
		fontFamily: "sans-medium",
		fontSize: 16,
		color: theme.primary,
	},
	modalRowGroup: {
		flexDirection: "row",
		gap: 16,
	},
	errorBox: {
		backgroundColor: theme.destructive + "1A",
		padding: 12,
		borderRadius: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 16,
	},
	errorText: {
		fontFamily: "sans-semibold",
		color: theme.destructive,
		fontSize: 14,
		flex: 1,
	},
	modalSubmitBtn: {
		backgroundColor: theme.accent,
		padding: 18,
		borderRadius: 16,
		alignItems: "center",
		marginTop: 8,
		shadowColor: theme.accent,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.2,
		shadowRadius: 10,
		elevation: 4,
	},
	modalSubmitText: {
		fontFamily: "sans-extrabold",
		fontSize: 16,
		color: "#fff",
	},
	deleteBtn: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		padding: 16,
		marginTop: 8,
	},
	deleteText: {
		fontFamily: "sans-extrabold",
		fontSize: 16,
		color: theme.destructive,
	},
	editIcon: {
		marginLeft: 10,
		marginTop: 4,
	},
	feeWarning: {
		fontFamily: "sans-semibold",
		fontSize: 13,
		lineHeight: 18,
		color: theme.warning,
		marginTop: -8,
		marginBottom: 16,
	},
	timeSummary: {
		marginTop: -8,
		marginBottom: 20,
	},
	timeSummaryText: {
		fontFamily: "sans-semibold",
		fontSize: 13,
		color: theme.mutedForeground,
	},
	timeSummaryError: {
		fontFamily: "sans-semibold",
		fontSize: 13,
		color: theme.destructive,
	},
});
