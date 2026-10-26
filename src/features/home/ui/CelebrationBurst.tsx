import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

import { useTheme } from "@/shared/providers/ThemeProvider";

const PARTICLE_COUNT = 28;
const PINK = "#F472B6";
const AMBER = "#F59E0B";

type Particle = {
	x: number;
	size: number;
	color: string;
	flower: boolean;
	delay: number;
	duration: number;
	sway: number;
	spin: number;
};

/**
 * A one-off shower of flowers and confetti falling over the whole screen. Renders above
 * everything, ignores touches, and removes itself once the last piece has fallen.
 */
export function CelebrationBurst() {
	const { theme } = useTheme();
	const { width, height } = useWindowDimensions();
	const [finished, setFinished] = useState(false);

	const particles = useMemo<Particle[]>(() => {
		const colors = [theme.accent, theme.subscription, AMBER, PINK];
		return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
			// Two in three are flowers; the rest are small confetti dots.
			const flower = i % 3 !== 2;
			return {
				x: Math.random() * (width - 24),
				size: flower ? 18 + Math.random() * 14 : 7 + Math.random() * 5,
				color: colors[i % colors.length],
				flower,
				delay: Math.random() * 700,
				duration: 2400 + Math.random() * 1400,
				sway: 14 + Math.random() * 26,
				spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
			};
		});
	}, [theme.accent, theme.subscription, width]);

	const progress = useRef(particles.map(() => new Animated.Value(0))).current;

	useEffect(() => {
		const animation = Animated.parallel(
			particles.map((p, i) =>
				Animated.timing(progress[i], {
					toValue: 1,
					duration: p.duration,
					delay: p.delay,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				})
			)
		);
		animation.start(() => setFinished(true));
		return () => animation.stop();
	}, [particles, progress]);

	if (finished) return null;

	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{particles.map((p, i) => {
				const value = progress[i];
				const style = {
					position: "absolute" as const,
					left: p.x,
					top: -40,
					opacity: value.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
					transform: [
						{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, height + 80] }) },
						// Side-to-side drift, like petals in the air.
						{ translateX: value.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] }) },
						{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
					],
				};
				return (
					<Animated.View key={i} style={style}>
						{p.flower ? (
							<Ionicons name="flower" size={p.size} color={p.color} />
						) : (
							<View style={{ width: p.size, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color }} />
						)}
					</Animated.View>
				);
			})}
		</View>
	);
}
