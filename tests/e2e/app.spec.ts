import { test, expect } from "@playwright/test";
import path from "node:path";

const sample = (name: string) => path.join(__dirname, "../../samples", name);

test.describe("navigation and static pages", () => {
  test("home renders with upload zone and nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "SellerAccountance" })).toBeVisible();
    await expect(page.getByText("Déposez vos rapports Amazon ici")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer le rapport" })).toBeDisabled();
  });

  test("help page shows the Seller Central export guide", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Aide" }).click();
    await expect(
      page.getByText("Où exporter vos fichiers CSV depuis Amazon Seller Central ?")
    ).toBeVisible();
    await expect(page.getByText("Référentiel des rapports")).toBeVisible();
  });
});

test.describe("onboarding wizard", () => {
  // Fresh, unauthenticated context — the shared e2e user is already onboarded.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("new user is gated to the wizard, then unlocked after completing it", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", "Onboarding Test");
    await page.fill("#email", `onboarding-${Date.now()}@example.com`);
    await page.fill("#password", "onboarding-test-password");
    await Promise.all([page.waitForURL(/\/onboarding$/), page.click('button[type="submit"]')]);

    // Direct navigation to another gated page also bounces back to the wizard.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.selectOption('select[name="homeCountry"]', "DE");
    await page.getByLabel("Franchise en base de TVA").check();
    await Promise.all([
      page.waitForURL(/localhost:3100\/$/),
      page.getByRole("button", { name: "Commencer" }).click(),
    ]);

    // Revisiting /onboarding once completed redirects home, not back to the wizard.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/localhost:3100\/$/);

    // The choice made in the wizard is reflected in settings.
    await page.goto("/settings");
    await expect(page.locator('select[name="homeCountry"]')).toHaveValue("DE");
    await expect(page.getByLabel("Franchise en base de TVA")).toBeChecked();
  });
});

test.describe("mobile navigation menu", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("links are hidden behind a burger button and open on click", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Ouvrir le menu" });
    await expect(menuButton).toBeVisible();
    await expect(page.getByRole("link", { name: "Vue d’ensemble" })).toBeHidden();

    await menuButton.click();
    await expect(page.getByRole("link", { name: "Vue d’ensemble" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fermer le menu" })).toBeVisible();
  });

  test("closes automatically after following a link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("link", { name: "Aide" }).click();

    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole("link", { name: "Vue d’ensemble" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeVisible();
  });
});

test.describe("desktop navigation", () => {
  test("links are always visible, no burger button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Vue d’ensemble" })).toBeVisible();
  });
});

test.describe("settings", () => {
  test("language switch to English translates the UI", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("English").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Help" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Drop your Amazon reports here")).toBeVisible();
  });

  test("theme switch to dark sets data-theme on <html>", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    await page.getByLabel("Sombre").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("home country and VAT regime persist after saving", async ({ page }) => {
    await page.goto("/settings");
    await page.selectOption('select[name="homeCountry"]', "DE");
    await page.getByLabel("Franchise en base de TVA").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

    await page.reload();
    await expect(page.locator('select[name="homeCountry"]')).toHaveValue("DE");
    await expect(page.getByLabel("Franchise en base de TVA")).toBeChecked();

    // restore to FR/STANDARD so later specs (VAT figure assertions) aren't affected
    await page.selectOption('select[name="homeCountry"]', "FR");
    await page.getByLabel("Assujetti à la TVA").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  });
});

test.describe("report upload", () => {
  test("rejects an unrecognized CSV with a per-file error", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("a,b,c\n1,2,3"),
    });
    await page.getByRole("button", { name: "Générer le rapport" }).click();
    await expect(page.getByText(/✗ bad\.csv/)).toBeVisible();
    await expect(page.getByText(/non reconnu/)).toBeVisible();
  });

  test("uploads the VAT sample and shows exact figures on the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(sample("vat-transactions-sample.csv"));
    await expect(page.getByText("vat-transactions-sample.csv")).toBeVisible();
    await page.getByRole("button", { name: "Générer le rapport" }).click();

    await page.waitForURL(/\/reports\//);
    await expect(page.getByText("CA TTC")).toBeVisible();
    // fr-FR renders a narrow no-break space before € — match with \s
    // appears twice: CA TTC and Mouvement net are equal in this fee-less sample
    await expect(page.getByText(/240,00\s€/).first()).toBeVisible(); // CA TTC
    await expect(page.getByText(/205,00\s€/)).toBeVisible(); // CA HT
    await expect(page.getByText(/^20,00\s€$/)).toBeVisible(); // TVA à payer
    await expect(page.getByText("TVA à payer")).toBeVisible();
    // Country breakdown includes OSS split
    await expect(page.getByRole("cell", { name: "DE" })).toBeVisible();
    await expect(page.getByText("OSS (guichet unique UE)").first()).toBeVisible();
  });

  test("uploads two files at once and lists both reports", async ({ page }) => {
    await page.goto("/");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles([sample("date-range-sample-fr.csv"), sample("settlement-sample.txt")]);
    await expect(page.getByRole("button", { name: /Générer les rapports \(2 fichiers\)/ })).toBeEnabled();
    await page.getByRole("button", { name: /Générer les rapports/ }).click();

    await expect(page.getByText(/✓ date-range-sample-fr\.csv/)).toBeVisible();
    await expect(page.getByText(/✓ settlement-sample\.txt/)).toBeVisible();
    // Both appear in the reports list
    await expect(
      page.locator("li", { hasText: "Plage de dates" }).first()
    ).toBeVisible();
    await expect(page.locator("li", { hasText: "Règlement" }).first()).toBeVisible();
  });

  test("estimated VAT warning appears for reports without VAT detail", async ({ page }) => {
    await page.goto("/");
    const row = page.locator("li", { hasText: "date-range-sample-fr.csv" }).first();
    await row.getByRole("link").click();
    await expect(page.getByText(/TVA estimée au taux normal de votre pays d’établissement/)).toBeVisible();
    await expect(page.getByText("Virements bancaires")).toBeVisible();
    // Fees reverse charge: this report has fee data, so the card must render.
    await expect(page.getByText("TVA sur frais Amazon (autoliquidation)")).toBeVisible();
    await expect(page.getByText("Due et déductible — impact net nul")).toBeVisible();
  });
});

test.describe("sourcing invoices", () => {
  test("add an invoice, see it listed, then delete it", async ({ page }) => {
    await page.goto("/sourcing");
    await page.fill("#supplier", "Shenzhen Gadgets Co.");
    await page.fill("#date", "2026-06-01");
    await page.fill("#sku", "SKU-RED-01");
    await page.fill("#quantity", "100");
    await page.fill("#amountExclVat", "500");
    await page.fill("#vatAmount", "0");
    await page.fill("#amountInclVat", "500");
    await page.selectOption("select[name='currency']", "USD");
    await page.getByLabel("Autoliquidation intracommunautaire (fournisseur UE)").click();
    await Promise.all([
      page.waitForURL(/\/sourcing\?saved=1$/),
      page.getByRole("button", { name: "Ajouter" }).click(),
    ]);
    await expect(page.getByText("Facture ajoutée.")).toBeVisible();

    const row = page.locator("tr", { hasText: "Shenzhen Gadgets Co." });
    await expect(row).toBeVisible();
    await expect(row.getByText("SKU-RED-01")).toBeVisible();
    await expect(row.getByText("Autoliquidation intracommunautaire (fournisseur UE)")).toBeVisible();

    await row.getByRole("button", { name: /Supprimer/ }).click();
    await expect(page.locator("tr", { hasText: "Shenzhen Gadgets Co." })).toHaveCount(0);
  });

  test("rejects a zero HT amount (server-side check, not caught by the HTML min attribute)", async ({ page }) => {
    await page.goto("/sourcing");
    await page.fill("#supplier", "Zero Amount Supplier");
    await page.fill("#date", "2026-06-01");
    await page.fill("#sku", "SKU-ZERO");
    await page.fill("#amountExclVat", "0");
    await page.fill("#amountInclVat", "0");
    await Promise.all([
      page.waitForURL(/\/sourcing\?error=invalid$/),
      page.getByRole("button", { name: "Ajouter" }).click(),
    ]);
    await expect(page.getByText("Vérifiez les champs du formulaire")).toBeVisible();
    await expect(page.locator("tr", { hasText: "Zero Amount Supplier" })).toHaveCount(0);
  });
});
