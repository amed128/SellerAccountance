import Papa from "papaparse";
import type { VatSummary } from "./vat";
import type { MonthlySummary } from "./aggregate";
import type { Dict, Locale } from "./i18n";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthLabel(month: string, locale: Locale, undated: string) {
  if (!month) return undated;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    month: "long",
    year: "numeric",
  });
}

// Shared by the CSV and PDF exports (see pdfExport.tsx) — both routes in
// lib/exportData.ts return data already shaped to this interface.
export interface VatExportInput {
  title: string;
  period?: { start: Date; end: Date } | null;
  reportsIncluded?: number;
  summary: VatSummary;
  monthly?: MonthlySummary[];
}

/**
 * Amounts are left as plain dot-decimal numbers (not locale-formatted, no
 * currency symbol) — this file is meant for further processing (a tax
 * filing tool, an accountant's spreadsheet), where an unambiguous machine
 * format matters more than print-friendly formatting.
 */
export function buildVatExportCsv(input: VatExportInput, locale: Locale, d: Dict): string {
  const t = d.dashboard;
  const x = d.export;
  const s = input.summary;
  const cur = s.currency;
  const amt = (n: number) => n.toFixed(2);

  const rows: (string | number)[][] = [[x.title.replace("{title}", input.title)]];
  rows.push([x.generatedOn, iso(new Date())]);
  if (input.period) rows.push([x.period, iso(input.period.start), iso(input.period.end)]);
  if (input.reportsIncluded !== undefined) rows.push([x.reportsIncluded, input.reportsIncluded]);
  rows.push([]);

  rows.push([x.summary]);
  rows.push([x.indicator, x.amount, x.currency]);
  rows.push([t.grossRevenue, amt(s.grossRevenue), cur]);
  rows.push([t.netRevenue, amt(s.netRevenue), cur]);
  rows.push([t.fees, amt(s.totalFees), cur]);
  rows.push([t.netMovement, amt(s.netPayout), cur]);
  if (s.bankTransfers !== 0) rows.push([t.bankTransfers, amt(Math.abs(s.bankTransfers)), cur]);
  rows.push([t.vatFr, amt(s.vatCollectedFr), cur]);
  rows.push([t.vatOss, amt(s.vatOss), cur]);
  rows.push([s.vatToPay >= 0 ? t.vatToPay : t.vatToClaim, amt(Math.abs(s.vatToPay)), cur]);
  rows.push([]);

  if (input.monthly) {
    rows.push([x.monthlyBreakdown]);
    rows.push([d.overview.month, t.grossRevenue, t.netRevenue, t.fees, t.vatToPay, x.currency]);
    for (const { month, summary: m } of input.monthly) {
      rows.push([
        monthLabel(month, locale, d.overview.undated),
        amt(m.grossRevenue),
        amt(m.netRevenue),
        amt(m.totalFees),
        amt(m.vatToPay),
        m.currency,
      ]);
    }
    rows.push([]);
  }

  if (s.byCountry.length > 0) {
    rows.push([t.byCountry]);
    rows.push([t.country, t.regime, t.taxableBase, t.vatCol, t.txCount, x.currency]);
    for (const c of s.byCountry) {
      rows.push([c.country, t.regimes[c.regime], amt(c.taxableBase), amt(c.vatAmount), c.transactionCount, cur]);
    }
  }

  return Papa.unparse(rows);
}
