#!/usr/bin/env bash
# Refresh embedded JSON Schema files from display-protocol/dp1-go.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${DP1_GO_REPO:-display-protocol/dp1-go}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

decode_base64() {
  python3 -c 'import base64, sys
data = sys.stdin.read()
sys.stdout.buffer.write(base64.b64decode(data))'
}

fetch() {
  local remote_path="$1"
  local local_path="$2"
  gh api "repos/${REPO}/contents/${remote_path}" --jq '.content' | decode_base64 >"${TMP}/$(basename "$local_path")"
  cp "${TMP}/$(basename "$local_path")" "${ROOT}/${local_path}"
  echo "synced ${local_path}"
}

fetch internal/schema/core/v1.1.0/playlist.json src/schema/core/playlist.json
fetch internal/schema/core/v1.1.0/playlist-group.json src/schema/core/playlist-group.json
fetch internal/schema/core/v1.1.0/ref-manifest.json src/schema/core/ref-manifest.json
fetch internal/schema/extensions/channels/schema.json src/schema/extensions/channels/schema.json
fetch internal/schema/extensions/playlists/schema.json src/schema/extensions/playlists/schema.json
fetch internal/schema/extensions/playlists/playlist_with_extension.json src/schema/extensions/playlists/playlist_with_extension.json
fetch internal/schema/extensions/playlists/bundles/playlist-core-v1.1.0.json src/schema/extensions/playlists/bundles/playlist-core-v1.1.0.json

echo "Done. Run npm test to verify."
