#!/usr/bin/env bash
# CI's simulator, booted from a cached snapshot when there is one. A first boot of a new simulator spends
# minutes setting up its data and keeps the machine busy for minutes more; booting a copy of a simulator's
# data that has booted before skips most of that.
#   scripts/ci-simulator.sh key    writes SIM_CACHE_KEY and SIM_CACHE_PREFIX (the runner image) to GITHUB_ENV and starts
#                                  CoreSimulatorService in the background
#   scripts/ci-simulator.sh boot   picks the iPhone simulator (scripts/simulator.sh; SIM_UDID to GITHUB_ENV),
#                                  moves a restored snapshot (~/sim-data) in as its data if there is one, then
#                                  boots it and launches Settings once, in the background
#   scripts/ci-simulator.sh install <app>  installs the app once the simulator has booted
#   scripts/ci-simulator.sh ready  waits for the background boot (and briefly for the warm-up launch) and prints
#                                  how long they took
#   scripts/ci-simulator.sh pack   shuts the simulator down and moves its data to ~/sim-data, for actions/cache
set -euo pipefail
SNAPSHOT="$HOME/sim-data"

# with_timeout <seconds> <command…>: runs the command, killing it after <seconds>.
with_timeout() {
  local seconds="$1"
  shift
  "$@" &
  local pid=$!
  (sleep "$seconds" && kill "$pid") 2>/dev/null &
  local timer=$!
  local status=0
  wait "$pid" || status=$?
  kill "$timer" 2>/dev/null || true
  return "$status"
}

# wait_booted: waits until the simulator has finished booting. A single `simctl bootstatus` sometimes never
# returns although the simulator booted (a later call answers at once), so each try gets 60 s.
wait_booted() {
  local try
  for ((try = 0; try < 10; try++)); do
    with_timeout 60 xcrun simctl bootstatus "$SIM_UDID" >/dev/null 2>&1 && return 0
  done
  return 1
}
case "$1" in
  key)
    # The snapshot's key: the runner image decides the runtimes and devices, and so the simulator pick below.
    # SIM_CACHE_PREFIX also matches older snapshot keys of the same image.
    prefix="sim-${ImageOS:-macos}-${ImageVersion:-0}-"
    {
      echo "SIM_CACHE_PREFIX=$prefix"
      echo "SIM_CACHE_KEY=${prefix}v2"
    } >>"$GITHUB_ENV"
    # Starts CoreSimulatorService (tens of seconds on a fresh runner) while the snapshot downloads.
    xcrun simctl list devices >/dev/null 2>&1 &
    ;;
  boot)
    SIM_UDID="$("$(dirname "$0")/simulator.sh")"
    echo "SIM_UDID=$SIM_UDID" >>"$GITHUB_ENV"
    data="$HOME/Library/Developer/CoreSimulator/Devices/$SIM_UDID/data"
    if [ -d "$SNAPSHOT" ]; then
      rm -rf "$data"
      mv "$SNAPSHOT" "$data"
      echo "booting from the cached snapshot"
    fi
    xcrun simctl boot "$SIM_UDID" >/dev/null 2>&1 &
    (
      start=$SECONDS
      wait_booted
      echo "simulator booted after $((SECONDS - start)) s, at $(date -u +%T)" >"$RUNNER_TEMP/booted"
      # One launch of a built-in app while the job waits for the build: the first app launch after a boot can
      # take a minute or more, and the app under test should not be the one that pays for it.
      with_timeout 90 xcrun simctl launch "$SIM_UDID" com.apple.Preferences >/dev/null 2>&1 || true
      xcrun simctl terminate "$SIM_UDID" com.apple.Preferences >/dev/null 2>&1 || true
      echo "warm-up launch done after $((SECONDS - start)) s, at $(date -u +%T)" >"$RUNNER_TEMP/warmed"
    ) >/dev/null 2>&1 &
    ;;
  install)
    # Installs the app as soon as the simulator has booted, while the warm-up launch may still run.
    for ((i = 0; i < 600; i++)); do
      [ -f "$RUNNER_TEMP/booted" ] && break
      sleep 1
    done
    [ -f "$RUNNER_TEMP/booted" ] || wait_booted
    xcrun simctl install "$SIM_UDID" "$2"
    echo "installed at $(date -u +%T)"
    ;;
  ready)
    # Waits for the boot (at most 10 minutes, then asks simctl), then up to 60 s more for the warm-up launch.
    for ((i = 0; i < 600; i++)); do
      [ -f "$RUNNER_TEMP/booted" ] && break
      sleep 1
    done
    cat "$RUNNER_TEMP/booted" 2>/dev/null || wait_booted
    for ((i = 0; i < 60; i++)); do
      [ -f "$RUNNER_TEMP/warmed" ] && break
      sleep 1
    done
    cat "$RUNNER_TEMP/warmed" 2>/dev/null || echo "warm-up launch still running"
    ;;
  pack)
    data="$HOME/Library/Developer/CoreSimulator/Devices/$SIM_UDID/data"
    xcrun simctl shutdown "$SIM_UDID" 2>/dev/null || true
    rm -rf "$data/Library/Logs" "$data/var/db/diagnostics" "$data/var/db/uuidtext" "$data/tmp"
    du -sh "$data"
    du -sk "$data"/* "$data"/*/* 2>/dev/null | sort -n | tail -n 15
    mv "$data" "$SNAPSHOT"
    ;;
  *) echo "usage: $0 key|boot|install <app>|ready|pack" >&2 && exit 2 ;;
esac
