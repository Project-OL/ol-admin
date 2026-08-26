#!/usr/bin/env bash
# Unpack a GitHub Actions Vite dist artifact onto the admin document root.
# Never run `npm run build` here. Never modify nginx config, security groups, or AWS resources.
#
# Layout:
#   APP_DIR=/var/www/admins3jinyu.offoolive.com
#   APP_USER=olapp
set -euo pipefail

APP_USER="${APP_USER:-olapp}"
APP_DIR="${APP_DIR:-/var/www/admins3jinyu.offoolive.com}"
ARTIFACT="${ARTIFACT:-/tmp/admin-artifact.tgz}"

if [ ! -f "$ARTIFACT" ]; then
  echo "missing artifact: $ARTIFACT" >&2
  exit 1
fi

if [ "$(id -un)" != "$APP_USER" ] && [ "$(id -u)" -ne 0 ]; then
  echo "must run as ${APP_USER} or root (root drops privileges after mkdir/chown)" >&2
  exit 1
fi

mkdir -p "$APP_DIR"

if [ "$(id -u)" -eq 0 ]; then
  if ! id "$APP_USER" >/dev/null 2>&1; then
    echo "missing Linux user ${APP_USER}" >&2
    exit 1
  fi
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  chmod a+r "$ARTIFACT"
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

if [ "$(id -u)" -eq 0 ]; then
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

echo "deployed files:"
ls -la "$APP_DIR"
echo "ol-admin deploy complete"
