#!/usr/bin/env bash
# Launches the demo build on a simulator and captures each screen in light, dark and AX3 (accessibility
# extra large). Screens are "name:arg,arg" pairs (comma-separated launch arguments); the app reads -demo,
# -tab and -open workout|exercise.
#   scripts/screenshots.sh <path/to/Lift.app> <out dir>
set -euo pipefail
APP="$1"
OUT="$2"
SCREENS="${SCREENS:-week:-tab,week workout:-open,workout history:-tab,history import:-tab,history,-open,import exercises:-tab,exercises exercise:-tab,exercises,-open,exercise catalog:-tab,exercises,-open,catalog settings:-tab,settings}"
mkdir -p "$OUT"
UDID="${SIM_UDID:-$("$(dirname "$0")/simulator.sh")}"
BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl install "$UDID" "$APP"
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 || true

# Warm-up launch: a fresh simulator shows first-boot notices (for example Apple Intelligence) for a few seconds.
xcrun simctl launch "$UDID" "$BUNDLE" -demo >/dev/null
sleep 20
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true

shoot() { # variant appearance content-size
  xcrun simctl ui "$UDID" appearance "$2"
  xcrun simctl ui "$UDID" content_size "$3"
  local entry name args
  for entry in $SCREENS; do
    name="${entry%%:*}"
    args="${entry#*:}"
    xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
    # shellcheck disable=SC2086 # args are space-separated launch arguments
    xcrun simctl launch "$UDID" "$BUNDLE" -demo ${args//,/ } >/dev/null
    sleep 5
    xcrun simctl io "$UDID" screenshot "$OUT/$name-$1.png" >/dev/null
    echo "captured $name-$1"
  done
}

shoot light light large
shoot dark dark large
shoot ax3 light accessibility-extra-large
