import type { Alert } from "@/lib/alerts";
import type { Dict } from "@/lib/i18n";
import { formatMoney, formatPercent, formatMonth } from "@/lib/format";

function renderAlert(a: Alert, d: Dict["alerts"], locale: string, currency: string): string {
  const money = (n: number) => formatMoney(n, locale, currency);
  switch (a.kind) {
    case "malformedVatNumber":
      return d.malformedVatNumber.replace("{n}", String(a.count)).replace("{examples}", a.examples.join(", "));
    case "ossThresholdExceeded":
      return d.ossThresholdExceeded.replace("{year}", String(a.year)).replace("{amount}", money(a.amount));
    case "ossThresholdApproaching":
      return d.ossThresholdApproaching
        .replace("{year}", String(a.year))
        .replace("{amount}", money(a.amount))
        .replace("{remaining}", money(a.remaining));
    case "missingMonth":
      return d.missingMonth.replace("{month}", formatMonth(a.month, locale));
    case "unusualFeeRatio":
      return (a.direction === "high" ? d.unusualFeeRatioHigh : d.unusualFeeRatioLow).replace(
        "{ratio}",
        formatPercent(a.ratio, locale)
      );
  }
}

export default function AlertList({
  alerts,
  locale,
  currency,
  d,
}: {
  alerts: Alert[];
  locale: string;
  currency: string;
  d: Dict["alerts"];
}) {
  if (alerts.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {alerts.map((a, i) => (
        <p
          key={i}
          className={`rounded-lg px-4 py-2 text-sm ${
            a.severity === "warning"
              ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
              : "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
          }`}
        >
          {a.severity === "warning" && "⚠ "}
          {renderAlert(a, d, locale, currency)}
        </p>
      ))}
    </div>
  );
}
