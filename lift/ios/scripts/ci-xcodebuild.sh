#!/usr/bin/env bash
# CI's xcodebuild for Lift, in halves that run in different jobs:
#   scripts/ci-xcodebuild.sh app <log>                builds the app alone (for the screenshot jobs), for any
#                                                     arm64 simulator, with Xcode's compilation cache in build/cas
#                                                     (CI saves and restores it)
#   scripts/ci-xcodebuild.sh build <log>              build-for-testing with the same settings (adds the tests)
#   scripts/ci-xcodebuild.sh test <log> <xctestrun>   test-without-building on the simulator SIM_UDID, from
#                                                     products the build job made
# Log lines get a UTC time stamp. Prints the log's tail and its unique errors; exits with xcodebuild's status.
set -euo pipefail
MODE="$1"
LOG="$PWD/$2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
case "$MODE" in
  app | build)
    action=build-for-testing
    [ "$MODE" = app ] && action=build
    args=("$action"
      -project "$ROOT/lift/ios/Lift.xcodeproj"
      -scheme Lift
      -destination "generic/platform=iOS Simulator"
      -derivedDataPath "$ROOT/build/lift"
      -clonedSourcePackagesDirPath "$ROOT/build/spm"
      -skipMacroValidation
      -skipPackagePluginValidation
      -showBuildTimingSummary
      ARCHS=arm64
      ONLY_ACTIVE_ARCH=YES
      CODE_SIGNING_ALLOWED=NO
      COMPILER_INDEX_STORE_ENABLE=NO
      COMPILATION_CACHE_ENABLE_CACHING=YES
      COMPILATION_CACHE_CAS_PATH="$ROOT/build/cas")
    # The scheme gathers coverage; CI does not (instrumented builds and test runs are slower). A plain build
    # never instruments, so both halves compile the app the same way and the second reuses the first.
    [ "$MODE" = build ] && args+=(-enableCodeCoverage NO)
    ;;
  test)
    args=(test-without-building
      -xctestrun "$3"
      -destination "id=$SIM_UDID"
      -parallel-testing-enabled NO)
    ;;
  *) echo "usage: $0 app|build|test <log> [xctestrun]" >&2 && exit 2 ;;
esac
status=0
xcodebuild "${args[@]}" 2>&1 | perl -MPOSIX -ne 'print strftime("%H:%M:%S ", gmtime), $_' >"$LOG" || status=$?
tail -n 40 "$LOG"
echo "::group::Unique errors ($MODE)"
grep -E "(error|warning):|✘|recorded an issue|\*\* (BUILD|TEST)[A-Z ]* " "$LOG" | grep -v "^[0-9:]* *|" | sort -u | head -n 150 || true
echo "::endgroup::"
exit "$status"
