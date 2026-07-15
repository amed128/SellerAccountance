import { TaggedTransaction, MonthlySummary } from "./aggregate";
import { EU_COUNTRIES } from "./vat";

// Deterministic, rule-based checks on imported data — no LLM involved.
// False positives should be rare and clearly explainable; that matters more
// here than catching every edge case, since this is tax-adjacent.

export type Alert =
  | { kind: "malformedVatNumber"; severity: "warning"; count: number; examples: string[] }
  | { kind: "ossThresholdExceeded"; severity: "warning"; year: number; amount: number }
  | { kind: "ossThresholdApproaching"; severity: "info"; year: number; amount: number; remaining: number }
  | { kind: "missingMonth"; severity: "info"; month: string }
  | { kind: "unusualFeeRatio"; severity: "info"; ratio: number; direction: "high" | "low" };

const OSS_THRESHOLD = 10_000; // EU-wide micro-business threshold (art. 258 B, II CGI)
const OSS_APPROACH_RATIO = 0.8;

// Loose sanity check only: 2-letter country prefix + at least 2 alphanumerics.
// Real per-country VAT number validation (check digits, length) is out of
// scope — this catches obvious typos/truncation, not invalid-but-shaped numbers.
const VAT_NUMBER_RE = /^[A-Z]{2}[A-Za-z0-9]{2,}$/;

const FEE_REPORT_TYPES = new Set(["SETTLEMENT", "TRANSACTION_VIEW"]);
const FEE_RATIO_HIGH = 0.6;
const FEE_RATIO_LOW = 0.05;

function malformedVatNumberAlert(transactions: TaggedTransaction[]): Alert | null {
  const bad = new Set(
    transactions
      .map((t) => t.buyerVatNumber?.trim())
      .filter((v): v is string => !!v && !VAT_NUMBER_RE.test(v.replace(/\s/g, "")))
  );
  if (bad.size === 0) return null;
  return { kind: "malformedVatNumber", severity: "warning", count: bad.size, examples: [...bad].slice(0, 3) };
}

function ossThresholdAlert(transactions: TaggedTransaction[]): Alert | null {
  const year = new Date().getFullYear();
  let base = 0;
  for (const t of transactions) {
    if (!t.date || new Date(t.date).getFullYear() !== year) continue;
    if (t.type !== "SALE" && t.type !== "REFUND") continue;
    const arrival = t.arrivalCountry ?? "FR";
    if (!EU_COUNTRIES.has(arrival) || arrival === "FR" || t.buyerVatNumber) continue; // B2C cross-border EU only
    const sign = t.type === "REFUND" ? -1 : 1;
    base += (Math.abs(t.amountExclVat) || Math.abs(t.amountInclVat)) * sign;
  }
  if (base >= OSS_THRESHOLD) return { kind: "ossThresholdExceeded", severity: "warning", year, amount: base };
  if (base >= OSS_THRESHOLD * OSS_APPROACH_RATIO) {
    return { kind: "ossThresholdApproaching", severity: "info", year, amount: base, remaining: OSS_THRESHOLD - base };
  }
  return null;
}

function missingMonthAlerts(monthly: MonthlySummary[]): Alert[] {
  const months = monthly.map((m) => m.month).filter(Boolean).sort();
  if (months.length < 2) return [];
  const [start, end] = [months[0], months[months.length - 1]];
  const present = new Set(months);

  const all: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [endY, endM] = end.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    all.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return all.filter((month) => !present.has(month)).map((month) => ({ kind: "missingMonth", severity: "info", month }));
}

function feeRatioAlert(transactions: TaggedTransaction[]): Alert | null {
  // VAT_TRANSACTIONS/DATE_RANGE rows never carry fee data (see parsers/index.ts)
  // — only judge the ratio using report types that actually populate fees.
  const relevant = transactions.filter((t) => FEE_REPORT_TYPES.has(t.reportType));
  if (relevant.length === 0) return null;

  let grossRevenue = 0;
  let totalFees = 0;
  for (const t of relevant) {
    if (t.type === "SALE" || t.type === "REFUND") {
      const sign = t.type === "REFUND" ? -1 : 1;
      grossRevenue += (Math.abs(t.amountInclVat) || Math.abs(t.amountExclVat)) * sign;
    }
    totalFees += t.fees + t.fbaFees + t.otherFees;
  }
  if (grossRevenue <= 0) return null;

  const ratio = Math.abs(totalFees) / grossRevenue;
  if (ratio > FEE_RATIO_HIGH) return { kind: "unusualFeeRatio", severity: "info", ratio, direction: "high" };
  if (ratio < FEE_RATIO_LOW) return { kind: "unusualFeeRatio", severity: "info", ratio, direction: "low" };
  return null;
}

export function computeAlerts(transactions: TaggedTransaction[], monthly: MonthlySummary[]): Alert[] {
  return [
    malformedVatNumberAlert(transactions),
    ossThresholdAlert(transactions),
    ...missingMonthAlerts(monthly),
    feeRatioAlert(transactions),
  ].filter((a): a is Alert => a !== null);
}
