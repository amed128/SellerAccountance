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

/**
 * The "estimated" VAT note is the only one with placeholders — it names the
 * home country and its rate, since the estimate is no longer always 20%/FR.
 */
export function formatVatNote(
  key: string,
  text: string,
  locale: string,
  homeCountry: string,
  countryNames: Record<string, string>,
  vatRates: Record<string, number>
): string {
  if (key !== "estimated") return text;
  const rate = (vatRates[homeCountry] ?? vatRates.FR).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const country = countryNames[homeCountry] ?? homeCountry;
  return text.replace("{country}", country).replace("{rate}", rate);
}
