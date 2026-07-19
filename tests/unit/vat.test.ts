import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReportFile } from "@/lib/parsers";
import { computeVatSummary, computeUnitCosts } from "@/lib/vat";
import type { NormalizedTransaction } from "@/lib/parsers/types";

const sample = (name: string) =>
  readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

const BASE_TX: NormalizedTransaction = {
  date: new Date("2026-06-01"),
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
  amountInclVat: 100,
  fees: 0,
  fbaFees: 0,
  otherFees: 0,
  total: 100,
  currency: "EUR",
};

function tx(overrides: Partial<NormalizedTransaction>): NormalizedTransaction {
  return { ...BASE_TX, ...overrides };
}

describe("VAT summary from the VAT Transactions sample", () => {
  const { transactions } = parseReportFile("vat.csv", sample("vat-transactions-sample.csv"));
  const s = computeVatSummary(transactions);

  it("computes exact revenue (hand-verified figures)", () => {
    expect(s.grossRevenue).toBeCloseTo(240, 2);
    expect(s.netRevenue).toBeCloseTo(205, 2);
    expect(s.estimated).toBe(false);
  });

  it("splits French VAT and OSS", () => {
    expect(s.vatCollectedFr).toBeCloseTo(10, 2); // 15 collected - 5 refunded
    expect(s.vatOss).toBeCloseTo(10, 2); // DE 4.79 + ES 5.21
    expect(s.vatToPay).toBeCloseTo(20, 2);
  });

  it("charges no VAT on B2B reverse charge and exports", () => {
    const be = s.byCountry.find((c) => c.country === "BE");
    expect(be?.regime).toBe("REVERSE_CHARGE_B2B");
    expect(be?.vatAmount).toBe(0);
    const ch = s.byCountry.find((c) => c.country === "CH");
    expect(ch?.regime).toBe("EXPORT");
    expect(ch?.vatAmount).toBe(0);
  });

  it("emits note keys, not prose", () => {
    expect(s.notes).toContain("b2bReverseCharge");
    expect(s.notes).toContain("exportExempt");
    expect(s.notes).not.toContain("estimated");
  });
});

describe("VAT summary from the Date Range sample (no VAT columns)", () => {
  const { transactions } = parseReportFile("dr.csv", sample("date-range-sample-fr.csv"));
  const s = computeVatSummary(transactions);

  it("estimates VAT at 20% and flags it", () => {
    expect(s.estimated).toBe(true);
    expect(s.notes).toContain("estimated");
    // CA TTC 62.90 => HT 52.4166, VAT 10.4833
    expect(s.grossRevenue).toBeCloseTo(62.9, 2);
    expect(s.netRevenue).toBeCloseTo(52.42, 2);
    expect(s.vatToPay).toBeCloseTo(10.48, 2);
  });

  it("reconciles the net movement and separates transfers", () => {
    expect(s.netPayout).toBeCloseTo(0, 2);
    expect(s.bankTransfers).toBeCloseTo(-4.86, 2);
    // -4.5-3.2-9.44-6.4+4.5-39 ; the transfer's -4.86 in "autre" must NOT count as a fee
    expect(s.totalFees).toBeCloseTo(-58.04, 2);
  });
});

describe("non-FR home country", () => {
  it("classifies a sale to the home country as domestic, not OSS", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "DE" })], "DE");
    const entry = s.byCountry.find((c) => c.country === "DE");
    expect(entry?.regime).toBe("DOMESTIC");
    expect(s.vatCollectedFr).toBeGreaterThan(0);
    expect(s.vatOss).toBe(0);
  });

  it("classifies a sale to a different EU country as OSS", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "DE");
    const entry = s.byCountry.find((c) => c.country === "FR");
    expect(entry?.regime).toBe("OSS");
    expect(s.vatCollectedFr).toBe(0);
    expect(s.vatOss).toBeGreaterThan(0);
  });

  it("estimates VAT at the home country's rate, not always 20%", () => {
    // Germany's standard rate (19%) differs from France's (20%) — a report
    // with no VAT detail must estimate using the seller's own country's rate.
    const s = computeVatSummary(
      [tx({ arrivalCountry: "DE", amountInclVat: 100, amountExclVat: 0, vatAmount: 0 })],
      "DE"
    );
    expect(s.estimated).toBe(true);
    expect(s.netRevenue).toBeCloseTo(100 / 1.19, 2);
    expect(s.netRevenue).not.toBeCloseTo(100 / 1.2, 2);
  });

  it("still treats non-EU destinations as exports regardless of home country", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "US" })], "DE");
    const entry = s.byCountry.find((c) => c.country === "US");
    expect(entry?.regime).toBe("EXPORT");
    expect(entry?.vatAmount).toBe(0);
  });
});

describe("franchise en base (VAT-exempt small business)", () => {
  it("zeroes out all VAT regardless of country mix", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR" }), tx({ orderId: "2", arrivalCountry: "DE" })],
      "FR",
      "FRANCHISE"
    );
    expect(s.vatCollectedFr).toBe(0);
    expect(s.vatOss).toBe(0);
    expect(s.vatToPay).toBe(0);
    expect(s.byCountry.every((c) => c.vatAmount === 0)).toBe(true);
  });

  it("still reports revenue normally — only VAT is suppressed", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR", amountInclVat: 100 })], "FR", "FRANCHISE");
    expect(s.grossRevenue).toBeCloseTo(100, 2);
  });

  it("emits only the franchise note, not the usual VAT notes", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "FR", "FRANCHISE");
    expect(s.notes).toEqual(["franchiseExempt"]);
  });
});

describe("Amazon fees reverse charge (self-assessed VAT on fees)", () => {
  it("is due and deductible for a STANDARD-regime seller — net-zero impact on vatToPay", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR", fees: -50, fbaFees: -20, otherFees: 0 })],
      "FR",
      "STANDARD"
    );
    // FR rate 20%, fees HT 70 => VAT 14
    expect(s.feesReverseChargeVatDue).toBeCloseTo(14, 2);
    expect(s.feesReverseChargeVatDeductible).toBeCloseTo(14, 2);
    expect(s.notes).toContain("amazonFeesReverseCharge");
    // vatCollectedFr from the base sale (100 incl @ 20%) is 16.67; fees due/deductible cancel out
    expect(s.vatToPay).toBeCloseTo(s.vatCollectedFr + s.vatOss, 2);
  });

  it("is due but NOT deductible for a FRANCHISE seller — a real added cost", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR", fees: -50, fbaFees: -20, otherFees: 0 })],
      "FR",
      "FRANCHISE"
    );
    expect(s.feesReverseChargeVatDue).toBeCloseTo(14, 2);
    expect(s.feesReverseChargeVatDeductible).toBe(0);
    expect(s.vatCollectedFr).toBe(0);
    expect(s.vatOss).toBe(0);
    // Unlike a plain franchise seller with no fees, vatToPay is no longer zero.
    expect(s.vatToPay).toBeCloseTo(14, 2);
    expect(s.notes).toEqual(["franchiseExempt", "franchiseFeesReverseCharge"]);
  });

  it("is skipped entirely when the report carries no fee data", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "FR", "STANDARD");
    expect(s.feesReverseChargeVatDue).toBe(0);
    expect(s.notes).not.toContain("amazonFeesReverseCharge");
  });
});

describe("sourcing invoice deduction", () => {
  const domesticInvoice = {
    date: new Date("2026-06-01"),
    sku: "SKU-X",
    quantity: 1,
    amountExclVat: 100,
    vatAmount: 20,
    vatTreatment: "DOMESTIC",
  };

  it("deducts a DOMESTIC invoice's own VAT amount for a STANDARD seller", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "FR", "STANDARD", [domesticInvoice]);
    expect(s.sourcingDeductibleVat).toBeCloseTo(20, 2);
    expect(s.sourcingNonDeductibleVat).toBe(0);
    expect(s.vatToPay).toBeCloseTo(s.vatCollectedFr + s.vatOss - 20, 2);
  });

  it("self-assesses a REVERSE_CHARGE invoice at the home rate, ignoring the (zero) entered VAT amount", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR" })],
      "FR",
      "STANDARD",
      [{ date: new Date("2026-06-01"), sku: "SKU-X", quantity: 1, amountExclVat: 100, vatAmount: 0, vatTreatment: "REVERSE_CHARGE" }]
    );
    // FR rate 20% on HT 100 => 20, same as if the supplier had charged it directly
    expect(s.sourcingDeductibleVat).toBeCloseTo(20, 2);
    // Reverse charge = the VAT is also DUE (self-assessed): both sides must be
    // in the summary, netting to zero for a STANDARD seller
    expect(s.sourcingReverseChargeVatDue).toBeCloseTo(20, 2);
    expect(s.vatToPay).toBeCloseTo(s.vatCollectedFr + s.vatOss, 2);
  });

  it("charges the REVERSE_CHARGE due side as a real cost for a FRANCHISE seller", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR" })],
      "FR",
      "FRANCHISE",
      [{ date: new Date("2026-06-01"), sku: "SKU-X", quantity: 1, amountExclVat: 100, vatAmount: 0, vatTreatment: "REVERSE_CHARGE" }]
    );
    expect(s.sourcingReverseChargeVatDue).toBeCloseTo(20, 2);
    expect(s.sourcingDeductibleVat).toBe(0);
    // Due, not deductible: increases vatToPay (fees RC due is also in there)
    expect(s.vatToPay).toBeCloseTo(s.feesReverseChargeVatDue + 20, 2);
  });

  it("withholds IMPORT VAT from deduction even for a STANDARD seller, pending the customs document", () => {
    const s = computeVatSummary(
      [tx({ arrivalCountry: "FR" })],
      "FR",
      "STANDARD",
      [{ date: new Date("2026-06-01"), sku: "SKU-X", quantity: 1, amountExclVat: 100, vatAmount: 20, vatTreatment: "IMPORT" }]
    );
    expect(s.sourcingDeductibleVat).toBe(0);
    expect(s.sourcingNonDeductibleVat).toBeCloseTo(20, 2);
    expect(s.notes).toContain("sourcingImportVatWithheld");
    // Non-deductible VAT must NOT reduce vatToPay — it's a cost, not a credit.
    expect(s.vatToPay).toBeCloseTo(s.vatCollectedFr + s.vatOss, 2);
  });

  it("makes ALL sourcing VAT non-deductible for a FRANCHISE seller, regardless of treatment", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "FR", "FRANCHISE", [domesticInvoice]);
    expect(s.sourcingDeductibleVat).toBe(0);
    expect(s.sourcingNonDeductibleVat).toBeCloseTo(20, 2);
    expect(s.notes).toContain("franchiseSourcingNotDeductible");
  });

  it("is a no-op when there are no sourcing invoices", () => {
    const s = computeVatSummary([tx({ arrivalCountry: "FR" })], "FR", "STANDARD");
    expect(s.sourcingDeductibleVat).toBe(0);
    expect(s.sourcingNonDeductibleVat).toBe(0);
    expect(s.notes).not.toContain("sourcingImportVatWithheld");
  });
});

describe("cost of goods sold and gross margin", () => {
  const skuAInvoice = {
    date: new Date("2026-05-01"),
    sku: "SKU-A",
    quantity: 1,
    amountExclVat: 5,
    vatAmount: 1,
    vatTreatment: "DOMESTIC",
  };

  it("matches a sale's SKU against the weighted-average unit cost", () => {
    const unitCosts = computeUnitCosts([skuAInvoice]);
    const s = computeVatSummary(
      [tx({ sku: "SKU-A", quantity: 2, amountExclVat: 100, vatAmount: 20, amountInclVat: 120 })],
      "FR",
      "STANDARD",
      [],
      unitCosts
    );
    expect(s.cogs).toBeCloseTo(10, 2); // unit cost 5 * qty 2
    expect(s.grossMargin).toBeCloseTo(90, 2); // netRevenue 100 - cogs 10
  });

  it("a REFUND reduces cogs the same way it reduces revenue", () => {
    const unitCosts = computeUnitCosts([skuAInvoice]);
    const s = computeVatSummary(
      [
        tx({ orderId: "1", sku: "SKU-A", quantity: 2, amountExclVat: 100, vatAmount: 20, amountInclVat: 120 }),
        tx({
          orderId: "1",
          type: "REFUND",
          sku: "SKU-A",
          quantity: 1,
          amountExclVat: 50,
          vatAmount: 10,
          amountInclVat: 60,
        }),
      ],
      "FR",
      "STANDARD",
      [],
      unitCosts
    );
    expect(s.cogs).toBeCloseTo(5, 2); // (5 * 2) - (5 * 1)
  });

  it("averages cost across several invoices for the same SKU (weighted, not a simple average)", () => {
    const unitCosts = computeUnitCosts([
      { date: new Date("2026-05-01"), sku: "SKU-A", quantity: 1, amountExclVat: 4, vatAmount: 0, vatTreatment: "DOMESTIC" },
      { date: new Date("2026-05-15"), sku: "SKU-A", quantity: 9, amountExclVat: 54, vatAmount: 0, vatTreatment: "DOMESTIC" },
    ]);
    // (4 + 54) / (1 + 9) = 5.8, not (4/1 + 54/9)/2 = 5
    expect(unitCosts.get("SKU-A")).toBeCloseTo(5.8, 2);
  });

  it("flags incomplete cost coverage when a sold SKU has no matching invoice, without crashing the calc", () => {
    const unitCosts = computeUnitCosts([skuAInvoice]);
    const s = computeVatSummary(
      [
        tx({ sku: "SKU-A", quantity: 1, amountExclVat: 50, vatAmount: 10, amountInclVat: 60 }),
        tx({ orderId: "2", sku: "SKU-UNKNOWN", quantity: 1, amountExclVat: 50, vatAmount: 10, amountInclVat: 60 }),
      ],
      "FR",
      "STANDARD",
      [],
      unitCosts
    );
    expect(s.cogs).toBeCloseTo(5, 2); // only SKU-A counted
    expect(s.notes).toContain("cogsIncomplete");
  });

  it("skips COGS entirely (no note, cogs stays 0) when no unit costs are supplied at all", () => {
    const s = computeVatSummary([tx({ sku: "SKU-UNKNOWN" })], "FR", "STANDARD");
    expect(s.cogs).toBe(0);
    expect(s.grossMargin).toBeCloseTo(s.netRevenue, 2);
    expect(s.notes).not.toContain("cogsIncomplete");
  });
});
