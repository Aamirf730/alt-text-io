# Alt Text Pro Project Context

This file is the compact context entrypoint for future Codex work. Read it before scanning the repo.

## Product

Alt Text Pro is a SaaS plus WordPress plugin that generates AI alt text for WordPress media. Public site: `https://www.alt-text.pro`. Netlify site: `alt-text-ai`. GitHub repo: `Aamirf730/alt-text-io`.

## Current Architecture

- `frontend-next/`: Next.js marketing app, dashboard, checkout, customer portal, Polar webhook, docs, connect flow, public plugin ZIPs.
- `frontend-next/src/app/customer-offer/`: invitation-only campaign claim experience for eligible legacy WPGeared customers.
- `netlify-functions/`: legacy/public API used by the WordPress plugin and dashboard: `generate-alt-text`, `get-usage`, `get-plans`, `auth-validate`, `track-event`, lifecycle/funnel automation.
- `wordpress-plugin/alt-text-pro/`: WordPress plugin source.
- `wordpress-plugin/build-plugin.sh`: builds plugin ZIP and copies it to `frontend-next/public/wordpress-plugin/` and `frontend-next/public/downloads/`.
- `supabase/migrations/`: active Supabase migration history.
- `supabase-migration/`: older/manual migration scripts and runner.

## High-Token Folders To Avoid By Default

Do not scan these broadly unless needed:

- `node_modules/`, `frontend-next/node_modules/`, `netlify-functions/node_modules/`
- `frontend-next/.next/`, `.netlify/`, `.next/`
- `backups/`, `legacy/`, `venv/`, `netlify-functions-built/`
- old reports: `PRE_LIVE_TEST_REPORT.md`, `PRODUCTION_READINESS*.md`, `PROJECT_REVIEW_REPORT.md`

Use narrow searches:

```bash
rg -n "pattern" frontend-next/src netlify-functions wordpress-plugin/alt-text-pro supabase supabase-migration \
  --glob '!**/node_modules/**' --glob '!frontend-next/.next/**'
```

## Common Commands

Bundled Node path used in this Codex environment:

```bash
export PATH="/Users/aamirfaiz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

Frontend tests:

```bash
cd frontend-next && ./node_modules/.bin/next build
./frontend-next/node_modules/.bin/vitest run frontend-next/src
```

Function tests:

```bash
./netlify-functions/node_modules/.bin/vitest run netlify-functions/utils netlify-functions-tests
```

Syntax checks:

```bash
node --check wordpress-plugin/alt-text-pro/assets/js/admin.js
find netlify-functions -name '*.js' -not -path '*/node_modules/*' -print0 | xargs -0 -n 1 node --check
php -l wordpress-plugin/alt-text-pro/alt-text-pro.php
```

Build plugin ZIP:

```bash
cd wordpress-plugin && ./build-plugin.sh
```

Netlify:

```bash
npm run netlify -- status
npm run netlify -- watch
```

## Release Workflow

Website deploy:

1. Commit changes.
2. Push feature branch.
3. Fast-forward `main` only when ready: `git push origin phase0-refactor-app-structure:main`.
4. Netlify production builds from `main`.
5. Verify live:
   - `https://www.alt-text.pro/`
   - `https://www.alt-text.pro/api/health`
   - `https://www.alt-text.pro/api/get-plans`
   - `https://www.alt-text.pro/wordpress-plugin/alt-text-pro-plugin.zip`
   - `https://www.alt-text.pro/downloads/alt-text-pro.zip`

WordPress.org plugin release:

1. Verify local `Version:` in `wordpress-plugin/alt-text-pro/alt-text-pro.php`.
2. Verify local `Stable tag:` in `wordpress-plugin/alt-text-pro/readme.txt`.
3. Build ZIP.
4. In SVN, run `svn update`.
5. Preflight remote tag absence: `svn ls https://plugins.svn.wordpress.org/alt-text-pro/tags/<version>/`.
6. Commit trunk and tag.
7. Verify with `svn cat` for both trunk and tag PHP/readme files.

## Known Production State

As of 2026-06-26:

- Production Netlify deploy is live through commit `6e7b20b`.
- Local working tree prepares plugin `1.4.97` bulk credit-cancellation fixes but still needs commit/push/deploy/SVN release.
- WordPress.org latest confirmed release before this fix was `1.4.95`.
- Supabase project ref used locally: `qurbdtzrngzfzevgoolp`.

Always refresh with:

```bash
git status --short --branch
git log --oneline --decorate -5
```

## Recent Credit-Usage Finding

User reported one manual generation consuming two credits and cancelled bulk consuming more credits than expected. Diagnosis:

- Manual generation double-charged because `admin.js` initialized handlers twice.
- Bulk start processed the first batch synchronously before the browser received a cancellable `process_id`.
- Fix prepared in commit `2b4c414`: single admin init, cancellable bulk start, 1-second status polling, final batch completion state, plugin version `1.4.96`.
- Follow-up local fix: plugin `1.4.97` forces one billable image per bulk request, delays/cancels next-batch scheduling in the browser, and preserves `cancelled` server-side so an already-open batch cannot flip the job back to running.

## Safety Rules

- Never print `.env*` values or tokens.
- Treat live WordPress/Supabase/Netlify/WordPress.org changes as mutation; do read-only preflight first, then get scoped approval.
- For Supabase schema changes, use MCP `execute_sql` for inspection/iteration and migration files for committed DDL.
- Do not re-release a WordPress.org tag without checking remote tag existence.
- Every WordPress plugin update must increase the public plugin version by `0.0.1` (for example, `1.7.0` becomes `1.7.1`) and keep the plugin header, version constant, readme stable tag, and changelog aligned.

## Customer Promotion Requirements

- Promotional credit claims must require an authenticated account with a confirmed invited email address.
- Recipient eligibility must not expose or commit readable customer email addresses; use normalized cryptographic hashes.
- Each campaign recipient and authenticated account may claim at most once.
- Credit awards must be atomic, auditable, and performed in the database rather than through a client-controlled profile update.
- One-time promotional credits must remain usable after the normal monthly allowance is exhausted and must survive free-plan renewals.
- Public campaign pages must not be indexed and must not reuse the WordPress plugin `/connect` route.
