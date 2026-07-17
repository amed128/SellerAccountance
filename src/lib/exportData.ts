import { prisma } from "@/lib/db";
import { dedupeTransactions, monthlySummaries, MonthlySummary, TaggedTransaction } from "@/lib/aggregate";
import { computeVatSummary, VatSummary, VatRegime, DEFAULT_HOME_COUNTRY } from "@/lib/vat";
import type { NormalizedTransaction } from "@/lib/parsers/types";

export interface OverviewExportData {
  title: string;
  period: { start: Date; end: Date } | null;
  reportsIncluded: number;
  summary: VatSummary;
  monthly: MonthlySummary[];
}

export async function getOverviewExportData(
  userId: string,
  overviewTitle: string,
  homeCountry: string = DEFAULT_HOME_COUNTRY,
  vatRegime: VatRegime = "STANDARD"
): Promise<OverviewExportData> {
  const [reports, sourcingInvoices] = await Promise.all([
    prisma.report.findMany({
      where: { userId },
      include: { transactions: true },
      orderBy: { uploadedAt: "asc" },
    }),
    prisma.sourcingInvoice.findMany({ where: { userId } }),
  ]);

  const tagged: TaggedTransaction[] = reports.flatMap((r) =>
    (r.transactions as unknown as TaggedTransaction[]).map((tx) => ({
      ...tx,
      reportId: r.id,
      reportType: r.reportType,
    }))
  );
  const { transactions } = dedupeTransactions(tagged);
  const summary = computeVatSummary(transactions, homeCountry, vatRegime, sourcingInvoices);
  const monthly = monthlySummaries(transactions, homeCountry, vatRegime, sourcingInvoices);

  const dates = transactions
    .map((x) => (x.date ? new Date(x.date).getTime() : null))
    .filter((x): x is number => x != null);

  return {
    title: overviewTitle,
    period: dates.length > 0 ? { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) } : null,
    reportsIncluded: reports.length,
    summary,
    monthly,
  };
}

export interface ReportExportData {
  title: string;
  period: { start: Date; end: Date } | null;
  summary: VatSummary;
}

/** Returns null when the report doesn't exist or isn't owned by userId. */
export async function getReportExportData(
  userId: string,
  reportId: string,
  homeCountry: string = DEFAULT_HOME_COUNTRY,
  vatRegime: VatRegime = "STANDARD"
): Promise<ReportExportData | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { transactions: true } });
  if (!report || report.userId !== userId) return null;

  const txs = report.transactions as unknown as NormalizedTransaction[];
  const summary = computeVatSummary(txs, homeCountry, vatRegime);

  return {
    title: report.fileName,
    period: report.periodStart && report.periodEnd ? { start: report.periodStart, end: report.periodEnd } : null,
    summary,
  };
}
