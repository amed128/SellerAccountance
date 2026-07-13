import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeVatSummary } from "@/lib/vat";
import type { NormalizedTransaction } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

const REGIME_LABELS: Record<string, string> = {
  DOMESTIC_FR: "TVA française",
  OSS: "OSS (guichet unique UE)",
  REVERSE_CHARGE_B2B: "B2B autoliquidation",
  EXPORT: "Export hors UE (exonéré)",
  OTHER: "Autre",
};

function eur(n: number, currency = "EUR") {
  return n.toLocaleString("fr-FR", { style: "currency", currency });
}

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
  const report = await prisma.report.findUnique({
    where: { id },
    include: { transactions: true },
  });
  if (!report) notFound();

  const txs = report.transactions as unknown as NormalizedTransaction[];
  const summary = computeVatSummary(txs);
  const cur = report.currency;

  const sales = txs.filter((t) => t.type === "SALE").length;
  const refunds = txs.filter((t) => t.type === "REFUND").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600">← Retour</Link>
      <h1 className="mt-2 text-2xl font-bold">{report.fileName}</h1>
      <p className="text-gray-500 text-sm">
        {report.rowCount} lignes · {sales} ventes · {refunds} remboursements
      </p>

      <h2 className="mt-8 text-lg font-semibold">Chiffre d’affaires</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="CA TTC" value={eur(summary.grossRevenue, cur)} />
        <Card label="CA HT" value={eur(summary.netRevenue, cur)} />
        <Card label="Frais Amazon" value={eur(summary.totalFees, cur)} accent="text-red-600" />
        <Card label="Mouvement net" value={eur(summary.netPayout, cur)} accent="text-green-600" sub="Solde net du rapport" />
        {summary.bankTransfers !== 0 && (
          <Card
            label="Virements bancaires"
            value={eur(Math.abs(summary.bankTransfers), cur)}
            sub="Transferts vers votre compte (hors frais)"
          />
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">TVA</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label="TVA collectée (France)" value={eur(summary.vatCollectedFr, cur)} sub="CA3, ligne ventes France" />
        <Card label="TVA due via OSS" value={eur(summary.vatOss, cur)} sub="Déclaration guichet unique UE" />
        <Card
          label={summary.vatToPay >= 0 ? "TVA à payer" : "TVA à récupérer"}
          value={eur(Math.abs(summary.vatToPay), cur)}
          accent={summary.vatToPay >= 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      {summary.byCountry.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Détail par pays</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Pays</th>
                  <th className="px-4 py-2 font-medium">Régime</th>
                  <th className="px-4 py-2 font-medium text-right">Base HT</th>
                  <th className="px-4 py-2 font-medium text-right">TVA</th>
                  <th className="px-4 py-2 font-medium text-right">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.byCountry.map((c) => (
                  <tr key={`${c.country}-${c.regime}`}>
                    <td className="px-4 py-2 font-medium">{c.country}</td>
                    <td className="px-4 py-2">{REGIME_LABELS[c.regime]}</td>
                    <td className="px-4 py-2 text-right">{eur(c.taxableBase, cur)}</td>
                    <td className="px-4 py-2 text-right">{eur(c.vatAmount, cur)}</td>
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
          <p className="font-semibold">À savoir</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            {summary.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
