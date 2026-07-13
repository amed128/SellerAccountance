const GUIDES = [
  {
    name: "Rapport de plage de dates",
    badge: "Recommandé — CA & frais",
    path: "Seller Central → Rapports → Paiements → Rapports de plage de dates",
    steps: "Cliquez sur « Générer un rapport », choisissez « Transaction », sélectionnez le mois, puis téléchargez le CSV.",
  },
  {
    name: "Rapport de transactions TVA Amazon",
    badge: "Recommandé — TVA exacte",
    path: "Seller Central → Rapports → Bibliothèque de documents fiscaux → Rapport de transactions TVA Amazon",
    steps: "Sélectionnez le mois puis téléchargez le rapport (généré vers le 5 du mois suivant). C'est le seul rapport avec le détail TVA par pays.",
  },
  {
    name: "Rapport de règlement (settlement)",
    badge: "Rapprochement bancaire",
    path: "Seller Central → Rapports → Paiements → Tous les relevés",
    steps: "Sur la période voulue, cliquez sur « Télécharger le fichier plat (V2) » (.txt).",
  },
  {
    name: "Vue Transactions (Paiements)",
    badge: "Résumé simplifié",
    path: "Seller Central → Paiements → Transactions",
    steps: "Filtrez la période puis « Télécharger » (CSV). Vue simplifiée : les frais FBA y sont fusionnés avec les commissions — préférez le rapport de plage de dates pour le détail.",
  },
];

export default function ExportGuide() {
  return (
    <details className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <summary className="cursor-pointer font-medium text-blue-600">
        Où exporter vos fichiers CSV depuis Amazon Seller Central ?
      </summary>
      <ul className="mt-3 space-y-3">
        {GUIDES.map((g) => (
          <li key={g.name} className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
            <p className="font-medium">
              {g.name}{" "}
              <span className="ml-1 rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                {g.badge}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{g.path}</p>
            <p className="mt-0.5 text-sm text-gray-500">{g.steps}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
