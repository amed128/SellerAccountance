// Playwright webServer command: boots an embedded PostgreSQL, applies
// migrations, then starts Next.js on :3100. Killing this process (Playwright
// does it after the run) tears everything down; the data dir is wiped on boot.
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const dataDir = path.join(__dirname, ".pgdata");

const DATABASE_URL = "postgresql://postgres:postgres@localhost:5439/selleraccountance_test";

rmSync(dataDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5439,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase("selleraccountance_test");

execSync("npx prisma migrate deploy", {
  cwd: root,
  env: { ...process.env, DATABASE_URL },
  stdio: "inherit",
});

const next = spawn("npx", ["next", "dev", "-p", "3100"], {
  cwd: root,
  env: { ...process.env, DATABASE_URL },
  stdio: "inherit",
});

async function shutdown() {
  next.kill("SIGTERM");
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
next.on("exit", (code) => {
  pg.stop().finally(() => process.exit(code ?? 0));
});
