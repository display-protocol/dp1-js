#!/usr/bin/env bash
# Usage: check-schema-sync.sh <dp1-checkout> [--write]
#
# Fails when the schemas embedded under src/schema/ are not byte copies of the DP-1 spec
# repository (display-protocol/dp1) at the commit pinned in src/schema/dp1-commit.txt.
# --write copies the pinned upstream files over the embedded ones instead of failing; the
# TypeScript types, builders, merge rules and tests the new schemas imply stay a hand-written
# port.
#
# Why byte copies and a pin: the copy is hand-maintained, and dp1-js sat four spec changes
# behind upstream (dp1#52, #55, #56 and the Entity consolidation) without anything failing, so
# documents the spec accepts were rejected here. The pin makes "which spec does this SDK
# implement" a single line; moving it without syncing turns the build red instead of letting the
# drift ship. dp1-go pins the same way (internal/schema/dp1-commit.txt), so the two SDKs can be
# compared by one line each.
#
# The upstream set is every JSON Schema (an object with "$schema" and "$id") under core/ and
# extensions/ at the pin, examples excluded. A new upstream schema therefore fails the check
# until it is embedded and ported.
set -euo pipefail
cd "$(dirname "$0")/.."

dp1="${1:?usage: check-schema-sync.sh <dp1-checkout> [--write]}"
mode="${2:-check}"
[[ "$mode" == "check" || "$mode" == "--write" ]] || {
  echo "unknown option: $mode"
  exit 2
}
pin=$(tr -d '[:space:]' <src/schema/dp1-commit.txt)
git -C "$dp1" cat-file -e "${pin}^{commit}" 2>/dev/null || {
  echo "dp1 checkout at $dp1 does not have the pinned commit $pin; fetch it first"
  exit 2
}

# Embedded files with no upstream counterpart, each with the reason it stays. The spec removed
# playlist-group in dp1#41; every Playlist-Group export here is deprecated and scheduled for
# removal in the next major, which is its own breaking change rather than part of a schema sync.
local_only=(core/playlist-group.json)

# Upstream keeps core schemas under core/<version>/schemas/; this package embeds them one level
# up, without the version segment.
embedded_path() { sed -E 's#^core/[^/]+/schemas/#core/#' <<<"$1"; }

# mapped accumulates one embedded path per line. A newline-delimited string rather than an
# associative array: macOS ships bash 3.2, where `declare -A` does not exist, and this script is
# meant to run locally as well as in CI.
status=0
mapped=""
blob=$(mktemp)
trap 'rm -f "$blob"' EXIT
while read -r up; do
  # A failed read is an error, never "not a schema": skipping it would let a new upstream schema
  # go unchecked, since nothing local exists for the extra-file scan below to flag.
  git -C "$dp1" show "$pin:$up" >"$blob" || {
    echo "cannot read dp1 $pin:$up"
    exit 2
  }
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(d&&typeof d==="object"&&!Array.isArray(d)&&"$schema" in d&&"$id" in d?0:1)' "$blob" 2>/dev/null || continue
  local_path="$(embedded_path "$up")"
  mapped="${mapped}${local_path}
"
  dst="src/schema/$local_path"
  if [[ -f "$dst" ]] && cmp -s "$blob" "$dst"; then
    continue
  fi
  if [[ "$mode" == "--write" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$blob" "$dst"
    echo "wrote   $dst  <- dp1 $up"
  else
    [[ -f "$dst" ]] && echo "differs $dst  (dp1 $up)" || echo "missing $dst  (dp1 $up)"
    status=1
  fi
done < <(git -C "$dp1" ls-tree -r --name-only "$pin" -- core extensions | grep -E '\.json$' | grep -v '/examples/')

while read -r f; do
  rel="${f#src/schema/}"
  printf '%s' "$mapped" | grep -qxF "$rel" && continue
  printf '%s\n' "${local_only[@]}" | grep -qxF "$rel" && continue
  echo "extra   $f  (no schema at this path in dp1 $pin; delete it or list it in local_only)"
  status=1
done < <(find src/schema/core src/schema/extensions -name '*.json' | sort)

if [[ $status -ne 0 ]]; then
  echo "embedded schemas are out of sync with dp1 $pin; run: scripts/check-schema-sync.sh <dp1-checkout> --write"
  exit 1
fi
echo "embedded schemas match dp1 $pin"
