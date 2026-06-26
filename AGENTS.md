# Agent Context Rules

Start here before broad repo exploration:

1. Read `PROJECT.md`.
2. Run `scripts/ai-context.sh` for current branch, dirty files, versions, and deploy targets.
3. Search narrowly with `rg`, always excluding generated folders.

Default excludes for searches:

```bash
--glob '!node_modules/**' --glob '!frontend-next/node_modules/**' --glob '!netlify-functions/node_modules/**' --glob '!frontend-next/.next/**' --glob '!backups/**' --glob '!legacy/**' --glob '!venv/**'
```

Avoid reading old audit/report files unless the user specifically asks:

`PRE_LIVE_TEST_REPORT.md`, `PRODUCTION_READINESS*.md`, `PROJECT_REVIEW_REPORT.md`.

Production safety:

- Do read-only checks first for live systems.
- Do not mutate Supabase, Netlify production, WordPress.org SVN, or a live WordPress site unless the user explicitly approves that scoped action.
- Never print secrets from `.env*` files.
