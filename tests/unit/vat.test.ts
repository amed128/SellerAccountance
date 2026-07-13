import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReportFile } from "@/lib/parsers";
import { computeVatSummary } from "@/lib/vat";

const sample = (name: string) =>
  readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

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
