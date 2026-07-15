# SellerAccountance

Comptabilité pour vendeurs Amazon : importez vos rapports Seller Central, obtenez votre chiffre d'affaires, vos frais Amazon et votre TVA à payer ou à récupérer (France + OSS).

## Fonctionnalités

- **Import de 4 formats de rapports Amazon** avec détection automatique :
  - Rapport de transactions TVA Amazon (calcul TVA exact par pays)
  - Rapport de plage de dates (FR/EN)
  - Rapport de règlement (settlement, fichier plat V2)
  - Export de la vue Transactions (Paiements)
- **Tableau de bord** : CA TTC/HT, frais Amazon, virements bancaires, mouvement net
- **Moteur TVA France** : TVA française, OSS (B2C UE), autoliquidation B2B, exports exonérés — avec détail par pays
- Guide intégré : où exporter chaque rapport dans Seller Central
- **Comptes utilisateurs** : chaque rapport est scopé à son propriétaire (e-mail + mot de passe, session en base)

## Stack

Next.js (App Router, TypeScript, Tailwind) · Prisma · PostgreSQL

## Développement local

```bash
npm install
cp .env.example .env   # renseignez DATABASE_URL (Postgres, ex. Neon gratuit)
npx prisma migrate deploy
npm run dev
```

Toute l'app est derrière un compte : ouvrez `/signup` pour en créer un avant d'importer des rapports.

Des rapports d'exemple sont fournis dans `samples/`.

## Tests

```bash
npm test         # tests unitaires (parseurs + moteur TVA)
npm run test:ui  # tests UI Playwright (démarre un PostgreSQL embarqué + l'app)
```

Les tests UI utilisent le Chrome installé sur la machine (`channel: "chrome"`) et une base PostgreSQL embarquée jetable — aucune configuration requise.

## Déploiement sur Vercel

1. Importez ce repo sur [vercel.com/new](https://vercel.com/new).
2. Dans le projet Vercel : **Storage → Create Database → Neon (Postgres)** — cela ajoute `DATABASE_URL` automatiquement.
3. Déployez. Le build exécute `prisma migrate deploy` puis `next build`.

Pour utiliser la même base en local : `npx vercel env pull .env`.

## Prochaines étapes (backlog)

- **Suggestions / alertes automatiques** : ajouter des vérifications (basées sur des règles, pas un agent LLM — fiabilité et auditabilité priment sur du conseil fiscal) sur les données importées : n° TVA incohérent, seuil OSS proche, mois manquant, ratio de frais anormal, etc.
- **Auth — durcissement** : l'authentification actuelle (e-mail + mot de passe, session en base) n'a pas de vérification d'e-mail ni de réinitialisation de mot de passe ; à ajouter avant un vrai lancement public.
