import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const sample = (name: string) => path.join(__dirname, "../../samples", name);

// Start from a clean database: other spec files upload reports too.
test.beforeAll(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: "postgresql://postgres:postgres@localhost:5439/selleraccountance_test" },
    },
  });
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function upload(page: import("@playwright/test").Page, file: string) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(sample(file));
  await page.getByRole("button", { name: "Générer le rapport" }).click();
  await expect(page.getByText(/✓|\/reports\//).first()).toBeVisible({ timeout: 15000 });
}

test.describe("overview: multi-report aggregation", () => {
  test("same month uploaded twice is counted once", async ({ page }) => {
    await upload(page, "date-range-sample-fr.csv");
    await upload(page, "date-range-sample-fr.csv");

    await page.goto("/overview");
    // Deduplicated revenue: 62,90 €, not 125,80 €
    await expect(page.getByText(/62,90\s€/).first()).toBeVisible();
    await expect(page.getByText(/125,80/)).toHaveCount(0);
    await expect(page.getByText(/ligne\(s\) en double ignorée/)).toBeVisible();
  });

  test("successive months are combined and broken down per month", async ({ page }) => {
    await upload(page, "date-range-sample-fr-juillet.csv");

    await page.goto("/overview");
    await expect(page.getByText("3 rapport(s) combiné(s)")).toBeVisible();
    // Monthly breakdown rows
    await expect(page.getByRole("cell", { name: /juin 2026/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: /juillet 2026/ })).toBeVisible();
    // Combined CA TTC over the whole span: 62,90 + 64,90 = 127,80
    await expect(page.getByText(/127,80\s€/).first()).toBeVisible();
    // No mixed-type warning: all reports are DATE_RANGE
    await expect(page.getByText(/types différents/)).toHaveCount(0);
  });

  test("mixed report types on the same period trigger a warning", async ({ page }) => {
    // VAT sample covers June 2026, same period as the date-range sample
    await upload(page, "vat-transactions-sample.csv");
    await page.goto("/overview");
    await expect(page.getByText(/types différents/)).toBeVisible();
  });
});
