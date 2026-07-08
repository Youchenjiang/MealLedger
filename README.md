# MealLedger
A personal accounting app that can optionally link transactions, invoice scans, meal records, and photos while keeping large media files separate from clean financial exports.

## Architecture

MealLedger stores structured records in Supabase PostgreSQL and large media files in Cloudflare R2. The database keeps media metadata and relationship IDs only, so ledger exports stay small and do not include image bytes.

- [Setup notes](docs/setup.md)
- [Meal, media, and ledger flows](docs/flows.md)
- [Product requirements notes](docs/product-requirements.md)
- [Long-term roadmap](docs/roadmap.md)
- [Development workflow](docs/development-workflow.md)
- [Backend architecture](docs/backend-architecture.md)
- [Supabase schema](supabase/schema.sql)
- [R2 upload Edge Function](supabase/functions/create-r2-upload-url/index.ts)

## Development

Before contributing, read [CONTRIBUTING.md](CONTRIBUTING.md). The repository enforces Conventional Commit PR titles and commit subjects through GitHub Actions.
Frontend work must follow [Development Workflow](docs/development-workflow.md).
