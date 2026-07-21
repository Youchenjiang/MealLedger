import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const sql = readFileSync("supabase/tests/rls.integration.sql", "utf8");
const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_MealLedger", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] },
);

process.exit(result.status ?? 1);
