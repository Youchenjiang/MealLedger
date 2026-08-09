# Commit and PR Policy

## Status

**Resolved and enforced.** This document is the human-readable record of the
repository's commit/PR policy. It supersedes
[`commit-policy-conflicts.md`](commit-policy-conflicts.md), which documented
the six-way disagreement between `.gitmessage.txt`, `CONTRIBUTING.md`, the CI
workflow, the local `commit-msg` hook, the PR template, and `README.md`.

## Single source of truth

All enforced rules live in **exactly one file**: `scripts/commit-policy.mjs`.

Both enforcement gates execute that file, so they cannot drift. An advisory
pre-commit hook uses the same file for an early hint:

| Gate | File | Runs |
| --- | --- | --- |
| **Local (advisory)** | `scripts/hooks/pre-commit`, installed into `.git/hooks/pre-commit` by `npm run prepare` | `suggest-scope` tip from the staged files, before the message is written; **never blocks** |
| **Local (hard gate)** | `scripts/hooks/commit-msg`, installed into `.git/hooks/commit-msg` by `npm run prepare` (runs automatically on every `npm install`) | `message` mode on every `git commit` |
| **CI** | `.github/workflows/policy.yml` | `subject` mode on the PR title, `message` mode on every commit in the PR, plus `self-test` |

Because both gates run the same script, a message that passes locally passes
CI, and one that fails CI also fails locally. There is **no second copy of any
rule anywhere else**: `.gitmessage.txt`, `CONTRIBUTING.md`, and the PR
template reference this policy but do not restate the rules.

If local and CI ever disagree, that is a bug in the wiring (hook install or
workflow), not a rules problem — the rules themselves have one home.

## The rules (what both gates block)

### Subject format

Every commit subject and every PR title must match:

```text
<type>(<scope>): <description>
```

- The scope is **required** and must be from the allowlist below.
- The subject must be **at most 72 characters**.
- The description must **start with a lowercase letter or digit**.
- The subject must **not end with a period**.
- Vague descriptions are rejected: `update`, `misc`, `stuff`, `changes`,
  `fix bug`, `bug fix` (case-insensitive).
- Subjects are written in English.

### Allowed types

`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `security`

### Allowed scopes

`app`, `ledger`, `meal`, `media`, `r2`, `supabase`, `ai`, `auth`, `docs`,
`ci`, `deps`, `product`, `accounting`, `taxonomy`, `imports`, `security`,
`sync`, `flows`, `v1`, `data`, `ops`, `test`, `privacy`, `workflow`, `spec`,
`decisions`, `account`, `capture`, `cloud`, `e2e`, `export`, `import`,
`invoice`, `meals`, `onboarding`, `schema`, `settings`, `ui`, `quality`

> `quality` is not in the original CI allowlist but appears in real history
> (e.g. `chore(quality): ...`), so it is canonical going forward. Use a new
> scope only when none of the above fits, and add it to
> `scripts/commit-policy.mjs` in the same commit.

### Body format

The commit body must contain a **numbered list in English** whose first item
starts with `1. ` or `1)`:

```text
feat(meal): add photo-linked meal entries

1. Add the new entry form.
2. Wire the media picker.
```

Git comment lines (starting with `#`) are ignored by the check, so the
`.gitmessage.txt` template's comment block does not affect validation.

### PR title

The PR title is validated with the same subject rules as commits. PR
description sections are defined only by the
[PR template](../../.github/pull_request_template.md) and are not enforced by
the gate.

## How to change a rule

1. Edit `scripts/commit-policy.mjs` **only** — this is the single source of
   truth for the rules.
2. Run `npm run test:policy` (built-in self-test) and the vitest policy test
   (`npx vitest run tests/commit-policy.test.mjs`).
3. Commit the change with a valid subject, e.g. `chore(ci): extend allowed
   commit scopes`. Both gates validate your own commit.
4. If the change affects the human-readable rule list, update this document
   in the same commit.

No other file needs a parallel edit, which is the point: the rules were
previously copied into six places and drifted apart (see conflict history
below).

## Verifying parity

- Local: `npm run prepare` installs the hooks; `node
  scripts/commit-policy.mjs self-test` checks the rule engine; `npm run
  test:docs` (scripts/check-docs.mjs) checks that every relative doc link
  resolves and that the policy rule values are not embedded in any other
  file. The advisory `pre-commit` hook prints a `[SCOPE TIP]` based on the
  staged files (path→scope hints in `scripts/commit-policy.mjs`); it only
  hints — `commit-msg` remains the hard gate.
- Tools/IDEs can consume the hint machine-readably:
  `node scripts/commit-policy.mjs suggest-scope --json` prints
  `{ suggestedScopes, allowedScopes, paths, areas, staged, tip }` to stdout
  (the human tip goes to stderr).
- Atomic-commit nudge: when the staged files span two or more unrelated
  areas (an advisory grouping defined in `scripts/commit-policy.mjs`; e.g.
  `manualLedger` and `importExport` are both the `ledger` area, but `ledger`
  and `docs` are unrelated), the tip adds "consider splitting into separate
  commits". Related prefixes share an area so normal single-subject commits
  are not flagged. This is a hint only — nothing blocks.
- CI: the `Repository Policy` workflow runs the same `self-test` and
  `check-docs` steps, then validates the PR title and every commit with the
  same script the hook runs.
- CI also runs the vitest policy test if the PR touches the policy.

## Conflict history (why this exists)

The commit rules used to be scattered across six files that disagreed on type
lists (7 vs 9), whether the scope is required, scope allowlists, subject
length (50 vs 72 vs unlimited), body format (bullets vs numbered list), and
enforcement coverage (local-only hook vs CI-only regex). The full inventory is
kept in [`commit-policy-conflicts.md`](commit-policy-conflicts.md).

Resolution decisions:

1. **Types**: 9 types everywhere (`perf` and `security` included).
2. **Scope**: required, from a single allowlist (CI's 38 scopes + `quality`
   from real history).
3. **Length**: at most 72 characters.
4. **Body**: numbered English list starting with `1. ` or `1)`, enforced by
   both gates (previously only by the local hook).
5. **Canonical home**: rules live in `scripts/commit-policy.mjs`; this
   document is the human-readable record; everything else references it.
