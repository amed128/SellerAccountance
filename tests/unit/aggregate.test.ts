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
