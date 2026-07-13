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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }
    const content = await file.text();
    const parsed = parseReportFile(file.name, content);
    const user = await getDefaultUser();

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

    // SQLite: chunk inserts to stay under parameter limits
    const chunkSize = 200;
    for (let i = 0; i < parsed.transactions.length; i += chunkSize) {
      await prisma.transaction.createMany({
        data: parsed.transactions.slice(i, i + chunkSize).map((t) => ({
          reportId: report.id,
          ...t,
        })),
      });
    }

    return NextResponse.json({ reportId: report.id, rowCount: parsed.transactions.length, reportType: parsed.reportType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du traitement du fichier.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
