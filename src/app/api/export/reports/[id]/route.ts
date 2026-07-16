import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { computeVatSummary } from "@/lib/vat";
import { buildVatExportCsv } from "@/lib/csvExport";
import type { NormalizedTransaction } from "@/lib/parsers/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const [report, { locale, d }] = await Promise.all([
    prisma.report.findUnique({ where: { id }, include: { transactions: true } }),
    getDict(),
  ]);
  if (!report || report.userId !== user.id) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const txs = report.transactions as unknown as NormalizedTransaction[];
  const summary = computeVatSummary(txs);

  const csv = buildVatExportCsv(
    {
      title: report.fileName,
      period: report.periodStart && report.periodEnd ? { start: report.periodStart, end: report.periodEnd } : null,
      summary,
    },
    locale,
    d
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selleraccountance-${report.fileName.replace(/[^a-z0-9.-]+/gi, "_")}-export.csv"`,
    },
  });
}
