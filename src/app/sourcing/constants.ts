export const VAT_TREATMENTS = ["DOMESTIC", "REVERSE_CHARGE", "IMPORT"];
// Kept to a fixed, known-valid ISO 4217 list — formatMoney() passes this
// straight to Intl's currency formatter, which throws on an unknown code.
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CNY"];
