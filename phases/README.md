# Phase Index

1. [Platform foundation](phase-1-platform-foundation.md)
2. [Customer application](phase-2-customer-application.md)
3. [WordPress integration](phase-3-wordpress-integration.md)
4. [Release and operations](phase-4-release-and-operations.md)

## Shared rules

- `PROJECT.md` is the product and architecture source of truth.
- Preserve authentication, billing, authorization, and usage-accounting boundaries.
- Keep secrets and generated dependencies out of Git.
- Do not mutate production systems without explicit scoped approval.
- Update `progress.md` with status, decisions, risks, and verification evidence.

## Requirement coverage

- Infrastructure, database, auth, and shared APIs: Phase 1.
- Next.js customer flows and dashboard: Phase 2.
- Plugin API contract and WordPress release: Phase 3.
- Testing, deployment, backups, and operational readiness: Phase 4.
