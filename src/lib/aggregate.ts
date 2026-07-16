import { NormalizedTransaction } from "./parsers/types";
import { computeVatSummary, VatSummary, VatRegime, DEFAULT_HOME_COUNTRY } from "./vat";

export interface TaggedTransaction extends NormalizedTransaction {
  reportId: string;
  reportType: string;
}

export interface DedupeResult {
  transactions: TaggedTransaction[];
  duplicatesRemoved: number;
}

/**
 * Merge transactions from several uploaded reports without double counting.
 *
 * A transaction is identified by its natural key (type, order, sku, quantity,
 * date, amounts). When the same key appears in SEVERAL reports (overlapping
 * date ranges, the same file uploaded twice, a month exported two ways), it is
 * counted once — per key we keep MAX(occurrences per report), not the sum.
 * Genuine repeats INSIDE a single report (two identical order lines) are
 * preserved, since the max is taken per report.
 */
export function dedupeTransactions(rows: TaggedTransaction[]): DedupeResult {
  const byKey = new Map<string, Map<string, TaggedTransaction[]>>();

  for (const r of rows) {
    const key = [
      r.type,
      r.orderId ?? "",
      r.sku ?? "",
      r.quantity,
      r.date ? new Date(r.date).toISOString() : "",
      r.total.toFixed(2),
      r.amountInclVat.toFixed(2),
      (r.description ?? "").slice(0, 40),
    ].join("|");
    let perReport = byKey.get(key);
    if (!perReport) byKey.set(key, (perReport = new Map()));
    const list = perReport.get(r.reportId);
    if (list) list.push(r);
    else perReport.set(r.reportId, [r]);
  }

  const kept: TaggedTransaction[] = [];
  let duplicatesRemoved = 0;
  for (const perReport of byKey.values()) {
    let best: TaggedTransaction[] = [];
    let total = 0;
    for (const list of perReport.values()) {
      total += list.length;
      if (list.length > best.length) best = list;
    }
    kept.push(...best);
    duplicatesRemoved += total - best.length;
  }
  return { transactions: kept, duplicatesRemoved };
}

export interface MonthlySummary {
  month: string; // "2025-07"
  summary: VatSummary;
}

/** Group deduplicated transactions per calendar month (undated rows go to ""). */
export function monthlySummaries(
  rows: TaggedTransaction[],
  homeCountry: string = DEFAULT_HOME_COUNTRY,
  vatRegime: VatRegime = "STANDARD"
): MonthlySummary[] {
  const byMonth = new Map<string, TaggedTransaction[]>();
  for (const r of rows) {
    const d = r.date ? new Date(r.date) : null;
    const month = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "";
    const list = byMonth.get(month);
    if (list) list.push(r);
    else byMonth.set(month, [r]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => ({ month, summary: computeVatSummary(list, homeCountry, vatRegime) }));
}

export interface ReportPeriod {
  reportType: string;
  periodStart: Date | null;
  periodEnd: Date | null;
}

/**
 * True when reports of DIFFERENT types cover overlapping periods: the same
 * order then appears with different amounts (e.g. VAT report + date range
 * report of the same month) and cannot be deduplicated by natural key.
 */
export function hasMixedTypeOverlap(reports: ReportPeriod[]): boolean {
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i];
      const b = reports[j];
      if (a.reportType === b.reportType) continue;
      if (!a.periodStart || !a.periodEnd || !b.periodStart || !b.periodEnd) continue;
      if (a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd) return true;
    }
  }
  return false;
}
