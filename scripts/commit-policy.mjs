#!/usr/bin/env node
/**
 * scripts/commit-policy.mjs
 *
 * SINGLE SOURCE OF TRUTH for the repository commit / PR policy.
 *
 * Both enforcement gates execute this exact file, so local and CI behavior
 * can never drift:
 *
 *   1. Local — scripts/hooks/commit-msg (installed into .git/hooks/commit-msg
 *              by `npm run prepare`, which runs on every `npm install`)
 *              runs `message` mode on every `git commit`. This is the hard
 *              gate.
 *   2. Local (advisory) — scripts/hooks/pre-commit runs `suggest-scope`
 *              before the commit message is written. It only hints at the
 *              likely scope from the staged files; it never blocks.
 *   3. CI    — .github/workflows/policy.yml runs `subject` mode on the PR
 *              title, `message` mode on every commit in the PR, and
 *              `self-test` mode to prove the policy code itself is sane.
 *
 * To change the policy, edit ONLY this file. Both gates pick the change up
 * automatically. Human-readable record: docs/engineering/commit-policy.md.
 *
 * CLI usage:
 *   node scripts/commit-policy.mjs subject <text>       validate one subject
 *   node scripts/commit-policy.mjs message [file]       validate a full commit
 *                                                       message (file path or stdin)
 *   node scripts/commit-policy.mjs list                 print the current policy
 *   node scripts/commit-policy.mjs self-test            run built-in checks
 *   node scripts/commit-policy.mjs suggest-scope [--json] [path…]
 *                                                       hint at the scope for
 *                                                       staged files (or given
 *                                                       paths); --json prints
 *                                                       {suggestedScopes,
 *                                                       allowedScopes, paths,
 *                                                       staged, tip} to stdout
 *
 * Exit code 0 = pass, 1 = policy violation, 2 = usage error.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const POLICY = {
  types: [
    "feat",
    "fix",
    "refactor",
    "docs",
    "test",
    "chore",
    "style",
    "perf",
    "security",
  ],
  scopes: [
    "app", "ledger", "meal", "media", "r2", "supabase", "ai", "auth",
    "docs", "ci", "deps", "product", "accounting", "taxonomy", "imports",
    "security", "sync", "flows", "v1", "data", "ops", "test", "privacy",
    "workflow", "spec", "decisions", "account", "capture", "cloud", "e2e",
    "export", "import", "invoice", "meals", "onboarding", "schema",
    "settings", "ui",
    // "quality" is not in the original CI list but appears in real history
    // (e.g. chore(quality): ...), so it is canonical going forward.
    "quality",
  ],
  subjectMaxLength: 72,
  // Description (text after "<type>(<scope>): ") must start with these.
  descriptionStart: /^[a-z0-9]/,
  // Exact-match vague descriptions, compared case-insensitively.
  vagueDescriptions: ["update", "misc", "stuff", "changes", "fix bug", "bug fix"],
  body: {
    // Body must contain a numbered list in English starting at "1. " or "1)".
    numberedListPattern: /^\s*1[.)]\s+/m,
  },
};

export function describeFormat() {
  return "<type>(<scope>): <description>";
}

// Path-prefix hints for the advisory pre-commit hook. Suggestions only — the
// hard gate is the scope allowlist in POLICY.scopes, enforced by commit-msg
// and CI. Rules are matched longest-prefix-first, and every suggested scope
// is filtered against POLICY.scopes so hints can never name an invalid scope.
//
// `area` is an advisory grouping used ONLY by the "consider splitting" tip:
// when staged files match two or more unrelated areas, the tip suggests
// separate commits (atomic commit rule). Related prefixes share an area (e.g.
// manualLedger and importExport are both `ledger`), so a normal ledger commit
// is not flagged.
const SCOPE_HINTS = [
  { prefix: "supabase/", scopes: ["supabase"], area: "backend" },
  { prefix: "docs/specs/", scopes: ["spec"], area: "docs" },
  { prefix: "docs/", scopes: ["docs"], area: "docs" },
  { prefix: "tests/", scopes: ["test"], area: "quality" },
  { prefix: "src/test/", scopes: ["test"], area: "quality" },
  { prefix: ".github/", scopes: ["ci"], area: "tooling" },
  { prefix: "scripts/", scopes: ["ci"], area: "tooling" },
  { prefix: "src/manualLedger/", scopes: ["ledger", "accounting"], area: "ledger" },
  { prefix: "src/appShell/", scopes: ["app"], area: "app" },
  { prefix: "src/ai/", scopes: ["ai"], area: "capture" },
  { prefix: "src/auth/", scopes: ["auth"], area: "backend" },
  { prefix: "src/cloudPersistence/", scopes: ["sync"], area: "sync" },
  { prefix: "src/importExport/", scopes: ["import", "export"], area: "ledger" },
  { prefix: "src/onboarding/", scopes: ["onboarding"], area: "app" },
  { prefix: "src/schemaCore/", scopes: ["schema"], area: "backend" },
  { prefix: "src/taxonomy/", scopes: ["taxonomy"], area: "ledger" },
  { prefix: "src/captureMedia/upload", scopes: ["r2", "media"], area: "capture" },
  { prefix: "src/captureMedia/media", scopes: ["media"], area: "capture" },
  { prefix: "src/captureMedia/meals", scopes: ["meals"], area: "capture" },
  { prefix: "src/captureMedia/", scopes: ["capture"], area: "capture" },
  { prefix: "src/lib/", scopes: ["app", "auth"], area: "app" },
  { prefix: "src/", scopes: ["app"], area: "app" },
  { prefix: "package.json", scopes: ["deps"], area: "tooling" },
  { prefix: "package-lock.json", scopes: ["deps"], area: "tooling" },
  { prefix: "vite.config.ts", scopes: ["ci"], area: "tooling" },
  { prefix: "playwright.config.ts", scopes: ["ci", "e2e"], area: "tooling" },
  { prefix: "tsconfig", scopes: ["ci"], area: "tooling" },
  { prefix: "index.html", scopes: ["app"], area: "app" },
  { prefix: "public/", scopes: ["app"], area: "app" },
  { prefix: "README.md", scopes: ["docs"], area: "docs" },
  { prefix: "CONTRIBUTING.md", scopes: ["docs"], area: "docs" },
  { prefix: ".gitmessage.txt", scopes: ["ci", "docs"], area: "tooling" },
  { prefix: ".env.example", scopes: ["docs", "ci"], area: "docs" },
  { prefix: ".sonarcloud.properties", scopes: ["ci"], area: "tooling" },
  { prefix: "wrangler.jsonc", scopes: ["ci", "ops"], area: "tooling" },
];

const SORTED_SCOPE_HINTS = [...SCOPE_HINTS].sort((a, b) => b.prefix.length - a.prefix.length);

// Per-path breakdown used by the --json output so tools can show why a
// scope was suggested. Paths that match nothing get an empty list.
export function scopeHintsForPaths(paths) {
  const entries = [];
  for (const rawPath of paths) {
    const path = rawPath.replace(/\\/g, "/");
    const hit = SORTED_SCOPE_HINTS.find((hint) => path.startsWith(hint.prefix));
    entries.push({
      path,
      suggestedScopes: hit ? hit.scopes.filter((scope) => POLICY.scopes.includes(scope)) : [],
    });
  }
  return entries;
}

export function suggestScopesForPaths(paths) {
  const counts = new Map();
  for (const { suggestedScopes } of scopeHintsForPaths(paths)) {
    for (const scope of suggestedScopes) {
      counts.set(scope, (counts.get(scope) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([scope]) => scope);
}

// Advisory areas matched by the given paths, in first-appearance order. Two or
// more areas means the staged set likely spans unrelated changes (atomic
// commit rule) — the suggest-scope tip uses this for its "consider splitting"
// note.
export function areasForPaths(paths) {
  const areas = [];
  const seen = new Set();
  for (const rawPath of paths) {
    const path = rawPath.replace(/\\/g, "/");
    const hit = SORTED_SCOPE_HINTS.find((hint) => path.startsWith(hint.prefix));
    if (!hit || seen.has(hit.area)) continue;
    seen.add(hit.area);
    areas.push(hit.area);
  }
  return areas;
}

export function validateSubject(subject) {
  const errors = [];
  const subjectText = String(subject ?? "").trim();
  if (!subjectText) {
    errors.push("Subject is empty.");
    return errors;
  }

  const typePattern = POLICY.types.join("|");
  const scopePattern = POLICY.scopes.join("|");
  const pattern = new RegExp(`^(${typePattern})\\((${scopePattern})\\): (.+)$`);
  const match = subjectText.match(pattern);

  if (!match) {
    errors.push(
      `Subject must match ${describeFormat()} using an allowed type and scope.`,
    );
    errors.push(`  Given: ${subjectText}`);
    errors.push(`  Allowed types: ${POLICY.types.join(", ")}`);
    errors.push(`  Allowed scopes: ${POLICY.scopes.join(", ")}`);
    return errors;
  }

  const description = match[3];

  if (subjectText.length > POLICY.subjectMaxLength) {
    errors.push(
      `Subject must be ${POLICY.subjectMaxLength} characters or fewer (this one is ${subjectText.length}).`,
    );
  }
  if (!POLICY.descriptionStart.test(description)) {
    errors.push(
      `Description must start with a lowercase letter or digit: "${description}".`,
    );
  }
  if (subjectText.endsWith(".")) {
    errors.push("Subject must not end with a period.");
  }
  if (POLICY.vagueDescriptions.includes(description.toLowerCase())) {
    errors.push(`Description is too vague: "${description}".`);
  }

  return errors;
}

export function validateCommitMessage(message) {
  const errors = [];
  const text = String(message ?? "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  // Subject: first line that is not a git comment (lines starting with "#").
  const subject = lines.find((line) => !line.startsWith("#")) ?? "";
  errors.push(...validateSubject(subject));

  // Body: everything after the subject, ignoring git comment lines.
  const bodyLines = lines.slice(1).filter((line) => !line.startsWith("#"));
  const body = bodyLines.join("\n");
  if (!POLICY.body.numberedListPattern.test(body)) {
    errors.push(
      'Body must contain a numbered list in English starting with "1. " or "1)" (example: "1. Explain what changed and why.").',
    );
  }

  return errors;
}

function runSelfTest() {
  const failures = [];
  const check = (label, errors, expectErrors) => {
    const unexpected = expectErrors ? errors.length === 0 : errors.length > 0;
    if (unexpected) {
      failures.push(
        `${label}: expected ${expectErrors ? "errors" : "no errors"} but got ${
          errors.length === 0 ? "none" : errors.join(" | ")
        }`,
      );
    }
  };

  check("valid subject", validateSubject("feat(meal): add photo-linked meal entries"), false);
  check("missing scope", validateSubject("feat: add photo-linked meal entries"), true);
  check("bad type", validateSubject("feta(meal): add photo-linked meal entries"), true);
  check("unknown scope", validateSubject("feat(nonsense): add photo-linked entries"), true);
  check("too long", validateSubject(`feat(meal): ${"x".repeat(70)}`), true);
  check("uppercase start", validateSubject("feat(meal): Add photo-linked entries"), true);
  check("trailing period", validateSubject("feat(meal): add photo-linked entries."), true);
  check("vague", validateSubject("chore(ci): update"), true);
  check("quality scope", validateSubject("chore(quality): exclude RLS tests from analysis"), false);
  check("PR title rules match", validateSubject("fix(r2): reject non-image upload content types"), false);

  check(
    "numbered body",
    validateCommitMessage("feat(meal): add photo-linked entries\n\n1. Add the entry form.\n2. Wire the media picker.\n"),
    false,
  );
  check(
    "numbered body with 1)",
    validateCommitMessage("feat(meal): add photo-linked entries\n\n1) Add the entry form.\n"),
    false,
  );
  check(
    "bulleted body only",
    validateCommitMessage("feat(meal): add photo-linked entries\n\nWhy:\n\n- something\n"),
    true,
  );
  check(
    "empty body",
    validateCommitMessage("feat(meal): add photo-linked entries"),
    true,
  );
  check(
    "comment lines ignored",
    validateCommitMessage("feat(meal): add photo-linked entries\n\n1. Add the entry form.\n# Please enter the commit message for your changes.\n"),
    false,
  );

  return failures;
}

function printUsage() {
  console.error(
    [
      "Usage:",
      "  node scripts/commit-policy.mjs subject <text>       validate one subject (PR title or commit subject)",
      "  node scripts/commit-policy.mjs message [file]       validate a full commit message (file path or stdin)",
      "  node scripts/commit-policy.mjs list                 print the current policy",
      "  node scripts/commit-policy.mjs self-test            run built-in checks and exit non-zero on failure",
      "  node scripts/commit-policy.mjs suggest-scope [--json] [path…]  hint at the scope for staged files (or given paths)",
    ].join("\n"),
  );
}

function main() {
  const [mode, arg] = process.argv.slice(2);
  let errors = [];

  switch (mode) {
    case "subject":
      if (arg === undefined) {
        printUsage();
        process.exit(2);
      }
      errors = validateSubject(arg);
      break;
    case "message": {
      const text = arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");
      errors = validateCommitMessage(text);
      break;
    }
    case "list":
      // skipcq: JS-0002 -- Node CLI; the policy dump is the intended stdout output.
      console.log(
        [
          `types: ${POLICY.types.join(", ")}`,
          `scopes: ${POLICY.scopes.join(", ")}`,
          `subjectMaxLength: ${POLICY.subjectMaxLength}`,
          'body: numbered list starting with "1. " or "1)"',
        ].join("\n"),
      );
      process.exit(0);
      break;
    case "self-test":
      errors = runSelfTest();
      break;
    case "suggest-scope": {
      const args = process.argv.slice(3).filter(Boolean);
      const json = args.includes("--json");
      const explicitPaths = args.filter((candidate) => candidate !== "--json");

      let paths = explicitPaths;
      let staged = false;
      if (paths.length === 0) {
        try {
          // NOSONAR -- git resolves via PATH; standard for a dev tool, and hardcoding its path would break on other OSes.
          const output = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" });
          paths = output.split("\n").map((p) => p.trim()).filter(Boolean);
          staged = true;
        } catch {
          paths = [];
        }
      }

      const hints = scopeHintsForPaths(paths);
      const suggestions = suggestScopesForPaths(paths);
      const areas = areasForPaths(paths);
      const splitNote = areas.length > 1
        ? ` Staged files span unrelated areas (${areas.join(", ")}) — consider splitting into separate commits (atomic commit rule).`
        : "";
      const tip = `${suggestions.length === 0
        ? "Staged changes did not map to an allowed scope. Pick one from the allowlist for your commit subject."
        : `Staged changes suggest scope: ${suggestions.join(", ")}. Commit subject must match <type>(<scope>): <description>; commit-msg and CI enforce the allowlist.`}${splitNote}`;

      if (json) {
        // Machine-readable output goes to stdout; the human tip stays on stderr.
        // skipcq: JS-0002 -- Node CLI; the JSON payload is the intended stdout protocol.
        console.log(JSON.stringify({
          suggestedScopes: suggestions,
          allowedScopes: POLICY.scopes,
          paths: hints,
          areas,
          staged,
          tip,
        }, null, 2));
        process.exit(0);
      }

      if (paths.length === 0) {
        // No staged files (fresh repo or `git commit -a`) — stay quiet.
        process.exit(0);
      }
      console.error(`[SCOPE TIP] ${tip}`);
      if (suggestions.length === 0) {
        console.error(`  Allowed scopes: ${POLICY.scopes.join(", ")}`);
      }
      process.exit(0);
      break;
    }
    default:
      printUsage();
      process.exit(2);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[COMMIT BLOCKED] ${error}`);
    }
    process.exit(1);
  }
  // skipcq: JS-0002 -- Node CLI; the pass message is the intended stdout output.
  console.log("OK");
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
