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

function resolveDatabaseContainer() {
  const configured = process.env.SUPABASE_DB_CONTAINER?.trim();
  if (configured) return configured;

  const discovery = spawnSync(
    dockerExecutable,
    ["ps", "--filter", "name=^supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  );
  if (discovery.status !== 0) {
    process.stderr.write("Could not inspect local Supabase database containers.\n");
    return null;
  }

  const candidates = discovery.stdout.split(/\r?\n/u).map((name) => name.trim()).filter(Boolean);
  if (candidates.length === 1) return candidates[0];

  process.stderr.write(
    candidates.length === 0
      ? "No local Supabase database container is running. Start Supabase before running RLS tests.\n"
      : "Multiple local Supabase database containers are running. Set SUPABASE_DB_CONTAINER explicitly.\n",
  );
  return null;
}

const sql = readFileSync("supabase/tests/rls.integration.sql", "utf8");
const databaseContainer = resolveDatabaseContainer();
if (!databaseContainer) process.exit(1);
const result = spawnSync(
  dockerExecutable,
  ["exec", "-i", databaseContainer, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] },
);

process.exit(result.status ?? 1);
