import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ID_PROOF_TYPE_LABELS, ID_PROOF_TYPE_OPTIONS, IdProofSide, IdProofType } from "@/features/admission/types/admission.types";
import { deactivateMemberApi, getMemberDetailApi, getMemberIdProofSource, updateMemberApi, uploadMemberIdProofApi } from "@/features/members/logic/members.api";
import { remindMemberApi } from "@/features/reminders/logic/reminders-api";
import { useApiData } from "@/shared/hooks/useApiData";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { ErrorState, LoadingState } from "@/shared/ui/AsyncState";
import { PhotoPickerSlot } from "@/shared/ui/PhotoPickerSlot";
import { SelectField } from "@/shared/ui/SelectField";
import { openWhatsAppMessage } from "@/shared/utils/whatsapp";

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

export function MemberDetailScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: member, isLoading, error, refetch } = useApiData(() => getMemberDetailApi(id), [id]);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isSendingSms, setIsSendingSms] = useState(false);
    const [loadingIdProofSide, setLoadingIdProofSide] = useState<IdProofSide | null>(null);
    const [idProofModalVisible, setIdProofModalVisible] = useState(false);
    const [idProofSource, setIdProofSource] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
    const [viewingSide, setViewingSide] = useState<IdProofSide | null>(null);

    const handleViewIdProof = useCallback(
        async (side: IdProofSide) => {
            if (!member) return;
            try {
                setLoadingIdProofSide(side);
                const source = await getMemberIdProofSource(member.id, side);
                setIdProofSource(source);
                setViewingSide(side);
                setIdProofModalVisible(true);
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to load ID proof.");
            } finally {
                setLoadingIdProofSide(null);
            }
        },
        [member]
    );

    const closeIdProofModal = useCallback(() => {
        setIdProofModalVisible(false);
        setIdProofSource(null);
        setViewingSide(null);
    }, []);

    // Adding an ID proof to a member who was admitted without one
    const [newIdProofType, setNewIdProofType] = useState<IdProofType | null>(null);
    const [newIdProofFrontUri, setNewIdProofFrontUri] = useState<string | null>(null);
    const [newIdProofBackUri, setNewIdProofBackUri] = useState<string | null>(null);
    const [isSavingIdProof, setIsSavingIdProof] = useState(false);

    const pickNewIdProofImage = useCallback(async (side: IdProofSide, source: "camera" | "gallery") => {
        const permission =
            source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            Alert.alert("Permission needed", `Please allow ${source === "camera" ? "camera" : "photo library"} access to attach an ID proof.`);
            return;
        }

        const result =
            source === "camera"
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true });

        if (!result.canceled && result.assets[0]) {
            (side === "front" ? setNewIdProofFrontUri : setNewIdProofBackUri)(result.assets[0].uri);
        }
    }, []);

    const handleAddIdProofPhoto = useCallback(
        (side: IdProofSide) => {
            Alert.alert(`Add ${side === "front" ? "Front" : "Back"} Photo`, undefined, [
                { text: "Take Photo", onPress: () => pickNewIdProofImage(side, "camera") },
                { text: "Choose from Gallery", onPress: () => pickNewIdProofImage(side, "gallery") },
                { text: "Cancel", style: "cancel" },
            ]);
        },
        [pickNewIdProofImage]
    );

    const handleSaveIdProof = useCallback(async () => {
        if (!member || !newIdProofType || !newIdProofFrontUri) return;
        try {
            setIsSavingIdProof(true);
            await uploadMemberIdProofApi(member.id, newIdProofType, "front", newIdProofFrontUri);
            if (newIdProofBackUri) {
                await uploadMemberIdProofApi(member.id, newIdProofType, "back", newIdProofBackUri);
            }
            setNewIdProofType(null);
            setNewIdProofFrontUri(null);
            setNewIdProofBackUri(null);
            await refetch();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save ID proof.");
        } finally {
            setIsSavingIdProof(false);
        }
    }, [member, newIdProofType, newIdProofFrontUri, newIdProofBackUri, refetch]);

    // Editing name/phone
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const openEditModal = useCallback(() => {
        if (!member) return;
        setEditName(member.name);
        setEditPhone(member.phone);
        setIsEditModalVisible(true);
    }, [member]);

    const handleSaveEdit = useCallback(async () => {
        if (!member) return;
        if (!editName.trim()) {
            Alert.alert("Error", "Please enter a name.");
            return;
        }
        if (editPhone.trim().length < 10) {
            Alert.alert("Error", "Please enter a valid 10-digit phone number.");
            return;
        }
        try {
            setIsSavingEdit(true);
            await updateMemberApi(member.id, { name: editName.trim(), phone: editPhone.trim() });
            setIsEditModalVisible(false);
            await refetch();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update member.");
        } finally {
            setIsSavingEdit(false);
        }
    }, [member, editName, editPhone, refetch]);

    const handleWhatsAppRemind = useCallback(async () => {
        if (!member) return;
        const dueAmountText = member.due_amount ? ` of ₹${Math.round(member.due_amount)}` : "";
        const message = `Dear ${member.name}, your library fee${dueAmountText} is overdue. Please pay at the earliest.`;
        try {
            await openWhatsAppMessage(member.phone, message);
        } catch {
            Alert.alert("Couldn't open WhatsApp", "Make sure WhatsApp is installed on this device.");
        }
    }, [member]);

    const handleSmsRemind = useCallback(async () => {
        if (!member) return;
        try {
            setIsSendingSms(true);
            await remindMemberApi(member.id);
            Alert.alert("Sent", `An SMS reminder was sent to ${member.name}.`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send SMS reminder.");
        } finally {
            setIsSendingSms(false);
        }
    }, [member]);

    const handleMarkAsLeft = useCallback(() => {
        if (!member) return;
        Alert.alert(
            "Mark as left?",
            `${member.name} will be marked inactive and their seat${member.allocations.length > 1 ? "s" : ""} will be freed up for new admissions.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mark as left",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsDeactivating(true);
                            await deactivateMemberApi(member.id);
                            router.back();
                        } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to update member.");
                        } finally {
                            setIsDeactivating(false);
                        }
                    },
                },
            ]
        );
    }, [member, router]);

    const styles = createStyles(theme);

    const getStatusColor = (payment_status: string) => (payment_status === "Paid" ? theme.success : theme.destructive);

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar style={theme.background === "#0C0A09" ? "light" : "dark"} />
            <View style={styles.header}>
                <Pressable accessibilityRole="button" style={styles.headerActionCircle} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Member Details</Text>
                </View>
            </View>

            {isLoading ? (
                <LoadingState />
            ) : error || !member ? (
                <ErrorState message={error || "Member not found."} onRetry={refetch} />
            ) : (
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                    <View style={styles.profileBlock}>
                        <View style={[styles.avatar, { backgroundColor: getStatusColor(member.payment_status) + "15" }]}>
                            <Text style={[styles.avatarText, { color: getStatusColor(member.payment_status) }]}>{getInitials(member.name)}</Text>
                        </View>
                        <View style={styles.nameRow}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <Pressable accessibilityRole="button" style={styles.editIconBtn} onPress={openEditModal}>
                                <Ionicons name="pencil" size={14} color={theme.mutedForeground} />
                            </Pressable>
                        </View>
                        <Text style={styles.memberPhone}>{member.phone}</Text>
                        <View style={[styles.badge, { backgroundColor: getStatusColor(member.payment_status) + "15" }]}>
                            <Text style={[styles.badgeText, { color: getStatusColor(member.payment_status) }]}>{member.payment_status}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Batches & Seats</Text>
                    {member.allocations.length === 0 ? (
                        <Text style={styles.emptyText}>No active batch allocations.</Text>
                    ) : (
                        member.allocations.map((allocation) => (
                            <View key={`${allocation.batch_id}-${allocation.seat_id}`} style={styles.allocationCard}>
                                <View style={styles.allocationIconBox}>
                                    <Ionicons name="grid-outline" size={20} color={theme.accent} />
                                </View>
                                <View style={styles.allocationInfo}>
                                    <Text style={styles.allocationBatch}>{allocation.batch_name}</Text>
                                    <Text style={styles.allocationMeta}>Seat {allocation.seat_number} · Renews {allocation.renewal_date}</Text>
                                </View>
                            </View>
                        ))
                    )}

                    {member.has_id_proof_front ? (
                        <View style={styles.idProofBlock}>
                            <Text style={styles.sectionTitle}>ID Proof</Text>
                            <Pressable style={styles.idProofRow} onPress={() => handleViewIdProof("front")} disabled={loadingIdProofSide === "front"}>
                                <View style={styles.allocationIconBox}>
                                    <Ionicons name="card-outline" size={20} color={theme.accent} />
                                </View>
                                <Text style={styles.idProofTypeText}>
                                    {member.id_proof_type ? ID_PROOF_TYPE_LABELS[member.id_proof_type as IdProofType] : "ID Proof"} · Front
                                </Text>
                                {loadingIdProofSide === "front" ? (
                                    <ActivityIndicator color={theme.mutedForeground} size="small" />
                                ) : (
                                    <Ionicons name="eye-outline" size={20} color={theme.mutedForeground} />
                                )}
                            </Pressable>
                            {member.has_id_proof_back && (
                                <Pressable style={[styles.idProofRow, styles.idProofRowSpacing]} onPress={() => handleViewIdProof("back")} disabled={loadingIdProofSide === "back"}>
                                    <View style={styles.allocationIconBox}>
                                        <Ionicons name="card-outline" size={20} color={theme.accent} />
                                    </View>
                                    <Text style={styles.idProofTypeText}>
                                        {member.id_proof_type ? ID_PROOF_TYPE_LABELS[member.id_proof_type as IdProofType] : "ID Proof"} · Back
                                    </Text>
                                    {loadingIdProofSide === "back" ? (
                                        <ActivityIndicator color={theme.mutedForeground} size="small" />
                                    ) : (
                                        <Ionicons name="eye-outline" size={20} color={theme.mutedForeground} />
                                    )}
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        <View style={styles.idProofBlock}>
                            <Text style={styles.sectionTitle}>ID Proof</Text>
                            <Text style={styles.emptyText}>No ID proof on file yet.</Text>
                            <SelectField label="ID Type" placeholder="Select ID type" value={newIdProofType} options={ID_PROOF_TYPE_OPTIONS} onChange={setNewIdProofType} />

                            <PhotoPickerSlot
                                label="Front Side"
                                uri={newIdProofFrontUri}
                                onAdd={() => handleAddIdProofPhoto("front")}
                                onRemove={() => setNewIdProofFrontUri(null)}
                            />
                            <PhotoPickerSlot
                                label="Back Side (Optional)"
                                uri={newIdProofBackUri}
                                onAdd={() => handleAddIdProofPhoto("back")}
                                onRemove={() => setNewIdProofBackUri(null)}
                            />

                            {newIdProofType && newIdProofFrontUri && (
                                <Pressable style={[styles.idProofSaveBtn, isSavingIdProof && { opacity: 0.7 }]} onPress={handleSaveIdProof} disabled={isSavingIdProof}>
                                    {isSavingIdProof ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.idProofSaveBtnText}>Save ID Proof</Text>}
                                </Pressable>
                            )}
                        </View>
                    )}

                    {member.payment_status === "Due" && (
                        <View style={styles.remindBlock}>
                            <Text style={styles.sectionTitle}>Send a Reminder</Text>
                            {member.due_amount ? <Text style={styles.remindAmount}>₹{Math.round(member.due_amount)} due</Text> : null}
                            <View style={styles.remindButtonsRow}>
                                <Pressable style={[styles.remindBtn, styles.whatsappBtn]} onPress={handleWhatsAppRemind}>
                                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                    <Text style={styles.remindBtnText}>WhatsApp</Text>
                                </Pressable>
                                <Pressable style={[styles.remindBtn, styles.smsBtn]} onPress={handleSmsRemind} disabled={isSendingSms}>
                                    {isSendingSms ? (
                                        <ActivityIndicator color={theme.primary} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.primary} />
                                            <Text style={[styles.remindBtnText, { color: theme.primary }]}>SMS</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    )}

                    <Pressable style={[styles.leaveButton, isDeactivating && { opacity: 0.7 }]} onPress={handleMarkAsLeft} disabled={isDeactivating}>
                        {isDeactivating ? (
                            <ActivityIndicator color={theme.destructive} size="small" />
                        ) : (
                            <>
                                <Ionicons name="exit-outline" size={18} color={theme.destructive} />
                                <Text style={styles.leaveButtonText}>Mark as Left</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            )}

            <Modal visible={idProofModalVisible} transparent animationType="fade" onRequestClose={closeIdProofModal}>
                <View style={styles.idProofModalOverlay}>
                    <Pressable style={styles.idProofModalCloseBtn} onPress={closeIdProofModal}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </Pressable>
                    {viewingSide && <Text style={styles.idProofModalLabel}>{viewingSide === "front" ? "Front" : "Back"}</Text>}
                    {idProofSource ? (
                        <Image source={idProofSource} style={styles.idProofModalImage} resizeMode="contain" />
                    ) : (
                        <ActivityIndicator color="#fff" size="large" />
                    )}
                </View>
            </Modal>

            <Modal visible={isEditModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditModalVisible(false)}>
                <Pressable style={styles.editModalOverlay} onPress={() => setIsEditModalVisible(false)} />
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editModalSheetWrap}>
                    <View style={styles.editModalSheet}>
                        <Text style={styles.editModalTitle}>Edit Member</Text>

                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput style={styles.inputField} value={editName} onChangeText={setEditName} autoCapitalize="words" placeholder="e.g. John Doe" placeholderTextColor={theme.mutedForeground + "80"} />

                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <TextInput
                            style={styles.inputField}
                            value={editPhone}
                            onChangeText={setEditPhone}
                            keyboardType="phone-pad"
                            maxLength={15}
                            placeholder="10-digit mobile number"
                            placeholderTextColor={theme.mutedForeground + "80"}
                        />

                        <Pressable style={[styles.editSaveBtn, isSavingEdit && { opacity: 0.7 }]} onPress={handleSaveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.editSaveBtnText}>Save Changes</Text>}
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
            fontSize: 20,
            color: theme.primary,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40,
        },
        profileBlock: {
            alignItems: "center",
            marginBottom: 32,
        },
        avatar: {
            width: 88,
            height: 88,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
        },
        avatarText: {
            fontFamily: "sans-extrabold",
            fontSize: 28,
        },
        nameRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
        },
        memberName: {
            fontFamily: "sans-extrabold",
            fontSize: 22,
            color: theme.primary,
        },
        editIconBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
        },
        memberPhone: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 12,
        },
        badge: {
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 10,
        },
        badgeText: {
            fontFamily: "sans-extrabold",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        sectionTitle: {
            fontFamily: "sans-bold",
            fontSize: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: theme.mutedForeground,
            marginBottom: 12,
        },
        emptyText: {
            fontFamily: "sans-medium",
            fontSize: 14,
            color: theme.mutedForeground,
            marginBottom: 24,
        },
        allocationCard: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        allocationIconBox: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.accent + "15",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
        },
        allocationInfo: {
            flex: 1,
        },
        allocationBatch: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.primary,
            marginBottom: 2,
        },
        allocationMeta: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
        },
        idProofBlock: {
            marginTop: 24,
        },
        idProofRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        idProofRowSpacing: {
            marginTop: 10,
        },
        idProofTypeText: {
            flex: 1,
            fontFamily: "sans-bold",
            fontSize: 15,
            color: theme.primary,
        },
        idProofModalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            alignItems: "center",
            justifyContent: "center",
        },
        idProofModalCloseBtn: {
            position: "absolute",
            top: 50,
            right: 20,
            zIndex: 1,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
        },
        idProofModalImage: {
            width: "100%",
            height: "70%",
        },
        idProofModalLabel: {
            fontFamily: "sans-bold",
            fontSize: 14,
            color: "#fff",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        idProofSaveBtn: {
            backgroundColor: theme.accent,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 16,
        },
        idProofSaveBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: "#fff",
        },
        editModalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        editModalSheetWrap: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
        },
        editModalSheet: {
            backgroundColor: theme.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 32,
        },
        editModalTitle: {
            fontFamily: "sans-extrabold",
            fontSize: 18,
            color: theme.primary,
            marginBottom: 20,
        },
        inputLabel: {
            fontFamily: "sans-bold",
            fontSize: 13,
            color: theme.primary,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 1,
        },
        inputField: {
            fontFamily: "sans-medium",
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 15,
            color: theme.primary,
            marginBottom: 16,
        },
        editSaveBtn: {
            backgroundColor: theme.accent,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 8,
        },
        editSaveBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: "#fff",
        },
        remindBlock: {
            marginTop: 24,
        },
        remindAmount: {
            fontFamily: "sans-extrabold",
            fontSize: 16,
            color: theme.destructive,
            marginBottom: 12,
        },
        remindButtonsRow: {
            flexDirection: "row",
            gap: 10,
        },
        remindBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 16,
            paddingVertical: 14,
        },
        whatsappBtn: {
            backgroundColor: "#25D366",
        },
        smsBtn: {
            backgroundColor: theme.card,
            borderWidth: 1.5,
            borderColor: theme.border,
        },
        remindBtnText: {
            fontFamily: "sans-extrabold",
            fontSize: 14,
            color: "#fff",
        },
        leaveButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.destructive + "15",
            borderRadius: 16,
            paddingVertical: 16,
            marginTop: 20,
            borderWidth: 1.5,
            borderColor: theme.destructive + "30",
        },
        leaveButtonText: {
            fontFamily: "sans-extrabold",
            fontSize: 15,
            color: theme.destructive,
        },
    });
