#!/usr/bin/env bash
# CI's simulator, booted from a cached snapshot when there is one. A first boot of a new simulator spends
# minutes setting up its data and keeps the machine busy for minutes more; booting a copy of a simulator's
# data that has booted before skips most of that.
#   scripts/ci-simulator.sh pick   picks the iPhone simulator (scripts/simulator.sh) and writes SIM_UDID and
#                                  SIM_CACHE_KEY (image, runtime, device type) to GITHUB_ENV
#   scripts/ci-simulator.sh boot   moves a restored snapshot (~/sim-data) in as the simulator's data if there is
#                                  one, then boots it and launches Settings once, in the background;
#                                  $RUNNER_TEMP/booted appears when that is done (`ready` waits for it)
#   scripts/ci-simulator.sh ready  waits for the background boot and prints how long it took
#   scripts/ci-simulator.sh pack   shuts the simulator down and moves its data to ~/sim-data, for actions/cache
set -euo pipefail
SNAPSHOT="$HOME/sim-data"
case "$1" in
  pick)
    udid="$("$(dirname "$0")/simulator.sh")"
    device="$(xcrun simctl list devices -j | python3 -c '
import json, sys
udid = sys.argv[1]
for runtime, items in json.load(sys.stdin)["devices"].items():
    for d in items:
        if d["udid"] == udid:
            print(runtime.split(".")[-1] + "-" + d["deviceTypeIdentifier"].split(".")[-1])
' "$udid")"
    {
      echo "SIM_UDID=$udid"
      echo "SIM_CACHE_KEY=sim-${ImageOS:-macos}-${ImageVersion:-0}-$device-v1"
    } >>"$GITHUB_ENV"
    ;;
  boot)
    data="$HOME/Library/Developer/CoreSimulator/Devices/$SIM_UDID/data"
    if [ -d "$SNAPSHOT" ]; then
      rm -rf "$data"
      mv "$SNAPSHOT" "$data"
      echo "booting from the cached snapshot"
    fi
    xcrun simctl boot "$SIM_UDID" >/dev/null 2>&1 &
    (
      start=$SECONDS
      xcrun simctl bootstatus "$SIM_UDID" -b >/dev/null 2>&1
      booted=$SECONDS
      # One launch of a built-in app while the job waits for the build: the first app launch after a boot can
      # take minutes, and the app under test should not be the one that pays for it.
      xcrun simctl launch "$SIM_UDID" com.apple.Preferences >/dev/null 2>&1 || true
      xcrun simctl terminate "$SIM_UDID" com.apple.Preferences >/dev/null 2>&1 || true
      echo "simulator booted after $((booted - start)) s, warmed up after $((SECONDS - start)) s," \
        "at $(date -u +%T)" >"$RUNNER_TEMP/booted.tmp"
      mv "$RUNNER_TEMP/booted.tmp" "$RUNNER_TEMP/booted"
    ) >/dev/null 2>&1 &
    ;;
  ready)
    for ((i = 0; i < 600; i++)); do
      [ -f "$RUNNER_TEMP/booted" ] && break
      sleep 1
    done
    cat "$RUNNER_TEMP/booted" 2>/dev/null || xcrun simctl bootstatus "$SIM_UDID" -b
    ;;
  pack)
    data="$HOME/Library/Developer/CoreSimulator/Devices/$SIM_UDID/data"
    xcrun simctl shutdown "$SIM_UDID" 2>/dev/null || true
    rm -rf "$data/Library/Logs" "$data/var/db/diagnostics" "$data/var/db/uuidtext" "$data/tmp"
    du -sh "$data"
    mv "$data" "$SNAPSHOT"
    ;;
  *) echo "usage: $0 pick|boot|ready|pack" >&2 && exit 2 ;;
esac
