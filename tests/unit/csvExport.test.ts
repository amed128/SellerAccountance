import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { parseReportFile } from "@/lib/parsers";
import { computeVatSummary } from "@/lib/vat";
import { monthlySummaries, TaggedTransaction } from "@/lib/aggregate";
import { buildVatExportCsv } from "@/lib/csvExport";
import { dictionaries } from "@/lib/i18n";

const sample = (name: string) => readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

const { transactions } = parseReportFile("vat.csv", sample("vat-transactions-sample.csv"));
const summary = computeVatSummary(transactions);
const tagged: TaggedTransaction[] = transactions.map((t) => ({ ...t, reportId: "r1", reportType: "VAT_TRANSACTIONS" }));

describe("buildVatExportCsv", () => {
  it("includes the summary figures as plain dot-decimal numbers", () => {
    const csv = buildVatExportCsv({ title: "Test", summary }, "fr", dictionaries.fr);
    expect(csv).toContain("CA TTC,240.00,EUR");
    expect(csv).toContain("CA HT,205.00,EUR");
    expect(csv).toContain("TVA à payer,20.00,EUR");
  });

  it("includes the by-country breakdown", () => {
    const csv = buildVatExportCsv({ title: "Test", summary }, "fr", dictionaries.fr);
    expect(csv).toContain("Détail par pays");
    const rows = Papa.parse(csv).data as string[][];
    const deRow = rows.find((r) => r[0] === "DE");
    expect(deRow).toBeTruthy();
  });

  it("omits the monthly section when monthly is not provided (single-report export)", () => {
    const csv = buildVatExportCsv({ title: "Test", summary }, "fr", dictionaries.fr);
    expect(csv).not.toContain("Détail par mois");
  });

  it("includes the monthly section when monthly is provided (overview export)", () => {
    const monthly = monthlySummaries(tagged);
    const csv = buildVatExportCsv({ title: "Vue d'ensemble", summary, monthly }, "fr", dictionaries.fr);
    expect(csv).toContain("Détail par mois");
    expect(csv).toContain("juin 2026");
  });

  it("localizes labels but keeps numbers in the same raw format across locales", () => {
    const fr = buildVatExportCsv({ title: "Test", summary }, "fr", dictionaries.fr);
    const en = buildVatExportCsv({ title: "Test", summary }, "en", dictionaries.en);
    expect(fr).toContain("CA TTC");
    expect(en).toContain("Gross revenue");
    expect(fr).toContain("240.00");
    expect(en).toContain("240.00");
  });

  it("produces a well-formed CSV Excel can parse back (no thrown errors, ragged rows preserved)", () => {
    const monthly = monthlySummaries(tagged);
    const csv = buildVatExportCsv({ title: "Test", reportsIncluded: 1, summary, monthly }, "fr", dictionaries.fr);
    const parsed = Papa.parse(csv);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.data.length).toBeGreaterThan(5);
  });
});
