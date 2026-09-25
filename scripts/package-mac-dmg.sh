#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="清算.app"
APP_DIR="$PROJECT_DIR/dist-mac/$APP_NAME"
DMG_PATH="$PROJECT_DIR/dist-mac/清算-macOS.dmg"
STAGING_DIR="$PROJECT_DIR/dist-mac/dmg-staging"

if [[ ! -d "$APP_DIR" ]]; then
  "$PROJECT_DIR/scripts/build-mac-app.sh"
fi

rm -rf "$STAGING_DIR" "$DMG_PATH"
mkdir -p "$STAGING_DIR"
cp -R "$APP_DIR" "$STAGING_DIR/$APP_NAME"
ln -s /Applications "$STAGING_DIR/Applications"

hdiutil create \
  -volname "清算" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

rm -rf "$STAGING_DIR"
echo "已生成：$DMG_PATH"
