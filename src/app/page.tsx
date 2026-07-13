import Link from "next/link";
import { prisma } from "@/lib/db";
import UploadForm from "@/components/UploadForm";
import ExportGuide from "@/components/ExportGuide";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  VAT_TRANSACTIONS: "Transactions TVA",
  SETTLEMENT: "Règlement",
  DATE_RANGE: "Plage de dates",
  TRANSACTION_VIEW: "Vue Transactions (Paiements)",
};

function fmtPeriod(start: Date | null, end: Date | null) {
  if (!start || !end) return "—";
  const f = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  return `${f(start)} → ${f(end)}`;
}

export default async function Home() {
  const reports = await prisma.report.findMany({ orderBy: { uploadedAt: "desc" } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">SellerAccountance</h1>
      <p className="mt-1 text-gray-500">
        Comptabilité Amazon : chiffre d’affaires, frais et TVA à payer ou à récupérer.
      </p>

      <section className="mt-8">
        <UploadForm />
        <ExportGuide />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Rapports importés</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Aucun rapport pour le moment. Importez-en un ci-dessus.</p>
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
                      {TYPE_LABELS[r.reportType] ?? r.reportType} · {fmtPeriod(r.periodStart, r.periodEnd)} · {r.rowCount} lignes
                    </p>
                  </div>
                  <span className="text-sm text-blue-600">Voir →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
