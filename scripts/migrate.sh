#!/usr/bin/env bash
# Apply the migrations that have not run yet, in filename order.
#
#   scripts/migrate.sh            # apply anything new
#   scripts/migrate.sh --adopt    # adopt a DB built by hand: record every file but the
#                                 # newest as applied, then let the normal run apply it
#   scripts/migrate.sh --baseline # record every file as applied (nothing left to run)
#   D1_FLAGS=--local scripts/migrate.sh   # against the local D1 copy
set -euo pipefail
cd "$(dirname "$0")/.."

D1_FLAGS="${D1_FLAGS:---remote}"
WRANGLER=(npx --yes wrangler@3 d1 execute egytronic-contact "$D1_FLAGS" --json)

sql() { "${WRANGLER[@]}" --command "$1"; }

rows() {
  node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{let j=[];try{j=JSON.parse(s)}catch{}const out=(Array.isArray(j)?j:[j]).flatMap((x)=>x?.results||[]);console.log(out.map((r)=>r.name).join("\n"))})'
}

sql "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))" > /dev/null

if [ "${1:-}" = "--baseline" ] || [ "${1:-}" = "--adopt" ]; then
  if [ "$(sql "SELECT COUNT(*) AS n FROM _migrations" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const r=(Array.isArray(j)?j:[j]).flatMap(x=>x.results||[]);console.log(r[0]?.n ?? 0)})')" != "0" ]; then
    echo "refusing to adopt: _migrations already has rows — run scripts/migrate.sh instead" >&2
    exit 1
  fi
  files=(migrations/*.sql)
  last=$((${#files[@]} - 1))
  for i in "${!files[@]}"; do
    [ "${1:-}" = "--adopt" ] && [ "$i" -eq "$last" ] && continue
    sql "INSERT OR IGNORE INTO _migrations (name) VALUES ('$(basename "${files[$i]}")')" > /dev/null
    echo "baseline  $(basename "${files[$i]}")"
  done
  exit 0
fi

applied="$(sql "SELECT name FROM _migrations" | rows)"
for file in migrations/*.sql; do
  name="$(basename "$file")"
  if printf '%s\n' "$applied" | grep -qx "$name"; then continue; fi
  echo "apply     $name"
  "${WRANGLER[@]}" --file="$file" > /dev/null
  sql "INSERT OR IGNORE INTO _migrations (name) VALUES ('$name')" > /dev/null
done
echo "migrations up to date"
