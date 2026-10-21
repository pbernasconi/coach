#!/usr/bin/env bash
# Captures each screen of an app on a simulator in light, dark and AX3 (accessibility extra large), with a
# clean status bar. The app opens each screen from launch arguments, so no UI script is needed.
#   scripts/ios-screenshots.sh --help
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ios-screenshots.sh [--dry-run] <path/to/App.app> <out dir>

Writes <out dir>/<screen>-<variant>.png for each screen and variant.

Environment:
  SCREENS        screens as "name:arg,arg name:arg" pairs; the args (comma-separated) are launch arguments
                 that open the screen. Default: "home:" (one launch with no extra arguments).
  BASE_ARGS      launch arguments for every screen, separated by spaces (for example "-demo")
  VARIANTS       any of: light dark ax3 (default: all three)
  SIM_UDID       the simulator; default: `ios-run.sh sim udid` (IOS_RUN_SIM_NAME, IOS_RUN_SIM_OS)
  SKIP_INSTALL=1 do not install the app first
  WARMUP_LAUNCH=0  skip the warm-up launch (a fresh simulator shows first-boot notices for a few seconds)
  SETTLE_FRAMES  identical frames in a row that mean the screen settled (default 2)
  SETTLE_MAX     most polls per screen, so an animation cannot stall the run (default 6)
  MIN_BYTES      frames smaller than this are the blank launch screen and never count (default 120000)

A capture does not use fixed sleeps: it polls `simctl io screenshot` until SETTLE_FRAMES frames match.
EOF
}

DRY_RUN=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    -h | --help) usage && exit 0 ;;
    -n | --dry-run) DRY_RUN=1 ;;
    -*) echo "unknown option $arg" >&2 && exit 2 ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
[ "${#POSITIONAL[@]}" -eq 2 ] || {
  usage >&2
  exit 2
}
APP="${POSITIONAL[0]}"
OUT="${POSITIONAL[1]}"
SCREENS="${SCREENS:-home:}"
BASE_ARGS="${BASE_ARGS:-}"
SETTLE_FRAMES="${SETTLE_FRAMES:-2}"
SETTLE_MAX="${SETTLE_MAX:-6}"
MIN_BYTES="${MIN_BYTES:-120000}"
[ -d "$APP" ] || [ "$DRY_RUN" = 1 ] || {
  echo "app not found: $APP" >&2
  exit 1
}
UDID="${SIM_UDID:-$("$(dirname "$0")/ios-run.sh" sim udid)}"
if [ -f "$APP/Info.plist" ]; then
  BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"
else
  BUNDLE="${IOS_RUN_BUNDLE_ID:-BUNDLE_ID}"
fi

# run <command...>: runs a command, or prints it to stderr in a dry run (stderr, because some calls send
# their stdout to /dev/null).
run() {
  if [ "$DRY_RUN" = 1 ]; then
    {
      printf '+'
      printf ' %q' "$@"
      printf '\n'
    } >&2
  else
    "$@"
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
run mkdir -p "$OUT"
run xcrun simctl bootstatus "$UDID" -b >/dev/null
[ "${SKIP_INSTALL:-0}" = 1 ] || run xcrun simctl install "$UDID" "$APP"
run xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 || true

# settle <file>: waits for the screen to stop changing, then keeps the last frame as <file>.
settle() {
  if [ "$DRY_RUN" = 1 ]; then
    echo "+ (poll xcrun simctl io $UDID screenshot until the screen settles) > $1"
    return 0
  fi
  local same=1 polls=0 blank=0
  sleep 0.5
  xcrun simctl io "$UDID" screenshot "$TMP/prev.png" >/dev/null 2>&1
  while ((same < SETTLE_FRAMES && polls < SETTLE_MAX)); do
    sleep 0.25
    xcrun simctl io "$UDID" screenshot "$TMP/next.png" >/dev/null 2>&1
    if (($(wc -c <"$TMP/next.png") < MIN_BYTES)); then
      same=0 # still the launch screen: a blank frame does not end the wait
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

# shellcheck disable=SC2206 # BASE_ARGS is a space-separated list on purpose
base=($BASE_ARGS)

if [ "${WARMUP_LAUNCH:-1}" = 1 ]; then
  run xcrun simctl launch "$UDID" "$BUNDLE" ${base[@]+"${base[@]}"} >/dev/null
  settle "$TMP/warmup.png"
  run xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
fi

shoot() { # <variant> <appearance> <content size>
  run xcrun simctl ui "$UDID" appearance "$2"
  run xcrun simctl ui "$UDID" content_size "$3"
  echo "variant $1: appearance $2, content size $3"
  local entry name args extra start
  for entry in $SCREENS; do
    name="${entry%%:*}"
    args="${entry#*:}"
    # shellcheck disable=SC2206 # comma-separated launch arguments become words
    extra=(${args//,/ })
    start=$SECONDS
    run xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE" \
      ${base[@]+"${base[@]}"} ${extra[@]+"${extra[@]}"} >/dev/null
    settle "$OUT/$name-$1.png"
    echo "captured $name-$1 in $((SECONDS - start)) s"
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
# Put the simulator back to the defaults.
run xcrun simctl ui "$UDID" appearance light
run xcrun simctl ui "$UDID" content_size large
run xcrun simctl status_bar "$UDID" clear || true
