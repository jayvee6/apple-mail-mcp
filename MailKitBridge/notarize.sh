#!/usr/bin/env bash
# notarize.sh — Build, sign, notarize, staple, and package MailKitBridgeApp
# Usage: ./notarize.sh [version]
# Requires: Xcode, xcrun notarytool credentials stored as "apple-mail-mcp-notary"

set -euo pipefail

VERSION="${1:-1.0}"
SCHEME="MailKitBridgeApp"
IDENTITY="Developer ID Application: Jose Villarreal (ATGGQ68RUK)"
PROFILE="apple-mail-mcp-notary"
DERIVED_DATA=$(xcodebuild -scheme "$SCHEME" -configuration Release \
  -showBuildSettings 2>/dev/null | grep "BUILT_PRODUCTS_DIR" | head -1 | awk '{print $3}')
APP_PATH="$DERIVED_DATA/$SCHEME.app"
ZIP_PATH="/tmp/${SCHEME}.zip"
DMG_PATH="$HOME/Desktop/MailKitBridge-${VERSION}.dmg"

echo "▶ Building Release..."
xcodebuild \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'platform=macOS' \
  CODE_SIGN_IDENTITY="$IDENTITY" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM=ATGGQ68RUK \
  OTHER_CODE_SIGN_FLAGS="--timestamp" \
  CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO \
  clean build | grep -E "(error:|FAILED|SUCCEEDED)"

echo "▶ Zipping for notarization..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "▶ Submitting to Apple notary service..."
xcrun notarytool submit "$ZIP_PATH" \
  --keychain-profile "$PROFILE" \
  --wait

echo "▶ Stapling ticket..."
xcrun stapler staple "$APP_PATH"

echo "▶ Verifying Gatekeeper..."
spctl --assess --type execute "$APP_PATH" && echo "✓ Gatekeeper: PASS"

echo "▶ Creating DMG..."
rm -rf /tmp/dmg-staging && mkdir /tmp/dmg-staging
cp -r "$APP_PATH" /tmp/dmg-staging/
hdiutil create -volname "MailKit Bridge" \
  -srcfolder /tmp/dmg-staging \
  -ov -format UDZO "$DMG_PATH"
rm -rf /tmp/dmg-staging

echo ""
echo "✅ Done: $DMG_PATH"
ls -lh "$DMG_PATH"
