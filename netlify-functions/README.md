# Alt Text Pro Netlify Functions

This directory contains the serverless API used by the WordPress plugin and the SaaS application. Netlify exposes each file under `/.netlify/functions/<name>` and rewrites `/api/*` to the same functions.

## WordPress API endpoints

### Generate alt text

- Endpoint: `POST /.netlify/functions/generate-alt-text`
- Authentication: `Authorization: Bearer <API_KEY>`
- Body: `{ "image_base64": "...", "context": "optional page or image context" }`
- Billing: one credit is finalized only after a usable generation succeeds; failed reservations are released.

Example success shape:

```json
{
  "alt_text": "A person reviewing product photos in the WordPress media library.",
  "credits_used": 1,
  "credits_remaining": 149,
  "total_processed": 1
}
```

### Usage

- Endpoint: `GET /.netlify/functions/get-usage`
- Authentication: `Authorization: Bearer <API_KEY>`
- Returns the current plan, total and monthly allowance state, purchased/promotional ledgers, and recent usage needed by the plugin.

### Validate an API key

- Endpoint: `POST /.netlify/functions/auth-validate`
- Authentication: `Authorization: Bearer <API_KEY>`
- Returns `valid: true` and the minimum account/plan fields needed by the connection UI.

API keys use the current `alt_...` format; legacy `altai_...` keys remain accepted while stored records are migrated to hashed and encrypted-at-rest representations.

## Current public catalogue

| Plan | Monthly price | Monthly allowance |
|---|---:|---:|
| Free | $0 | 15, plus 150 signup credits |
| Lite | $4 | 150 |
| Standard | $9 | 1,000 |
| Pro | $14 | 2,000 |
| Agency | $19 | 3,500 |

Annual subscriptions use the same monthly allowance on a monthly drip. One-time packs provide 500 credits for $5 or 1,200 credits for $10 and are kept in a persistent purchased-credit ledger.

The database catalogue is the API source of truth. UI-facing catalogue copy is centralized in `frontend-next/src/lib/pricing-catalog.ts`.

## Security and operations

- API-key validation uses the stored hash and supports ciphertext-backed legacy migration.
- Generation uses reservation/finalization RPCs to prevent spending races.
- Distributed rate limiting uses Upstash Redis when configured and a process-local fallback otherwise.
- CORS allows the production site, configured local origins, and exact Netlify deploy-preview hostnames.
- Public health checks expose liveness only. Database, AI, and full checks require `X-Health-Check-Secret`.
- Error and audit console logs omit API keys, email addresses, user IDs, IP addresses, provider payloads, and generated content.

Required secrets belong in Netlify environment variables; never commit them to this repository.

## WordPress AJAX actions

The plugin registers these authenticated admin actions:

- `alt_text_pro_generate`
- `alt_text_pro_regenerate`
- `alt_text_pro_generate_post`
- `alt_text_pro_bulk_start`
- `alt_text_pro_bulk_status`
- `alt_text_pro_bulk_process_batch`
- `alt_text_pro_bulk_skip_failed_image`
- `alt_text_pro_bulk_cancel`
- `alt_text_pro_get_usage`
- `alt_text_pro_validate_key`
- `alt_text_pro_test_connection`
- `alt_text_pro_reset_settings`

All mutating actions require a WordPress nonce and capability checks. Media mutations additionally require `edit_post` for the target attachment or post, and bulk jobs are bound to the user who created them.

## Verification

From the project root with the bundled Node runtime on `PATH`:

```bash
./netlify-functions/node_modules/.bin/vitest run netlify-functions/utils netlify-functions-tests netlify-functions/*.test.js
find netlify-functions -name '*.js' -not -path '*/node_modules/*' -print0 | xargs -0 -n 1 node --check
```
