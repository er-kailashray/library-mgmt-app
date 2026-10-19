import { Linking } from "react-native";

/**
 * Opens a WhatsApp chat with a pre-filled message via the wa.me deep link -
 * no WhatsApp Business API or approval needed, the owner just taps Send.
 * Assumes a 10-digit Indian mobile number when no country code is present.
 */
export async function openWhatsAppMessage(phone: string, message: string): Promise<void> {
    const digits = phone.replace(/\D/g, "");
    const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
}
