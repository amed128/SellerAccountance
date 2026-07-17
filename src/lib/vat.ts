import { NormalizedTransaction } from "./parsers/types";

export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "EL",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI",
  "ES", "SE",
]);

// Standard VAT rates by country, used only as a fallback to estimate VAT on
// reports that don't carry VAT detail (settlement / date range reports).
// Real per-country rates — verify periodically, they do change occasionally.
export const EU_STANDARD_VAT_RATES: Record<string, number> = {
  AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25,
  EE: 0.22, FI: 0.255, FR: 0.20, DE: 0.19, GR: 0.24, EL: 0.24, HU: 0.27,
  IE: 0.23, IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21,
  PL: 0.23, PT: 0.23, RO: 0.19, SK: 0.23, SI: 0.22, ES: 0.21, SE: 0.25,
};

// Selectable list for a "country of establishment" picker. GR alone covers
// Greece for this purpose — EL is kept in EU_COUNTRIES/EU_STANDARD_VAT_RATES
// only because some Amazon report formats use it as an alternate code.
export const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI",
  "ES", "SE",
];

export const DEFAULT_HOME_COUNTRY = "FR";

/** @deprecated kept for any external reference to the old constant name */
export const FR_STANDARD_RATE = EU_STANDARD_VAT_RATES.FR;

export type VatRegime = "STANDARD" | "FRANCHISE";

export interface VatByCountry {
  country: string;
  regime: "DOMESTIC" | "OSS" | "REVERSE_CHARGE_B2B" | "EXPORT" | "OTHER";
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
  vatCollectedFr: number; // TVA collectée sur le pays d'établissement du vendeur
  vatOss: number; // TVA due via guichet OSS (B2C UE hors pays d'établissement)
  vatOnRefunds: number; // TVA récupérée sur remboursements (already netted in the above)
  // Amazon fees (referral, FBA, storage — invoiced from Luxembourg) are
  // reverse-charged: the seller self-assesses VAT at their home rate on top
  // of the fee amount. Due applies regardless of VAT regime (reverse charge
  // on received B2B services is a separate obligation from charging VAT on
  // sales), but only a STANDARD-regime seller can deduct it — for FRANCHISE
  // sellers it's a real cost, since franchise en base blocks all deduction.
  feesReverseChargeVatDue: number;
  feesReverseChargeVatDeductible: number;
  vatToPay: number; // total à décaisser (domestique + OSS + autoliquidation frais − déductible)
  byCountry: VatByCountry[];
  estimated: boolean; // true when VAT was estimated (report had no VAT columns)
  notes: VatNoteKey[]; // translation keys, resolved in the UI
}

export type VatNoteKey =
  | "estimated"
  | "b2bReverseCharge"
  | "exportExempt"
  | "amazonFeesReverseCharge"
  | "franchiseExempt"
  | "franchiseFeesReverseCharge";

function classifyRegime(t: NormalizedTransaction, homeCountry: string): VatByCountry["regime"] {
  const arrival = t.arrivalCountry ?? homeCountry;
  const isEu = EU_COUNTRIES.has(arrival);
  if (!isEu) return "EXPORT";
  if (t.buyerVatNumber && arrival !== (t.departCountry ?? homeCountry)) return "REVERSE_CHARGE_B2B";
  if (arrival === homeCountry) return "DOMESTIC";
  return "OSS";
}

/**
 * EU VAT engine, relative to the seller's home country (country of
 * establishment).
 * - VAT report rows carry real VAT amounts and countries → exact split.
 * - Settlement / Date Range rows have no VAT columns → estimate at the home
 *   country's standard rate on VAT-inclusive amounts, flagged `estimated`.
 * - `vatRegime: "FRANCHISE"` (franchise en base / small-business VAT
 *   exemption): VAT never applies, regardless of report detail.
 */
export function computeVatSummary(
  transactions: NormalizedTransaction[],
  homeCountry: string = DEFAULT_HOME_COUNTRY,
  vatRegime: VatRegime = "STANDARD"
): VatSummary {
  const notes: VatNoteKey[] = [];
  let estimated = false;
  const homeRate = EU_STANDARD_VAT_RATES[homeCountry] ?? EU_STANDARD_VAT_RATES[DEFAULT_HOME_COUNTRY];

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

    // No VAT data (settlement / date range) → estimate at the home country's rate
    if (excl === 0 && incl !== 0 && vat === 0) {
      excl = incl / (1 + homeRate);
      vat = incl - excl;
      estimated = true;
    } else if (incl === 0) {
      incl = excl + vat;
    }

    grossRevenue += incl;
    netRevenue += excl;
    if (t.type === "REFUND") vatOnRefunds += Math.abs(t.vatAmount);

    const regime = classifyRegime(t, homeCountry);
    const country = t.arrivalCountry ?? homeCountry;
    // Reverse charge B2B, exports, and franchise en base: no VAT due
    const vatDue =
      vatRegime === "FRANCHISE" || regime === "REVERSE_CHARGE_B2B" || regime === "EXPORT" ? 0 : vat;
    add(country, regime, excl, vatDue);
  }

  const entries = [...byCountry.values()].sort((a, b) => b.taxableBase - a.taxableBase);
  const vatCollectedFr = entries.filter((e) => e.regime === "DOMESTIC").reduce((s, e) => s + e.vatAmount, 0);
  const vatOss = entries.filter((e) => e.regime === "OSS").reduce((s, e) => s + e.vatAmount, 0);

  // Fees are recorded HT (Amazon doesn't actually charge VAT on them, the
  // reverse charge is a purely declarative self-assessment) — no incl/excl
  // split needed, just apply the home rate directly.
  const feesReverseChargeVatDue = Math.abs(totalFees) * homeRate;
  const feesReverseChargeVatDeductible = vatRegime === "STANDARD" ? feesReverseChargeVatDue : 0;

  if (vatRegime === "FRANCHISE") {
    notes.push("franchiseExempt");
    if (feesReverseChargeVatDue !== 0) notes.push("franchiseFeesReverseCharge");
  } else {
    if (estimated) notes.push("estimated");
    if (entries.some((e) => e.regime === "REVERSE_CHARGE_B2B")) notes.push("b2bReverseCharge");
    if (entries.some((e) => e.regime === "EXPORT")) notes.push("exportExempt");
    if (feesReverseChargeVatDue !== 0) notes.push("amazonFeesReverseCharge");
  }

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
    feesReverseChargeVatDue,
    feesReverseChargeVatDeductible,
    vatToPay: vatCollectedFr + vatOss + feesReverseChargeVatDue - feesReverseChargeVatDeductible,
    byCountry: entries,
    estimated,
    notes,
  };
}
