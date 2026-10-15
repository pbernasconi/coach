#!/usr/bin/env bash
# Package tests first (fast, no simulator), then app tests on a dynamically chosen simulator (TOOL-2).
#   scripts/test.sh        unit tests
#   scripts/test.sh --ui   demo-mode UI smoke test (screenshots in build/ui-smoke.xcresult)
set -euo pipefail
cd "$(dirname "$0")/.."
(cd Packages/AppKit && swift test)
if [ "$(uname)" != "Darwin" ]; then echo "Not macOS: skipped simulator tests." >&2; exit 0; fi
scripts/generate.sh
DEVICE="${IOS_TEST_DEVICE:-$(xcrun simctl list devices available | grep -Eo 'iPhone [0-9]+ Pro[^(]*' | head -1 | sed 's/ *$//')}"
SCHEME=App; EXTRA=()
if [ "${1:-}" = "--ui" ]; then SCHEME=AppUITests; rm -rf build/ui-smoke.xcresult; EXTRA=(-resultBundlePath build/ui-smoke.xcresult); fi
xcodebuild test -scheme "$SCHEME" -destination "platform=iOS Simulator,name=$DEVICE" -quiet "${EXTRA[@]}"
