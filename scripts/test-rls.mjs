import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dockerCandidates = process.platform === "win32"
  ? ["C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"]
  : ["/usr/bin/docker", "/usr/local/bin/docker"];
const dockerExecutable = dockerCandidates.find(existsSync);
if (!dockerExecutable) {
  process.stderr.write("Docker executable was not found in a trusted installation directory.\n");
  process.exit(1);
}

const sql = readFileSync("supabase/tests/rls.integration.sql", "utf8");
const result = spawnSync(
  dockerExecutable,
  ["exec", "-i", "supabase_db_MealLedger", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] },
);

process.exit(result.status ?? 1);
