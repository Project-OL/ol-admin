#!/usr/bin/env bash
# Unpack a GitHub Actions Vite dist artifact onto ol-dev nginx root.
# Never run `npm run build` here.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/admins3jinyu.offoolive.com}"
ARTIFACT="${ARTIFACT:-/tmp/admin-artifact.tgz}"

if [ ! -f "$ARTIFACT" ]; then
  echo "missing artifact: $ARTIFACT" >&2
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "missing nginx root: $APP_DIR" >&2
  exit 1
fi

STAGE="$(mktemp -d /tmp/ol-admin-unpack.XXXXXX)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "extracting $ARTIFACT -> $STAGE"
tar -xzf "$ARTIFACT" -C "$STAGE"

if [ ! -f "$STAGE/index.html" ]; then
  echo "artifact is missing index.html" >&2
  exit 1
fi

echo "replacing $APP_DIR"
find "$APP_DIR" -mindepth 1 -delete
cp -a "$STAGE"/. "$APP_DIR"/

echo "deployed files:"
ls -la "$APP_DIR"
echo "ol-admin deploy complete"
