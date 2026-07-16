import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { dedupeTransactions, monthlySummaries, TaggedTransaction } from "@/lib/aggregate";
import { computeVatSummary } from "@/lib/vat";
import { buildVatExportCsv } from "@/lib/csvExport";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const [reports, { locale, d }] = await Promise.all([
    prisma.report.findMany({
      where: { userId: user.id },
      include: { transactions: true },
      orderBy: { uploadedAt: "asc" },
    }),
    getDict(),
  ]);

  const tagged: TaggedTransaction[] = reports.flatMap((r) =>
    (r.transactions as unknown as TaggedTransaction[]).map((tx) => ({
      ...tx,
      reportId: r.id,
      reportType: r.reportType,
    }))
  );
  const { transactions } = dedupeTransactions(tagged);
  const summary = computeVatSummary(transactions);
  const monthly = monthlySummaries(transactions);

  const dates = transactions
    .map((x) => (x.date ? new Date(x.date).getTime() : null))
    .filter((x): x is number => x != null);

  const csv = buildVatExportCsv(
    {
      title: d.overview.title,
      period: dates.length > 0 ? { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) } : null,
      reportsIncluded: reports.length,
      summary,
      monthly,
    },
    locale,
    d
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selleraccountance-overview-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
