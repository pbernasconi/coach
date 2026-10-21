#!/usr/bin/env bash
# Tests for the run tooling (ios-run.sh, ios-screenshots.sh, ios-signing.sh, check-vendor-pins.py). Fake
# xcrun, xcode-select and devicectl output stand in for Xcode, so the tests touch no simulator, no device
# and no keychain, and they also run where Xcode is missing (the signing test needs macOS).
#   scripts/tests/run-tools-test.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASS=0 FAIL=0

check() { # <name> <expected substring> <actual>
  if [[ "$3" == *"$2"* ]]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s\n  expected to contain: %s\n  got:\n%s\n' "$1" "$2" "$3" >&2
  fi
}
check_not() { # <name> <unexpected substring> <actual>
  if [[ "$3" != *"$2"* ]]; then PASS=$((PASS + 1)); else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s\n  must not contain: %s\n' "$1" "$2" >&2
  fi
}

# --- Fakes -------------------------------------------------------------------------------------------------
mkdir -p "$WORK/bin" "$WORK/xcode/Contents/Developer" "$WORK/xcode/Contents/Applications/DeviceHub.app"
cat >"$WORK/simctl.json" <<'EOF'
{"devices": {
  "com.apple.CoreSimulator.SimRuntime.iOS-18-4": [
    {"name": "iPhone 16", "udid": "SIM-16-184", "state": "Shutdown", "isAvailable": true}],
  "com.apple.CoreSimulator.SimRuntime.iOS-26-4": [
    {"name": "iPhone 17 Pro", "udid": "SIM-17PRO-264", "state": "Booted", "isAvailable": true},
    {"name": "iPhone 17", "udid": "SIM-17-264", "state": "Shutdown", "isAvailable": true}],
  "com.apple.CoreSimulator.SimRuntime.iOS-27-1": [
    {"name": "iPhone Fold", "udid": "SIM-FOLD-271", "state": "Shutdown", "isAvailable": true},
    {"name": "iPhone 17", "udid": "SIM-17-271", "state": "Shutdown", "isAvailable": true}],
  "com.apple.CoreSimulator.SimRuntime.watchOS-12-0": [
    {"name": "Apple Watch", "udid": "WATCH", "state": "Shutdown", "isAvailable": true}]
}}
EOF
cat >"$WORK/devicectl.json" <<'EOF'
{"result": {"devices": [
  {"identifier": "ID-OLD", "deviceProperties": {"name": "Old Phone", "developerModeStatus": "enabled"},
   "hardwareProperties": {"platform": "iOS", "udid": "UDID-OLD"},
   "connectionProperties": {"pairingState": "unpaired", "tunnelState": "unavailable"}},
  {"identifier": "ID-GONE", "deviceProperties": {"name": "Away Phone", "developerModeStatus": "enabled"},
   "hardwareProperties": {"platform": "iOS", "udid": "UDID-GONE"},
   "connectionProperties": {"pairingState": "paired", "tunnelState": "unavailable"}},
  {"identifier": "ID-WIFI", "deviceProperties": {"name": "Test Phone", "developerModeStatus": "enabled",
   "osVersionNumber": "26.4"}, "hardwareProperties": {"platform": "iOS", "udid": "UDID-WIFI"},
   "connectionProperties": {"pairingState": "paired", "tunnelState": "disconnected", "transportType": "localNetwork"}},
  {"identifier": "ID-WATCH", "deviceProperties": {"name": "Test Watch"},
   "hardwareProperties": {"platform": "watchOS", "udid": "UDID-WATCH"},
   "connectionProperties": {"pairingState": "paired", "tunnelState": "connected"}}
]}}
EOF
cat >"$WORK/bin/xcrun" <<EOF
#!/usr/bin/env bash
case "\$1 \$2" in
  "simctl list") cat "$WORK/simctl.json" ;;
  "devicectl list")
    while [ "\$#" -gt 0 ]; do [ "\$1" = --json-output ] && cp "$WORK/devicectl.json" "\$2"; shift; done ;;
  *) echo "unexpected xcrun \$*" >&2; exit 1 ;;
esac
EOF
printf '#!/usr/bin/env bash\necho %q\n' "$WORK/xcode/Contents/Developer" >"$WORK/bin/xcode-select"
chmod +x "$WORK/bin/"*
export PATH="$WORK/bin:$PATH"
unset "${!IOS_RUN_@}" ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH 2>/dev/null || true
RUN="$HERE/ios-run.sh"
cd "$WORK"

# --- Simulator choice -------------------------------------------------------------------------------------
check "named simulator and OS" "SIM-17-264" "$("$RUN" --sim "iPhone 17" --os 26.4 sim udid)"
check "named simulator picks the newest OS" "SIM-17-271" "$("$RUN" --sim "iPhone 17" sim udid)"
check "default prefers a plain iPhone <number> on the newest OS" "SIM-17-271" "$("$RUN" sim udid)"
check "an exact name does not match a longer name" "SIM-17PRO-264" "$("$RUN" --sim "iPhone 17 Pro" sim udid)"
check "unknown simulator fails" "no available simulator named \"Nope\"" "$("$RUN" --sim Nope sim udid 2>&1 || true)"
check "explicit UDID wins" "MY-UDID" "$("$RUN" --udid MY-UDID --sim Nope sim udid)"
list="$("$RUN" --sim "iPhone 17" --os 26.4 sim list)"
check "list marks the chosen simulator" "*	26.4	Shutdown	iPhone 17	SIM-17-264" "$list"
check_not "list hides other platforms" "Apple Watch" "$list"

# --- Config file and precedence ---------------------------------------------------------------------------
mkdir -p "$WORK/app/sub"
cat >"$WORK/app/.ios-run.env" <<'EOF'
# comment
IOS_RUN_SCHEME=Demo
IOS_RUN_PROJECT=Demo.xcodeproj
IOS_RUN_SIM_NAME="iPhone 17"
IOS_RUN_SIM_OS=26.4
IOS_RUN_BUNDLE_ID=com.example.demo
IOS_RUN_LAUNCH_ARGS=-demo
IOS_RUN_LAUNCH_ENV="API_BASE_URL=http://localhost:3000 FEATURE=1"
IOS_RUN_DERIVED_DATA=build/dd
IOS_RUN_JOBS=6      # a trailing comment
NOT_OURS=1
EOF
touch "$WORK/app/project.yml"
cfg="$(cd "$WORK/app/sub" && "$RUN" config 2>&1)"
check "config is found in a parent folder" "$WORK/app/.ios-run.env" "$cfg"
check "relative paths resolve from the config folder" "$WORK/app/Demo.xcodeproj" "$cfg"
check "derived data resolves from the config folder" "$WORK/app/build/dd" "$cfg"
check "project.yml next to the config is the spec" "$WORK/app/project.yml" "$cfg"
check "only IOS_RUN_ keys load" "ignored a line" "$cfg"
check "a trailing comment is not part of the value" "jobs                   6
" "$cfg"
check "the environment wins over the file" "scheme                 Other" \
  "$(cd "$WORK/app" && IOS_RUN_SCHEME=Other "$RUN" config 2>/dev/null)"
check "a flag wins over the environment" "scheme                 Flag" \
  "$(cd "$WORK/app" && IOS_RUN_SCHEME=Other "$RUN" --scheme Flag config 2>/dev/null)"
default_dd="$("$RUN" --scheme X config | awk '$1 == "derived-data" {print $2}')"
check "default derived data is per checkout" "/ios-run/$(basename "$WORK")-" "$default_dd"

# --- Simulator run (dry run) ------------------------------------------------------------------------------
out="$(cd "$WORK/app" && "$RUN" -n sim run -- -tab settings 2>&1)"
check "run boots the simulator" "+ xcrun simctl bootstatus SIM-17-264 -b" "$out"
check "run regenerates the project" "+ xcodegen generate --quiet --spec $WORK/app/project.yml" "$out"
check "run builds with its own derived data" "-derivedDataPath $WORK/app/build/dd" "$out"
check "run builds for the chosen simulator" "platform=iOS\ Simulator\,id=SIM-17-264" "$out"
check "run installs" "+ xcrun simctl install SIM-17-264 $WORK/app/build/dd/Build/Products/Debug-iphonesimulator/Demo.app" "$out"
check "run passes the launch environment with the simctl prefix" \
  "+ env SIMCTL_CHILD_API_BASE_URL=http://localhost:3000 SIMCTL_CHILD_FEATURE=1 xcrun simctl launch" "$out"
check "run passes the launch arguments" "com.example.demo -demo -tab settings" "$out"
check_not "--no-generate skips XcodeGen" "xcodegen" "$(cd "$WORK/app" && "$RUN" -n --no-generate sim build 2>&1)"
check_not "--no-build skips the build" "xcodebuild" "$(cd "$WORK/app" && "$RUN" -n --no-build sim run 2>&1)"
check "open uses DeviceHub on Xcode 27" "+ open -a $WORK/xcode/Contents/Applications/DeviceHub.app" "$("$RUN" -n sim open)"
rmdir "$WORK/xcode/Contents/Applications/DeviceHub.app"
mkdir -p "$WORK/xcode/Contents/Developer/Applications/Simulator.app"
check "open falls back to Simulator.app" "Simulator.app --args -CurrentDeviceUDID SIM-17-271" "$("$RUN" -n sim open)"
check "erase needs --yes" "add --yes" "$("$RUN" sim erase 2>&1 || true)"
check "erase with --yes in a dry run" "+ xcrun simctl erase SIM-17-271" "$("$RUN" -n --yes sim erase)"
check "openurl warns about the prompt" "Open in" "$("$RUN" -n sim openurl demo://x 2>&1)"
check "statusbar sets 9:41" "status_bar SIM-17-271 override --time 9:41" "$("$RUN" -n sim statusbar)"
check "build without a scheme fails" "no scheme" "$("$RUN" -n sim build 2>&1 || true)"
check "bad launch env fails" "must be KEY=VALUE" \
  "$(IOS_RUN_LAUNCH_ENV="oops" "$RUN" -n --bundle-id b sim launch 2>&1 || true)"

# --- Devices ----------------------------------------------------------------------------------------------
devices="$("$RUN" device list)"
check "device list shows the state" "Test Phone" "$devices"
check "device list shows the transport" "localNetwork" "$devices"
check_not "device list hides other platforms" "Test Watch" "$devices"
out="$(cd "$WORK/app" && "$RUN" -n device run -- -flag 2>&1)"
check "device run picks the first available paired iPhone" "device: Test Phone (UDID-WIFI)" "$out"
check "device build signs automatically" "-allowProvisioningUpdates CODE_SIGN_STYLE=Automatic build" "$out"
check "device build targets the device" "platform=iOS\,id=UDID-WIFI" "$out"
check "device install uses devicectl" "+ xcrun devicectl device install app --device ID-WIFI" "$out"
check "device launch passes the environment and the arguments" \
  "DEVICECTL_CHILD_FEATURE=1 xcrun devicectl device process launch --terminate-existing --device ID-WIFI com.example.demo -- -demo -flag" "$out"
check "a named unavailable device fails with its state" "Away Phone: pairing paired, tunnel unavailable" \
  "$("$RUN" -n --device "Away Phone" device install 2>&1 || true)"
mkdir -p "$WORK/keys"
touch "$WORK/keys/AuthKey_KEY1.p8"
out="$(cd "$WORK/app" && ASC_KEY_ID=KEY1 ASC_ISSUER_ID=ISSUER ASC_KEY_PATH="$WORK/keys/AuthKey_KEY1.p8" \
  "$RUN" -n --team TEAM1 device build 2>&1)"
check "device build uses the API key" "-authenticationKeyID KEY1 -authenticationKeyIssuerID ISSUER" "$out"
check "device build sets the team" "DEVELOPMENT_TEAM=TEAM1" "$out"
check "a missing API key file fails" "key not found" \
  "$(cd "$WORK/app" && ASC_KEY_ID=NOPE ASC_ISSUER_ID=I "$RUN" -n device build 2>&1 || true)"

# --- Screenshots (dry run) --------------------------------------------------------------------------------
out="$(SIM_UDID=S1 SCREENS="home: settings:-tab,settings" VARIANTS="dark ax3" BASE_ARGS=-demo \
  "$HERE/ios-screenshots.sh" -n "$WORK/App.app" "$WORK/shots" 2>&1)"
check "screenshots launch each screen with its arguments" "BUNDLE_ID -demo -tab settings" "$out"
check "screenshots set dark mode" "+ xcrun simctl ui S1 appearance dark" "$out"
check "screenshots set AX3" "content_size accessibility-extra-large" "$out"
check "screenshots name the files" "$WORK/shots/settings-ax3.png" "$out"
check "screenshots reset the simulator" "+ xcrun simctl status_bar S1 clear" "$out"

# --- Help -------------------------------------------------------------------------------------------------
for script in ios-run.sh ios-screenshots.sh ios-signing.sh package-tests.sh; do
  check "$script --help" "Usage" "$("$HERE/$script" --help)"
done
check "check-vendor-pins self-test" "ok" "$(python3 "$HERE/check-vendor-pins.py" --self-test)"
check "asc-revoke-ci-certs --help" "--apply" "$(python3 "$HERE/asc-revoke-ci-certs.py" --help)"

# --- Signing profile (macOS: PlistBuddy, plutil) ----------------------------------------------------------
if [ -x /usr/libexec/PlistBuddy ] && command -v openssl >/dev/null; then
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$WORK/key.pem" -out "$WORK/cert.pem" -days 400 \
    -subj "/CN=Apple Development: Test (TEAM1)/OU=TEAM1" >/dev/null 2>&1
  cert="$(openssl x509 -in "$WORK/cert.pem" -outform der | base64 | tr -d '\n')"
  expiry="$(date -u -v+200d +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$WORK/profile.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Name</key><string>Test Profile</string>
  <key>UUID</key><string>PROFILE-UUID</string>
  <key>TeamIdentifier</key><array><string>TEAM1</string></array>
  <key>ExpirationDate</key><date>$expiry</date>
  <key>Entitlements</key><dict>
    <key>application-identifier</key><string>TEAM1.com.example.*</string>
    <key>get-task-allow</key><true/>
  </dict>
  <key>ProvisionedDevices</key><array><string>UDID-WIFI</string></array>
  <key>DeveloperCertificates</key><array><data>$cert</data></array>
</dict></plist>
EOF
  SIGN="$HERE/ios-signing.sh"
  out="$("$SIGN" profile --plist "$WORK/profile.plist" --team TEAM1 --bundle-id com.example.demo --type development)"
  check "profile passes" "profile ok" "$out"
  check "profile type" "development" "$out"
  check "wrong team fails" "the team is TEAM1, expected OTHER" \
    "$("$SIGN" profile --plist "$WORK/profile.plist" --team OTHER 2>&1 || true)"
  check "wrong bundle id fails" "does not cover org.other.app" \
    "$("$SIGN" profile --plist "$WORK/profile.plist" --bundle-id org.other.app 2>&1 || true)"
  check "wrong type fails" "expected appstore" \
    "$("$SIGN" profile --plist "$WORK/profile.plist" --type appstore 2>&1 || true)"
  check "short validity fails" "sooner than 300 days" \
    "$("$SIGN" profile --plist "$WORK/profile.plist" --min-days 300 2>&1 || true)"
else
  echo "skipped the signing profile tests (needs macOS)"
fi

printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
