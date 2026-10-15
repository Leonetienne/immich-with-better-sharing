#!/usr/bin/env bash
# Builds the immich-server image (API + web UI) and pushes it to the private registry.
# Usage: ./build-and-push.sh [--no-push]
set -euo pipefail

REGISTRY="${REGISTRY:-100.103.170.104:5000}"
IMAGE="${REGISTRY}/immich-server"
PLATFORM="${PLATFORM:-linux/amd64}"

cd "$(dirname "$0")"

COMMIT="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
REF="$(git rev-parse --abbrev-ref HEAD)"
# immich version plus our revision from server/package.json, e.g. v3.3.3.0
VERSION="$(python3 -c 'import json; p = json.load(open("server/package.json")); print("v%s.%s" % (p["version"], p.get("forkRevision", 0)))')"
OUTPUT="--push"
if [[ "${1:-}" == "--no-push" ]]; then
  OUTPUT="--load"
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Working tree has uncommitted changes, image tag ${SHORT} will not match its contents" >&2
fi

docker buildx build \
  --platform "$PLATFORM" \
  -f server/Dockerfile \
  --build-arg BUILD_ID="$SHORT" \
  --build-arg BUILD_IMAGE="${IMAGE}:${VERSION}" \
  --build-arg BUILD_SOURCE_REF="$REF" \
  --build-arg BUILD_SOURCE_COMMIT="$COMMIT" \
  -t "${IMAGE}:latest" \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:${SHORT}" \
  $OUTPUT \
  .
