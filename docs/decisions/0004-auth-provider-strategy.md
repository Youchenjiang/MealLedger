# ADR 0004: Auth Provider Strategy

## Status

Accepted

## Context

MealLedger is local-first: a user can record ledger entries without any
account. Cloud persistence and multi-device recovery require a user identity,
so V1 needs a login flow that is cheap to operate, works on desktop and
mobile, and does not become a mandatory gate for local use.

Candidates included Magic Link, LINE Login, and a custom OAuth/OIDC provider.
Magic Link simplifies email sign-in but adds friction to routine use and is
not a primary market pattern here. LINE Login is the most popular local
social provider but requires a separately configured custom OAuth/OIDC
provider before it can be wired into Supabase Auth. Custom providers raise
maintenance and security-review costs for V1.

## Decision

V1 supports email/password accounts, password reset, Google OAuth, and
Facebook OAuth behind a single provider-neutral adapter boundary.

Magic Link is used only as the password-reset recovery flow, not as the
routine sign-in entry. LINE Login is deferred until a separately configured
custom OAuth/OIDC provider is in place.

The local workspace remains the default entry. Sign-in is opt-in from
Settings, and ledger-account management stays under Ledger > Accounts.

## Consequences

Providers stay swappable behind the adapter boundary, so adding or removing a
provider does not change session or local-data handoff logic.

Deferring LINE Login avoids custom OAuth/OIDC configuration and its security
review burden in V1, at the cost of not supporting the most popular local
social login until a follow-up.

Deploying production provider credentials is a separate rollout outside the
configured development Supabase environment.

## References

- [Auth requirements](../specs/auth/requirements.md)
- [Auth design](../specs/auth/design.md)
- [Auth provider setup](../specs/auth/provider-setup.md)
- [Cloud persistence spec](../specs/cloud-persistence/requirements.md)
