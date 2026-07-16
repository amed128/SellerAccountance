import { NextResponse } from "next/server";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { buildVatExportCsv } from "@/lib/csvExport";
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
  const csv = buildVatExportCsv(data, locale, d);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selleraccountance-overview-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
