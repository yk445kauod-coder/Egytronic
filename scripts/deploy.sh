#!/usr/bin/env bash
# Publish the site to the egytronic Pages project (direct upload, no git link).
# Needs CLOUDFLARE_API_TOKEN with Account > Cloudflare Pages > Edit.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/build-en.py

rm -rf .deploy && mkdir -p .deploy
cp -r index.html 404.html _headers robots.txt sitemap.xml favicon.ico _worker.js assets en pricing software contact .deploy/

CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-708d1cc2fd5a22a9e495dfe415c9f921}" \
  npx --yes wrangler@3 pages deploy .deploy \
  --project-name egytronic --branch main --commit-dirty=true

rm -rf .deploy
