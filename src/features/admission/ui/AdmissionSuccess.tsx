import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { MemberAvatar } from "@/shared/ui/MemberAvatar";
import { Text } from "@/shared/ui/Text";
import { formatRupee } from "@/shared/utils/currency";
import { formatShortDate } from "@/shared/utils/dates";
import { haptics } from "@/shared/utils/haptics";

export type AdmissionResult = {
	memberId: number;
	name: string;
	phone: string;
	isReadmission: boolean;
	/** One per batch: where they sit and when. */
	seats: { batchName: string; time: string; seatNumber: string }[];
	/** "YYYY-MM-DD" their seat starts. */
	startDate: string;
	monthlyFee: number;
	/** Null when nothing was collected ("Pay later"). */
	payment: { amount: number; modeLabel: string; covers: string; stillDue: number } | null;
	/** "YYYY-MM-DD" they owe from when nothing was paid. */
	dueFrom: string;
	/** Previous dues on readmission: what was collected or written off, as one line. */
	settlementNote?: string;
	idProofFailed: boolean;
};

type Props = {
	result: AdmissionResult;
	onWhatsApp: () => void;
	onViewMember: () => void;
	onAdmitAnother: () => void;
	onDone: () => void;
};

/**
 * Shown in place of the form once an admission is saved: a tick, the seat "ticket", what was paid,
 * and the next things an owner usually does (welcome message, open the profile, admit the next one).
 */
export function AdmissionSuccess({ result, onWhatsApp, onViewMember, onAdmitAnother, onDone }: Props) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const insets = useSafeAreaInsets();

	const tick = useSharedValue(0);
	const ring = useSharedValue(0);
	const content = useSharedValue(0);

	// The tick pops in, a ring ripples out once, then the details rise into place.
	useEffect(() => {
		haptics.success();
		tick.value = withSpring(1, { damping: 11, stiffness: 180 });
		ring.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
		content.value = withDelay(180, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
	}, [tick, ring, content]);

	const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tick.value }] }));
	const ringStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.9 }] }));
	const contentStyle = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateY: (1 - content.value) * 18 }] }));

	const { payment } = result;

	return (
		<ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
			<View style={styles.hero}>
				<View style={styles.tickWrap}>
					<Animated.View style={[styles.ring, ringStyle]} />
					<Animated.View style={[styles.tick, tickStyle]}>
						<Ionicons name="checkmark" size={40} color="#fff" />
					</Animated.View>
				</View>
				<Text style={styles.title}>{result.isReadmission ? "Welcome back!" : "Admission confirmed"}</Text>
				<Text style={styles.subtitle}>
					{result.name} {result.isReadmission ? "is back" : "is in"} from {formatShortDate(result.startDate, true)}
				</Text>
			</View>

			<Animated.View style={contentStyle}>
				{/* The seat "ticket": who, where, when. */}
				<View style={styles.ticket}>
					<View style={styles.ticketHead}>
						<MemberAvatar id={result.memberId} name={result.name} size={40} />
						<View style={styles.ticketHeadText}>
							<Text style={styles.ticketName} numberOfLines={1}>
								{result.name}
							</Text>
							<Text style={styles.ticketMeta}>+91 {result.phone}</Text>
						</View>
					</View>

					{/* A dashed tear line, like a ticket stub. */}
					<View style={styles.tear}>
						<View style={[styles.notch, styles.notchLeft]} />
						<View style={styles.dashes}>
							{Array.from({ length: DASHES }, (_, i) => (
								<View key={i} style={styles.dash} />
							))}
						</View>
						<View style={[styles.notch, styles.notchRight]} />
					</View>

					{result.seats.map((seat) => (
						<View key={`${seat.batchName}-${seat.seatNumber}`} style={styles.seatRow}>
							<View style={styles.seatBadge}>
								<Text style={styles.seatBadgeLabel}>SEAT</Text>
								<Text style={styles.seatBadgeNumber} numberOfLines={1} adjustsFontSizeToFit>
									{seat.seatNumber}
								</Text>
							</View>
							<View style={styles.seatText}>
								<Text style={styles.seatBatch} numberOfLines={1}>
									{seat.batchName}
								</Text>
								<Text style={styles.seatTime}>{seat.time}</Text>
							</View>
						</View>
					))}

					<View style={styles.paymentBox}>
						{payment ? (
							<>
								<View style={styles.paymentRow}>
									<Text style={styles.paymentLabel}>Received</Text>
									<Text style={styles.paymentAmount}>{formatRupee(payment.amount)}</Text>
								</View>
								<Text style={styles.paymentMeta}>
									{payment.modeLabel} · {payment.covers}
								</Text>
								{payment.stillDue > 0 && <Text style={styles.paymentDue}>{formatRupee(payment.stillDue)} still due</Text>}
							</>
						) : (
							<>
								<View style={styles.paymentRow}>
									<Text style={styles.paymentLabel}>To collect</Text>
									<Text style={[styles.paymentAmount, { color: theme.destructive }]}>{formatRupee(result.monthlyFee)}</Text>
								</View>
								<Text style={styles.paymentMeta}>Nothing paid yet · due from {formatShortDate(result.dueFrom, true)}</Text>
							</>
						)}
						{result.settlementNote ? <Text style={styles.paymentMeta}>{result.settlementNote}</Text> : null}
					</View>
				</View>

				{result.idProofFailed && (
					<View style={styles.warning}>
						<Ionicons name="warning-outline" size={18} color={theme.warning} />
						<Text style={styles.warningText}>The ID proof photo didn't upload. Add it again from the member's profile.</Text>
					</View>
				)}

				<Pressable accessibilityRole="button" style={({ pressed }) => [styles.whatsAppBtn, pressed && styles.pressed]} onPress={onWhatsApp}>
					<Ionicons name="logo-whatsapp" size={20} color="#fff" />
					<Text style={styles.primaryText}>Send welcome on WhatsApp</Text>
				</Pressable>

				<View style={styles.secondaryRow}>
					<Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={onViewMember}>
						<Ionicons name="person-outline" size={17} color={theme.primary} />
						<Text style={styles.secondaryText}>View member</Text>
					</Pressable>
					<Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={onAdmitAnother}>
						<Ionicons name="person-add-outline" size={17} color={theme.primary} />
						<Text style={styles.secondaryText}>Admit another</Text>
					</Pressable>
				</View>

				<Pressable accessibilityRole="button" style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={onDone} hitSlop={8}>
					<Text style={styles.doneText}>Done</Text>
				</Pressable>
			</Animated.View>
		</ScrollView>
	);
}

const TICK = 76;
const NOTCH = 18;
const DASHES = 22;

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		scroll: {
			paddingHorizontal: 20,
			paddingTop: 24,
		},
		hero: {
			alignItems: "center",
			marginBottom: 24,
		},
		tickWrap: {
			width: TICK,
			height: TICK,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 18,
		},
		ring: {
			position: "absolute",
			width: TICK,
			height: TICK,
			borderRadius: TICK / 2,
			backgroundColor: theme.success,
		},
		tick: {
			width: TICK,
			height: TICK,
			borderRadius: TICK / 2,
			backgroundColor: theme.success,
			alignItems: "center",
			justifyContent: "center",
		},
		title: {
			fontFamily: "sans-bold",
			fontSize: 24,
			letterSpacing: -0.4,
			color: theme.primary,
		},
		subtitle: {
			fontFamily: "sans-regular",
			fontSize: 14,
			color: theme.mutedForeground,
			marginTop: 4,
			textAlign: "center",
		},
		ticket: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.border,
			paddingVertical: 16,
			overflow: "hidden",
		},
		ticketHead: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 16,
		},
		ticketHeadText: {
			flex: 1,
		},
		ticketName: {
			fontFamily: "sans-semibold",
			fontSize: 16,
			color: theme.primary,
		},
		ticketMeta: {
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		tear: {
			flexDirection: "row",
			alignItems: "center",
			marginVertical: 14,
		},
		// Half-circles cut into the card's edges, in the page colour.
		notch: {
			width: NOTCH,
			height: NOTCH,
			borderRadius: NOTCH / 2,
			backgroundColor: theme.background,
		},
		notchLeft: {
			marginLeft: -NOTCH / 2,
		},
		notchRight: {
			marginRight: -NOTCH / 2,
		},
		// Separate short bars: a one-sided dashed border doesn't draw on iOS.
		dashes: {
			flex: 1,
			flexDirection: "row",
			justifyContent: "space-between",
			overflow: "hidden",
			marginHorizontal: 6,
		},
		dash: {
			width: 6,
			height: 1.5,
			borderRadius: 1,
			backgroundColor: theme.mutedForeground + "40",
		},
		seatRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 16,
			marginBottom: 10,
		},
		seatBadge: {
			width: 52,
			height: 52,
			borderRadius: RADIUS.md,
			backgroundColor: theme.accent,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 4,
		},
		seatBadgeLabel: {
			fontFamily: "sans-semibold",
			fontSize: 8,
			letterSpacing: 1.4,
			color: "rgba(255,255,255,0.8)",
		},
		seatBadgeNumber: {
			fontFamily: "sans-bold",
			fontSize: 20,
			color: "#fff",
			marginTop: -2,
		},
		seatText: {
			flex: 1,
		},
		seatBatch: {
			fontFamily: "sans-semibold",
			fontSize: 15,
			color: theme.primary,
		},
		seatTime: {
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.mutedForeground,
			marginTop: 1,
		},
		paymentBox: {
			marginTop: 4,
			marginHorizontal: 16,
			padding: 12,
			borderRadius: RADIUS.md,
			backgroundColor: theme.muted,
			gap: 2,
		},
		paymentRow: {
			flexDirection: "row",
			alignItems: "baseline",
			justifyContent: "space-between",
		},
		paymentLabel: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
		},
		paymentAmount: {
			fontFamily: "sans-bold",
			fontSize: 20,
			color: theme.success,
		},
		paymentMeta: {
			fontFamily: "sans-regular",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		paymentDue: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.destructive,
		},
		warning: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			marginTop: 12,
			padding: 12,
			borderRadius: RADIUS.md,
			backgroundColor: theme.warning + "14",
		},
		warningText: {
			flex: 1,
			fontFamily: "sans-regular",
			fontSize: 13,
			color: theme.primary,
		},
		whatsAppBtn: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			marginTop: 20,
			paddingVertical: 15,
			borderRadius: RADIUS.md,
			backgroundColor: "#25D366",
		},
		primaryText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
		secondaryRow: {
			flexDirection: "row",
			gap: 10,
			marginTop: 10,
		},
		secondaryBtn: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
			paddingVertical: 13,
			borderRadius: RADIUS.md,
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.border,
		},
		secondaryText: {
			fontFamily: "sans-medium",
			fontSize: 14,
			color: theme.primary,
		},
		doneBtn: {
			alignSelf: "center",
			paddingVertical: 14,
			paddingHorizontal: 24,
			marginTop: 6,
		},
		doneText: {
			fontFamily: "sans-medium",
			fontSize: 15,
			color: theme.mutedForeground,
		},
		pressed: {
			opacity: 0.75,
		},
	});
