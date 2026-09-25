#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
NPM_BIN="${NPM_BIN:-$(command -v npm)}"
APP_NAME="清算.app"
APP_DIR="$PROJECT_DIR/dist-mac/$APP_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
MACOS_DIR="$CONTENTS_DIR/MacOS"

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
  echo "未找到 Node.js/npm，请先安装 Node.js 20 或更高版本。" >&2
  exit 1
fi

cd "$PROJECT_DIR"
"$NPM_BIN" run build

rm -rf "$APP_DIR"
mkdir -p "$RESOURCES_DIR/web" "$MACOS_DIR"
cp -R dist/. "$RESOURCES_DIR/web/"
cp macos/Info.plist "$CONTENTS_DIR/Info.plist"
printf 'APPL????' > "$CONTENTS_DIR/PkgInfo"

# The app uses a custom qingsuan:// resource protocol. Use a classic script
# tag because this works consistently in WebKit desktop wrappers.
perl -0pi -e 's/<script type="module" crossorigin src="/<script defer src="/g; s/ crossorigin href="/ href="/g' "$RESOURCES_DIR/web/index.html"

BUILD_DIR="$PROJECT_DIR/.build-mac"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

compile_arch() {
  local arch="$1"
  swiftc \
    -target "${arch}-apple-macosx11.0" \
    -O \
    -framework Cocoa \
    -framework WebKit \
    macos/QingSuanApp.swift \
    -o "$BUILD_DIR/QingSuan-$arch"
}

# Produce a Universal binary so the same DMG works on Apple Silicon and Intel Macs.
compile_arch arm64
compile_arch x86_64
lipo -create "$BUILD_DIR/QingSuan-arm64" "$BUILD_DIR/QingSuan-x86_64" -output "$MACOS_DIR/QingSuan"
rm -rf "$BUILD_DIR"

chmod +x "$MACOS_DIR/QingSuan"

# Ad-hoc signing makes the locally built bundle behave like a normal macOS app.
# It is intentionally not a Developer ID signature, so distribution outside this
# computer may still show the standard first-open security prompt.
codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "已生成：$APP_DIR"
