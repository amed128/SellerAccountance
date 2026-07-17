import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReportFile } from "@/lib/parsers";
import {
  dedupeTransactions,
  monthlySummaries,
  hasMixedTypeOverlap,
  TaggedTransaction,
} from "@/lib/aggregate";
import { computeVatSummary } from "@/lib/vat";

const sample = (name: string) =>
  readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

function tag(reportId: string, reportType: string, fileName: string): TaggedTransaction[] {
  return parseReportFile(fileName, sample(fileName)).transactions.map((t) => ({
    ...t,
    reportId,
    reportType,
  }));
}

describe("dedupeTransactions", () => {
  it("counts the same file uploaded twice only once", () => {
    const a = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    const b = tag("r2", "DATE_RANGE", "date-range-sample-fr.csv");
    const { transactions, duplicatesRemoved } = dedupeTransactions([...a, ...b]);
    expect(transactions).toHaveLength(a.length);
    expect(duplicatesRemoved).toBe(a.length);
    const s = computeVatSummary(transactions);
    expect(s.grossRevenue).toBeCloseTo(62.9, 2); // not 125.80
  });

  it("merges overlapping exports: overlap counted once, rest kept", () => {
    const a = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    // Simulate a second export sharing 2 rows with the first + 1 new row
    const overlap = a.slice(0, 2).map((t) => ({ ...t, reportId: "r2" }));
    const extra: TaggedTransaction = {
      ...a[0],
      reportId: "r2",
      orderId: "999-0000000-0000001",
      total: 10,
      amountInclVat: 12,
    };
    const { transactions, duplicatesRemoved } = dedupeTransactions([...a, ...overlap, extra]);
    expect(transactions).toHaveLength(a.length + 1);
    expect(duplicatesRemoved).toBe(2);
  });

  it("keeps genuine repeats inside a single report", () => {
    const a = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    const twin = { ...a[0] }; // identical row in the SAME report
    const { transactions, duplicatesRemoved } = dedupeTransactions([...a, twin]);
    expect(transactions).toHaveLength(a.length + 1);
    expect(duplicatesRemoved).toBe(0);
  });

  it("keeps distinct rows sharing order and sku (multi-line orders)", () => {
    const a = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    const sameOrderDifferentAmount: TaggedTransaction = {
      ...a[0],
      reportId: "r2",
      total: a[0].total + 5,
      amountInclVat: a[0].amountInclVat + 5,
    };
    const { transactions } = dedupeTransactions([...a, sameOrderDifferentAmount]);
    expect(transactions).toHaveLength(a.length + 1);
  });
});

describe("monthlySummaries", () => {
  it("splits successive months and totals match the whole", () => {
    const june = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    const july = june.map((t, i) => ({
      ...t,
      reportId: "r2",
      orderId: t.orderId ? `JUL-${i}` : null,
      date: t.date ? new Date(new Date(t.date).getTime() + 30 * 24 * 3600 * 1000) : null,
    }));
    const { transactions } = dedupeTransactions([...june, ...july]);
    const months = monthlySummaries(transactions);
    expect(months).toHaveLength(2);
    expect(months[0].month < months[1].month).toBe(true);
    const total = computeVatSummary(transactions);
    const sumOfMonths = months.reduce((s, m) => s + m.summary.grossRevenue, 0);
    expect(sumOfMonths).toBeCloseTo(total.grossRevenue, 2);
  });

  it("buckets sourcing invoices by month alongside transactions, matching the aggregate total", () => {
    const june = tag("r1", "DATE_RANGE", "date-range-sample-fr.csv");
    const { transactions } = dedupeTransactions(june);
    const invoices = [
      { date: new Date("2026-06-05"), sku: "SKU-X", quantity: 1, amountExclVat: 100, vatAmount: 20, vatTreatment: "DOMESTIC" },
      // A month with a purchase but no sales at all must still appear.
      { date: new Date("2026-08-01"), sku: "SKU-X", quantity: 1, amountExclVat: 50, vatAmount: 10, vatTreatment: "DOMESTIC" },
    ];
    const months = monthlySummaries(transactions, "FR", "STANDARD", invoices);
    const august = months.find((m) => m.month === "2026-08");
    expect(august).toBeDefined();
    expect(august!.summary.sourcingDeductibleVat).toBeCloseTo(10, 2);
    expect(august!.summary.grossRevenue).toBe(0);

    const total = computeVatSummary(transactions, "FR", "STANDARD", invoices);
    const sumOfMonths = months.reduce((s, m) => s + m.summary.sourcingDeductibleVat, 0);
    expect(sumOfMonths).toBeCloseTo(total.sourcingDeductibleVat, 2);
  });

  it("costs a sale using ALL sourcing invoices for its SKU, not just ones from the same month", () => {
    // Bought in May, sold in June — June's cogs must still reflect May's cost,
    // since a unit's cost basis is cumulative, not scoped to a single month.
    const juneSale: TaggedTransaction = {
      date: new Date("2026-06-10"),
      type: "SALE",
      orderId: "1",
      sku: "SKU-A",
      description: null,
      quantity: 2,
      marketplace: null,
      arrivalCountry: "FR",
      departCountry: "FR",
      buyerVatNumber: null,
      amountExclVat: 100,
      vatRate: 0.2,
      vatAmount: 20,
      amountInclVat: 120,
      fees: 0,
      fbaFees: 0,
      otherFees: 0,
      total: 120,
      currency: "EUR",
      reportId: "r1",
      reportType: "DATE_RANGE",
    };
    const mayInvoice = {
      date: new Date("2026-05-01"),
      sku: "SKU-A",
      quantity: 1,
      amountExclVat: 5,
      vatAmount: 1,
      vatTreatment: "DOMESTIC",
    };
    const months = monthlySummaries([juneSale], "FR", "STANDARD", [mayInvoice]);
    const june = months.find((m) => m.month === "2026-06");
    expect(june!.summary.cogs).toBeCloseTo(10, 2); // unit cost 5 * qty 2
  });
});

describe("hasMixedTypeOverlap", () => {
  const june = { periodStart: new Date("2025-06-01"), periodEnd: new Date("2025-06-30") };
  const july = { periodStart: new Date("2025-07-01"), periodEnd: new Date("2025-07-31") };

  it("flags different types on the same period", () => {
    expect(
      hasMixedTypeOverlap([
        { reportType: "DATE_RANGE", ...june },
        { reportType: "VAT_TRANSACTIONS", ...june },
      ])
    ).toBe(true);
  });

  it("accepts same type overlapping, or different types on disjoint periods", () => {
    expect(
      hasMixedTypeOverlap([
        { reportType: "DATE_RANGE", ...june },
        { reportType: "DATE_RANGE", ...june },
      ])
    ).toBe(false);
    expect(
      hasMixedTypeOverlap([
        { reportType: "DATE_RANGE", ...june },
        { reportType: "VAT_TRANSACTIONS", ...july },
      ])
    ).toBe(false);
  });
});
