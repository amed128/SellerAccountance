import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { computeVatSummary } from "@/lib/vat";
import { formatMoney } from "@/lib/format";
import type { NormalizedTransaction } from "@/lib/parsers/types";

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

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, report, { locale, d }] = await Promise.all([
    requireUser(),
    prisma.report.findUnique({ where: { id }, include: { transactions: true } }),
    getDict(),
  ]);
  if (!report || report.userId !== user.id) notFound();
  const t = d.dashboard;

  const txs = report.transactions as unknown as NormalizedTransaction[];
  const summary = computeVatSummary(txs);
  const cur = report.currency;
  const money = (n: number) => formatMoney(n, locale, cur);

  const sales = txs.filter((x) => x.type === "SALE").length;
  const refunds = txs.filter((x) => x.type === "REFUND").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 w-full">
      <Link href="/" className="text-sm text-blue-600">{t.back}</Link>
      <h1 className="mt-2 text-2xl font-bold">{report.fileName}</h1>
      <p className="text-gray-500 text-sm">
        {report.rowCount} {t.rows} · {sales} {t.sales} · {refunds} {t.refunds}
      </p>

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
                  <th className="px-4 py-2 font-medium text-right">{t.txCount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.byCountry.map((c) => (
                  <tr key={`${c.country}-${c.regime}`}>
                    <td className="px-4 py-2 font-medium">{c.country}</td>
                    <td className="px-4 py-2">{t.regimes[c.regime]}</td>
                    <td className="px-4 py-2 text-right">{money(c.taxableBase)}</td>
                    <td className="px-4 py-2 text-right">{money(c.vatAmount)}</td>
                    <td className="px-4 py-2 text-right">{c.transactionCount}</td>
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
              <li key={key}>{t.vatNotes[key]}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
