import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReportFile } from "@/lib/parsers";
import { computeVatSummary } from "@/lib/vat";
import { monthlySummaries, TaggedTransaction } from "@/lib/aggregate";
import { renderVatExportPdf } from "@/lib/pdfExport";
import { dictionaries } from "@/lib/i18n";

const sample = (name: string) => readFileSync(path.join(__dirname, "../../samples", name), "utf-8");

const { transactions } = parseReportFile("vat.csv", sample("vat-transactions-sample.csv"));
const summary = computeVatSummary(transactions);
const tagged: TaggedTransaction[] = transactions.map((t) => ({ ...t, reportId: "r1", reportType: "VAT_TRANSACTIONS" }));

// Renders full binary PDFs — asserted structurally (valid PDF bytes, no
// crash) rather than by text content, which the CSV export tests already
// cover for the underlying figures since both share the same input shape.
describe("renderVatExportPdf", () => {
  it("produces a well-formed PDF for a single-report export (no monthly section)", async () => {
    const pdf = await renderVatExportPdf({ title: "Test report", summary }, "fr", dictionaries.fr);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("produces a well-formed PDF for an overview export with monthly data", async () => {
    const monthly = monthlySummaries(tagged);
    const pdf = await renderVatExportPdf(
      { title: "Vue d'ensemble", reportsIncluded: 1, summary, monthly },
      "fr",
      dictionaries.fr
    );
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("renders in English without throwing", async () => {
    const pdf = await renderVatExportPdf({ title: "Test report", summary }, "en", dictionaries.en);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles a report with no by-country data without throwing", async () => {
    const emptySummary = computeVatSummary([]);
    const pdf = await renderVatExportPdf({ title: "Empty", summary: emptySummary }, "fr", dictionaries.fr);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
