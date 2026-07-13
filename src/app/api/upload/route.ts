import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseReportFile } from "@/lib/parsers";

// Single-user MVP: everything belongs to a default local user.
// Replaced by real auth in the SaaS step.
async function getDefaultUser() {
  return prisma.user.upsert({
    where: { email: "local@selleraccountance.dev" },
    update: {},
    create: { email: "local@selleraccountance.dev", name: "Local User" },
  });
}

const MAX_FILES = 10;

interface FileResult {
  fileName: string;
  reportId?: string;
  rowCount?: number;
  reportType?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = [...formData.getAll("files"), formData.get("file")].filter(
    (f): f is File => f instanceof File
  );
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} fichiers par génération.` }, { status: 400 });
  }

  const user = await getDefaultUser();
  const results: FileResult[] = [];

  for (const file of files) {
    try {
      const content = await file.text();
      const parsed = parseReportFile(file.name, content);
      const report = await prisma.report.create({
        data: {
          userId: user.id,
          fileName: file.name,
          reportType: parsed.reportType,
          currency: parsed.currency,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          rowCount: parsed.transactions.length,
        },
      });
      const chunkSize = 500;
      for (let i = 0; i < parsed.transactions.length; i += chunkSize) {
        await prisma.transaction.createMany({
          data: parsed.transactions.slice(i, i + chunkSize).map((t) => ({
            reportId: report.id,
            ...t,
          })),
        });
      }
      results.push({
        fileName: file.name,
        reportId: report.id,
        rowCount: parsed.transactions.length,
        reportType: parsed.reportType,
      });
    } catch (err) {
      results.push({
        fileName: file.name,
        error: err instanceof Error ? err.message : "Erreur lors du traitement du fichier.",
      });
    }
  }

  const created = results.filter((r) => r.reportId);
  return NextResponse.json(
    { results, createdCount: created.length },
    { status: created.length > 0 ? 200 : 422 }
  );
}
