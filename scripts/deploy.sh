#!/usr/bin/env bash
# Build the React site and publish dist/ to the egytronic Pages project.
# Needs CLOUDFLARE_API_TOKEN with Account > Cloudflare Pages > Edit.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/gen-copy.py
python3 scripts/gen-en.py
npm run build

CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-708d1cc2fd5a22a9e495dfe415c9f921}" \
  npx --yes wrangler@3 pages deploy dist \
  --project-name egytronic --branch main --commit-dirty=true
