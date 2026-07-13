import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import UploadForm from "@/components/UploadForm";

export const dynamic = "force-dynamic";

function fmtPeriod(start: Date | null, end: Date | null, locale: string) {
  if (!start || !end) return "—";
  const f = (d: Date) =>
    d.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  return `${f(start)} → ${f(end)}`;
}

export default async function Home() {
  const [reports, { locale, d }] = await Promise.all([
    prisma.report.findMany({ orderBy: { uploadedAt: "desc" } }),
    getDict(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 w-full">
      <h1 className="text-2xl font-bold">SellerAccountance</h1>
      <p className="mt-1 text-gray-500">{d.home.tagline}</p>

      <section className="mt-8">
        <UploadForm d={d.upload} />
        <p className="mt-3 text-sm">
          <Link href="/help" className="text-blue-600 hover:underline">
            {d.home.helpHint}
          </Link>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{d.home.reports}</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{d.home.noReports}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div>
                    <p className="font-medium">{r.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {d.reportTypes[r.reportType] ?? r.reportType} · {fmtPeriod(r.periodStart, r.periodEnd, locale)} ·{" "}
                      {r.rowCount} {d.home.rows}
                    </p>
                  </div>
                  <span className="text-sm text-blue-600">{d.home.view}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
