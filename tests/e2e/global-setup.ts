import { chromium, type FullConfig } from "@playwright/test";

// Signs up one shared test user and saves its session cookie so individual
// specs don't each need to sign up/log in — the app requires auth on every
// page now, and tests run sequentially against one shared database.
export default async function globalSetup(config: FullConfig) {
  const projectUse = config.projects[0].use;
  const baseURL = (projectUse.baseURL as string) ?? "http://localhost:3100";
  const browser = await chromium.launch({
    channel: projectUse.channel,
    ...projectUse.launchOptions,
  });
  const page = await browser.newPage();

  await page.goto(`${baseURL}/signup`);
  await page.fill("#name", "E2E Test");
  await page.fill("#email", "e2e@example.com");
  await page.fill("#password", "e2e-test-password");
  await Promise.all([page.waitForURL(`${baseURL}/`), page.click('button[type="submit"]')]);

  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
  await browser.close();
}
