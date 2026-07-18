# Phase 1: Platform Foundation

## Scope and deliverables

Maintain Supabase schema and migrations, authentication boundaries, shared Netlify function utilities, authorization, billing state, and usage accounting.

## Dependencies

None. Later phases depend on stable contracts from this phase.

## Tests

Run focused unit and integration tests for migrations, auth, authorization, billing webhooks, and atomic usage updates.

## Acceptance and exit gate

Schema changes are reversible and reviewed; secrets remain outside Git; authorization and accounting tests pass; downstream API contracts are documented.

