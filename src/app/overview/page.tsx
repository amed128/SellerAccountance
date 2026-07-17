import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireOnboardedUser } from "@/lib/auth";
import {
  dedupeTransactions,
  monthlySummaries,
  hasMixedTypeOverlap,
  TaggedTransaction,
} from "@/lib/aggregate";
import { computeVatSummary, EU_STANDARD_VAT_RATES } from "@/lib/vat";
import { computeAlerts } from "@/lib/alerts";
import { formatMoney, formatMonth, formatVatNote } from "@/lib/format";
import AlertList from "@/components/AlertList";

export const dynamic = "force-dynamic";

function Card({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ?? ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function monthLabel(month: string, locale: string, undated: string) {
  return month ? formatMonth(month, locale) : undated;
}

export default async function OverviewPage() {
  const user = await requireOnboardedUser();
  const [reports, { locale, d }] = await Promise.all([
    prisma.report.findMany({
      where: { userId: user.id },
      include: { transactions: true },
      orderBy: { uploadedAt: "asc" },
    }),
    getDict(),
  ]);
  const t = d.dashboard;

  if (reports.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 w-full">
        <h1 className="text-2xl font-bold">{d.overview.title}</h1>
        <p className="mt-4 text-gray-500">{d.overview.empty}</p>
      </main>
    );
  }

  const tagged: TaggedTransaction[] = reports.flatMap((r) =>
    (r.transactions as unknown as TaggedTransaction[]).map((tx) => ({
      ...tx,
      reportId: r.id,
      reportType: r.reportType,
    }))
  );
  const { transactions, duplicatesRemoved } = dedupeTransactions(tagged);
  const summary = computeVatSummary(transactions, user.homeCountry, user.vatRegime as "STANDARD" | "FRANCHISE");
  const months = monthlySummaries(transactions, user.homeCountry, user.vatRegime as "STANDARD" | "FRANCHISE");
  const mixedOverlap = hasMixedTypeOverlap(reports);
  const alerts = computeAlerts(transactions, months, user.homeCountry);
  const cur = summary.currency;
  const money = (n: number) => formatMoney(n, locale, cur);

  const dates = transactions
    .map((x) => (x.date ? new Date(x.date).getTime() : null))
    .filter((x): x is number => x != null);
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{d.overview.title}</h1>
          <p className="mt-1 text-gray-500">{d.overview.subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href="/api/export/overview"
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600"
          >
            {d.export.buttonCsv}
          </a>
          <a
            href="/api/export/overview/pdf"
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600"
          >
            {d.export.buttonPdf}
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {d.overview.reportsIncluded.replace("{n}", String(reports.length))}
        {dates.length > 0 && (
          <>
            {" · "}
            {d.overview.period}: {fmt(Math.min(...dates))} → {fmt(Math.max(...dates))}
          </>
        )}
      </p>

      {mixedOverlap && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          ⚠ {d.overview.mixedWarning}
        </p>
      )}
      {duplicatesRemoved > 0 && (
        <p className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
          {d.overview.duplicatesRemoved.replace("{n}", String(duplicatesRemoved))}
        </p>
      )}
      <AlertList alerts={alerts} locale={locale} currency={cur} d={d.alerts} />

      <h2 className="mt-8 text-lg font-semibold">{t.revenue}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label={t.grossRevenue} value={money(summary.grossRevenue)} />
        <Card label={t.netRevenue} value={money(summary.netRevenue)} />
        <Card label={t.fees} value={money(summary.totalFees)} accent="text-red-600" />
        <Card label={t.netMovement} value={money(summary.netPayout)} accent="text-green-600" sub={t.netMovementSub} />
        {summary.bankTransfers !== 0 && (
          <Card label={t.bankTransfers} value={money(Math.abs(summary.bankTransfers))} sub={t.bankTransfersSub} />
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t.vat}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label={t.vatFr} value={money(summary.vatCollectedFr)} sub={t.vatFrSub} />
        <Card label={t.vatOss} value={money(summary.vatOss)} sub={t.vatOssSub} />
        <Card
          label={summary.vatToPay >= 0 ? t.vatToPay : t.vatToClaim}
          value={money(Math.abs(summary.vatToPay))}
          accent={summary.vatToPay >= 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold">{d.overview.monthly}</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">{d.overview.month}</th>
              <th className="px-4 py-2 font-medium text-right">{t.grossRevenue}</th>
              <th className="px-4 py-2 font-medium text-right">{t.netRevenue}</th>
              <th className="px-4 py-2 font-medium text-right">{t.fees}</th>
              <th className="px-4 py-2 font-medium text-right">{t.vatToPay}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {months.map(({ month, summary: m }) => (
              <tr key={month || "undated"}>
                <td className="px-4 py-2 font-medium capitalize">{monthLabel(month, locale, d.overview.undated)}</td>
                <td className="px-4 py-2 text-right">{money(m.grossRevenue)}</td>
                <td className="px-4 py-2 text-right">{money(m.netRevenue)}</td>
                <td className="px-4 py-2 text-right">{money(m.totalFees)}</td>
                <td className="px-4 py-2 text-right">{money(m.vatToPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.byCountry.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{t.byCountry}</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.country}</th>
                  <th className="px-4 py-2 font-medium">{t.regime}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.taxableBase}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.vatCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.byCountry.map((c) => (
                  <tr key={`${c.country}-${c.regime}`}>
                    <td className="px-4 py-2 font-medium">{c.country}</td>
                    <td className="px-4 py-2">{t.regimes[c.regime]}</td>
                    <td className="px-4 py-2 text-right">{money(c.taxableBase)}</td>
                    <td className="px-4 py-2 text-right">{money(c.vatAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {summary.notes.length > 0 && (
        <div className="mt-8 rounded-xl bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">{t.notes}</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            {summary.notes.map((key) => (
              <li key={key}>
                {formatVatNote(key, t.vatNotes[key], locale, user.homeCountry, d.countries, EU_STANDARD_VAT_RATES)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 text-sm">
        <Link href="/" className="text-blue-600 hover:underline">
          {t.back}
        </Link>
      </p>
    </main>
  );
}
