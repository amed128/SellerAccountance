import { NextResponse } from "next/server";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { renderVatExportPdf } from "@/lib/pdfExport";
import { getReportExportData } from "@/lib/exportData";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const [data, { locale, d }] = await Promise.all([
    getReportExportData(user.id, id, user.homeCountry, user.vatRegime as "STANDARD" | "FRANCHISE"),
    getDict(),
  ]);
  if (!data) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const pdf = await renderVatExportPdf(data, locale, d);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="selleraccountance-${data.title.replace(/[^a-z0-9.-]+/gi, "_")}-export.pdf"`,
    },
  });
}
