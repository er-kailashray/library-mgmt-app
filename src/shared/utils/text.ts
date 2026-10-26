export function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

/** Longest a phone field may get before cleaning: room for a pasted "+91 98765 43210". */
export const PHONE_INPUT_MAX_LENGTH = 16;

/**
 * What a 10-digit Indian mobile field should hold after a keystroke or a paste: digits only, a
 * leading "+91"/"91" or "0" dropped, then the first 10 digits. (Keeping the *last* 10 instead made
 * an extra key press push the first digit out and shift the whole number.)
 */
export function phoneDigits(text: string): string {
    let digits = text.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits.slice(0, 10);
}
