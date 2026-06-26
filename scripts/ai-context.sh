#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Git =="
git status --short --branch
echo
git log --oneline --decorate -5

echo
echo "== Plugin Version =="
grep -E "^[[:space:]]*\\* Version:" wordpress-plugin/alt-text-pro/alt-text-pro.php | head -n 1 || true
grep -E "^Stable tag:" wordpress-plugin/alt-text-pro/readme.txt | head -n 1 || true

echo
echo "== Netlify =="
grep -E "^(  command|  publish|  functions|\\[functions)" netlify.toml || true

echo
echo "== Key Paths =="
printf '%s\n' \
  "frontend-next/src" \
  "netlify-functions" \
  "wordpress-plugin/alt-text-pro" \
  "supabase/migrations" \
  "supabase-migration"

echo
echo "== Search Excludes =="
printf "%s\n" "--glob '!node_modules/**' --glob '!frontend-next/node_modules/**' --glob '!netlify-functions/node_modules/**' --glob '!frontend-next/.next/**' --glob '!backups/**' --glob '!legacy/**' --glob '!venv/**'"
