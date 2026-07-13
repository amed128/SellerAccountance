import { cookies } from "next/headers";

export type Locale = "fr" | "en";
export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "fr";
}

const fr = {
  nav: { home: "Accueil", help: "Aide", settings: "Paramètres" },
  home: {
    tagline: "Comptabilité Amazon : chiffre d’affaires, frais et TVA à payer ou à récupérer.",
    reports: "Rapports importés",
    noReports: "Aucun rapport pour le moment. Importez-en un ci-dessus.",
    rows: "lignes",
    view: "Voir →",
    helpHint: "Où exporter vos fichiers CSV depuis Amazon Seller Central ?",
  },
  upload: {
    dropTitle: "Déposez vos rapports Amazon ici (jusqu’à 10 fichiers)",
    dropSub: "Rapport de transactions TVA, plage de dates, règlement, ou vue Transactions (.csv / .txt)",
    generateOne: "Générer le rapport",
    generateMany: "Générer les rapports ({n} fichiers)",
    analyzing: "Analyse des rapports…",
    maxFiles: "Maximum {n} fichiers par génération — seuls les {n} premiers sont conservés.",
    networkError: "Erreur réseau — vérifiez votre connexion et réessayez.",
    unknownError: "Erreur inconnue.",
    imported: "lignes importées",
    remove: "Retirer",
  },
  reportTypes: {
    VAT_TRANSACTIONS: "Transactions TVA",
    SETTLEMENT: "Règlement",
    DATE_RANGE: "Plage de dates",
    TRANSACTION_VIEW: "Vue Transactions (Paiements)",
  } as Record<string, string>,
  dashboard: {
    back: "← Retour",
    rows: "lignes",
    sales: "ventes",
    refunds: "remboursements",
    revenue: "Chiffre d’affaires",
    grossRevenue: "CA TTC",
    netRevenue: "CA HT",
    fees: "Frais Amazon",
    netMovement: "Mouvement net",
    netMovementSub: "Solde net du rapport",
    bankTransfers: "Virements bancaires",
    bankTransfersSub: "Transferts vers votre compte (hors frais)",
    vat: "TVA",
    vatFr: "TVA collectée (France)",
    vatFrSub: "CA3, ligne ventes France",
    vatOss: "TVA due via OSS",
    vatOssSub: "Déclaration guichet unique UE",
    vatToPay: "TVA à payer",
    vatToClaim: "TVA à récupérer",
    byCountry: "Détail par pays",
    country: "Pays",
    regime: "Régime",
    taxableBase: "Base HT",
    vatCol: "TVA",
    txCount: "Transactions",
    notes: "À savoir",
    regimes: {
      DOMESTIC_FR: "TVA française",
      OSS: "OSS (guichet unique UE)",
      REVERSE_CHARGE_B2B: "B2B autoliquidation",
      EXPORT: "Export hors UE (exonéré)",
      OTHER: "Autre",
    } as Record<string, string>,
    vatNotes: {
      estimated:
        "TVA estimée au taux normal français de 20 % (le rapport ne contient pas le détail TVA). Importez le Rapport de transactions TVA Amazon pour un calcul exact.",
      b2bReverseCharge:
        "Ventes B2B intracommunautaires en autoliquidation : TVA non due, à déclarer en DEB/état récapitulatif.",
      exportExempt: "Exportations hors UE exonérées de TVA (art. 262 I du CGI).",
      amazonFeesReverseCharge:
        "Les frais Amazon (facturés depuis le Luxembourg) sont en autoliquidation : TVA à la fois collectée et déductible, impact net nul si vous êtes assujetti.",
    } as Record<string, string>,
  },
  settings: {
    title: "Paramètres",
    language: "Langue",
    languageSub: "Langue de l’interface",
    french: "Français",
    english: "English",
    save: "Enregistrer",
    saved: "Paramètres enregistrés.",
  },
  help: {
    title: "Aide",
    exportTitle: "Où exporter vos fichiers CSV depuis Amazon Seller Central ?",
    guide: [
      {
        name: "Rapport de transactions (plage de dates)",
        badge: "Recommandé — CA & frais",
        path: "Seller Central → Menu → Paiements → Référentiel des rapports",
        steps:
          "Type de rapport « Transaction », choisissez « Plage de dates personnalisée » ou « Mois », cliquez sur « Générer », puis téléchargez le CSV.",
      },
      {
        name: "Rapport de transactions TVA Amazon",
        badge: "Recommandé — TVA exacte",
        path: "Seller Central → Rapports → Bibliothèque de documents fiscaux → Rapport de transactions TVA Amazon",
        steps:
          "Sélectionnez le mois puis téléchargez le rapport (généré vers le 5 du mois suivant). C'est le seul rapport avec le détail TVA par pays.",
      },
      {
        name: "Rapport de règlement (settlement)",
        badge: "Rapprochement bancaire",
        path: "Seller Central → Menu → Paiements → onglet « Tous les relevés »",
        steps: "Sur la période voulue, cliquez sur « Télécharger le fichier plat (V2) » (.txt).",
      },
      {
        name: "Vue Transactions (Paiements)",
        badge: "Résumé simplifié",
        path: "Seller Central → Menu → Paiements → onglet « Aperçu des transactions »",
        steps:
          "Filtrez la période puis « Télécharger » (CSV). Vue simplifiée : les frais FBA y sont fusionnés avec les commissions — préférez le rapport de transactions pour le détail.",
      },
    ],
  },
};

const en: typeof fr = {
  nav: { home: "Home", help: "Help", settings: "Settings" },
  home: {
    tagline: "Amazon accounting: revenue, fees, and VAT to pay or reclaim.",
    reports: "Imported reports",
    noReports: "No reports yet. Upload one above.",
    rows: "rows",
    view: "View →",
    helpHint: "Where to export your CSV files from Amazon Seller Central?",
  },
  upload: {
    dropTitle: "Drop your Amazon reports here (up to 10 files)",
    dropSub: "VAT Transactions, Date Range, Settlement, or Transactions view report (.csv / .txt)",
    generateOne: "Generate report",
    generateMany: "Generate reports ({n} files)",
    analyzing: "Analyzing reports…",
    maxFiles: "Maximum {n} files per generation — only the first {n} were kept.",
    networkError: "Network error — check your connection and try again.",
    unknownError: "Unknown error.",
    imported: "rows imported",
    remove: "Remove",
  },
  reportTypes: {
    VAT_TRANSACTIONS: "VAT Transactions",
    SETTLEMENT: "Settlement",
    DATE_RANGE: "Date Range",
    TRANSACTION_VIEW: "Transactions view (Payments)",
  },
  dashboard: {
    back: "← Back",
    rows: "rows",
    sales: "sales",
    refunds: "refunds",
    revenue: "Revenue",
    grossRevenue: "Gross revenue (incl. VAT)",
    netRevenue: "Net revenue (excl. VAT)",
    fees: "Amazon fees",
    netMovement: "Net movement",
    netMovementSub: "Net balance of the report",
    bankTransfers: "Bank transfers",
    bankTransfersSub: "Disbursements to your account (not fees)",
    vat: "VAT",
    vatFr: "VAT collected (France)",
    vatFrSub: "CA3 return, French sales line",
    vatOss: "VAT due via OSS",
    vatOssSub: "EU One-Stop-Shop return",
    vatToPay: "VAT to pay",
    vatToClaim: "VAT to reclaim",
    byCountry: "Breakdown by country",
    country: "Country",
    regime: "Regime",
    taxableBase: "Taxable base",
    vatCol: "VAT",
    txCount: "Transactions",
    notes: "Good to know",
    regimes: {
      DOMESTIC_FR: "French VAT",
      OSS: "OSS (EU One-Stop-Shop)",
      REVERSE_CHARGE_B2B: "B2B reverse charge",
      EXPORT: "Export outside EU (exempt)",
      OTHER: "Other",
    },
    vatNotes: {
      estimated:
        "VAT estimated at the French standard rate of 20% (this report has no VAT detail). Upload the Amazon VAT Transactions Report for exact figures.",
      b2bReverseCharge:
        "Intra-EU B2B sales under reverse charge: no VAT due, to be declared in your EC sales list.",
      exportExempt: "Exports outside the EU are VAT-exempt (art. 262 I of the French tax code).",
      amazonFeesReverseCharge:
        "Amazon fees (invoiced from Luxembourg) fall under reverse charge: VAT is both collected and deductible, net-zero impact if you are VAT-registered.",
    },
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageSub: "Interface language",
    french: "Français",
    english: "English",
    save: "Save",
    saved: "Settings saved.",
  },
  help: {
    title: "Help",
    exportTitle: "Where to export your CSV files from Amazon Seller Central?",
    guide: [
      {
        name: "Transactions report (date range)",
        badge: "Recommended — revenue & fees",
        path: "Seller Central → Menu → Payments → Reports Repository",
        steps:
          "Report type “Transaction”, choose “Custom date range” or “Month”, click “Generate”, then download the CSV.",
      },
      {
        name: "Amazon VAT Transactions Report",
        badge: "Recommended — exact VAT",
        path: "Seller Central → Reports → Tax Document Library → Amazon VAT Transactions Report",
        steps:
          "Pick the month and download the report (generated around the 5th of the following month). It is the only report with per-country VAT detail.",
      },
      {
        name: "Settlement report",
        badge: "Bank reconciliation",
        path: "Seller Central → Menu → Payments → “All Statements” tab",
        steps: "On the desired period, click “Download flat file (V2)” (.txt).",
      },
      {
        name: "Transactions view (Payments)",
        badge: "Simplified summary",
        path: "Seller Central → Menu → Payments → “Transaction view” tab",
        steps:
          "Filter the period then “Download” (CSV). Simplified view: FBA fees are merged into commissions — prefer the transactions report for full detail.",
      },
    ],
  },
};

const dictionaries: Record<Locale, typeof fr> = { fr, en };

export type Dict = typeof fr;

export async function getDict(): Promise<{ locale: Locale; d: Dict }> {
  const locale = await getLocale();
  return { locale, d: dictionaries[locale] };
}
