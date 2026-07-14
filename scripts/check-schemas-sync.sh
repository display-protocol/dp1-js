#!/usr/bin/env bash
# Fail when embedded schemas drift from display-protocol/dp1-go.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${DP1_GO_REPO:-display-protocol/dp1-go}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

compare() {
  local remote_path="$1"
  local local_path="$2"
  gh api "repos/${REPO}/contents/${remote_path}" --jq '.content' | base64 -d >"${TMP}/upstream.json"
  if ! diff -q "${TMP}/upstream.json" "${ROOT}/${local_path}" >/dev/null; then
    echo "schema drift: ${local_path} differs from ${REPO}/${remote_path}" >&2
    diff -u "${TMP}/upstream.json" "${ROOT}/${local_path}" >&2 || true
    exit 1
  fi
  echo "ok ${local_path}"
}

compare internal/schema/core/v1.1.0/playlist.json src/schema/core/playlist.json
compare internal/schema/core/v1.1.0/playlist-group.json src/schema/core/playlist-group.json
compare internal/schema/core/v1.1.0/ref-manifest.json src/schema/core/ref-manifest.json
compare internal/schema/extensions/channels/schema.json src/schema/extensions/channels/schema.json
compare internal/schema/extensions/playlists/schema.json src/schema/extensions/playlists/schema.json
compare internal/schema/extensions/playlists/playlist_with_extension.json src/schema/extensions/playlists/playlist_with_extension.json
compare internal/schema/extensions/playlists/bundles/playlist-core-v1.1.0.json src/schema/extensions/playlists/bundles/playlist-core-v1.1.0.json

echo "All embedded schemas match ${REPO}."
