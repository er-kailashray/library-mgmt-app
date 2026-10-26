import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { RADIUS } from "@/shared/constants/layout";
import type { Theme } from "@/shared/constants/theme";
import { BUTTON_TEXT } from "@/shared/constants/typography";
import { ScaledSheet } from "@/shared/constants/ui-scale";
import { useTheme } from "@/shared/providers/ThemeProvider";
import { Text } from "@/shared/ui/Text";

export type SetupStep = {
	key: string;
	label: string;
	/** Shown on the "You're all set" card once the step is done. */
	doneLabel: string;
	hint: string;
	icon: keyof typeof Ionicons.glyphMap;
	done: boolean;
	required?: boolean;
	busy?: boolean;
	onPress: () => void;
};

/** "Get your library ready": a progress bar and one row per step, the next required one tagged "Start here". */
export function SetupChecklistCard({ steps }: { steps: SetupStep[] }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const completed = steps.filter((step) => step.done).length;
	const nextStepKey = steps.find((step) => step.required && !step.done)?.key;

	return (
		<View style={styles.setupCard}>
			<View style={styles.setupHeaderRow}>
				<Text style={styles.setupTitle}>Get your library ready</Text>
				<Text style={styles.setupCount}>
					{completed}/{steps.length} done
				</Text>
			</View>
			<View style={styles.setupProgressTrack}>
				<View style={[styles.setupProgressBar, { width: `${(completed / steps.length) * 100}%` }]} />
			</View>

			{steps.map((step, index) => {
				const highlight = step.key === nextStepKey;
				return (
					<Pressable
						key={step.key}
						accessibilityRole="button"
						style={[styles.setupRow, index !== steps.length - 1 && styles.setupRowBorder]}
						onPress={step.onPress}
						disabled={step.done || step.busy}>
						<View style={styles.setupIconWrap}>
							<Ionicons name={step.icon} size={20} color={theme.accent} />
						</View>
						<View style={styles.setupRowText}>
							<View style={styles.setupLabelRow}>
								<Text style={styles.setupRowLabel}>{step.label}</Text>
								{!step.done && (
									<Text style={[styles.setupTag, highlight ? styles.setupTagRequired : styles.setupTagOptional]}>
										{highlight ? "Start here" : step.required ? "Required" : "Optional"}
									</Text>
								)}
							</View>
							<Text style={styles.setupRowHint}>{step.hint}</Text>
						</View>
						{step.busy ? (
							<ActivityIndicator size="small" color={theme.accent} />
						) : step.done ? (
							<Ionicons name="checkmark-circle" size={22} color={theme.success} />
						) : (
							<Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
						)}
					</Pressable>
				);
			})}
		</View>
	);
}

/** How long the congratulations card stays before giving way to "Add your first member". */
const CELEBRATION_VISIBLE_MS = 6000;

/** Replaces the setup card once every step is done, then fades away on its own. */
export function SetupCompleteCard({ steps, onDismiss }: { steps: SetupStep[]; onDismiss: () => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	const appear = useRef(new Animated.Value(0)).current;
	const leaving = useRef(false);

	// Fade and shrink away, then hand over to the "Add your first member" card.
	const leave = useCallback(() => {
		if (leaving.current) return;
		leaving.current = true;
		Animated.timing(appear, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDismiss());
	}, [appear, onDismiss]);

	useEffect(() => {
		const timer = setTimeout(leave, CELEBRATION_VISIBLE_MS);
		return () => clearTimeout(timer);
	}, [leave]);
	const bloom = useRef(new Animated.Value(0)).current;
	const wobble = useRef(new Animated.Value(0)).current;
	const stepIn = useRef(steps.map(() => new Animated.Value(0))).current;

	// Card settles in, then the flower blooms and wobbles, then the finished steps tick in one by one.
	useEffect(() => {
		Animated.sequence([
			Animated.spring(appear, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
			Animated.parallel([
				Animated.spring(bloom, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
				Animated.sequence(
					[1, -1, 0.6, -0.6, 0].map((toValue) => Animated.timing(wobble, { toValue, duration: 110, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))
				),
			]),
			Animated.stagger(
				120,
				stepIn.map((value) => Animated.timing(value, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }))
			),
		]).start();
	}, [appear, bloom, wobble, stepIn]);

	return (
		<Animated.View
			style={[styles.celebrationCard, { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
			<LinearGradient
				pointerEvents="none"
				colors={[theme.accent + "2E", theme.subscription + "1F", theme.card]}
				locations={[0, 0.55, 1]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
			<Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.celebrationClose} onPress={leave} hitSlop={10}>
				<Ionicons name="close" size={18} color={theme.mutedForeground} />
			</Pressable>

			<View style={styles.celebrationFlowerArea}>
				{/* Small blossoms around the main flower. */}
				<Ionicons name="flower" size={16} color={theme.subscription} style={[styles.celebrationPetal, { top: 4, left: 6 }]} />
				<Ionicons name="flower" size={12} color="#F59E0B" style={[styles.celebrationPetal, { top: 0, right: 10 }]} />
				<Ionicons name="flower" size={14} color="#F472B6" style={[styles.celebrationPetal, { bottom: 2, right: 0 }]} />
				<Animated.View
					style={[
						styles.celebrationFlowerWrap,
						{ transform: [{ scale: bloom }, { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] }) }] },
					]}>
					<Ionicons name="flower" size={44} color={theme.accent} />
				</Animated.View>
			</View>

			<Text style={styles.celebrationTitle}>Congratulations!</Text>
			<Text style={styles.celebrationSubtitle}>Your library is ready to use</Text>
			<Text style={styles.celebrationCopy}>Next, add your first member. Seats, collections and dues will show up here as members join and pay.</Text>

			<View style={styles.celebrationSteps}>
				{steps.map((step, i) => (
					<Animated.View
						key={step.key}
						style={[styles.celebrationStep, { opacity: stepIn[i], transform: [{ translateX: stepIn[i].interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
						<Ionicons name="checkmark-circle" size={18} color={theme.success} />
						<Text style={styles.celebrationStepText}>{step.doneLabel}</Text>
					</Animated.View>
				))}
			</View>

			<Pressable accessibilityRole="button" style={({ pressed }) => [styles.celebrationBtn, pressed && { opacity: 0.85 }]} onPress={leave}>
				<Text style={styles.celebrationBtnText}>Let's go</Text>
				<Ionicons name="arrow-forward" size={16} color="#fff" />
			</Pressable>
		</Animated.View>
	);
}

/** A brand-new library's next step, once batches exist: admit the first member. */
export function FirstMemberCard({ onAdd }: { onAdd: () => void }) {
	const { theme } = useTheme();
	const styles = createStyles(theme);
	return (
		<View style={styles.firstMemberCard}>
			<LinearGradient pointerEvents="none" colors={[theme.accent + "1F", theme.card]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
			<View style={styles.firstMemberIconWrap}>
				<Ionicons name="person-add" size={26} color="#fff" />
			</View>
			<Text style={styles.firstMemberTitle}>Add your first member</Text>
			<Text style={styles.firstMemberCopy}>Admit a student, give them a seat and record their first payment. Your seats, collections and dues will show up here.</Text>
			<Pressable accessibilityRole="button" style={({ pressed }) => [styles.firstMemberCta, pressed && { opacity: 0.85 }]} onPress={onAdd}>
				<Ionicons name="add" size={18} color="#fff" />
				<Text style={styles.firstMemberCtaText}>Add member</Text>
			</Pressable>
		</View>
	);
}

const createStyles = (theme: Theme) =>
	ScaledSheet.create({
		setupCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.accent + "40",
			padding: 18,
		},
		setupHeaderRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		setupTitle: {
			fontFamily: "sans-bold",
			fontSize: 15,
			color: theme.primary,
		},
		setupCount: {
			fontFamily: "sans-bold",
			fontSize: 12,
			color: theme.mutedForeground,
		},
		setupProgressTrack: {
			height: 4,
			backgroundColor: theme.muted,
			borderRadius: 2,
			overflow: "hidden",
			marginTop: 10,
			marginBottom: 6,
		},
		setupProgressBar: {
			height: "100%",
			backgroundColor: theme.success,
			borderRadius: 2,
		},
		setupRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 12,
		},
		setupRowBorder: {
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.border,
		},
		setupIconWrap: {
			width: 40,
			height: 40,
			borderRadius: RADIUS.sm,
			backgroundColor: theme.accent + "15",
			alignItems: "center",
			justifyContent: "center",
		},
		setupRowText: {
			flex: 1,
		},
		setupLabelRow: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 6,
		},
		setupRowLabel: {
			fontFamily: "sans-bold",
			fontSize: 14,
			color: theme.primary,
		},
		setupTag: {
			fontFamily: "sans-bold",
			fontSize: 10,
			textTransform: "uppercase",
			letterSpacing: 0.4,
			paddingHorizontal: 6,
			paddingVertical: 2,
			borderRadius: 4,
			overflow: "hidden",
		},
		setupTagRequired: {
			color: theme.accent,
			backgroundColor: theme.accent + "1A",
		},
		setupTagOptional: {
			color: theme.mutedForeground,
			backgroundColor: theme.muted,
		},
		setupRowHint: {
			fontFamily: "sans-medium",
			fontSize: 12,
			color: theme.mutedForeground,
			marginTop: 2,
		},
		celebrationCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.accent + "40",
			paddingHorizontal: 20,
			paddingTop: 24,
			paddingBottom: 20,
			alignItems: "center",
			overflow: "hidden",
		},
		celebrationClose: {
			position: "absolute",
			top: 12,
			right: 12,
			padding: 4,
			zIndex: 1,
		},
		celebrationFlowerArea: {
			width: 104,
			height: 92,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 8,
		},
		celebrationPetal: {
			position: "absolute",
		},
		celebrationFlowerWrap: {
			width: 76,
			height: 76,
			borderRadius: 38,
			backgroundColor: theme.card,
			borderWidth: 2,
			borderColor: theme.accent + "33",
			alignItems: "center",
			justifyContent: "center",
		},
		celebrationTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 24,
			color: theme.primary,
			letterSpacing: -0.3,
		},
		celebrationSubtitle: {
			fontFamily: "sans-bold",
			fontSize: 16,
			color: theme.accent,
			marginTop: 4,
			marginBottom: 8,
		},
		celebrationCopy: {
			fontFamily: "sans-medium",
			fontSize: 13,
			lineHeight: 19,
			color: theme.mutedForeground,
			textAlign: "center",
			marginBottom: 16,
			maxWidth: 280,
		},
		celebrationSteps: {
			alignSelf: "stretch",
			backgroundColor: theme.card,
			borderWidth: 1,
			borderColor: theme.success + "33",
			borderRadius: RADIUS.md,
			paddingVertical: 12,
			paddingHorizontal: 14,
			gap: 10,
			marginBottom: 16,
		},
		celebrationStep: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
		},
		celebrationStepText: {
			fontFamily: "sans-semibold",
			fontSize: 14,
			color: theme.primary,
		},
		celebrationBtn: {
			alignSelf: "stretch",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 8,
			backgroundColor: theme.accent,
			borderRadius: RADIUS.md,
			paddingVertical: 14,
		},
		celebrationBtnText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
		firstMemberCard: {
			backgroundColor: theme.card,
			borderRadius: RADIUS.lg,
			borderWidth: 1,
			borderColor: theme.accent + "33",
			padding: 24,
			alignItems: "center",
			overflow: "hidden",
		},
		firstMemberIconWrap: {
			width: 56,
			height: 56,
			borderRadius: 28,
			backgroundColor: theme.accent,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: 14,
		},
		firstMemberTitle: {
			fontFamily: "sans-extrabold",
			fontSize: 18,
			color: theme.primary,
			marginBottom: 6,
		},
		firstMemberCopy: {
			fontFamily: "sans-medium",
			fontSize: 13,
			color: theme.mutedForeground,
			lineHeight: 19,
			textAlign: "center",
			marginBottom: 18,
		},
		firstMemberCta: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
			backgroundColor: theme.accent,
			borderRadius: RADIUS.sm,
			paddingVertical: 12,
			paddingHorizontal: 22,
		},
		firstMemberCtaText: {
			...BUTTON_TEXT,
			color: "#fff",
		},
	});
