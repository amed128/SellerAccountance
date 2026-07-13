import Papa from "papaparse";
import {
  NormalizedTransaction,
  ParsedReport,
  ReportType,
  parseAmount,
  parseDate,
} from "./types";

export type { NormalizedTransaction, ParsedReport, ReportType };

/**
 * Amazon reports come as CSV (comma or semicolon) or flat-file (tab).
 * Date Range reports also have a one-line preamble before the header row.
 */
export function parseReportFile(fileName: string, content: string): ParsedReport {
  const text = content.replace(/^﻿/, ""); // strip BOM
  const { headerLine, dataStart } = findHeaderLine(text);
  const delimiter = sniffDelimiter(headerLine);
  const parsed = Papa.parse<Record<string, string>>(
    text.split("\n").slice(dataStart).join("\n"),
    { header: true, delimiter, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() }
  );
  const rows = parsed.data;
  if (!rows.length) throw new Error("Le fichier ne contient aucune ligne de données.");

  const headers = Object.keys(rows[0]);
  const type = detectReportType(headers);
  if (!type) {
    throw new Error(
      `Format de rapport non reconnu (colonnes: ${headers.slice(0, 8).join(", ")}…). ` +
        "Formats supportés : Rapport de transactions TVA Amazon, Rapport de règlement (settlement), Rapport de plage de dates, export de la vue Transactions (Paiements). Consultez le guide d'export sur la page d'accueil."
    );
  }

  const transactions =
    type === "VAT_TRANSACTIONS"
      ? rows.map(parseVatRow)
      : type === "SETTLEMENT"
        ? parseSettlementRows(rows)
        : type === "TRANSACTION_VIEW"
          ? rows.map(parseTransactionViewRow)
          : rows.map(parseDateRangeRow);

  const kept = transactions.filter((t) => t !== null) as NormalizedTransaction[];
  const dates = kept.map((t) => t.date?.getTime()).filter((d): d is number => d != null);
  return {
    reportType: type,
    currency: kept.find((t) => t.currency)?.currency ?? "EUR",
    periodStart: dates.length ? new Date(Math.min(...dates)) : null,
    periodEnd: dates.length ? new Date(Math.max(...dates)) : null,
    transactions: kept,
  };
}

function findHeaderLine(text: string): { headerLine: string; dataStart: number } {
  const lines = text.split("\n");
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].toLowerCase();
    if (
      l.includes("transaction_type") ||
      l.includes("settlement-id") ||
      l.includes("amount-type") ||
      (l.includes("date") && (l.includes("type") || l.includes("total")))
    ) {
      return { headerLine: lines[i], dataStart: i };
    }
  }
  return { headerLine: lines[0] ?? "", dataStart: 0 };
}

function sniffDelimiter(headerLine: string): string {
  const counts: Array<[string, number]> = [
    ["\t", (headerLine.match(/\t/g) ?? []).length],
    [",", (headerLine.match(/,/g) ?? []).length],
    [";", (headerLine.match(/;/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function detectReportType(headers: string[]): ReportType | null {
  const h = new Set(headers.map((x) => x.toLowerCase().trim()));
  if (h.has("transaction_type") && (h.has("sale_depart_country") || h.has("sale_arrival_country")))
    return "VAT_TRANSACTIONS";
  if (h.has("amount-type") || h.has("amount-description") || h.has("settlement-id"))
    return "SETTLEMENT";
  const dateRangeMarkers = [
    "product sales", "ventes de produits",
    "selling fees", "frais de vente",
    "fba fees", "frais expédié par amazon",
  ];
  if (dateRangeMarkers.some((m) => h.has(m))) return "DATE_RANGE";
  if (
    (h.has("type de transaction") && h.has("commissions amazon")) ||
    (h.has("transaction type") && h.has("amazon fees"))
  )
    return "TRANSACTION_VIEW";
  return null;
}

// ---------- VAT Transactions Report ----------
// Columns: TRANSACTION_TYPE, TRANSACTION_COMPLETE_DATE, SELLER_SKU, QTY,
// TOTAL_ACTIVITY_VALUE_AMT_VAT_EXCL, TOTAL_ACTIVITY_VALUE_VAT_AMT,
// TOTAL_ACTIVITY_VALUE_AMT_VAT_INCL, PRICE_OF_ITEMS_VAT_RATE_PERCENT,
// SALE_DEPART_COUNTRY, SALE_ARRIVAL_COUNTRY, BUYER_VAT_NUMBER, ...
function parseVatRow(r: Record<string, string>): NormalizedTransaction | null {
  const type = (r["transaction_type"] ?? "").toUpperCase();
  if (!type) return null;
  const excl = parseAmount(r["total_activity_value_amt_vat_excl"]);
  const vat = parseAmount(r["total_activity_value_vat_amt"]);
  const incl = parseAmount(r["total_activity_value_amt_vat_incl"]) || excl + vat;
  const ratePct = parseAmount(r["price_of_items_vat_rate_percent"]);
  return {
    date:
      parseDate(r["transaction_complete_date"]) ??
      parseDate(r["transaction_depart_date"]) ??
      parseDate(r["tax_calculation_date"]),
    type, // SALE | REFUND | FC_TRANSFER | INBOUND ...
    orderId: r["transaction_event_id"] || null,
    sku: r["seller_sku"] || null,
    description: r["item_description"] || null,
    quantity: Math.round(parseAmount(r["qty"])),
    marketplace: r["marketplace"] || r["sales_channel"] || null,
    arrivalCountry: (r["sale_arrival_country"] || r["arrival_country"] || "").toUpperCase() || null,
    departCountry: (r["sale_depart_country"] || r["departure_country"] || "").toUpperCase() || null,
    buyerVatNumber: r["buyer_vat_number"]?.trim() || null,
    amountExclVat: excl,
    vatRate: ratePct ? ratePct / 100 : null,
    vatAmount: vat,
    amountInclVat: incl,
    fees: 0,
    fbaFees: 0,
    otherFees: 0,
    total: incl,
    currency: (r["transaction_currency_code"] || "EUR").toUpperCase(),
  };
}

// ---------- Settlement Report (flat file V2) ----------
// Long format: one row per amount line (ItemPrice / ItemFees / ...).
// We aggregate rows per (order-id, transaction-type, posted-date) into one transaction.
function parseSettlementRows(rows: Record<string, string>[]): NormalizedTransaction[] {
  const groups = new Map<string, NormalizedTransaction>();
  for (const r of rows) {
    const txType = (r["transaction-type"] ?? "").trim();
    if (!txType) continue; // summary/header rows
    const orderId = r["order-id"] || r["adjustment-id"] || "";
    const key = `${txType}|${orderId}|${r["posted-date"] ?? ""}|${r["sku"] ?? ""}`;
    let t = groups.get(key);
    if (!t) {
      t = {
        date: parseDate(r["posted-date"] || r["posted-date-time"]),
        type: mapSettlementType(txType),
        orderId: orderId || null,
        sku: r["sku"] || null,
        description: null,
        quantity: 0,
        marketplace: r["marketplace-name"] || null,
        arrivalCountry: null,
        departCountry: null,
        buyerVatNumber: null,
        amountExclVat: 0,
        vatRate: null,
        vatAmount: 0,
        amountInclVat: 0,
        fees: 0,
        fbaFees: 0,
        otherFees: 0,
        total: 0,
        currency: (r["currency"] || "EUR").toUpperCase(),
      };
      groups.set(key, t);
    }
    const amount = parseAmount(r["amount"]);
    const amountType = (r["amount-type"] ?? "").toLowerCase();
    const desc = (r["amount-description"] ?? "").toLowerCase();
    t.quantity += Math.round(parseAmount(r["quantity-purchased"]));
    t.total += amount;
    if (amountType.includes("itemprice") || amountType.includes("item-price") || amountType === "itemprice") {
      t.amountInclVat += amount; // settlement amounts are VAT-inclusive
    } else if (desc.includes("fba") || desc.includes("fulfil")) {
      t.fbaFees += amount; // must beat the ItemFees check: FBA fees are also amount-type ItemFees
    } else if (desc.includes("commission") || amountType.includes("itemfees") || amountType.includes("item-fees")) {
      t.fees += amount;
    } else {
      t.otherFees += amount;
    }
  }
  return [...groups.values()];
}

function mapSettlementType(t: string): string {
  const s = t.toLowerCase();
  if (s === "order") return "SALE";
  if (s === "refund") return "REFUND";
  if (s.includes("service") || s.includes("other")) return "FEE";
  return t.toUpperCase();
}

// ---------- Date Range Transaction Report (EN + FR headers) ----------
function pick(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
  return "";
}

function parseDateRangeRow(r: Record<string, string>): NormalizedTransaction | null {
  const rawType = pick(r, "type").trim();
  if (!rawType) return null;
  const productSales = parseAmount(pick(r, "product sales", "ventes de produits"));
  const shippingCredits = parseAmount(pick(r, "shipping credits", "crédits d'expédition"));
  const giftWrap = parseAmount(pick(r, "gift wrap credits", "crédits d'emballage cadeau"));
  const promo = parseAmount(pick(r, "promotional rebates", "rabais promotionnels"));
  const sellingFees = parseAmount(pick(r, "selling fees", "frais de vente"));
  const fbaFees = parseAmount(pick(r, "fba fees", "frais expédié par amazon"));
  const otherTxFees = parseAmount(
    pick(r, "other transaction fees", "autres frais de transaction", "frais d'autres transactions")
  );
  const other = parseAmount(pick(r, "other", "autre"));
  const total = parseAmount(pick(r, "total"));
  const taxes =
    parseAmount(pick(r, "product sales tax", "taxes sur la vente des produits")) +
    parseAmount(pick(r, "shipping credits tax", "taxes sur les crédits d'expédition"));

  const gross = productSales + shippingCredits + giftWrap + promo;
  const type = mapDateRangeType(rawType);
  // Bank payouts (Transfert) land in the "other" column but are not fees
  const isTransfer = type === "TRANSFER";
  return {
    date: parseDate(pick(r, "date/time", "date/heure", "date")),
    type,
    orderId: pick(r, "order id", "numéro de la commande", "numéro de commande") || null,
    sku: pick(r, "sku") || null,
    description: pick(r, "description") || null,
    quantity: Math.round(parseAmount(pick(r, "quantity", "quantité"))),
    marketplace: pick(r, "marketplace") || null,
    arrivalCountry: null,
    departCountry: null,
    buyerVatNumber: null,
    amountExclVat: 0, // date range report is VAT-inclusive; VAT engine estimates
    vatRate: null,
    vatAmount: taxes,
    amountInclVat: gross,
    fees: sellingFees,
    fbaFees,
    otherFees: isTransfer ? 0 : otherTxFees + other,
    total,
    currency: "EUR",
  };
}

function mapDateRangeType(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("commande") || s === "order") return "SALE";
  if (s.includes("rembours") || s === "refund") return "REFUND";
  if (s.includes("transfert") || s.includes("transfer") || s.includes("virement")) return "TRANSFER";
  if (s.includes("frais") || s.includes("fee")) return "FEE"; // frais de service, frais de stock FBA…
  if (s.includes("ajustement") || s.includes("adjustment")) return "ADJUSTMENT";
  return t.toUpperCase();
}

// ---------- Payments dashboard "Transactions" view export (FR + EN) ----------
// Simplified per-order statement: Date, Statut, Type de transaction, Numéro de
// la commande, Détails sur le produit, Total des frais produit, Total des
// rabais promotionnels, Commissions Amazon, Autres, Total (EUR).
function parseTransactionViewRow(r: Record<string, string>): NormalizedTransaction | null {
  const rawType = pick(r, "type de transaction", "transaction type").trim();
  if (!rawType) return null;
  const productCharges = parseAmount(pick(r, "total des frais produit", "total product charges"));
  const promo = parseAmount(pick(r, "total des rabais promotionnels", "total promotional rebates"));
  const commissions = parseAmount(pick(r, "commissions amazon", "amazon fees"));
  const other = parseAmount(pick(r, "autres", "other"));
  const total = parseAmount(pick(r, "total (eur)", "total"));
  const type = mapTransactionViewType(rawType);
  return {
    date: parseDate(pick(r, "date")),
    type,
    orderId: pick(r, "numéro de la commande", "order number") || null,
    sku: null,
    description: pick(r, "détails sur le produit", "product details") || null,
    quantity: 0, // not provided by this export
    marketplace: null,
    arrivalCountry: null,
    departCountry: null,
    buyerVatNumber: null,
    amountExclVat: 0, // VAT-inclusive, no VAT detail; engine estimates
    vatRate: null,
    vatAmount: 0,
    amountInclVat: productCharges + promo,
    fees: commissions,
    fbaFees: 0, // lumped into "Commissions Amazon" in this export
    otherFees: type === "TRANSFER" ? 0 : other,
    total,
    currency: "EUR",
  };
}

function mapTransactionViewType(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("paiement de la commande") || s.includes("order payment")) return "SALE";
  if (s.includes("rembours") || s.includes("refund")) return "REFUND";
  if (s.includes("virement") || s.includes("transfert") || s.includes("disbursement") || s.includes("transfer"))
    return "TRANSFER";
  if (s.includes("frais") || s.includes("fee")) return "FEE";
  return t.toUpperCase();
}
