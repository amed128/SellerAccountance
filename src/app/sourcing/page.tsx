import { getDict } from "@/lib/i18n";
import { requireOnboardedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { addSourcingInvoice, deleteSourcingInvoice } from "./actions";
import { CURRENCIES } from "./constants";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm";

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [user, { locale, d }, { saved, error }] = await Promise.all([
    requireOnboardedUser(),
    getDict(),
    searchParams,
  ]);
  const t = d.sourcing;

  const invoices = await prisma.sourcingInvoice.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  const treatmentLabel = (v: string) =>
    v === "REVERSE_CHARGE" ? t.vatTreatmentReverseCharge : v === "IMPORT" ? t.vatTreatmentImport : t.vatTreatmentDomestic;
  const fmtDate = (dt: Date) =>
    dt.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 w-full">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="mt-1 text-gray-500">{t.subtitle}</p>

      {saved && (
        <p className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          {t.saved}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {t.error}
        </p>
      )}

      <form action={addSourcingInvoice} className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold">{t.addTitle}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="supplier">{t.supplier}</label>
            <input id="supplier" name="supplier" type="text" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="date">{t.date}</label>
            <input id="date" name="date" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="sku">{t.sku}</label>
            <input id="sku" name="sku" type="text" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="quantity">{t.quantity}</label>
            <input id="quantity" name="quantity" type="number" min={1} step={1} defaultValue={1} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="amountExclVat">{t.amountExclVat}</label>
            <input id="amountExclVat" name="amountExclVat" type="number" min={0} step="0.01" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="vatAmount">{t.vatAmount}</label>
            <input id="vatAmount" name="vatAmount" type="number" min={0} step="0.01" defaultValue={0} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="amountInclVat">{t.amountInclVat}</label>
            <input id="amountInclVat" name="amountInclVat" type="number" min={0} step="0.01" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="currency">{t.currency}</label>
            <select id="currency" name="currency" defaultValue="EUR" className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium">{t.vatTreatment}</p>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2">
              <input type="radio" name="vatTreatment" value="DOMESTIC" defaultChecked className="mt-1" />
              <span>{t.vatTreatmentDomestic}</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="vatTreatment" value="REVERSE_CHARGE" className="mt-1" />
              <span>{t.vatTreatmentReverseCharge}</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="vatTreatment" value="IMPORT" className="mt-1" />
              <span>
                <span className="block">{t.vatTreatmentImport}</span>
                <span className="block text-sm text-gray-500">{t.vatTreatmentImportHint}</span>
              </span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t.add}
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold">{t.listTitle}</h2>
      {invoices.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{t.empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t.date}</th>
                <th className="px-4 py-2 font-medium">{t.supplier}</th>
                <th className="px-4 py-2 font-medium">{t.sku}</th>
                <th className="px-4 py-2 font-medium text-right">{t.quantity}</th>
                <th className="px-4 py-2 font-medium text-right">{t.amountExclVat}</th>
                <th className="px-4 py-2 font-medium text-right">{t.vatAmount}</th>
                <th className="px-4 py-2 font-medium text-right">{t.amountInclVat}</th>
                <th className="px-4 py-2 font-medium">{t.vatTreatment}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(inv.date)}</td>
                  <td className="px-4 py-2">{inv.supplier}</td>
                  <td className="px-4 py-2">{inv.sku}</td>
                  <td className="px-4 py-2 text-right">{inv.quantity}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(inv.amountExclVat, locale, inv.currency)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(inv.vatAmount, locale, inv.currency)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(inv.amountInclVat, locale, inv.currency)}</td>
                  <td className="px-4 py-2">{treatmentLabel(inv.vatTreatment)}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteSourcingInvoice}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`${t.delete} ${inv.supplier}`}
                      >
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
