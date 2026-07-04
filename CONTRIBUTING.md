# Contributing to MealLedger

MealLedger uses a strict commit and pull request policy. The goal is to keep history easy to review, easy to bisect, and useful for future AI-assisted maintenance.

## Branch Rules

- `main` must stay deployable.
- Do not push directly to `main`.
- Create topic branches from `main`:
  - `feature/<short-name>` for features
  - `fix/<short-name>` for bug fixes
  - `docs/<short-name>` for documentation-only work
  - `chore/<short-name>` for maintenance
- Keep branches short-lived. Rebase or merge `main` before opening a PR if the branch is stale.

## Commit Format

Every commit must use Conventional Commits:

```text
<type>(<scope>): <description>
```

Examples:

```text
feat(meal): add photo-linked meal entries
fix(r2): reject non-image upload content types
docs(setup): document Supabase secrets
test(ledger): cover transfer export rows
```

## Commit Types

| Type | Use for |
| --- | --- |
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Internal restructuring with no behavior change |
| `docs` | Documentation only |
| `test` | Tests and test fixtures |
| `chore` | Tooling, config, dependencies, repository maintenance |
| `style` | Formatting only, no behavior change |
| `perf` | Performance improvement |
| `security` | Security or privacy hardening |

## Commit Scopes

Prefer one of these scopes:

| Scope | Area |
| --- | --- |
| `app` | Frontend app shell and navigation |
| `ledger` | Accounts, transactions, transfers, exports |
| `meal` | Meal entries and food logging |
| `media` | Photo metadata, thumbnails, image handling |
| `r2` | Cloudflare R2 upload/download integration |
| `supabase` | Supabase schema, RLS, Edge Functions |
| `ai` | OCR, parsing, suggestions, embeddings |
| `auth` | Login, user identity, permissions |
| `docs` | Repository documentation |
| `ci` | GitHub Actions and automation |
| `deps` | Dependency updates |

Use a new scope only when none of the above is accurate.

## Commit Message Rules

- Use English.
- Keep the subject under 72 characters.
- Use lowercase after the colon.
- Do not end the subject with a period.
- Do not use vague subjects like `update files`, `fix bug`, or `misc changes`.
- Reference issues in the body, not the subject, unless the issue number is the main point.

Good:

```text
feat(ledger): add clean CSV export view
```

Bad:

```text
update
fix stuff
feat: Added Things.
```

## Atomic Commit Rules

One commit must represent one logical change.

- Separate unrelated features.
- Separate refactors from behavior changes.
- Separate generated files from manual source changes when that makes review easier.
- Use `git mv` for renames so history stays readable.
- Do not mix secret/config examples with real credentials.

Split work like this:

```text
feat(media): add R2 upload URL function
feat(meal): link meal entries to media assets
docs(setup): describe R2 bucket setup
```

Not like this:

```text
feat(app): add meals, upload photos, rewrite docs, fix exports
```

## Pull Request Rules

PR titles must also follow Conventional Commits:

```text
<type>(<scope>): <description>
```

PR descriptions must include:

- Summary
- Key Changes
- Verification
- Data/Privacy Impact

Small PRs are preferred. If a PR touches more than one subsystem, explain why it should be reviewed together.

## Verification Expectations

Before requesting review, include the checks you ran. At minimum:

- Schema changes: verify SQL applies cleanly to a fresh Supabase project or local Supabase DB.
- R2 changes: verify signed upload URLs never expose R2 secrets.
- Export changes: verify exports do not include image bytes or base64 media.
- AI changes: verify AI output remains draft/suggestion data unless explicitly confirmed by the user.

## Privacy Rules

- Never commit `.env` files, real API keys, service role keys, database URLs, R2 credentials, or personal ledger data.
- Use `.env.example` for placeholders.
- Test data must be fake and obviously non-personal.
- Media files in tests should be tiny synthetic fixtures, not real meal photos or receipts.

