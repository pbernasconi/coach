#!/usr/bin/env bash
# CI's simulator, booted from a cached snapshot when there is one. A first boot of a new simulator spends
# minutes setting up its data and keeps the machine busy for minutes more; booting a copy of a simulator's
# data that has booted before skips most of that.
#   scripts/ci-simulator.sh pick   picks the iPhone simulator (scripts/simulator.sh) and writes SIM_UDID and
#                                  SIM_CACHE_KEY (image, runtime, device type) to GITHUB_ENV
#   scripts/ci-simulator.sh boot   moves a restored snapshot (~/sim-data) in as the simulator's data if there is
#                                  one, then boots it in the background; `bootstatus` later waits for it, and
#                                  $RUNNER_TEMP/booted records how long it took
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
      echo "simulator booted after $((SECONDS - start)) s, at $(date -u +%T)" >"$RUNNER_TEMP/booted"
    ) >/dev/null 2>&1 &
    ;;
  pack)
    data="$HOME/Library/Developer/CoreSimulator/Devices/$SIM_UDID/data"
    xcrun simctl shutdown "$SIM_UDID" 2>/dev/null || true
    rm -rf "$data/Library/Logs" "$data/var/db/diagnostics" "$data/var/db/uuidtext" "$data/tmp"
    du -sh "$data"
    mv "$data" "$SNAPSHOT"
    ;;
  *) echo "usage: $0 pick|boot|pack" >&2 && exit 2 ;;
esac
