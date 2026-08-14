#!/usr/bin/env node
/**
 * scripts/check-auth-config.mjs
 *
 * Reads the LIVE Supabase auth URL configuration (Site URL + Redirect URLs
 * allow-list) through the Management API and verifies it matches the values
 * documented in docs/engineering/frontend-hosting.md (Auth URL Configuration)
 * and docs/engineering/email-delivery.md.
 *
 * Requires a Supabase personal access token. The token is resolved in this
 * order: SUPABASE_ACCESS_TOKEN environment variable, the CLI token file
 * (~/.supabase/access-token), then the OS credential store (Windows
 * Credential Manager "Supabase CLI:<profile>", where `npx supabase login`
 * stores it). The token never leaves the process.
 *
 *   Token: https://supabase.com/dashboard/account/tokens
 *   Project ref: read from VITE_SUPABASE_URL in .env.local (or override with
 *   SUPABASE_PROJECT_REF).
 *
 * Expected values (documented spec):
 *   Site URL:        https://mealledger.g1014308.workers.dev
 *   Redirect URLs:   https://mealledger.g1014308.workers.dev/account
 *                    http://127.0.0.1:5200/account        (local review)
 *                    http://127.0.0.1:4173/account        (other dev ports)
 *                    http://127.0.0.1:4174/account
 *                    http://127.0.0.1:3000/account        (supabase start only)
 *
 * Override any expectation with the AUTH_CHECK_* environment variables, for
 * example AUTH_CHECK_SITE_URL or AUTH_CHECK_REDIRECT_URLS (comma-separated).
 *
 * Exit codes: 0 = all expected values present, 1 = mismatch found,
 * 2 = cannot run (no token / no project ref / API failure).
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_REF_FALLBACK = "rolsgcftiqvobdfzsktu";
const SITE_URL_EXPECTED = "https://mealledger.g1014308.workers.dev";
const REDIRECT_URLS_EXPECTED = [
  "https://mealledger.g1014308.workers.dev/account",
  "http://127.0.0.1:5200/account",
  "http://127.0.0.1:4173/account",
  "http://127.0.0.1:4174/account",
  "http://127.0.0.1:3000/account",
];

// Strip trailing slashes without a regex: simple, linear, and analyzer-friendly.
function stripTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

function normalizeUrl(value) {
  return stripTrailingSlashes(String(value ?? "").trim());
}

function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  const cliToken = join(homedir(), ".supabase", "access-token");
  if (existsSync(cliToken)) {
    const stored = readFileSync(cliToken, "utf8").trim();
    if (stored) return stored;
  }
  return readWindowsKeyringToken();
}

// The supabase CLI stores the access token in the OS credential store
// (go-keyring). On Windows that is the Credential Manager under the target
// "Supabase CLI:<profile>"; read it through the Win32 CredRead API so this
// script works without re-login. The token never leaves this process.
function readWindowsKeyringToken() {
  if (process.platform !== "win32") return "";
  const script = [
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class CredMan {",
    "  [DllImport(\"advapi32.dll\", CharSet = CharSet.Unicode, SetLastError = true)]",
    "  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credential);",
    "  [DllImport(\"advapi32.dll\")]",
    "  public static extern void CredFree(IntPtr buffer);",
    "}",
    "'@",
    "$ptr = [IntPtr]::Zero",
    "$ok = [CredMan]::CredRead('Supabase CLI:supabase', 1, 0, [ref]$ptr)",
    "if (-not $ok) { exit 1 }",
    "# CREDENTIALW layout on x64: CredentialBlobSize at byte 32, CredentialBlob pointer at byte 40.",
    "$blobSize = [Runtime.InteropServices.Marshal]::ReadInt32($ptr, 32)",
    "$blobPtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($ptr, 40)",
    "$token = ''",
    "if ($blobSize -gt 0) {",
    "  $bytes = New-Object byte[] $blobSize",
    "  [Runtime.InteropServices.Marshal]::Copy($blobPtr, $bytes, 0, $blobSize)",
    "  $token = [System.Text.Encoding]::ASCII.GetString($bytes).TrimEnd([char]0)",
    "}",
    "[CredMan]::CredFree($ptr) | Out-Null",
    "Write-Output $token",
  ].join("\r\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  // Resolve PowerShell by absolute path instead of PATH lookup (S4036): the
  // script only ever runs on Windows to read the CLI credential-manager token.
  const powerShellPath = join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const result = spawnSync(
    powerShellPath,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { encoding: "utf8", windowsHide: true, timeout: 30000 },
  );
  if (result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

function readProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF?.trim()) {
    return process.env.SUPABASE_PROJECT_REF.trim();
  }
  const envFile = join(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    const match = readFileSync(envFile, "utf8").match(/^VITE_SUPABASE_URL=(.+)$/m);
    if (match) {
      const hostname = new URL(match[1].trim()).hostname;
      if (hostname.endsWith(".supabase.co")) return hostname.split(".")[0];
    }
  }
  return PROJECT_REF_FALLBACK;
}

function expectedValues() {
  return {
    siteUrl: normalizeUrl(process.env.AUTH_CHECK_SITE_URL || SITE_URL_EXPECTED),
    redirectUrls: (process.env.AUTH_CHECK_REDIRECT_URLS || REDIRECT_URLS_EXPECTED.join(","))
      .split(",")
      .map(normalizeUrl)
      .filter(Boolean),
  };
}

const token = readToken();
if (!token) {
  console.error(
    "No Supabase access token found.\n" +
      "Create one at https://supabase.com/dashboard/account/tokens, then either:\n" +
      "  - export SUPABASE_ACCESS_TOKEN=your-token   (per shell), or\n" +
      "  - npx supabase login                        (stores it for the CLI and this script)",
  );
  process.exit(2);
}

const projectRef = readProjectRef();
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (response.status === 401 || response.status === 403) {
  console.error(`Management API rejected the token (HTTP ${response.status}). Check the access token is valid and has access to project ${projectRef}.`);
  process.exit(2);
}
if (!response.ok) {
  console.error(`Management API request failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
  process.exit(2);
}

const config = await response.json();
// The Management API returns uri_allow_list as a comma-separated string
// ("a,b,c"), not a JSON array — normalize both shapes.
const parseAllowList = (value) => {
  if (Array.isArray(value)) return value.map(normalizeUrl).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(normalizeUrl).filter(Boolean);
  return [];
};
const actual = {
  siteUrl: normalizeUrl(config.site_url),
  redirectUrls: parseAllowList(config.uri_allow_list),
};
const expected = expectedValues();

const failures = [];
const report = (label, ok, detail) => {
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}: ${detail}`);
  if (!ok) failures.push(label);
};

console.log(`Project: ${projectRef}`);
console.log("");

const siteUrlDetail = actual.siteUrl === expected.siteUrl
  ? actual.siteUrl || "(empty)"
  : `${actual.siteUrl || "(empty)"} — expected ${expected.siteUrl}`;
report("Site URL", actual.siteUrl === expected.siteUrl, siteUrlDetail);
if (actual.siteUrl !== expected.siteUrl) {
  console.log("        Fix: Authentication > URL Configuration > Site URL (emails link here)");
}

console.log("");
console.log(`Redirect URLs allow-list (${actual.redirectUrls.length} configured):`);
for (const url of actual.redirectUrls) {
  console.log(`  - ${url}`);
}
console.log("");
for (const expectedUrl of expected.redirectUrls) {
  const ok = actual.redirectUrls.includes(expectedUrl);
  report(
    "Redirect URL",
    ok,
    ok ? expectedUrl : `${expectedUrl} — missing from allow-list`,
  );
  if (!ok) {
    console.log("        Fix: add it under Authentication > URL Configuration > Redirect URLs");
  }
}

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} field(s) out of spec — update the Supabase dashboard per docs/engineering/frontend-hosting.md.`);
  process.exitCode = 1;
} else {
  // skipcq: JS-0002 -- Node CLI; the pass message is the intended stdout output.
  console.log("OK — auth URL configuration matches the documented spec.");
  process.exitCode = 0;
}
