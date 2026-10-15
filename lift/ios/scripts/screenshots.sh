#!/usr/bin/env bash
# Launches the demo build on a simulator and captures each screen in light, dark and AX3 (accessibility
# extra large). Screens are "name:arg,arg" pairs (comma-separated launch arguments); the app reads -demo,
# -tab and -open workout|exercise|catalog|import.
#   scripts/screenshots.sh <path/to/Lift.app> <out dir>
# Instead of fixed sleeps, each capture waits until the screen settles: it polls `simctl io screenshot` until
# SETTLE_FRAMES frames in a row are identical (at most SETTLE_MAX polls, so an animated GIF cannot stall it).
# Frames under MIN_BYTES never count: the blank launch screen compresses to about 75 KB, and real screens are
# 200 KB and up.
set -euo pipefail
APP="$1"
OUT="$2"
SCREENS="${SCREENS:-week:-tab,week workout:-open,workout history:-tab,history import:-tab,history,-open,import exercises:-tab,exercises exercise:-tab,exercises,-open,exercise catalog:-tab,exercises,-open,catalog settings:-tab,settings}"
SETTLE_FRAMES="${SETTLE_FRAMES:-2}"
SETTLE_MAX="${SETTLE_MAX:-6}"
MIN_BYTES="${MIN_BYTES:-120000}"
mkdir -p "$OUT"
UDID="${SIM_UDID:-$("$(dirname "$0")/simulator.sh")}"
BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl install "$UDID" "$APP"
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 || true

# settle <file>: waits for the screen to stop changing, then keeps the last frame as <file>.
settle() {
  local same=1 polls=0 blank=0
  sleep 0.5
  xcrun simctl io "$UDID" screenshot "$TMP/prev.png" >/dev/null 2>&1
  while ((same < SETTLE_FRAMES && polls < SETTLE_MAX)); do
    sleep 0.25
    xcrun simctl io "$UDID" screenshot "$TMP/next.png" >/dev/null 2>&1
    if (($(wc -c < "$TMP/next.png") < MIN_BYTES)); then
      same=0 # still the launch screen; a blank frame does not stop the wait
      polls=$((polls - 1))
      ((++blank < 60)) || break
    elif cmp -s "$TMP/prev.png" "$TMP/next.png"; then
      same=$((same + 1))
    else
      same=1
    fi
    mv "$TMP/next.png" "$TMP/prev.png"
    polls=$((polls + 1))
  done
  mv "$TMP/prev.png" "$1"
  echo "  $polls polls, $blank blank$( ((same >= SETTLE_FRAMES)) || echo ', still changing')"
}

# Warm-up launch: a fresh simulator shows first-boot notices (for example Apple Intelligence) for a few seconds.
# CI boots the simulator while it builds, so by now they are usually gone; WARMUP adds a minimum wait.
xcrun simctl launch "$UDID" "$BUNDLE" -demo >/dev/null
sleep "${WARMUP:-0}"
settle "$TMP/warmup.png"
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
    settle "$OUT/$name-$1.png"
    echo "captured $name-$1 (${SECONDS}s)"
  done
}

for variant in ${VARIANTS:-light dark ax3}; do
  case "$variant" in
    light) shoot light light large ;;
    dark) shoot dark dark large ;;
    ax3) shoot ax3 light accessibility-extra-large ;;
    *) echo "unknown variant: $variant" >&2 && exit 2 ;;
  esac
done
