import { NextResponse } from "next/server";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { renderVatExportPdf } from "@/lib/pdfExport";
import { getOverviewExportData } from "@/lib/exportData";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { locale, d } = await getDict();
  const data = await getOverviewExportData(
    user.id,
    d.overview.title,
    user.homeCountry,
    user.vatRegime as "STANDARD" | "FRANCHISE"
  );
  const pdf = await renderVatExportPdf(data, locale, d);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="selleraccountance-overview-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
