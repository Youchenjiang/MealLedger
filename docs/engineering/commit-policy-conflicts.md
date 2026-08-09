# Commit Policy Conflicts

## Status

**Resolved.** The rules now live in exactly one file — `scripts/commit-policy.mjs`
— and both the local hook and CI execute that same file, so local and CI
enforcement are identical by construction. The authoritative record is
[`commit-policy.md`](commit-policy.md). The inventory below is kept as history.

## Purpose

The repository used to describe and enforce commit rules in **six different places**.
They disagreed on type lists, scope requirements, subject length, and body
format. This document inventories every source, compares them dimension by
dimension, and lists the conflicts so they could be resolved in one place.

## Sources

| # | File | Kind | Enforced where | Effective? |
|---|---|---|---|---|
| 1 | `.gitmessage.txt` | Commit message template (`commit.template` git config) | Local editor | Advisory (template) |
| 2 | `CONTRIBUTING.md` | Human-readable contribution rules | Human review | Advisory |
| 3 | `.github/workflows/policy.yml` | CI workflow (`actions/github-script`) | GitHub Actions on PR | **Enforced (CI)** |
| 4 | `.git/hooks/commit-msg` | Local git hook | Local machine, every `git commit` | **Enforced (local)** |
| 5 | `.github/pull_request_template.md` | PR description template | GitHub PR form | Advisory (template) |
| 6 | `README.md` | Points to CONTRIBUTING.md | — | Advisory |

Only **two** sources actually block anything: the local `commit-msg` hook and
the CI `policy.yml` workflow. Everything else is descriptive.

## Dimension-by-dimension comparison

### Commit subject format

| Rule | `.gitmessage.txt` | `CONTRIBUTING.md` | `policy.yml` (CI) | `commit-msg` hook |
|---|---|---|---|---|
| Format | `<type>(<scope>): <desc>` | `<type>(<scope>): <desc>` | `^type\(scope\): [a-z0-9]...$` | `^type(\(scope\))?: .+$` |
| Scope required? | Yes (template) | Yes | **Yes** | **No** (optional) |
| Allowed types | 9: feat, fix, refactor, docs, test, chore, style, perf, security | 9: same | 9: same | **7 only**: feat, fix, docs, style, refactor, test, chore |
| Allowed scopes | Preferred list (11) | List (26) | List (39) | **Any** non-empty scope |
| Subject length | **< 50 chars** | **< 72 chars** | **<= 72 chars** | unlimited |
| Description start | lowercase | lowercase | **`[a-z0-9]`** (lowercase letter or digit) | any non-empty (`.+`) |
| No trailing period | Yes | Yes | Yes (enforced) | not checked |
| Vague words banned | not stated | Yes | Yes (enforced) | not checked |
| English only | Yes | Yes | not checked | body: **English required** |

### Commit body format

| Rule | `.gitmessage.txt` | `CONTRIBUTING.md` | `policy.yml` (CI) | `commit-msg` hook |
|---|---|---|---|---|
| Body required? | Template has Why / What changed / Verification sections | Not stated | Not checked | **Yes** |
| Body format | Bulleted sections (`- `) | Not stated | Not checked | **Numbered list starting with `1. ` or `1)`** |
| Body language | — | — | — | **English** |

### PR level

| Rule | `CONTRIBUTING.md` | `pull_request_template.md` | `policy.yml` (CI) |
|---|---|---|---|
| PR title format | Conventional Commits | — | **Enforced** (same regex as commit subject) |
| PR description sections | Summary, Key Changes, Verification, Data/Privacy Impact | Summary, Linked Spec/Issue, Key Changes, Verification, Risk Review, Data/Privacy Impact, Notes | not checked |

## Conflicts (numbered)

### C1 — Type lists disagree (7 vs 9)

- Hook allows only `feat, fix, docs, style, refactor, test, chore`.
- Template, CONTRIBUTING, and CI allow 9, adding `perf` and `security`.
- **Effect**: `perf(...)` and `security(...)` commits pass CI but are **blocked locally** by the hook. The hook error message itself lists only the 7 types.

### C2 — Scope requirement disagrees

- Template, CONTRIBUTING, CI: scope is required (`<type>(<scope>):`).
- Hook: scope is **optional** (`<type>: <desc>` is accepted).
- **Effect**: `chore: bump deps` passes the hook but fails CI. CI regex requires `\(scope\)`.

### C3 — Scope allowlists disagree

- Template lists 11 preferred scopes; CONTRIBUTING lists 26; CI lists 39 (adds `quality`, `account`, `capture`, `cloud`, `e2e`, `export`, `import`, `invoice`, `meals`, `onboarding`, `schema`, `settings`, `ui`).
- Hook allows any scope.
- **Effect**: scopes like `quality` (used in real history: `chore(quality): ...`) are accepted by CI and the hook, but are **not in the template or CONTRIBUTING scope tables**. A scope valid in one doc is missing from another.

### C4 — Subject length disagrees (50 vs 72 vs unlimited)

- Template: `< 50` chars. CONTRIBUTING: `< 72`. CI: `<= 72`. Hook: unlimited.
- **Effect**: a 60-char subject satisfies CONTRIBUTING and CI but violates the template. There is no single authoritative length.

### C5 — Body format is contradictory

- Template's own example body uses **bulleted** sections (`Why:` / `What changed:` / `Verification:` with `- ` items).
- The hook **rejects any body without a numbered list starting `1. ` or `1)`**.
- **Effect**: following the template literally produces a commit the hook blocks. Real history always uses numbered lists (`1. ...`, `2. ...`), so the hook matches practice but contradicts the template.

### C6 — Description start rule disagrees

- CI regex requires the description to start with a lowercase letter or digit (`[a-z0-9]`).
- Hook accepts any non-empty description (`.+`).
- **Effect**: `chore(ci): Add worker config` (capital A) passes the hook but fails CI.

### C7 — Vague-subject and period checks are local-only knowledge

- CI bans trailing periods and vague subjects; hook checks neither.
- **Effect**: the hook alone does not protect history quality; only CI does, and CI only runs on PRs.

### C8 — PR description requirements disagree

- CONTRIBUTING requires 4 sections; the PR template requires 7 (adds Linked Spec/Issue, Risk Review, Notes).
- CI does not check PR description at all.
- **Effect**: no enforced requirement; human reviewers may apply either standard.

### C9 — Enforcement coverage differs by environment

- The hook is **local-only** (`.git/hooks/` is not version-controlled). Other machines, CI-created commits, and web-based merges never see it.
- CI only runs on `pull_request` events — direct pushes to branches do not trigger it.
- **Effect**: the same commit message can be accepted on one machine and rejected on another, and accepted on a push but rejected in a PR.

## What actually happens today (observed behavior)

1. Locally, the `commit-msg` hook blocks commits that lack a `1. ` numbered English body or use `perf`/`security` types.
2. In CI, `policy.yml` blocks PRs whose title or any commit subject fails the 9-type / 38-scope / `[a-z0-9]`-start / ≤72-char / no-period / no-vague regex.
3. A message that passes **both** gates today: 9-type or 7-type subject with a scope in the CI list, ≤72 chars, lowercase/digit start, no period, plus an English numbered body (`1. ...`).

## Open questions to resolve

1. **Type list**: adopt 9 types everywhere, or align the hook to 7? (History already uses `chore(quality)`, and CI allows `perf`/`security`.)
2. **Scope**: keep scope required (CI) or optional (hook)? If required, which single allowlist wins — the 38-scope CI list, or a reduced canonical list?
3. **Subject length**: pick one limit (50 vs 72) and update the other docs.
4. **Body format**: keep the template's bulleted sections but loosen the hook, or change the template to document the numbered-list rule the hook enforces?
5. **Canonical home**: should one file (e.g. CONTRIBUTING.md) become the single source of truth that the template, hook, and CI all reference?

## References

- `.gitmessage.txt`
- `CONTRIBUTING.md`
- `.github/workflows/policy.yml`
- `.git/hooks/commit-msg`
- `.github/pull_request_template.md`
- `README.md`
