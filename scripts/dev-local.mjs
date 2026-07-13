// Local dev without a hosted database: boots a persistent embedded PostgreSQL
// (data kept in .devdb/, gitignored), applies migrations, starts Next on :3000.
// Once you have a real DATABASE_URL (e.g. Neon via Vercel), use `npm run dev`.
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".devdb");
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5440/selleraccountance_dev";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5440,
  persistent: true,
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("selleraccountance_dev");

execSync("npx prisma migrate deploy", {
  cwd: root,
  env: { ...process.env, DATABASE_URL },
  stdio: "inherit",
});

const next = spawn("npx", ["next", "dev", "-p", "3000"], {
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
