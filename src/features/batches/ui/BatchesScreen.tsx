import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { createBatchApi, getBatchesApi } from "@/features/batches/logic/batches-api";
import { Batch } from "@/features/batches/types/batches.types";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncState";

const TIME_OPTIONS = ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00"];

function formatRupee(amountStr: string): string {
	const amount = parseFloat(amountStr) || 0;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(amount);
}

function formatTimeDisplay(t: string): string {
	if (!t) return "Select Time";
	const parts = t.split(":");
	if (parts.length < 2) return t;
	let hour = parseInt(parts[0], 10);
	const min = parts[1];
	const ampm = hour >= 12 ? "PM" : "AM";
	hour = hour % 12 || 12;
	return `${hour < 10 ? "0" : ""}${hour}:${min} ${ampm}`;
}

export function BatchesScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const { data: batches, isLoading, error, refetch: fetchBatches } = useApiData(getBatchesApi, []);

	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [newName, setNewName] = useState("");
	const [newStartTime, setNewStartTime] = useState("");
	const [newEndTime, setNewEndTime] = useState("");
	const [newFee, setNewFee] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const [selectingTimeFor, setSelectingTimeFor] = useState<"start" | "end" | null>(null);

	const handleCreateBatch = async () => {
		setSubmitError(null);
		if (!newName || !newStartTime || !newEndTime || !newFee) {
			setSubmitError("Please fill out all fields.");
			return;
		}

		try {
			setIsSubmitting(true);
			await createBatchApi({
				name: newName,
				start_time: newStartTime,
				end_time: newEndTime,
				monthly_fee: newFee,
			});
			setIsAddModalVisible(false);
			setNewName("");
			setNewStartTime("");
			setNewEndTime("");
			setNewFee("");
			await fetchBatches();
		} catch (err: any) {
			setSubmitError(err.message || "Failed to create batch due to an unknown overlap.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const styles = createStyles(theme);
	const batchList = batches ?? [];

	const renderTimePicker = () => (
		<View style={styles.timePickerContainer}>
			<Text style={styles.timePickerTitle}>Select {selectingTimeFor === "start" ? "Start" : "End"} Time</Text>
			<ScrollView horizontal={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.timePickerGrid}>
				{TIME_OPTIONS.map((time) => (
					<Pressable
						key={time}
						style={styles.timePickerPill}
						onPress={() => {
							if (selectingTimeFor === "start") setNewStartTime(time);
							if (selectingTimeFor === "end") setNewEndTime(time);
							setSelectingTimeFor(null);
						}}>
						<Text style={styles.timePickerPillText}>{formatTimeDisplay(time)}</Text>
					</Pressable>
				))}
			</ScrollView>
			<Pressable style={styles.timePickerCancelBtn} onPress={() => setSelectingTimeFor(null)}>
				<Text style={styles.timePickerCancelText}>Cancel</Text>
			</Pressable>
		</View>
	);

	return (
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
						onPress={() => {
							setSubmitError(null);
							setIsAddModalVisible(true);
						}}>
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
						<View key={batch.id} style={styles.batchCard}>
							<View style={styles.batchHeader}>
								<View style={styles.batchTitleWrap}>
									<Text style={styles.batchName}>{batch.name}</Text>
									<View style={styles.timeWrap}>
										<Ionicons name="time-outline" size={14} color={theme.mutedForeground} />
										<Text style={styles.timeText}>
											{formatTimeDisplay(batch.start_time)} - {formatTimeDisplay(batch.end_time)}
										</Text>
									</View>
								</View>
								<View style={styles.priceBadge}>
									<Text style={styles.priceText}>{formatRupee(batch.monthly_fee)}</Text>
								</View>
							</View>
						</View>
					))
				)}
			</ScrollView>

			<Modal visible={isAddModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsAddModalVisible(false)}>
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						{selectingTimeFor ? (
							renderTimePicker()
						) : (
							<>
								<View style={styles.modalHeader}>
									<Text style={styles.modalTitle}>Create New Batch</Text>
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
											<Text style={[styles.modalTimeSelectorText, !newStartTime && { color: theme.mutedForeground + "80" }]}>{formatTimeDisplay(newStartTime)}</Text>
										</Pressable>
									</View>
									<View style={{ flex: 1 }}>
										<Text style={styles.inputLabel}>End Time</Text>
										<Pressable style={styles.modalTimeSelector} onPress={() => setSelectingTimeFor("end")}>
											<Ionicons name="time-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
											<Text style={[styles.modalTimeSelectorText, !newEndTime && { color: theme.mutedForeground + "80" }]}>{formatTimeDisplay(newEndTime)}</Text>
										</Pressable>
									</View>
								</View>

								<Text style={styles.inputLabel}>Monthly Fee (Rs)</Text>
								<TextInput style={styles.modalInput} placeholder="500" value={newFee} onChangeText={setNewFee} keyboardType="numeric" placeholderTextColor={theme.mutedForeground + "80"} />

								{submitError && (
									<View style={styles.errorBox}>
										<Ionicons name="alert-circle" size={18} color={theme.destructive} />
										<Text style={styles.errorText}>{submitError}</Text>
									</View>
								)}

								<Pressable style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleCreateBatch} disabled={isSubmitting}>
									{isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSubmitText}>Create Batch</Text>}
								</Pressable>
							</>
						)}
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</SafeAreaView>
	);
}

const createStyles = (theme: any) => StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: theme.background,
	},
	headerWrapper: {
		backgroundColor: theme.background,
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
	timePickerContainer: {
		height: 450,
	},
	timePickerTitle: {
		fontFamily: "sans-bold",
		fontSize: 18,
		color: theme.primary,
		marginBottom: 24,
		textAlign: "center",
	},
	timePickerGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: 12,
		paddingBottom: 20,
	},
	timePickerPill: {
		width: "30%",
		backgroundColor: theme.card,
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: "center",
		borderWidth: 1.5,
		borderColor: theme.border,
	},
	timePickerPillText: {
		fontFamily: "sans-bold",
		fontSize: 14,
		color: theme.primary,
	},
	timePickerCancelBtn: {
		padding: 16,
		alignItems: "center",
		marginTop: 12,
	},
	timePickerCancelText: {
		fontFamily: "sans-extrabold",
		fontSize: 16,
		color: theme.accent,
	},
});
