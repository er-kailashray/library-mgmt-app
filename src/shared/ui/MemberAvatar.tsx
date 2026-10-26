import { View } from "react-native";

import { scale, ScaledSheet } from "@/shared/constants/ui-scale";
import { Text } from "@/shared/ui/Text";
import { getInitials } from "@/shared/utils/text";

/** Soft, distinct avatar colours; each member keeps the same one wherever they appear. */
const AVATAR_COLORS = ["#E26D4D", "#14B8A6", "#6366F1", "#F59E0B", "#0EA5E9", "#EC4899", "#10B981", "#8B5CF6"];

/** The member's colour, picked from their id (or, without one, from their name). */
export function memberColor(id: number | string | null | undefined, name: string): string {
    const n = Number(id);
    const seed = Number.isFinite(n) && id !== null && id !== "" ? n : name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length];
}

/** A round avatar with the member's initials on their own soft colour (Members, Payments, …). */
export function MemberAvatar({ id, name, size: designSize = 44, faded = false }: { id?: number | string | null; name: string; size?: number; faded?: boolean }) {
    const color = memberColor(id, name);
    // A touch smaller on narrow phones, like the text beside it.
    const size = scale(designSize);
    return (
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "22" }, faded && styles.faded]}>
            <Text style={[styles.initials, { color, fontSize: Math.round(size * 0.34) }]}>{getInitials(name)}</Text>
        </View>
    );
}

const styles = ScaledSheet.create({
    circle: {
        alignItems: "center",
        justifyContent: "center",
    },
    initials: {
        fontFamily: "sans-semibold",
    },
    faded: {
        opacity: 0.55,
    },
});
