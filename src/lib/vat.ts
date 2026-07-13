import { NormalizedTransaction } from "./parsers/types";

export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "EL",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI",
  "ES", "SE",
]);

export const FR_STANDARD_RATE = 0.2;

export interface VatByCountry {
  country: string;
  regime: "DOMESTIC_FR" | "OSS" | "REVERSE_CHARGE_B2B" | "EXPORT" | "OTHER";
  taxableBase: number; // HT
  vatAmount: number;
  transactionCount: number;
}

export interface VatSummary {
  currency: string;
  // Revenue
  grossRevenue: number; // TTC, sales - refunds
  netRevenue: number; // HT
  totalFees: number; // Amazon fees (negative)
  bankTransfers: number; // virements vers le compte bancaire (negative in reports)
  netPayout: number; // net movement of the report
  // VAT
  vatCollectedFr: number; // TVA collectée (ventes FR)
  vatOss: number; // TVA due via guichet OSS (B2C UE hors FR)
  vatOnRefunds: number; // TVA récupérée sur remboursements (already netted in the above)
  vatToPay: number; // total à décaisser (FR + OSS)
  byCountry: VatByCountry[];
  estimated: boolean; // true when VAT was estimated (report had no VAT columns)
  notes: string[];
}

function classifyRegime(t: NormalizedTransaction): VatByCountry["regime"] {
  const arrival = t.arrivalCountry ?? "FR";
  const isEu = EU_COUNTRIES.has(arrival);
  if (!isEu) return "EXPORT";
  if (t.buyerVatNumber && arrival !== (t.departCountry ?? "FR")) return "REVERSE_CHARGE_B2B";
  if (arrival === "FR") return "DOMESTIC_FR";
  return "OSS";
}

/**
 * France-first VAT engine.
 * - VAT report rows carry real VAT amounts and countries → exact split.
 * - Settlement / Date Range rows have no VAT columns → estimate at the French
 *   standard rate (20%) on VAT-inclusive amounts, flagged `estimated`.
 */
export function computeVatSummary(transactions: NormalizedTransaction[]): VatSummary {
  const notes: string[] = [];
  let estimated = false;

  let grossRevenue = 0;
  let netRevenue = 0;
  let totalFees = 0;
  let bankTransfers = 0;
  let netPayout = 0;
  let vatOnRefunds = 0;

  const byCountry = new Map<string, VatByCountry>();
  const add = (country: string, regime: VatByCountry["regime"], base: number, vat: number) => {
    const key = `${country}|${regime}`;
    const e = byCountry.get(key) ?? { country, regime, taxableBase: 0, vatAmount: 0, transactionCount: 0 };
    e.taxableBase += base;
    e.vatAmount += vat;
    e.transactionCount += 1;
    byCountry.set(key, e);
  };

  for (const t of transactions) {
    const sign = t.type === "REFUND" ? -1 : 1;
    const isRevenueRow = t.type === "SALE" || t.type === "REFUND";

    totalFees += t.fees + t.fbaFees + t.otherFees;
    netPayout += t.total;
    if (t.type === "TRANSFER") bankTransfers += t.total;

    if (!isRevenueRow) continue;

    let incl = Math.abs(t.amountInclVat) * sign;
    let excl = Math.abs(t.amountExclVat) * sign;
    let vat = Math.abs(t.vatAmount) * sign;

    // No VAT data (settlement / date range) → estimate at 20% included
    if (excl === 0 && incl !== 0 && vat === 0) {
      excl = incl / (1 + FR_STANDARD_RATE);
      vat = incl - excl;
      estimated = true;
    } else if (incl === 0) {
      incl = excl + vat;
    }

    grossRevenue += incl;
    netRevenue += excl;
    if (t.type === "REFUND") vatOnRefunds += Math.abs(t.vatAmount);

    const regime = classifyRegime(t);
    const country = t.arrivalCountry ?? "FR";
    // Reverse charge B2B and exports: no VAT due
    add(country, regime, excl, regime === "REVERSE_CHARGE_B2B" || regime === "EXPORT" ? 0 : vat);
  }

  const entries = [...byCountry.values()].sort((a, b) => b.taxableBase - a.taxableBase);
  const vatCollectedFr = entries
    .filter((e) => e.regime === "DOMESTIC_FR")
    .reduce((s, e) => s + e.vatAmount, 0);
  const vatOss = entries.filter((e) => e.regime === "OSS").reduce((s, e) => s + e.vatAmount, 0);

  if (estimated) {
    notes.push(
      "TVA estimée au taux normal français de 20 % (le rapport ne contient pas le détail TVA). " +
        "Importez le Rapport de transactions TVA Amazon pour un calcul exact."
    );
  }
  if (entries.some((e) => e.regime === "REVERSE_CHARGE_B2B")) {
    notes.push("Ventes B2B intracommunautaires en autoliquidation : TVA non due, à déclarer en DEB/état récapitulatif.");
  }
  if (entries.some((e) => e.regime === "EXPORT")) {
    notes.push("Exportations hors UE exonérées de TVA (art. 262 I du CGI).");
  }
  notes.push(
    "Les frais Amazon (facturés depuis le Luxembourg) sont en autoliquidation : TVA à la fois collectée et déductible, impact net nul si vous êtes assujetti."
  );

  return {
    currency: transactions[0]?.currency ?? "EUR",
    grossRevenue,
    netRevenue,
    totalFees,
    bankTransfers,
    netPayout,
    vatCollectedFr,
    vatOss,
    vatOnRefunds,
    vatToPay: vatCollectedFr + vatOss,
    byCountry: entries,
    estimated,
    notes,
  };
}
