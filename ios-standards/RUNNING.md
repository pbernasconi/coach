# Running iOS apps locally

This guide covers the scripts that build, install and launch an app on a simulator or on a real iPhone, and the
checks around them. Every script is project-agnostic: project values come from flags, environment variables or a
`.ios-run.env` file. Every script has `--help`.

| Script | What it does |
| --- | --- |
| `scripts/ios-run.sh` | One entry point: `sim …`, `device …`, `doctor`, `config` |
| `scripts/ios-screenshots.sh` | Each screen in light, dark and AX3, with a clean status bar |
| `scripts/ios-signing.sh` | Read-only signing checks: keychain certificates, provisioning profiles |
| `scripts/asc-revoke-ci-certs.py` | Lists (and with `--apply` revokes) the development certificates that CI runners made |
| `scripts/package-tests.sh` | `swift test` for several packages side by side, with a short failure report |
| `scripts/check-vendor-pins.py` | Every remote package in `project.yml` is pinned to one exact version |
| `scripts/tests/run-tools-test.sh` | Tests for the scripts above, with a fake `xcrun` (no simulator or device) |

## Quick start

1. Copy `templates/config/.ios-run.env` to the folder that holds `project.yml`, and set the scheme.
2. Run `scripts/ios-run.sh doctor` and fix each `FAIL` line.
3. Run `scripts/ios-run.sh sim run --open` to build, install and launch the app on a simulator.
4. Run `scripts/ios-run.sh device run` to do the same on a paired iPhone (see "Physical device").

Use `-n` (`--dry-run`) to see the commands that change state without running them.

## Configuration

The script finds the nearest `.ios-run.env` from the current folder upward (or `--config <file>`). The file holds
`IOS_RUN_KEY=value` lines and no secrets. The script reads it as data and never runs it as shell code. Paths in it
are relative to the file. A flag wins over an environment variable, and an environment variable wins over the file.
`ios-run.sh config` prints the result.

| Variable | Flag | Default |
| --- | --- | --- |
| `IOS_RUN_SCHEME` | `--scheme` | none; a build needs it |
| `IOS_RUN_PROJECT`, `IOS_RUN_WORKSPACE` | `--project`, `--workspace` | xcodebuild finds the project in the config folder |
| `IOS_RUN_SPEC` | `--spec` | `project.yml` in the config folder, if it exists |
| `IOS_RUN_CONFIGURATION` | `--configuration` | `Debug` |
| `IOS_RUN_DEVICE_CONFIGURATION` | `--device-configuration` | the configuration above |
| `IOS_RUN_PRODUCT` | `--product` | the only `.app` in the products folder |
| `IOS_RUN_BUNDLE_ID` | `--bundle-id` | read from the built app's `Info.plist` |
| `IOS_RUN_TEAM_ID` | `--team` | the team in the project |
| `IOS_RUN_SIM_NAME`, `IOS_RUN_SIM_OS` | `--sim`, `--os` | see "A stable simulator" |
| `IOS_RUN_SIM_UDID` | `--udid` | none |
| `IOS_RUN_DEVICE` | `--device` | the first available paired iPhone |
| `IOS_RUN_DERIVED_DATA` | `--derived-data` | `$TMPDIR/ios-run/<checkout>-<hash>/dd` |
| `IOS_RUN_JOBS` | `--jobs` | the xcodebuild default (all cores) |
| `IOS_RUN_LAUNCH_ARGS` | arguments after `--` | none |
| `IOS_RUN_LAUNCH_ENV` | none | none; `KEY=VALUE KEY=VALUE`, for example a local API base URL |

Launch environment: `simctl` gives each `SIMCTL_CHILD_<KEY>` variable to the app as `<KEY>`, and `devicectl`
does the same with `DEVICECTL_CHILD_<KEY>`. The script adds the prefixes.

## Simulator

```bash
scripts/ios-run.sh sim list                  # * marks the simulator that the other commands use
scripts/ios-run.sh sim run --open -- -demo   # boot, build, install, launch with -demo, open the window
scripts/ios-run.sh sim screenshot shot.png
scripts/ios-run.sh sim statusbar             # 9:41, full battery and signal; "statusbar clear" removes it
scripts/ios-run.sh sim log                   # the app's unified log
scripts/ios-run.sh sim reset                 # uninstall the app: the next launch has no data
scripts/ios-run.sh sim erase --yes           # erase the whole simulator
```

- **The simulator window:** Xcode 27 replaced Simulator.app with DeviceHub, at
  `Xcode.app/Contents/Applications/DeviceHub.app`. `sim open` opens DeviceHub when it exists, else
  `Xcode.app/Contents/Developer/Applications/Simulator.app`. Builds, installs and launches do not need a window.
- **URLs:** `simctl openurl` with a custom scheme shows an "Open in …?" prompt that waits for a tap. In automation,
  open screens with launch arguments instead (`-- -tab settings`), and use `openurl` only for checks by hand.
- **Screenshots:** `ios-screenshots.sh <App.app> <out dir>` captures each screen from `SCREENS="name:arg,arg …"` in
  light, dark and AX3. It waits until frames stop changing instead of fixed sleeps, and it resets the simulator at
  the end.

### A stable simulator

`IOS_RUN_SIM_NAME` and `IOS_RUN_SIM_OS` (an exact name and an exact version) give one simulator on every run. The
name match is exact, so "iPhone 17" never matches "iPhone 17 Pro". With no name, the script picks a plain
`iPhone <number>` model on the newest iOS runtime. This rule does not hard-code a device name (`TOOL-2`), and it
gives the same simulator each time on one machine.

## Physical device (USB or Wi-Fi)

One-time setup:

1. Sign in to Xcode with an account on the app's team (Xcode > Settings > Accounts), or set an App Store Connect
   API key (see "Signing").
2. Connect the iPhone with a cable once, unlock it, and tap Trust.
3. In Xcode > Window > Devices and Simulators, select the iPhone and turn on "Connect via network".
4. On the iPhone, turn on Settings > Privacy & Security > Developer Mode, then restart it.

Each run: the iPhone is unlocked and on the same Wi-Fi as the Mac (or on the cable). Then:

```bash
scripts/ios-run.sh device list                 # pairing, tunnel, transport and Developer Mode state
scripts/ios-run.sh device run                  # build, install with devicectl, launch
scripts/ios-run.sh --device "My iPhone" --no-build device run   # install the last build again
```

`device build` uses `-allowProvisioningUpdates` and `CODE_SIGN_STYLE=Automatic`, so Xcode registers a new device
and updates the development profile. `devicectl list devices --json-output` reports the state that the script
reads:

| Field | Values | Meaning |
| --- | --- | --- |
| `connectionProperties.pairingState` | `paired`, `unpaired` | Unpaired: connect the cable once and tap Trust |
| `connectionProperties.tunnelState` | `connected`, `disconnected`, `unavailable` | Disconnected is usable (devicectl connects when needed); unavailable is not: unlock it, join the Wi-Fi |
| `connectionProperties.transportType` | `wired`, `localNetwork` | Cable or Wi-Fi |
| `deviceProperties.developerModeStatus` | `enabled`, `disabled` | Disabled: turn on Developer Mode |

## Parallel builds and agents

- **Derived data:** each checkout gets its own derived data folder by default, so two worktrees never share build
  products, and later builds in one checkout stay incremental. Two builds into the same folder wait for each
  other (a lock next to the folder; a lock whose process died is removed).
- **Simulators:** give each agent its own simulator (`IOS_RUN_SIM_NAME`/`IOS_RUN_SIM_OS` or `IOS_RUN_SIM_UDID` in
  its environment). Do not drive a simulator that a person or another agent uses.
- **Cores:** set `IOS_RUN_JOBS` (and `package-tests.sh --jobs`) when several builds share one Mac.

## XcodeGen

`sim build` and `device build` run `xcodegen generate` first, because the `.xcodeproj` lists every file. After a
file is added, removed or renamed, a stale project gives "file not found", "cannot find X in scope" or
missing-symbol link errors. Generate again before you look for another cause. `--no-generate` skips the step.

## Signing

- **Automatic signing without an Apple ID:** set `ASC_KEY_ID`, `ASC_ISSUER_ID` and the key file
  (`ASC_KEY_PATH`, default `~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8`). `device build` then adds
  `-allowProvisioningUpdates -authenticationKeyPath … -authenticationKeyID … -authenticationKeyIssuerID …`.
  Keep the key outside the repo; set the variables in the shell or in CI secrets, never in `.ios-run.env`.
- **The CI certificate limit:** a CI runner that signs automatically and has no development certificate asks Apple
  for a new one, and the runner's private key is gone when the job ends. Apple allows only a few development
  certificates per account, so after some runs every archive fails. Do both of these:
  1. Store one development certificate as a `.p12` in a CI secret, and import it into a temporary keychain
     before the build (example below).
  2. Remove leftovers with `scripts/asc-revoke-ci-certs.py`. It lists the "Created via API" certificates and,
     with `--apply`, revokes them. Put the stored certificate's id (and the id of any Mac that signs with the
     same key) in `ASC_KEEP_CERT_IDS`.
- **Health checks:** `ios-signing.sh identities` lists the certificates in the keychains with expiry, team and
  whether this Mac has the private key (a certificate without its key cannot sign).
  `ios-signing.sh profile <file> --team … --bundle-id … --type appstore --min-days 30` checks a profile before a
  release; run it on a schedule in CI to get a warning before a profile or certificate expires.

```yaml
- name: Import the signing certificate
  env:
    CERT_P12: ${{ secrets.CERT_P12 }}
    CERT_PASSWORD: ${{ secrets.CERT_PASSWORD }}
  run: |
    keychain="$RUNNER_TEMP/signing.keychain-db"
    security create-keychain -p "" "$keychain"
    security set-keychain-settings -lut 21600 "$keychain"
    security unlock-keychain -p "" "$keychain"
    printf '%s' "$CERT_P12" | base64 --decode > "$RUNNER_TEMP/cert.p12"
    security import "$RUNNER_TEMP/cert.p12" -k "$keychain" -P "$CERT_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple: -k "" "$keychain"
    security list-keychains -d user -s "$keychain" $(security list-keychains -d user | tr -d '"')
    rm -f "$RUNNER_TEMP/cert.p12"
```

## Package tests and pins

- `scripts/package-tests.sh` tests every `Packages/*/` package (or the folders you name), `--parallel 2` at a
  time. `--scratch-root <dir>` keeps each package's build outside the checkout. The report shows one line per
  package, then the log tail and the unique errors of each failed one.
- `scripts/check-vendor-pins.py --spec project.yml` fails when a remote package uses a range (`from:`,
  `majorVersion:`, `branch:`). Dependabot cannot read `project.yml`; with `--mirror Tools/VendorPins/Package.swift`
  (a package that repeats each pin with `exact:`), the check also keeps that mirror and `project.yml` the same.

## Tests for these scripts

`scripts/tests/run-tools-test.sh` runs the scripts against a fake `xcrun` and fake `devicectl` output. It covers the
simulator choice, the config file, dry runs of `sim run` and `device run`, the screenshot loop and the profile
checks. It touches no simulator, device or keychain. Run it after you change a script, with `lint-all.sh`.
