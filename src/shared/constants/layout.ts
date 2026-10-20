/**
 * Capped radius scale - keeps surfaces from reading as bubbly/playful.
 * sm: chips, badges, small icon circles. md: standard cards/rows. lg: the
 * hard ceiling for anything, including modals.
 */
export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
} as const;

/**
 * Reserve shadow/elevation for genuinely floating elements (FABs, modals,
 * bottom sheets). Static cards should use a hairline `theme.border` instead.
 */
export const FLOATING_SHADOW = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
} as const;
