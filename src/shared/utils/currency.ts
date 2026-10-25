/** Built once: Intl formatters are expensive to create, and amounts are formatted many times per render. */
const rupeeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** "₹12,500": whole rupees with Indian digit grouping. */
export function formatRupee(amount: number): string {
    return rupeeFormatter.format(amount);
}
