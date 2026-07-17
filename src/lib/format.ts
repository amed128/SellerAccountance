export function formatMoney(n: number, locale: string, currency = "EUR") {
  return n.toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { style: "currency", currency });
}

export function formatPercent(ratio: number, locale: string) {
  return ratio.toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { style: "percent", maximumFractionDigits: 0 });
}

export function formatMonth(month: string, locale: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    month: "long",
    year: "numeric",
  });
}

// Note keys whose text has {country}/{rate} placeholders to fill in.
const NOTES_WITH_RATE_PLACEHOLDERS = new Set(["estimated", "franchiseFeesReverseCharge"]);

export function formatVatNote(
  key: string,
  text: string,
  locale: string,
  homeCountry: string,
  countryNames: Record<string, string>,
  vatRates: Record<string, number>
): string {
  if (!NOTES_WITH_RATE_PLACEHOLDERS.has(key)) return text;
  const rate = (vatRates[homeCountry] ?? vatRates.FR).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const country = countryNames[homeCountry] ?? homeCountry;
  return text.replace("{country}", country).replace("{rate}", rate);
}
