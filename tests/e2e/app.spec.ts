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
    await expect(page.getByText(/TVA estimée au taux normal français/)).toBeVisible();
    await expect(page.getByText("Virements bancaires")).toBeVisible();
  });
});
