import { describe, it, expect } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import type { TaggedTransaction, MonthlySummary } from "@/lib/aggregate";
import { computeVatSummary } from "@/lib/vat";

const BASE: TaggedTransaction = {
  date: null,
  type: "SALE",
  orderId: "1",
  sku: null,
  description: null,
  quantity: 1,
  marketplace: null,
  arrivalCountry: null,
  departCountry: null,
  buyerVatNumber: null,
  amountExclVat: 0,
  vatRate: null,
  vatAmount: 0,
  amountInclVat: 0,
  fees: 0,
  fbaFees: 0,
  otherFees: 0,
  total: 0,
  currency: "EUR",
  reportId: "r1",
  reportType: "SETTLEMENT",
};

function tx(overrides: Partial<TaggedTransaction>): TaggedTransaction {
  return { ...BASE, ...overrides };
}

function monthly(transactions: TaggedTransaction[]): MonthlySummary[] {
  const byMonth = new Map<string, TaggedTransaction[]>();
  for (const t of transactions) {
    const d = t.date ? new Date(t.date) : null;
    const month = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "";
    (byMonth.get(month) ?? byMonth.set(month, []).get(month)!).push(t);
  }
  return [...byMonth.entries()].map(([month, list]) => ({ month, summary: computeVatSummary(list) }));
}

describe("malformed VAT number", () => {
  it("flags a VAT number that doesn't start with a 2-letter country code", () => {
    const alerts = computeAlerts([tx({ buyerVatNumber: "12345BADPREFIX" })], []);
    expect(alerts).toContainEqual(
      expect.objectContaining({ kind: "malformedVatNumber", count: 1 })
    );
  });

  it("accepts a well-shaped VAT number", () => {
    const alerts = computeAlerts([tx({ buyerVatNumber: "FR12345678901" })], []);
    expect(alerts.some((a) => a.kind === "malformedVatNumber")).toBe(false);
  });
});

describe("OSS threshold", () => {
  const year = new Date().getFullYear();
  const eu = (amount: number, i: number) =>
    tx({
      orderId: `o${i}`,
      date: new Date(year, 0, 1),
      arrivalCountry: "DE",
      amountExclVat: amount,
      amountInclVat: amount,
    });

  it("stays quiet well under the threshold", () => {
    const alerts = computeAlerts([eu(3000, 1)], []);
    expect(alerts.some((a) => a.kind.startsWith("ossThreshold"))).toBe(false);
  });

  it("flags approaching the threshold (80%+)", () => {
    const alerts = computeAlerts([eu(8500, 1)], []);
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "ossThresholdApproaching" }));
  });

  it("flags exceeding the threshold", () => {
    const alerts = computeAlerts([eu(6000, 1), eu(6000, 2)], []);
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "ossThresholdExceeded", amount: 12000 }));
  });

  it("ignores domestic FR sales and B2B (has a VAT number) sales", () => {
    const domestic = tx({ date: new Date(year, 0, 1), arrivalCountry: "FR", amountExclVat: 20000 });
    const b2b = tx({
      orderId: "b2b",
      date: new Date(year, 0, 1),
      arrivalCountry: "DE",
      buyerVatNumber: "DE123456789",
      amountExclVat: 20000,
    });
    const alerts = computeAlerts([domestic, b2b], []);
    expect(alerts.some((a) => a.kind.startsWith("ossThreshold"))).toBe(false);
  });

  it("ignores sales from a previous year", () => {
    const alerts = computeAlerts([eu(20000, 1)].map((t) => ({ ...t, date: new Date(year - 1, 0, 1) })), []);
    expect(alerts.some((a) => a.kind.startsWith("ossThreshold"))).toBe(false);
  });
});

describe("missing months", () => {
  it("flags an interior gap between two covered months", () => {
    const june = tx({ date: new Date(2025, 5, 15) });
    const august = tx({ orderId: "2", date: new Date(2025, 7, 15) });
    const alerts = computeAlerts([], monthly([june, august]));
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "missingMonth", month: "2025-07" }));
  });

  it("does not flag consecutive months", () => {
    const june = tx({ date: new Date(2025, 5, 15) });
    const july = tx({ orderId: "2", date: new Date(2025, 6, 15) });
    const alerts = computeAlerts([], monthly([june, july]));
    expect(alerts.some((a) => a.kind === "missingMonth")).toBe(false);
  });

  it("does not flag anything with only one covered month", () => {
    const june = tx({ date: new Date(2025, 5, 15) });
    const alerts = computeAlerts([], monthly([june]));
    expect(alerts.some((a) => a.kind === "missingMonth")).toBe(false);
  });
});

describe("fee ratio", () => {
  it("flags an unusually high fee ratio on fee-bearing report types", () => {
    const s = tx({ reportType: "SETTLEMENT", amountInclVat: 100, fees: -70 });
    const alerts = computeAlerts([s], []);
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "unusualFeeRatio", direction: "high" }));
  });

  it("flags an unusually low fee ratio on fee-bearing report types", () => {
    const s = tx({ reportType: "SETTLEMENT", amountInclVat: 100, fees: -1 });
    const alerts = computeAlerts([s], []);
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "unusualFeeRatio", direction: "low" }));
  });

  it("stays quiet on a normal fee ratio", () => {
    const s = tx({ reportType: "SETTLEMENT", amountInclVat: 100, fees: -25 });
    const alerts = computeAlerts([s], []);
    expect(alerts.some((a) => a.kind === "unusualFeeRatio")).toBe(false);
  });

  it("does not flag VAT_TRANSACTIONS rows, which never carry fee data", () => {
    const s = tx({ reportType: "VAT_TRANSACTIONS", amountInclVat: 100, fees: 0 });
    const alerts = computeAlerts([s], []);
    expect(alerts.some((a) => a.kind === "unusualFeeRatio")).toBe(false);
  });
});
