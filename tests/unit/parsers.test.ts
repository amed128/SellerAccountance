import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReportFile } from "@/lib/parsers";
import { parseAmount, parseDate } from "@/lib/parsers/types";

const sample = (name: string) =>
  readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

describe("parseAmount", () => {
  it("parses EN and FR number formats", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("-2,43")).toBe(-2.43);
    expect(parseAmount("11.99")).toBe(11.99);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });
});

describe("parseDate", () => {
  it("parses ISO, FR slash and FR month-name dates", () => {
    expect(parseDate("2026-06-02")?.getFullYear()).toBe(2026);
    expect(parseDate("29/06/2025")?.getMonth()).toBe(5);
    const d = parseDate("30 juin 2025 22:31:31 UTC");
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(30);
    expect(parseDate("1 juil. 2025 00:03:15 UTC")?.getMonth()).toBe(6);
  });
});

describe("VAT Transactions report", () => {
  const parsed = parseReportFile("vat.csv", sample("vat-transactions-sample.csv"));

  it("detects the type and parses all rows", () => {
    expect(parsed.reportType).toBe("VAT_TRANSACTIONS");
    expect(parsed.transactions).toHaveLength(8);
  });

  it("keeps VAT amounts and countries", () => {
    const de = parsed.transactions.find((t) => t.arrivalCountry === "DE" && t.type === "SALE");
    expect(de?.vatAmount).toBe(4.79);
    const b2b = parsed.transactions.find((t) => t.buyerVatNumber);
    expect(b2b?.arrivalCountry).toBe("BE");
  });
});

describe("Settlement report", () => {
  const parsed = parseReportFile("settlement.txt", sample("settlement-sample.txt"));

  it("detects type and aggregates amount rows per order", () => {
    expect(parsed.reportType).toBe("SETTLEMENT");
    const order1 = parsed.transactions.find(
      (t) => t.orderId === "405-1111111-0000001" && t.type === "SALE"
    );
    expect(order1?.amountInclVat).toBe(30);
    expect(order1?.fees).toBe(-4.5);
    expect(order1?.fbaFees).toBe(-3.2);
  });
});

describe("Date Range report (FR)", () => {
  const parsed = parseReportFile("dr.csv", sample("date-range-sample-fr.csv"));

  it("skips the preamble and detects the type", () => {
    expect(parsed.reportType).toBe("DATE_RANGE");
    expect(parsed.transactions).toHaveLength(5);
  });

  it("classifies transfers without counting them as fees", () => {
    const transfer = parsed.transactions.find((t) => t.type === "TRANSFER");
    expect(transfer?.total).toBe(-4.86);
    expect(transfer?.otherFees).toBe(0);
  });

  it("supports the real 'autres frais de transaction' column name", () => {
    const csv = [
      '"date/heure","type","numéro de la commande","ventes de produits","frais de vente","Frais Expédié par Amazon","autres frais de transaction","autre","total"',
      '"1 juil. 2025 10:00:00 UTC","Commande","123-0000000-0000001","10,00","-1,00","-2,00","-0,25","0","6,75"',
    ].join("\n");
    const p = parseReportFile("x.csv", csv);
    expect(p.reportType).toBe("DATE_RANGE");
    expect(p.transactions[0].otherFees).toBe(-0.25);
  });
});

describe("Transactions view export (Payments dashboard)", () => {
  const csv = [
    '"Date","Statut de la transaction","Type de transaction","Numéro de la commande","Détails sur le produit","Total des frais produit","Total des rabais promotionnels","Commissions Amazon","Autres","Total (EUR)"',
    '"29/06/2025","Sorti","Paiement de la commande","403-0000000-0000001","Produit A","11.99","0","-7.11","0","4.88"',
    '"28/06/2025","Sorti","Remboursement","403-0000000-0000002","Produit B","-11.99","0","7.11","0","-4.88"',
    '"27/06/2025","Sorti","Virement de fonds","","","0","0","0","-119.94","-119.94"',
  ].join("\n");
  const parsed = parseReportFile("tv.csv", csv);

  it("detects the type and maps rows", () => {
    expect(parsed.reportType).toBe("TRANSACTION_VIEW");
    expect(parsed.transactions).toHaveLength(3);
    expect(parsed.transactions[0].type).toBe("SALE");
    expect(parsed.transactions[0].amountInclVat).toBe(11.99);
    expect(parsed.transactions[0].fees).toBe(-7.11);
    expect(parsed.transactions[1].type).toBe("REFUND");
  });

  it("does not count transfers as fees", () => {
    const transfer = parsed.transactions[2];
    expect(transfer.type).toBe("TRANSFER");
    expect(transfer.otherFees).toBe(0);
    expect(transfer.total).toBe(-119.94);
  });
});

describe("unknown format", () => {
  it("throws a helpful error", () => {
    expect(() => parseReportFile("x.csv", "a,b,c\n1,2,3")).toThrow(/non reconnu/);
  });
});
