# MealLedger
A personal accounting app that can optionally link transactions, invoice scans, meal records, and photos while keeping large media files separate from clean financial exports.

## Architecture

MealLedger stores structured records in Supabase PostgreSQL and large media files in Cloudflare R2. The database keeps media metadata and relationship IDs only, so ledger exports stay small and do not include image bytes.

## Start Here

If you are new to the project, read these first:

1. [Documentation index](docs/README.md)
2. [Product requirements notes](docs/product/product-requirements.md)
3. [V1 implementation sequence](docs/engineering/implementation-sequence.md)
4. [Spec-driven workflow](docs/engineering/spec-driven-workflow.md)
5. [PR review checklist](docs/engineering/pr-review-checklist.md)

For implementation work, start from the relevant feature spec under `docs/specs/`.

## Key Documents

- [Documentation index](docs/README.md)
- [Setup notes](docs/engineering/setup.md)
- [Meal, media, and ledger flows](docs/product/flows.md)
- [Product requirements notes](docs/product/product-requirements.md)
- [Long-term roadmap](docs/product/roadmap.md)
- [Development workflow](docs/engineering/development-workflow.md)
- [Backend architecture](docs/engineering/backend-architecture.md)
- [Supabase schema](supabase/schema.sql)
- [R2 upload Edge Function](supabase/functions/create-r2-upload-url/index.ts)

## Development

Before contributing, read [CONTRIBUTING.md](CONTRIBUTING.md). The repository enforces Conventional Commit PR titles and commit subjects through GitHub Actions.
Frontend work must follow [Development Workflow](docs/engineering/development-workflow.md).

```sh
npm install
npm run dev
npm run build
```
