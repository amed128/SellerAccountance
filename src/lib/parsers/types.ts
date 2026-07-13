export type ReportType = "VAT_TRANSACTIONS" | "SETTLEMENT" | "DATE_RANGE" | "TRANSACTION_VIEW";

// Normalized transaction shape — every report type maps into this
export interface NormalizedTransaction {
  date: Date | null;
  type: string; // SALE | REFUND | FEE | OTHER | FC_TRANSFER | ...
  orderId: string | null;
  sku: string | null;
  description: string | null;
  quantity: number;
  marketplace: string | null;
  arrivalCountry: string | null;
  departCountry: string | null;
  buyerVatNumber: string | null;
  amountExclVat: number;
  vatRate: number | null;
  vatAmount: number;
  amountInclVat: number;
  fees: number;
  fbaFees: number;
  otherFees: number;
  total: number;
  currency: string;
}

export interface ParsedReport {
  reportType: ReportType;
  currency: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  transactions: NormalizedTransaction[];
}

/** Parse numbers in EN ("1,234.56") and FR ("1 234,56") formats. */
export function parseAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  let s = String(raw).trim().replace(/[€$£\s  ]/g, "");
  if (!s || s === "--") return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Last separator is the decimal one
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // ISO or US-parsable
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;
  // FR format: "12 juil. 2026 18:32:00 UTC+2" or "12/07/2026"
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const frMonths: Record<string, number> = {
    "janv": 0, "févr": 1, "fevr": 1, "mars": 2, "avr": 3, "mai": 4, "juin": 5,
    "juil": 6, "août": 7, "aout": 7, "sept": 8, "oct": 9, "nov": 10, "déc": 11, "dec": 11,
  };
  const fr = s.match(/^(\d{1,2})\s+([a-zéûù]+)\.?\s+(\d{4})/i);
  if (fr) {
    const key = Object.keys(frMonths).find((m) => fr[2].toLowerCase().startsWith(m));
    if (key !== undefined) return new Date(Number(fr[3]), frMonths[key], Number(fr[1]));
  }
  return null;
}
