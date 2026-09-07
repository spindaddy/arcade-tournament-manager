#!/bin/bash
# Clears Gatekeeper quarantine and opens Arcade Tournament Manager.
# Drag the app to Applications first, then double-click this file.
set -euo pipefail

APP="/Applications/Arcade Tournament Manager.app"

if [ ! -d "$APP" ]; then
  osascript -e 'display dialog "Drag Arcade Tournament Manager into your Applications folder first, then run this again." with title "Arcade Tournament Manager" buttons {"OK"} default button 1'
  exit 1
fi

xattr -dr com.apple.quarantine "$APP" 2>/dev/null || xattr -cr "$APP" || true
codesign --force --deep --sign - --timestamp=none "$APP" 2>/dev/null || true
open "$APP"
