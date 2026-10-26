import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthUser } from "@/features/auth/types/auth.types";
import { getDashboardApi } from "@/features/home/logic/home-api";
import { pickProfilePhoto, uploadProfilePhoto } from "@/features/settings/logic/profile-photo";
import { handleLogout } from "@/features/settings/logic/settings-logic";
import { getSubscriptionApi, subscriptionChipLabel } from "@/features/subscription/logic/subscription-api";
import { getMeApi, getStoredAuthUser, updateProfileApi, updateStoredAuthUser } from "@/services/api/auth.api";
import { updateNotificationSettingsApi } from "@/services/api/push.api";
import { registerForPushNotifications } from "@/services/push/push-notifications";
import { FLOATING_SHADOW, RADIUS } from "@/shared/constants/layout";
import { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet, TEXT_SCALE } from "@/shared/constants/ui-scale";
import { useApiData } from "@/shared/hooks/useApiData";
import { useScreenBottomInset } from "@/shared/hooks/useScreenBottomInset";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { useActionSheet } from "@/shared/ui/ActionSheet";
import { PhotoViewer } from "@/shared/ui/PhotoViewer";
import { PoweredBy } from "@/shared/ui/PoweredBy";
import { ScreenBackground } from "@/shared/ui/ScreenBackground";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Text, TextInput } from "@/shared/ui/Text";
import { showToast } from "@/shared/ui/Toast";
import { getInitials } from "@/shared/utils/text";

type IconName = keyof typeof Ionicons.glyphMap;

/** Icon tile colours per row, like iOS Settings: each kind of setting keeps its own colour. */
const TINTS = {
    library: "#0EA5E9",
    batches: "#8B5CF6",
    location: "#10B981",
    photos: "#EC4899",
    facilities: "#F59E0B",
    appearance: "#6366F1",
    notifications: "#E26D4D",
    password: "#64748B",
};

const THEME_MODES = [
    { key: "system" as const, label: "System", hint: "Match your phone's setting", icon: "phone-portrait-outline" as IconName },
    { key: "light" as const, label: "Light", hint: "Always light", icon: "sunny-outline" as IconName },
    { key: "dark" as const, label: "Dark", hint: "Always dark", icon: "moon-outline" as IconName },
];

/**
 * Settings: the owner's profile and plan up top, then grouped rows (iOS Settings style) for the
 * library, app preferences and the account. Reached from the profile button on Home.
 */
export function SettingsScreen() {
    const router = useRouter();
    const { theme, mode, setMode } = useTheme();
    const bottomInset = useScreenBottomInset();
    const window = useWindowDimensions();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [user, setUser] = useState<AuthUser | null>(null);
    const { data: dashboard } = useApiData(getDashboardApi, []);
    const { data: subscription, refetch: refetchSubscription } = useApiData(getSubscriptionApi, []);

    // Pick up a plan change when coming back from the Subscription screen.
    useFocusEffect(
        useCallback(() => {
            void refetchSubscription();
        }, [refetchSubscription])
    );

    const planColor = subscription
        ? { trial: theme.accent, active: theme.success, grace: theme.warning, expired: theme.destructive }[subscription.state]
        : theme.mutedForeground;

    useEffect(() => {
        const loadUser = async () => {
            setUser(await getStoredAuthUser());
            // The cached copy can be stale (e.g. photo URL), so refresh it from the server.
            try {
                const freshUser = await getMeApi();
                await updateStoredAuthUser(freshUser);
                setUser(freshUser);
            } catch {
                // Offline or token issue - keep showing the cached user.
            }
        };
        void loadUser();
    }, []);

    // --- Profile photo -----------------------------------------------------------------------
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);

    const handleChangePhoto = useCallback(async () => {
        const uri = await pickProfilePhoto();
        if (!uri) return;
        try {
            setIsUploadingPhoto(true);
            setUser(await uploadProfilePhoto(uri));
        } catch (err: any) {
            showToast({ message: err.message || "Failed to upload photo.", tone: "error" });
        } finally {
            setIsUploadingPhoto(false);
        }
    }, []);

    // --- Edit profile ------------------------------------------------------------------------
    const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
    const [editProfileName, setEditProfileName] = useState("");
    const [editProfilePhone, setEditProfilePhone] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const openEditProfile = useCallback(() => {
        if (!user) return;
        setEditProfileName(user.name);
        setEditProfilePhone(user.phone);
        setIsEditProfileVisible(true);
    }, [user]);

    const handleSaveProfile = useCallback(async () => {
        if (!editProfileName.trim()) {
            showToast({ message: "Please enter your name.", tone: "error" });
            return;
        }
        if (editProfilePhone.trim().length < 10) {
            showToast({ message: "Please enter a valid 10-digit phone number.", tone: "error" });
            return;
        }
        try {
            setIsSavingProfile(true);
            const response = await updateProfileApi({ name: editProfileName.trim(), phone: editProfilePhone.trim() });
            await updateStoredAuthUser(response.user);
            setUser(response.user);
            setIsEditProfileVisible(false);
        } catch (err: any) {
            showToast({ message: err.message || "Failed to update profile.", tone: "error" });
        } finally {
            setIsSavingProfile(false);
        }
    }, [editProfileName, editProfilePhone]);

    // Confirmations and the blocked-notifications prompt, as sheets rather than system alerts.
    const actionSheet = useActionSheet();
    const openSheet = actionSheet.open;

    // --- Notifications -----------------------------------------------------------------------
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const notificationsOn = user?.push_notifications_enabled ?? true;

    const handleToggleNotifications = useCallback(
        async (enabled: boolean) => {
            if (!user) return;
            setIsSavingNotifications(true);
            try {
                if (enabled && (await registerForPushNotifications()) === "denied") {
                    openSheet({
                        title: "Notifications are blocked",
                        message: "Allow notifications for Librum in your phone's settings, then turn this on again.",
                        confirm: true,
                        cancelLabel: "Not now",
                        actions: [{ label: "Open phone settings", icon: "settings-outline", tone: "primary", onPress: () => void Linking.openSettings() }],
                    });
                    return;
                }
                const response = await updateNotificationSettingsApi(enabled);
                const updated = { ...user, push_notifications_enabled: response.data.push_notifications_enabled };
                await updateStoredAuthUser(updated);
                setUser(updated);
            } catch (err: any) {
                showToast({ message: err.message || "Couldn't update notifications.", tone: "error" });
            } finally {
                setIsSavingNotifications(false);
            }
        },
        [user, openSheet]
    );

    // --- Appearance ------------------------------------------------------------------------
    const [isAppearanceVisible, setIsAppearanceVisible] = useState(false);

    // --- Log out -----------------------------------------------------------------------------
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const onLogout = useCallback(() => {
        openSheet({
            title: "Log out?",
            message: "You'll need your phone number and password to sign in again.",
            confirm: true,
            actions: [
                {
                    label: "Log out",
                    icon: "log-out-outline",
                    tone: "destructive",
                    onPress: async () => {
                        setIsLoggingOut(true);
                        try {
                            await handleLogout();
                        } finally {
                            setIsLoggingOut(false);
                        }
                    },
                },
            ],
        });
    }, [openSheet]);

    const hasPhoto = !!user?.profile_photo_url;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safe} edges={["top"]}>
                <ScreenHeader title="Settings" subtitle={dashboard?.library_name ?? "Your library and account"} />

                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + bottomInset }]} showsVerticalScrollIndicator={false}>
                    {/* Profile: photo (tap to view, camera to change), who you are, and Edit. */}
                    <View style={styles.profileCard}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={hasPhoto ? "View profile photo" : "Add profile photo"}
                            onPress={hasPhoto ? () => setIsPhotoPreviewVisible(true) : handleChangePhoto}
                            disabled={isUploadingPhoto}
                            style={styles.avatarWrap}
                        >
                            <View style={styles.avatar}>
                                {hasPhoto ? (
                                    <Image source={{ uri: user!.profile_photo_url! }} style={styles.avatarImage} transition={150} />
                                ) : (
                                    <Text style={styles.avatarInitials}>{getInitials(user?.name || "")}</Text>
                                )}
                                {isUploadingPhoto && (
                                    <View style={styles.avatarOverlay}>
                                        <ActivityIndicator color="#fff" />
                                    </View>
                                )}
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Change profile photo"
                                style={styles.cameraBadge}
                                onPress={handleChangePhoto}
                                disabled={isUploadingPhoto}
                                hitSlop={8}
                            >
                                <Ionicons name="camera" size={12} color={theme.background} />
                            </Pressable>
                        </Pressable>
                        <View style={styles.profileText}>
                            <Text style={styles.profileName} numberOfLines={1}>
                                {user?.name ?? " "}
                            </Text>
                            <Text style={styles.profileMeta} numberOfLines={1}>
                                {[dashboard?.library_name, user?.phone].filter(Boolean).join(" · ")}
                            </Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={openEditProfile} disabled={!user} style={({ pressed }) => [styles.editPill, pressed && styles.pressed]}>
                            <Text style={styles.editPillText}>Edit</Text>
                        </Pressable>
                    </View>

                    {/* Plan: the one thing here with a status, so it gets its own card. */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Plan and billing${subscription ? `, ${subscriptionChipLabel(subscription)}` : ""}`}
                        onPress={() => router.push("/subscription")}
                        style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
                    >
                        <View style={[styles.tile, { backgroundColor: planColor }]}>
                            <Ionicons name="diamond" size={16} color="#fff" />
                        </View>
                        <View style={styles.planText}>
                            <Text style={styles.rowLabel}>Plan & Billing</Text>
                            <Text style={[styles.planStatus, { color: planColor }]}>{subscription ? subscriptionChipLabel(subscription) : "Loading…"}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
                    </Pressable>

                    <Group title="Library" styles={styles}>
                        <Row
                            icon="business"
                            tint={TINTS.library}
                            label="Name & seats"
                            value={dashboard ? `${dashboard.total_seats} seats` : undefined}
                            onPress={() => router.push("/library-profile")}
                            styles={styles}
                            theme={theme}
                        />
                        <Row
                            icon="layers"
                            tint={TINTS.batches}
                            label="Batches & timings"
                            value={dashboard ? `${dashboard.batch_occupancy.length} batch${dashboard.batch_occupancy.length === 1 ? "" : "es"}` : undefined}
                            onPress={() => router.push("/batches")}
                            styles={styles}
                            theme={theme}
                        />
                        <Row
                            icon="location"
                            tint={TINTS.location}
                            label="Location"
                            value={dashboard ? (dashboard.library_address ? "Set" : "Not set") : undefined}
                            valueTone={dashboard && !dashboard.library_address ? "warning" : undefined}
                            onPress={() => router.push("/library-location")}
                            styles={styles}
                            theme={theme}
                        />
                        <Row icon="images" tint={TINTS.photos} label="Photos" onPress={() => router.push("/library-photos")} styles={styles} theme={theme} />
                        <Row
                            icon="star"
                            tint={TINTS.facilities}
                            label="Facilities"
                            hint="AC, Wi-Fi, newspaper and more"
                            onPress={() => router.push("/library-amenities")}
                            styles={styles}
                            theme={theme}
                            isLast
                        />
                    </Group>

                    <Group title="Preferences" styles={styles}>
                        <Row
                            icon="contrast"
                            tint={TINTS.appearance}
                            label="Appearance"
                            value={THEME_MODES.find((m) => m.key === mode)?.label}
                            onPress={() => setIsAppearanceVisible(true)}
                            styles={styles}
                            theme={theme}
                        />
                        <Row
                            icon="notifications"
                            tint={TINTS.notifications}
                            label="Notifications"
                            hint="Dues, renewals, batch starts and plan alerts"
                            styles={styles}
                            theme={theme}
                            isLast
                            right={
                                isSavingNotifications ? (
                                    <ActivityIndicator color={theme.accent} />
                                ) : (
                                    <Switch
                                        value={notificationsOn}
                                        onValueChange={handleToggleNotifications}
                                        disabled={!user}
                                        trackColor={{ false: theme.muted, true: theme.accent }}
                                        thumbColor="#fff"
                                        accessibilityLabel="Push notifications"
                                    />
                                )
                            }
                        />
                    </Group>

                    <Group title="Account" styles={styles}>
                        <Row icon="key" tint={TINTS.password} label="Change password" onPress={() => router.push("/change-password")} styles={styles} theme={theme} isLast />
                    </Group>

                    <Pressable
                        accessibilityRole="button"
                        onPress={onLogout}
                        disabled={isLoggingOut}
                        style={({ pressed }) => [styles.logout, (pressed || isLoggingOut) && styles.pressed]}
                    >
                        {isLoggingOut ? <ActivityIndicator color={theme.destructive} /> : <Text style={styles.logoutText}>Log out</Text>}
                    </Pressable>

                    <PoweredBy style={styles.footer}>
                        <Text style={styles.version}>v1.0.0</Text>
                    </PoweredBy>
                    {/* Development builds only: the numbers that decide how big text looks on this phone. */}
                    {__DEV__ && (
                        <Text style={styles.devInfo} selectable>
                            {`${Platform.OS} · screen ${Math.round(window.width)} × ${Math.round(window.height)} · system text ${Math.round(PixelRatio.getFontScale() * 100)}% · pixel ratio ${PixelRatio.get()} · ui scale ${Math.round(TEXT_SCALE * 100)}%`}
                        </Text>
                    )}
                </ScrollView>

                <PhotoViewer
                    visible={isPhotoPreviewVisible}
                    photos={hasPhoto ? [{ key: "profile", uri: user!.profile_photo_url! }] : []}
                    onClose={() => setIsPhotoPreviewVisible(false)}
                    renderFooter={() => (
                        <Pressable
                            accessibilityRole="button"
                            style={styles.previewChangeBtn}
                            onPress={() => {
                                setIsPhotoPreviewVisible(false);
                                void handleChangePhoto();
                            }}
                        >
                            <Ionicons name="camera-outline" size={18} color="#fff" />
                            <Text style={styles.previewChangeText}>Change photo</Text>
                        </Pressable>
                    )}
                />

                {/* Appearance: pick System / Light / Dark; the app switches as soon as one is tapped. */}
                {actionSheet.sheet}

                <BottomSheet visible={isAppearanceVisible} onClose={() => setIsAppearanceVisible(false)} title="Appearance">
                    <View style={[styles.groupCard, styles.optionList]}>
                        {THEME_MODES.map((option, index) => {
                            const selected = option.key === mode;
                            return (
                                <Pressable
                                    key={option.key}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                    onPress={() => {
                                        setMode(option.key);
                                        setIsAppearanceVisible(false);
                                    }}
                                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                                >
                                    <Ionicons name={option.icon} size={20} color={selected ? theme.accent : theme.mutedForeground} style={styles.optionIcon} />
                                    <View style={[styles.rowMain, index < THEME_MODES.length - 1 && styles.rowDivider]}>
                                        <View style={styles.rowText}>
                                            <Text style={styles.rowLabel}>{option.label}</Text>
                                            <Text style={styles.rowHint}>{option.hint}</Text>
                                        </View>
                                        {selected && <Ionicons name="checkmark" size={20} color={theme.accent} />}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </BottomSheet>

                <BottomSheet visible={isEditProfileVisible} onClose={() => setIsEditProfileVisible(false)} title="Edit profile">
                    <Text style={styles.inputLabel}>Your name</Text>
                    <TextInput
                        style={styles.input}
                        value={editProfileName}
                        onChangeText={setEditProfileName}
                        autoCapitalize="words"
                        placeholder="e.g. Suresh Kumar"
                        placeholderTextColor={theme.mutedForeground + "80"}
                    />

                    <Text style={styles.inputLabel}>Phone number</Text>
                    <TextInput
                        style={styles.input}
                        value={editProfilePhone}
                        onChangeText={setEditProfilePhone}
                        keyboardType="phone-pad"
                        maxLength={15}
                        placeholder="10-digit mobile number"
                        placeholderTextColor={theme.mutedForeground + "80"}
                    />
                    <Text style={styles.inputHint}>This is the number you sign in with.</Text>

                    <Pressable style={({ pressed }) => [styles.saveBtn, (pressed || isSavingProfile) && styles.pressed]} onPress={handleSaveProfile} disabled={isSavingProfile}>
                        {isSavingProfile ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
                    </Pressable>
                </BottomSheet>
            </SafeAreaView>
        </ScreenBackground>
    );
}

type Styles = ReturnType<typeof createStyles>;

/** A titled card of rows; rows split by hairlines that start at the label. */
function Group({ title, styles, children }: { title: string; styles: Styles; children: ReactNode }) {
    return (
        <View style={styles.group}>
            <Text style={styles.groupTitle}>{title}</Text>
            <View style={styles.groupCard}>{children}</View>
        </View>
    );
}

/** One setting: coloured icon tile, label (and hint), an optional value, then a chevron or a control. */
function Row({
    icon,
    tint,
    label,
    hint,
    value,
    valueTone,
    onPress,
    right,
    isLast = false,
    styles,
    theme,
}: {
    icon: IconName;
    tint: string;
    label: string;
    hint?: string;
    value?: string;
    valueTone?: "warning";
    onPress?: () => void;
    right?: ReactNode;
    isLast?: boolean;
    styles: Styles;
    theme: Theme;
}) {
    const content = (
        <>
            <View style={[styles.tile, { backgroundColor: tint }]}>
                <Ionicons name={icon} size={16} color="#fff" />
            </View>
            <View style={[styles.rowMain, !isLast && styles.rowDivider]}>
                <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
                </View>
                {value ? <Text style={[styles.rowValue, valueTone === "warning" && { color: theme.warning }]}>{value}</Text> : null}
                {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /> : null)}
            </View>
        </>
    );

    return onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            {content}
        </Pressable>
    ) : (
        <View style={styles.row}>{content}</View>
    );
}

const TILE = 30;
const ROW_PADDING = 14;

const createStyles = (theme: Theme) =>
    ScaledSheet.create({
        safe: {
            flex: 1,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 16,
        },
        pressed: {
            opacity: 0.7,
        },
        profileCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            padding: 16,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        avatarWrap: {
            width: 60,
            height: 60,
        },
        avatar: {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
        },
        avatarImage: {
            width: "100%",
            height: "100%",
        },
        avatarInitials: {
            fontFamily: "sans-semibold",
            fontSize: 20,
            color: "#fff",
        },
        avatarOverlay: {
            ...StyleSheet.absoluteFill,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
        },
        cameraBadge: {
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.primary,
            borderWidth: 2,
            borderColor: theme.card,
            alignItems: "center",
            justifyContent: "center",
        },
        profileText: {
            flex: 1,
        },
        profileName: {
            fontFamily: "sans-semibold",
            fontSize: 17,
            color: theme.primary,
        },
        profileMeta: {
            fontFamily: "sans-regular",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 3,
        },
        editPill: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: RADIUS.sm,
            backgroundColor: theme.muted,
        },
        editPillText: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.primary,
        },
        planCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            paddingHorizontal: ROW_PADDING,
            paddingVertical: 13,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        planText: {
            flex: 1,
        },
        planStatus: {
            fontFamily: "sans-medium",
            fontSize: 13,
            marginTop: 2,
        },
        group: {
            marginTop: 24,
        },
        groupTitle: {
            fontFamily: "sans-semibold",
            fontSize: 13,
            color: theme.mutedForeground,
            marginBottom: 8,
            paddingLeft: 4,
        },
        groupCard: {
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: "hidden",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: ROW_PADDING,
        },
        rowPressed: {
            backgroundColor: theme.muted,
        },
        tile: {
            width: TILE,
            height: TILE,
            borderRadius: RADIUS.sm,
            alignItems: "center",
            justifyContent: "center",
        },
        rowMain: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
            paddingVertical: 13,
            paddingRight: ROW_PADDING,
            minHeight: 50,
        },
        rowDivider: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.mutedForeground + "33",
        },
        rowText: {
            flex: 1,
        },
        rowLabel: {
            fontFamily: "sans-medium",
            fontSize: 15,
            color: theme.primary,
        },
        rowHint: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 2,
        },
        rowValue: {
            fontFamily: "sans-regular",
            fontSize: 14,
            color: theme.mutedForeground,
        },
        // The Appearance sheet's options: a plain icon where Settings rows have a coloured tile.
        optionList: {
            marginTop: 8,
        },
        optionIcon: {
            width: TILE,
            textAlign: "center",
        },
        logout: {
            marginTop: 24,
            alignItems: "center",
            paddingVertical: 15,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        logoutText: {
            fontFamily: "sans-semibold",
            fontSize: 15,
            color: theme.destructive,
        },
        footer: {
            marginTop: 28,
        },
        version: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
        },
        devInfo: {
            fontFamily: "sans-regular",
            fontSize: 11,
            color: theme.mutedForeground,
            textAlign: "center",
            marginTop: 8,
        },
        previewChangeBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: RADIUS.lg,
            backgroundColor: theme.accent,
        },
        previewChangeText: {
            ...BUTTON_TEXT,
            color: "#fff",
        },
        inputLabel: {
            fontFamily: "sans-medium",
            fontSize: 13,
            color: theme.mutedForeground,
            marginTop: 14,
            marginBottom: 6,
        },
        input: {
            height: 48,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            fontFamily: "sans-regular",
            fontSize: 15,
            color: theme.primary,
        },
        inputHint: {
            fontFamily: "sans-regular",
            fontSize: 12,
            color: theme.mutedForeground,
            marginTop: 6,
        },
        saveBtn: {
            marginTop: 22,
            alignItems: "center",
            paddingVertical: 15,
            borderRadius: RADIUS.md,
            backgroundColor: theme.accent,
        },
        saveBtnText: {
            ...BUTTON_TEXT,
            color: "#fff",
        },
    });
