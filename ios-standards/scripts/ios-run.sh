#!/usr/bin/env bash
# ios-run: one entry point to build, install, launch and inspect an iOS app on a simulator or on a paired
# device (USB or Wi-Fi), and to check the machine. Every project value comes from a flag, an environment
# variable or a .ios-run.env file, so the script works in any app repo. RUNNING.md has the full guide.
#   scripts/ios-run.sh --help
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ios-run.sh [options] <command> [args] [-- app arguments]

Simulator:
  sim list                List the available iPhone simulators (OS, state, name, UDID), newest OS first.
  sim udid                Print the UDID of the chosen simulator.
  sim boot                Boot the chosen simulator and wait until it is ready.
  sim open                Open the simulator window (DeviceHub on Xcode 27 and later, else Simulator.app).
  sim build               Regenerate the project (XcodeGen), then build for the chosen simulator.
  sim install [app]       Install the built app, or the given .app.
  sim launch              Launch the app. Arguments after -- go to the app.
  sim run                 boot + build + install + launch. --no-build skips the build; --open opens the window.
  sim screenshot [file]   Save a PNG of the screen (default: ./screenshot-<time>.png).
  sim statusbar [clear]   Set a clean status bar (9:41, full battery and signal), or clear it.
  sim openurl <url>       Open a URL. A custom scheme shows an "Open in ...?" prompt that needs a tap.
  sim log                 Stream the unified log of the app process.
  sim record <file.mp4>   Record the screen until Ctrl-C.
  sim reset               Uninstall the app, so the next launch starts with no data.
  sim erase --yes         Shut down and erase the simulator (every app and all data).

Device (USB or Wi-Fi):
  device list             List devices with their pairing, tunnel, transport and Developer Mode state.
  device build            Build for the chosen device with automatic signing.
  device install [app]    Install the built app, or the given .app.
  device launch           Launch the app. Arguments after -- go to the app.
  device run              build + install + launch. --no-build skips the build.

Other:
  doctor                  Check Xcode, XcodeGen, simulators, devices, signing identities and disk space.
                          --no-devices skips the device check.
  config                  Print the resolved configuration.

Options (a flag wins over the environment; the environment wins over the config file):
  --config <file>              IOS_RUN_CONFIG        default: nearest .ios-run.env from here upward
  --project <x.xcodeproj>      IOS_RUN_PROJECT       default: xcodebuild finds it in the config folder
  --workspace <x.xcworkspace>  IOS_RUN_WORKSPACE
  --scheme <name>              IOS_RUN_SCHEME        required to build
  --configuration <name>       IOS_RUN_CONFIGURATION default: Debug
  --device-configuration <n>   IOS_RUN_DEVICE_CONFIGURATION  default: the configuration above
  --spec <project.yml>         IOS_RUN_SPEC          XcodeGen spec; default: project.yml in the config folder
  --product <name>             IOS_RUN_PRODUCT       the .app name when a build makes more than one
  --bundle-id <id>             IOS_RUN_BUNDLE_ID     default: read from the built app
  --team <id>                  IOS_RUN_TEAM_ID       DEVELOPMENT_TEAM for device builds
  --sim <name>                 IOS_RUN_SIM_NAME      exact simulator name, for example "iPhone 17"
  --os <version>               IOS_RUN_SIM_OS        exact iOS version, for example 26.4
  --udid <udid>                IOS_RUN_SIM_UDID      use this simulator; skips the name and OS lookup
  --device <name|udid>         IOS_RUN_DEVICE        default: the first available paired iPhone
  --derived-data <dir>         IOS_RUN_DERIVED_DATA  default: $TMPDIR/ios-run/<checkout>-<hash>/dd
  --jobs <n>                   IOS_RUN_JOBS          cap the parallel jobs of xcodebuild
  --no-generate                IOS_RUN_NO_GENERATE=1 do not run XcodeGen before a build
  -n, --dry-run                Print the commands that change state; do not run them.
  -h, --help                   Show this help.

More environment variables:
  IOS_RUN_LAUNCH_ARGS   arguments for every launch, separated by spaces (for example "-demo")
  IOS_RUN_LAUNCH_ENV    environment for every launch: "KEY=VALUE KEY=VALUE" (for example API_BASE_URL=...)
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH   App Store Connect API key for automatic signing without an
                        Apple ID in Xcode. ASC_KEY_PATH default: ~/.appstoreconnect/private_keys/AuthKey_<id>.p8
EOF
}

log() { printf '[ios-run] %s\n' "$*" >&2; }
die() {
  printf '[ios-run] error: %s\n' "$*" >&2
  exit 1
}

# ---------------------------------------------------------------------------------------------------------
# Options. Flags are read first, because --config decides which file loads.
DRY_RUN=0 NO_BUILD=0 OPEN=0 YES=0 NO_DEVICES=0
opt_config="" opt_project="" opt_workspace="" opt_scheme="" opt_configuration="" opt_device_configuration=""
opt_spec="" opt_product="" opt_bundle_id="" opt_team="" opt_sim="" opt_os="" opt_udid="" opt_device=""
opt_derived="" opt_jobs="" opt_no_generate=""
POSITIONAL=()
APP_ARGS=()

# abs_from <base> <path>: an absolute path; ~/ means $HOME.
abs_from() {
  case "$2" in
    "") echo "" ;;
    /*) echo "$2" ;;
    \~/*) echo "$HOME/${2#??}" ;;
    *) echo "$1/$2" ;;
  esac
}

need_value() { [ "$#" -ge 2 ] && [ -n "$2" ] || die "$1 needs a value"; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help) usage && exit 0 ;;
    -n | --dry-run) DRY_RUN=1 ;;
    --no-build) NO_BUILD=1 ;;
    --open) OPEN=1 ;;
    --yes) YES=1 ;;
    --no-devices) NO_DEVICES=1 ;;
    --no-generate) opt_no_generate=1 ;;
    --config) need_value "$@" && opt_config="$(abs_from "$PWD" "$2")" && shift ;;
    --project) need_value "$@" && opt_project="$(abs_from "$PWD" "$2")" && shift ;;
    --workspace) need_value "$@" && opt_workspace="$(abs_from "$PWD" "$2")" && shift ;;
    --spec) need_value "$@" && opt_spec="$(abs_from "$PWD" "$2")" && shift ;;
    --derived-data) need_value "$@" && opt_derived="$(abs_from "$PWD" "$2")" && shift ;;
    --scheme) need_value "$@" && opt_scheme="$2" && shift ;;
    --configuration) need_value "$@" && opt_configuration="$2" && shift ;;
    --device-configuration) need_value "$@" && opt_device_configuration="$2" && shift ;;
    --product) need_value "$@" && opt_product="$2" && shift ;;
    --bundle-id) need_value "$@" && opt_bundle_id="$2" && shift ;;
    --team) need_value "$@" && opt_team="$2" && shift ;;
    --sim) need_value "$@" && opt_sim="$2" && shift ;;
    --os) need_value "$@" && opt_os="$2" && shift ;;
    --udid) need_value "$@" && opt_udid="$2" && shift ;;
    --device) need_value "$@" && opt_device="$2" && shift ;;
    --jobs) need_value "$@" && opt_jobs="$2" && shift ;;
    --)
      shift
      APP_ARGS=("$@")
      break
      ;;
    -*) die "unknown option $1 (see --help)" ;;
    *) POSITIONAL+=("$1") ;;
  esac
  shift
done

# ---------------------------------------------------------------------------------------------------------
# Configuration file: KEY=VALUE lines, IOS_RUN_* keys only. It is read as data, never sourced, and a variable
# that the environment already sets wins.
find_config() {
  local dir="$PWD"
  while :; do
    if [ -f "$dir/.ios-run.env" ]; then
      echo "$dir/.ios-run.env"
      return 0
    fi
    [ "$dir" = / ] && return 1
    dir="$(dirname "$dir")"
  done
}

load_config() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in '' | '#'*) continue ;; esac
    line="${line#export }"
    key="${line%%=*}"
    value="${line#*=}"
    if [[ ! "$key" =~ ^IOS_RUN_[A-Z0-9_]+$ ]] || [ "$key" = "$line" ]; then
      log "ignored a line in $file: only IOS_RUN_*=value lines count"
      continue
    fi
    case "$value" in
      \"*\" | \'*\') value="${value:1:${#value}-2}" ;;
      *)
        # An unquoted value ends at " #" (a trailing comment) and loses trailing spaces.
        value="${value%%[[:space:]]#*}"
        value="${value%"${value##*[![:space:]]}"}"
        ;;
    esac
    [ -n "${!key+x}" ] && continue
    export "$key=$value"
  done <"$file"
}

CONFIG_FILE="${opt_config:-${IOS_RUN_CONFIG:-}}"
if [ -z "$CONFIG_FILE" ]; then CONFIG_FILE="$(find_config || true)"; fi
if [ -n "$CONFIG_FILE" ]; then
  [ -f "$CONFIG_FILE" ] || die "config file not found: $CONFIG_FILE"
  load_config "$CONFIG_FILE"
  ROOT="$(cd "$(dirname "$CONFIG_FILE")" && pwd)"
else
  ROOT="$PWD"
fi

PROJECT="${opt_project:-$(abs_from "$ROOT" "${IOS_RUN_PROJECT:-}")}"
WORKSPACE="${opt_workspace:-$(abs_from "$ROOT" "${IOS_RUN_WORKSPACE:-}")}"
SCHEME="${opt_scheme:-${IOS_RUN_SCHEME:-}}"
CONFIGURATION="${opt_configuration:-${IOS_RUN_CONFIGURATION:-Debug}}"
DEVICE_CONFIGURATION="${opt_device_configuration:-${IOS_RUN_DEVICE_CONFIGURATION:-$CONFIGURATION}}"
SPEC="${opt_spec:-$(abs_from "$ROOT" "${IOS_RUN_SPEC:-}")}"
if [ -z "$SPEC" ] && [ -f "$ROOT/project.yml" ]; then SPEC="$ROOT/project.yml"; fi
PRODUCT="${opt_product:-${IOS_RUN_PRODUCT:-}}"
BUNDLE_ID="${opt_bundle_id:-${IOS_RUN_BUNDLE_ID:-}}"
TEAM_ID="${opt_team:-${IOS_RUN_TEAM_ID:-}}"
SIM_NAME="${opt_sim:-${IOS_RUN_SIM_NAME:-}}"
SIM_OS="${opt_os:-${IOS_RUN_SIM_OS:-}}"
SIM_UDID="${opt_udid:-${IOS_RUN_SIM_UDID:-}}"
DEVICE="${opt_device:-${IOS_RUN_DEVICE:-}}"
JOBS="${opt_jobs:-${IOS_RUN_JOBS:-}}"
NO_GENERATE="${opt_no_generate:-${IOS_RUN_NO_GENERATE:-0}}"
LAUNCH_ARGS="${IOS_RUN_LAUNCH_ARGS:-}"
LAUNCH_ENV="${IOS_RUN_LAUNCH_ENV:-}"
# One derived data folder per checkout: two checkouts (or two agents in two worktrees) never share build
# products, and later builds in the same checkout stay incremental.
checkout_key="$(basename "$ROOT")-$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1)"
DERIVED="${opt_derived:-$(abs_from "$ROOT" "${IOS_RUN_DERIVED_DATA:-}")}"
[ -n "$DERIVED" ] || DERIVED="${TMPDIR:-/tmp}"
[ -n "${opt_derived}${IOS_RUN_DERIVED_DATA:-}" ] || DERIVED="${DERIVED%/}/ios-run/$checkout_key/dd"
[ -z "$JOBS" ] || [[ "$JOBS" =~ ^[0-9]+$ ]] || die "--jobs must be a number"

# ---------------------------------------------------------------------------------------------------------
# Helpers.
TMP_DIR=""
LOCK=""
cleanup() {
  if [ -n "$LOCK" ] && [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ]; then rm -rf "$LOCK"; fi
  if [ -n "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi
}
trap cleanup EXIT
tmp_file() {
  [ -n "$TMP_DIR" ] || TMP_DIR="$(mktemp -d)"
  mktemp "$TMP_DIR/XXXXXX"
}

# run <command...>: runs a command that changes state, or prints it in a dry run.
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }
need_jq() { have jq || die "jq is required (macOS 15 and later include /usr/bin/jq; else: brew install jq)"; }
need_scheme() { [ -n "$SCHEME" ] || die "no scheme: set IOS_RUN_SCHEME in .ios-run.env or pass --scheme"; }

# lock_derived: one build at a time per derived data folder. Another process that builds into the same
# folder (a second agent in this checkout) waits here instead of corrupting the build. A lock whose
# holder died is removed.
lock_derived() {
  [ "$DRY_RUN" = 1 ] && return 0
  local lock="${DERIVED%/}.lock" waited=0 holder mtime
  mkdir -p "$(dirname "$lock")"
  until mkdir "$lock" 2>/dev/null; do
    holder="$(cat "$lock/pid" 2>/dev/null || true)"
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
      rm -rf "$lock"
      continue
    fi
    mtime="$(stat -f %m "$lock" 2>/dev/null || stat -c %Y "$lock" 2>/dev/null || echo 0)"
    if [ -z "$holder" ] && [ $(($(date +%s) - mtime)) -gt 60 ]; then
      rm -rf "$lock"
      continue
    fi
    if [ $((waited % 30)) -eq 0 ]; then log "process ${holder:-?} builds into $DERIVED; waiting"; fi
    sleep 2
    waited=$((waited + 2))
  done
  echo $$ >"$lock/pid"
  LOCK="$lock"
}

# generate: XcodeGen before each build. A file that was added or removed since the last generate otherwise
# gives "file not found" or "missing symbol" errors from a stale project.
generate() {
  [ "$NO_GENERATE" = 1 ] && return 0
  [ -n "$SPEC" ] || return 0
  [ -f "$SPEC" ] || [ "$DRY_RUN" = 1 ] || die "XcodeGen spec not found: $SPEC"
  have xcodegen || [ "$DRY_RUN" = 1 ] || die "xcodegen not found: brew install xcodegen"
  log "generating the Xcode project from $SPEC"
  run xcodegen generate --quiet --spec "$SPEC" --project "$(dirname "$SPEC")"
}

# xcb <args...>: xcodebuild from the config folder with the project or workspace, the scheme and the
# derived data. xcbeautify shortens the output when it is installed.
xcb() {
  local args=()
  if [ -n "$WORKSPACE" ]; then
    args+=(-workspace "$WORKSPACE")
  elif [ -n "$PROJECT" ]; then
    args+=(-project "$PROJECT")
  fi
  args+=(-scheme "$SCHEME" -derivedDataPath "$DERIVED")
  [ -n "$JOBS" ] && args+=(-jobs "$JOBS")
  args+=("$@")
  if [ "$DRY_RUN" = 1 ]; then
    run xcodebuild "${args[@]}"
    return 0
  fi
  if have xcbeautify; then
    (cd "$ROOT" && xcodebuild "${args[@]}" 2>&1 | xcbeautify --quiet)
  else
    (cd "$ROOT" && xcodebuild "${args[@]}")
  fi
}

# find_app <products dir>: the built .app.
find_app() {
  local dir="$1" found=() f
  if [ -n "$PRODUCT" ]; then
    echo "$dir/$PRODUCT.app"
    return 0
  fi
  for f in "$dir"/*.app; do [ -d "$f" ] && found+=("$f"); done
  if [ "${#found[@]}" -eq 1 ]; then
    echo "${found[0]}"
  elif [ -n "$SCHEME" ] && [ -d "$dir/$SCHEME.app" ]; then
    echo "$dir/$SCHEME.app"
  elif [ "$DRY_RUN" = 1 ]; then
    echo "$dir/${SCHEME:-App}.app"
  elif [ "${#found[@]}" -eq 0 ]; then
    die "no .app in $dir: build first (sim build or device build)"
  else
    die "more than one .app in $dir: set IOS_RUN_PRODUCT"
  fi
}

plist_value() { /usr/libexec/PlistBuddy -c "Print :$2" "$1/Info.plist" 2>/dev/null; }

bundle_id_of() {
  if [ -n "$BUNDLE_ID" ]; then
    echo "$BUNDLE_ID"
  elif [ -f "$1/Info.plist" ]; then
    plist_value "$1" CFBundleIdentifier
  elif [ "$DRY_RUN" = 1 ]; then
    echo "BUNDLE_ID"
  else
    die "cannot read the bundle id of $1: set IOS_RUN_BUNDLE_ID"
  fi
}

# child_env <prefix>: KEY=VALUE words for `env`, from IOS_RUN_LAUNCH_ENV. simctl passes SIMCTL_CHILD_* and
# devicectl passes DEVICECTL_CHILD_* variables to the launched app, without the prefix.
CHILD_ENV=()
child_env() {
  CHILD_ENV=()
  local pair
  for pair in $LAUNCH_ENV; do
    [[ "$pair" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]] || die "IOS_RUN_LAUNCH_ENV entries must be KEY=VALUE: $pair"
    CHILD_ENV+=("$1$pair")
  done
}

# launch_args: IOS_RUN_LAUNCH_ARGS, then the arguments after --.
LAUNCH=()
launch_args() {
  LAUNCH=()
  local arg
  for arg in $LAUNCH_ARGS; do LAUNCH+=("$arg"); done
  if [ "${#APP_ARGS[@]}" -gt 0 ]; then LAUNCH+=("${APP_ARGS[@]}"); fi
}

# ---------------------------------------------------------------------------------------------------------
# Simulators. The choice is stable: a name and an OS version give one simulator. With no name, a plain
# "iPhone <number>" model wins over Pro, Max, Air and other models, then the newest iOS runtime, then the
# name in sort order. So every run on one machine picks the same simulator.
# shellcheck disable=SC2016 # $name and $want_os are jq variables
SIM_JQ='[ .devices | to_entries[]
  | select(.key | test("SimRuntime\\.iOS-"))
  | (.key | sub(".*SimRuntime\\.iOS-"; "") | gsub("-"; ".")) as $os
  | .value[]
  | select(.isAvailable != false)
  | select(if $name == "" then (.name | startswith("iPhone")) else .name == $name end)
  | select($want_os == "" or $os == $want_os)
  | {os: $os, name: .name, udid: .udid, state: .state} ]
  | sort_by([(if .name | test("^iPhone [0-9]+$") then 0 else 1 end), (.os | split(".") | map(tonumber | -.)),
             .name, .udid])'

sim_candidates() { # name os
  need_jq
  xcrun simctl list devices available -j | jq -c --arg name "$1" --arg want_os "$2" "$SIM_JQ"
}

RESOLVED_UDID=""
sim_udid() {
  if [ -n "$RESOLVED_UDID" ]; then return 0; fi
  if [ -n "$SIM_UDID" ]; then
    RESOLVED_UDID="$SIM_UDID"
    return 0
  fi
  RESOLVED_UDID="$(sim_candidates "$SIM_NAME" "$SIM_OS" | jq -r '.[0].udid // empty')"
  if [ -z "$RESOLVED_UDID" ]; then
    die "no available simulator${SIM_NAME:+ named \"$SIM_NAME\"}${SIM_OS:+ on iOS $SIM_OS}. See: ios-run.sh sim list"
  fi
}

sim_window_app() {
  local dev
  dev="$(xcode-select -p 2>/dev/null || echo /Applications/Xcode.app/Contents/Developer)"
  # Xcode 27 replaced Simulator.app with DeviceHub, in Contents/Applications.
  if [ -d "${dev%/Developer}/Applications/DeviceHub.app" ]; then
    echo "${dev%/Developer}/Applications/DeviceHub.app"
  elif [ -d "$dev/Applications/Simulator.app" ]; then
    echo "$dev/Applications/Simulator.app"
  else
    return 1
  fi
}

sim_products() { echo "$DERIVED/Build/Products/$CONFIGURATION-iphonesimulator"; }

sim_boot() {
  sim_udid
  log "booting simulator $RESOLVED_UDID"
  run xcrun simctl bootstatus "$RESOLVED_UDID" -b
}

sim_open() {
  sim_udid
  local app
  app="$(sim_window_app)" || die "neither DeviceHub.app nor Simulator.app is in the selected Xcode"
  if [ "${app##*/}" = Simulator.app ]; then
    run open -a "$app" --args -CurrentDeviceUDID "$RESOLVED_UDID"
  else
    run open -a "$app"
  fi
}

sim_build() {
  need_scheme
  sim_udid
  generate
  lock_derived
  log "building $SCHEME ($CONFIGURATION) for simulator $RESOLVED_UDID into $DERIVED"
  xcb -configuration "$CONFIGURATION" -destination "platform=iOS Simulator,id=$RESOLVED_UDID" build ||
    die "xcodebuild failed: see the first error above"
}

sim_install() {
  sim_udid
  local app="${1:-$(find_app "$(sim_products)")}"
  [ -d "$app" ] || [ "$DRY_RUN" = 1 ] || die "app not found: $app"
  log "installing $(basename "$app")"
  run xcrun simctl install "$RESOLVED_UDID" "$app"
}

sim_launch() {
  sim_udid
  local bundle
  bundle="$(bundle_id_of "${1:-$(find_app "$(sim_products)")}")"
  child_env SIMCTL_CHILD_
  launch_args
  log "launching $bundle"
  run env ${CHILD_ENV[@]+"${CHILD_ENV[@]}"} xcrun simctl launch --terminate-running-process \
    "$RESOLVED_UDID" "$bundle" ${LAUNCH[@]+"${LAUNCH[@]}"}
}

sim_command() {
  local sub="${1:-}"
  [ "$#" -gt 0 ] && shift
  case "$sub" in
    list)
      # Newest OS first; * marks the simulator that the other sim commands use.
      local chosen=""
      chosen="$( (sim_udid && echo "$RESOLVED_UDID") 2>/dev/null || true)"
      sim_candidates "" "" | jq -r --arg chosen "$chosen" 'sort_by([(.os | split(".") | map(tonumber | -.)), .name])
        | .[] | [(if .udid == $chosen then "*" else " " end), .os, .state, .name, .udid] | @tsv'
      ;;
    udid)
      sim_udid
      echo "$RESOLVED_UDID"
      ;;
    boot) sim_boot ;;
    open) sim_open ;;
    build) sim_build ;;
    install) sim_install "${1:-}" ;;
    launch) sim_launch ;;
    run)
      sim_boot
      [ "$OPEN" = 1 ] && sim_open
      [ "$NO_BUILD" = 1 ] || sim_build
      sim_install
      sim_launch
      ;;
    screenshot)
      sim_udid
      local file="${1:-$PWD/screenshot-$(date +%Y%m%d-%H%M%S).png}"
      run xcrun simctl io "$RESOLVED_UDID" screenshot "$file"
      ;;
    statusbar)
      sim_udid
      if [ "${1:-}" = clear ]; then
        run xcrun simctl status_bar "$RESOLVED_UDID" clear
      else
        run xcrun simctl status_bar "$RESOLVED_UDID" override --time 9:41 --dataNetwork wifi --wifiMode active \
          --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
      fi
      ;;
    openurl)
      [ -n "${1:-}" ] || die "sim openurl needs a URL"
      sim_udid
      case "$1" in
        http://* | https://*) ;;
        *) log "a custom scheme shows an \"Open in ...?\" prompt; tap Open, or use launch arguments in automation" ;;
      esac
      run xcrun simctl openurl "$RESOLVED_UDID" "$1"
      ;;
    log)
      sim_udid
      local app exe
      app="$(find_app "$(sim_products)")"
      exe="$(plist_value "$app" CFBundleExecutable || basename "$app" .app)"
      run xcrun simctl spawn "$RESOLVED_UDID" log stream --style compact --level debug \
        --predicate "process == \"$exe\""
      ;;
    record)
      [ -n "${1:-}" ] || die "sim record needs an output file"
      sim_udid
      log "recording; press Ctrl-C to stop"
      run xcrun simctl io "$RESOLVED_UDID" recordVideo --codec h264 --force "$1"
      ;;
    reset)
      sim_udid
      local bundle
      bundle="$(bundle_id_of "$(find_app "$(sim_products)")")"
      run xcrun simctl terminate "$RESOLVED_UDID" "$bundle" 2>/dev/null || true
      run xcrun simctl uninstall "$RESOLVED_UDID" "$bundle"
      ;;
    erase)
      sim_udid
      if [ "$YES" != 1 ] && [ "$DRY_RUN" != 1 ]; then
        die "erase deletes every app and all data on simulator $RESOLVED_UDID; add --yes"
      fi
      run xcrun simctl shutdown "$RESOLVED_UDID" 2>/dev/null || true
      run xcrun simctl erase "$RESOLVED_UDID"
      ;;
    *) die "unknown sim command '${sub}' (see --help)" ;;
  esac
}

# ---------------------------------------------------------------------------------------------------------
# Devices. devicectl reports each device as JSON: pairingState (paired or unpaired), tunnelState
# (connected, disconnected or unavailable), transportType (wired or localNetwork) and developerModeStatus.
# A device is usable when it is paired and its tunnel is not "unavailable"; devicectl connects the tunnel
# when a command needs it, over USB or Wi-Fi.
devices_json() {
  need_jq
  local file
  file="$(tmp_file)"
  xcrun devicectl list devices --json-output "$file" >/dev/null 2>&1 || die "devicectl could not list devices"
  cat "$file"
}

DEVICE_ID="" DEVICE_UDID="" DEVICE_NAME=""
device_pick() {
  [ -n "$DEVICE_ID" ] && return 0
  local json row
  json="$(devices_json)"
  row="$(jq -r --arg want "$DEVICE" '
    [ .result.devices[]
      | select(.hardwareProperties.platform == "iOS")
      | select($want == "" or .deviceProperties.name == $want or .identifier == $want
               or .hardwareProperties.udid == $want)
      | select(.connectionProperties.pairingState == "paired")
      | select(.connectionProperties.tunnelState != "unavailable") ]
    | first // empty | [.identifier, .hardwareProperties.udid, .deviceProperties.name] | @tsv' <<<"$json")"
  if [ -z "$row" ]; then
    local why
    why="$(jq -r --arg want "$DEVICE" '.result.devices[]
      | select(.hardwareProperties.platform == "iOS")
      | select($want == "" or .deviceProperties.name == $want or .hardwareProperties.udid == $want)
      | "  \(.deviceProperties.name): pairing \(.connectionProperties.pairingState // "?"), tunnel \(.connectionProperties.tunnelState // "?")"' <<<"$json")"
    die "no available paired iPhone${DEVICE:+ named \"$DEVICE\"}. Unlock it, join the same Wi-Fi (or connect USB), and see RUNNING.md.${why:+
$why}"
  fi
  IFS=$'\t' read -r DEVICE_ID DEVICE_UDID DEVICE_NAME <<<"$row"
  log "device: $DEVICE_NAME ($DEVICE_UDID)"
}

device_products() { echo "$DERIVED/Build/Products/$DEVICE_CONFIGURATION-iphoneos"; }

device_build() {
  need_scheme
  device_pick
  generate
  lock_derived
  local signing=(-allowProvisioningUpdates CODE_SIGN_STYLE=Automatic)
  [ -n "$TEAM_ID" ] && signing+=("DEVELOPMENT_TEAM=$TEAM_ID")
  # With no Apple ID in Xcode > Settings > Accounts, an App Store Connect API key lets xcodebuild create or
  # update the development certificate and profile (and register this device).
  if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then
    local key="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8}"
    [ -f "$key" ] || die "App Store Connect key not found: $key"
    signing+=(-authenticationKeyPath "$key" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
    log "signing with App Store Connect API key $ASC_KEY_ID"
  fi
  log "building $SCHEME ($DEVICE_CONFIGURATION) for $DEVICE_NAME into $DERIVED"
  xcb -configuration "$DEVICE_CONFIGURATION" -destination "platform=iOS,id=$DEVICE_UDID" "${signing[@]}" build ||
    die "xcodebuild failed: see the first error above (signing errors: run ios-run.sh doctor)"
}

device_install() {
  device_pick
  local app="${1:-$(find_app "$(device_products)")}"
  [ -d "$app" ] || [ "$DRY_RUN" = 1 ] || die "app not found: $app"
  log "installing $(basename "$app") on $DEVICE_NAME"
  run xcrun devicectl device install app --device "$DEVICE_ID" "$app" || die "install failed: is the device unlocked?"
}

device_launch() {
  device_pick
  local bundle
  bundle="$(bundle_id_of "$(find_app "$(device_products)")")"
  child_env DEVICECTL_CHILD_
  launch_args
  [ "${#LAUNCH[@]}" -gt 0 ] && LAUNCH=(-- "${LAUNCH[@]}")
  log "launching $bundle on $DEVICE_NAME"
  run env ${CHILD_ENV[@]+"${CHILD_ENV[@]}"} xcrun devicectl device process launch --terminate-existing \
    --device "$DEVICE_ID" "$bundle" ${LAUNCH[@]+"${LAUNCH[@]}"} ||
    die "the launch failed: the device may be locked; open the app by hand"
}

device_command() {
  local sub="${1:-}"
  [ "$#" -gt 0 ] && shift
  case "$sub" in
    list)
      devices_json | jq -r '
        ["NAME", "UDID", "OS", "PAIRING", "TUNNEL", "TRANSPORT", "DEV MODE"],
        (.result.devices[] | select(.hardwareProperties.platform == "iOS")
          | [.deviceProperties.name, .hardwareProperties.udid, (.deviceProperties.osVersionNumber // "?"),
             (.connectionProperties.pairingState // "?"), (.connectionProperties.tunnelState // "?"),
             (.connectionProperties.transportType // "-"), (.deviceProperties.developerModeStatus // "?")])
        | @tsv' | awk -F'\t' '{printf "%-24s %-28s %-6s %-9s %-13s %-13s %s\n", $1, $2, $3, $4, $5, $6, $7}'
      ;;
    build) device_build ;;
    install) device_install "${1:-}" ;;
    launch) device_launch ;;
    run)
      [ "$NO_BUILD" = 1 ] || device_build
      device_install
      device_launch
      ;;
    *) die "unknown device command '${sub}' (see --help)" ;;
  esac
}

# ---------------------------------------------------------------------------------------------------------
# Doctor: read-only checks. Exit 1 when a required item fails.
DOCTOR_FAILED=0
ok() { printf '  ok    %s\n' "$*"; }
warn() { printf '  warn  %s\n' "$*"; }
bad() {
  printf '  FAIL  %s\n' "$*"
  DOCTOR_FAILED=1
}

doctor() {
  echo "Xcode"
  local dev
  if dev="$(xcode-select -p 2>/dev/null)"; then
    ok "$(xcodebuild -version 2>/dev/null | head -1) at $dev"
  else
    bad "no Xcode selected: xcode-select -s /Applications/Xcode.app"
  fi
  local window
  if window="$(sim_window_app)"; then ok "simulator window: $window"; else warn "no DeviceHub.app or Simulator.app"; fi

  echo "Tools"
  if have jq; then ok "jq"; else bad "jq missing (brew install jq)"; fi
  if have xcodegen; then
    ok "xcodegen $(xcodegen --version 2>/dev/null | awk '{print $NF}')"
  elif [ -n "$SPEC" ]; then
    bad "xcodegen missing and the project uses $SPEC (brew install xcodegen)"
  else
    warn "xcodegen missing (only needed with a project.yml)"
  fi
  if have xcbeautify; then ok "xcbeautify"; else warn "xcbeautify missing (optional: shorter build output)"; fi

  echo "Project"
  if [ -n "$CONFIG_FILE" ]; then ok "config: $CONFIG_FILE"; else warn "no .ios-run.env: values come from flags and the environment"; fi
  if [ -n "$SCHEME" ]; then ok "scheme: $SCHEME ($CONFIGURATION; device: $DEVICE_CONFIGURATION)"; else bad "no scheme (IOS_RUN_SCHEME)"; fi
  local container="${WORKSPACE:-$PROJECT}"
  if [ -n "$container" ] && [ -e "$container" ]; then
    ok "project: $container"
  elif [ -n "$container" ] && [ -n "$SPEC" ]; then
    warn "project $container is not generated yet: the next build runs XcodeGen"
  elif [ -n "$container" ]; then
    bad "project not found: $container"
  fi
  if [ -n "$SPEC" ]; then ok "XcodeGen spec: $SPEC"; fi
  ok "derived data: $DERIVED"
  local base="$DERIVED" free_kb
  while [ ! -d "$base" ]; do base="$(dirname "$base")"; done
  free_kb="$(df -k "$base" | awk 'NR == 2 {print $4}')"
  if [ "${free_kb:-0}" -lt $((10 * 1024 * 1024)) ]; then
    warn "only $((free_kb / 1024 / 1024)) GiB free; a build can need 10 GiB"
  else
    ok "$((free_kb / 1024 / 1024)) GiB free"
  fi

  echo "Simulators"
  if have jq; then
    local runtimes
    runtimes="$(xcrun simctl list runtimes available -j 2>/dev/null |
      jq -r '[.runtimes[] | select(.platform == "iOS") | .version] | join(", ")' || true)"
    if [ -n "$runtimes" ]; then ok "iOS runtimes: $runtimes"; else bad "no iOS simulator runtime: xcodebuild -downloadPlatform iOS"; fi
    if (sim_udid) 2>/dev/null; then
      sim_udid
      ok "simulator: $(sim_candidates "" "" | jq -r --arg u "$RESOLVED_UDID" '.[] | select(.udid == $u) | "\(.name), iOS \(.os), \(.state)"') ($RESOLVED_UDID)"
    else
      bad "no simulator matches${SIM_NAME:+ name \"$SIM_NAME\"}${SIM_OS:+ OS $SIM_OS} (ios-run.sh sim list)"
    fi
  fi

  echo "Signing"
  local identities count
  identities="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  count="$(grep -c '"Apple Development' <<<"$identities" || true)"
  if [ "$count" -eq 0 ]; then
    warn "no Apple Development identity with a private key: device builds create one through automatic signing"
  else
    ok "$count Apple Development identities (ios-signing.sh identities shows their expiry)"
  fi
  if [ -n "${ASC_KEY_ID:-}" ]; then
    local key="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8}"
    if [ -f "$key" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then ok "App Store Connect key $ASC_KEY_ID"; else bad "ASC_KEY_ID is set, but the key file or ASC_ISSUER_ID is missing"; fi
  fi

  if [ "$NO_DEVICES" != 1 ] && have jq; then
    echo "Devices"
    local rows
    rows="$(devices_json | jq -r '.result.devices[] | select(.hardwareProperties.platform == "iOS")
      | [.deviceProperties.name, (.connectionProperties.pairingState // "?"), (.connectionProperties.tunnelState // "?"),
         (.connectionProperties.transportType // "-"), (.deviceProperties.developerModeStatus // "?")] | @tsv')"
    if [ -z "$rows" ]; then warn "no iOS device known to this Mac (pair one: see RUNNING.md)"; fi
    local name pairing tunnel transport devmode
    while IFS=$'\t' read -r name pairing tunnel transport devmode; do
      [ -n "$name" ] || continue
      if [ "$pairing" != paired ]; then
        warn "$name: not paired (connect USB once and trust this Mac)"
      elif [ "$devmode" != enabled ]; then
        warn "$name: Developer Mode is $devmode (Settings > Privacy & Security > Developer Mode)"
      elif [ "$tunnel" = unavailable ]; then
        warn "$name: unavailable (unlock it and join the same Wi-Fi, or connect USB)"
      else
        ok "$name: paired, tunnel $tunnel, $transport"
      fi
    done <<<"$rows"
  fi
  return "$DOCTOR_FAILED"
}

print_config() {
  printf '%-22s %s\n' config "${CONFIG_FILE:-<none>}" root "$ROOT" project "${PROJECT:-<auto>}" \
    workspace "${WORKSPACE:-<none>}" spec "${SPEC:-<none>}" scheme "${SCHEME:-<unset>}" \
    configuration "$CONFIGURATION" device-configuration "$DEVICE_CONFIGURATION" product "${PRODUCT:-<auto>}" \
    bundle-id "${BUNDLE_ID:-<from app>}" team "${TEAM_ID:-<from project>}" sim-name "${SIM_NAME:-<auto>}" \
    sim-os "${SIM_OS:-<newest>}" sim-udid "${SIM_UDID:-<auto>}" device "${DEVICE:-<first paired>}" \
    derived-data "$DERIVED" jobs "${JOBS:-<xcodebuild default>}" launch-args "${LAUNCH_ARGS:-<none>}" \
    launch-env "${LAUNCH_ENV:-<none>}"
}

[ "${#POSITIONAL[@]}" -gt 0 ] || {
  usage >&2
  exit 2
}
command="${POSITIONAL[0]}"
rest=("${POSITIONAL[@]:1}")
case "$command" in
  sim) sim_command ${rest[@]+"${rest[@]}"} ;;
  device) device_command ${rest[@]+"${rest[@]}"} ;;
  doctor) doctor ;;
  config) print_config ;;
  *) die "unknown command '$command' (see --help)" ;;
esac
